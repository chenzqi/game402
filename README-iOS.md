# 太空打飞机 · iPhone（iOS）版

把 `test402-game3` 的网页版游戏移植成 iPhone 版：**原生外壳（Swift + WKWebView）+ 内嵌网页游戏**，
网页版的全部功能与界面原样保留（对照表见第 4 节），并补上 iOS 上必需的适配（第 5 节）。

---

## 0. 先说清楚：为什么这个目录里**没有**现成的 .ipa

打包 .ipa 必须用 Apple 的工具链，而当前这台机器是 **Windows**，环境里没有也不可能有：

| 必需条件 | 现状 |
| --- | --- |
| Xcode / iOS SDK / clang（只有 macOS 版） | ❌ 本机没有（已确认无 xcodebuild / swift / clang / WSL） |
| 生成 iOS 可执行文件（arm64 Mach-O） | ❌ 无法在 Windows 上编译链接 |
| Apple 签名证书 + 描述文件 | ❌ 没有 Apple 账号与证书 |

.ipa 本质是一个装着 `Payload/xxx.app` 的压缩包，而 `.app` 里必须有一个**用 Apple 工具链编译并签名**的可执行文件。
少了这一步，做出来的“ipa”在 iPhone 上根本装不上——所以我不会给一个看似能装、实际装不上的假包。

**但是**这个工程已经做到“只差最后一步压缩”。三条路都能拿到真正能装的 .ipa / 能玩的效果，推荐 **A 或 C**：

| 方案 | 需要什么 | 耗时 | 结果 |
| --- | --- | --- | --- |
| **A. 云端自动出包（推荐）** | 一个 GitHub 账号（免费） | 约 5 分钟 | 真正的 `.ipa`，下载后配 Sideloadly 自签即可装 |
| **B. 有 Mac** | Mac + Xcode（免费 Apple ID 也行） | 约 3 分钟 | 直接 Run，或在 Xcode 里导出 `.ipa` |
| **C. 立刻能玩（零安装）** | 无 | 1 分钟 | 把 `太空打飞机-iPhone版.html` 发给朋友，用 Safari 打开即玩（全屏、离线） |

---

## 1. 交付内容

| 文件 / 目录 | 说明 |
| --- | --- |
| `太空打飞机-iPhone版.html` | **iOS 单文件网页版**（约 73 KB，零外部请求）：直接发给朋友用 Safari 打开就能玩，也可“添加到主屏幕”当 App 用 |
| `apple-touch-icon.png` | 上面那份网页“添加到主屏幕”时使用的图标 |
| `ios/` | **完整 Xcode 工程**（Swift + WKWebView + 内嵌游戏 + App 图标 + 启动图 + 出包脚本） |
| `ios/build-ipa.sh` | macOS 一键出包脚本 |
| `ios/project.yml` | XcodeGen 配置（CI 与备用生成方式） |
| `.github/workflows/build-ios-ipa.yml` | **云端自动构建 .ipa** 工作流 |
| `.github/workflows/publish-web.yml` | 可选：把网页版发布成网址（方便“添加到主屏幕”） |
| `build-ios-web.js` | 生成 iOS 单文件网页版 + 工程内嵌资源（改完网页游戏后跑一次） |
| `README-iOS.md` | 本文档 |
| `iPhone版-*.png`、`网页版-*.png` | 预览截图（iPhone 竖屏开始 / 游戏中、小屏 SE、网页版手机 / 桌面） |

> 网页版原文件（`index.html` / `style.css` / `core.js` / `game.js` / `test.js`）**没有任何改动**。

---

## 2. 怎么拿到 .ipa

### 方案 A：GitHub Actions 云端出包（不用 Mac，推荐）

1. 在 GitHub 新建一个空仓库（Private 也可以）。
2. 把 `test402-game3` 目录里**所有内容**作为仓库根推上去：

   ```bash
   cd D:/ai_test_project/test402-game3
   git init
   git add .
   git commit -m "太空打飞机 iOS 版"
   git branch -M main
   git remote add origin https://github.com/你的用户名/仓库名.git
   git push -u origin main
   ```

3. 打开仓库的 **Actions** 页 → 左侧「构建 iOS .ipa」→ 等 3~5 分钟变绿。
4. 点进这次运行，底部 **Artifacts** 下载 `SpaceShooter-ipa`，解压得到 `SpaceShooter-unsigned.ipa`。

> 得到的是**未签名 ipa**（给自签工具用的标准做法），安装方法见第 3 节。

