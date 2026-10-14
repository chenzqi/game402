'use strict';
/* ============================================================================
 * build-ios-web.js —— 生成"iPhone 版"单文件网页
 *   把 index.html + style.css + ios-adapt.css + core.js + game.js + ios-shim.js
 *   内联成一个自包含 HTML（零外部引用，可离线），输出两份：
 *     · 太空打飞机-iPhone版.html          （可直接发微信 / Safari 打开 / 添加到主屏幕）
 *     · ios/SpaceShooter/Resources/Game.html （Xcode 工程内嵌资源，App 启动时加载）
 *   用法：node build-ios-web.js
 * ==========================================================================*/
const fs = require('fs');
const path = require('path');

const dir = __dirname;
/* 读文件并去掉 UTF-8 BOM —— BOM 若被内联进 <style> 会让 :root{--var} 规则失效 */
const read = f => fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '');

const web = read('index.html');
const style = read('style.css');
const iosCss = read('ios/web/ios-adapt.css');
const core = read('core.js');
const game = read('game.js');
const shim = read('ios/web/ios-shim.js');

const bad = [];
for (const [name, text] of [['style.css', style], ['ios-adapt.css', iosCss]]) {
  if (/<\/style/i.test(text)) bad.push(name + ' 含 </style，无法安全内联');
}
for (const [name, text] of [['core.js', core], ['game.js', game], ['ios-shim.js', shim]]) {
  if (/<\/script/i.test(text)) bad.push(name + ' 含 </script，无法安全内联');
}
if (bad.length) { console.error('自检失败：\n  - ' + bad.join('\n  - ')); process.exit(1); }

let html = web;

/* ---- 1. viewport：加 viewport-fit=cover（刘海/灵动岛/Home 指示条） ---- */
const OLD_VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />';
const NEW_VIEWPORT = [
  '<!-- iOS 适配：viewport-fit=cover 让内容延伸到刘海/Home 指示条区域，再用 env(safe-area-inset-*) 留边 -->',
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />',
  '<meta name="theme-color" content="#04060f" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="太空打飞机" />',
  '<meta name="format-detection" content="telephone=no" />',
  '<link rel="apple-touch-icon" href="apple-touch-icon.png" />'
].join('\n');
if (html.split(OLD_VIEWPORT).length - 1 !== 1) { console.error('index.html 未找到预期 viewport 标签'); process.exit(1); }
html = html.replace(OLD_VIEWPORT, NEW_VIEWPORT);

/* ---- 2. 内联样式（原样式 + iOS 适配层） ---- */
const cssLink = '<link rel="stylesheet" href="style.css" />';
if (html.split(cssLink).length - 1 !== 1) { console.error('index.html 未找到 style.css 引用'); process.exit(1); }
html = html.replace(cssLink, '<style>\n' + style + '\n\n' + iosCss + '\n</style>');

/* ---- 3. 内联脚本（core.js + game.js + iOS 适配脚本） ---- */
const scripts = '<script src="core.js"></script>\n<script src="game.js"></script>';
if (html.split(scripts).length - 1 !== 1) { console.error('index.html 未找到 core.js/game.js 引用'); process.exit(1); }
html = html.replace(scripts, '<script>\n' + core + '\n</script>\n<script>\n' + game + '\n</script>\n<script>\n' + shim + '\n</script>');

/* ---- 4. 自检：单文件、无外部引用、无 BOM ---- */
/* apple-touch-icon 只是「添加到主屏幕」的图标提示，运行时不依赖它，予以放行 */
const htmlNoIcon = html.replace(/<link rel="apple-touch-icon"[^>]*>/gi, '');
if (/<link[^>]+href="(?!data:)/i.test(htmlNoIcon)) bad.push('仍存在外部样式引用');
if (/<script[^>]+src=/i.test(html)) bad.push('仍存在外部脚本引用');
if (/<img[^>]+src="(?!data:)/i.test(html)) bad.push('仍存在外部图片引用');
if (/url\((?!['"]?data:)/i.test(style + iosCss)) bad.push('CSS 中存在外部资源');
if (html.indexOf('\uFEFF') !== -1) bad.push('输出混入 BOM 字符 (U+FEFF)');
if (!/:root\s*\{/.test(style)) bad.push('CSS 变量根规则 :root 缺失');
if (!/var\(--/.test(style)) bad.push('CSS 变量引用缺失');
/* 关键功能标记必须在场（防止内联时丢东西） */
const marks = ['SpaceCore', 'togglePause', 'startGame', 'ios-adapt', 'SpaceShooterIOS', 'safe-area-inset-top'];
if (html.indexOf('SpaceCore') === -1) bad.push('core.js 未内联');
if (html.indexOf('togglePause') === -1) bad.push('game.js 未内联');
if (html.indexOf('SpaceShooterIOS') === -1) bad.push('ios-shim.js 未内联');
if (html.indexOf('env(safe-area-inset-top)') === -1) bad.push('iOS 安全区样式未内联');

const outA = path.join(dir, '太空打飞机-iPhone版.html');
const outB = path.join(dir, 'ios', 'SpaceShooter', 'Resources', 'Game.html');
fs.writeFileSync(outA, html, 'utf8');
fs.mkdirSync(path.dirname(outB), { recursive: true });
fs.writeFileSync(outB, html, 'utf8');

console.log('源文件：index.html / style.css / ios/web/ios-adapt.css / core.js / game.js / ios/web/ios-shim.js');
console.log('输出  ：太空打飞机-iPhone版.html       （' + (Buffer.byteLength(html) / 1024).toFixed(1) + ' KB）');
console.log('        ios/SpaceShooter/Resources/Game.html （同一份，供 Xcode 内嵌）');
if (bad.length) { console.error('自检未通过：\n  - ' + bad.join('\n  - ')); process.exit(1); }
console.log('自检通过：单文件、无外部引用、无 BOM，可离线运行 ' + '\u2705');
