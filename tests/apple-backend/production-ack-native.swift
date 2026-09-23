import Foundation
import CryptoKit
@main struct Run {
 static func main() throws {
  let root = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))) as! [String: Any]
  let key = try P256.Signing.PublicKey(x963Representation: Data(base64Encoded: root["publicKey"] as! String)!)
  let verifier = AppleDeliveryACKVerifier(keys: [root["kid"] as! String: key], environment: "Production")
  let cases = root["cases"] as! [[String: Any]]
  var failures = 0
  for c in cases {
   let actual = verifier.permitsFinish(kind: c["kind"] as! String, jws: c["signed_jws"] as! String, expected: c["expected"] as! [String: String], now: Date(timeIntervalSince1970: c["now"] as! Double))
   if actual != (c["valid"] as! Bool) { failures += 1 }
  }
  print("TOTAL \(cases.count) PASS \(cases.count-failures) FAIL \(failures)")
  if failures != 0 { exit(1) }
 }
}
