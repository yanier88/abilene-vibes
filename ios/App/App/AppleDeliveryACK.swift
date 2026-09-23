import Foundation
import CoreFoundation
import CryptoKit

/// Product trust only: keys come from the signed app's configuration, not a response.
struct AppleDeliveryACKVerifier {
    let keys: [String: P256.Signing.PublicKey]
    let environment: String
    private static let bindings = ["transactionId", "originalTransactionId", "delivery_id", "buyer_id", "installation_id", "installation_key_id", "listing_type", "listing_id", "productId", "environment", "appAccountToken", "purchase_intent_id"]

    private func decode(_ value: String) -> Data? {
        guard !value.isEmpty, value.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil else { return nil }
        let text = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        guard let data = Data(base64Encoded: text + String(repeating: "=", count: (4 - text.count % 4) % 4)) else { return nil }
        let canonical = data.base64EncodedString().replacingOccurrences(of: "=", with: "").replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
        return canonical == value ? data : nil
    }

    func permitsFinish(kind: String, jws: String, expected: [String: String], now: Date = Date()) -> Bool {
        guard kind == "apple.delivery.v1", ["Production", "Sandbox"].contains(environment), jws.utf8.count <= 16384 else { return false }
        let parts = jws.components(separatedBy: ".")
        guard parts.count == 3, let hb = decode(parts[0]), let pb = decode(parts[1]), let sb = decode(parts[2]),
              let header = (try? JSONSerialization.jsonObject(with: hb)) as? [String: Any],
              let claims = (try? JSONSerialization.jsonObject(with: pb)) as? [String: Any],
              Set(header.keys).isSubset(of: ["alg", "typ", "kid"]),
              header["alg"] as? String == "ES256", header["typ"] as? String == "abilene-delivery+jwt",
              let kid = header["kid"] as? String, let key = keys[kid],
              let signature = try? P256.Signing.ECDSASignature(rawRepresentation: sb),
              key.isValidSignature(signature, for: Data((parts[0] + "." + parts[1]).utf8)),
              claims["iss"] as? String == "abilene-apple-delivery", claims["aud"] as? String == "com.abilenevibes.app",
              claims["environment"] as? String == environment,
              let schema = integer(claims["schemaVersion"]), schema == 1,
              let iat = integer(claims["iat"]), let exp = integer(claims["exp"]), integer(claims["issued_at"]) == iat,
              Double(iat) <= now.timeIntervalSince1970, now.timeIntervalSince1970 < Double(exp), exp > iat, exp - iat <= 300,
              let status = claims["delivery_status"] as? String, ["delivered", "already_delivered"].contains(status),
              let ackID = claims["ackId"] as? String, !ackID.isEmpty,
              let deliveredText = claims["deliveredAt"] as? String,
              let delivered = Self.timestamp(deliveredText), delivered <= now else { return false }
        return Self.bindings.allSatisfy { field in
            guard let value = expected[field], !value.isEmpty, value.utf8.count <= 256 else { return false }
            return claims[field] as? String == value
        }
    }

    private func integer(_ value: Any?) -> Int64? {
        guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite,
              n.doubleValue.rounded() == n.doubleValue, abs(n.doubleValue) <= 9007199254740991 else { return nil }
        return n.int64Value
    }
    private static func timestamp(_ text: String) -> Date? {
        let parser = ISO8601DateFormatter(); parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let value = parser.date(from: text) { return value }
        parser.formatOptions = [.withInternetDateTime]; return parser.date(from: text)
    }
}

enum AppleACKTrust {
    static let kid = "abilene-apple-iap-ack-prod-v1"
    static let publicKeyX963 = "BKsXwquvJzBORg7qv02RGnoksmXnp3XWayrhKfTEPlLU4NbPTIh1b3qaPuFz15XKm4HntswxHMYhQu5fMg7zrgg="
    static func verifier() throws -> AppleDeliveryACKVerifier {
        guard let bytes = Data(base64Encoded: publicKeyX963) else { throw NSError(domain: "DeliveryConfiguration", code: 1) }
        return AppleDeliveryACKVerifier(keys: [kid: try P256.Signing.PublicKey(x963Representation: bytes)], environment: "Production")
    }
}
