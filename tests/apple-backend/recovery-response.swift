// Run concatenated after AppleRecoveryResponse.swift; no StoreKit dependency.
var checks = 0
func verify(_ condition: @autoclosure () -> Bool) { precondition(condition()); checks += 1 }
let common: [String:Any] = ["schemaVersion":1,"correlationId":"00000000-0000-0000-0000-000000000001","verification":"verified"]
func parseFixture(_ patch: [String:Any], status: Int = 200, mime: String = "application/json") throws -> AppleRecoveryResponse.Accepted {
    let p = common.merging(patch) { _,new in new }
    return try AppleRecoveryResponse.parse(JSONSerialization.data(withJSONObject:p),status:status,contentType:mime,log:{ _ in })
}
let expired: [String:Any] = ["status":"verified_expired_undelivered","delivery":NSNull(),"ack":NSNull(),"finishAuthorized":false]
let saved = try parseFixture(expired)
verify(saved.state == .expiredUndelivered && !saved.requiresACK)
let active: [String:Any] = ["status":"delivered_active","delivery":["id":"00000000-0000-0000-0000-000000000002"],"ack":["kind":"LOCAL.apple.delivery.v1","signed_jws":"TEST.ONLY.ACK"],"finishAuthorized":true]
let activeParsed = try parseFixture(active)
verify(activeParsed.requiresACK)
for status in [400,401,409,422,500] {
    do { _ = try parseFixture(["status":"error","stage":"NODE","safeCode":"NODE_REJECTED"],status:status); preconditionFailure() }
    catch { verify((error as? AppleRecoveryResponse.Failure) == .http) }
}
for (patch,code) in [(["schemaVersion":0],AppleRecoveryResponse.Failure.schema),(["schemaVersion":true],.schema),(["finishAuthorized":0],.schema),(["finishAuthorized":true],.schema),(["ack":["signed_jws":"bad"]],.schema)] {
    do { _ = try parseFixture(expired.merging(patch) { _,new in new }); preconditionFailure() }
    catch { verify((error as? AppleRecoveryResponse.Failure) == code) }
}
do { _ = try parseFixture(expired,mime:"text/plain"); preconditionFailure() } catch { verify((error as? AppleRecoveryResponse.Failure) == .contentType) }
do { _ = try AppleRecoveryResponse.parse(Data(repeating:0,count:32769),status:200,contentType:"application/json",log:{_ in}); preconditionFailure() } catch { verify((error as? AppleRecoveryResponse.Failure) == .size) }
print("PASS native response contract checks=\(checks); no finish capability")
