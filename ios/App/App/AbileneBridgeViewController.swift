import Capacitor

final class AbileneBridgeViewController: CAPBridgeViewController {
    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        // Capacitor's debug response logging can expose fragments of signed evidence.
        descriptor.loggingBehavior = .none
        return descriptor
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AbileneStoreKitPlugin())
    }
}
