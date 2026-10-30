/* 验证分流是否守恒：同一份存档，分别用「分流前 / 分流后」的 data.js 算属性点 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assets = path.join(__dirname, '..', 'assets');

function loadAttrs(absPath) {
  const ctx = { console, Math, Date, JSON, Object, Array, String, Number, Set, Map, isFinite, isNaN };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(absPath, 'utf8'), ctx);
  const SAVE = JSON.parse(fs.readFileSync('D:/work space/学习刻不容缓/.decoded-save.json', 'utf8'));
  ctx.__SAVE__ = SAVE;
  ctx.__OUT__ = null;
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
  `, ctx);
  return ctx.__OUT__;
}

const before = loadAttrs(path.join(__dirname, '_data-before-attr2.js'));
const after = loadAttrs(path.join(assets, 'data.js'));
const KEYS = ['insight', 'rigor', 'intuition', 'eloquence', 'precision', 'fortitude', 'celerity'];
console.log('属性'.padEnd(12) + '分流前'.padStart(10) + '分流后'.padStart(10) + '  变化');
KEYS.forEach(k => {
  const b = Math.round(before[k] || 0), a = Math.round(after[k] || 0);
  const chg = b ? ((a / b - 1) * 100).toFixed(1) + '%' : '新增';
  console.log(k.padEnd(12) + String(b).padStart(10) + String(a).padStart(10) + '  ' + chg);
});
const sumB = KEYS.reduce((s, k) => s + (before[k] || 0), 0);
const sumA = KEYS.reduce((s, k) => s + (after[k] || 0), 0);
console.log('-'.repeat(46));
console.log('四维合计'.padEnd(11) + String(Math.round(sumB)).padStart(10) + String(Math.round(sumA)).padStart(10) +
  '  ' + ((sumA / sumB - 1) * 100).toFixed(2) + '%');
console.log('（分流后总和应该完全相等，说明点数只是搬家、没有凭空增减）');
