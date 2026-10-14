# 太空打飞机 · iOS 工程说明

这是一个**完整的 Xcode 工程**：原生外壳（Swift + WKWebView） + 内嵌网页版游戏。
网页版的玩法、画面、音效、输入**一行未改**地跑在里面，App 只负责提供 iPhone 上必需的
全屏容器与原生能力（详见 `../README-iOS.md` 的移植对照表）。

## 目录

| 路径 | 说明 |
| --- | --- |
| `SpaceShooter.xcodeproj` | 可直接用 Xcode 打开（手写工程文件，已做结构校验） |
| `project.yml` | XcodeGen 配置；`xcodegen generate` 可重新生成工程（CI 用这个） |
| `SpaceShooter/AppDelegate.swift` | 启动、音频会话（静音键下也能出声） |
| `SpaceShooter/GameViewController.swift` | WKWebView 容器：全屏、竖屏锁、屏幕常亮、切后台自动暂停、报错转发 |
| `SpaceShooter/Resources/Game.html` | 内嵌游戏（由 `../build-ios-web.js` 生成，单文件零外部请求） |
| `SpaceShooter/Info.plist` | 包名 com.tetris.spaceshooter / 竖屏 / 隐藏状态栏 / 深色 |
| `SpaceShooter/Assets.xcassets` | App 图标（1024×1024）、强调色 |
| `SpaceShooter/LaunchScreen.storyboard` | 启动图（深空背景 + 标题） |
| `web/ios-adapt.css`、`web/ios-shim.js` | iOS 适配层源码（会被内联进 Game.html） |
| `web/apple-touch-icon.png` | 网页版「添加到主屏幕」用的图标 |
| `build-ipa.sh` | macOS 一键出包脚本 |

## 在 Mac 上构建

```bash
cd ios
bash build-ipa.sh                                   # 未签名 ipa（推荐，配 Sideloadly 自签）
DEVELOPMENT_TEAM=你的团队ID bash build-ipa.sh --sign   # 用你的 Apple 账号签名
```

产物：`ios/build/太空打飞机.ipa`

也可以直接双击 `SpaceShooter.xcodeproj`，选真机 → Run（Xcode 会自动签名并安装）。

## 改了网页游戏之后

```bash
node build-ios-web.js     # 在上一层目录执行：重新生成 Game.html 与 太空打飞机-iPhone版.html
```

然后再重新构建 App 即可。

## 工程关键设置

| 项 | 值 |
| --- | --- |
| Bundle ID | `com.tetris.spaceshooter`（想和朋友区分开可自行修改） |
| 最低系统 | iOS 13.0 |
| 设备 | 仅 iPhone（`TARGETED_DEVICE_FAMILY = 1`） |
| 方向 | 仅竖屏 |
| 版本 | 1.0 (1) |
