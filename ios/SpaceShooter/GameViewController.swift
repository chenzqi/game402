import UIKit
import WebKit

/// 承载网页版游戏的 WKWebView 容器。
///
/// 网页版已有的能力全部原样保留：Canvas 渲染、WebAudio 合成音效、触屏/手柄/键盘输入、
/// 暂停/重开/音效开关/自动开火、最高分本地保存、窗口失焦自动暂停。
///
/// 这里只补上"网页做不到、原生才能做"的几件事：
///   1. 全屏 + 隐藏状态栏 + 自动隐藏 Home 指示条（preferredScreenEdgesDeferringSystemGestures）
///   2. 竖屏锁定（竖版飞行射击）
///   3. 游戏期间保持屏幕常亮（isIdleTimerDisabled）
///   4. 关闭 WebView 的回弹、缩放、长按菜单
///   5. App 切到后台时立刻让游戏暂停
///   6. 把网页抛出的运行时报错转发到 Xcode 控制台，方便真机排查
final class GameViewController: UIViewController {

    private let messageHandlerName = "spaceShooter"
    private var webView: WKWebView!

    override var prefersStatusBarHidden: Bool { true }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }

    override func viewDidLoad() {
        super.viewDidLoad()

        let background = UIColor(red: 4.0 / 255.0, green: 6.0 / 255.0, blue: 15.0 / 255.0, alpha: 1)
        view.backgroundColor = background

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // 游戏音效由脚本按需合成，不需要用户每次点击才放行播放
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.add(self, name: messageHandlerName)

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.maximumZoomScale = 1
        webView.scrollView.minimumZoomScale = 1
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.scrollView.delaysContentTouches = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) {
            webView.isInspectable = true          // 允许用 Mac 上的 Safari 连真机调试
        }

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        loadGame()

        NotificationCenter.default.addObserver(self,
                                               selector: #selector(appWillResignActive),
                                               name: UIApplication.willResignActiveNotification,
                                               object: nil)
        NotificationCenter.default.addObserver(self,
                                               selector: #selector(appDidBecomeActive),
                                               name: UIApplication.didBecomeActiveNotification,
                                               object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIApplication.shared.isIdleTimerDisabled = true    // 玩的时候不要自动熄屏
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        UIApplication.shared.isIdleTimerDisabled = false
    }

    // MARK: - 载入内嵌游戏

    private func loadGame() {
        guard let url = Bundle.main.url(forResource: "Game", withExtension: "html"),
              let html = try? String(contentsOf: url, encoding: .utf8) else {
            NSLog("[SpaceShooter] 找不到内嵌资源 Game.html")
            return
        }
        // 用 https 作为 baseURL：让页面处于安全上下文，
        // localStorage（最高分）才能正常持久化；页面本身零外部请求，完全离线。
        let base = URL(string: "https://spaceshooter.local/")!
        webView.loadHTMLString(html, baseURL: base)
    }

    // MARK: - 生命周期：切后台自动暂停

    @objc private func appWillResignActive() {
        // 复用网页版"窗口失焦即暂停"的逻辑，保证切后台/来电后一定是暂停状态
        webView.evaluateJavaScript("window.SpaceShooterIOS && window.SpaceShooterIOS.pause();",
                                   completionHandler: nil)
    }

    @objc private func appDidBecomeActive() {
        UIApplication.shared.isIdleTimerDisabled = true
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: messageHandlerName)
    }
}

// MARK: - 网页 → 原生消息（就绪 / 报错）

extension GameViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController,
                              didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }
        switch type {
        case "ready":
            NSLog("[SpaceShooter] 网页就绪 \(body)")
        case "error":
            NSLog("[SpaceShooter] 网页运行时报错: \(body["message"] ?? "?") "
                  + "@\(body["source"] ?? "") :\(body["line"] ?? 0)")
        default:
            NSLog("[SpaceShooter] \(body)")
        }
    }
}