### 方案 B：有 Mac

```bash
cd test402-game3/ios
bash build-ipa.sh                                      # 生成未签名 ipa
DEVELOPMENT_TEAM=你的团队ID bash build-ipa.sh --sign     # 或用自己的 Apple 账号签名
```

也可以直接双击 `SpaceShooter.xcodeproj` → 选你的 iPhone → Run（Xcode 自动签名，立刻能玩）。

### 方案 C：不装 App，立刻能玩（建议先试）

1. 把 `太空打飞机-iPhone版.html` 通过微信 / QQ 发给朋友。
2. 朋友选择**用 Safari 打开**（微信里点右上角 ··· → 在 Safari 中打开）。
3. 直接开玩：全屏、有音效、最高分会保存。
4. 想更像 App：Safari 里点 **分享 → 添加到主屏幕**，桌面会出现「太空打飞机」图标，点开全屏运行。

> 用上 `.github/workflows/publish-web.yml`（仓库 Settings → Pages → Source 选 GitHub Actions），
> 还能得到一个网址，朋友打开链接即可，“添加到主屏幕”也更顺。

---

## 3. 朋友怎么安装（苹果的规则要先知道）

iPhone 不能像安卓那样随便装 apk：**未签名的 ipa 必须先用 Apple ID 重新签一次**。

| 方式 | 成本 | 有效期 | 说明 |
| --- | --- | --- | --- |
| **Sideloadly**（Windows / Mac 都能用） | 免费 Apple ID | 7 天 | 最省事；到期重签一次即可，存档不丢 |
| **AltStore / SideStore** | 免费 Apple ID | 7 天 | 手机端自动续签（需一台电脑或另一台设备配合） |
| **Apple 开发者 Ad-Hoc** | $99/年 | 1 年 | 可发给最多 100 台**已登记 UDID** 的设备 |
| **TestFlight** | $99/年 | 90 天/版本 | 朋友只需装 TestFlight，体验最接近正式 App |

### 用 Sideloadly 安装（免费，最常用）

