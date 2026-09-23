import Capacitor
import UIKit
import StoreKit

final class AbileneBridgeViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        #if DEBUG && os(iOS) && !targetEnvironment(simulator)
        if ProcessInfo.processInfo.arguments.contains("--abilene-apple-plans-review"),
           ProcessInfo.processInfo.environment["ABILENE_APPLE_PLANS_REVIEW"] == "VISUAL_ONLY",
           !SandboxPhysicalRuntime.requested {
            let plans = ApplePromotionPlansViewController()
            let container = UIView()
            view = container
            addChild(plans)
            plans.view.frame = container.bounds
            plans.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            container.addSubview(plans.view)
            plans.didMove(toParent: self)
            return
        }
        if SandboxPhysicalRuntime.requested {
            // CAPBridgeViewController.viewDidLoad loads the web application. Do not call it
            // in capture mode: no React UI, Supabase, public promotions or JS evidence.
            if #available(iOS 16.0, *) {
                let capture = SandboxPhysicalCaptureViewController()
                let container = UIView()
                view = container
                addChild(capture)
                capture.view.translatesAutoresizingMaskIntoConstraints = false
                container.addSubview(capture.view)
                NSLayoutConstraint.activate([
                    capture.view.topAnchor.constraint(equalTo: container.topAnchor),
                    capture.view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
                    capture.view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                    capture.view.trailingAnchor.constraint(equalTo: container.trailingAnchor)
                ])
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
        bridge?.registerPluginInstance(ApplePromotionPlansPlugin())
    }
}

/// Presentation only. No purchase, receipt, delivery or capture APIs cross this bridge.
@objc(ApplePromotionPlansPlugin)
public final class ApplePromotionPlansPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ApplePromotionPlansPlugin"
    public let jsName = "ApplePromotionPlans"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]

    @objc func open(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let parent = self.bridge?.viewController, parent.presentedViewController == nil else {
                call.reject("Plan screen unavailable"); return
            }
            guard let jwt = call.getString("accessToken"), !jwt.isEmpty,
                  let kind = call.getString("listingType"), ["business", "job", "rental"].contains(kind),
                  let listing = call.getString("listingId"), UUID(uuidString: listing) != nil,
                  #available(iOS 16.0, *) else { call.reject("Sign in to your account to manage this listing on iOS 16.0 or later."); return }
            let plans = ApplePromotionPlansViewController()
            do {
                let service = try AppleProductionPurchase(jwt: jwt, listingType: kind, listingID: listing)
                service.onDelivery = { [weak self] in self?.notifyListeners("promotionChanged", data: [:]) }
                plans.purchaseService = service
                plans.onOpenLegal = { [weak self, weak plans] page in plans?.dismiss(animated: true); self?.notifyListeners("openLegal", data: ["page": page]) }
            }
            catch { call.reject("Secure purchase storage is unavailable."); return }
            plans.modalPresentationStyle = .fullScreen
            parent.present(plans, animated: true) { call.resolve() }
        }
    }
}

// Production catalog identifiers; display prices always come from StoreKit.
private enum ApplePromotionCatalog {
    static let products: Set<String> = [
        "com.abilenevibes.app.promotion.slot01.featured.monthly",
        "com.abilenevibes.app.promotion.slot01.premium.monthly"
    ]
}

/// The same native selection UI is used by the normal iOS flow and isolated Debug review.
@MainActor final class ApplePromotionPlansViewController: UIViewController {
    var purchaseService: AnyObject?
    var onOpenLegal: ((String) -> Void)?
    private var storeProducts: [String: Product] = [:]
    private let stack = UIStackView()
    private let notice = UILabel()
    private var cards: [String: UIView] = [:]
    private var prices: [String: UILabel] = [:]
    private var buttons: [String: UIButton] = [:]
    private var available: Set<String> = []
    private var selected: String?
    private var loading = false
    private let cyan = UIColor(red: 0, green: 0.83, blue: 1, alpha: 1)
    private let pink = UIColor(red: 1, green: 0, blue: 0.8, alpha: 1)
    private let backdrop = CAGradientLayer()

