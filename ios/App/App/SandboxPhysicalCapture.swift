#if DEBUG && os(iOS) && !targetEnvironment(simulator)
import Foundation
import StoreKit
import UIKit

/// Local first-purchase policy; does not change the general catalog.
private enum FirstFeaturedSandboxPurchase {
    static let productID = "com.abilenevibes.app.promotion.slot01.featured.monthly"
    static func allows(_ id: String) -> Bool { id == productID }
    static func privateMetadata(expirationDate: Date?, ownershipType: String, revocationDate: Date?) -> [String: Any] {
        func dateValue(_ date: Date?) -> Any {
            guard let date else { return NSNull() }
            return date.timeIntervalSince1970 * 1000
        }
        return ["expirationDate": dateValue(expirationDate), "ownershipType": ownershipType,
                "revocationDate": dateValue(revocationDate)]
    }
}

private enum FirstFeaturedPurchaseError: String, Error {
    case notFeatured = "PURCHASE_BLOCKED_NOT_FEATURED"
}

/// Debug UI only. Never dump error descriptions/userInfo that may contain account data.
@available(iOS 16.0, *)
private enum SandboxStoreKitDiagnostic {
    static func summary(_ error: Error) -> String {
        let domains: Set<String> = ["StoreKit.StoreKitError", "SKErrorDomain", "ASDErrorDomain",
            "AMSErrorDomain", "NSURLErrorDomain", "NSCocoaErrorDomain", "NSPOSIXErrorDomain", "NSOSStatusErrorDomain"]
        let descriptions: Set<String> = ["No active account", "No accounts available", "Account not found",
            "Not signed in", "An unknown error occurred.", "The operation couldn’t be completed."]
        var kind = "NSError", storeKitCase = "not StoreKitError"
        var underlying: Error?
        if let value = error as? StoreKitError {
            kind = "StoreKitError"
            switch value {
            case .unknown: storeKitCase = "unknown"
            case .userCancelled: storeKitCase = "userCancelled"
            case .networkError(let nested): storeKitCase = "networkError"; underlying = nested
            case .systemError(let nested): storeKitCase = "systemError"; underlying = nested
            case .notAvailableInStorefront: storeKitCase = "notAvailableInStorefront"
            case .notEntitled: storeKitCase = "notEntitled"
            default: storeKitCase = "other"
            }
        }
        var lines = ["type=\(kind); case=\(storeKitCase)"]
        var current: NSError? = error as NSError
        for depth in 0..<4 {
            guard let value = current else { break }
            let domain = domains.contains(value.domain) ? value.domain : "REDACTED_DOMAIN"
            let raw = value.userInfo[NSLocalizedDescriptionKey] as? String ?? ""
            let description = descriptions.contains(raw) ? raw : "WITHHELD"
            lines.append("\(depth == 0 ? "error" : "underlying") domain=\(domain); code=\(value.code); description=\(description)")
            current = depth == 0 && underlying != nil ? underlying! as NSError : value.userInfo[NSUnderlyingErrorKey] as? NSError
        }
        return lines.joined(separator: "\n")
    }
}

/// Entire capture implementation is absent from Release and simulator builds.
enum SandboxPhysicalRuntime {
    static var requested: Bool {
        ProcessInfo.processInfo.arguments.contains("--abilene-sandbox-capture")
    }
    static var gate: SandboxCaptureGate {
        SandboxCaptureGate(debugDevice: true, launchArgument: requested,
            captureConsent: ProcessInfo.processInfo.environment["ABILENE_SANDBOX_CAPTURE"] == "CAPTURE_ONLY_SANDBOX",
            localLabPresent: ProcessInfo.processInfo.arguments.contains("--abilene-iap-local-test") ||
                Bundle.main.url(forResource: "apple-iap-local-test", withExtension: "json", subdirectory: "public") != nil,
            bundle: Bundle.main.bundleIdentifier ?? "", appVerified: false, environment: "")
    }
}

