/* ============================================================================
 *  test.js —— 核心逻辑测试（node test.js）
 * ==========================================================================*/
'use strict';

var C = require('./core.js');

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function group(t) { console.log('\n' + t); }

var W = 480;

/* ------------------------------------------------------------------ */
group('[1] 随机数与数学工具');
var r1 = C.mulberry32(12345), r2 = C.mulberry32(12345);
var same = true;
for (var i = 0; i < 20; i++) if (r1() !== r2()) same = false;
ok('同种子随机序列可复现', same);
var rv = C.mulberry32(7);
var inRange = true;
for (var j = 0; j < 500; j++) { var v = rv(); if (v < 0 || v >= 1) inRange = false; }
ok('随机数落在 [0,1)', inRange);
ok('clamp 边界正确', C.clamp(5, 0, 3) === 3 && C.clamp(-2, 0, 3) === 0 && C.clamp(2, 0, 3) === 2);
ok('lerp 正确', Math.abs(C.lerp(0, 10, 0.25) - 2.5) < 1e-9);
var rr = C.mulberry32(3);
var rangeOk = true;
for (var k = 0; k < 200; k++) { var x = C.range(rr, -5, 5); if (x < -5 || x > 5) rangeOk = false; }
ok('range 落在区间内', rangeOk);

/* ------------------------------------------------------------------ */
group('[2] 碰撞检测');
ok('圆-圆：重叠命中', C.circleHit(0, 0, 5, 8, 0, 5) === true);
ok('圆-圆：相切命中', C.circleHit(0, 0, 5, 10, 0, 5) === true);
ok('圆-圆：分离不命中', C.circleHit(0, 0, 5, 10.1, 0, 5) === false);
ok('矩形：重叠命中', C.aabbHit(0, 0, 5, 5, 8, 8, 5, 5) === true);
ok('矩形：分离不命中', C.aabbHit(0, 0, 5, 5, 11, 0, 5, 5) === false);

/* ------------------------------------------------------------------ */
group('[3] 敌人属性表');
var types = Object.keys(C.ENEMIES);
ok('包含 6 种敌人', types.length === 6, types.join(','));
var tableOk = true;
types.forEach(function (t) {
  var e = C.ENEMIES[t];
  if (!(e.hp > 0 && e.r > 0 && e.score > 0 && e.speed > 0 && e.color && e.name)) tableOk = false;
});
ok('属性完整（hp/r/score/speed/配色/名称）', tableOk);
ok('Boss 有特殊标记', C.ENEMIES.boss.r > C.ENEMIES.tank.r && C.ENEMIES.boss.score > C.ENEMIES.tank.score);

/* ------------------------------------------------------------------ */
group('[4] 难度曲线');
var d1 = C.difficulty(1), d10 = C.difficulty(10);
ok('第 1 波为基准值', d1.speed === 1 && Math.abs(d1.hp - 1) < 1e-9);
ok('波数越高速度越快', d10.speed > d1.speed, d10.speed.toFixed(2));
ok('波数越高血量越厚', d10.hp > d1.hp, d10.hp.toFixed(2));
ok('波数越高开火越密(间隔更小)', d10.fire < d1.fire, d10.fire.toFixed(2));
var hpOk = true;
for (var w = 1; w <= 30; w++) {
  types.forEach(function (t) {
    var hp = C.enemyHp(t, w);
    if (hp < 1 || hp !== Math.floor(hp)) hpOk = false;
  });
}
ok('各波敌人血量均为不小于 1 的整数', hpOk);
ok('母舰血量随等级提升', C.bossHp(2) > C.bossHp(1) && C.bossHp(3) > C.bossHp(2));

/* ------------------------------------------------------------------ */
group('[5] 波次编排');
var g = C.mulberry32(2026);
var waveOk = true, xOk = true, delayOk = true, typeOk = true;
for (var wave = 1; wave <= 30; wave++) {
  var plan = C.buildWave(wave, g, W);
  if (plan.wave !== wave) waveOk = false;
  if (wave % 5 === 0) {
    if (!plan.boss || plan.bossLevel !== wave / 5) waveOk = false;
  } else if (plan.boss) waveOk = false;
  if (!plan.spawns.length) waveOk = false;

  var lastDelay = -1;
  plan.spawns.forEach(function (s) {
    if (s.x < 0 || s.x > W) xOk = false;
    if (s.delay < lastDelay) delayOk = false;
    lastDelay = s.delay;
    if (!C.ENEMIES[s.type]) typeOk = false;
  });
}
ok('30 波编排结构正确（第 5/10/15… 波为 Boss）', waveOk);
ok('所有出生点横向坐标在画布内', xOk);
ok('出生延迟单调不减', delayOk);
ok('所有出生敌人类型合法', typeOk);