    private var reviewMode: Bool {
        #if DEBUG && os(iOS) && !targetEnvironment(simulator)
        return ProcessInfo.processInfo.arguments.contains("--abilene-apple-plans-review") &&
            ProcessInfo.processInfo.environment["ABILENE_APPLE_PLANS_REVIEW"] == "VISUAL_ONLY" &&
            !SandboxPhysicalRuntime.requested
        #else
        return false
        #endif
    }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    private func label(_ text: String, size: CGFloat, weight: UIFont.Weight = .regular,
                       color: UIColor = .white) -> UILabel {
        let label = UILabel()
        label.text = text; label.numberOfLines = 0; label.textColor = color
        label.font = UIFontMetrics.default.scaledFont(for: .systemFont(ofSize: size, weight: weight))
        label.adjustsFontForContentSizeCategory = true
        return label
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.02, green: 0, blue: 0.03, alpha: 1)
        backdrop.colors = [UIColor(red: 0.14, green: 0.02, blue: 0.22, alpha: 1).cgColor,
                           UIColor(red: 0.02, green: 0, blue: 0.04, alpha: 1).cgColor,
                           UIColor(red: 0, green: 0.08, blue: 0.13, alpha: 1).cgColor]
        view.layer.insertSublayer(backdrop, at: 0)
        let scroll = UIScrollView(); scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)
        stack.axis = .vertical; stack.spacing = 16; stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)
        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -20),
            stack.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.frameLayoutGuide.widthAnchor)
        ])
        let brand = label("ABILENE VIBES", size: 15, weight: .heavy, color: cyan)
        stack.addArrangedSubview(brand)
        if presentingViewController != nil {
            let close = UIButton(type: .system); close.setTitle("Back to Abilene Vibes", for: .normal)
            close.tintColor = cyan
            close.addAction(UIAction { [weak self] _ in self?.dismiss(animated: true) }, for: .touchUpInside)
            stack.addArrangedSubview(close)
        }
        stack.addArrangedSubview(label("Promote your\nbusiness", size: 35, weight: .heavy))
        stack.addArrangedSubview(label("Stand out in Abilene. Choose the monthly promotion that fits your business.", size: 16,
                                     color: UIColor(white: 0.8, alpha: 1)))
        stack.addArrangedSubview(label("MONTHLY APPLE SUBSCRIPTIONS", size: 11, weight: .bold, color: cyan))
        for id in ApplePromotionCatalog.products.sorted() { addPlan(id) }
        notice.numberOfLines = 0; notice.textColor = UIColor(white: 0.78, alpha: 1)
        notice.font = .preferredFont(forTextStyle: .footnote)
        notice.text = "Choose a plan. Prices are provided by Apple."
        stack.addArrangedSubview(notice)
        if reviewMode {
            #if DEBUG && os(iOS) && !targetEnvironment(simulator)
            stack.addArrangedSubview(label("DEBUG / REVIEW · Reference prices from App Store Connect. Not fetched from Apple on this device.",
                                         size: 11, color: UIColor(white: 0.65, alpha: 1)))
            #endif
        } else {
            let load = UIButton(type: .system); load.setTitle("Load Apple prices", for: .normal); load.tintColor = cyan
            load.addAction(UIAction { [weak self] _ in self?.loadPrices() }, for: .touchUpInside)
            stack.addArrangedSubview(load)
            let recover = UIButton(type: .system); recover.setTitle("Recover purchase", for: .normal)
            recover.addAction(UIAction { [weak self] _ in self?.recoverPurchase() }, for: .touchUpInside)
            stack.addArrangedSubview(recover)
            let manage = UIButton(type: .system); manage.setTitle("Manage Apple subscription", for: .normal)
            manage.addAction(UIAction { [weak self] _ in
                guard let scene = self?.view.window?.windowScene else { return }
                Task { try? await AppStore.showManageSubscriptions(in: scene) }
            }, for: .touchUpInside)
            stack.addArrangedSubview(manage)
            for page in ["terms", "privacy"] {
                let legal = UIButton(type: .system); legal.setTitle(page == "terms" ? "Terms of Use" : "Privacy Policy", for: .normal)
                legal.addAction(UIAction { [weak self] _ in self?.onOpenLegal?(page) }, for: .touchUpInside)
                stack.addArrangedSubview(legal)
            }
            stack.addArrangedSubview(label("Subscriptions renew automatically until cancelled. Manage plan changes or cancellation with Apple.", size: 12))
        }
    }

    override func viewDidLayoutSubviews() { super.viewDidLayoutSubviews(); backdrop.frame = view.bounds }

    private func addPlan(_ id: String) {
        let premium = id.hasSuffix(".premium.monthly")
        let name = premium ? "Premium" : "Featured"
        let accent = premium ? pink : cyan
        let card = UIView(); card.backgroundColor = UIColor(white: 1, alpha: 0.055)
        card.layer.cornerRadius = 22; card.layer.borderWidth = 1; card.layer.borderColor = accent.withAlphaComponent(0.45).cgColor
        let content = UIStackView(); content.axis = .vertical; content.spacing = 9
        content.translatesAutoresizingMaskIntoConstraints = false; card.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: card.topAnchor, constant: 18),
            content.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -18),
            content.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            content.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20)
        ])
        content.addArrangedSubview(label(name.uppercased() + " PROMOTION", size: 17, weight: .heavy, color: accent))
        let price = label("Price unavailable", size: 28, weight: .bold)
        #if DEBUG && os(iOS) && !targetEnvironment(simulator)
        if reviewMode { price.text = premium ? "$67.99/month" : "$24.99/month" }
        #endif
        content.addArrangedSubview(price); prices[id] = price
        content.addArrangedSubview(label(premium ? "Maximum visibility for your Abilene business listing." :
            "Enhanced visibility for your Abilene business listing.", size: 15, color: UIColor(white: 0.85, alpha: 1)))
        content.addArrangedSubview(label("Monthly subscription", size: 12, color: UIColor(white: 0.65, alpha: 1)))
        let button = UIButton(type: .system)
        button.setTitle("Subscribe to " + name, for: .normal); button.tintColor = accent
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        button.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
        button.isEnabled = reviewMode
        button.addAction(UIAction { [weak self] _ in self?.selectPlan(id) }, for: .touchUpInside)
        content.addArrangedSubview(button); buttons[id] = button; cards[id] = card
        stack.addArrangedSubview(card)
    }

    private func selectPlan(_ id: String) {
        guard reviewMode || available.contains(id) else { return }
        selected = id
        for (key, card) in cards {
            let premium = key.hasSuffix(".premium.monthly")
            card.layer.borderWidth = key == selected ? 3 : 1
            card.layer.borderColor = (premium ? pink : cyan).withAlphaComponent(key == selected ? 1 : 0.45).cgColor
            buttons[key]?.setTitle((key == selected ? "Selected · " : "Subscribe to ") + (premium ? "Premium" : "Featured"), for: .normal)
        }
        guard !reviewMode, #available(iOS 16.0, *), let service = purchaseService as? AppleProductionPurchase, let product = storeProducts[id], !loading else { return }
        loading = true; buttons.values.forEach { $0.isEnabled = false }
        service.message = { [weak self] value in self?.notice.text = value }
        Task { [weak self] in
            await service.purchase(product)
            self?.loading = false
            self?.buttons.values.forEach { $0.isEnabled = true }
        }
    }

    private func recoverPurchase() {
        guard !reviewMode, !loading, #available(iOS 16.0, *), let service = purchaseService as? AppleProductionPurchase else { return }
        loading = true; buttons.values.forEach { $0.isEnabled = false }; notice.text = "Checking your purchase…"
        service.message = { [weak self] value in self?.notice.text = value }
        Task { [weak self] in
            guard let self else { return }
            defer { self.loading = false; for (id, button) in self.buttons { button.isEnabled = self.available.contains(id) } }
            do { try await service.recover() } catch { self.notice.text = "Your purchase could not be confirmed yet. Please try recovery later." }
        }
    }
    private func loadPrices() {
        guard !reviewMode, !loading else { return }
        loading = true; available.removeAll(); selected = nil
        for (id, button) in buttons {
            button.isEnabled = false
            button.setTitle("Subscribe to " + (id.hasSuffix(".premium.monthly") ? "Premium" : "Featured"), for: .normal)
            cards[id]?.layer.borderWidth = 1; prices[id]?.text = "Price unavailable"
        }
        notice.text = "Loading prices from Apple…"
        Task { [weak self] in
            guard let self else { return }
            defer { self.loading = false }
            do {
                guard #available(iOS 16.0, *), let service = self.purchaseService as? AppleProductionPurchase else { throw NSError(domain: "Subscriptions", code: 1) }
                service.message = { [weak self] value in self?.notice.text = value }
                let products = try await service.catalog()
                try await service.recover()
                self.storeProducts = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
                for product in products where ApplePromotionCatalog.products.contains(product.id) &&
                    product.type == .autoRenewable && product.subscription?.subscriptionPeriod.unit == .month &&
                    product.subscription?.subscriptionPeriod.value == 1 {
                    self.prices[product.id]?.text = product.displayPrice + "/month"
                    self.available.insert(product.id); self.buttons[product.id]?.isEnabled = true
                }
                self.notice.text = self.available.count == ApplePromotionCatalog.products.count ?
                    "Choose Featured or Premium to subscribe." :
                    "Some Apple plans are temporarily unavailable."
            } catch { self.notice.text = "Apple prices are unavailable. Please try again later." }
        }
    }
}
