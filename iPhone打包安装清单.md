# 太空打飞机 · iPhone 版：打包 / 安装分工清单

> 目标：在 `test402-game3` 目录里拿到能装到 iPhone 的 `.ipa`，装到手机上能玩。

## 0. 一句话结论

- iOS 的编译必须用苹果工具链，**这台 Windows 电脑上做不了**（不是配置问题，是苹果的限制）。
- 本目录里已经有完整的 iOS 工程 + 云端流水线，**编译已经在 GitHub 云端跑通**（macOS 机器上编的）。
- 你这边**不需要 Mac**，只需要：Windows 电脑 + 数据线 + 一个 Apple ID。
- `.ipa` 是「未签名包」，装进手机前必须用你的 Apple ID 签一次名。**这一步只能你本人做**（要用到你的账号密码，不该交给我）。

## 1. 现在的状态（已实测，不是猜的）

| 项目 | 状态 |
| --- | --- |
| 网页版游戏（`index.html` / `core.js` / `game.js` …） | 正常，43 项逻辑断言全部通过 |
| iOS 工程 `ios/`（Swift + WKWebView + 内嵌游戏 + 图标 + 启动图） | 完整，可编译 |
| 云端流水线 `.github/workflows/build-ios-ipa.yml` | 原本构建失败，**已修复并构建成功** |
| 本机（这台 Windows） | 无 macOS / 无 Xcode → **无法在本机编译 iOS** |
| 本机 git 推送 | 正常（我可以直接改仓库、触发云端构建） |

## 2. 三条路线，选一条就够

| 路线 | 你需要什么 | 耗时 | 结果 |
| --- | --- | --- | --- |
| **A. 云端出 .ipa + Sideloadly 自签（推荐，0 元）** | Windows 电脑 + 数据线 + 免费 Apple ID | 首次约 15 分钟 | 手机上真 App 图标；**签名 7 天后过期，重签即可，存档保留** |
| **B. 付费开发者账号（99 美元/年）** | 路线 A 的全部 + 注册账号 | 首次几小时（苹果审核） | 签名 1 年有效；可用 TestFlight 发给朋友；可上架 App Store |
| **C. 网页版「添加到主屏幕」（0 成本，马上能用）** | 只要手机 | 1 分钟 | 全屏、离线可玩，永远不过期；但不是「真 App」 |

A 和 C 不冲突：**建议先做 C 马上玩上，再按 A 做成真 App。**
## 3. 分工清单

### 3.1 我做的（✅ 已完成）

| # | 事情 | 结果 |
| --- | --- | --- |
| 1 | 排查云端打包为什么失败（原构建步骤以 `exit 74` 失败，日志要登录才能看） | 已定位并重写流水线：改到 `macos-15` 运行器，先用手写工程构建，失败自动用 XcodeGen 重新生成工程再试，失败时把真实报错输出到构建页面 |
| 2 | 云端编译 iOS 工程 | ✅ 成功，产出 `SpaceShooter.app`（arm64） |
| 3 | 打包成 `.ipa` | ✅ `SpaceShooter-unsigned.ipa` |
| 4 | 把 .ipa 发布成公开直链 | ✅ GitHub Releases（Artifacts 必须登录才能下，Releases 不用） |
| 5 | 把 .ipa 下载到本目录 | ✅ `SpaceShooter-unsigned.ipa` |
| 6 | 一键取包脚本 | ✅ `fetch-ipa.ps1`（以后重新构建后，跑一次就能把最新 .ipa 拉回本目录） |
| 7 | 顺手修网页版流水线 | ✅ 原来因为仓库没开 Pages 而报红，现在改成开关控制（要发布网页版时告诉我，或按第 6 节操作） |

### 3.2 你要做的（按顺序，A 路线）

| # | 事情 | 在哪做 | 大概耗时 |
| --- | --- | --- | --- |
| 1 | （可选，先玩上）手机 Safari 打开网页版 → 添加到主屏幕 | iPhone | 1 分钟 |
| 2 | 电脑装苹果驱动（Apple Devices 或 iTunes）+ Sideloadly | Windows | 5 分钟 |
| 3 | 手机连电脑，点「信任此电脑」 | Windows + iPhone | 1 分钟 |
| 4 | 打开 Sideloadly：选 .ipa、填 Apple ID、点 Start | Windows | 3 分钟 |
| 5 | 手机上「设置 → 通用 → VPN 与设备管理」信任证书 | iPhone | 1 分钟 |
| 6 | 7 天后重签一次（重复第 4~5 步） | Windows | 3 分钟 |
## 4. 你要做的每一步，具体怎么点

