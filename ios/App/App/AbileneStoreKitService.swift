import Foundation
import StoreKit

/// Opaque, transaction-bound receipt. A boolean is never delivery authority.
struct DeliveryConfirmation: Sendable {
    let transactionId: String
    let receipt: String
}

protocol DeliveryConfirmationVerifier: Sendable {
    func verify(_ confirmation: DeliveryConfirmation, transaction: StoreKit.Transaction) async -> Bool
}

/// No Apple delivery backend exists yet. Shipping code always fails closed.
struct UnconfiguredDeliveryVerifier: DeliveryConfirmationVerifier {
    func verify(_ confirmation: DeliveryConfirmation, transaction: StoreKit.Transaction) async -> Bool { false }
}

/// Compile-time and launch-time gates. The regular App scheme never enables this.
enum LocalStoreKitTest {
    static var enabled: Bool {
        #if DEBUG && targetEnvironment(simulator)
        return ProcessInfo.processInfo.arguments.contains("--abilene-iap-local-test")
        #else
        return false
        #endif
    }
    static let products = LocalTestGate.products
    static var webBuildEnabled: Bool {
        guard let url = Bundle.main.url(forResource: "apple-iap-local-test", withExtension: "json", subdirectory: "public"),
              let data = try? Data(contentsOf: url),
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: Bool] else { return false }
        return value["enabled"] == true
    }
    static func gate() async -> LocalTestGate {
        var gate = LocalTestGate(nativeIOS: false, debug: false, simulator: false,
                                launchArgument: enabled, webBuildFlag: webBuildEnabled,
                                appVerified: false, environment: "", bundle: "")
        #if DEBUG && targetEnvironment(simulator)
        gate.nativeIOS = true; gate.debug = true; gate.simulator = true
        #endif
        guard enabled, webBuildEnabled, #available(iOS 16.0, *),
              let result = try? await AppTransaction.shared,
              case .verified(let app) = result else { return gate }
        gate.appVerified = true
        gate.environment = app.environment.rawValue
        gate.bundle = app.bundleID
        return gate
    }
    static func verifiedXcode() async -> Bool { await gate().allowed }
    static func makeService() -> AbileneStoreKitService {
        #if DEBUG && targetEnvironment(simulator)
        if enabled { return AbileneStoreKitService(deliveryVerifier: LocalTestDeliveryVerifier()) }
        #endif
        return AbileneStoreKitService()
    }
}

#if DEBUG && targetEnvironment(simulator)
/// Synthetic TEST delivery, never business delivery. Key exists only in process memory.
private struct LocalTestDeliveryVerifier: DeliveryConfirmationVerifier {
    private let authority = LocalTestReceiptAuthority()
    private func metadata(_ t: StoreKit.Transaction) -> LocalReceiptTransaction? {
        guard #available(iOS 16.0, *), let account = t.appAccountToken else { return nil }
        return LocalReceiptTransaction(transactionId: String(t.id), originalTransactionId: String(t.originalID),
            productId: t.productID, bundle: t.appBundleID, environment: t.environment.rawValue,
            appAccountToken: account.uuidString.lowercased())
    }
    func confirmation(for transaction: StoreKit.Transaction) async -> [String: String]? {
        guard let t = metadata(transaction),
              let receipt = await authority.issue(t, gate: LocalStoreKitTest.gate()) else { return nil }
        return ["transactionId": t.transactionId, "receipt": receipt]
    }
    func verify(_ confirmation: DeliveryConfirmation, transaction: StoreKit.Transaction) async -> Bool {
        guard await LocalStoreKitTest.verifiedXcode(), let t = metadata(transaction),
              confirmation.transactionId == t.transactionId else { return false }
        return await authority.consume(confirmation.receipt, transaction: t, gate: LocalStoreKitTest.gate())
    }
}
#endif

enum StoreKitBridgeError: String, Error {
    case invalidProductId, invalidAccountToken, productUnavailable, appTransactionUnavailable
    case transactionNotPending, deliveryNotConfirmed, finishInProgress, localTestEnvironmentRequired
}

