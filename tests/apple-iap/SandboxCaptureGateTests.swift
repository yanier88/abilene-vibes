import Foundation

@main struct SandboxCaptureGateTests {
    static func main() throws {
        var passed = 0
        func check(_ condition: Bool, _ name: String) {
            guard condition else { fatalError("FAIL: " + name) }
            passed += 1; print("PASS: " + name)
        }
        let gate = SandboxCaptureGate(debugDevice: true, launchArgument: true, captureConsent: true,
            localLabPresent: false, bundle: SandboxCaptureGate.bundleID, appVerified: true, environment: "Sandbox")
        check(gate.allowed, "complete physical Sandbox native policy")
        var variants: [(String, SandboxCaptureGate)] = []
        var g = gate; g.debugDevice = false; variants.append(("Release or simulator", g))
        g = gate; g.launchArgument = false; variants.append(("normal launch", g))
        g = gate; g.captureConsent = false; variants.append(("missing deliberate opt-in", g))
        g = gate; g.localLabPresent = true; variants.append(("mixed Xcode lab", g))
        g = gate; g.bundle = "wrong.bundle"; variants.append(("wrong bundle", g))
        g = gate; g.appVerified = false; variants.append(("unverified AppTransaction", g))
        g = gate; g.environment = "Production"; variants.append(("Production", g))
        g = gate; g.environment = "Xcode"; variants.append(("Xcode", g))
        g = gate; g.environment = ""; variants.append(("unknown environment", g))
        for (name, bad) in variants {
            check(!bad.allowed && !bad.accepts(verified: true, environment: "Sandbox", bundle: SandboxCaptureGate.bundleID,
                product: "com.abilenevibes.app.promotion.slot01.featured.monthly"), "reject " + name)
        }
        for product in SandboxCaptureGate.products {
            check(gate.accepts(verified: true, environment: "Sandbox", bundle: SandboxCaptureGate.bundleID, product: product), "allow scoped product " + product)
        }
        let featured = "com.abilenevibes.app.promotion.slot01.featured.monthly"
        check(!gate.accepts(verified: false, environment: "Sandbox", bundle: SandboxCaptureGate.bundleID, product: featured), "unverified transaction")
        for env in ["Production", "Xcode", "", "sandbox"] {
            check(!gate.accepts(verified: true, environment: env, bundle: SandboxCaptureGate.bundleID, product: featured), "transaction environment rejected: " + env)
        }
        check(!gate.accepts(verified: true, environment: "Sandbox", bundle: "another.app", product: featured), "foreign app transaction")
        check(!gate.accepts(verified: true, environment: "Sandbox", bundle: SandboxCaptureGate.bundleID,
            product: "com.abilenevibes.app.promotion.slot02.featured.monthly"), "other slots unavailable in capture")

        var attempt = SandboxCaptureAttempt()
        check(!attempt.reserved, "no attempt before explicit action")
        check(attempt.reserve() && attempt.reserved, "first attempt reserved before suspension")
        check(!attempt.reserve() && attempt.reserved, "reentrant or retried attempt rejected")

        // Deliberately malformed inputs only. No synthetic positive Apple evidence.
        func malformed(_ header: [String: Any]) throws -> String {
            try JSONSerialization.data(withJSONObject: header).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "") + ".invalid.invalid"
        }
        let invalid = try ["", "a.b", "a..c", String(repeating: "a", count: 131073),
            malformed(["alg": "none", "x5c": ["YQ==", "Yg=="]]),
            malformed(["alg": "ES256"]), malformed(["alg": "ES256", "x5c": []]),
            malformed(["alg": "ES256", "x5c": ["!invalid!", "Yg=="]])]
        for (index, jws) in invalid.enumerated() {
            do { _ = try SandboxCaptureEnvelope.encode(jws: jws, metadata: [:]); check(false, "malformed evidence \(index)") }
            catch { check(true, "malformed evidence \(index) rejected") }
        }
        print("SANDBOX CAPTURE POLICY TESTS: \(passed) passed, 0 failed")
    }
}
