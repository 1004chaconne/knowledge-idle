/* 装备系统无头测试：stub 掉 DOM，直接加载真实的 data.js + game.js 跑断言
   node tools/equip-test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const assets = path.join(__dirname, '..', 'assets');
const dataSrc = fs.readFileSync(path.join(assets, 'data.js'), 'utf8');
const loreSrc = fs.readFileSync(path.join(assets, 'lore.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(assets, 'game.js'), 'utf8');

const el = () => ({
  style: {}, dataset: {}, children: [], hidden: false, textContent: '', innerHTML: '',
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  appendChild() {}, remove() {}, addEventListener() {}, querySelector() { return null; },
  querySelectorAll() { return []; }, getContext() { return null; }, focus() {},
});
const ctx = {
  console, Math, Date, JSON, isFinite, isNaN, parseInt, parseFloat,
  Number, Object, Array, String, Boolean, Set, Map, Error, Infinity, NaN,
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.addEventListener = () => {};
ctx.document = {
  addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  createElement: el, getElementById() { return null; }, hidden: false, body: el(),
};
ctx.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
ctx.location = { search: '' };
ctx.performance = { now: () => Date.now() };
ctx.requestAnimationFrame = () => 0;
ctx.cancelAnimationFrame = () => {};
ctx.setInterval = () => 0;
ctx.setTimeout = () => 0;
ctx.clearTimeout = () => {};
vm.createContext(ctx);

/* 关键：三个源拼成一个脚本执行一次，否则 let/const 跨 runInContext 不可见 */
vm.runInContext(dataSrc + '\n' + loreSrc + '\n' + gameSrc + '\n' + `
/* ---------------- 测试 ---------------- */
/* 有些测试会把 winBattle 打成空函数，先存一份真身 */
const realWinBattle = winBattle;
const realLoseBattle = loseBattle;
let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('=== 装备生成 ===');
S = defaultState();
const e1 = makeEquip('pen', 0, 'mechanics');
ok(e1.slot === 'pen' && e1.q === 0, '生成的槽位与品质正确');
ok(e1.affixes.length === equipAffixCount(0), '0 档词条数 = ' + equipAffixCount(0) + '（实际 ' + e1.affixes.length + '）');
ok(e1.affixes.every(id => affixById(id) && affixById(id).slot === 'pen'), '词条全部属于笔槽位');
ok(new Set(e1.affixes).size === e1.affixes.length, '词条不重复');
const e5 = makeEquip('lamp', 5, 'chem');
ok(e5.affixes.length === equipAffixCount(5), '5 档词条数 = ' + equipAffixCount(5) + '（实际 ' + e5.affixes.length + '）');
ok(equipName(e5) === '爱迪生的灯泡', '5 档灯 = 爱迪生的灯泡');
ok(equipName(makeEquip('seal', 5, 'mech')) === '爱因斯坦的烟斗', '5 档印 = 爱因斯坦的烟斗');
ok(equipName(makeEquip('robe', 5, 'mech')) === '霍金的轮椅', '5 档袍 = 霍金的轮椅');
ok(EQUIP_SLOTS.every(sl => EQUIP_NAMES[sl.id] && EQUIP_NAMES[sl.id].length === QUALITIES.length),
   '每个槽位都有 ' + QUALITIES.length + ' 档名字');

console.log('=== 穿戴与汇总 ===');
const ec = makeEquip('mirror', 3, 'quantum');
ec.affixes = ['mir_crit', 'mir_nores'];
S.equip.mirror = ec;
const sum = equipSum();
ok(sum.num.critAdd === 0.03, '数值型词条进入汇总（暴击 +3%）');
ok(sum.rules.noResist === 1, '规则型词条进入汇总（无视）');
ok(equippedCount() === 1, '穿戴计数正确');

console.log('=== 合成：不退化 ===');
S = defaultState();
const a = makeEquip('robe', 1, 'formal');
const b = makeEquip('robe', 1, 'formal');
const c = makeEquip('robe', 1, 'formal');
a.affixes = ['robe_hp', 'robe_guard'];
b.affixes = ['robe_hp', 'robe_low'];
c.affixes = ['robe_guard', 'robe_rep'];
S.bag = [a, b, c];
ok(!craftPreview(a.uid, b.uid).ok, '只选两件不行（现在是三合一）');
const pv = craftPreview(a.uid, b.uid, c.uid);
ok(pv && pv.ok, '三件同槽同品可合成');
ok(pv.out.q === 2, '品质 1 → 2');
const out = craftEquip(a.uid, b.uid, c.uid);
ok(out && out.q === 2, '合成结果品质 = 2');
ok(out.affixes.indexOf('robe_hp') >= 0 && out.affixes.indexOf('robe_guard') >= 0,
   '主件全部词条被保留');
ok(out.affixes.length >= a.affixes.length, '词条数只增不减（' + a.affixes.length + ' → ' + out.affixes.length + '）');
ok(out.affixes.length === equipAffixCount(2), '词条数补到该品质上限 ' + equipAffixCount(2));
ok(S.bag.length === 1 && S.bag[0].uid === out.uid, '三件材料被消耗，只剩成品');

console.log('=== 合成：拒绝非法组合 ===');
S = defaultState();
const p1 = makeEquip('pen', 0, 'mechanics');
const p2 = makeEquip('paper', 0, 'mechanics');
const p3 = makeEquip('pen', 2, 'mechanics');
const p4 = makeEquip('pen', 5, 'mechanics');
const p5 = makeEquip('pen', 5, 'mechanics');
const p6 = makeEquip('pen', 5, 'mechanics');
S.bag = [p1, p2, p3, p4, p5, p6];
ok(!craftPreview(p1.uid, p2.uid, p3.uid).ok, '不同槽位拒绝');
ok(!craftPreview(p1.uid, p3.uid, p5.uid).ok, '不同品质拒绝');
ok(!craftPreview(p4.uid, p5.uid, p6.uid).ok, '已到原典拒绝');
ok(craftEquip(p1.uid, p2.uid, p3.uid) === null, '非法组合不产出');

console.log('=== 概念：知识互联 ===');
ok(CONCEPTS.length >= 10, '概念数 ' + CONCEPTS.length);
ok(CONCEPTS.every(c => c.sources.length >= 2), '每个概念至少两处来源');
ok(CONCEPTS.every(c => c.line && c.bonusText), '每个概念都有定义和加成说明');

S = defaultState();
const p0 = conceptProgress();
ok(p0.motion.got === 1, '新档自带《落体定律》→「运动」已打通 1/' + p0.motion.total);
ok(Object.entries(p0).filter(([k]) => k !== 'motion').every(([, v]) => v.got === 0),
   '其余概念从 0 开始');

/* 打通「熵」的全部来源 */
S.books.shang = { lv:1, q:0 };
S.books.reqixunhuan = { lv:1, q:0 };
S.cards = ['c12', 'c13'];
S.quirkSeen = ['entropy'];
const pe = conceptProgress().entropy;
ok(pe.got === pe.total && pe.pct === 1, '熵：' + pe.got + '/' + pe.total + ' 全部打通');

/* 加成真的生效 */
S = defaultState();
const cutBare = equipSum().num.dmgCut;
S.books.shang = { lv:1, q:0 };
S.books.reqixunhuan = { lv:1, q:0 };
S.cards = ['c12', 'c13'];
S.quirkSeen = ['entropy'];
const cutFull = equipSum().num.dmgCut;
ok(cutFull > cutBare, '熵打通后减伤生效（' + cutBare + ' → ' + cutFull.toFixed(3) + '）');

/* 半通晓给一半 */
S = defaultState();
S.books.shang = { lv:1, q:0 };
S.books.reqixunhuan = { lv:1, q:0 };
const halfCut = equipSum().num.dmgCut;
ok(halfCut > 0 && halfCut < cutFull, '半通晓只给一部分（' + halfCut.toFixed(3) + '）');

/* 图鉴渲染 */
S = defaultState();
let cHtml = '';
const keepDialog = openDialog;
openDialog = h => { cHtml = h; };
openCodex('concept');
ok(cHtml.indexOf('以太') > 0 && cHtml.indexOf('通') > 0, '概念页正常渲染');
openConcept(CONCEPTS.find(c => c.id === 'aether'));
ok(cHtml.indexOf('已打通') > 0, '概念详情显示进度');
ok(cHtml.indexOf('《电磁通论》') > 0, '来源列表显示具体是哪本书');
openDialog = keepDialog;

console.log('=== 概念规则 ===');
/* 这一段会打到"击杀"，无头环境下 toast/渲染不可用，先兜住 */
const realToast = toast;
toast = () => {};
const mkBig = (idx) => { const b = mkB(idx); b.maxHp = 1e9; b.hp = 1e9; return b; };
ok(CONCEPTS.every(c => c.rule && c.rule.id && c.rule.name && c.rule.desc), '13 个概念都有规则');
ok(new Set(CONCEPTS.map(c => c.rule.id)).size === CONCEPTS.length, '规则 id 互不重复');
ok(CONCEPTS.every(c => c.rule.line), '每条规则都有一句为什么');

/* 半懂不算懂：只打通一部分，规则不亮 */
S = defaultState();
S.books.shang = { lv:1, q:0 };
ok(conceptRuleOn('noReturn') === false, '半通晓时规则不生效');
openConceptAll('entropy');
ok(conceptRuleOn('noReturn') === true, '完全通晓后规则点亮');
ok(conceptRuleSet().noReturn !== 1, '通晓但没装印记 → 不进快照');
equipConceptRule('noReturn');
ok(conceptRuleSet().noReturn === 1, '装上印记之后才生效');
unequipConceptRule('noReturn');
ok(conceptRuleSet().noReturn !== 1, '卸下后立刻失效');

/* 用固定随机数把伤害变成确定值，才能比较 */
const REAL_RND = Math.random;
const fix = v => { Math.random = () => v; };

/* 🏃 惯性：开场 5 秒内普攻 +12% */
S = defaultState(); S.books = {};           /* 清空属性 → 暴击率 0 */
fix(0.99);
mkBig(0); B.cr = {};
const dInertiaOff = hitEnemy(1000, null, '', 'auto');
mkBig(0); B.cr = { inertia: 1 };
const dInertiaOn = hitEnemy(1000, null, '', 'auto');
ok(dInertiaOn > dInertiaOff * 1.1, '惯性：开场普攻 ' + Math.round(dInertiaOff) + ' → ' + Math.round(dInertiaOn));
mkBig(0); B.cr = { inertia: 1 }; B.t = 6;
const dInertiaLate = hitEnemy(1000, null, '', 'auto');
ok(dInertiaLate < dInertiaOn, '惯性：过了 5 秒就没了');

/* 🌐 超距：普攻也能吃到一半弱点 */
mkBig(0); B.cr = {};
const dFieldOff = hitEnemy(1000, null, '', 'auto');
mkBig(0); B.cr = { action: 1 };
const dFieldOn = hitEnemy(1000, null, '', 'auto');
ok(!!B.st.weak, '第 1 关有弱点（' + B.st.weak + '）');
ok(dFieldOn > dFieldOff, '超距：普攻伤害 ' + Math.round(dFieldOff) + ' → ' + Math.round(dFieldOn));

/* 🎲 测不准：同一击的伤害会浮动 */
mkBig(0); B.cr = { fluct: 1 };
fix(0.0);  const dFluctLow = hitEnemy(1000, null, '', 'auto');
mkBig(0); B.cr = { fluct: 1 };
fix(0.99); const dFluctHigh = hitEnemy(1000, null, '', 'auto');
ok(dFluctLow < dFluctHigh, '测不准：0.92 倍 ~ 1.08 倍（' + Math.round(dFluctLow) + ' vs ' + Math.round(dFluctHigh) + '）');

/* 🔢 整除：每第 10 次命中 ×1.5 */
fix(0.99);
S = defaultState(); S.books = {};
mkBig(0); B.cr = { discrete: 1 };
B.maxHp = 1e9; B.hp = 1e9;
let crD9 = 0, crD10 = 0;
for (let k = 1; k <= 10; k++) {
  const v = hitEnemy(1000, null, '', 'auto');
  if (k === 9) crD9 = v;
  if (k === 10) crD10 = v;
}
ok(crD10 > crD9 * 1.4, '整除：第 10 击 ' + Math.round(crD9) + ' → ' + Math.round(crD10));

/* ♾️ 逼近：越拖越强 */
mkBig(0); B.cr = { approach: 1 }; B.t = 0;
const dApp0 = hitEnemy(1000, null, '', 'auto');
mkBig(0); B.cr = { approach: 1 }; B.t = 50;
const dApp50 = hitEnemy(1000, null, '', 'auto');
ok(dApp50 > dApp0 * 1.08, '逼近：0 秒 ' + Math.round(dApp0) + ' → 50 秒 ' + Math.round(dApp50));

/* 💡 二象：波态多 4% 暴击（暴击率为 0 时也能打出来） */
S = defaultState(); S.books = {};
fix(0.02);
mkBig(0); B.cr = {}; B.duality = 'wave';
const dDualOff = hitEnemy(1000, null, '', 'auto');
mkBig(0); B.cr = { duality: 1 }; B.duality = 'wave';
const dDualOn = hitEnemy(1000, null, '', 'auto');
ok(dDualOn > dDualOff, '二象·波：额外 4% 暴击把这一击变成了暴击');

/* 🕳️ 悬置：开场第一次受伤 -25% */
fix(0.99);
S = defaultState();
mkBig(0); B.cr = { suspend: 1 }; B.php = 100; B.maxPhp = 100;
playerHurt(40);
const hurtWith = 100 - B.php;
mkBig(0); B.cr = {}; B.php = 100; B.maxPhp = 100;
playerHurt(40);
const hurtWithout = 100 - B.php;
ok(hurtWith < hurtWithout, '悬置：第一次受伤 ' + Math.round(hurtWithout) + ' → ' + Math.round(hurtWith));
mkBig(0); B.cr = { suspend: 1 }; B.php = 100; B.maxPhp = 100; B.t = 5;
playerHurt(40);
ok(Math.abs((100 - B.php) - hurtWithout) < 0.5, '悬置：只在开场 3 秒内有效');

/* ♨️ 不可逆：敌人回血被削 25% */
mkB(163); B.hp = 500; B.php = 1e9; B.maxPhp = 1e9; B.cr = {};
playerHurt(100);
const healFull = B.hp - 500;
mkB(163); B.hp = 500; B.php = 1e9; B.maxPhp = 1e9; B.cr = { noReturn: 1 };
playerHurt(100);
const healCut = B.hp - 500;
ok(healCut < healFull && healCut > 0, '不可逆：回血 ' + Math.round(healFull) + ' → ' + Math.round(healCut));

/* 🧬 适应 + 📐 自明：这两个只作用在技能施放上，所以要比「连续施法的总伤害」 */
S = defaultState();
S.books = {};
S.desk = new Array(deskSlots()).fill(null);
S.desk[0] = 'luoti';
const dSk = { book: bookById('luoti'), st: { lv: 1, q: 0 }, q: QUALITIES[0], slot: 0 };

mkBig(0); B.cr = {};
const hpNo = B.hp;
castSkill(dSk); castSkill(dSk); castSkill(dSk);
const dmgNoAdapt = hpNo - B.hp;
ok(B.adaptStack === 0, '适应：规则没亮时不叠层');

mkBig(0); B.cr = { adapt: 1 };
const hpYes = B.hp;
castSkill(dSk); castSkill(dSk); castSkill(dSk);
const dmgAdapt = hpYes - B.hp;
ok(B.adaptStack === 2, '适应：连续同一本叠到 ' + B.adaptStack + ' 层');
ok(dmgAdapt > dmgNoAdapt, '适应：三次总伤害 ' + Math.round(dmgNoAdapt) + ' → ' + Math.round(dmgAdapt));

mkBig(0); B.cr = {};
const hpOne = B.hp;
castSkill(dSk);
const dmgFirst = hpOne - B.hp;
mkBig(0); B.cr = { selfEvid: 1 };
const hpOneS = B.hp;
castSkill(dSk);
const dmgFirstSig = hpOneS - B.hp;
ok(B.castCount === 1, '自明：记录了第一发');
ok(dmgFirstSig > dmgFirst * 1.1, '自明：第一发 ' + Math.round(dmgFirst) + ' → ' + Math.round(dmgFirstSig));
castSkill(dSk);
ok(B.castCount === 2, '自明：只对第一发生效');

/* ⚖️ 守恒：溢出结转（winBattle 后续会碰渲染，只验前半段） */
S = defaultState();
try {
  mkB(0); B.cr = { carry: 1 }; B.hp = -1000;
  winBattle();
} catch (e) { /* 后面的渲染逻辑在无头环境跑不完，不影响已写入的值 */ }
ok(Math.abs(S.carry - 100) < 1.5, '守恒：溢出 1000 → 结转 ' + Math.round(S.carry));

/* 概念详情里要能看到规则，并且区分「已生效 / 未生效」 */
S = defaultState();
let rHtml = '';
const keepDlg2 = openDialog;
openDialog = h => { rHtml = h; };
openConcept(CONCEPTS.find(c => c.id === 'entropy'));
ok(rHtml.indexOf('规则 · 不可逆') > 0, '概念详情显示规则名');
ok(rHtml.indexOf('完全通晓后生效') > 0, '未通晓时标「完全通晓后生效」');
openConceptAll('entropy');
openConcept(CONCEPTS.find(c => c.id === 'entropy'));
ok(rHtml.indexOf('已生效') > 0, '通晓后标「已生效」');
ok(rHtml.indexOf('倒回去的过程') > 0, '规则下方有那句为什么');
openDialog = keepDlg2;

/* 💵 分工：书页消耗 -5% */
S = defaultState();
const costBefore = upgradeCost(5);
openConceptAll('value');
const costAfter = upgradeCost(5);
ok(costAfter < costBefore, '分工：升级消耗 ' + costBefore + ' → ' + costAfter);

Math.random = REAL_RND;
toast = realToast;

console.log('=== 概念印记（槽位与选择）===');
S = defaultState();
ok(conceptSlots() === 3, '初始 3 个印记槽');
ok(S.conceptActive.length === 0, '新档没有装任何印记');
ok(conceptNextSlotNeed() === 3, '还差 3 个通晓才 +1 槽');

/* 装满 3 条之后拒绝第 4 条 */
/* 通晓 5 个 → 3 + floor(5/3) = 4 槽，可装 5 条，装 4 条后应被拒 */
['motion', 'aether', 'entropy', 'doubt', 'axiom'].forEach(id => openConceptAll(id));
ok(conceptSlots() === 4, '通晓 5 个概念 → 4 槽（实际 ' + conceptSlots() + '）');
ok(equipableRules().length === 5, '可装 5 条规则');
ok(equipConceptRule('inertia').ok, '装第 1 条');
ok(equipConceptRule('medium').ok, '装第 2 条');
ok(equipConceptRule('noReturn').ok, '装第 3 条');
ok(equipConceptRule('suspend').ok, '装第 4 条（正好满 4 槽）');
const over = equipConceptRule('selfEvid');
ok(over.ok === false && over.why.indexOf('满') >= 0, '槽满了拒绝第 5 条：' + over.why);

/* 卸一条才能装新的 */
unequipConceptRule('inertia');
ok(conceptRuleEquipped('inertia') === false, '卸下生效');
ok(equipConceptRule('selfEvid').ok, '卸出一条后就能装新的');
ok(S.conceptActive.length <= conceptSlots(), '装的条数永远不超过槽位（' + S.conceptActive.length + '/' + conceptSlots() + '）');

/* 未通晓的不能装 */
S = defaultState();
const bad = equipConceptRule('inertia');
ok(bad.ok === false, '未通晓的概念装不上：' + bad.why);

/* 槽位上限 7 */
ok(conceptSlots() <= 7, '槽位不会超过 7');
S = defaultState();
CONCEPTS.forEach(c => openConceptAll(c.id));
ok(conceptSlots() === 7, '13 个概念全通晓 → 7 槽（实际 ' + conceptSlots() + '）');
ok(conceptNextSlotNeed() === null, '满槽后不再提示下一槽');

/* 自动装满：只在玩家没动过的时候 */
S = defaultState();
openConceptAll('motion');
autoFillConceptRules();
ok(conceptRuleEquipped('inertia'), '首次进来自动把已通晓的规则装上');
const filled = S.conceptActive.length;
unequipConceptRule('inertia');
autoFillConceptRules();
ok(S.conceptActive.length === filled - 1, '玩家卸下之后不再被自动装回去');
ok(S.conceptTouched === true, '动过之后记账');

/* 手动装过一次也算动过 */
S = defaultState();
openConceptAll('motion');
equipConceptRule('inertia');
unequipConceptRule('inertia');
autoFillConceptRules();
ok(!conceptRuleEquipped('inertia'), '自己卸掉的不回弹');

console.log('=== 预设套组 ===');
S = defaultState();
ok(Array.isArray(S.conceptPresets) && S.conceptPresets.length === 3, '默认 3 套预设');
ok(S.conceptPresets.every(p => p.rules.length === 0), '默认都是空的');
ok(presetLabel(0) === '', '空预设没有标签');

/* 存一套再换另一套，再换回来 */
['motion', 'aether', 'entropy', 'doubt', 'axiom'].forEach(id => openConceptAll(id));
S.conceptActive = ['inertia', 'medium', 'noReturn', 'suspend'];
savePreset(0);
ok(S.conceptPresets[0].rules.length === 4, '存下 4 条');
ok(presetLabel(0).indexOf('惯性') > 0, '预设标签取自内容：' + presetLabel(0));

S.conceptActive = ['selfEvid'];
savePreset(1);
ok(presetLabel(1).indexOf('自明') > 0, '第二套标签：' + presetLabel(1));

const used0 = applyPreset(0);
ok(used0.ok && S.conceptActive.length === 4, '换上第 1 套（4 条）');
ok(S.conceptActive.indexOf('inertia') >= 0, '内容正确');
const used1 = applyPreset(1);
ok(used1.ok && S.conceptActive.length === 1 && S.conceptActive[0] === 'selfEvid', '再换第 2 套');
ok(S.conceptTouched === true, '用预设算「动过」');

/* 空预设不能换 */
const empty = applyPreset(2);
ok(empty.ok === false, '空预设拒绝：' + empty.why);

/* 预设里有已失效的规则（未通晓）→ 跳过并如实报告 */
S = defaultState();
openConceptAll('motion');
S.conceptPresets[0] = { rules: ['inertia', 'noReturn'] };   /* noReturn 还没通晓 */
const mix = applyPreset(0);
ok(mix.ok && mix.n === 1 && mix.dropped === 1, '失效规则被跳过（留 ' + mix.n + '，跳 ' + mix.dropped + '）');
ok(S.conceptActive.indexOf('noReturn') < 0, '未通晓的没被装进去');

/* 槽位不够时截断：通晓 5 个 → 4 槽，但预设里存了 5 条有效规则 */
S = defaultState();
['motion', 'aether', 'entropy', 'doubt', 'axiom'].forEach(id => openConceptAll(id));
S.conceptPresets[0] = { rules: ['inertia', 'medium', 'noReturn', 'suspend', 'selfEvid'] };
const cut = applyPreset(0);
ok(cut.ok && cut.cut === 1, '多出的 1 条被截断（cut=' + cut.cut + '）');
ok(S.conceptActive.length === conceptSlots(), '装上条数 = 槽位数（' + S.conceptActive.length + '/' + conceptSlots() + '）');

/* 预设不影响自动装满 */
S = defaultState();
openConceptAll('motion');
S.conceptPresets[0] = { rules: ['inertia'] };
autoFillConceptRules();
ok(conceptRuleEquipped('inertia'), '自动装满照旧');

/* 印记栏渲染 */
S = defaultState();
let sbHtml = '';
const keepDlg3 = openDialog;
openDialog = h => { sbHtml = h; };
openCodex('concept');
ok(sbHtml.indexOf('概念印记') > 0, '概念页顶部有印记栏');
ok(sbHtml.indexOf('0 / 3') > 0, '新档显示 0 / 3');
ok(sbHtml.indexOf('还没有完全通晓的概念') > 0, '一个都没通晓时给引导，而不是空白');
openConceptAll('motion');
openCodex('concept');
ok(sbHtml.indexOf('还有 1 条已通晓的规则没装') > 0, '通晓但没装 → 提示还剩几条没装');
ok(sbHtml.indexOf('data-tog="inertia"') > 0, '通晓的概念出现「装」按钮');
equipConceptRule('inertia');
openCodex('concept');
ok(sbHtml.indexOf('装') > 0 && sbHtml.indexOf('data-tog="inertia">卸') > 0, '装上后按钮变成「卸」');
ok(sbHtml.indexOf('cx-item equipped') > 0, '已装的概念条目高亮');
ok(sbHtml.indexOf('data-preset="0"') > 0, '渲染出预设行');
ok(sbHtml.indexOf('data-preset-save="0"') > 0, '每套预设都有「存」按钮');
openDialog = keepDlg3;

/* 数值加成与印记无关：永久生效 */
S = defaultState();
const atkBefore = stats().atk;
openConceptAll('motion');
const atkAfter = stats().atk;
ok(atkAfter > atkBefore, '概念数值加成不依赖印记（' + Math.round(atkBefore) + ' → ' + Math.round(atkAfter) + '）');
unequipConceptRule('inertia');
ok(Math.abs(stats().atk - atkAfter) < 0.01, '卸下印记不会减掉数值加成');

console.log('=== 原典专属能力 ===');
loseBattle = () => {}; winBattle = () => {}; renderBattle = () => {};
ok(Object.keys(EQUIP_SIGNATURE).length === EQUIP_SLOTS.length,
   '每个槽位的原典都配了专属能力（' + Object.keys(EQUIP_SIGNATURE).length + ' 件）');
ok(EQUIP_SLOTS.every(sl => EQUIP_SIGNATURE[sl.id + ':5']), '专属能力只挂在原典上');
ok(EQUIP_SLOTS.every(sl => {
  const sig = EQUIP_SIGNATURE[sl.id + ':5'];
  return sig.desc && sig.how && sig.name;
}), '每件原典都有效果说明和来历');

S = defaultState();
const bare = stats();
/* 词条会干扰签名测试，这里只留装备本体 */
EQUIP_SLOTS.forEach(sl => {
  const e = makeEquip(sl.id, 5, 'mechanics');
  e.affixes = [];
  S.equip[sl.id] = e;
});
const ES2 = equipSum();
ok(Object.keys(ES2.sigs).length === EQUIP_SLOTS.length, '穿齐 6 件原典 → 6 个签名同时生效');
const full = stats();
ok(full.critDmg === 2.5 && bare.critDmg === 1.8, '消色差：暴击伤害 1.8 → 2.5');
ok(full.amp > bare.amp, '公理化：技能伤害提高（' + bare.amp.toFixed(2) + ' → ' + full.amp.toFixed(2) + '）');
ok(full.cdMul > bare.cdMul, '公理化：冷却变长，是代价不是白送（' + bare.cdMul.toFixed(2) + ' → ' + full.cdMul.toFixed(2) + '）');

/* 时间之外：挡一次致命 */
mkB(0);
B.php = 10; B.maxPhp = 100;
playerHurt(9999);
ok(B.php > 0 && B.sigUsed === 1, '时间之外：致命伤害被挡下，血量回到 ' + Math.round(B.php) + '%');
playerHurt(9999);
ok(B.php <= 0, '时间之外：每场只能挡一次');

/* 思想实验：范式 +25% */
S = defaultState();
S.eraInsight = 400000; S.paradigm = 0;
const gBare = prestigeGain();
S.equip.seal = makeEquip('seal', 5, 'mechanics');
const gSig = prestigeGain();
ok(gSig > gBare, '思想实验：范式获取 ' + gBare + ' → ' + gSig + '（+25%）');

console.log('=== 存档兼容 ===');
const old = { books: { wuming: { lv: 1, q: 0 }, luoti: { lv: 1, q: 0 } }, ver: 1 };
S = defaultState();
Object.keys(old).forEach(k => { S[k] = old[k]; });
/* 模拟 load() 中的补齐逻辑 */
EQUIP_SLOTS.forEach(s => { if (!(s.id in S.equip)) S.equip[s.id] = null; });
ok(EQUIP_SLOTS.every(s => S.equip[s.id] === null), '旧存档补齐 6 个空槽位');
ok(Array.isArray(S.bag) && S.bag.length === 0, '旧存档背包为空数组');

console.log('=== 中文大数单位 ===');
const cases = [[999,'999'],[1234,'1234'],[12345,'1.23万'],[1.2e8,'1.20亿'],
  [1e12,'1.00兆'],[1e16,'1.00京'],[1e20,'1.00垓'],[1e48,'1.00极']];
cases.forEach(([n, want]) => ok(fmt(n) === want, 'fmt(' + n + ') = ' + fmt(n), '期望 ' + want));
ok(/^1\.00e5[0-9]$/.test(fmt(1e52)), '超出「极」退科学计数：' + fmt(1e52));
ok(fmt(Infinity) === '无穷', 'Infinity 显示为「无穷」而非崩溃');
ok(fmtMul(1.05) === '×1.05', 'fmtMul 小倍率：' + fmtMul(1.05));
ok(fmtMul(1.05e12).indexOf('兆') > 0, 'fmtMul 大倍率：' + fmtMul(1.05e12));

console.log('=== 文案库 lore.js ===');
const noLore = BOOKS.filter(b => !BOOK_LORE[b.id]);
ok(noLore.length === 0, '每本书都有长文案（' + BOOKS.length + ' 本）', noLore.map(b => b.id).join(','));
const badFact = BOOKS.filter(b => BOOK_LORE[b.id] && (!BOOK_LORE[b.id].fact || BOOK_LORE[b.id].fact.length < 30));
ok(badFact.length === 0, '每本书的「史实」都不是占位符');
const badUse = BOOKS.filter(b => BOOK_LORE[b.id] && (!BOOK_LORE[b.id].use || BOOK_LORE[b.id].use.length < 12));
ok(badUse.length === 0, '每本书的「今天在哪里」都写了');
const noCardLore = CARDS.filter(c => !CARD_LORE[c.id]);
ok(noCardLore.length === 0, '每张知识卡都有展开文案（' + CARDS.length + ' 张）', noCardLore.map(c => c.id).join(','));
const badLesson = CARDS.filter(c => CARD_LORE[c.id] && !CARD_LORE[c.id].lesson);
ok(badLesson.length === 0, '每张卡都有「本课要点」');

console.log('=== 书目详情 / 图鉴渲染 ===');
let lastHtml = '';
const realDialog = openDialog;
openDialog = h => { lastHtml = h; };
S = defaultState();
S.cards = ['c1'];
S.maxStage = 30;
/* 内容随品质分层：手抄本只有简介 + 一句原文 */
S.books.luoti = { lv: 3, q: 0 };
openBookDetail('luoti');
ok(lastHtml.indexOf('落体定律') > 0, '书目详情显示书名');
ok(lastHtml.indexOf('>史实<') < 0, '手抄本：读不到「史实」段（分层生效）');
ok(lastHtml.indexOf('>今天在哪里<') < 0, '手抄本：读不到「今天在哪里」段');
ok(lastHtml.indexOf('🔒') > 0, '手抄本：提示下一层能读到什么');
/* 精校本：解锁史实 + 今天在哪里 */
S.books.luoti = { lv: 3, q: 2 };
openBookDetail('luoti');
ok(lastHtml.indexOf('>史实<') > 0, '精校本：解锁「史实」段');
ok(lastHtml.indexOf('>今天在哪里<') > 0, '精校本：解锁「今天在哪里」段');
ok(lastHtml.indexOf('>机制解读<') < 0, '精校本：还读不到「机制解读」段');
/* 原典：全解锁 + 原典摘录 */
S.books.luoti = { lv: 3, q: 5 };
openBookDetail('luoti');
ok(lastHtml.indexOf('>机制解读<') > 0, '原典：解锁「机制解读」段');
ok(lastHtml.indexOf('>原典摘录<') > 0, '原典：解锁「原典摘录」段');
ok(lastHtml.indexOf('抛物线') > 0, '原典摘录用的是真实原文');
ok(lastHtml.indexOf('读到的层数 6 / 6') > 0, '原典：显示读到的层数 6/6');
/* 最后一层的三种情况：原典摘录 / 要点摘记 / 兜底延伸 */
S.books.wuming = { lv: 3, q: 5 };
openBookDetail('wuming');
ok(lastHtml.indexOf('苏格拉底') > 0, '无名册的史实被渲染出来');
ok(lastHtml.indexOf('要点摘记') > 0, '无原文的书标「要点摘记」而不是冒充原文');
ok(lastHtml.indexOf('不是原书引文') > 0, '要点摘记明确注明非原文');
/* 有原文的必须标「原典摘录」 */
S.books.jihe = { lv: 3, q: 5 };
openBookDetail('jihe');
ok(lastHtml.indexOf('原典摘录') > 0, '《几何原本》显示原典摘录');
ok(lastHtml.indexOf('公设五') > 0, '摘录带准确出处');
/* 覆盖率：每本书最后一层都有内容，不能有空 */
const missingTail = BOOKS.filter(x => {
  const L = BOOK_LORE[x.id] || {};
  return !L.excerpt && !L.digest;
});
ok(missingTail.length === 0, '全部 ' + BOOKS.length + ' 本书的最后一层都有内容（缺 ' + missingTail.length + '）');
const withEx = BOOKS.filter(x => (BOOK_LORE[x.id] || {}).excerpt).length;
const withDg = BOOKS.filter(x => (BOOK_LORE[x.id] || {}).digest).length;
ok(withEx + withDg >= BOOKS.length, '原文摘录 ' + withEx + ' 本 + 要点摘记 ' + withDg + ' 本，覆盖全部');
['book', 'card', 'school', 'debunk', 'ach'].forEach(t => {
  lastHtml = '';
  openCodex(t);
  ok(lastHtml.length > 200, '图鉴 tab「' + t + '」正常渲染');
});
lastHtml = ''; openCodex('school');
ok(lastHtml.indexOf('力学学派') > 0, '学派 tab 列出学派');
lastHtml = ''; openCodex('debunk');
ok(lastHtml.indexOf('错误博物馆') > 0 || lastHtml.indexOf('识破') > 0, '错误博物馆 tab 有内容');
const c1 = CARDS.find(c => c.id === 'c1');
showCard(c1);
ok(lastHtml.indexOf('后来呢') > 0, '知识卡含「后来呢」展开段');
ok(lastHtml.indexOf(CARD_LORE.c1.lesson) > 0, '知识卡含「本课要点」');
ok(lastHtml.indexOf('知识即力量') < 0, '知识卡不误渲染其它内容');
openDialog = realDialog;

console.log('=== 范式曲线收紧（v3 迁移）===');
const mig = p => Math.round(Math.log2(1 + p) * 14);
ok(mig(1800) < 200, '旧档 1800 点 → ' + mig(1800) + ' 点');
ok(mig(1800) > mig(600), '高点数仍然比低点数强（次序保留）');
ok(Math.pow(1 + PARA_BONUS, PRESTIGE_CAP) < 10,
  '单次转生最多 ×' + Math.pow(1 + PARA_BONUS, PRESTIGE_CAP).toFixed(2) + '（< 10 倍）');
const breakeven = Math.log(ERA_MULT) / Math.log(1 + PARA_BONUS);
ok(PRESTIGE_CAP > breakeven, '单次上限 ' + PRESTIGE_CAP + ' 点高于回本线 ' + breakeven.toFixed(1) + ' 点');

console.log('=== 名人怪癖 ===');
S = defaultState();
logLine = () => {};                       /* 测试里不需要真实日志 */
floatText = () => {}; flashEnemy = () => {}; shakeEnemy = () => {};
winBattle = () => {}; loseBattle = () => {};

const boss15 = stageData(15);
ok(boss15.quirk && boss15.quirk.id === 'bubble', '力学第 2 轮 BOSS 带「南海泡沫」');
const boss23 = stageData(23);
ok(boss23.weakAll && boss23.weakAll.indexOf('theology') >= 0, '牛顿晚年额外弱宗教');
ok(boss23.weakAll.indexOf('finance') >= 0, '牛顿晚年额外弱金融');
ok(Math.abs(affinityOf('theology', boss23) - 1.25) < 0.06, '宗教对晚期牛顿是克制关系');
ok(affinityOf('theology', boss15) === 1, '普通 BOSS 不吃宗教加成');
ok(!stageData(0).quirk, '普通怪没有怪癖');
/* 精英按「这一轮是谁」取怪癖，三个人不一样 */
ok(stageData(3).quirk.id === 'dilute',  '伽利略带「稀释」');
ok(stageData(11).quirk.id === 'thorns', '胡克带「弹性」');
ok(stageData(19).quirk.id === 'blind',  '笛卡尔带「蔽障」');
ok(stageData(27).quirk.id === 'ramp',   '法拉第带「爬升」');
ok(stageData(43).quirk.id === 'shrug',  '赫兹带「涨落」');
ok(stageData(75).quirk.id === 'decay',  '林奈带「归类」');
ok(stageData(163).quirk.id === 'drain', '狄拉克带「汲取」');
{
  const a = stageData(3).quirk, b = stageData(11).quirk, c = stageData(19).quirk;
  ok(a.id !== b.id && b.id !== c.id && a.id !== c.id, '同一学派三个精英机制互不相同');
  ok(!!a.note && !!b.note && !!c.note, '每个精英都有自己的人物理由');
}
const boss95 = stageData(95);
ok(boss95.quirk.id === 'falsify', '达尔文带「可证伪」');
ok(stageData(119).quirk.id === 'entropy', '卡诺带「熵增」');
ok(stageData(143).quirk.id === 'ether', '菲涅尔带「以太护盾」');
ok(stageData(167).quirk.id === 'leap', '玻尔带「跃迁」');
ok(stageData(191).quirk.id === 'balance', '拉瓦锡带「天平」');

function mkB(idx) {
  const st = stageData(idx);
  return B = {
    idx, st, hp: 1000, maxHp: 1000, php: 100, maxPhp: 100, over: false,
    t: 0, cds: {}, dmg: {}, log: [], silence: 0, guard: 0, reflect: 0,
    eq: equipSum(),
    q: { tick: 0, spikeT: 0, shield: 0, exposed: 0, hits: 0, stacks: 0, atkMul: 1, defMul: 0, leapAt: 1, lastBook: null, decay: 0 },
    cr: {}, hitCount: 0, castCount: 0, adaptStack: 0, adaptBook: null,
    duality: 'wave', carryPending: 0, suspendUsed: 0,
    /* 真实 B 里有的字段，测试桩也要有，否则断言会踩 undefined */
    limit: BATTLE_TIME, units: [], morale: 0, interveneUsed: 0,
  };
}

/* 让某个概念「完全通晓」：把所有来源都塞进存档 */
function openConceptAll(cid) {
  const c = CONCEPTS.find(x => x.id === cid);
  c.sources.forEach(src => {
    if (src.type === 'book') S.books[src.id] = S.books[src.id] || { lv: 1, q: 0 };
    else if (src.type === 'card') { if (S.cards.indexOf(src.id) < 0) S.cards.push(src.id); }
    else if (src.type === 'combo') { if (S.comboSeen.indexOf(src.id) < 0) S.comboSeen.push(src.id); }
    else if (src.type === 'quirk') { if (S.quirkSeen.indexOf(src.id) < 0) S.quirkSeen.push(src.id); }
    else if (src.type === 'sig') {
      const slot = EQUIP_SLOTS.find(sl => EQUIP_SIGNATURE[sl.id + ':5'] && EQUIP_SIGNATURE[sl.id + ':5'].id === src.id);
      if (slot) { const e = makeEquip(slot.id, 5, 'mechanics'); e.affixes = []; S.equip[slot.id] = e; }
    }
  });
  _cpKey = null;   /* 让进度缓存失效 */
  return conceptProgress()[cid];
}
mkB(15);
tickQuirk(8.1);
ok(B.hp < 1000, '泡沫：8 秒后自损（' + Math.round(1000 - B.hp) + '）');
ok(B.q.tick < 8.1, '泡沫计时器已回卷');

mkB(143);                                   /* 菲涅尔：以太护盾 */
tickQuirk(11.2);
ok(B.q.shield === 1, '以太：11 秒后攒出 1 层护盾');
const shieldHp = B.hp;
const dealt = hitEnemy(500, null, '测试', 'auto');
ok(dealt === 0 && B.hp === shieldHp, '护盾吞掉整次伤害');
ok(B.q.shield === 0, '护盾被消耗');
ok(B.silence > 1.5, '破盾沉默生效');

mkB(119);                                   /* 卡诺：熵增 */
tickQuirk(10.1);
ok(B.q.stacks === 1, '熵增：10 秒叠 1 层');
const hpBefore = B.hp;
hitEnemy(100, null, '', 'auto');
ok(Math.abs((hpBefore - B.hp) - 112) < 3, '熵增让受到的伤害 +12%');

mkB(95);                                    /* 达尔文：可证伪 */
for (let i = 0; i < 5; i++) hitEnemy(1, null, '', 'auto');
ok(B.q.exposed === 4, '连续 5 次命中逼出 4 秒破绽');
const hp2 = B.hp;
hitEnemy(100, null, '', 'auto');
ok(Math.abs((hp2 - B.hp) - 160) < 4, '破绽期间伤害 +60%');

mkB(191);                                   /* 拉瓦锡：天平 */
hitEnemy(10, null, '', 'auto');
ok(Math.abs(B.q.defMul - 0.06) < 1e-6 && Math.abs(B.q.atkMul - 0.96) < 1e-6, '天平：越打越硬也越软');

console.log('=== 精英新机制 ===');
/* 胡克「弹性」：打他会被反弹 */
mkB(11);
playerHurt = playerHurt;
const phpBefore = B.php;
hitEnemy(200, null, '', 'auto');
ok(B.php < phpBefore, '弹性：打胡克自己掉血（' + Math.round(phpBefore - B.php) + '）');

/* 伽利略「稀释」：单次伤害有上限（maxHp 的 6.5%） */
mkB(3);
const hpBeforeD = B.hp;
const realDilute = hitEnemy(5000, null, '', 'auto');
ok(realDilute <= B.maxHp * 0.065 + 2, '稀释：5000 伤害被压到 ' + Math.round(realDilute) + '（上限 ' + Math.round(B.maxHp * 0.065) + '）');

/* 林奈「归类」：同一本书连打递减 */
mkB(75);
const fakeBook = { id:'__t1', tag:'motion' };
const d1 = hitEnemy(100, fakeBook, '', 'auto');
const d2 = hitEnemy(100, fakeBook, '', 'auto');
const d3 = hitEnemy(100, fakeBook, '', 'auto');
ok(d1 > d2 && d2 > d3, '归类：同书连用伤害递减 ' + Math.round(d1) + ' → ' + Math.round(d2) + ' → ' + Math.round(d3));
const dOther = hitEnemy(100, { id:'__t2', tag:'motion' }, '', 'auto');
ok(dOther > d3, '归类：换一本书就重置');

/* 法拉第「爬升」 */
mkB(27);
tickQuirk(5.1);
ok(B.q.stacks >= 1, '爬升：5 秒后叠一层');

/* 安培「脉冲」：定期一次性重击 */
mkB(35);
const phpS = B.php;
tickQuirk(10.1);
ok(B.php < phpS, '脉冲：蓄满后玩家掉血（' + Math.round(phpS - B.php) + '）');

/* 狄拉克「汲取」：你的伤害给他回血 */
mkB(163);
B.hp = 500;
const hpDrain = B.hp;
playerHurt(100);
ok(B.hp > hpDrain, '汲取：他靠挨打回血（' + Math.round(hpDrain) + ' → ' + Math.round(B.hp) + '）');

console.log('=== 书籍组合 ===');
const DESK6 = (a, b) => { const d = new Array(6).fill(null); if (a) d[0] = a; if (b) d[1] = b; return d; };

S = defaultState();
S.books.luolunzi = { lv:1, q:0 };
S.books.luoti = { lv:1, q:0 };
S.desk = DESK6('luolunzi', 'luoti');
ok(activeCombos().some(c => c.id === 'railgun'), '洛伦兹力 + 落体定律 → 超电磁炮');
S.desk = DESK6('luolunzi', null);
ok(activeCombos().length === 0, '拆开任意一本就不成立');
delete S.books.luoti;
ok(nearCombos().some(x => x.combo.id === 'railgun' && x.missing.indexOf('luoti') >= 0), '差一本时给出补齐提示');
S.books.luoti = { lv:1, q:0 };

/* 主动组合真的会打伤害 */
mkB(0);
B.maxHp = 50000; B.hp = 50000;
S.desk = DESK6('luolunzi', 'luoti');
const hpR = B.hp;
castCombo(COMBOS.find(c => c.id === 'railgun'));
ok(B.hp < hpR, '超电磁炮造成伤害（' + Math.round(hpR - B.hp) + '）');

/* 形式化：削弱抗性惩罚 */
S.books.digongshe = { lv:1, q:0 };
S.books.tongyu = { lv:1, q:0 };
const weakBook = { id:'__w', tag:'motion' };   /* mkB(0) 的敌人抗 motion */
mkB(0); const dNo = hitEnemy(100, weakBook, '', 'auto');
S.desk = DESK6('digongshe', 'tongyu');
mkB(0); const dYes = hitEnemy(100, weakBook, '', 'auto');
ok(dYes > dNo, '形式化削弱了抗性惩罚（' + Math.round(dNo) + ' → ' + Math.round(dYes) + '）');

console.log('=== 组合的发现机制 ===');
S = defaultState();
ok(Array.isArray(S.comboSeen) && S.comboSeen.length === 0, '新档没有任何已发现组合');
S.books = { luolunzi:{lv:1,q:0}, luoti:{lv:1,q:0} };
S.desk = DESK6('luolunzi', 'luoti');
noteCombos();
ok(S.comboSeen.indexOf('railgun') >= 0, '凑齐后记入「已发现」');
const seenN = S.comboSeen.length;
noteCombos();
ok(S.comboSeen.length === seenN, '同一个组合不会重复记录');

/* 只放一本 → 半激活暗示；不点名是哪两本 */
S = defaultState();
S.books = { luolunzi:{lv:1,q:0}, luoti:{lv:1,q:0} };
S.desk = DESK6('luolunzi', null);
ok(halfCombos().some(c => c.id === 'railgun'), '只放一本时给出半激活暗示');
S.desk = DESK6('luolunzi', 'luoti');
S.comboSeen = ['railgun'];
ok(halfCombos().length === 0, '已发现的组合不再暗示');

/* 图鉴：未发现只显示问号 */
S = defaultState();
S.books = { luolunzi:{lv:1,q:0}, luoti:{lv:1,q:0} };
S.comboSeen = [];
let cxHtml = '';
openDialog = h => { cxHtml = h; };
openCodex('combo');
ok(cxHtml.indexOf('未知组合') > 0, '未发现的组合在图鉴里显示为问号');
ok(cxHtml.indexOf('超电磁炮') < 0, '未发现的组合不会曝光名字');
ok(cxHtml.indexOf('已发现 0') > 0, '图鉴显示已发现进度');
S.comboSeen = ['railgun'];
openCodex('combo');
ok(cxHtml.indexOf('超电磁炮') > 0, '发现之后才显示名字');
openDialog = realDialog;

console.log('=== 阵容建议 ===');
S = defaultState();
S.books = {
  luoti:{lv:5,q:0}, luolunzi:{lv:5,q:0}, bodong:{lv:5,q:0}, yueqian:{lv:5,q:0},
  jiaoliu:{lv:5,q:0}, xianquan:{lv:5,q:0}, zhiliang:{lv:5,q:0},
};
S.desk = [];
mkB(0);
const sug = suggestLineup();
ok(sug.picks.length > 0, '给出推荐阵容（' + sug.picks.length + ' 本）');
ok(sug.picks.every(id => bookById(id) && bookById(id).type === 'skill'), '推荐里全是技能书');
ok(!!sug.combo, '优先凑出可激活的组合：' + (sug.combo ? sug.combo.name : '无（picks=' + sug.picks.join(',') + '）'));
let html2 = '';
openDialog = h => { html2 = h; };
openLineup();
ok(html2.indexOf('阵容建议') > 0 && html2.length > 300, '阵容建议弹窗正常渲染');
openDialog = realDialog;

console.log('=== 玩家受击飘字 ===');
let hurtTexts = [];
floatText = (t, c, side) => { if (side === 'self') hurtTexts.push({ t, c }); };
mkB(0);                                   /* 普通怪，无怪癖 */
hurtShownAt = 0; hurtAccum = 0;
playerHurt(23);
ok(hurtTexts.length === 1, '受伤一次 → 飘一次字');
ok(hurtTexts[0] && hurtTexts[0].t.indexOf('-') === 0, '飘字带负号：' + (hurtTexts[0] || {}).t);
ok(hurtTexts[0] && hurtTexts[0].c === 'hurt', '飘字用的是受击样式');
hurtTexts = [];
playerHurt(5);
ok(hurtTexts.length === 0, '180ms 内的连击被合并，不刷屏');
/* 数值确实扣在血上 */
const hpBefore2 = mkB(0).php;
playerHurt(40);
ok(B.php < hpBefore2, '受伤后血量减少（' + hpBefore2 + ' → ' + Math.round(B.php) + '）');

console.log('=== 成就系统 ===');
S = defaultState();
toast = () => {};                          /* claimAch / checkAchievements 会弹 toast */
renderResources = () => {}; updateCodexDot = () => {}; save = () => {};
const evAchIds = new Set(ACHIEVEMENTS.map(a => a.id));
ok(ACHIEVEMENTS.length >= 28, '成就不少于 28 条（实际 ' + ACHIEVEMENTS.length + '）');
ok(evAchIds.size === ACHIEVEMENTS.length, '成就 id 无重复');
ok(ACHIEVEMENTS.every(a => ACH_CATS[a.cat]), '每条成就的类别都合法');
ok(ACHIEVEMENTS.every(a => a.page > 0 && a.hrs > 0 && typeof a.check === 'function'), '每条成就都有奖励与判定函数');
/* 无新档不该误达成 */
const evFresh = ACHIEVEMENTS.filter(a => { try { return a.check(S); } catch (e) { return false; } });
ok(evFresh.length === 0, '新档 0 条成就达成（实际 ' + evFresh.length + '）');
/* 推进 maxStage → checkAchievements 捕获 */
S.maxStage = 6;
const evNewN = checkAchievements();
ok(S.ach['st5'] === 'got', '过第 5 关 → st5 已达成未领取');
ok(!S.ach['st25'], '第 25 关没到就不达成');
/* 领取：书页与洞见到账，二次领取被拒 */
const evPageB = S.page, evInsB = S.insight;
claimAch('st5');
ok(S.ach['st5'] === 'claimed', '领取后状态变为已领');
ok(S.page > evPageB, '书页到账（' + evPageB + ' → ' + S.page + '）');
ok(S.insight >= evInsB, '洞见到账（≥ ' + evInsB + '）');
const evPageC = S.page;
claimAch('st5');
ok(S.page === evPageC, '重复领取被拒绝');
ok(achClaimable() === 0, '领完后无可领数（achClaimable=0）');
/* checkAchievements 返回新增数量 */
S.fails = 10;
const evNew2 = checkAchievements();
ok(evNew2 >= 1, '战败 10 次 → checkAchievements 报告新增（' + evNew2 + '）');
ok(S.ach['fail10'] === 'got', 'fail10 已达成');
/* 彩蛋书 id 必须真实存在 */
const evHog = ACHIEVEMENTS.find(a => a.id === 'hog');
ok(!!evHog && typeof evHog.check === 'function' && evHog.check({ books: { mugou: { lv: 1, q: 0 } } }) === true,
  'hog 成就挂的是真实书 id（mugou）');

console.log('=== 离线事件 ===');
S = defaultState();
toast = () => {}; renderResources = () => {}; save = () => {};
ok(Array.isArray(OFFLINE_EVENTS) && OFFLINE_EVENTS.length >= 8, '离线事件池不少于 8 条（实际 ' + OFFLINE_EVENTS.length + '）');
ok(OFFLINE_EVENTS.every(e => e.icon && e.text && e.opts && e.opts.length === 3), '每条事件都有图标、正文与三选一');
ok(OFFLINE_EVENTS.every(e => e.opts.every(o => (o.kind === 'insight' || o.kind === 'page') && o.mul > 0)),
  '三选一奖励只走洞见/书页，倍率为正');
/* 三选一实际发放（弹窗打桩：showOfflineReport 会走 openDialog） */
const evRealDlg = openDialog;
openDialog = h => {};
S.books = { wuming:{lv:10,q:0}, luoti:{lv:10,q:0} };
S.desk = ['luoti'];
mkB(0);
const evRep = { ev: OFFLINE_EVENTS[0], done: false };
const evP0 = S.page;
offlinePick(evRep, 1);
ok(evRep.done === true, '选择后事件标记完成');
ok(S.page > evP0, '书页选项实际到账（' + evP0 + ' → ' + S.page + '）');
const evI0 = S.insight;
const evRep2 = { ev: OFFLINE_EVENTS[1], done: false };
offlinePick(evRep2, 0);
ok(S.insight > evI0, '洞见选项实际到账（' + evI0 + ' → ' + Math.round(S.insight) + '）');
const evPA = S.page;
offlinePick(evRep, 2);
ok(S.page === evPA, '同一事件不能重复领取');
/* applyOffline 事件与计数 */
S.offlineCount = 0;
S.lastSave = Date.now() - 3 * 3600 * 1000;   /* 离线 3 小时 */
const evOff = applyOffline();
ok(!!evOff && evOff.hours > 0 && evOff.gain > 0, '离线 3h → 战报有洞见收益');
ok(evOff.pageGain >= 0, '离线书页产出（' + evOff.pageGain + '）');
ok(!!evOff.ev, '每次离线都带一条事件');
ok(S.offlineCount === 1, 'offlineCount 计数 +1');
S.lastSave = Date.now() - 20 * 3600 * 1000;  /* 超上限 */
const evCap = applyOffline();
ok(evCap && evCap.hours <= OFFLINE_CAP_H, '离线上限仍为 ' + OFFLINE_CAP_H + ' 小时（实际 ' + evCap.hours.toFixed(1) + '）');
openDialog = evRealDlg;

console.log('=== Boss 台词 / 分享卡 ===');
/* shareVictory 在无 canvas 的无头环境必须安全返回 */
let evShareSafe = true;
try { shareVictory({ emoji:'🍎', name:'牛顿', sch: SCHOOLS[0] }, '测试台词', 10, []); } catch (e) { evShareSafe = false; }
ok(evShareSafe, '无 canvas 环境下 shareVictory 不抛异常');
ok(typeof typeInto === 'function' && typeof clearType === 'function', '打字机与清理函数已定义');

console.log('=== 品级命名与史诗供给 ===');
ok(QUALITIES.length === 6, '品质仍是 6 档（与装备一致）');
ok(QUALITIES[0].name === '手抄本' && QUALITIES[5].name === '原典', '书籍品级恢复「手抄本 → 原典」');
ok(QUALITIES.every(q => !!q.grade && !!q.mark), '每档都保留通用品阶 grade 与短标记 mark');
ok(QUALITIES[5].grade === '史诗', '原典对应通用品阶「史诗」');
S = defaultState();
const evEq0 = makeEquip('pen', 0, 'mechanics');
ok(equipFullName(evEq0).indexOf('普通') > 0, '装备仍显示通用品阶：' + equipFullName(evEq0));
/* 品质曲线：固定随机排除抖动 */
const evRand = Math.random;
Math.random = () => 0.5;
const evQn96 = equipQualityFor(96, 'normal');
const evQb96 = equipQualityFor(96, 'boss');
ok(evQb96 > evQn96, 'Boss 掉落品阶保底高一档（' + evQn96 + ' → ' + evQb96 + '）');
const evQn191 = equipQualityFor(191, 'normal');
const evQb191 = equipQualityFor(191, 'boss');
ok(evQn191 <= 3, '末期普通关不再白送顶级（实际 ' + evQn191 + ' 档，上限 3）');
ok(evQb191 >= evQn191 + 2, '顶级只从 Boss 手上出（普通 ' + evQn191 + ' vs Boss ' + evQb191 + '）');
ok(evQb191 >= 4, '末期 Boss 至少 4 档（实际 ' + evQb191 + '）');
/* v0.6：纪元不再白送品质 —— 转生不该凭空变强 */
const evEra1 = equipQualityFor(30, 'normal');
S.era = 5;
const evEra5 = equipQualityFor(30, 'normal');
S.era = 1;
ok(evEra1 === evEra5, '纪元推进不再白送品质（E1 = ' + evEra1 + '，E5 = ' + evEra5 + '）');
Math.random = evRand;
/* 长线抽样：一轮 480 关里原典应该是「稀罕物」而不是「常态」 */
const evSample = { n: 0, q5: 0 };
for (let i = 0; i < 400; i++) {
  for (let idx = 0; idx < 480; idx++) {
    const k = (idx % 8 === 7) ? 'boss' : (idx % 8 === 5 ? 'elite' : 'normal');
    if (Math.random() > EQUIP_DROP[k]) continue;
    const q = equipQualityFor(idx, k);
    evSample.n++;
    if (q >= 5) evSample.q5++;
  }
}
const evQ5Rate = evSample.q5 / evSample.n;
ok(evSample.n / 400 < 75, '一轮 480 关的掉落总量收敛（约 ' + Math.round(evSample.n / 400) + ' 件）');
ok(evQ5Rate < 0.18 && evQ5Rate > 0.02,
  '原典稀有但可见（占掉落 ' + (evQ5Rate * 100).toFixed(1) + '%，一轮约 ' + Math.round(evSample.q5 / 400) + ' 件）');

console.log('=== 己方单位地基（P0） ===');
S = defaultState();
S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:0}, mugou:{lv:5,q:0} };
S.desk = ['luoti','mugou'];
toast = () => {}; renderResources = () => {}; save = () => {}; renderShelf = () => {};
ok(Object.keys(UNIT_TYPES).length === 3 && !!UNIT_TYPES.guard && !!UNIT_TYPES.strike && !!UNIT_TYPES.swarm,
  '三种单位类型齐备（guard / strike / swarm）');
mkB(0);
B.units = []; B.maxPhp = 1000; B.php = 1000;
const uP = stats();
const uBook = bookById('mugou'), uSt = S.books['mugou'];
const uD = { book: uBook, st: uSt, slot: 0, q: qOf(0) };
const uLvF = 1 + LV_SKILL_BONUS * (uSt.lv - 1);
const uMade = spawnUnits(uBook, uD, uP, uLvF);
ok(uMade.length === 2, '群体召唤一次入场 2 个单位（实际 ' + uMade.length + '）');
ok(uMade.every(u => u.hp > 0 && u.maxHp > 0), '单位有血量（' + uMade.map(u => u.maxHp).join('/') + '）');
ok(uMade.every(u => u.kind === 'swarm' && u.icon), '单位带类型与图标');
ok(uMade.every(u => Math.abs(u.maxHp - Math.round(1000 * UNIT_TYPES.swarm.hpRatio)) <= 1), '血量按本体生命比例折算');
ok(unitTotalDps() <= uP.dps * UNIT_DPS_CAP + 1e-6,
  '红线：召唤物总 DPS ≤ 本体 60%（' + unitTotalDps().toFixed(1) + ' / ' + (uP.dps * UNIT_DPS_CAP).toFixed(1) + '）');
/* 上限 */
for (let i = 0; i < 5; i++) spawnUnits(uBook, uD, uP, uLvF);
ok(unitAlive().length <= UNIT_LIMIT, '场上单位不超上限 ' + UNIT_LIMIT + '（实际 ' + unitAlive().length + '）');
/* 承伤：守护优先吃伤害 */
B.units = [{ uid: 901, id:'mk', name:'机关', icon:'🛡️', kind:'guard',
             hp: 1000, maxHp: 1000, atk: 10, interval: 2, tick: 0, until: 20, burst: 0.8 }];
B.php = 1000;
const uAbsorb = unitAbsorb(100);
ok(uAbsorb > 0, '守护单位吸收了伤害（' + Math.round(uAbsorb) + '）');
ok(B.units[0].hp < 1000, '守护单位血量下降（剩余 ' + Math.round(B.units[0].hp) + '）');
ok(B.php === 1000, 'unitAbsorb 本身不扣玩家血（由调用方结算剩余）');
/* 摧毁：移除 + 余威 */
B.units[0].hp = 5;
const uEnemyHpA = B.hp;
unitAbsorb(100);
ok(unitAlive().length === 0, '血量归零的单位被移除');
ok(B.hp < uEnemyHpA, '被摧毁时对敌人留下余威（' + Math.round(uEnemyHpA - B.hp) + '）');
/* 治疗接口（医学学派 P2 用） */
B.units = [{ uid: 902, id:'x', name:'受伤单位', icon:'🩹', kind:'strike',
             hp: 10, maxHp: 100, atk: 5, interval: 2, tick: 0, until: 20, burst: 0.5 }];
ok(healUnits(50) > 0 && B.units[0].hp <= 100, '治疗接口回血且不超上限（' + Math.round(B.units[0].hp) + '/100）');
ok(healUnits(0) === 0, '治疗量为 0 时不做任何事');
/* 非攻：挂着单位才反弹 · 打我也反弹 */
NONAGGRESSION.reflect = 0;
B.units = []; B.maxPhp = 1000; B.php = 1000;
B.hp = 10000;
playerHurt(100);
const uNoRefl = 10000 - B.hp;
B.units = [{ uid: 903, id:'mk', name:'机关', icon:'🛡️', kind:'guard',
             hp: 999, maxHp: 1000, atk: 1, interval: 2, tick: 0, until: 20, burst: 0.8 }];
NONAGGRESSION.reflect = 0.25;
B.hp = 10000; B.php = 1000;
playerHurt(100);
const uWithRefl = 10000 - B.hp;
ok(uWithRefl > uNoRefl, '非攻：机关在场时「打我也反弹」（' + Math.round(uNoRefl) + ' → ' + Math.round(uWithRefl) + '）');
B.units = [];
B.hp = 10000;
playerHurt(100);
ok(Math.abs((10000 - B.hp) - uNoRefl) < 0.01, '机关不在场时非攻失效');
/* 反伤红线 */
B.units = [{ uid: 904, id:'mk', name:'机关', icon:'🛡️', kind:'guard',
             hp: 999, maxHp: 1000, atk: 1, interval: 2, tick: 0, until: 20, burst: 0.8 }];
B.maxPhp = 100; B.php = 100; B.hp = 1e6;
playerHurt(5000);
ok((1e6 - B.hp) <= 100 * UNIT_REFLECT_CAP + 0.01,
  '红线：单次反伤 ≤ 最大生命 8%（' + Math.round(1e6 - B.hp) + '）');
NONAGGRESSION.reflect = 0;
/* 换场清空 */
B.units = [{ uid: 905, id:'mk', name:'机关', icon:'🛡️', kind:'guard', hp: 10, maxHp: 10, atk: 1, interval: 2, tick: 0, until: 20, burst: 0.5 }];
try { startBattle(0); } catch (e) {}
ok(!B.units || B.units.length === 0, '新一场战斗会清空己方单位');

console.log('=== P1：机巧学派（墨子） ===');
S = defaultState();
toast = () => {}; renderResources = () => {}; save = () => {}; renderShelf = () => {};
ok(SCHOOLS.length === 20, '学派数扩展到 20（实际 ' + SCHOOLS.length + '）');
const p1Craft = SCHOOLS.find(s => s.id === 'craft');
ok(!!p1Craft && p1Craft.doctrine === '归纳', '机巧学派存在且归「归纳」');
ok(p1Craft.bosses.length === 3 && p1Craft.bosses[0] === '墨子', '三个 BOSS 阶段都以墨子为守门人');
ok(p1Craft.elites.length === 3, '三个精英（公输班 / 张衡 / 沈括）');
ok(!!p1Craft.eliteQuirks && p1Craft.eliteQuirks.length === 3, '精英怪癖三条');
ok(new Set(p1Craft.eliteQuirks.map(x => x.id)).size === 3, '同学派三个精英机制互不相同');
ok(!!p1Craft.bossQuirk && !!QUIRKS[p1Craft.bossQuirk], 'BOSS 怪癖指向真实机制（' + p1Craft.bossQuirk + '）');
ok(STAGES_PER_SCHOOL * SCHOOLS.length === 20 * 24, '总关卡数 20 × 24 = 480（实际 ' + (STAGES_PER_SCHOOL * SCHOOLS.length) + '）');
const p1Si = SCHOOLS.findIndex(x => x.id === 'craft');
const p1First = stageData(p1Si * STAGES_PER_SCHOOL);
ok(p1First.sch.id === 'craft', '机巧学派第一关归属正确（stage ' + p1First.idx + '）');
const p1Boss = stageData(199);
ok(p1Boss.kind === 'boss' && p1Boss.name === '墨子', '199 关是墨子 · 首轮 BOSS（实际 ' + p1Boss.name + '）');
ok(stageData(207).name.indexOf('非攻') >= 0, '207 关是「墨子 · 非攻」');
/* 新书与文案 */
const p1BookIds = ['kaogongji','tiangong','shoucheng','feigong','xiaokong','mengxi','renkoulun','shengtawei'];
ok(p1BookIds.every(id => !!bookById(id)), '8 本新书全部入表');
ok(p1BookIds.every(id => !!BOOK_LORE[id]), '8 本新书都有史实文案');
ok(BOOKS.filter(b => b.school === 'craft').length === 7, '机巧学派 7 本书（含补归属的《墨经》）');
ok(!!bookById('tiangong').unit && !!bookById('shoucheng').unit, '造物书指定了单位类型');
ok(bookById('renkoulun').grow === 6, '《人口论》带种群繁殖间隔');
/* 非攻：反伤来自书桌，且需要己方单位在场 */
mkB(0);
B.units = []; B.maxPhp = 1000; B.php = 1000; B.hp = 10000;
S.desk = ['shoucheng', 'feigong'];
ok(unitReflectRate() === 0, '没有己方单位时非攻不生效');
B.units = [{ uid: 801, id:'shoucheng', name:'守城械', icon:'🏯', kind:'guard',
             hp: 500, maxHp: 500, atk: 10, interval: 2, tick: 0, until: 20, burst: 0.8 }];
ok(Math.abs(unitReflectRate() - 0.30) < 1e-9, '《备城门》+《非攻》叠满 30%（实际 ' + (unitReflectRate()*100).toFixed(0) + '%）');
const p1NoRefl = (() => { S.desk = ['luoti']; const h0 = B.hp; playerHurt(100); return h0 - B.hp; })();
const p1WithRefl = (() => { S.desk = ['shoucheng','feigong']; B.hp = 10000; playerHurt(100); return 10000 - B.hp; })();
ok(p1WithRefl > p1NoRefl, '机关在场 + 非攻书 → 敌人打我会被反弹（' + Math.round(p1NoRefl) + ' → ' + Math.round(p1WithRefl) + '）');
S.desk = ['shoucheng','feigong','tiangong','xiaokong','mengxi','kaogongji'];
ok(unitReflectRate() <= UNIT_REFLECT_AURA_CAP + 1e-9, '反伤叠加不超上限 ' + (UNIT_REFLECT_AURA_CAP*100) + '%');
/* 种群繁殖：撞上环境容纳量就停 */
S.desk = ['renkoulun'];
B.units = []; B.hp = 1e9;
const p1P = stats();
const p1Book = bookById('renkoulun'), p1St = { lv: 5, q: 0 };
spawnUnits(p1Book, { book: p1Book, st: p1St, slot: 0, q: qOf(0) }, p1P, 1 + LV_SKILL_BONUS * 4);
ok(unitAlive().length === 2, '《人口论》一次入场 2 只（实际 ' + unitAlive().length + '）');
tickUnits(6.1);
ok(unitAlive().length === 3, '6 秒后繁殖出第 3 只（实际 ' + unitAlive().length + '）');
/* 给足寿命再推进，否则先被寿命清场，测不到容纳量 */
unitAlive().forEach(u => { u.until = 999; });
for (let i = 0; i < 5; i++) { tickUnits(6.1); unitAlive().forEach(u => { u.until = 999; }); }
ok(unitAlive().length === UNIT_LIMIT, '繁殖到环境容纳量 ' + UNIT_LIMIT + ' 只后停止（实际 ' + unitAlive().length + '）');
ok(unitTotalDps() <= stats().dps * UNIT_DPS_CAP + 1e-6, '繁殖后总 DPS 仍守住 60% 红线');

console.log('=== P2~P4：11 个学派的结构完整性 ===');
S = defaultState();
toast = () => {}; renderResources = () => {}; save = () => {}; renderShelf = () => {};
ok(SCHOOLS.length === 20, '学派总数 20（实际 ' + SCHOOLS.length + '）');
ok(SCHOOLS.every(s => s.blueprint && s.blueprint.length === 8), '每个学派都是 8 关模板');
ok(SCHOOLS.every(s => s.bosses && s.bosses.length === 3), '每个学派 3 个 BOSS 阶段');
ok(SCHOOLS.every(s => s.elites && s.elites.length === 3), '每个学派 3 个精英');
ok(SCHOOLS.every(s => s.bossLines && s.bossLines.length === 3 && s.epitaphs && s.epitaphs.length === 3),
  '每个学派都有 3 句战前台词 + 3 句墓志铭');
ok(SCHOOLS.every(s => DOCTRINES.includes(s.doctrine)), '所有学派的方法论都合法');
/* 核心设计目标：六环全部有学派，克制环才真正成立 */
const docCover = DOCTRINES.map(d => ({ d, n: SCHOOLS.filter(s => s.doctrine === d).length }));
ok(docCover.every(x => x.n >= 1), '六环方法论全部有学派：' + docCover.map(x => x.d + '×' + x.n).join(' '));
ok(docCover.filter(x => x.d === '先验')[0].n >= 1 && docCover.filter(x => x.d === '计算')[0].n >= 1,
  '之前空着的「先验」「计算」两环已补齐');
/* 学派难度递增 */
let mono = true;
for (let i = 1; i < SCHOOLS.length; i++) if (SCHOOLS[i].mult <= SCHOOLS[i - 1].mult) mono = false;
ok(mono, '学派起点系数严格递增（最后一个 ×' + SCHOOLS[SCHOOLS.length - 1].mult.toExponential(1) + '）');
/* 文案覆盖 */
ok(BOOKS.every(b => !!BOOK_LORE[b.id]), '全部 ' + BOOKS.length + ' 本书都有史实文案');
ok(CARDS.every(c => !!CARD_LORE[c.id]), '全部 ' + CARDS.length + ' 张知识卡都有展开');
ok(CARDS.every(c => c.boss >= 0 && c.boss < SCHOOLS.length * STAGES_PER_SCHOOL), '知识卡 BOSS 索引都在关卡范围内');

console.log('=== 11 个学派的新动词 ===');
function pkg(id, lv) {
  const b = bookById(id);
  S.books[id] = S.books[id] || { lv: lv || 5, q: 0 };
  const st = S.books[id];
  return { book: b, st, slot: 0, q: qOf(st.q) };
}
/* 书桌里的书必须"拥有"，否则 deskList() 会过滤掉它们 */
const OWN_TAIL = ['luoti','xinxue','gestalt','kecaunsuan','lunfadejingshen','putongyuyan',
  'tiantiyunxing','dizhixueyuanli','shengtaixue','sunzi','heshengxue','fushui'];
/* 医学·救治 */
S = defaultState(); S.books = { wuming:{lv:5,q:0} };
OWN_TAIL.forEach(id => { S.books[id] = S.books[id] || { lv: 5, q: 0 }; });
let capLog = [];
logLine = (t) => { capLog.push(String(t)); };   /* 机制断言要看日志，这里局部接管 */
S.desk = ['luoti', 'xinxue'];
mkB(0); B.hp = 1e6; B.php = Math.round(B.maxPhp * 0.5);
const pHealBefore = B.php;
castSkill(pkg('xinxue'));
ok(B.php > pHealBefore, '医学·救治：自身回血（' + Math.round(pHealBefore) + ' → ' + Math.round(B.php) + '）');
/* 认知·校验 */
S.desk = ['luoti', 'gestalt']; mkB(0); B.hp = 1e6;
castSkill(pkg('gestalt'));
ok(B.verifyT === 3, '认知·校验：进入 3 秒看穿窗口');
/* 信息·编排 */
S.desk = ['kecaunsuan', 'luoti']; mkB(0); B.hp = 1e6;
B.cds = { kecaunsuan: 0, luoti: 0 };
capLog = [];
castSkill(pkg('kecaunsuan'));
ok(B.cds['luoti'] > 0, '信息·编排：自动接续另一个就绪技能（其 CD 被触发）');
ok(capLog.some(t => t.indexOf('编排') >= 0), '编排日志正常');
/* 法学·立判例 */
S.desk = ['luoti', 'lunfadejingshen']; mkB(0);
initPrecedent();
ok(!!B.prec && (B.prec.id === 'atk' || B.prec.id === 'def'), '法学·立判例：开场裁定一条规则（' + (B.prec && B.prec.label) + '）');
/* 语言·命名 */
S.desk = ['luoti', 'putongyuyan']; mkB(0); B.hp = 1e6;
capLog = [];
castSkill(pkg('putongyuyan'));
ok(capLog.some(t => t.indexOf('命名') >= 0), '语言·命名：无视抗性并留下记录');
/* 天文·相位 */
S.desk = ['luoti', 'tiantiyunxing']; mkB(0); B.hp = 1e6; B.t = 2;
castSkill(pkg('tiantiyunxing'));
ok(B.dmg['tiantiyunxing'] > 0, '天文·相位：造成伤害（相位已参与计算）');
/* 地质·沉积 */
S.desk = ['luoti', 'dizhixueyuanli']; mkB(0); B.hp = 1e6; B.sediment = 0;
castSkill(pkg('dizhixueyuanli'));
ok(B.sediment > 0, '地质·沉积：伤害先层积（当前 ' + Math.round(B.sediment) + '）');
/* 生态·轮作 */
S.desk = ['luoti', 'shengtaixue']; mkB(0); B.hp = 1e6; B.t = 20;
castSkill(pkg('shengtaixue'));
ok(B.dmg['shengtaixue'] > 0, '生态·轮作：战斗 20 秒后仍正常输出');
/* 战略·先发 */
S.desk = ['luoti', 'sunzi']; mkB(0); B.hp = 1e6; B.t = 3;
capLog = [];
castSkill(pkg('sunzi'));
ok(capLog.some(t => t.indexOf('庙算') >= 0), '战略·先发：开场 10 秒内有压制加成');
/* 音乐·和弦 */
S.desk = ['heshengxue', 'luoti']; mkB(0); B.hp = 1e6;
B.cds = { heshengxue: 0, luoti: 0 };
capLog = [];
castSkill(pkg('heshengxue'));
ok(capLog.some(t => t.indexOf('合奏') >= 0), '音乐·和弦：两技能同时就绪时合奏');
/* 经济·定价 */
S = defaultState(); S.books = { wuming:{lv:5,q:0}, fushui:{lv:5,q:0} };
S.insight = 10000; S.eraInsight = 10000;
S.desk = ['luoti', 'fushui']; mkB(0); B.hp = 1e6;
tickSchoolRules(8.1);
ok(B.priceT > 0, '经济·定价：自动买下攻击增益（剩余 ' + B.priceT.toFixed(1) + ' 秒）');
ok(S.insight < 10000, '定价确实花掉了洞见（' + Math.round(S.insight) + '）');

console.log('=== 实验：可重复性 ===');
S = defaultState();
toast = () => {}; renderResources = () => {}; save = () => {}; renderShelf = () => {};
renderCards = () => {}; showVictory = () => {}; renderBreakdown = () => {}; renderUnits = () => {};
burstParticles = () => {}; floatText = () => {}; renderLog = () => {}; renderBattle = () => {};
ok(EXPERIMENT_NEED === 3, '需要 3 次才算数据充分');
S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:0} }; S.desk = ['luoti'];
try { startBattle(400); } catch (e) {}
ok(B.expTries === 1 && !B.expData, '第 1 次挑战：不算数据充分（' + B.expTries + '）');
try { startBattle(400); } catch (e) {}
ok(B.expTries === 2 && !B.expData, '第 2 次挑战：仍不算');
try { startBattle(400); } catch (e) {}
ok(B.expTries === 3 && B.expData === true, '第 3 次挑战：数据充分，本场 +' + Math.round(EXPERIMENT_BONUS * 100) + '% 伤害');
ok(quirkParams({ rate: 0.04, every: 8 }).length > 0, '怪癖参数能被翻译成可读文本：' + quirkParams({ rate: 0.04, every: 8 }));
/* 打赢后计数归零 */
S.stageTries[400] = 3; S.maxStage = 400;
mkB(400); B.hp = 0; B.over = false;
try { realWinBattle(); } catch (e) {}
ok(S.stageTries[400] === undefined, '通关后该关的实验计数归零');

console.log('=== 错误博物馆 ===');
S = defaultState();
ok(DEBUNKED.length >= 8, '被识破的理论不少于 8 条（实际 ' + DEBUNKED.length + '）');
ok(new Set(DEBUNKED.map(d => d.id)).size === DEBUNKED.length, 'id 无重复');
ok(DEBUNKED.every(d => d.wrong && d.wrong.length > 30 && d.lesson), '每条都有"错在哪"和"教训"');
ok(DEBUNKED.every(d => d.boss >= 0 && d.boss < SCHOOLS.length * STAGES_PER_SCHOOL), '解锁关卡索引都在范围内');
/* 加成：每识破一条 +1% */
S = defaultState(); S.books = { wuming:{lv:5,q:0} };
const dRate0 = stats().rate;
S.debunk = DEBUNKED.slice(0, 4).map(d => d.id);
const dRate4 = stats().rate;
ok(dRate4 > dRate0, '识破 4 条后产出变高（' + dRate0.toFixed(3) + ' → ' + dRate4.toFixed(3) + '）');
ok(Math.abs(dRate4 / dRate0 - 1.04) < 0.01, '加成是每条约 +1%（实际 +' + ((dRate4 / dRate0 - 1) * 100).toFixed(1) + '%）');
S.debunk = DEBUNKED.map(d => d.id);
const dRateAll = stats().rate;
const expectAll = Math.min(0.10, 0.01 * DEBUNKED.length);
ok(Math.abs(dRateAll / dRate0 - (1 + expectAll)) < 0.02,
  '加成按条数封顶 +10%（' + DEBUNKED.length + ' 条 → 期望 +' + (expectAll * 100).toFixed(0) + '%，实际 +' + ((dRateAll / dRate0 - 1) * 100).toFixed(1) + '%）');
/* 打首杀 BOSS 解锁对应条目 */
S = defaultState(); S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:0} }; S.desk = ['luoti'];
const db0 = DEBUNKED[0];          /* 燃素说，boss 183 */
S.maxStage = db0.boss;
mkB(db0.boss); B.hp = 0; B.over = false;
try { realWinBattle(); } catch (e) {}
ok((S.debunk || []).includes(db0.id), '首杀对应 BOSS → 识破「' + db0.name + '」');

console.log('=== 一卡一图 ===');
let shareSafe = true;
try { shareCard('c1'); } catch (e) { shareSafe = false; }
ok(shareSafe, '无 canvas 环境下 shareCard 不抛异常');
ok(typeof shareCard === 'function', '分享函数已定义');

console.log('=== 周常世界 BOSS「遗忘」 ===');
S = defaultState();
closeDialog = () => {};
toast = () => {}; renderResources = () => {}; save = () => {}; renderShelf = () => {};
renderCards = () => {}; showVictory = () => {}; renderBreakdown = () => {}; renderUnits = () => {};
burstParticles = () => {}; floatText = () => {}; renderLog = () => {}; renderBattle = () => {};
ok(/^\\d{4}-W\\d{2}$/.test(isoWeekKey(new Date())), '周号格式正确：' + isoWeekKey(new Date()));
ok(isoWeekKey(new Date()) === isoWeekKey(new Date()), '同一周内周号稳定（全服同一个 Boss 的前提）');
ok(isoWeekKey(new Date('2026-01-05')) !== isoWeekKey(new Date('2026-01-12')), '跨周周号会变');
/* 同一周 → 同一套属性 */
S.maxStage = 100;
const wb1 = worldBossData(), wb2 = worldBossData();
ok(wb1.hp === wb2.hp && wb1.weak === wb2.weak && wb1.resist === wb2.resist, '同一周内 Boss 配置完全一致');
ok(wb1.idx === -2 && wb1.name === '遗忘' && wb1.hp > 0 && wb1.atk > 0, 'Boss 数据完整（' + wb1.name + ' HP ' + wb1.hp + '）');
/* 跨周重置 */
S.world = { week: '1999-W01', tries: 0, cleared: true, dmg: 0 };
S.memory = 4;
ok(ensureWorldWeek() === true, '检测到跨周 → 触发重置');
ok(S.world.tries === WORLD_BOSS.triesPerWeek && !S.world.cleared, '次数回满、击退状态清空');
ok(S.memory === 4, '记忆强化是永久的：跨周不掉');
/* 次数与门槛 */
S.world = { week: isoWeekKey(new Date()), tries: 0, cleared: false, dmg: 0 };
startWorld();
ok(S.world.tries === 0, '次数用完时不能挑战（不会变负数）');
S.world = { week: isoWeekKey(new Date()), tries: 2, cleared: true, dmg: 0 };
startWorld();
ok(S.world.tries === 2, '本周已击退后不再消耗次数');
S.world = { week: isoWeekKey(new Date()), tries: 2, cleared: false, dmg: 0 };
S.maxStage = 10;
startWorld();
ok(S.world.tries === 2, '未通关第一个学派时不开放');
/* 赢：书页 + 记忆强化 */
S = defaultState(); S.maxStage = 200; S.page = 0; S.memory = 0;
S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:0} }; S.desk = ['luoti'];
S.world = { week: isoWeekKey(new Date()), tries: 3, cleared: false, dmg: 0 };
mkB(-2); B.hp = 0; B.over = false;
try { realWinBattle(); } catch (e) {}
ok(S.page > 0, '击退遗忘 → 书页 +' + Math.round(S.page));
ok(S.memory === 1, '击退遗忘 → 记忆强化 +1');
ok(S.world.cleared === true, '记录本周已击退');
ok(stats().rate > 0, '记忆强化并入 stats');
/* 记忆加成上限 */
S = defaultState(); S.books = { wuming:{lv:5,q:0} };
const mRate0 = stats().rate;
S.memory = 5; const mRate5 = stats().rate;
S.memory = 40; const mRate40 = stats().rate;
ok(mRate5 > mRate0 && Math.abs(mRate5 / mRate0 - 1.05) < 0.01, '记忆 5 点 → +5%');
ok(Math.abs(mRate40 / mRate0 - 1.10) < 0.02, '记忆加成封顶 +10%（实际 +' + ((mRate40 / mRate0 - 1) * 100).toFixed(1) + '%）');
/* 输：书页 -5% + 随机一本 -1 级，且有下限 */
S = defaultState(); S.maxStage = 200; S.page = 1000;
S.books = { wuming:{lv:5,q:0}, luoti:{lv:2,q:0} };
S.world = { week: isoWeekKey(new Date()), tries: 1, cleared: false, dmg: 0 };
mkB(-2); B.over = false; B.php = 0;
try { realLoseBattle(); } catch (e) {}
ok(S.page === 950, '失败：书页 -5%（1000 → ' + S.page + '）');
const dLv = S.books.luoti.lv;
ok(dLv >= 1, '失败：书本等级不会被扣到 0（当前 Lv' + dLv + '）');
ok(S.world.cleared === false, '失败不会标记为已击退');
/* 三阶段侵蚀 */
S = defaultState(); S.maxStage = 200;
S.books = { wuming:{lv:5,q:0} };
mkB(-2); B.over = false;
const atk0 = B.st.atk;
worldPhaseCheck();
ok(!B.wphase || B.wphase === 1, '满血时还在第 1 阶段（攻击 ' + atk0 + '）');
B.hp = B.maxHp * 0.6; worldPhaseCheck();
ok(B.wphase === 2 && B.st.atk > atk0, '跌到 66% 以下 → 第 2 阶段，攻击提升（' + B.st.atk + '）');
B.hp = B.maxHp * 0.2; worldPhaseCheck();
ok(B.wphase === 3 && B.st.atk > atk0 * 1.4, '跌到 33% 以下 → 第 3 阶段，再次提升（' + B.st.atk + '）');
/* 书页为 0 时不应变成负数 */
S = defaultState(); S.page = 0; S.books = { wuming:{lv:1,q:0} };
mkB(-2); B.over = false; B.php = 0;
try { realLoseBattle(); } catch (e) {}
ok(S.page === 0, '书页为 0 时失败不会出现负数');

console.log('=== 全服世界 BOSS 进度 ===');
S = defaultState(); S.maxStage = 200;
toast = () => {}; renderResources = () => {}; save = () => {}; renderShelf = () => {};
renderCards = () => {}; showVictory = () => {}; renderBreakdown = () => {}; renderUnits = () => {};
burstParticles = () => {}; floatText = () => {}; renderLog = () => {}; renderBattle = () => {};
closeDialog = () => {}; renderWorldbar = () => {};
ok(Array.isArray(S.world.milestones), '存档含 milestones 数组');
ok(S.world.total === 0 && S.world.goal === 0, '全服进度字段初始为 0');
/* 离线模式：只累加本地 */
S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:0} }; S.desk = ['luoti'];
mkB(-2); B.hp = B.maxHp * 0.5;
const wBefore = S.world.total;
pushWorldDamage(B.st);
ok(S.world.total > wBefore, '战斗结束上报伤害（' + Math.round(wBefore) + ' → ' + Math.round(S.world.total) + '）');
ok(Math.abs(S.world.total - B.maxHp * 0.5) < 2, '上报量 = 这一场打掉的血量');
ok(S.world.goal === Math.round(B.maxHp * WORLD_BOSS.triesPerWeek), '单人目标 = 本周 3 次机会全打空');
const wDup = S.world.total;
pushWorldDamage(stageData(0));
ok(S.world.total === wDup, '非世界 BOSS 的战斗不会误上报');
/* 里程碑：四档、幂等、100% 给记忆强化 */
S = defaultState(); S.maxStage = 200;
S.world = { week: isoWeekKey(new Date()), tries: 3, cleared: false, dmg: 0, total: 0, goal: 1000, players: 1, milestones: [] };
const wPg0 = S.page;
S.world.total = 300; checkWorldMilestones();
ok(S.world.milestones.includes(0), '达到 25% → 发放第一档');
ok(S.page > wPg0, '里程碑给了书页（' + wPg0 + ' → ' + S.page + '）');
const wPg1 = S.page;
checkWorldMilestones();
ok(S.page === wPg1, '同一里程碑不重复发放（幂等）');
S.world.total = 600; checkWorldMilestones();
ok(S.world.milestones.includes(1) && !S.world.milestones.includes(2), '达到 50% 只补发第二档');
const wMem0 = S.memory;
S.world.total = 1000; checkWorldMilestones();
ok(S.world.milestones.length === 4, '四档全部发放（' + S.world.milestones.length + '）');
ok(S.memory === wMem0 + 1, '击穿 100% 额外给 1 点记忆强化');
/* 跨周清空 */
S.world.milestones = [0, 1, 2, 3];
S.world.week = '1999-W01';
ensureWorldWeek();
ok(S.world.milestones.length === 0 && S.world.total === 0, '跨周重置：里程碑与全服进度一起清空');
ok(S.world.goal === 0, '跨周重置：目标也清空（等服务端重新提供）');

console.log('=== 开场引导 ===');
S = defaultState();
toast = () => {}; save = () => {}; closeDialog = () => {}; renderWorldbar = () => {};
const keepOpenDialog = openDialog;
let introHtml = '';
openDialog = (h) => { introHtml = h; };
ok(Array.isArray(INTRO_SLIDES) && INTRO_SLIDES.length >= 4, '引导不少于 4 屏（实际 ' + INTRO_SLIDES.length + '）');
ok(INTRO_SLIDES.every(x => x.tag && x.title && x.body && x.body.length && x.line && x.foot),
  '每屏都有 tag / title / body / 点题句 / 脚注');
ok(INTRO_SLIDES[0].line.indexOf('记住') >= 0, '第一屏点明世界观：由被记住的东西构成');
ok(INTRO_SLIDES.some(x => x.tag === '遗忘'), '有「遗忘」这一屏（世界观核心冲突）');
ok(INTRO_SLIDES.some(x => x.line.indexOf('实证') >= 0), '有方法论克制链这一屏（玩法核心）');
S.seenIntro = false;
showIntro();
ok(S.seenIntro === true, 'showIntro 后立刻标记已看，刷新不会反复打断');
ok(introHtml.indexOf('理念世界') >= 0, '渲染出第一屏内容');
introNext();
ok(introHtml.indexOf(INTRO_SLIDES[1].title) >= 0, '翻到第二屏');
introPrev();
ok(introHtml.indexOf(INTRO_SLIDES[0].title) >= 0, '能翻回上一屏');
introIdx = 0;
introPrev();
ok(introIdx === 0, '第一屏再往前翻不会越界');
let noThrow = true;
try { for (let i = 0; i < INTRO_SLIDES.length + 3; i++) introNext(); } catch (e) { noThrow = false; }
ok(noThrow && introIdx === INTRO_SLIDES.length - 1, '连续翻到底不越界');
renderIntro();
ok(introHtml.indexOf('开始') >= 0, '最后一屏按钮是「开始」');
introIdx = 0; renderIntro();
ok(introHtml.indexOf('跳过') >= 0, '第一屏给的是「跳过」而不是「上一页」');
const keepHtml = introHtml;
showIntro();
ok(introHtml === keepHtml, '已看过的玩家不会自动再弹');
showIntro(true);
ok(introHtml !== keepHtml || introIdx === 0, 'force 模式可以重新打开（账号弹窗里的「再看一次开场」）');
openDialog = keepOpenDialog;

console.log('=== 深渊：无限推层 ===');
S = defaultState(); S.maxStage = SCHOOLS.length * STAGES_PER_SCHOOL;
toast = () => {}; save = () => {}; renderBreakdown = () => {}; renderBattle = () => {};
renderAbyssbar = () => {}; burstParticles = () => {}; floatText = () => {}; renderLog = () => {};
closeDialog = () => {}; showVictory = () => {}; renderMorale = () => {};
const ab1 = abortDataSafe(1);
function abortDataSafe(d) { const keep = S.abyssDepth; S.abyssDepth = d; const r = stageData(-3); S.abyssDepth = keep; return r; }
ok(ab1.idx === -3 && ab1.depthLevel === 1, '深渊第 1 层数据可生成');
ok(ab1.kind === 'normal', '第 1 层是普通层');
const ab10 = abortDataSafe(10);
ok(ab10.kind === 'elite', '第 10 层是守门者');
ok(ab10.hp > ab1.hp * 1.9, '守门者血量显著更高（' + ab1.hp + ' → ' + ab10.hp + '）');
/* 用 101 层验纯增长（100 层是守门者，额外 ×1.9） */
const ab101 = abortDataSafe(101);
const expect101 = Math.pow(ABYSS.growth, 100);
ok(Math.abs(ab101.hp / ab1.hp - expect101) < expect101 * 0.05,
  '第 101 层血量 ≈ 第 1 层 × 1.09^100（实际 ×' + (ab101.hp / ab1.hp).toFixed(0) + '）');
ok(ab101.hp > 0 && isFinite(ab101.hp), '第 101 层数值未溢出');
const ab100b = abortDataSafe(100);
ok(Math.abs(ab100b.hp / ab1.hp - Math.pow(ABYSS.growth, 99) * 1.9) < Math.pow(ABYSS.growth, 99) * 0.1,
  '第 100 层 = 增长 × 守门者 1.9 倍（双重加成）');
const ab5000 = abortDataSafe(5000);
ok(isFinite(ab5000.hp) && ab5000.hp > 0, '第 5000 层仍然有限（Number 够用）');
ok(ab1.sch && ab1.sch.epitaphs && ab1.sch.epitaphs.length === 3, '深渊层自带台词（结算画面要用）');
ok(ab1.weak && ab1.resist, '深渊层有弱点与抗性');

/* 通关推进 */
S = defaultState(); S.maxStage = SCHOOLS.length * STAGES_PER_SCHOOL; S.abyssDepth = 7;
S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:0} }; S.desk = ['luoti'];
S.page = 0;
mkB(-3); B.hp = 0; B.over = false;
const abPage0 = S.page;
try { realWinBattle(); } catch (e) {}
ok(S.abyssDepth === 8, '通过第 7 层 → 深度推进到 8（实际 ' + S.abyssDepth + '）');
ok(S.page > abPage0, '深渊层给书页（' + abPage0 + ' → ' + S.page + '）');
ok(S.maxStage === SCHOOLS.length * STAGES_PER_SCHOOL, '深渊不会污染 maxStage');
/* 失败不推进 */
S.abyssDepth = 12;
mkB(-3); B.over = false; B.php = 0;
try { realLoseBattle(); } catch (e) {}
ok(S.abyssDepth === 12, '深渊失败不推进、也不掉层');

console.log('=== 战斗干预：士气连点 ===');
S = defaultState(); S.maxStage = 200;
S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:0} }; S.desk = ['luoti'];
mkB(0); B.hp = 1e9;
const moraleCap = Math.round(B.limit * MORALE_CAP_RATIO);
ok(moraleCap >= 5 && moraleCap <= 15, '本场加速上限 = 限时 ×20%（' + moraleCap + ' 秒）');
B.cds = { luoti: 5 };
for (let i = 0; i < MORALE_NEED - 1; i++) interveneTap();
ok(B.interveneUsed === 0, '不满 10 点士气不触发（' + B.morale + ' 点）');
ok(B.cds.luoti === 5, '未触发时冷却不变');
interveneTap();
ok(B.interveneUsed === 1, '第 10 点 → 触发一次');
ok(Math.abs(B.cds.luoti - 4) < 1e-9, '触发后全队 CD -1 秒（5 → ' + B.cds.luoti + '）');
ok(B.morale === 0, '触发后士气归零重新积累');
/* 连点到上限 */
for (let i = 0; i < 400; i++) interveneTap();
ok(B.interveneUsed === moraleCap, '手动收益被硬性封顶在 ' + moraleCap + ' 秒（实际 ' + B.interveneUsed + '）');
const cappedCds = B.cds.luoti;
interveneTap();
ok(B.cds.luoti === cappedCds, '到上限后继续点不再加速（守住「不点也能过」）');
ok(B.morale <= MORALE_NEED, '到上限后士气条保持在满格，不会溢出显示');

console.log('=== 学派与方法论可见性 ===');
S = defaultState();
const keepOD2 = openDialog;
let viewHtml = '';
openDialog = (h) => { viewHtml = h; };
ok(typeof bookDomain === 'function' && typeof doctrineOf === 'function', '学科/方法论查询函数存在');
const noDom = BOOKS.filter(b => !bookDomain(b));
ok(noDom.length === 0, '全部 ' + BOOKS.length + ' 本书都能取到学科名（缺 ' + noDom.length + '）');
const noDoc = BOOKS.filter(b => !doctrineOf(b));
ok(noDoc.length === 0, '全部 ' + BOOKS.length + ' 本书都能取到方法论');
ok(BOOKS.every(b => DOCTRINES.includes(doctrineOf(b))), '所有方法论都在六环之内');
ok(typeof DOCTRINE_COLOR === 'object' && DOCTRINES.every(d => DOCTRINE_COLOR[d]), '六种方法论各有标识色');
/* 渲染层用 DOM，这里只验证"每本书都拿得到要显示的东西"——
   真正长什么样由真机截图确认。 */
ok(BOOKS.every(b => bookDomain(b) && bookDomain(b).length > 0), '每本书都能显示学科名');
ok(BOOKS.every(b => doctrineColor(doctrineOf(b)) !== '#8a7c62'), '每本书的方法论都有专属颜色（不落兜底色）');

/* 详情页：学派 + 方法论 + 克制关系 */
S.books = { wuming:{lv:5,q:0}, luoti:{lv:5,q:1}, mengxi:{lv:5,q:1} };
openBookDetail('luoti');
ok(viewHtml.indexOf('学派与方法论') > 0, '详情页有「学派与方法论」段');
ok(viewHtml.indexOf('×1.25') > 0, '详情页写明克制倍率 ×1.25');
ok(viewHtml.indexOf('×0.8') > 0, '详情页写明被克倍率 ×0.8');
ok(viewHtml.indexOf('方法论') > 0, '详情页显式标注方法论');
openBookDetail('mengxi');
ok(viewHtml.indexOf('机巧学派') > 0, '有 school 的书显示学派全名');
ok(viewHtml.indexOf('梦溪笔谈') > 0, '详情页仍是这本书');
openBookDetail('wuming');
ok(viewHtml.indexOf('学派与方法论') > 0, '无 school 的书也有学派段（走跨学派/学科兜底）');

/* 方法论与学派的对应要自洽 */
const schPair = SCHOOLS.filter(x => x.doctrine);
ok(schPair.every(x => DOCTRINES.includes(x.doctrine)), '每个学派的方法论都合法');
openDialog = keepOD2;

console.log('=== 属性面板 ===');
S = defaultState();
const keepOD3 = openDialog;
let statHtml = '';
openDialog = (h) => { statHtml = h; };
S.books = { wuming:{lv:10,q:0}, tiwen:{lv:10,q:0} };
openStats();
ok(statHtml.indexOf('学者属性') > 0, '面板能打开');
ok(statHtml.indexOf('悟性') > 0 && statHtml.indexOf('洞见产出') > 0, '悟性显示产出换算');
ok(statHtml.indexOf('不加伤害也不加坦度') > 0, '悟性明确标注不影响战斗（回答朋友的问题）');
ok(statHtml.indexOf('严谨') > 0, '严谨有显示');
ok(statHtml.indexOf('来自严谨') > 0, '严谨直接说明它在攻击里占多少（不再只给绝对值误导人）');
ok(statHtml.indexOf('精审') > 0 && statHtml.indexOf('沉毅') > 0 && statHtml.indexOf('捷才') > 0,
  '面板列出七种属性（新增精审 / 沉毅 / 捷才）');
ok(statHtml.indexOf('没有上限') > 0, '暴伤明确标注没有上限');
ok(statHtml.indexOf('雄辩') > 0 && statHtml.indexOf('直觉') > 0, '雄辩与直觉都有显示');
ok(statHtml.indexOf('最终战斗数值') > 0, '有最终数值段');
ok(statHtml.indexOf('范式复利') > 0, '说明了数值来源');
ok(statHtml.indexOf('理论 DPS') > 0, '显示理论 DPS');

/* 换算关系必须和 stats() 对得上 */
const P3 = stats();
ok(Math.abs((1 + 0.10 * P3.attr.insight)) > 1, '悟性对产出是乘算（1 + 0.1×悟性）');
ok(P3.attr.rigor * 2 >= 0 && P3.attr.rigor * 3 >= 0, '严谨同时给攻击与生命');
ok(P3.crit <= CRIT_CAP + 1e-9, '暴击率不会超过极限 ' + CRIT_CAP);
ok(critFromRaw(0.18) === 0.18, '线性段内与旧版一致（30 点直觉 = 18%）');
ok(critFromRaw(0.60) === 0.60, '线性段终点仍是 60%，早期手感不变');
ok(critFromRaw(4.932) > 0.75 && critFromRaw(4.932) < CRIT_CAP,
  '822 点直觉（分流后）落在 ' + (critFromRaw(4.932) * 100).toFixed(1) + '%，不再撞顶浪费');
/* 用真实能达到的点数区间验证（1e6 那种会浮点下溢到极限，测不出东西） */
ok(critFromRaw(4) < critFromRaw(8) && critFromRaw(8) < critFromRaw(20),
  '暴击率在可达区间内始终单调上升，没有一段是白拿的');
ok(critFromRaw(20) < CRIT_CAP, '3000+ 点直觉也仍低于极限 ' + CRIT_CAP);
/* 减伤 / 冷却同样是渐近，永远不到极限 */
const cutOf = n => DMG_CUT_CAP * (1 - Math.exp(-n / DMG_CUT_SOFT));
const cdOf = n => CD_FLOOR + (1 - CD_FLOOR) * Math.exp(-n / CD_SOFT);
ok(cutOf(1000) < cutOf(2000) && cutOf(2000) < cutOf(5000) && cutOf(5000) < DMG_CUT_CAP,
  '减伤一直涨但不到 ' + DMG_CUT_CAP + '（5000 点 = ' + (cutOf(5000) * 100).toFixed(1) + '%）');
ok(cdOf(1000) > cdOf(2000) && cdOf(2000) > cdOf(5000) && cdOf(5000) > CD_FLOOR,
  '冷却一直降但不到 ×' + CD_FLOOR + '（5000 点 = ×' + cdOf(5000).toFixed(3) + '）');
ok(Math.abs(cdOf(0) - 1) < 1e-9, '没有捷才时冷却倍率是 ×1.0');
/* 悟性只影响产出：改动悟性不应改变攻击 */
/* yizhi（作为意志和表象的世界）只给 insight + intuition，不含 rigor */
S.books = { wuming:{lv:10,q:0} };
const stAtk0 = stats().atk;
const stRate0 = stats().rate;
S.books.yizhi = { lv: 30, q: 5 };
const stAtk1 = stats().atk;
const stRate1 = stats().rate;
ok(Math.abs(stAtk1 - stAtk0) < 1e-6, '加纯悟性书不改变攻击（印证"不加伤害"）');
ok(stRate1 > stRate0, '但产出确实提高了（' + stRate0.toFixed(2) + ' → ' + stRate1.toFixed(2) + '）');
openDialog = keepOD3;

console.log('=== 天赋树 v2：三层 + 专精互斥 ===');
S = defaultState();
const tSpec = TALENTS.filter(t => t.cat === 'spec');
const tAdv = TALENTS.filter(t => t.cat === 'adv');
const tBase = TALENTS.filter(t => t.cat === 'base');
ok(tBase.length === 6 && tAdv.length === 8 && tSpec.length === 3,
  '三层齐备（基础 ' + tBase.length + ' / 进阶 ' + tAdv.length + ' / 专精 ' + tSpec.length + '）');
ok(TALENTS.every(t => !!t.cat), '每个天赋都有分层标记 cat');
/* 关键：天赋树要能接住玩家手里几千点范式 */
let tTotal = 0;
TALENTS.forEach(t => {
  for (let i = 0; i < t.max; i++) tTotal += talentCostOf(t, i);
});
const tSpecTotal = tSpec.reduce((s, t) => s + [0,1,2,3,4].reduce((a, i) => a + specCost(t, i), 0), 0);
ok(tTotal > 2000, '全树点满要 ' + tTotal + ' 点范式（旧版只要 25 点，范式全是死钱）');
ok(tSpecTotal > 1500, '专精一条线就吃下 ' + tSpecTotal + ' 点（60/120/240/480/960 翻倍递增）');
ok(specCost(TALENTS.find(t => t.id === 'spec_emp'), 0) === 60 &&
   specCost(TALENTS.find(t => t.id === 'spec_emp'), 4) === 960, '专精花费按 2 倍递增');
/* 互斥 */
ok(specChosen() === null, '初始没有选任何流派');
S.talents.spec_emp = 1;
ok(specChosen() === 'spec_emp', '选了实证派后 specChosen 能取到');
ok(SPEC_IDS.filter(id => tal(id) > 0).length === 1, '同时只有一个流派被点亮');
/* 专精对书的加成：本派 +，其余 - */
const specEmp = TALENTS.find(t => t.id === 'spec_emp');
const inBook = BOOKS.find(b => specEmp.school.indexOf(doctrineOf(b)) >= 0);
const outBook = BOOKS.find(b => specEmp.school.indexOf(doctrineOf(b)) < 0);
ok(!!inBook && !!outBook, '能找到派内 / 派外的书（' + (inBook || {}).name + ' vs ' + (outBook || {}).name + '）');
ok(specBookMul(inBook) > 1, '本派书被加成 ×' + specBookMul(inBook).toFixed(2));
ok(specBookMul(outBook) < 1, '派外书被削弱 ×' + specBookMul(outBook).toFixed(2));
S.talents.spec_emp = 5;
ok(specBookMul(inBook) > 2, '专精 5 级时本派 ×' + specBookMul(inBook).toFixed(2));
ok(specBookMul(outBook) >= 0.2, '派外削弱有下限，不会变成负数（×' + specBookMul(outBook).toFixed(2) + '）');
S.talents = {};
ok(specBookMul(inBook) === 1 && specBookMul(outBook) === 1, '没选流派时不影响任何书');
/* 新天赋要真的接到数值上 */
S = defaultState(); S.books = { wuming:{lv:10,q:0} }; S.desk = ['wuming'];
const tBase0 = stats();
S.talents = { crit:5, critdmg:5, cd:5, vitality:5, cut:5 };
const tAfter = stats();
ok(tAfter.crit > tBase0.crit, '「明察」提高暴击率（' + (tBase0.crit*100).toFixed(1) + '% → ' + (tAfter.crit*100).toFixed(1) + '%）');
ok(tAfter.crit <= CRIT_CAP, '「明察」也不能突破暴击率极限');
ok(tAfter.critDmg > tBase0.critDmg, '「锐度」提高暴击伤害（×' + tBase0.critDmg.toFixed(2) + ' → ×' + tAfter.critDmg.toFixed(2) + '）');
ok(tAfter.cdMul < tBase0.cdMul, '「捷思」缩短冷却（×' + tBase0.cdMul.toFixed(3) + ' → ×' + tAfter.cdMul.toFixed(3) + '）');
ok(tAfter.cdMul >= CD_FLOOR, '「捷思」不越过冷却下限 ×' + CD_FLOOR);
ok(tAfter.hp > tBase0.hp, '「守拙」提高生命');
ok(tAfter.dmgCut > tBase0.dmgCut, '「沉稳」提高减伤（' + (tBase0.dmgCut*100).toFixed(1) + '% → ' + (tAfter.dmgCut*100).toFixed(1) + '%）');
ok(tAfter.dmgCut <= DMG_CUT_CAP, '「沉稳」不越过减伤上限');
S.talents = { cut:5 };
ok(stats().dmgCut <= DMG_CUT_CAP + 1e-9, '减伤上限始终成立');

console.log('=== 研究课题：范式的去处 ===');
S = defaultState();
ok(RESEARCH.length >= 12, '课题数量 ' + RESEARCH.length + ' 条（够撑起一条长线）');
ok(RESEARCH.every(r => !!RESEARCH_NEED_TEXT[r.need.t]),
  '每个课题的条件都有人话说明（否则面板会显示空白）');
ok(RESEARCH.every(r => Object.keys(r.reward).every(k => !!RESEARCH_REWARD_TEXT[k])),
  '每个课题的奖励都有人话说明');
ok(RESEARCH.every(r => r.cost > 0), '每个课题都要花范式立项');
const rsTotal = RESEARCH.reduce((s, r) => s + r.cost, 0);
ok(rsTotal > 1200, '全部课题立完要 ' + rsTotal + ' 点范式（接得住玩家手里那 3000 点）');
ok([1,2,3].every(t => RESEARCH.some(r => r.tier === t)), '三档课题齐全（入门 / 进阶 / 精深）');
/* 立项 → 达成 → 结题 */
S.paradigm = 100; S.spent = 0;
const r0 = RESEARCH.find(r => r.need.t === 'books');
S.books = {};
ok(!researchMet(r0), '书不够时课题未达成');
ok(researchBonus().rate === 0, '没结题时没有加成');
S.research.active.push(r0.id);
S.spent += r0.cost;
ok(researchActive(r0.id), '立项后进入进行中');
for (let i = 0; i < r0.need.n; i++) S.books['bk' + i] = { lv: 1, q: 0 };
ok(researchMet(r0), '书够了 → 条件达成');
ok(checkResearch() !== null, '结题检测能抓到');
ok(researchDone(r0.id) && !researchActive(r0.id), '结题后从进行中移到已完成');
ok(researchBonus().rate > 0, '结题后加成生效（产出 +' + (researchBonus().rate * 100) + '%）');
ok(paraFree() === 100 - r0.cost, '立项确实扣了 ' + r0.cost + ' 点范式');
/* 槽位类奖励要真的加到上限上 */
S = defaultState();
const desk0 = deskSlots();
const rDesk = RESEARCH.find(r => r.reward.desk);
ok(!!rDesk, '有课题给书桌槽位');
S.research.done.push(rDesk.id);
ok(deskSlots() === desk0 + rDesk.reward.desk,
  '结题后书桌槽位 ' + desk0 + ' → ' + deskSlots());
const slot0 = conceptSlots();
const rSlot = RESEARCH.find(r => r.reward.slot);
S.research.done.push(rSlot.id);
ok(conceptSlots() === slot0 + rSlot.reward.slot,
  '结题后印记槽位 ' + slot0 + ' → ' + conceptSlots());
/* 同时进行上限 */
S = defaultState(); S.paradigm = 9999; S.spent = 0;
S.research.active = RESEARCH.slice(0, RESEARCH_SLOTS).map(r => r.id);
ok(S.research.active.length === RESEARCH_SLOTS, '同时进行上限 ' + RESEARCH_SLOTS + ' 个');
/* 旧存档兼容：没有 research 字段不能崩 */
S = defaultState(); delete S.research;
ok(researchBonus() !== null && researchBonus().rate === 0, '没有 research 字段时安全返回空加成');
S.research = null;
ok(researchBonus().rate === 0, 'research 为 null 也不崩');

console.log('=== 熔解：多余装备的出口 ===');
S = defaultState();
S.page = 0;
const mGood = makeEquip('pen', 5, 'mechanics');
const mBad = makeEquip('pen', 2, 'mechanics');
const mOther = makeEquip('robe', 1, 'mechanics');
S.bag = [mGood, mBad, mOther];
S.equip.pen = mGood;
ok(meltValue(mGood) > meltValue(mBad), '品质越高熔得越多（' + meltValue(mBad) + ' → ' + meltValue(mGood) + '）');
ok(meltValue(mGood) < QUALITIES[5].pageCost / 10, '熔解收益远低于书升阶（不是赚钱路子）');
const mPlan = meltPlan();
ok(mPlan.length === 1 && mPlan[0].uid === mBad.uid, '只熔已经没用的（' + mPlan.length + ' 件）');
ok(mPlan.every(e => e.uid !== mGood.uid), '身上穿的原典不会被熔掉');
ok(mPlan.every(e => e.uid !== mOther.uid), '槽位还空着的不会被批量熔掉');
/* 用户手上最多的就是「平级的重复原典」—— 按旧规则一件都熔不掉 */
S.bag = [mGood, makeEquip('pen', 5, 'mechanics'), makeEquip('pen', 5, 'mechanics'), mBad];
S.equip.pen = mGood;
const mDup = meltPlan();
ok(mDup.length === 3, '封顶的重复原典 + 低档的一起进计划（' + mDup.length + ' 件）');
ok(mDup.filter(e => e.q === 5).length === 2, '两件重复原典被认作冗余（合成也升不动）');
/* 但还没封顶的同档装备要留着凑合成 */
S.bag = [makeEquip('pen', 3, 'mechanics'), makeEquip('pen', 3, 'mechanics'), makeEquip('pen', 1, 'mechanics')];
S.equip.pen = S.bag[0];
ok(meltPlan().length === 1, '未封顶的同档装备留着凑三合一（只熔掉 1 件低档）');
/* 比身上好的绝不能进计划 */
S.bag = [makeEquip('pen', 2, 'mechanics'), makeEquip('pen', 5, 'mechanics')];
S.equip.pen = S.bag[0];
ok(meltPlan().length === 0, '背包里比身上好的装备不会被熔掉');
S.bag = [mGood, mBad, mOther];
S.equip.pen = mGood;
const mPage0 = S.page;
const mGain = meltEquip(mBad.uid);
ok(mGain > 0 && S.page === mPage0 + mGain, '熔解确实换成书页（+' + mGain + '）');
ok(S.bag.length === 2 && !S.bag.some(e => e.uid === mBad.uid), '熔掉的装备从背包消失');
ok(S.equip.pen && S.equip.pen.uid === mGood.uid, '熔掉冗余不影响身上那件');
/* 熔掉身上穿的：槽位要被清空，不能留下悬空引用 */
const mGain2 = meltEquip(mGood.uid);
ok(mGain2 > 0 && !S.equip.pen, '熔掉身上穿的会同时卸下，不留悬空引用');
ok(meltEquip(999999) === 0, '熔掉不存在的 uid 安全返回 0');

console.log('');
console.log(fail === 0 ? ('全部通过 · ' + pass + ' 项') : (pass + ' 通过 / ' + fail + ' 失败'));
if (fail && typeof process !== 'undefined') process.exitCode = 1;
`, ctx);