### 第 1 步（可选）：网页版马上玩上 —— 路线 C

1. 把本目录的 `太空打飞机-iPhone版.html` 发到手机（微信/QQ 传给自己都行）。
2. 手机上**不要**用微信内置浏览器打开，选「用其他应用打开 → Safari」。
3. Safari 里点底部「分享」→「添加到主屏幕」→ 添加。
4. 主屏上就有了全屏图标，断网也能玩。

### 第 2 步：电脑装驱动和签名工具

1. **苹果驱动（必须先装）**：到苹果官网下载安装 `iTunes`（选「Windows 版」，**不要** Microsoft Store 版本），或安装苹果的 `Apple Devices` 应用。作用是让电脑认出 iPhone。
2. **Sideloadly**：打开 https://sideloadly.io/ ，下载 Windows 版并安装。
3. 建议**准备一个专门的小号 Apple ID**（新注册一个也行），因为签名工具要用一次你的 Apple ID 密码。

### 第 3 步：手机连电脑

1. 用**数据线**（不是只能充电的线）把 iPhone 连到电脑。
2. 手机会弹「要信任此电脑吗？」→ 点「信任」，再输手机密码。
3. 如果之前点过「不信任」，手机上：「设置 → 通用 → 传输或还原 iPhone → 还原 → 还原位置与隐私」，然后重新插线。

### 第 4 步：用 Sideloadly 签名安装

> 📖 **详细图文步骤（含每一步的界面示意图）**见：双击打开 `iPhone自签图文教程.html`，或看 `iPhone免费自签图文教程.md`；里面有免费账号的 3 个 App 上限、开发者模式、报错速查表等全部细节。

1. 打开 Sideloadly。
2. 左上角 **Apple ID** 填你的 Apple ID（小号）。
3. 中间 **IPA** 框：点一下选文件，选这个：
   `D:\ai_test_project\test402-game3\SpaceShooter-unsigned.ipa`
   （也可以直接把 .ipa 文件拖进 Sideloadly 窗口）
4. **Device** 下拉框里选你的 iPhone（看不到设备就按第 5 节的排查）。
5. 点 **Start**。
6. 会提示输入 Apple ID 密码 → 填**正常密码**；如果开了双重认证，再填手机收到的 6 位验证码。
   （⚠️ 免费账号**不要**用「App 专用密码」，官方 FAQ 明确说它只对付费账号 + 关闭 anisette 时有效，免费账号用了会登录失败。）
7. 等到进度条走完显示 `Done`，手机上就会出现「太空打飞机」图标（这时还打不开）。

### 第 5 步：手机上信任证书（不信任就会闪退/打不开）

1. iPhone：「设置 → 通用 → VPN 与设备管理」。
2. 在「开发者 App」里点你的 Apple ID → 点「信任 <你的 Apple ID>」→ 再点一次「信任」。
3. 回主屏，点开游戏即可玩。

### 第 6 步：7 天到期怎么办

- 免费 Apple ID 签的 App 只有 7 天有效期（苹果的限制）。到期点开会提示「无法验证 App」。
- 解决：电脑上重开 Sideloadly，**重复第 4~5 步**即可。
- 注意：重签时**不要在手机上先删掉 App**（覆盖安装一般能保留最高分，删掉就等于清空存档）。
- 想省事就走路线 B（99 美元/年），签名 1 年有效。
## 5. 常见问题

**Q：能不能像安卓 apk 那样，我发个文件给朋友就能装？**
不能。iOS 强制要求每个 App 都有签名，免费账号的签名还绑定设备、7 天过期 —— 这是系统限制，绕不过去。给朋友的零成本办法是路线 C（网页版加主屏幕）；要正式分发就用路线 B（TestFlight）。

**Q：Sideloadly 里看不到我的 iPhone？**
1. 确认线是**数据线**（能传数据的），并且直插电脑 USB 口，别走扩展坞；
2. 确认电脑装了苹果驱动（`Apple Devices` 或官网版 `iTunes`）；
3. 手机上重新插拔一次并点「信任」；
4. 电脑上装的是 Microsoft Store 版 iTunes 的话，换成苹果官网版。

