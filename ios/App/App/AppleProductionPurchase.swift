import Foundation
import StoreKit
import CryptoKit
import Security

@available(iOS 16.0, *)
@MainActor final class AppleProductionPurchase {
    static let endpoint = URL(string: "https://ymgiwjuhgvfexitynmtb.supabase.co/functions/v1/apple-iap")!
    static let products: Set<String> = ["com.abilenevibes.app.promotion.slot01.featured.monthly", "com.abilenevibes.app.promotion.slot01.premium.monthly"]
    private let jwt: String
    private let listingType: String
    private let listingID: String
    private let key: P256.Signing.PrivateKey
    private var session: [String: Any] = [:]
    private var appJWS = ""
    private var sessionCreated = Date.distantPast
    private var busy = false
    private let pendingName: String
    var message: (String) -> Void = { _ in }
    var onDelivery: () -> Void = {}
    init(jwt: String, listingType: String, listingID: String) throws {
        self.jwt = jwt; self.listingType = listingType; self.listingID = listingID
        let pieces = jwt.components(separatedBy: ".")
        guard pieces.count == 3 else { throw Failure.rejected }
        let value = pieces[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        guard let bytes = Data(base64Encoded: value + String(repeating: "=", count: (4-value.count%4)%4)),
              let claims = try JSONSerialization.jsonObject(with: bytes) as? [String: Any], let subject = claims["sub"] as? String,
              UUID(uuidString: subject) != nil else { throw Failure.rejected }
        // Local storage namespace only. The server independently validates the JWT.
        self.key = try ApplePurchaseStorage.installationKey(subject: subject)
        self.pendingName = "purchase-" + subject + "-" + listingType + "-" + listingID
    }
    private static func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    private func text(_ object: Any) throws -> String {
        guard let value = String(data: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes]), encoding: .utf8) else { throw Failure.rejected }; return value
    }
    private var keyID: String { Self.hash(key.publicKey.derRepresentation) }
    private func signature(_ parts: [String]) throws -> String { try key.signature(for: Data(text(parts).utf8)).rawRepresentation.base64EncodedString() }
    private func api(_ action: String, _ input: [String: Any], signed: Bool = false) async throws -> [String: Any] {
        var body = input
        if signed {
            let payload = try text(input), nonce = UUID().uuidString.lowercased(), issued = Int64(Date().timeIntervalSince1970 * 1000)
            body = ["payload_text": payload, "nonce": nonce, "issued_at": issued, "key_id": keyID,
                    "signature": try signature(["apple-request-v1", action, nonce, String(issued), Self.hash(Data(payload.utf8))])]
        }
        var request = URLRequest(url: Self.endpoint); request.httpMethod = "POST"; request.timeoutInterval = 30
        request.setValue("Bearer " + jwt, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["action": action, "input": body])
        let (data, response) = try await URLSession(configuration: .ephemeral, delegate: AppleNoRedirect(), delegateQueue: nil).data(for: request)
        guard data.count <= 65536, let r = response as? HTTPURLResponse, r.statusCode == 200, r.url == Self.endpoint,
              let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw Failure.rejected }
        return value
    }
    func bootstrap() async throws {
        let result = try await AppTransaction.shared
        guard case .verified(let app) = result, app.bundleID == "com.abilenevibes.app", app.environment == .production else { throw Failure.rejected }
        appJWS = result.jwsRepresentation
        let challenge = try await api("challenge", ["public_spki": key.publicKey.derRepresentation.base64EncodedString()])
        guard let id = challenge["challenge_id"] as? String, let nonce = challenge["nonce"] as? String else { throw Failure.rejected }
        session = try await api("bootstrap", ["challenge_id": id, "app_transaction_jws": appJWS, "listing_type": listingType, "listing_id": listingID,
            "signature": try signature(["apple-bootstrap-v1", id, nonce, listingType, listingID, Self.hash(Data(appJWS.utf8))])])
        guard session["environment"] as? String == "Production", session["installation_key_id"] as? String == keyID,
              session["listing_id"] as? String == listingID, session["listing_type"] as? String == listingType else { throw Failure.rejected }
        sessionCreated = Date()
    }
    private func ensureSession() async throws { if session.isEmpty || Date().timeIntervalSince(sessionCreated) > 600 { try await bootstrap() } }
    func catalog() async throws -> [Product] {
        try await ensureSession()
        return try await Product.products(for: Self.products).filter { Self.products.contains($0.id) && $0.type == .autoRenewable && $0.subscription?.subscriptionGroupID == "22382531" && $0.subscription?.subscriptionPeriod.unit == .month && $0.subscription?.subscriptionPeriod.value == 1 }
    }
    func purchase(_ product: Product) async {
        guard !busy, Self.products.contains(product.id) else { return }; busy = true; defer { busy = false }
        do {
            if try ApplePurchaseStorage.read(pendingName) != nil { try await recover(); return }
            try await ensureSession()
            guard let capability = session["capability"] as? String, let tokenText = session["app_account_token"] as? String, let token = UUID(uuidString: tokenText) else { throw Failure.rejected }
            let idem = UUID().uuidString.lowercased(), plan = product.id.hasSuffix(".premium.monthly") ? "premium" : "featured"
            let intent = try await api("prepare", ["capability": capability, "listing_type": listingType, "listing_id": listingID, "requested_plan": plan, "idempotency_key": idem], signed: true)
            guard let intentID = intent["purchase_intent_id"] as? String, intent["product_id"] as? String == product.id,
                  (intent["app_account_token"] as? String)?.lowercased() == tokenText.lowercased() else { throw Failure.rejected }
            var pending: [String: Any] = ["intent": intentID, "idempotency": idem, "product": product.id, "buyer": session["buyer_id"] as? String ?? "", "token": tokenText.lowercased(), "installation": session["installation_id"] as? String ?? "", "app_jws": appJWS]
            try ApplePurchaseStorage.save(pendingName, data: JSONSerialization.data(withJSONObject: pending))
            _ = try await api("start", ["capability": capability, "purchase_intent_id": intentID], signed: true)
            message("Processing…")
            switch try await product.purchase(options: [.appAccountToken(token)]) {
            case .success(let result):
                guard case .verified(let transaction) = result else { throw Failure.rejected }
                try guards(transaction, pending)
                pending["transaction_jws"] = result.jwsRepresentation; pending["transaction_id"] = String(transaction.id); pending["original_id"] = String(transaction.originalID)
                try ApplePurchaseStorage.save(pendingName, data: JSONSerialization.data(withJSONObject: pending))
                try await deliver(transaction, pending)
            case .pending: message("Your purchase is awaiting approval.")
            case .userCancelled:
                pending["user_cancelled"] = true
                try ApplePurchaseStorage.save(pendingName, data: JSONSerialization.data(withJSONObject: pending))
                try await closeCancelled(pending)
                message("Purchase cancelled. You have not been charged.")
            @unknown default: throw Failure.rejected
            }
        } catch { message("We could not confirm your promotion. Use Recover purchase before trying again.") }
    }
    private func guards(_ t: StoreKit.Transaction, _ pending: [String: Any]) throws {
        guard t.environment == .production, t.appBundleID == "com.abilenevibes.app", t.productID == pending["product"] as? String,
              t.subscriptionGroupID == "22382531", t.appAccountToken?.uuidString.lowercased() == pending["token"] as? String,
              t.ownershipType == .purchased, t.revocationDate == nil, !t.isUpgraded else { throw Failure.rejected }
    }
    private func deliver(_ transaction: StoreKit.Transaction, _ pending: [String: Any]) async throws {
        try guards(transaction, pending)
        try await ensureSession()
        guard let capability = session["capability"] as? String, let intent = pending["intent"] as? String,
              let evidence = pending["transaction_jws"] as? String, let app = pending["app_jws"] as? String, let idem = pending["idempotency"] as? String,
              pending["buyer"] as? String == session["buyer_id"] as? String, pending["installation"] as? String == session["installation_id"] as? String else { throw Failure.rejected }
        let response = try await api("recover", ["capability": capability, "purchase_intent_id": intent, "transaction_jws": evidence, "app_transaction_jws": app, "idempotency_key": idem], signed: true)
        guard let delivery = response["delivery_id"] as? String, let confirmation = response["confirmation"] as? [String: Any], let kind = confirmation["kind"] as? String, let jws = confirmation["signed_jws"] as? String else { throw Failure.rejected }
        let expected = ["transactionId": String(transaction.id), "originalTransactionId": String(transaction.originalID), "productId": transaction.productID,
            "buyer_id": session["buyer_id"] as? String ?? "", "installation_id": session["installation_id"] as? String ?? "", "installation_key_id": keyID,
            "listing_type": listingType, "listing_id": listingID, "environment": "Production", "appAccountToken": pending["token"] as? String ?? "", "purchase_intent_id": intent, "delivery_id": delivery]
        guard try AppleACKTrust.verifier().permitsFinish(kind: kind, jws: jws, expected: expected) else { throw Failure.rejected }
        await transaction.finish()
        try ApplePurchaseStorage.remove(pendingName)
        onDelivery()
        message("Purchase confirmed. Your promotion status is up to date.")
    }
    private func closeCancelled(_ pending: [String: Any]) async throws {
        guard pending["user_cancelled"] as? Bool == true, let intent = pending["intent"] as? String,
              let capability = session["capability"] as? String else { throw Failure.rejected }
        let reply = try await api("cancel", ["capability": capability, "purchase_intent_id": intent], signed: true)
        guard reply["status"] as? String == "cancelled" else { throw Failure.rejected }
        try ApplePurchaseStorage.remove(pendingName)
    }
    func recover() async throws {
        guard let data = try ApplePurchaseStorage.read(pendingName), var pending = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        try await ensureSession()
        if pending["user_cancelled"] as? Bool == true { try await closeCancelled(pending); message("Purchase cancelled."); return }
        // Recovery only: never invokes Product.purchase. Signed local guards reject unrelated transactions.
        for await result in Transaction.unfinished {
            guard case .verified(let t) = result, t.productID == pending["product"] as? String,
                  t.appAccountToken?.uuidString.lowercased() == pending["token"] as? String else { continue }
            if let id = pending["transaction_id"] as? String, id != String(t.id) { continue }
            try guards(t, pending); pending["transaction_jws"] = result.jwsRepresentation; pending["transaction_id"] = String(t.id); pending["original_id"] = String(t.originalID)
            try ApplePurchaseStorage.save(pendingName, data: JSONSerialization.data(withJSONObject: pending))
            try await deliver(t, pending); return
        }
        // A crash after finish but before clearing Keychain must not block the account.
        // Only a freshly verified durable backend ACK can clear this record without finish.
        if let tid = pending["transaction_id"] as? String, let oid = pending["original_id"] as? String,
           let capability = session["capability"] as? String, let intent = pending["intent"] as? String,
           let evidence = pending["transaction_jws"] as? String, let app = pending["app_jws"] as? String,
           let idem = pending["idempotency"] as? String,
           pending["buyer"] as? String == session["buyer_id"] as? String,
           pending["installation"] as? String == session["installation_id"] as? String {
            let response = try await api("recover", ["capability": capability, "purchase_intent_id": intent, "transaction_jws": evidence, "app_transaction_jws": app, "idempotency_key": idem], signed: true)
            guard let delivery = response["delivery_id"] as? String, let confirmation = response["confirmation"] as? [String: Any],
                  let kind = confirmation["kind"] as? String, let jws = confirmation["signed_jws"] as? String else { throw Failure.rejected }
            let expected = ["transactionId": tid, "originalTransactionId": oid, "productId": pending["product"] as? String ?? "",
                "buyer_id": session["buyer_id"] as? String ?? "", "installation_id": session["installation_id"] as? String ?? "", "installation_key_id": keyID,
                "listing_type": listingType, "listing_id": listingID, "environment": "Production", "appAccountToken": pending["token"] as? String ?? "", "purchase_intent_id": intent, "delivery_id": delivery]
            guard try AppleACKTrust.verifier().permitsFinish(kind: kind, jws: jws, expected: expected) else { throw Failure.rejected }
            try ApplePurchaseStorage.remove(pendingName); onDelivery(); message("Your promotion status is up to date."); return
        }
        message("Your purchase has not been confirmed. No new purchase was made. Try recovery later or contact support.")
    }
    enum Failure: Error { case rejected }
}

