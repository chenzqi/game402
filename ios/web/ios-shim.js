/* ==========================================================================
   太空打飞机 · iOS 适配脚本（浏览器 / WKWebView 通用）
   --------------------------------------------------------------------------
   职责：把"桌面浏览器的网页"补成"iPhone App 里的网页"，不碰任何玩法逻辑。
     1. 原生桥：把页面就绪 / 运行时报错回传给 Swift（方便 Xcode 控制台排查）
     2. 切到后台自动暂停（等价于网页版"窗口失焦自动暂停"的行为）
     3. 屏蔽双击缩放、双指缩放、长按菜单等 iOS 上的误操作
     4. 暴露 window.SpaceShooterIOS，供原生侧调用 pause()/resume()
   ========================================================================== */
(function () {
  'use strict';

  var HANDLER = 'spaceShooter';
  var native = (window.webkit && window.webkit.messageHandlers &&
                window.webkit.messageHandlers[HANDLER]) || null;

  function post(msg) {
    if (!native) return;
    try { native.postMessage(msg); } catch (e) { /* 忽略 */ }
  }

  /* ---- 1. 运行时报错回传原生（真机调试用） ---- */
  window.addEventListener('error', function (e) {
    post({ type: 'error', message: String(e.message), source: String(e.filename || ''),
           line: e.lineno || 0, col: e.colno || 0 });
  });
  window.addEventListener('unhandledrejection', function (e) {
    post({ type: 'error', message: 'unhandledrejection: ' + String(e.reason) });
  });

  /* ---- 2. 切后台自动暂停 ----
     游戏自身监听 window 的 blur 来做"失焦暂停"，这里在页面隐藏时补发一次，
     保证 App 切到后台 / 来电话后一定处于暂停状态。 */
  function pauseByBlur() {
    try { window.dispatchEvent(new Event('blur')); } catch (e) { /* 忽略 */ }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') pauseByBlur();
    else post({ type: 'foreground' });
  });

  /* ---- 3. iOS 误操作屏蔽 ---- */
  /* 双指缩放 */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  /* 双击缩放：只在空白处拦截，按钮/画布上的连点照常生效 */
  var lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 320) {
      var t = e.target;
      var interactive = t && t.closest && t.closest('button,input,label,canvas,a');
      if (!interactive) e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
  /* 长按弹出菜单 / 划词选择 */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('selectstart', function (e) { e.preventDefault(); });

  /* 页面被拖动时不让整页跟着滚（画布与按钮自己处理手势） */
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  /* ---- 4. 对外接口 ---- */
  window.SpaceShooterIOS = {
    version: '1.0',
    isNative: !!native,
    /* 原生侧在 App 进入后台时调用，等价于网页版的失焦暂停 */
    pause: pauseByBlur,
    /* 启动完成通知原生（原生据此开启屏幕常亮等） */
    ready: function () { post({ type: 'ready', dpr: window.devicePixelRatio || 1,
                                w: window.innerWidth, h: window.innerHeight }); }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    window.SpaceShooterIOS.ready();
  } else {
    document.addEventListener('DOMContentLoaded', function () { window.SpaceShooterIOS.ready(); });
  }
})();