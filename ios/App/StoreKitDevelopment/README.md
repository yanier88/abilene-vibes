# Local development catalog

AbileneLocal.storekit is the unchanged 10-slot / 20-product catalog preserved from phase32. Only AbileneIAPLocal's Xcode Run action references it. It is not an App resource or an App Store Connect configuration. The React screen requests only Slot01 Featured, Slot01 Premium and Slot02 Featured.

Phase35 removed the obsolete StoreKitLocalHost and StoreKitLocalTests targets, their source/build objects, LocalDevelopment.entitlements and StoreKitLocal.xcscheme. No SKTestSession is used. The working Capacitor bridge, storyboard and controller remain.

For current gates, receipts and validation status, read docs/phase35-hardening.md. Do not run old SKTestSession/signing instructions. No external laboratory was created or changed in phase35.