**Q：签名时提示 Apple ID 或密码错误？**
1. 先确认密码没输错、账号没被锁定（去 appleid.apple.com 登录一次验证）；
2. 开了双重认证的账号：填正常密码 + 手机收到的 6 位验证码（**免费账号不要用 App 专用密码**，官方明确说明它只对付费账号有效）；
3. 中国大陆的 Apple ID 偶尔会抽风，换个网络或换个 Apple ID 再试。

**Q：装的时候报错 "Unable to install ... maximum number of apps"？**
免费 Apple ID 同时最多只能装 3 个自签 App，7 天内能注册的 App ID 也有限。删掉其它自签的 App 再试。

**Q：这样装安全吗？会不会影响手机保修？**
不越狱、不改系统，只是安装了一个用开发者证书签名的 App，随时可以从手机上删除，不影响保修。唯一的风险是：签名工具会用到你的 Apple ID 密码，所以要**用小号，不要用主账号**。

**Q：游戏最高分会丢吗？**
最高分存在 App 本地。**只要不卸载 App，重签覆盖安装一般都能保留**；一旦删掉 App 就会被清空。

## 6. 改了游戏之后，怎么重新出包

在本目录跑：

```powershell
node build-ios-web.js    # 重新生成内嵌游戏页（改完 game.js / style.css 后必跑）
node test.js             # 可选：跑 43 项逻辑断言
git add -A
git commit -m "更新游戏"
git push
```

推上去后 GitHub 云端会自动重新编译打包，**下载直链保持不变**：

```
https://github.com/chenzqi/game402/releases/download/ios-ipa-latest/SpaceShooter-unsigned.ipa
```

你也可以在本目录跑一次脚本把最新 .ipa 拉回来（覆盖旧的）：

```powershell
powershell -ExecutionPolicy Bypass -File .\fetch-ipa.ps1 -Token ghp_你的GitHub令牌
```

（这个脚本只是省事；不想用令牌的话，直接点上面的直链下载，把文件覆盖到本目录同名文件即可。）

## 7. 相关链接

| 用途 | 链接 |
| --- | --- |
| 构建记录 | https://github.com/chenzqi/game402/actions |
| .ipa 直链（不用登录） | https://github.com/chenzqi/game402/releases/download/ios-ipa-latest/SpaceShooter-unsigned.ipa |
| 版本发布页 | https://github.com/chenzqi/game402/releases |
| 签名工具 | https://sideloadly.io/ |
## 8. 本目录这份 .ipa 的校验信息（已实测核对）

| 项目 | 值 |
| --- | --- |
| 文件 | `SpaceShooter-unsigned.ipa`（**已经在本目录里**） |
| 大小 | 257241 字节 |
| SHA-256 | `00da3976e1aed2584edf7a49f1a17e66950c39ba5c7c563c74a7158130a18cf7` |
| 内嵌游戏 | 与仓库里的 `太空打飞机-iPhone版.html` **逐字节一致**（75870 字节） |
| 可执行文件 | arm64 Mach-O（真机架构），最低系统 iOS 13.0 |
| 签名状态 | 未签名（由 Sideloadly 用你的 Apple ID 现场签） |

> 说明：每次云端重新构建，zip 内部时间戳会变，哈希也会跟着变。上表是本目录这一份的值；
> 以后重新下载时，**以 Releases 页面说明里写的 SHA-256 为准**（构建脚本会自动写进去）。

自己核对一下（PowerShell）：

```powershell
Get-FileHash .\SpaceShooter-unsigned.ipa -Algorithm SHA256
```

### 关于下载：国内访问 github.com 可能不稳定

本机实测：`api.github.com` 稳定，但 `github.com` 的 HTTPS 会间歇性超时（国内网络常见）。所以：

- **本目录已经有包了**，正常情况下你不需要再下载。
- 需要重新下载时，优先用上面的官方直链；如果打不开，用这个镜像地址下载同一个文件，然后用上面的 SHA-256 比对确认没被改动：

```
https://ghfast.top/https://github.com/chenzqi/game402/releases/download/ios-ipa-latest/SpaceShooter-unsigned.ipa
```

- 或者本目录跑 `fetch-ipa.ps1`（它走 `api.github.com`，本机实测可用）：

```powershell
powershell -ExecutionPolicy Bypass -File .\fetch-ipa.ps1 -Token ghp_你的GitHub令牌
```