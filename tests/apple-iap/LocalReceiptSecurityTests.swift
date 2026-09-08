import Foundation

@main struct LocalReceiptSecurityTests {
    static func main() async {
        var passed = 0
        func check(_ value: Bool, _ name: String) {
            guard value else { fatalError("FAIL: " + name) }
            passed += 1; print("PASS: " + name)
        }
        let gate = LocalTestGate(nativeIOS:true,debug:true,simulator:true,launchArgument:true,webBuildFlag:true,appVerified:true,environment:"Xcode",bundle:"com.abilenevibes.app")
        let t = LocalReceiptTransaction(transactionId:"100",originalTransactionId:"99",productId:"com.abilenevibes.app.promotion.slot01.featured.monthly",bundle:"com.abilenevibes.app",environment:"Xcode",appAccountToken:UUID().uuidString)
        let authority = LocalTestReceiptAuthority()
        let receipt = await authority.issue(t,gate:gate,now:1000)!
        check(gate.allowed,"complete native gate")
        var variants:[(String,LocalTestGate)] = []
        var g=gate;g.nativeIOS=false;variants.append(("native iOS",g))
        g=gate;g.debug=false;variants.append(("Debug",g))
        g=gate;g.simulator=false;variants.append(("Simulator",g))
        g=gate;g.launchArgument=false;variants.append(("launch argument",g))
        g=gate;g.webBuildFlag=false;variants.append(("web build flag",g))
        g=gate;g.appVerified=false;variants.append(("verified app",g))
        g=gate;g.environment="Sandbox";variants.append(("Sandbox",g))
        g=gate;g.environment="Production";variants.append(("Production",g))
        g=gate;g.bundle="wrong.bundle";variants.append(("app bundle",g))
        for (name,bad) in variants {
            let issued=await authority.issue(t,gate:bad,now:1001)
            let accepted=await authority.consume(receipt,transaction:t,gate:bad,now:1001)
            check(!bad.allowed && issued == nil && !accepted,"reject missing/invalid " + name)
        }
        var tx=t;tx.transactionId="200"
        check(!(await authority.consume(receipt,transaction:tx,gate:gate,now:1001)),"receipt A cannot finish B / changed transactionId")
        tx=t;tx.originalTransactionId="changed"
        check(!(await authority.consume(receipt,transaction:tx,gate:gate,now:1001)),"originalTransactionId tampering")
        tx=t;tx.productId="com.abilenevibes.app.promotion.slot01.premium.monthly"
        check(!(await authority.consume(receipt,transaction:tx,gate:gate,now:1001)),"allowlisted but changed productId")
        tx=t;tx.productId="remote.unapproved.product"
        check(await authority.issue(tx,gate:gate,now:1001) == nil,"product outside allowlist")
        tx=t;tx.bundle="wrong.bundle"
        check(!(await authority.consume(receipt,transaction:tx,gate:gate,now:1001)),"transaction bundle tampering")
        tx=t;tx.environment="Sandbox"
        check(!(await authority.consume(receipt,transaction:tx,gate:gate,now:1001)),"transaction environment tampering")
        tx=t;tx.appAccountToken=UUID().uuidString
        check(!(await authority.consume(receipt,transaction:tx,gate:gate,now:1001)),"buyer token tampering")
        check(!(await authority.consume("",transaction:t,gate:gate,now:1001)),"empty receipt")
        check(!(await authority.consume(receipt+"tampered",transaction:t,gate:gate,now:1001)),"altered receipt")
        check(!(await authority.consume(receipt,transaction:t,gate:gate,now:1300)),"expired receipt")
        check(!(await authority.consume(receipt,transaction:t,gate:gate,now:999)),"receipt not yet issued")
        check(await authority.consume(receipt,transaction:t,gate:gate,now:1001),"valid receipt consumes once")
        check(!(await authority.consume(receipt,transaction:t,gate:gate,now:1002)),"replay rejected")
        check(await authority.issue(t,gate:gate,now:1002) == nil,"finished transaction cannot obtain another receipt in session")
        let restarted=LocalTestReceiptAuthority()
        check(!(await restarted.consume(receipt,transaction:t,gate:gate,now:1002)),"previous process receipt rejected after restart")
        let replacement=await restarted.issue(t,gate:gate,now:1002)!
        async let first=restarted.consume(replacement,transaction:t,gate:gate,now:1003)
        async let second=restarted.consume(replacement,transaction:t,gate:gate,now:1003)
        let pair=await (first,second)
        check(pair.0 != pair.1,"concurrent replay exactly one succeeds")
        print("SWIFT SECURITY TESTS: \(passed) passed, 0 failed")
    }
}
