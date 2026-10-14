/* ============================================================================
 *  game.js —— 太空打飞机 · 主程序（渲染 / 输入 / 音效 / 游戏循环）
 *  依赖 core.js（window.SpaceCore）
 * ==========================================================================*/
(function () {
  'use strict';

  var C = window.SpaceCore;

  /* ============================== 常量 ============================== */
  var W = 480, H = 720;                       // 逻辑分辨率
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  var PLAYER = {
    r: 12,
    speed: 360,
    maxSpeed: 620,
    fireCooldown: 0.11,
    respawnInvuln: 2.2,
    startLives: 3,
    startBombs: 2,
    maxLives: 5,
    maxBombs: 5
  };

  var BULLET = { speed: 660, r: 4.5, dmg: 1 };
  var MAX_PARTICLES = 700;
  var MAX_FLOATS = 24;

  /* ============================== 画布 ============================== */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var wrap = document.getElementById('boardWrap');
  var col = document.getElementById('boardCol');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ovTitle');
  var ovText = document.getElementById('ovText');
  var ovKeys = document.getElementById('ovKeys');
  var ovBtn = document.getElementById('ovBtn');
  var ovTiny = document.getElementById('ovTiny');
  var btnPause = document.getElementById('btnPause');

  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  function fitCanvas() {
    var availW = Math.max(260, col.clientWidth - 18);
    var availH = Math.max(360, window.innerHeight - 200);
    var scale = Math.min(availW / W, availH / H, 1);
    canvas.style.width = Math.round(W * scale) + 'px';
    canvas.style.height = Math.round(H * scale) + 'px';
  }
  window.addEventListener('resize', fitCanvas);

  function toLogical(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height)
    };
  }

  /* ============================== 音效 ============================== */
  var Sound = {
    ctx: null,
    enabled: true,
    master: null,
    noiseBuf: null,

    init: function () {
      if (this.ctx) { this.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      try {
        this.ctx = new AC();
      } catch (err) { this.enabled = false; return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);

      var len = Math.floor(this.ctx.sampleRate * 0.7);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    },

    resume: function () {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    tone: function (o) {
      if (!this.enabled || !this.ctx) return;
      var t = this.ctx.currentTime;
      var osc = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.f0, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + o.dur + 0.03);
    },

    noise: function (o) {
      if (!this.enabled || !this.ctx || !this.noiseBuf) return;
      var t = this.ctx.currentTime;
      var src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      var filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(o.f0 || 1800, t);
      filt.frequency.exponentialRampToValueAtTime(Math.max(60, o.f1 || 180), t + o.dur);
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(o.vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start(t);
      src.stop(t + o.dur + 0.02);
    },

    shoot: function () { this.tone({ type: 'square', f0: 900, f1: 420, dur: 0.07, vol: 0.045 }); },
    hit: function () { this.tone({ type: 'square', f0: 340, f1: 200, dur: 0.05, vol: 0.06 }); },
    explode: function () { this.noise({ f0: 2200, f1: 160, dur: 0.34, vol: 0.3 }); this.tone({ type: 'sine', f0: 190, f1: 45, dur: 0.32, vol: 0.16 }); },
    bigExplode: function () { this.noise({ f0: 2600, f1: 90, dur: 0.85, vol: 0.42 }); this.tone({ type: 'sawtooth', f0: 130, f1: 32, dur: 0.8, vol: 0.22 }); },
    power: function () { this.tone({ type: 'sine', f0: 520, f1: 1180, dur: 0.2, vol: 0.18 }); },
    hurt: function () { this.tone({ type: 'sawtooth', f0: 320, f1: 70, dur: 0.4, vol: 0.22 }); this.noise({ f0: 1200, f1: 120, dur: 0.4, vol: 0.25 }); },
    bomb: function () { this.noise({ f0: 3000, f1: 70, dur: 0.9, vol: 0.45 }); this.tone({ type: 'sine', f0: 90, f1: 28, dur: 0.9, vol: 0.25 }); },
    warn: function () { this.tone({ type: 'sawtooth', f0: 220, f1: 150, dur: 0.35, vol: 0.16 }); },
    over: function () { this.tone({ type: 'sawtooth', f0: 400, f1: 60, dur: 1.1, vol: 0.24 }); }
  };
  /* ============================== 状态 ============================== */
  var rng = C.mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);

  var G = {
    mode: 'ready',
    time: 0,
    score: 0,
    high: 0,
    kills: 0,
    lives: PLAYER.startLives,
    bombs: PLAYER.startBombs,
    weapon: 1,
    wave: 0,
    combo: 0,
    comboTimer: 0,
    player: null,
    bullets: [],
    enemies: [],
    ebullets: [],
    powers: [],
    particles: [],
    floats: [],
    stars: [],
    nebulas: [],
    spawnQueue: [],
    waveTime: 0,
    waveState: 'idle',
    waveGap: 0,
    pendingBoss: null,
    boss: null,
    shake: 0,
    flash: 0,
    flashColor: '255,255,255',
    banner: null,
    autoFire: true
  };

  var keys = Object.create(null);
  var pointer = { active: false, tx: 0, ty: 0, ox: 0, oy: 0, relative: false };
  var touchMove = { left: false, right: false };

  /* ============================ 最高分存档 ============================ */
  var HS_KEY = 'space-shooter.high.v1';
  try { G.high = parseInt(window.localStorage.getItem(HS_KEY), 10) || 0; } catch (e) { G.high = 0; }
  function saveHigh() {
    try { window.localStorage.setItem(HS_KEY, String(G.high)); } catch (e) { /* 忽略隐私模式 */ }
  }

  /* ============================== 工具 ============================== */
  function rand(a, b) { return a + rng() * (b - a); }

  function shake(amount, color) {
    G.shake = Math.min(26, G.shake + amount);
    if (color) { G.flash = Math.min(0.85, G.flash + 0.28); G.flashColor = color; }
  }

  function showBanner(text, sub, dur, warn) {
    G.banner = { text: text, sub: sub || '', t: 0, dur: dur || 1.8, warn: !!warn };
  }

  function floatText(x, y, text, color) {
    if (G.floats.length > MAX_FLOATS) G.floats.shift();
    G.floats.push({ x: x, y: y, text: text, color: color || '#e8eefb', life: 0.9, max: 0.9 });
  }

  function addScore(base, x, y, color) {
    var mult = C.comboMultiplier(G.combo);
    var gain = Math.round(base * mult);
    G.score += gain;
    if (x !== undefined) {
      floatText(x, y, '+' + gain + (mult > 1.01 ? ' ×' + mult.toFixed(1) : ''), color || '#fde68a');
    }
    if (G.score > G.high) { G.high = G.score; saveHigh(); }
    return gain;
  }

  /* ============================== 粒子 ============================== */
  function particle(x, y, vx, vy, life, color, size, kind) {
    if (G.particles.length >= MAX_PARTICLES) G.particles.shift();
    G.particles.push({
      x: x, y: y, vx: vx, vy: vy,
      life: life, max: life, color: color, size: size, kind: kind || 'spark'
    });
  }

  function explode(x, y, color, count, power, big) {
    for (var i = 0; i < count; i++) {
      var a = rng() * Math.PI * 2;
      var sp = rand(40, 260) * power;
      particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        rand(0.25, 0.7) * power, rng() < 0.32 ? '#ffffff' : color,
        rand(1.4, 3.6) * power, 'spark');
    }
    for (var k = 0; k < Math.round(count * 0.35); k++) {
      var a2 = rng() * Math.PI * 2;
      var sp2 = rand(10, 70) * power;
      particle(x, y, Math.cos(a2) * sp2, Math.sin(a2) * sp2 - 20,
        rand(0.5, 1.1), 'rgba(150,160,190,0.55)', rand(3, 8) * power, 'smoke');
    }
    particle(x, y, 0, 0, big ? 0.5 : 0.3, color, 6 * power, 'ring');
  }

  /* ============================== 玩家 ============================== */
  function makePlayer() {
    return {
      x: W / 2, y: H - 90, vx: 0, vy: 0, r: PLAYER.r,
      cooldown: 0, invuln: PLAYER.respawnInvuln, shield: 0, alive: true, t: 0
    };
  }

  function updatePlayer(dt) {
    var p = G.player;
    if (!p || !p.alive) return;
    p.t += dt;

    if (pointer.active) {
      var dx = pointer.tx - p.x, dy = pointer.ty - p.y;
      var d = Math.hypot(dx, dy);
      if (d > 1) {
        var sp = Math.min(PLAYER.maxSpeed, d * 14);
        p.vx = (dx / d) * sp;
        p.vy = (dy / d) * sp;
      } else { p.vx *= 0.5; p.vy *= 0.5; }
    } else {
      var ax = 0, ay = 0;
      if (keys.left || touchMove.left) ax -= 1;
      if (keys.right || touchMove.right) ax += 1;
      if (keys.up) ay -= 1;
      if (keys.down) ay += 1;
      if (ax !== 0 && ay !== 0) { ax *= 0.7071; ay *= 0.7071; }
      p.vx += ax * PLAYER.speed * 6 * dt;
      p.vy += ay * PLAYER.speed * 6 * dt;
      var damp = Math.pow(0.0025, dt);
      if (ax === 0) p.vx *= damp;
      if (ay === 0) p.vy *= damp;
      var v = Math.hypot(p.vx, p.vy);
      if (v > PLAYER.speed) { p.vx = p.vx / v * PLAYER.speed; p.vy = p.vy / v * PLAYER.speed; }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = C.clamp(p.x, p.r + 6, W - p.r - 6);
    p.y = C.clamp(p.y, H * 0.28, H - p.r - 8);

    if (p.invuln > 0) p.invuln -= dt;

    p.cooldown -= dt;
    if ((G.autoFire || keys.fire || pointer.active) && p.cooldown <= 0) {
      p.cooldown = PLAYER.fireCooldown;
      shootPlayer();
    }

    if (rng() < 0.75) {
      particle(p.x + rand(-3, 3), p.y + 12, rand(-16, 16), rand(120, 220),
        rand(0.12, 0.26), rng() < 0.5 ? '#7dd3fc' : '#38bdf8', rand(1.5, 3), 'spark');
    }
  }

  function shootPlayer() {
    var p = G.player;
    var angles = C.weaponAngles(G.weapon);
    for (var i = 0; i < angles.length; i++) {
      var rad = (angles[i] * Math.PI) / 180;
      var ox = Math.sin(rad) * 26;
      G.bullets.push({
        x: p.x + ox, y: p.y - 14,
        vx: Math.sin(rad) * BULLET.speed,
        vy: -Math.cos(rad) * BULLET.speed,
        r: BULLET.r, dmg: BULLET.dmg
      });
    }
    Sound.shoot();
  }

  function clearBulletsAround(x, y, radius) {
    for (var i = G.ebullets.length - 1; i >= 0; i--) {
      var b = G.ebullets[i];
      if (C.dist2(x, y, b.x, b.y) < radius * radius) {
        spawnSpark(b.x, b.y, '#93c5fd');
        G.ebullets.splice(i, 1);
      }
    }
  }

  function spawnSpark(x, y, color) {
    for (var i = 0; i < 4; i++) {
      var a = rng() * Math.PI * 2;
      particle(x, y, Math.cos(a) * rand(30, 110), Math.sin(a) * rand(30, 110),
        rand(0.15, 0.35), color, rand(1, 2.4), 'spark');
    }
  }

  function playerHit() {
    var p = G.player;
    if (!p || !p.alive || p.invuln > 0) return;

    if (p.shield > 0) {
      p.shield = 0;
      p.invuln = 1.6;
      explode(p.x, p.y, '#38bdf8', 26, 1, false);
      Sound.hurt();
      shake(10, '56,189,248');
      clearBulletsAround(p.x, p.y, 150);
      return;
    }

    G.lives--;
    G.combo = 0;
    explode(p.x, p.y, '#7dd3fc', 46, 1.35, true);
    Sound.bigExplode();
    shake(20, '255,120,120');
    clearBulletsAround(p.x, p.y, 190);

    if (G.lives <= 0) {
      p.alive = false;
      gameOver();
    } else {
      p.x = W / 2;
      p.y = H - 90;
      p.vx = p.vy = 0;
      p.invuln = PLAYER.respawnInvuln;
      G.weapon = Math.max(1, G.weapon - 1);
      showBanner('剩余 ' + G.lives + ' 架', '', 1.2, false);
    }
  }

  function useBomb() {
    if (G.mode !== 'playing' || G.bombs <= 0) return;
    G.bombs--;
    Sound.bomb();
    shake(24, '255,220,150');
    G.flash = 0.9;
    G.flashColor = '255,230,180';
    for (var i = G.ebullets.length - 1; i >= 0; i--) spawnSpark(G.ebullets[i].x, G.ebullets[i].y, '#fde68a');
    G.ebullets.length = 0;
    for (var j = G.enemies.length - 1; j >= 0; j--) damageEnemy(G.enemies[j], 40, true);
    for (var k = 0; k < 60; k++) {
      var a = rng() * Math.PI * 2;
      particle(G.player.x, G.player.y, Math.cos(a) * rand(120, 420), Math.sin(a) * rand(120, 420),
        rand(0.4, 0.8), '#fde68a', rand(2, 4), 'spark');
    }
  }
  /* ============================== 敌人 ============================== */
  function spawnEnemy(type, x) {
    var def = C.ENEMIES[type];
    var hp = C.enemyHp(type, G.wave);
    G.enemies.push({
      type: type, x: x, y: -46 - rng() * 30, r: def.r,
      hp: hp, maxHp: hp, color: def.color, accent: def.accent, ai: def.ai,
      vy: C.enemySpeed(type, G.wave), baseX: x, t: rng() * 6,
      fireRate: def.fire, fireCd: def.fire ? rand(0.6, 1.6) : 0,
      hitFlash: 0, angle: 0, targetY: rand(110, 230), boss: false
    });
  }

  function spawnBoss(level) {
    var hp = C.bossHp(level);
    var boss = {
      type: 'boss', boss: true, level: level, x: W / 2, y: -100, r: C.ENEMIES.boss.r,
      hp: hp, maxHp: hp, color: C.ENEMIES.boss.color, accent: C.ENEMIES.boss.accent,
      ai: 'boss', t: 0, entering: true, vx: 76 + level * 10,
      fireCd: 1.4, spiral: 0, hitFlash: 0, angle: 0
    };
    G.enemies.push(boss);
    G.boss = boss;
    showBanner('WARNING', '母舰来袭 · Lv.' + level, 2.2, true);
    Sound.warn();
    shake(12, '244,114,182');
  }

  function updateBoss(e, dt, p) {
    if (e.entering) {
      e.y += 62 * dt;
      if (e.y >= 132) { e.y = 132; e.entering = false; }
      return;
    }
    e.x += e.vx * dt;
    if (e.x < 96) { e.x = 96; e.vx = Math.abs(e.vx); }
    if (e.x > W - 96) { e.x = W - 96; e.vx = -Math.abs(e.vx); }
    e.y = 132 + Math.sin(e.t * 1.25) * 16;

    e.fireCd -= dt;
    if (e.fireCd > 0) return;

    var frac = e.hp / e.maxHp;
    if (frac > 0.66) {
      aimedSpread(e, p, 3, 0.22, 250);
      e.fireCd = 1.35;
    } else if (frac > 0.33) {
      radialBurst(e, 12, 200, e.spiral);
      e.spiral += 0.26;
      e.fireCd = 1.15;
    } else {
      radialBurst(e, 5, 235, e.spiral);
      e.spiral += 0.42;
      if (rng() < 0.5) aimedSpread(e, p, 3, 0.16, 285);
      e.fireCd = 0.55;
    }
    Sound.hit();
  }

  function aimedSpread(e, p, count, spread, speed) {
    if (!p || !p.alive) return;
    var base = Math.atan2(p.y - e.y, p.x - e.x);
    for (var i = 0; i < count; i++) {
      var a = base + (i - (count - 1) / 2) * spread;
      pushEBullet(e.x, e.y + 20, Math.cos(a) * speed, Math.sin(a) * speed, 7, e.color);
    }
  }

  function radialBurst(e, count, speed, offset) {
    for (var i = 0; i < count; i++) {
      var a = offset + (i / count) * Math.PI * 2;
      pushEBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed, 6, e.color);
    }
  }

  function pushEBullet(x, y, vx, vy, r, color) {
    G.ebullets.push({ x: x, y: y, vx: vx, vy: vy, r: r, color: color });
  }

  function enemyShoot(e, p) {
    if (e.type === 'tank') { aimedSpread(e, p, 3, 0.2, 210); return; }
    if (p && p.alive) {
      var a = Math.atan2(p.y - e.y, p.x - e.x);
      pushEBullet(e.x, e.y + 10, Math.cos(a) * 265, Math.sin(a) * 265, 5, '#fca5a5');
    } else {
      pushEBullet(e.x, e.y + 10, 0, 230, 5, '#fca5a5');
    }
  }

  function updateEnemies(dt) {
    var p = G.player;
    for (var i = G.enemies.length - 1; i >= 0; i--) {
      var e = G.enemies[i];
      e.t += dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;

      switch (e.ai) {
        case 'straight':
          e.y += e.vy * dt;
          break;
        case 'zigzag':
          e.y += e.vy * dt;
          e.x = C.clamp(e.baseX + Math.sin(e.t * 2.3) * 74, e.r + 6, W - e.r - 6);
          e.angle = Math.cos(e.t * 2.3) * 0.3;
          break;
        case 'dive': {
          e.y += e.vy * dt;
          if (p && p.alive && e.y > 80) {
            var dx = p.x - e.x, dy = p.y - e.y;
            var d = Math.hypot(dx, dy) || 1;
            e.x += (dx / d) * 130 * dt;
            e.y += (dy / d) * 92 * dt;
            e.angle = Math.atan2(dy, dx) - Math.PI / 2;
          }
          break;
        }
        case 'hover':
          if (e.y < e.targetY) { e.y += e.vy * dt; }
          else {
            e.y += Math.sin(e.t * 1.6) * 14 * dt;
            e.x = C.clamp(e.baseX + Math.sin(e.t * 0.9) * 96, e.r + 8, W - e.r - 8);
          }
          break;
        case 'advance':
          e.y += e.vy * dt;
          e.x = C.clamp(e.baseX + Math.sin(e.t * 0.8) * 40, e.r + 8, W - e.r - 8);
          break;
        case 'boss':
          updateBoss(e, dt, p);
          break;
        default:
          e.y += e.vy * dt;
      }

      if (e.fireRate > 0 && !e.boss && e.y > 20 && e.y < H * 0.82) {
        e.fireCd -= dt;
        if (e.fireCd <= 0) {
          e.fireCd = e.fireRate * C.difficulty(G.wave).fire;
          enemyShoot(e, p);
        }
      }

      if (!e.boss && (e.y > H + 80 || e.x < -140 || e.x > W + 140)) {
        G.enemies.splice(i, 1);
      }
    }
  }

  function damageEnemy(e, dmg, silent) {
    e.hp -= dmg;
    e.hitFlash = 0.09;
    if (!silent) Sound.hit();
    if (e.hp > 0) {
      for (var i = 0; i < 3; i++) {
        var a = rng() * Math.PI * 2;
        particle(e.x, e.y, Math.cos(a) * rand(40, 130), Math.sin(a) * rand(40, 130),
          0.25, '#ffffff', rand(1, 2), 'spark');
      }
      return;
    }
    killEnemy(e);
  }

  function killEnemy(e) {
    var idx = G.enemies.indexOf(e);
    if (idx >= 0) G.enemies.splice(idx, 1);

    var def = C.ENEMIES[e.type] || C.ENEMIES.scout;
    G.kills++;
    G.combo++;
    G.comboTimer = 2.2;

    if (e.boss) {
      G.boss = null;
      explode(e.x, e.y, e.color, 90, 1.9, true);
      explode(e.x - 30, e.y + 10, '#fde68a', 40, 1.5, true);
      explode(e.x + 30, e.y - 10, '#a855f7', 40, 1.5, true);
      Sound.bigExplode();
      shake(26, '255,200,220');
      G.flash = 0.7;
      G.flashColor = '255,180,220';
      addScore(def.score, e.x, e.y, '#f9a8d4');
      for (var i = 0; i < 3; i++) dropPower(e.x + rand(-40, 40), e.y + rand(-20, 20), null);
      showBanner('母舰已击沉！', 'WAVE CLEAR', 2, false);
    } else {
      explode(e.x, e.y, e.color, def.r > 18 ? 42 : 24, def.r > 18 ? 1.25 : 1, def.r > 18);
      Sound.explode();
      shake(def.r > 18 ? 12 : 5, null);
      addScore(def.score, e.x, e.y - 10, '#fde68a');
      var drop = C.rollDrop(rng, e.type);
      if (drop) dropPower(e.x, e.y, drop);
    }
  }

  /* ============================== 道具 ============================== */
  function dropPower(x, y, type) {
    var t = type || C.POWER_TYPES[(rng() * C.POWER_TYPES.length) | 0];
    G.powers.push({ x: x, y: y, vy: 72, vx: rand(-24, 24), r: 15, type: t, t: 0 });
  }

  function applyPower(type, w) {
    var meta = C.POWER_META[type];
    Sound.power();
    explode(w.x, w.y, meta.color, 16, 0.8, false);
    switch (type) {
      case 'power': {
        var before = G.weapon;
        G.weapon = C.nextWeaponLevel(G.weapon);
        if (G.weapon === before) addScore(120, w.x, w.y, meta.color);
        else floatText(w.x, w.y, '火力 Lv.' + G.weapon, meta.color);
        break;
      }
      case 'shield':
        G.player.shield = 1;
        floatText(w.x, w.y, '护盾启动', meta.color);
        break;
      case 'heal':
        if (G.lives < PLAYER.maxLives) { G.lives++; floatText(w.x, w.y, '生命 +1', meta.color); }
        else addScore(200, w.x, w.y, meta.color);
        break;
      case 'bomb':
        if (G.bombs < PLAYER.maxBombs) { G.bombs++; floatText(w.x, w.y, '核弹 +1', meta.color); }
        else addScore(200, w.x, w.y, meta.color);
        break;
      default: break;
    }
  }

  function updatePowers(dt) {
    var p = G.player;
    for (var i = G.powers.length - 1; i >= 0; i--) {
      var w = G.powers[i];
      w.t += dt;
      w.y += w.vy * dt;
      w.x += w.vx * dt;
      if (w.x < 20 || w.x > W - 20) w.vx *= -1;

      if (p && p.alive && C.circleHit(p.x, p.y, p.r + 12, w.x, w.y, w.r)) {
        applyPower(w.type, w);
        G.powers.splice(i, 1);
        continue;
      }
      if (w.y > H + 30) G.powers.splice(i, 1);
    }
  }

  /* ============================== 波次 ============================== */
  function startWave(n) {
    G.wave = n;
    var plan = C.buildWave(n, rng, W);
    G.spawnQueue = plan.spawns.slice();
    G.waveTime = 0;
    G.waveState = 'running';
    G.pendingBoss = plan.boss ? { level: plan.bossLevel, delay: 1.7 } : null;
    if (!plan.boss) showBanner('第 ' + n + ' 波', '', 1.4, false);
  }

  function updateWaves(dt) {
    if (G.waveState === 'gap') {
      G.waveGap -= dt;
      if (G.waveGap <= 0) startWave(G.wave + 1);
      return;
    }
    if (G.waveState !== 'running') return;

    G.waveTime += dt;

    if (G.pendingBoss) {
      G.pendingBoss.delay -= dt;
      if (G.pendingBoss.delay <= 0) {
        spawnBoss(G.pendingBoss.level);
        G.pendingBoss = null;
      }
    }

    while (G.spawnQueue.length && G.waveTime >= G.spawnQueue[0].delay) {
      var s = G.spawnQueue.shift();
      spawnEnemy(s.type, s.x);
    }

    if (!G.spawnQueue.length && !G.enemies.length && !G.pendingBoss) {
      G.waveState = 'gap';
      G.waveGap = 1.5;
      var bonus = 80 * G.wave;
      G.score += bonus;
      if (G.score > G.high) { G.high = G.score; saveHigh(); }
      showBanner('第 ' + G.wave + ' 波清空', '波次奖励 +' + bonus, 1.6, false);
      floatText(W / 2, H * 0.42, '+' + bonus, '#7dd3fc');
    }
  }

  /* ============================== 子弹与粒子 ============================== */
  function updateBullets(dt) {
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var b = G.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > W + 20) { G.bullets.splice(i, 1); continue; }

      var hit = false;
      for (var j = G.enemies.length - 1; j >= 0; j--) {
        var e = G.enemies[j];
        if (C.circleHit(b.x, b.y, b.r, e.x, e.y, e.r)) {
          damageEnemy(e, b.dmg);
          spawnSpark(b.x, b.y, '#e0f2fe');
          hit = true;
          break;
        }
      }
      if (hit) G.bullets.splice(i, 1);
    }
  }

  function updateEBullets(dt) {
    var p = G.player;
    for (var i = G.ebullets.length - 1; i >= 0; i--) {
      var b = G.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) { G.ebullets.splice(i, 1); continue; }
      if (p && p.alive && C.circleHit(b.x, b.y, b.r, p.x, p.y, p.r * 0.85)) {
        G.ebullets.splice(i, 1);
        playerHit();
      }
    }
  }

  function updateParticles(dt) {
    for (var i = G.particles.length - 1; i >= 0; i--) {
      var q = G.particles[i];
      q.life -= dt;
      if (q.life <= 0) { G.particles.splice(i, 1); continue; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.kind === 'spark') { q.vx *= 0.965; q.vy = q.vy * 0.965 + 40 * dt; }
      else if (q.kind === 'smoke') { q.vx *= 0.94; q.vy *= 0.94; }
    }
    for (var j = G.floats.length - 1; j >= 0; j--) {
      var f = G.floats[j];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) G.floats.splice(j, 1);
    }
  }

  /* ============================== 星空 ============================== */
  function updateStars(dt) {
    var speedMul = G.mode === 'playing' ? 1 : 0.45;
    for (var i = 0; i < G.stars.length; i++) {
      var s = G.stars[i];
      s.y += s.speed * speedMul * dt;
      s.twinkle += dt * 3;
      if (s.y > H + 4) { s.y = -4; s.x = rng() * W; }
    }
    for (var j = 0; j < G.nebulas.length; j++) {
      var n = G.nebulas[j];
      n.y += 6 * speedMul * dt;
      if (n.y - n.r > H) { n.y = -n.r; n.x = rng() * W; }
    }
  }

  /* ============================== 主更新 ============================== */
  function update(dt) {
    G.time += dt;
    updateStars(dt);
    updateParticles(dt);

    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 46);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.6);
    if (G.banner) {
      G.banner.t += dt;
      if (G.banner.t >= G.banner.dur) G.banner = null;
    }

    if (G.mode !== 'playing') return;

    updatePlayer(dt);
    updateWaves(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateEBullets(dt);
    updatePowers(dt);

    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0) G.combo = 0;
    }
  }
  /* ============================== 绘制 ============================== */
  function drawBackground() {
    ctx.fillStyle = '#04060f';
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < G.nebulas.length; i++) {
      var n = G.nebulas[i];
      var g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, 'hsla(' + n.hue + ',85%,60%,' + n.alpha + ')');
      g.addColorStop(1, 'hsla(' + n.hue + ',85%,60%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var j = 0; j < G.stars.length; j++) {
      var s = G.stars[j];
      var tw = 0.75 + 0.25 * Math.sin(s.twinkle);
      ctx.fillStyle = 'rgba(226,240,255,' + (s.alpha * tw).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.layer === 2) {
        ctx.strokeStyle = 'rgba(180,220,255,' + (s.alpha * 0.32).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x, s.y + 9);
        ctx.stroke();
      }
    }
  }

  function drawPlayer() {
    var p = G.player;
    if (!p || !p.alive) return;
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0 && G.mode === 'playing') return;

    ctx.save();
    ctx.translate(p.x, p.y);

    var flame = 12 + Math.sin(G.time * 40) * 4;
    var fg = ctx.createLinearGradient(0, 8, 0, 8 + flame);
    fg.addColorStop(0, 'rgba(125,211,252,.95)');
    fg.addColorStop(0.5, 'rgba(56,189,248,.55)');
    fg.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(0, 8 + flame);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'rgba(56,189,248,.9)';
    ctx.shadowBlur = 14;
    var body = ctx.createLinearGradient(0, -18, 0, 12);
    body.addColorStop(0, '#e0f2fe');
    body.addColorStop(0.45, '#38bdf8');
    body.addColorStop(1, '#0369a1');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(6, -4);
    ctx.lineTo(16, 6);
    ctx.lineTo(7, 5);
    ctx.lineTo(5, 11);
    ctx.lineTo(-5, 11);
    ctx.lineTo(-7, 5);
    ctx.lineTo(-16, 6);
    ctx.lineTo(-6, -4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#0ea5e9';
    ctx.beginPath();
    ctx.ellipse(0, -6, 3.2, 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath();
    ctx.ellipse(-1, -7.4, 1.1, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(56,189,248,.85)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(56,189,248,.9)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + Math.sin(G.time * 8) * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(56,189,248,.12)';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    var r = e.r;
    var col = e.hitFlash > 0 ? '#ffffff' : e.color;
    var acc = e.hitFlash > 0 ? '#ffffff' : e.accent;

    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.angle) ctx.rotate(e.angle * 0.35);

    ctx.lineJoin = 'round';
    ctx.fillStyle = col;
    ctx.strokeStyle = acc;
    ctx.lineWidth = 2;

    switch (e.type) {
      case 'scout':
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(-r * 0.95, -r * 0.55);
        ctx.lineTo(-r * 0.34, -r * 0.32);
        ctx.lineTo(0, -r * 0.8);
        ctx.lineTo(r * 0.34, -r * 0.32);
        ctx.lineTo(r * 0.95, -r * 0.55);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'drone':
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.85, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.85, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0);
        ctx.moveTo(0, -r * 0.5); ctx.lineTo(0, r * 0.5);
        ctx.stroke();
        break;
      case 'kamikaze':
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(-r * 0.85, -r * 0.25);
        ctx.lineTo(-r * 0.32, -r * 0.25);
        ctx.lineTo(-r * 0.32, -r);
        ctx.lineTo(r * 0.32, -r);
        ctx.lineTo(r * 0.32, -r * 0.25);
        ctx.lineTo(r * 0.85, -r * 0.25);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'fighter':
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(-r * 0.45, r * 0.3);
        ctx.lineTo(-r, -r * 0.1);
        ctx.lineTo(-r * 0.5, -r * 0.45);
        ctx.lineTo(0, -r * 0.85);
        ctx.lineTo(r * 0.5, -r * 0.45);
        ctx.lineTo(r, -r * 0.1);
        ctx.lineTo(r * 0.45, r * 0.3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        break;
      case 'tank': {
        var n = 8;
        ctx.beginPath();
        for (var i = 0; i < n; i++) {
          var a = (i / n) * Math.PI * 2 + Math.PI / 8;
          var px = Math.cos(a) * r, py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = acc;
        ctx.beginPath();
        ctx.arc(0, -r * 0.15, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath();
        ctx.arc(-r * 0.15, -r * 0.35, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'boss': {
        var t = e.t;
        ctx.shadowColor = 'rgba(244,114,182,.75)';
        ctx.shadowBlur = 22;
        ctx.beginPath();
        for (var k = 0; k < 8; k++) {
          var ang = (k / 8) * Math.PI * 2 + t * 0.25;
          var rr = r * (k % 2 === 0 ? 1 : 0.68);
          var bx = Math.cos(ang) * rr, by = Math.sin(ang) * rr;
          if (k === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = acc;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.2 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = col;
        for (var d = 0; d < 4; d++) {
          var a2 = t * 0.6 + (d / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a2) * r * 0.72, Math.sin(a2) * r * 0.72, r * 0.13, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default:
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    if (!e.boss && e.type === 'tank' && e.hp < e.maxHp) {
      var w = 44, h = 4, x = e.x - w / 2, y = e.y - e.r - 12;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = e.color;
      ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.bullets.length; i++) {
      var b = G.bullets[i];
      var g = ctx.createLinearGradient(b.x, b.y - 14, b.x, b.y + 6);
      g.addColorStop(0, 'rgba(224,242,254,0)');
      g.addColorStop(0.55, 'rgba(125,211,252,.85)');
      g.addColorStop(1, 'rgba(255,255,255,.95)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 2.6, 11, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (var j = 0; j < G.ebullets.length; j++) {
      var e = G.ebullets[j];
      ctx.fillStyle = 'rgba(255,120,140,.35)';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.color || '#fca5a5';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(e.x - e.r * 0.25, e.y - e.r * 0.25, e.r * 0.36, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPowers() {
    for (var i = 0; i < G.powers.length; i++) {
      var w = G.powers[i];
      var meta = C.POWER_META[w.type];
      var pulse = 1 + Math.sin(w.t * 6) * 0.08;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(Math.sin(w.t * 2) * 0.25);
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(6,12,24,.9)';
      ctx.beginPath();
      ctx.arc(0, 0, w.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = meta.color;
      ctx.font = '700 15px "Segoe UI",system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(meta.letter, 0, 1);
      ctx.restore();
    }
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < G.particles.length; i++) {
      var q = G.particles[i];
      var a = Math.max(0, q.life / q.max);
      if (q.kind === 'ring') {
        var rad = (1 - a) * 46 + 6;
        ctx.strokeStyle = q.color;
        ctx.globalAlpha = a * 0.7;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.arc(q.x, q.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = q.kind === 'smoke' ? a * 0.5 : a;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (q.kind === 'smoke' ? (1.6 - a * 0.6) : a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawFloats() {
    ctx.save();
    ctx.textAlign = 'center';
    for (var i = 0; i < G.floats.length; i++) {
      var f = G.floats[i];
      ctx.globalAlpha = Math.min(1, f.life / f.max * 1.6);
      ctx.font = '700 15px "Segoe UI",system-ui,sans-serif';
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.save();
    ctx.textBaseline = 'top';

    ctx.font = '700 24px "Segoe UI",system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e8eefb';
    ctx.fillText(String(G.score), 16, 14);
    ctx.font = '600 11px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = 'rgba(139,155,180,.9)';
    ctx.fillText('SCORE', 16, 40);

    ctx.textAlign = 'right';
    ctx.font = '700 20px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('WAVE ' + Math.max(1, G.wave), W - 16, 16);
    ctx.font = '600 11px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = 'rgba(139,155,180,.9)';
    ctx.fillText('最高分 ' + G.high, W - 16, 40);

    if (G.combo >= 3) {
      ctx.textAlign = 'center';
      ctx.font = '700 16px "Segoe UI",system-ui,sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText('×' + C.comboMultiplier(G.combo).toFixed(1) + ' 连击 ' + G.combo, W / 2, 44);
    }

    ctx.textAlign = 'left';
    for (var i = 0; i < PLAYER.maxLives; i++) {
      var x = 20 + i * 20, y = H - 26;
      ctx.globalAlpha = i < G.lives ? 1 : 0.22;
      ctx.fillStyle = i < G.lives ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 6, y + 5);
      ctx.lineTo(x, y + 1);
      ctx.lineTo(x - 6, y + 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'right';
    ctx.font = '600 12px "Segoe UI",system-ui,sans-serif';
    ctx.fillStyle = 'rgba(139,155,180,.9)';
    ctx.fillText('核弹 B', W - 66, H - 32);
    for (var b = 0; b < PLAYER.maxBombs; b++) {
      ctx.globalAlpha = b < G.bombs ? 1 : 0.2;
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(W - 54 + b * 14, H - 26, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(139,155,180,.9)';
    ctx.fillText('FIRE Lv.' + G.weapon, W - 16, H - 62);
    for (var k = 0; k < 5; k++) {
      ctx.fillStyle = k < G.weapon ? '#fbbf24' : 'rgba(255,255,255,.14)';
      ctx.fillRect(W - 16 - (5 - k) * 17, H - 46, 14, 5);
    }

    if (G.boss) {
      var bw = W - 120, bh = 12, bx3 = 60, by3 = 74;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(bx3 - 2, by3 - 2, bw + 4, bh + 4);
      var frac = Math.max(0, G.boss.hp / G.boss.maxHp);
      var bg = ctx.createLinearGradient(bx3, 0, bx3 + bw, 0);
      bg.addColorStop(0, '#f472b6');
      bg.addColorStop(0.5, '#fb7185');
      bg.addColorStop(1, '#a855f7');
      ctx.fillStyle = bg;
      ctx.fillRect(bx3, by3, bw * frac, bh);
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx3 + 0.5, by3 + 0.5, bw - 1, bh - 1);
      ctx.textAlign = 'center';
      ctx.font = '700 11px "Segoe UI",system-ui,sans-serif';
      ctx.fillStyle = '#fbcfe8';
      ctx.fillText('母舰 Lv.' + G.boss.level + '   ' + Math.max(0, Math.ceil(G.boss.hp)) + ' / ' + G.boss.maxHp, W / 2, by3 + 16);
    }

    ctx.restore();
  }

  function drawBanner() {
    if (!G.banner) return;
    var b = G.banner;
    var p = b.t / b.dur;
    var alpha = p < 0.15 ? p / 0.15 : (p > 0.75 ? (1 - p) / 0.25 : 1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = b.warn ? '#fb7185' : '#e0f2fe';
    ctx.font = '800 ' + (b.warn ? 34 : 30) + 'px "Segoe UI",system-ui,sans-serif';
    ctx.shadowColor = b.warn ? 'rgba(251,113,133,.8)' : 'rgba(56,189,248,.8)';
    ctx.shadowBlur = 18;
    ctx.fillText(b.text, W / 2, H * 0.33);
    if (b.sub) {
      ctx.font = '600 15px "Segoe UI",system-ui,sans-serif';
      ctx.shadowBlur = 8;
      ctx.fillStyle = 'rgba(226,240,255,.85)';
      ctx.fillText(b.sub, W / 2, H * 0.33 + 30);
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    ctx.save();
    if (G.shake > 0.2) {
      ctx.translate(rand(-G.shake, G.shake) * 0.4, rand(-G.shake, G.shake) * 0.4);
    }
    drawPowers();
    for (var i = 0; i < G.enemies.length; i++) drawEnemy(G.enemies[i]);
    drawBullets();
    drawPlayer();
    drawParticles();
    drawFloats();
    ctx.restore();

    drawHUD();
    drawBanner();

    if (G.flash > 0.01) {
      ctx.fillStyle = 'rgba(' + G.flashColor + ',' + G.flash.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }
  /* ============================== 流程控制 ============================== */
  function resetWorld() {
    G.time = 0;
    G.score = 0;
    G.kills = 0;
    G.lives = PLAYER.startLives;
    G.bombs = PLAYER.startBombs;
    G.weapon = 1;
    G.wave = 0;
    G.combo = 0;
    G.comboTimer = 0;
    G.player = makePlayer();
    G.bullets.length = 0;
    G.enemies.length = 0;
    G.ebullets.length = 0;
    G.powers.length = 0;
    G.particles.length = 0;
    G.floats.length = 0;
    G.spawnQueue.length = 0;
    G.waveState = 'idle';
    G.waveGap = 0;
    G.pendingBoss = null;
    G.boss = null;
    G.shake = 0;
    G.flash = 0;
    G.banner = null;
  }

  function startGame() {
    resetWorld();
    G.mode = 'playing';
    startWave(1);
    hideOverlay();
    Sound.init();
    Sound.resume();
    syncUI(true);
  }

  function togglePause() {
    if (G.mode === 'playing') {
      G.mode = 'paused';
      showOverlay('已暂停', '得分 ' + G.score + ' · 第 ' + G.wave + ' 波', '继续游戏', false);
    } else if (G.mode === 'paused') {
      G.mode = 'playing';
      hideOverlay();
    }
  }

  function gameOver() {
    G.mode = 'over';
    Sound.over();
    if (G.score > G.high) { G.high = G.score; saveHigh(); }
    showOverlay('游戏结束',
      '得分 ' + G.score + ' · 最高分 ' + G.high + ' · 击落 ' + G.kills + ' 架 · 到达第 ' + G.wave + ' 波',
      '再来一局', false);
    syncUI(true);
  }

  /* ============================== 覆盖层 ============================== */
  function showOverlay(title, text, btn, showKeys) {
    ovTitle.textContent = title;
    ovTitle.className = title === '游戏结束' ? 'warn' : '';
    ovText.textContent = text;
    ovBtn.textContent = btn;
    ovKeys.style.display = showKeys ? 'flex' : 'none';
    ovTiny.style.display = showKeys ? 'block' : 'none';
    overlay.classList.remove('hidden');
    btnPause.textContent = '暂停 (P)';
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
    btnPause.textContent = '暂停 (P)';
  }

  /* ============================== UI 同步 ============================== */
  var uiCache = {};
  function setText(id, value) {
    if (uiCache[id] === value) return;
    uiCache[id] = value;
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function syncUI(force) {
    if (force) uiCache = {};
    setText('uiScore', String(G.score));
    setText('uiHigh', String(G.high));
    setText('uiWave', String(Math.max(1, G.wave)));
    setText('uiKills', String(G.kills));
    var hearts = '';
    for (var i = 0; i < PLAYER.maxLives; i++) hearts += i < G.lives ? '♥' : '·';
    setText('uiLives', hearts);
    setText('uiWeapon', 'Lv.' + G.weapon);
  }

  /* ============================== 输入 ============================== */
  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down'
  };

  function toggleSound() {
    Sound.enabled = !Sound.enabled;
    document.getElementById('btnSound').textContent = '音效：' + (Sound.enabled ? '开' : '关');
  }

  window.addEventListener('keydown', function (e) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].indexOf(e.code) !== -1) e.preventDefault();
    var tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    Sound.init();

    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; return; }

    switch (e.code) {
      case 'Space':
        if (G.mode === 'ready' || G.mode === 'over') { startGame(); return; }
        keys.fire = true;
        break;
      case 'Enter':
        if (G.mode === 'ready' || G.mode === 'over') startGame();
        break;
      case 'KeyB':
        useBomb();
        break;
      case 'KeyP':
      case 'Escape':
        if (G.mode === 'playing' || G.mode === 'paused') togglePause();
        break;
      case 'KeyR':
        startGame();
        break;
      case 'KeyM':
        toggleSound();
        break;
      case 'KeyF':
        G.autoFire = !G.autoFire;
        document.getElementById('chkAuto').checked = G.autoFire;
        break;
      default: break;
    }
  });

  window.addEventListener('keyup', function (e) {
    if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
    if (e.code === 'Space') keys.fire = false;
  });

  window.addEventListener('blur', function () {
    keys.left = keys.right = keys.up = keys.down = keys.fire = false;
    pointer.active = false;
    touchMove.left = touchMove.right = false;
    if (G.mode === 'playing') togglePause();
  });

  canvas.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    Sound.init();
    Sound.resume();
    if (G.mode === 'ready' || G.mode === 'over') { startGame(); return; }
    if (G.mode !== 'playing') return;

    var p = toLogical(e);
    pointer.active = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    if (e.pointerType === 'mouse') {
      pointer.relative = false;
      pointer.tx = p.x;
      pointer.ty = p.y;
    } else {
      pointer.relative = true;
      pointer.ox = G.player.x - p.x;
      pointer.oy = G.player.y - p.y;
      pointer.tx = G.player.x;
      pointer.ty = G.player.y;
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!pointer.active || G.mode !== 'playing') return;
    e.preventDefault();
    var p = toLogical(e);
    if (pointer.relative) {
      pointer.tx = C.clamp(p.x + pointer.ox, 0, W);
      pointer.ty = C.clamp(p.y + pointer.oy, 0, H);
    } else {
      pointer.tx = p.x;
      pointer.ty = p.y;
    }
  });

  function endPointer(e) {
    if (!pointer.active) return;
    pointer.active = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.querySelectorAll('#touchbar button').forEach(function (btn) {
    var act = btn.dataset.act;
    function press(e) {
      e.preventDefault();
      Sound.init();
      if (G.mode === 'ready' || G.mode === 'over') { startGame(); return; }
      if (act === 'left') touchMove.left = true;
      else if (act === 'right') touchMove.right = true;
      else if (act === 'bomb') useBomb();
      else if (act === 'pause') togglePause();
    }
    function release(e) {
      if (e) e.preventDefault();
      if (act === 'left') touchMove.left = false;
      if (act === 'right') touchMove.right = false;
    }
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });

  ovBtn.addEventListener('click', function () {
    if (G.mode === 'paused') togglePause();
    else startGame();
  });

  btnPause.addEventListener('click', function () {
    if (G.mode === 'ready' || G.mode === 'over') startGame();
    else togglePause();
  });

  document.getElementById('btnRestart').addEventListener('click', function () { startGame(); });
  document.getElementById('btnSound').addEventListener('click', function () { Sound.init(); toggleSound(); });
  document.getElementById('chkAuto').addEventListener('change', function () { G.autoFire = this.checked; });

  /* ============================== 主循环 ============================== */
  var last = 0;
  function loop(now) {
    if (!last) last = now;
    var dt = Math.min(0.034, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    syncUI(false);
    requestAnimationFrame(loop);
  }

  /* ============================== 启动 ============================== */
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    G.autoFire = true;
  }

  G.stars = C.makeStars(150, rng, W, H);
  G.nebulas = C.makeNebulas(5, rng, W, H);
  G.player = makePlayer();
  G.player.alive = false;

  fitCanvas();
  showOverlay('太空打飞机', '击落敌机、拾取补给，一路打到母舰！', '开始游戏', true);
  syncUI(true);
  requestAnimationFrame(loop);
})();