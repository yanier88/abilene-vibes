import Capacitor
import UIKit

final class AbileneBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        #if DEBUG && os(iOS) && !targetEnvironment(simulator)
        if SandboxPhysicalRuntime.requested {
            // CAPBridgeViewController.viewDidLoad loads the web application. Do not call it
            // in capture mode: no React UI, Supabase, public promotions or JS evidence.
            if #available(iOS 16.0, *) {
                let capture = SandboxPhysicalCaptureViewController()
                addChild(capture)
                view = capture.view
                capture.didMove(toParent: self)
            } else {
                let blocked = UILabel()
                blocked.text = "Sandbox capture requires iOS 16 or later."
                blocked.textAlignment = .center
                view = blocked
            }
            return
        }
        #endif
        super.viewDidLoad()
    }

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
