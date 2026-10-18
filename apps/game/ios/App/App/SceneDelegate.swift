import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GameBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// The Capacitor bridge with a size-class orientation lock.
///
/// Info.plist declares every orientation so the iPhone Duo inner display is
/// treated as a resizable screen rather than scaled as a portrait-only app.
/// The lock itself is decided here from the trait collection, not from the
/// device model: only a regular-width, regular-height screen (the Duo inner
/// display) may rotate. Every compact iPhone screen, including the Duo outer
/// display and a Plus/Max held sideways, stays portrait. iPad keeps the
/// Info.plist set unconditionally, as before, so Split View is unaffected.
final class GameBridgeViewController: CAPBridgeViewController {
    private var allowsRotation: Bool {
        traitCollection.userInterfaceIdiom == .pad
            || (traitCollection.horizontalSizeClass == .regular && traitCollection.verticalSizeClass == .regular)
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        allowsRotation ? super.supportedInterfaceOrientations : .portrait
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if #available(iOS 17.0, *) {
            registerForTraitChanges(
                [UITraitHorizontalSizeClass.self, UITraitVerticalSizeClass.self],
                action: #selector(sizeClassDidChange)
            )
        }
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        if #available(iOS 17.0, *) { return }
        if previousTraitCollection?.horizontalSizeClass != traitCollection.horizontalSizeClass
            || previousTraitCollection?.verticalSizeClass != traitCollection.verticalSizeClass {
            sizeClassDidChange()
        }
    }

    /// Folding or unfolding a Duo swaps displays and therefore size classes;
    /// the system has to re-ask which orientations are allowed.
    @objc private func sizeClassDidChange() {
        if #available(iOS 16.0, *) {
            setNeedsUpdateOfSupportedInterfaceOrientations()
        } else {
            UIViewController.attemptRotationToDeviceOrientation()
        }
    }
}
