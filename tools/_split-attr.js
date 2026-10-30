const fs = require('fs');
const F = 'D:/work space/学习刻不容缓/学习刻不容缓/学习刻不容缓/knowledge-idle/assets/data.js';
let src = fs.readFileSync(F, 'utf8');
/* 分流比例：直觉溢出最严重，分最多；严谨管攻血两条线，少分；雄辩分 1/4 给冷却 */
const SPLIT = {
  intuition: { to: 'precision', keep: 0.55 },
  rigor: { to: 'fortitude', keep: 0.80 },
  eloquence: { to: 'celerity', keep: 0.75 },
};
const RE = /attr:\{([^}]*)\}/g;
let n = 0;
const moved = {};
const out = src.replace(RE, (m, body) => {
  const pairs = body.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const parts = s.split(':');
    return [parts[0].trim(), parseInt(parts[1], 10)];
  });
  const res = [];
  for (const p of pairs) {
    const k = p[0], v = p[1];
    const rule = SPLIT[k];
    if (!rule || !v) { res.push([k, v]); continue; }
    const keep = Math.max(1, Math.round(v * rule.keep));
    const give = v - keep;
    if (keep > 0) res.push([k, keep]);
    if (give > 0) {
      res.push([rule.to, give]);
      moved[rule.to] = (moved[rule.to] || 0) + give;
    }
  }
  n++;
  return 'attr:{' + res.map(p => p[0] + ':' + p[1]).join(', ') + '}';
});
fs.writeFileSync(F, out, 'utf8');
console.log('改写', n, '条 attr');
console.log('分流出去的点数合计:', JSON.stringify(moved));