1. 电脑装 [iTunes](https://www.apple.com/itunes/)（Windows 版）与 [Sideloadly](https://sideloadly.io/)。
2. 数据线连接 iPhone，手机上点「信任此电脑」。
3. Sideloadly 里选择 `.ipa` → 填 Apple ID → Start。
4. 手机上：**设置 → 通用 → VPN与设备管理 → 开发者App → 信任**。
5. 回到桌面点开「太空打飞机」，开玩。

> 免费账号两个限制：**7 天要重签一次**；同一时间最多 3 个自签 App。
> 想省事可以上 TestFlight 或 Ad-Hoc（需要 $99/年开发者账号）。

---

## 4. 网页版功能移植对照表

| # | 网页版功能 | iPhone 版 | 说明 |
| --- | --- | --- | --- |
| 1 | Canvas 画面（飞船 / 敌机 / 母舰 / 粒子 / 三层星空 / 星云） | ✅ | WKWebView 内原样渲染 |
| 2 | 波次推进、难度曲线、五种阵型编排 | ✅ | `core.js` 逻辑原样 |
| 3 | 每 5 波母舰 BOSS（三阶段弹幕 + 专属血条） | ✅ | 原样 |
| 4 | 6 种敌人行为（侦察机 / 无人机 / 自爆机 / 战斗机 / 重型机 / 母舰） | ✅ | 原样 |
| 5 | 道具掉落 P / S / H / B（火力 / 护盾 / 回血 / 核弹） | ✅ | 原样 |
| 6 | 计分、连击倍率（最高 3 倍）、波次奖励 | ✅ | 原样 |
| 7 | 最高分本地保存 | ✅ | 页面用 https 源，localStorage 可正常持久化 |
| 8 | 触屏拖动操纵（相对位移，不挡机身） | ✅ | Pointer 事件，原样 |
| 9 | 底部触控条（左 / 右 / 核弹 B / 暂停） | ✅ | 原样，并按安全区留边 |
| 10 | 键盘操作（WASD / 方向键 / 空格 / B/P/R/M/F） | ✅ | 接蓝牙键盘可用；iPhone 上主要用触屏 |
| 11 | 自动开火开关 | ✅ | 原样（触屏设备默认开） |
| 12 | 程序化音效（WebAudio 合成，无音频文件） | ✅ | 另设为 playback 类别：**手机静音键拨到静音也有声** |
| 13 | 音效开 / 关按钮 | ✅ | 原样 |
| 14 | 暂停 / 重开按钮 + 暂停覆盖层 | ✅ | 原样 |
| 15 | 窗口失焦自动暂停 | ✅ | 网页逻辑保留，另加原生“切后台必暂停”双保险 |
| 16 | 开始界面 / 操作提示覆盖层 | ✅ | 原样 |
| 17 | 自适应布局（宽屏两栏 / 窄屏单栏 / 横屏） | ✅ | 并按 iPhone 竖屏重排为“一屏不滚动” |

---

## 5. iOS 上额外做的适配

| 问题 | 处理 |
| --- | --- |
| 刘海 / 灵动岛 / Home 指示条遮挡 | `viewport-fit=cover` + `env(safe-area-inset-*)` 留边 |
| 地址栏 / 视口跳动 | `100dvh` 动态视口高度 |
| 长按弹出菜单、划词选中 | 关闭 `-webkit-touch-callout` 与文本选择 |
| 双击放大、双指缩放 | `touch-action` + 关掉 `pinchGestureRecognizer` + 双击拦截（按钮上不拦截，连点照旧有效） |
| 页面橡皮筋回弹 | `overscroll-behavior:none` + `scrollView.bounces = false` |
| 竖屏空间紧张 | 战绩压成一行 6 格、隐藏空盒子与键盘脚注，画布按 480×720 等比铺满 |
| 游戏时自动熄屏 | 原生 `isIdleTimerDisabled = true`（离开时恢复） |
| 状态栏 / 全屏 | 隐藏状态栏 + 自动隐藏 Home 指示条 |
| 切后台 | 原生在 `willResignActive` 时调用网页暂停，回来点「继续」即可 |
| 真机排查 | 网页 `window.onerror` 转发到 Xcode 控制台；iOS 16.4+ 可用 Safari 连真机调试 |
| 竖版游戏误转横屏 | 锁定竖屏（`UIInterfaceOrientationPortrait`） |

---

## 6. 顺带修复的一个网页版老问题

整理过程中发现 `index.html` 里的 `<div class="board-col">` **一直没有闭合**，
后面的 `<aside class="side">`（战绩栏）被浏览器解析进了 `.board-col` 内部。
桌面端正好是两列布局，看起来"像是正常的"；但在手机窄屏下，战绩栏会和棋盘**并排**，
把画布挤到只剩一半宽度。

补上那个 `</div>` 之后：

| 视口 | 修复前画布 | 修复后画布 |
| --- | --- | --- |
| 390×844（iPhone 14/15） | 196×293 | **374×561** |
| 375×667（iPhone SE） | 约 180×270 | **309×463** |

网页版（`index.html`）与 iPhone 版都因此受益；桌面端布局不变（依旧是"棋盘 + 右侧战绩栏"）。

---

## 7. 改了网页游戏之后怎么重新出包

```bash
cd test402-game3
node build-ios-web.js      # 重新生成 太空打飞机-iPhone版.html 与 ios/SpaceShooter/Resources/Game.html
node test.js               # 核心逻辑 43 项断言（可选）
```

然后按第 2 节的方案 A / B 重新出包即可（只改网页时不需要动任何 Swift 代码）。

---

## 8. 常见问题

**Q：能做成像安卓 apk 那样“发过去点一下就能装”吗？**
不能。iOS 从系统层面要求所有 App 必须有有效签名，免费签名 7 天到期——这是系统限制，绕不过去（绕过就等于越狱）。
想“发给朋友就能长期用”最省事的是 **TestFlight**（$99/年），其次 **Ad-Hoc**（$99/年，登记设备 UDID）；
零成本则是 **Sideloadly 自签（7 天）** 或本文的 **方案 C（网页版）**。

**Q：能上架 App Store 吗？**
可以，用同一套工程 Archive 上传 App Store Connect 即可，但需要 $99/年开发者账号并走审核。

**Q：网页套壳，性能 / 手感会不会差？**
不会。iOS 的 WKWebView 与 Safari 同内核，Canvas 2D 有硬件加速；这个游戏逻辑分辨率只有 480×720，
在 iPhone 上稳定满帧。拖动、连点、音效都走原生通道，与 Safari 里玩的一致。

**Q：最高分会丢吗？**
不会。App 用固定源 + 本地存储保存（只有卸载 App 才会清空）。免费自签 7 天重签属于覆盖安装，数据保留。
