/* 属性 2.0 平衡验证：拿真实存档跑一遍「旧规则 vs 新规则」
   node tools/_attr-sim.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const assets = path.join(__dirname, '..', 'assets');
const src = ['data.js', 'lore.js', 'game.js']
  .map(f => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');

const el = () => ({
  style: {}, dataset: {}, children: [], hidden: false, textContent: '', innerHTML: '',
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  appendChild() {}, remove() {}, addEventListener() {}, querySelector() { return null; },
  querySelectorAll() { return []; }, getContext() { return null; }, focus() {},
});
const ctx = { console, Math, Date, JSON, isFinite, isNaN, parseInt, parseFloat,
  Number, Object, Array, String, Boolean, Set, Map, Error, Infinity, NaN };
ctx.window = ctx; ctx.globalThis = ctx;
ctx.addEventListener = () => {};
ctx.document = { addEventListener() {}, querySelector() { return null; },
  querySelectorAll() { return []; }, createElement: el, getElementById() { return null; },
  hidden: false, body: el() };
ctx.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
ctx.location = { search: '' };
ctx.performance = { now: () => Date.now() };
ctx.requestAnimationFrame = () => 0; ctx.cancelAnimationFrame = () => {};
ctx.setInterval = () => 0; ctx.setTimeout = () => 0; ctx.clearTimeout = () => {};
vm.createContext(ctx);

const SAVE = JSON.parse(fs.readFileSync(
  'D:/work space/学习刻不容缓/.decoded-save.json', 'utf8'));

/* 用「分流前」的 data.js 在同一份存档上算一份基准，保证对比口径一致 */
function loadOldAttr() {
  const c2 = { console, Math, Date, JSON, Object, Array, String, Number, Set, Map };
  c2.window = c2; c2.globalThis = c2;
  vm.createContext(c2);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '_data-before-attr2.js'), 'utf8'), c2);
  c2.__SAVE__ = SAVE; c2.__OUT__ = null;
  vm.runInContext(`
    const out = {};
    Object.keys(__SAVE__.books).forEach(id => {
      const b = BOOKS.find(x => x.id === id);
      if (!b || b.type !== 'attr' || !b.attr) return;
      const st = __SAVE__.books[id];
      const q = QUALITIES[st.q];
      for (const k in b.attr) out[k] = (out[k] || 0) + b.attr[k] * (1 + 0.09 * (st.lv - 1)) * q.rate;
    });
    __OUT__ = out;
  `, c2);
  return c2.__OUT__;
}
ctx.__OLD__ = loadOldAttr();

vm.runInContext(src + '\n' + `
const s = __SAVE__;
S = defaultState();
S.books = s.books || {};
S.desk = s.desk || [];
S.equip = s.equip || { pen:null, paper:null, mirror:null, lamp:null, robe:null, seal:null };
S.paradigm = s.paradigm || 0;
S.era = s.era || 1;
S.talents = s.talents || {};
S.debunk = s.debunk || [];
S.memory = s.memory || 0;
S.comboSeen = s.comboSeen || [];
S.cards = s.cards || [];
S.quirkSeen = s.quirkSeen || [];

const P = stats();
const a = P.attr;
console.log('--- 分流后的七维 ---');
['insight','rigor','intuition','eloquence','precision','fortitude','celerity'].forEach(k => {
  console.log('  ' + ATTR_NAME[k] + ' ' + k.padEnd(10) + Math.round(a[k]));
});
console.log('--- 战斗数值 ---');
console.log('  攻击      ' + P.atk.toExponential(3));
console.log('  生命      ' + P.hp.toExponential(3));
console.log('  暴击率    ' + (P.crit * 100).toFixed(1) + '%   (旧: 60.0%)');
console.log('  暴击伤害  ×' + P.critDmg.toFixed(2) + '    (旧: ×2.78)');
console.log('  减伤      ' + (P.dmgCut * 100).toFixed(1) + '%   (旧: 0%)');
console.log('  冷却      ×' + P.cdMul.toFixed(3) + '   (旧: 依赖装备)');
console.log('  技能倍率  ×' + P.amp.toFixed(2));
console.log('  理论 DPS  ' + P.dps.toExponential(3));

/* 暴击期望倍率 + 攻击基数：用同一份存档的「分流前基准」对比，口径一致 */
const O = __OLD__;
const eqCD = P.critDmg - CRIT_DMG_BASE - a.precision * CRIT_DMG_PER;  /* 装备给的暴伤，前后一样 */
const oldCrit = Math.min(0.60, O.intuition * 0.006);
const oldCD = CRIT_DMG_BASE + eqCD;
const newExp = 1 + P.crit * (P.critDmg - 1);
const oldExp = 1 + oldCrit * (oldCD - 1);
console.log('--- 暴击：旧规则 vs 新规则 ---');
console.log('  旧  暴击 ' + (oldCrit * 100).toFixed(1) + '% × 暴伤 ×' + oldCD.toFixed(2) +
  '  →  期望 ×' + oldExp.toFixed(3));
console.log('  新  暴击 ' + (P.crit * 100).toFixed(1) + '% × 暴伤 ×' + P.critDmg.toFixed(2) +
  '  →  期望 ×' + newExp.toFixed(3) +
  '   (' + ((newExp / oldExp - 1) * 100).toFixed(1) + '%)');

console.log('--- 攻击基数（严谨分给沉毅的代价）---');
const oldBase = 12 + O.rigor * 2, newBase = 12 + a.rigor * 2;
console.log('  旧基数 12 + ' + Math.round(O.rigor) + '×2 = ' + Math.round(oldBase));
console.log('  新基数 12 + ' + Math.round(a.rigor) + '×2 = ' + Math.round(newBase) +
  '   (' + ((newBase / oldBase - 1) * 100).toFixed(1) + '%)');
console.log('  补偿：减伤 ' + (P.dmgCut * 100).toFixed(1) + '% → 等效血量 ×' +
  (1 / (1 - P.dmgCut)).toFixed(2) + '，冷却 ×' + P.cdMul.toFixed(3));
console.log('--- 净值（攻击基数 × 暴击期望 × 等效血量）---');
const oldNet = oldBase * oldExp * 1.0;
const newNet = newBase * newExp * (1 / (1 - P.dmgCut));
console.log('  旧 ' + oldNet.toFixed(0) + '  →  新 ' + newNet.toFixed(0) +
  '   (' + ((newNet / oldNet - 1) * 100).toFixed(1) + '%)');
`.replace('__SAVE__', JSON.stringify(SAVE)), ctx);
