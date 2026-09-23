import Foundation
import CoreFoundation

// Shared acceptance boundary. This parser never grants finish: native ACK
// signature and exact-context validation remain mandatory after active delivery.
enum AppleRecoveryResponse {
    enum Failure: String, Error {
        case transport = "BACKEND_TRANSPORT_FAIL"
        case http = "BACKEND_HTTP_STATUS_FAIL"
        case size = "BACKEND_BODY_TOO_LARGE"
        case contentType = "BACKEND_CONTENT_TYPE_FAIL"
        case json = "BACKEND_JSON_FAIL"
        case schema = "BACKEND_SCHEMA_FAIL"
        case authorization = "BACKEND_AUTHORIZATION_FAIL"
        case delivery = "BACKEND_DELIVERY_FAIL"
        case ack = "BACKEND_ACK_FAIL"
    }
    enum State { case deliveredActive, expiredUndelivered }
    struct Accepted {
        let state: State
        let envelope: [String: Any]
        let requiresACK: Bool
    }
    private static func boolean(_ value: Any?, equals expected: Bool) -> Bool {
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return false }
        return number.boolValue == expected
    }
    static func parse(_ data: Data, status: Int, contentType: String?, log: (String) -> Void) throws -> Accepted {
        func fail(_ error: Failure) throws -> Never {
            log("BACKEND102 http=\(status) safeCode=\(error.rawValue)")
            throw error
        }
        guard data.count <= 32768 else { try fail(.size) }
        guard contentType?.split(separator: ";", maxSplits: 1).first?.trimmingCharacters(in: .whitespaces).lowercased() == "application/json" else { try fail(.contentType) }
        let object: Any
        do { object = try JSONSerialization.jsonObject(with: data) } catch { try fail(.json) }
        guard let p = object as? [String: Any], let version = p["schemaVersion"] as? NSNumber, CFGetTypeID(version) != CFBooleanGetTypeID(), version == 1,
              let correlation = p["correlationId"] as? String, UUID(uuidString: correlation) != nil else { try fail(.schema) }
        if status != 200 {
            let stages = ["REQUEST", "AUTH", "NODE", "NODE_HMAC", "NODE_FRESHNESS", "POLICY", "DB", "CAS", "ACK", "RESPONSE"]
            let codes = ["CAPABILITY_REJECTED", "RECOVERY_AUTHORIZATION_REJECTED", "RECOVERY_AUTHORIZATION_EXPIRED", "RECOVERY_AUTHORIZATION_REPLAY", "NODE_UNAVAILABLE", "NODE_TIMEOUT", "NODE_AUTH_FAILED", "NODE_RESPONSE_BINDING", "NODE_RESPONSE_EXPIRED", "NODE_REJECTED", "NODE_INVALID_CONTRACT", "LEDGER_COMMIT_FAILED", "REQUEST_REJECTED"]
            let stage = p["stage"] as? String ?? ""
            let code = p["safeCode"] as? String ?? ""
            log("BACKEND102 http=\(status) status=error stage=\(stages.contains(stage) ? stage : "RESPONSE") serverCode=\(codes.contains(code) ? code : "REQUEST_REJECTED")")
            try fail(.http)
        }
        guard p["verification"] as? String == "verified", let state = p["status"] as? String else { try fail(.schema) }
        if state == "verified_expired_undelivered" {
            guard p["delivery"] is NSNull, p["ack"] is NSNull, boolean(p["finishAuthorized"], equals: false) else { try fail(.schema) }
            log("BACKEND102 http=200 status=verified_expired_undelivered finishAuthorized=false")
            return Accepted(state: .expiredUndelivered, envelope: p, requiresACK: false)
        }
        guard ["delivered_active", "verified_already_delivered"].contains(state) else { try fail(.schema) }
        guard let delivery = p["delivery"] as? [String: Any], let id = delivery["id"] as? String, UUID(uuidString: id) != nil else { try fail(.delivery) }
        guard let ack = p["ack"] as? [String: String], ack["kind"] == "LOCAL.apple.delivery.v1", let jws = ack["signed_jws"], !jws.isEmpty else { try fail(.ack) }
        guard boolean(p["finishAuthorized"], equals: true) else { try fail(.authorization) }
        log("BACKEND102 http=200 status=\(state) ACK_validation=REQUIRED")
        return Accepted(state: .deliveredActive, envelope: p, requiresACK: true)
    }
}