var p1 = C.buildWave(1, C.mulberry32(1), W);
var p12 = C.buildWave(12, C.mulberry32(1), W);
ok('波数越高敌人数量越多', p12.spawns.length >= p1.spawns.length,
  p1.spawns.length + ' -> ' + p12.spawns.length);
ok('第 1 波敌人数不少于 3', p1.spawns.length >= 3, p1.spawns.length);

var patOk = true;
C.PATTERNS.forEach(function (pat) {
  for (var n = 1; n <= 14; n++) {
    for (var i = 0; i < n; i++) {
      var x = C.patternX(pat, i, n, W, C.mulberry32(i + 1));
      if (x < 40 || x > W - 40) patOk = false;
    }
  }
});
ok('全部阵型的位置都留在安全区内', patOk);

/* ------------------------------------------------------------------ */
group('[6] 敌人挑选');
var pickOk = true, seenHigh = {};
var gr = C.mulberry32(99);
for (var wv = 1; wv <= 20; wv++) {
  for (var t2 = 0; t2 < 50; t2++) {
    var ty = C.pickType(wv, gr);
    if (!C.ENEMIES[ty]) pickOk = false;
    if (wv >= 8) seenHigh[ty] = true;
  }
}
ok('挑出的类型都合法', pickOk);
ok('高波次会出现重型机/战斗机', seenHigh.tank === true && seenHigh.fighter === true, Object.keys(seenHigh).join(','));

/* ------------------------------------------------------------------ */
group('[7] 道具掉落');
var dOk = true, dCount = 0;
var dr = C.mulberry32(5);
for (var i2 = 0; i2 < 4000; i2++) {
  var d = C.rollDrop(dr, 'fighter');
  if (d !== null) { if (C.POWER_TYPES.indexOf(d) === -1) dOk = false; dCount++; }
}
ok('掉落类型都合法', dOk);
ok('掉落率大致符合配置（150 左右）', dCount > 300 && dCount < 700, dCount);
ok('Boss 必定掉落', C.rollDrop(function () { return 0.99; }, 'boss') !== null);
ok('道具元数据齐全', C.POWER_TYPES.every(function (p) { return C.POWER_META[p] && C.POWER_META[p].letter; }));

/* ------------------------------------------------------------------ */
group('[8] 武器与连击');
var wOk = true;
for (var lv = 1; lv <= 5; lv++) {
  var ang = C.weaponAngles(lv);
  if (ang.length !== lv) wOk = false;
  if (ang.some(function (a) { return Math.abs(a) > 60; })) wOk = false;
}
ok('火力等级 1~5 对应 1~5 发子弹', wOk);
ok('越界火力等级被夹取', C.weaponAngles(99).length === 5 && C.weaponAngles(-3).length === 1);
ok('火力满级不再提升', C.nextWeaponLevel(5) === 5 && C.nextWeaponLevel(1) === 2);
ok('连击倍率：无连击为 1 倍', C.comboMultiplier(0) === 1);
ok('连击倍率上限为 3 倍', C.comboMultiplier(999) === 3);
ok('连击倍率随连击递增', C.comboMultiplier(10) > C.comboMultiplier(3));

/* ------------------------------------------------------------------ */
group('[9] 星空生成');
var sr = C.mulberry32(11);
var stars = C.makeStars(150, sr, W, 720);
ok('星星数量正确', stars.length === 150);
var starOk = stars.every(function (s) {
  return s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= 720 &&
         s.layer >= 0 && s.layer <= 2 && s.speed > 0 && s.r > 0 && s.alpha > 0;
});
ok('星星属性合法', starOk);
var nebulas = C.makeNebulas(5, sr, W, 720);
ok('星云数量与属性合法', nebulas.length === 5 && nebulas.every(function (n) { return n.r > 0 && n.alpha > 0; }));

/* ------------------------------------------------------------------ */
group('[10] 大压力：10 分钟波次的规模合理性');
var maxSpawn = 0, totalErr = 0;
var gr2 = C.mulberry32(4242);
for (var w20 = 1; w20 <= 200; w20++) {
  var pl = C.buildWave(w20, gr2, W);
  if (pl.spawns.length > maxSpawn) maxSpawn = pl.spawns.length;
  if (!pl.spawns.length) totalErr++;
}
ok('200 波中每波都有内容', totalErr === 0);
ok('单波敌人数量不超过 14', maxSpawn <= 14, maxSpawn);

console.log('\n========================================');
console.log(fail === 0 ? '全部通过：' + pass + ' 项断言' : (pass + ' 通过 / ' + fail + ' 失败'));
console.log('========================================');
process.exit(fail === 0 ? 0 : 1);