/// No listing ownership, promotion activation, network backend, or automatic finish.
actor AbileneStoreKitService {
    private var pending: [String: StoreKit.Transaction] = [:]
    private var finishing: Set<String> = []
    private var updates: Task<Void, Never>?
    private let deliveryVerifier: any DeliveryConfirmationVerifier
    #if DEBUG && targetEnvironment(simulator)
    private var acquisition: [String: (source: String, at: Double)] = [:]
    private var firstTracedTransaction: StoreKit.Transaction?
    private var traceTarget: String? {
        ProcessInfo.processInfo.arguments.first { $0.hasPrefix("--abilene-iap-trace-transaction=") }?.split(separator: "=").last.map(String.init)
    }
    #endif

    init(deliveryVerifier: any DeliveryConfirmationVerifier = UnconfiguredDeliveryVerifier()) {
        self.deliveryVerifier = deliveryVerifier
    }

    deinit { updates?.cancel() }

    static func allows(_ id: String) -> Bool {
        id.range(of: #"^com\.abilenevibes\.app\.promotion\.slot(0[1-9]|10)\.(featured|premium)\.monthly$"#,
                 options: .regularExpression) != nil
    }

    func getProducts(_ ids: [String]) async throws -> [[String: Any]] {
        guard await LocalStoreKitTest.verifiedXcode() else { throw StoreKitBridgeError.localTestEnvironmentRequired }
        guard ids.allSatisfy(LocalStoreKitTest.products.contains) else { throw StoreKitBridgeError.invalidProductId }
        guard !ids.isEmpty, ids.count <= 20, ids.allSatisfy(Self.allows) else {
            throw StoreKitBridgeError.invalidProductId
        }
        return try await Product.products(for: Set(ids)).sorted { $0.id < $1.id }.map { product in
            var value: [String: Any] = [
                "id": product.id, "displayName": product.displayName,
                "description": product.description, "displayPrice": product.displayPrice,
                "price": NSDecimalNumber(decimal: product.price).stringValue,
                "currencyCode": product.priceFormatStyle.currencyCode
            ]
            if let subscription = product.subscription {
                value["subscriptionGroupIdentifier"] = subscription.subscriptionGroupID
                value["subscriptionPeriod"] = ["unit": String(describing: subscription.subscriptionPeriod.unit),
                                               "value": subscription.subscriptionPeriod.value]
            }
            return value
        }
    }

    func purchase(productId: String, appAccountToken: String) async -> [String: Any] {
        guard await LocalStoreKitTest.verifiedXcode() else { return Self.failure(.localTestEnvironmentRequired) }
        guard LocalStoreKitTest.products.contains(productId) else { return Self.failure(.invalidProductId) }
        guard Self.allows(productId) else { return Self.failure(.invalidProductId) }
        guard let token = UUID(uuidString: appAccountToken) else { return Self.failure(.invalidAccountToken) }
        do {
            guard let product = try await Product.products(for: [productId]).first else {
                return Self.failure(.productUnavailable)
            }
            switch try await product.purchase(options: [.appAccountToken(token)]) {
            case .success(let result): return await record(result, source: "purchase")
            case .pending: return ["status": "pending"]
            case .userCancelled: return ["status": "userCancelled"]
            @unknown default: return ["status": "error", "errorCode": "unknownPurchaseResult"]
            }
        } catch {
            // Do not log StoreKit errors, JWS, tokens, or delivery receipts.
            return ["status": "error", "errorCode": "storeKitPurchaseFailed"]
        }
    }

    func getVerifiedAppTransaction() async throws -> [String: Any] {
        guard #available(iOS 16.0, *) else { throw StoreKitBridgeError.appTransactionUnavailable }
        let result = try await AppTransaction.shared
        switch result {
        case .unverified:
            return ["status": "unverified", "errorCode": "appVerificationFailed"]
        case .verified(let app):
            var proof: [String: Any] = [
                "verification": "verified", "jwsRepresentation": result.jwsRepresentation,
                "bundleId": app.bundleID, "environment": app.environment.rawValue,
                "signedDate": Self.milliseconds(app.signedDate), "appVersion": app.appVersion
            ]
            if !app.appTransactionID.isEmpty { proof["appTransactionId"] = app.appTransactionID }
            if let id = app.appID { proof["appId"] = String(id) }
            // Device verification/App Attest is deliberately not claimed by this bridge.
            return ["status": "verified", "proof": proof,
                    "localTestEnabled": await LocalStoreKitTest.verifiedXcode()]
        }
    }

    func getCurrentEntitlements() async -> [[String: Any]] {
        var results: [[String: Any]] = []
        for await result in StoreKit.Transaction.currentEntitlements { results.append(await record(result, rememberPending: false, source: "entitlements")) }
        return results
    }

    func getUnfinishedTransactions(source: String = "unfinished") async -> [[String: Any]] {
        var results: [[String: Any]] = []
        for await result in StoreKit.Transaction.unfinished { results.append(await record(result, source: source)) }
        #if DEBUG && targetEnvironment(simulator)
        if let target = traceTarget, await LocalStoreKitTest.verifiedXcode() {
            emitTrace(["stage": "queryReturned", "source": source, "transactionId": target,
                       "timestamp": Self.milliseconds(Date()),
                       "targetPresent": results.contains { ($0["proof"] as? [String: Any])?["transactionId"] as? String == target }])
        }
        #endif
        return results
    }

    func syncPurchases() async throws -> [String: Any] {
        guard await LocalStoreKitTest.verifiedXcode() else { throw StoreKitBridgeError.localTestEnvironmentRequired }
        try await AppStore.sync()
        return ["entitlements": await getCurrentEntitlements(), "unfinished": await getUnfinishedTransactions(source: "sync")]
    }

    func startTransactionUpdates(_ emit: @escaping @Sendable ([String: Any]) async -> Void) -> Bool {
        guard updates == nil else { return false }
        // Weak across suspension: the Task must not keep its owning service alive.
        updates = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard !Task.isCancelled else { break }
                guard let event = await self?.record(result, source: "update") else { break }
                guard !Task.isCancelled else { break }
                await emit(event)
            }
        }
        return true
    }

    func stopTransactionUpdates() {
        updates?.cancel()
        updates = nil
    }

    func finishTransaction(transactionId: String, confirmation: DeliveryConfirmation) async throws {
        guard let transaction = pending[transactionId] else { throw StoreKitBridgeError.transactionNotPending }
        #if DEBUG && targetEnvironment(simulator)
        let selectedAcquisition = acquisition[transactionId]
        #endif
        guard finishing.insert(transactionId).inserted else { throw StoreKitBridgeError.finishInProgress }
        defer { finishing.remove(transactionId) }
        guard confirmation.transactionId == transactionId, !confirmation.receipt.isEmpty,
              await deliveryVerifier.verify(confirmation, transaction: transaction) else {
            throw StoreKitBridgeError.deliveryNotConfirmed
        }
        // The only finish call in shipping code. Never called by reconciliation or purchase.
        #if DEBUG && targetEnvironment(simulator)
        trace("finishCall", transaction: transaction, source: selectedAcquisition?.source ?? "unknown", acquiredAt: selectedAcquisition?.at)
        #endif
        await transaction.finish()
        #if DEBUG && targetEnvironment(simulator)
        trace("finishReturned", transaction: transaction, source: selectedAcquisition?.source ?? "unknown", acquiredAt: selectedAcquisition?.at)
        #endif
        pending.removeValue(forKey: transactionId)
    }

    private func record(_ result: VerificationResult<StoreKit.Transaction>, rememberPending: Bool = true, source: String) async -> [String: Any] {
        switch result {
        case .unverified(let transaction, _):
            return ["status": "unverified", "transactionId": String(transaction.id),
                    "errorCode": "transactionVerificationFailed"]
        case .verified(let transaction):
            if rememberPending { pending[String(transaction.id)] = transaction }
            #if DEBUG && targetEnvironment(simulator)
            let acquiredAt = Self.milliseconds(Date())
            if rememberPending { acquisition[String(transaction.id)] = (source, acquiredAt) }
            trace("acquired", transaction: transaction, source: source, acquiredAt: acquiredAt)
            #endif
            var proof: [String: Any] = [
                "verification": "verified", "transactionId": String(transaction.id),
                "originalTransactionId": String(transaction.originalID), "productId": transaction.productID,
                "jwsRepresentation": result.jwsRepresentation, "bundleId": transaction.appBundleID,
                "purchaseDate": Self.milliseconds(transaction.purchaseDate),
                "signedDate": Self.milliseconds(transaction.signedDate),
                "ownershipType": transaction.ownershipType.rawValue, "isUpgraded": transaction.isUpgraded
            ]
            if #available(iOS 16.0, *) { proof["environment"] = transaction.environment.rawValue }
            // On iOS 15 environment is intentionally omitted; future server derives it from verified JWS.
            if !transaction.appTransactionID.isEmpty { proof["appTransactionId"] = transaction.appTransactionID }
            if let token = transaction.appAccountToken { proof["appAccountToken"] = token.uuidString.lowercased() }
            if let group = transaction.subscriptionGroupID { proof["subscriptionGroupIdentifier"] = group }
            if let date = transaction.expirationDate { proof["expiresDate"] = Self.milliseconds(date) }
            if let date = transaction.revocationDate { proof["revocationDate"] = Self.milliseconds(date) }
            if let reason = transaction.revocationReason { proof["revocationReason"] = reason.rawValue }
            var event: [String: Any] = ["status": "verified", "proof": proof]
            #if DEBUG && targetEnvironment(simulator)
            if let verifier = deliveryVerifier as? LocalTestDeliveryVerifier,
               let confirmation = await verifier.confirmation(for: transaction) {
                event["localDeliveryConfirmation"] = confirmation
            }
            #endif
            return event
        }
    }

    #if DEBUG && targetEnvironment(simulator)
    private func emitTrace(_ value: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
              let text = String(data: data, encoding: .utf8) else { return }
        print("ABILENE_FINISH_TRACE " + text)
    }
    /// Whitelisted metadata only. No JWS, receipt, key or full account token.
    private func trace(_ stage: String, transaction t: StoreKit.Transaction, source: String, acquiredAt: Double?) {
        guard LocalStoreKitTest.enabled, LocalStoreKitTest.webBuildEnabled,
              traceTarget == String(t.id), #available(iOS 16.0, *), t.environment == .xcode,
              t.appBundleID == "com.abilenevibes.app" else { return }
        if firstTracedTransaction == nil { firstTracedTransaction = t }
        guard let first = firstTracedTransaction else { return }
        var value: [String: Any] = ["stage": stage, "source": source, "timestamp": Self.milliseconds(Date()),
            "transactionId": String(t.id), "originalTransactionId": String(t.originalID),
            "productId": t.productID, "environment": t.environment.rawValue, "verification": "verified",
            "purchaseDate": Self.milliseconds(t.purchaseDate),
            "appAccountTokenPresent": t.appAccountToken != nil,
            "accountTokenMatchesFirst": t.appAccountToken == first.appAccountToken,
            "sameEventAsFirst": t.id == first.id && t.originalID == first.originalID && t.productID == first.productID &&
                t.purchaseDate == first.purchaseDate && t.expirationDate == first.expirationDate &&
                t.environment == first.environment && t.appAccountToken == first.appAccountToken]
        if let acquiredAt { value["objectAcquiredAt"] = acquiredAt }
        if let date = t.expirationDate { value["expirationDate"] = Self.milliseconds(date) }
        emitTrace(value)
    }
    #endif

    private static func milliseconds(_ date: Date) -> Double { date.timeIntervalSince1970 * 1000 }
    private static func failure(_ error: StoreKitBridgeError) -> [String: Any] {
        ["status": "error", "errorCode": error.rawValue]
    }
}