/// No backend, delivery, bridge JS, automatic purchase, or finish operation.
@available(iOS 16.0, *)
@MainActor final class SandboxPhysicalCaptureSession {
    private var products: [String: Product] = [:]
    private let correlationToken = UUID() // Capture correlation only; never buyer/ownership authority.
    private var updates: Task<Void, Never>?
    private var directory: URL?
    private var purchaseAttempt = SandboxCaptureAttempt()
    var purchaseAttempted: Bool { purchaseAttempt.reserved }
    private(set) var diagnosticStage = "not started"
    private(set) var catalogDiagnostic = ""

    private func recordCatalog(_ line: String) {
        catalogDiagnostic += line + "\n"
        print("[StoreKitCatalog] " + line)
    }

    func stop() { updates?.cancel(); updates = nil }

    private func write(_ bytes: Data) throws {
        do {
            if directory == nil {
                var url = FileManager.default.temporaryDirectory.appendingPathComponent("abilene-sandbox-" + UUID().uuidString, isDirectory: true)
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false,
                    attributes: [.posixPermissions: 0o700, .protectionKey: FileProtectionType.complete])
                var values = URLResourceValues(); values.isExcludedFromBackup = true
                try url.setResourceValues(values)
                directory = url
            }
            let file = directory!.appendingPathComponent(UUID().uuidString + ".json")
            try bytes.write(to: file, options: [.atomic, .completeFileProtection])
            try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        } catch { throw SandboxCaptureError.captureFailed }
    }

    /// Writes the signed app evidence before a purchase can become available.
    private func verifyApp(reportCatalog: Bool = false) async throws -> SandboxCaptureGate {
        var gate = SandboxPhysicalRuntime.gate
        guard gate.configured else { throw SandboxCaptureError.gateClosed }
        diagnosticStage = "AppTransaction.shared"
        let result: VerificationResult<AppTransaction>
        do { result = try await AppTransaction.shared }
        catch {
            if reportCatalog { recordCatalog("APPTRANSACTION_VERIFIED = NO") }
            throw error
        }
        try Task.checkCancellation()
        guard case .verified(let app) = result else {
            if reportCatalog { recordCatalog("APPTRANSACTION_VERIFIED = NO") }
            throw SandboxCaptureError.appNotVerifiedSandbox
        }
        if reportCatalog {
            recordCatalog("APPTRANSACTION_VERIFIED = YES")
            recordCatalog("BUNDLE = \(app.bundleID)")
            recordCatalog("ENVIRONMENT = \(app.environment.rawValue)")
        }
        gate.appVerified = app.bundleID == SandboxCaptureGate.bundleID
        gate.environment = app.environment.rawValue
        guard gate.allowed else { throw SandboxCaptureError.appNotVerifiedSandbox }
        let metadata: [String: Any] = [
            "kind": "AppTransaction", "bundleId": app.bundleID, "environment": app.environment.rawValue,
            "appVersion": app.appVersion, "originalAppVersion": app.originalAppVersion,
            "signedDate": app.signedDate.timeIntervalSince1970 * 1000,
            "appTransactionId": app.appTransactionID,
            "osVersion": UIDevice.current.systemVersion,
            "build": Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "",
            "configuration": "Debug physical capture"
        ]
        try write(SandboxCaptureEnvelope.encode(jws: result.jwsRepresentation, metadata: metadata))
        return gate
    }

    func prepare() async throws -> [Product] {
        catalogDiagnostic = ""
        products.removeAll()
        _ = try await verifyApp(reportCatalog: true)
        let storefront = await Storefront.current
        recordCatalog("STOREFRONT_AVAILABLE = \(storefront == nil ? "NO" : "YES")")
        if let storefront {
            recordCatalog("COUNTRY_CODE = \(storefront.countryCode)")
            recordCatalog("STOREFRONT_ID = \(storefront.id)")
        }
        diagnosticStage = "Product.products"
        recordCatalog("REQUESTED_COUNT = \(SandboxCaptureGate.products.count)")
        let found: [Product]
        do { found = try await Product.products(for: SandboxCaptureGate.products) }
        catch {
            recordCatalog("PRODUCT_API_ERROR = YES")
            recordCatalog(SandboxStoreKitDiagnostic.summary(error))
            throw error
        }
        recordCatalog("RAW_RETURNED_COUNT = \(found.count)")
        recordCatalog("RAW_RETURNED_IDS = \(found.map { $0.id }.sorted())")
        recordCatalog("PRODUCT_API_ERROR = NO")
        for product in found.sorted(by: { $0.id < $1.id }) {
            let period = product.subscription?.subscriptionPeriod
            recordCatalog("PRODUCT id=\(product.id); type=\(product.type); periodUnit=\(period.map { String(describing: $0.unit) } ?? "NONE"); periodValue=\(period.map { String($0.value) } ?? "NONE"); group=\(product.subscription?.subscriptionGroupID ?? "NONE"); displayPrice=\(product.displayPrice)")
        }
        guard !found.isEmpty, found.allSatisfy({ SandboxCaptureGate.products.contains($0.id) &&
            $0.type == .autoRenewable && $0.subscription?.subscriptionPeriod.unit == .month &&
            $0.subscription?.subscriptionPeriod.value == 1 }),
            Set(found.compactMap { $0.subscription?.subscriptionGroupID }).count == 1 else {
            let failure: String
            if found.isEmpty { failure = "EMPTY_RAW_RESPONSE" }
            else if found.contains(where: { !SandboxCaptureGate.products.contains($0.id) }) { failure = "UNEXPECTED_ID" }
            else if found.contains(where: { $0.type != .autoRenewable }) { failure = "NOT_AUTO_RENEWABLE" }
            else if found.contains(where: { $0.subscription?.subscriptionPeriod.unit != .month || $0.subscription?.subscriptionPeriod.value != 1 }) { failure = "NOT_MONTHLY" }
            else if Set(found.compactMap { $0.subscription?.subscriptionGroupID }).count != 1 { failure = "SUBSCRIPTION_GROUP_MISMATCH" }
            else { failure = "OTHER_VALIDATION_FAILURE" }
            recordCatalog("POST_GUARD = FAIL")
            recordCatalog("FAILURE_CLASSIFICATION = " + failure)
            throw SandboxCaptureError.productUnavailable
        }
        recordCatalog("POST_GUARD = PASS")
        products = Dictionary(uniqueKeysWithValues: found.map { ($0.id, $0) })
        return found.sorted { $0.id < $1.id }
    }

    func buy(_ id: String, confirmedByUser: Bool) async throws -> String {
        guard FirstFeaturedSandboxPurchase.allows(id) else {
            recordCatalog(FirstFeaturedPurchaseError.notFeatured.rawValue)
            throw FirstFeaturedPurchaseError.notFeatured
        }
        guard confirmedByUser else { throw SandboxCaptureError.userConfirmationRequired }
        guard !purchaseAttempted, SandboxCaptureGate.products.contains(id), let product = products[id] else {
            throw SandboxCaptureError.purchaseUnavailable
        }
        // MainActor can reenter while verifyApp awaits. Reserve before that suspension.
        guard purchaseAttempt.reserve() else { throw SandboxCaptureError.purchaseUnavailable }
        let gate = try await verifyApp() // Revalidate immediately before StoreKit purchase.
        guard gate.allowed, AppStore.canMakePayments else { throw SandboxCaptureError.gateClosed }
        diagnosticStage = "Product.purchase"
        let purchaseResult: Product.PurchaseResult
        do { purchaseResult = try await product.purchase(options: [.appAccountToken(correlationToken)]) }
        catch {
            recordCatalog("PURCHASE_RESULT = ERROR")
            recordCatalog(SandboxStoreKitDiagnostic.summary(error))
            throw error
        }
        switch purchaseResult {
        case .success(let result):
            recordCatalog("PURCHASE_RESULT = SUCCESS")
            switch result {
            case .verified: recordCatalog("PURCHASE_SUCCESS_VERIFICATION = VERIFIED")
            case .unverified: recordCatalog("PURCHASE_SUCCESS_VERIFICATION = UNVERIFIED")
            }
            try capture(result, gate: gate, source: "purchase", expectedProduct: FirstFeaturedSandboxPurchase.productID)
            return "Sandbox evidence saved. Transaction remains unfinished."
        case .pending:
            recordCatalog("PURCHASE_RESULT = PENDING")
            return "Pending. Do not buy again. Recover with Unfinished / Updates."
        case .userCancelled:
            recordCatalog("PURCHASE_RESULT = USER_CANCELLED")
            return "Cancelled. No automatic retry."
        @unknown default:
            recordCatalog("PURCHASE_RESULT = UNKNOWN")
            throw SandboxCaptureError.transactionRejected
        }
    }

    private func capture(_ result: VerificationResult<StoreKit.Transaction>, gate: SandboxCaptureGate,
                         source: String, expectedProduct: String? = nil) throws {
        guard case .verified(let t) = result,
              gate.accepts(verified: true, environment: t.environment.rawValue, bundle: t.appBundleID, product: t.productID),
              expectedProduct == nil || (expectedProduct == t.productID && t.appAccountToken == correlationToken) else {
            throw SandboxCaptureError.transactionRejected
        }
        var metadata: [String: Any] = [
            "kind": "Transaction", "source": source, "productID": t.productID,
            "transactionID": String(t.id), "originalID": String(t.originalID),
            "purchaseDate": t.purchaseDate.timeIntervalSince1970 * 1000,
            "signedDate": t.signedDate.timeIntervalSince1970 * 1000,
            "environment": t.environment.rawValue, "bundleId": t.appBundleID,
            "deliveryGranted": false, "finishCalled": false
        ]
        if let token = t.appAccountToken { metadata["appAccountToken"] = token.uuidString.lowercased() }
        if let group = t.subscriptionGroupID { metadata["subscriptionGroupID"] = group }
        metadata.merge(FirstFeaturedSandboxPurchase.privateMetadata(expirationDate: t.expirationDate,
            ownershipType: t.ownershipType.rawValue, revocationDate: t.revocationDate)) { _, value in value }
        try write(SandboxCaptureEnvelope.encode(jws: result.jwsRepresentation, metadata: metadata))
    }

    func recover(sync: Bool) async throws -> String {
        let gate = try await verifyApp()
        if sync { try await AppStore.sync() } // Only a separate user action can request a login.
        var count = 0
        for await result in StoreKit.Transaction.currentEntitlements {
            try capture(result, gate: gate, source: "currentEntitlements"); count += 1
        }
        for await result in StoreKit.Transaction.unfinished {
            try capture(result, gate: gate, source: "unfinished"); count += 1
        }
        return "Saved \(count) evidence observations; no delivery or finish."
    }

    func startUpdates(_ report: @escaping (String) -> Void) async throws {
        _ = try await verifyApp()
        guard updates == nil else { return }
        updates = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                guard !Task.isCancelled, let self else { break }
                do {
                    let gate = try await self.verifyApp()
                    guard !Task.isCancelled else { break }
                    try self.capture(result, gate: gate, source: "Transaction.updates")
                    report("Sandbox update captured; transaction unfinished.")
                } catch {
                    guard !Task.isCancelled else { break }
                    report("Update rejected or capture failed. No finish. Export existing evidence before retrying.")
                }
            }
        }
    }

    var exportLocation: String { directory.map { "tmp/" + $0.lastPathComponent } ?? "No evidence saved" }
}

