import Capacitor
import Foundation

@objc(AbileneStoreKitPlugin)
public final class AbileneStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AbileneStoreKitPlugin"
    public let jsName = "AbileneStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        "getVerifiedAppTransaction", "getProducts", "purchase", "getCurrentEntitlements",
        "getUnfinishedTransactions", "syncPurchases", "startTransactionUpdates",
        "stopTransactionUpdates", "finishTransaction"
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private let service = LocalStoreKitTest.makeService()
    private var resetGeneration = 0

    private func run(_ call: CAPPluginCall, operation: @escaping () async throws -> [String: Any]) {
        Task { @MainActor in
            do { call.resolve(try await operation()) }
            catch let error as StoreKitBridgeError { call.reject(error.rawValue, error.rawValue) }
            catch { call.reject("StoreKit operation failed", "storeKitOperationFailed") }
        }
    }

    @objc func getVerifiedAppTransaction(_ call: CAPPluginCall) {
        run(call) { try await self.service.getVerifiedAppTransaction() }
    }
    @objc func getProducts(_ call: CAPPluginCall) {
        guard let ids = call.getArray("productIds", String.self) else { call.reject("productIds required"); return }
        run(call) { ["products": try await self.service.getProducts(ids)] }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"), let token = call.getString("appAccountToken") else {
            call.reject("productId and appAccountToken required"); return
        }
        run(call) { await self.service.purchase(productId: id, appAccountToken: token) }
    }
    @objc func getCurrentEntitlements(_ call: CAPPluginCall) {
        run(call) { ["transactions": await self.service.getCurrentEntitlements()] }
    }
    @objc func getUnfinishedTransactions(_ call: CAPPluginCall) {
        run(call) { ["transactions": await self.service.getUnfinishedTransactions()] }
    }
    @objc func syncPurchases(_ call: CAPPluginCall) {
        run(call) { try await self.service.syncPurchases() }
    }
    @objc func startTransactionUpdates(_ call: CAPPluginCall) {
        run(call) {
            let generation = await MainActor.run { self.resetGeneration }
            let started = await self.service.startTransactionUpdates { [weak self] event in
                guard let plugin = self else { return }
                await MainActor.run {
                    guard plugin.resetGeneration == generation else { return }
                    plugin.notifyListeners("transactionUpdate", data: event)
                }
            }
            return ["started": started]
        }
    }
    @objc func stopTransactionUpdates(_ call: CAPPluginCall) {
        run(call) {
            await MainActor.run { self.resetGeneration += 1 }
            await self.service.stopTransactionUpdates()
            return [:]
        }
    }
    @objc func finishTransaction(_ call: CAPPluginCall) {
        guard let id = call.getString("transactionId"),
              let confirmation = call.getObject("deliveryConfirmation"),
              let boundId = confirmation["transactionId"] as? String,
              let receipt = confirmation["receipt"] as? String else {
            call.reject("Opaque transaction-bound delivery confirmation required", "deliveryNotConfirmed"); return
        }
        run(call) {
            try await self.service.finishTransaction(transactionId: id,
                confirmation: DeliveryConfirmation(transactionId: boundId, receipt: receipt))
            return ["finished": true, "transactionId": id]
        }
    }

    /// Capacitor calls this on navigation/reset, including with a nil Obj-C call.
    public override func removeAllListeners(_ call: CAPPluginCall) {
        resetGeneration += 1
        let service = service
        Task { await service.stopTransactionUpdates() }
        super.removeAllListeners(call)
    }
    deinit {
        let service = service
        Task { await service.stopTransactionUpdates() }
    }
}