private enum ApplePurchaseStorage {
    static let service = "com.abilenevibes.app.apple-purchases"
    static func query(_ name: String) -> [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: name] }
    static func read(_ name: String) throws -> Data? { var q = query(name); q[kSecReturnData as String] = true; var value: CFTypeRef?; let status = SecItemCopyMatching(q as CFDictionary, &value); if status == errSecItemNotFound { return nil }; guard status == errSecSuccess, let data = value as? Data else { throw AppleStorageError.failed }; return data }
    static func save(_ name: String, data: Data) throws {
        let q = query(name), changes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        var status = SecItemUpdate(q as CFDictionary, changes as CFDictionary)
        if status == errSecItemNotFound { status = SecItemAdd(q.merging(changes) { _, new in new } as CFDictionary, nil) }
        guard status == errSecSuccess, try read(name) == data else { throw AppleStorageError.failed }
    }
    static func remove(_ name: String) throws { let result = SecItemDelete(query(name) as CFDictionary); guard result == errSecSuccess || result == errSecItemNotFound else { throw AppleStorageError.failed } }
    static func installationKey(subject: String) throws -> P256.Signing.PrivateKey {
        if let data = try read("installation-key-v1-" + subject) { return try P256.Signing.PrivateKey(rawRepresentation: data) }
        let key = P256.Signing.PrivateKey(); try save("installation-key-v1-" + subject, data: key.rawRepresentation); return key
    }
    enum AppleStorageError: Error { case failed }
}

// Never forward authentication or installation proofs through an HTTP redirect.
private final class AppleNoRedirect: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
