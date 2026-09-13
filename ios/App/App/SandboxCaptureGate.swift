import Foundation
import CryptoKit

/// Inputs come only from native build/runtime and StoreKit verification, never JS.
struct SandboxCaptureGate {
    var debugDevice: Bool
    var launchArgument: Bool
    var captureConsent: Bool
    var localLabPresent: Bool
    var bundle: String
    var appVerified: Bool
    var environment: String

    var configured: Bool {
        debugDevice && launchArgument && captureConsent && !localLabPresent &&
        bundle == Self.bundleID
    }
    var allowed: Bool { configured && appVerified && environment == "Sandbox" }
    static let bundleID = "com.abilenevibes.app"
    static let products: Set<String> = [
        "com.abilenevibes.app.promotion.slot01.featured.monthly",
        "com.abilenevibes.app.promotion.slot01.premium.monthly"
    ]
    func accepts(verified: Bool, environment: String, bundle: String, product: String) -> Bool {
        allowed && verified && environment == "Sandbox" && bundle == Self.bundleID &&
        Self.products.contains(product)
    }
}

enum SandboxCaptureError: String, Error {
    case gateClosed, appNotVerifiedSandbox, transactionRejected, productUnavailable
    case invalidEvidence, captureFailed, purchaseUnavailable, userConfirmationRequired
}

/// Reserve synchronously on the session's MainActor, before any suspension.
struct SandboxCaptureAttempt {
    private(set) var reserved = false
    mutating func reserve() -> Bool {
        guard !reserved else { return false }
        reserved = true
        return true
    }
}

/// Packaging only: extracting x5c is NOT server signature/OCSP verification.
enum SandboxCaptureEnvelope {
    static func encode(jws: String, metadata: [String: Any]) throws -> Data {
        guard !jws.isEmpty, jws.utf8.count <= 131072 else { throw SandboxCaptureError.invalidEvidence }
        let parts = jws.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3, parts.allSatisfy({ !$0.isEmpty }) else { throw SandboxCaptureError.invalidEvidence }
        var header = String(parts[0]).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        header += String(repeating: "=", count: (4 - header.count % 4) % 4)
        guard let data = Data(base64Encoded: header),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["alg"] as? String == "ES256",
              let x5c = json["x5c"] as? [String], (2...5).contains(x5c.count) else {
            throw SandboxCaptureError.invalidEvidence
        }
        let certificates = try x5c.map { encoded -> Data in
            guard let der = Data(base64Encoded: encoded), !der.isEmpty, der.count <= 16384 else {
                throw SandboxCaptureError.invalidEvidence
            }
            return der
        }
        let envelope: [String: Any] = [
            "schema": "abilene.sandbox.capture.v1", "capturedAt": ISO8601DateFormatter().string(from: Date()),
            "verificationScope": "StoreKit verified; server composition and OCSP NOT validated",
            "metadata": metadata, "jwsRepresentation": jws, "x5c": x5c,
            "certificateSHA256": certificates.map { SHA256.hash(data: $0).map { String(format: "%02x", $0) }.joined() }
        ]
        return try JSONSerialization.data(withJSONObject: envelope, options: [.sortedKeys])
    }
}
