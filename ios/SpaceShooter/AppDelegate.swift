import UIKit
import AVFoundation

/// 太空打飞机 · iPhone 版
///
/// 纯原生外壳 + 内嵌网页游戏：
///   玩法、画面、音效、输入全部沿用网页版（core.js / game.js），
///   App 只负责提供全屏 WebView 与 iOS 上必须的原生能力。
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

        configureAudioSession()

        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = UIColor(red: 4.0 / 255.0, green: 6.0 / 255.0, blue: 15.0 / 255.0, alpha: 1)
        window.rootViewController = GameViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    /// 音效走 playback 类别：即使手机拨到「静音」，游戏音效依然能播放。
    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch {
            NSLog("[SpaceShooter] AVAudioSession 配置失败: \(error.localizedDescription)")
        }
    }
}