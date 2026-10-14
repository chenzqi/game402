/* ============================================================================
 *  core.js —— 太空打飞机 · 纯逻辑核心（不依赖 DOM，浏览器 / Node 通用）
 *
 *  包含：随机数、碰撞、敌人属性表、难度曲线、波次编排、道具掉落、星空生成。
 *  与渲染 / 输入无关，因此可以用 node 直接做单元测试。
 * ==========================================================================*/
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpaceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------- 基础工具 ------------------------------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function range(rng, a, b) { return a + rng() * (b - a); }
  function pick(rng, arr) { return arr[Math.min(arr.length - 1, (rng() * arr.length) | 0)]; }

  /* -------------------------------- 碰撞 -------------------------------- */
  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  /** 圆形碰撞 */
  function circleHit(ax, ay, ar, bx, by, br) {
    var r = ar + br;
    return dist2(ax, ay, bx, by) <= r * r;
  }

  /** 矩形（中心点 + 半宽半高）碰撞 */
  function aabbHit(ax, ay, ahw, ahh, bx, by, bhw, bhh) {
    return Math.abs(ax - bx) <= ahw + bhw && Math.abs(ay - by) <= ahh + bhh;
  }

  /* ------------------------------ 敌人属性表 ------------------------------ */
  /* ai: straight 直线俯冲 | zigzag 左右摆动 | hover 悬停点射 | dive 追踪撞击
   *     advance 缓慢推进 | boss 母舰                                     */
  var ENEMIES = {
    scout:    { name: '侦察机', hp: 1,  r: 13, score: 100,  speed: 155, color: '#7dd3fc', accent: '#0284c7', ai: 'straight', fire: 0,    drop: 0.06, sides: 3 },
    drone:    { name: '无人机', hp: 2,  r: 14, score: 150,  speed: 118, color: '#a78bfa', accent: '#7c3aed', ai: 'zigzag',   fire: 0,    drop: 0.09, sides: 4 },
    kamikaze: { name: '自爆机', hp: 2,  r: 14, score: 180,  speed: 96,  color: '#fbbf24', accent: '#d97706', ai: 'dive',     fire: 0,    drop: 0.08, sides: 3 },
    fighter:  { name: '战斗机', hp: 3,  r: 16, score: 220,  speed: 92,  color: '#fb7185', accent: '#be123c', ai: 'hover',    fire: 1.7,  drop: 0.12, sides: 5 },
    tank:     { name: '重型机', hp: 10, r: 23, score: 460,  speed: 52,  color: '#34d399', accent: '#047857', ai: 'advance',  fire: 2.1,  drop: 0.45, sides: 6 },
    boss:     { name: '母舰',   hp: 90, r: 54, score: 3000, speed: 60,  color: '#f472b6', accent: '#9d174d', ai: 'boss',     fire: 1.15, drop: 1,    sides: 8 }
  };

  /* ------------------------------ 难度与波次 ------------------------------ */
  /** 波号 -> 难度系数（速度 / 血量 / 火力） */
  function difficulty(wave) {
    var w = Math.max(1, wave | 0);
    return {
      speed: 1 + (w - 1) * 0.05,
      hp: 1 + Math.floor((w - 1) / 3) * 0.45,
      fire: Math.max(0.45, 1 - (w - 1) * 0.035)
    };
  }

  /** 敌人实际血量（取整、至少为 1） */
  function enemyHp(type, wave) {
    var base = (ENEMIES[type] || ENEMIES.scout).hp;
    return Math.max(1, Math.round(base * difficulty(wave).hp));
  }

  /** 母舰血量 */
  function bossHp(level) { return Math.round(70 + level * 55); }

  var PATTERNS = ['line', 'vee', 'columns', 'arc', 'swarm'];

  /** 阵列中第 i 个敌人的横向位置 */
  function patternX(pattern, i, count, width, rng) {
    var m = 46;
    var span = width - m * 2;
    var t = count <= 1 ? 0.5 : i / (count - 1);
    switch (pattern) {
      case 'line':
        return m + span * t;
      case 'vee': {
        var k = Math.floor(i / 2) + (i % 2 === 0 ? 0 : 1);
        var dir = i % 2 === 0 ? 1 : -1;
        var step = span / Math.max(2, Math.ceil(count / 2));
        return clamp(width / 2 + dir * k * step, m, width - m);
      }
      case 'columns': {
        var cols = 4;
        return m + span * ((i % cols) / (cols - 1));
      }
      case 'arc':
        return width / 2 + (span / 2) * Math.cos(Math.PI * t);
      case 'swarm':
      default:
        return clamp(range(rng, m, width - m), m, width - m);
    }
  }

  /** 依波号挑选敌人类型（越往后越强） */
  function pickType(wave, rng) {
    var pool = ['scout', 'scout'];
    if (wave >= 2) pool.push('drone');
    if (wave >= 3) pool.push('fighter', 'kamikaze');
    if (wave >= 5) pool.push('tank');
    if (wave >= 8) pool.push('tank', 'fighter', 'kamikaze');
    return pick(rng, pool);
  }

  /**
   * 生成一波敌人的编排计划（纯数据，游戏循环按 delay 依次投放）。
   * @returns {{wave:number, boss:boolean, bossLevel:number, difficulty:object,
   *            spawns:Array<{type:string,x:number,delay:number}>}}
   */
  function buildWave(wave, rng, width) {
    rng = rng || Math.random;
    width = width || 480;
    var d = difficulty(wave);
    var plan = { wave: wave, boss: false, bossLevel: 0, difficulty: d, spawns: [] };

    if (wave % 5 === 0) {
      plan.boss = true;
      plan.bossLevel = Math.floor(wave / 5);
      var guards = Math.min(8, 1 + plan.bossLevel);   // 护卫数量设上限，避免高波次瞬间刷出过多敌人
      for (var g = 0; g < guards; g++) {
        plan.spawns.push({
          type: 'drone',
          x: range(rng, 70, width - 70),
          delay: 1.2 + g * 0.7
        });
      }
      return plan;
    }

    var pattern = PATTERNS[(wave - 1) % PATTERNS.length];
    var count = Math.min(14, 3 + Math.round(wave * 0.9));
    var gap = Math.max(0.15, 0.44 - wave * 0.015);
    for (var i = 0; i < count; i++) {
      plan.spawns.push({
        type: pickType(wave, rng),
        x: patternX(pattern, i, count, width, rng),
        delay: i * gap
      });
    }
    plan.pattern = pattern;
    return plan;
  }

  /* ------------------------------- 道具掉落 ------------------------------- */
  var POWER_TYPES = ['power', 'power', 'power', 'shield', 'heal', 'bomb'];
  var POWER_META = {
    power:  { name: '火力', color: '#fbbf24', letter: 'P' },
    shield: { name: '护盾', color: '#38bdf8', letter: 'S' },
    heal:   { name: '修复', color: '#4ade80', letter: 'H' },
    bomb:   { name: '核弹', color: '#f472b6', letter: 'B' }
  };

  /** 该敌人是否掉落道具，掉落则返回道具类型 */
  function rollDrop(rng, type) {
    var e = ENEMIES[type] || ENEMIES.scout;
    var rate = e.drop;
    if (type === 'tank' || type === 'boss') rate = Math.min(1, rate + 0.25);
    if (rng() > rate) return null;
    return pick(rng, POWER_TYPES);
  }

  /* ------------------------------ 武器与得分 ------------------------------ */
  /** 火力等级 -> 子弹发射角度（度，0 为正上方） */
  var WEAPON_PATTERNS = {
    1: [0],
    2: [-4, 4],
    3: [0, -12, 12],
    4: [-4, 4, -18, 18],
    5: [0, -10, 10, -20, 20]
  };

  function weaponAngles(level) {
    var lv = clamp(level | 0, 1, 5);
    return WEAPON_PATTERNS[lv].slice();
  }

  /** 连击倍率：连杀越多分越高，上限 3 倍 */
  function comboMultiplier(combo) {
    return Math.min(3, 1 + Math.max(0, combo) * 0.1);
  }

  /* -------------------------------- 星空 -------------------------------- */
  function makeStars(count, rng, width, height) {
    rng = rng || Math.random;
    var stars = [];
    for (var i = 0; i < count; i++) {
      var layer = (rng() * 3) | 0;                 // 0 远 1 中 2 近
      stars.push({
        x: rng() * width,
        y: rng() * height,
        layer: layer,
        r: 0.6 + layer * 0.7 + rng() * 0.6,
        speed: 18 + layer * 46 + rng() * 18,
        alpha: 0.28 + layer * 0.24 + rng() * 0.2,
        twinkle: rng() * Math.PI * 2
      });
    }
    return stars;
  }

  function makeNebulas(count, rng, width, height) {
    rng = rng || Math.random;
    var list = [];
    var hues = [190, 265, 320, 225];
    for (var i = 0; i < count; i++) {
      list.push({
        x: rng() * width,
        y: rng() * height,
        r: range(rng, 110, 210),
        hue: hues[(rng() * hues.length) | 0],
        alpha: range(rng, 0.05, 0.13)
      });
    }
    return list;
  }

  /* ------------------------------ 其它小工具 ------------------------------ */
  /** 速度随波数提升后的敌人移动速度 */
  function enemySpeed(type, wave) {
    var e = ENEMIES[type] || ENEMIES.scout;
    return e.speed * difficulty(wave).speed;
  }

  /** 火力等级提升：1..5，重复吃到只加分 */
  function nextWeaponLevel(level) { return Math.min(5, (level | 0) + 1); }

  return {
    mulberry32: mulberry32,
    clamp: clamp,
    lerp: lerp,
    range: range,
    pick: pick,
    dist2: dist2,
    circleHit: circleHit,
    aabbHit: aabbHit,
    ENEMIES: ENEMIES,
    POWER_META: POWER_META,
    POWER_TYPES: POWER_TYPES,
    PATTERNS: PATTERNS,
    difficulty: difficulty,
    enemyHp: enemyHp,
    enemySpeed: enemySpeed,
    bossHp: bossHp,
    buildWave: buildWave,
    patternX: patternX,
    pickType: pickType,
    rollDrop: rollDrop,
    weaponAngles: weaponAngles,
    nextWeaponLevel: nextWeaponLevel,
    comboMultiplier: comboMultiplier,
    makeStars: makeStars,
    makeNebulas: makeNebulas
  };
});