@available(iOS 16.0, *)
@MainActor final class SandboxPhysicalCaptureViewController: UIViewController {
    private let session = SandboxPhysicalCaptureSession()
    private let stack = UIStackView()
    private let status = UILabel()
    private var busy = false
    private var productButtons: [UIView] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let scroll = UIScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        stack.axis = .vertical; stack.spacing = 16; stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -16),
            stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor)
        ])
        let title = UILabel(); title.text = "Apple Sandbox — Evidence Capture"; title.font = .preferredFont(forTextStyle: .title1); title.numberOfLines = 0
        stack.addArrangedSubview(title)
        let explanation = UILabel(); explanation.numberOfLines = 0
        explanation.text = "Authorized physical Debug test only. No public promotions or delivery. Transactions remain unfinished. Only you may sign in or confirm Apple's Sandbox purchase sheet. Stop if it is not a Sandbox test."
        stack.addArrangedSubview(explanation)
        status.numberOfLines = 0; status.text = "Not started. AppTransaction must verify as Sandbox."
        stack.addArrangedSubview(status)
        addButton("Verify Sandbox / Load Products") { [weak self] in
            self?.confirm("This may request Apple authentication. Handle it manually; no credentials are collected by this tool.") {
                self?.run {
                    guard let self else { return }
                    self.productButtons.forEach { $0.removeFromSuperview() }; self.productButtons.removeAll()
                    let products = try await self.session.prepare()
                    for product in products {
                        guard FirstFeaturedSandboxPurchase.allows(product.id) else {
                            let evidence = UILabel()
                            evidence.numberOfLines = 0
                            evidence.text = "Catalog only: \(product.displayName) — \(product.displayPrice). Not authorized for the first purchase."
                            self.stack.addArrangedSubview(evidence)
                            self.productButtons.append(evidence)
                            continue
                        }
                        let button = self.addButton("Sandbox: \(product.displayName) — \(product.displayPrice) / month") { [weak self] in
                            self?.confirm("Sandbox test purchase of \(product.displayName), \(product.displayPrice) per month. No public promotion will be delivered. Confirm Apple's test sheet manually; cancel if Sandbox is not shown.") {
                                self?.run {
                                    guard let self else { return }
                                    self.status.text = try await self.session.buy(product.id, confirmedByUser: true)
                                }
                            }
                        }
                        self.productButtons.append(button)
                    }
                    self.status.text = self.session.catalogDiagnostic + "Verified Sandbox. Loaded \(products.count) product(s). One purchase attempt per launch."
                }
            }
        }
        addButton("Capture Entitlements / Unfinished") { [weak self] in self?.run {
            guard let self else { return }; self.status.text = try await self.session.recover(sync: false)
        } }
        addButton("Restore / AppStore.sync — manual") { [weak self] in
            self?.confirm("Restore can request a Sandbox login. Complete it manually only for this authorized test.") {
                self?.run { guard let self else { return }; self.status.text = try await self.session.recover(sync: true) }
            }
        }
        addButton("Start Transaction Updates") { [weak self] in self?.run {
            guard let self else { return }
            try await self.session.startUpdates { [weak self] message in self?.status.text = message }
            self.status.text = "Listening. No automatic purchase, delivery or finish."
        } }
        addButton("Stop Updates / Show Capture Location") { [weak self] in
            guard let self, !self.busy else { return }; self.session.stop()
            self.status.text = "Listener stopped. Export promptly to a private temporary folder outside the repo:\n" + self.session.exportLocation
        }
        if !SandboxPhysicalRuntime.gate.configured {
            status.text = "BLOCKED: explicit Debug device configuration required; Xcode lab marker/argument forbidden."
            stack.arrangedSubviews.compactMap { $0 as? UIButton }.forEach { $0.isEnabled = false }
        }
    }

    @discardableResult private func addButton(_ title: String, action: @escaping () -> Void) -> UIButton {
        let button = UIButton(type: .system); button.setTitle(title, for: .normal)
        button.titleLabel?.numberOfLines = 0
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        stack.addArrangedSubview(button); return button
    }
    private func confirm(_ message: String, action: @escaping () -> Void) {
        guard !busy, presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Sandbox — manual action", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Continue Sandbox Test", style: .default) { _ in action() })
        present(alert, animated: true)
    }
    private func run(_ operation: @escaping () async throws -> Void) {
        guard !busy else { return }; busy = true
        stack.arrangedSubviews.compactMap { $0 as? UIButton }.forEach { $0.isEnabled = false }
        Task {
            defer {
                busy = false
                stack.arrangedSubviews.compactMap { $0 as? UIButton }.forEach { $0.isEnabled = true }
                if session.purchaseAttempted { productButtons.compactMap { $0 as? UIButton }.forEach { $0.isEnabled = false } }
            }
            do { try await operation() }
            catch let error as FirstFeaturedPurchaseError { status.text = session.catalogDiagnostic + error.rawValue }
            catch let error as SandboxCaptureError { status.text = session.catalogDiagnostic + "BLOCKED: " + error.rawValue + ". No automatic retry or finish." }
            catch { status.text = session.catalogDiagnostic + "StoreKit failed at \(session.diagnosticStage). No retry or finish.\n" + SandboxStoreKitDiagnostic.summary(error) }
        }
    }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); session.stop() }
}
#endif
