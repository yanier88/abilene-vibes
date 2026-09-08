import Foundation

/// Inputs are supplied by native compile/runtime evidence, never a JS delivered flag.
struct LocalTestGate: Sendable {
    var nativeIOS: Bool
    var debug: Bool
    var simulator: Bool
    var launchArgument: Bool
    var webBuildFlag: Bool
    var appVerified: Bool
    var environment: String
    var bundle: String
    var allowed: Bool {
        nativeIOS && debug && simulator && launchArgument && webBuildFlag && appVerified &&
        environment == "Xcode" && bundle == "com.abilenevibes.app"
    }
    static let products: Set<String> = [
        "com.abilenevibes.app.promotion.slot01.featured.monthly",
        "com.abilenevibes.app.promotion.slot01.premium.monthly",
        "com.abilenevibes.app.promotion.slot02.featured.monthly"
    ]
}

#if DEBUG && (targetEnvironment(simulator) || (os(macOS) && ABILENE_SECURITY_TESTS))
import CryptoKit

struct LocalReceiptTransaction: Codable, Equatable, Sendable {
    var transactionId: String
    var originalTransactionId: String
    var productId: String
    var bundle: String
    var environment: String
    var appAccountToken: String
}

/// Test-only, in-memory one-time receipt authority. This same source runs in unit tests.
actor LocalTestReceiptAuthority {
    private struct Payload: Codable {
        let domain: String
        let transaction: LocalReceiptTransaction
        let nonce: UUID
        let issuedAt: TimeInterval
        let expiresAt: TimeInterval
    }
    private let key = SymmetricKey(size: .bits256)
    private var issued: [String: (receipt: String, expiresAt: TimeInterval)] = [:]
    private var consumed: Set<String> = []
    private func permitted(_ t: LocalReceiptTransaction, _ gate: LocalTestGate) -> Bool {
        gate.allowed && t.environment == "Xcode" && t.bundle == gate.bundle &&
        LocalTestGate.products.contains(t.productId) && UUID(uuidString: t.appAccountToken) != nil
    }
    func issue(_ t: LocalReceiptTransaction, gate: LocalTestGate, now: TimeInterval = Date().timeIntervalSince1970) -> String? {
        guard permitted(t,gate), !consumed.contains(t.transactionId) else { return nil }
        if let prior = issued[t.transactionId], prior.expiresAt > now { return prior.receipt }
        let payload = Payload(domain: "ABILENE-XCODE-TEST-V1", transaction: t, nonce: UUID(), issuedAt: now, expiresAt: now + 300)
        guard let bytes = try? JSONEncoder().encode(payload) else { return nil }
        let signature = Data(HMAC<SHA256>.authenticationCode(for: bytes, using: key)).base64EncodedString()
        let receipt = "XCODE-TEST.v1." + bytes.base64EncodedString() + "." + signature
        issued[t.transactionId] = (receipt, payload.expiresAt)
        return receipt
    }
    /// Validation and consumption are atomic on this actor; a replay cannot race finish.
    func consume(_ receipt: String, transaction: LocalReceiptTransaction, gate: LocalTestGate, now: TimeInterval = Date().timeIntervalSince1970) -> Bool {
        guard permitted(transaction,gate), !consumed.contains(transaction.transactionId),
              !receipt.isEmpty, receipt.utf8.count <= 8192,
              issued[transaction.transactionId]?.receipt == receipt else { return false }
        let parts = receipt.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 4, parts[0] == "XCODE-TEST", parts[1] == "v1",
              let bytes = Data(base64Encoded: String(parts[2])), let mac = Data(base64Encoded: String(parts[3])),
              HMAC<SHA256>.isValidAuthenticationCode(mac, authenticating: bytes, using: key),
              let payload = try? JSONDecoder().decode(Payload.self, from: bytes),
              payload.domain == "ABILENE-XCODE-TEST-V1", payload.transaction == transaction,
              payload.issuedAt <= now, payload.expiresAt > now else { return false }
        consumed.insert(transaction.transactionId)
        issued.removeValue(forKey: transaction.transactionId)
        return true
    }
}
#endif
