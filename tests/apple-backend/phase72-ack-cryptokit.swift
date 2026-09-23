import Foundation
import CryptoKit
func decode(_ s:String) -> Data? { let b=s.replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/");return Data(base64Encoded:b+String(repeating:"=",count:(4-b.count%4)%4)) }
let input=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))
let root=try JSONSerialization.jsonObject(with:input) as! [String:Any]
let key=try P256.Signing.PublicKey(x963Representation:Data(base64Encoded:root["publicKey"] as! String)!)
let cases=root["cases"] as! [[String:Any]]
var failures=0
for c in cases {
 let parts=(c["jws"] as! String).split(separator:".").map(String.init)
 var valid=false
 if parts.count==3,let hb=decode(parts[0]),let pb=decode(parts[1]),let sb=decode(parts[2]),let signature=try? P256.Signing.ECDSASignature(rawRepresentation:sb),let h=(try? JSONSerialization.jsonObject(with:hb)) as? [String:Any],let p=(try? JSONSerialization.jsonObject(with:pb)) as? [String:Any] {
  let now=c["now"] as! Double
  let expected=c["expected"] as! [String:String]
  let iat=(p["iat"] as? NSNumber)?.doubleValue ?? .infinity
  let exp=(p["exp"] as? NSNumber)?.doubleValue ?? -.infinity
  valid=h["alg"] as? String == "ES256" && h["typ"] as? String == "LOCAL-delivery+jwt" && h["kid"] as? String == "local-ephemeral" && p["iss"] as? String == "abilene-apple-delivery-local" && p["aud"] as? String == "com.abilenevibes.app" && p["environment"] as? String == "Sandbox" && iat<=now && now<exp && exp-iat<=300 && expected.allSatisfy { p[$0.key] as? String == $0.value } && key.isValidSignature(signature,for:Data((parts[0]+"."+parts[1]).utf8))
 }
 if valid != (c["valid"] as! Bool) {failures+=1}
 print("\(valid == (c["valid"] as! Bool) ? "PASS" : "FAIL") \(c["name"] as! String)")
}
print("TOTAL \(cases.count) PASS \(cases.count-failures) FAIL \(failures)")
exit(failures==0 ? 0:1)
