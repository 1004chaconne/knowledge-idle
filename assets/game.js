/* ==========================================================
   《知识即力量》原型 v0.1
   纯前端 · localStorage · 无后端
   ========================================================== */

const $ = s => document.querySelector(s);
const SAVE_KEY = 'sapere_aude_v1';
const OFFLINE_CAP_H = 8;

const bookById = id => BOOKS.find(b => b.id === id);
const qOf = i => QUALITIES[Math.max(0, Math.min(QUALITIES.length - 1, i))];

let S, B = null;
let dirty = { map: 1, desk: 1, shelf: 1 };
let elCache = {};
let lastAccrue = Date.now();
let lastFrame = performance.now();
let uiClock = 0;
let shelfTab = 'skill';

/* ---------------- 存档 ---------------- */
function defaultState() {
  return {
    insight: 0, page: 0, paradigm: 0, eraInsight: 0, prestigeCount: 0,
    books: { wuming: { lv: 1, q: 0 }, luoti: { lv: 1, q: 0 } },
    desk: new Array(DESK_SLOTS).fill(null),
    stage: 0, maxStage: 0,
    cards: [], comboSeen: [], quirkSeen: [], unlocked: ['mechanics'], autoAdvance: true, speed: 1, tipPrestige: false, fails: 0,
    conceptActive: [], conceptTouched: false,   /* 印记：装上的概念规则 */
    conceptPresets: [{ rules: [] }, { rules: [] }, { rules: [] }],   /* 预设套组 */
    era: 1, talents: {}, spent: 0, godKills: 0, auto: { up: true, desk: true },
    /* 成就（id → 'got' 已达成未领 / 'claimed' 已领）+ 离线统计 */
    ach: {}, offlineCount: 0,
    seenIntro: false,
    /* 实验：每关尝试次数（第 3 次算"数据充分"）；错误博物馆已识破清单 */
    stageTries: {}, debunk: [],
    /* 周常世界 BOSS「遗忘」：本周记录 + 记忆强化（永久） */
    world: { week: '', tries: 0, cleared: false, dmg: 0, total: 0, goal: 0, players: 0, milestones: [] }, memory: 0,
    abyssDepth: 1,
    /* 装备是实体：穿戴位 + 背包 + 图鉴。范式转移后全部保留 */
    equip: { pen:null, paper:null, mirror:null, lamp:null, robe:null, seal:null },
    bag: [], equipSeen: [], equipUid: 1,
    carry: 0,                 /* 概念「守恒」：上一场溢出的伤害 */
    /* 研究课题：范式的主要去处 */
    research: { active: [], done: [] },
    lastSave: Date.now(), ver: 3,
  };
}

function save() {
  /* 云端进度正在覆盖本机时，绝不能把内存里的旧存档写回去 */
  if (window.__netLoading) return;
  S.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  /* 云存档：本地永远先写，再异步推云端（没有 Net 时完全不影响） */
  if (window.Net && window.Net.onLocalSave) window.Net.onLocalSave();
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.books) return false;
    S = Object.assign(defaultState(), d);
    if (!Array.isArray(S.desk)) S.desk = new Array(DESK_SLOTS).fill(null);
    while (S.desk.length < DESK_SLOTS) S.desk.push(null);
    if (!S.books.wuming) S.books.wuming = { lv: 1, q: 0 };
    if (!S.books.luoti) S.books.luoti = { lv: 1, q: 0 };
    if (!Array.isArray(S.unlocked) || !S.unlocked.length) S.unlocked = ['mechanics'];
    if (!S.era) S.era = 1;
    if (!S.talents) S.talents = {};
    if (typeof S.spent !== 'number') S.spent = 0;
    if (!S.auto) S.auto = { up: true, desk: true };
    if (typeof S.godKills !== 'number') S.godKills = 0;
    /* 成就 / 离线统计（v4 存档）—— 旧档无缝补齐 */
    if (!S.research || typeof S.research !== 'object') S.research = { active: [], done: [] };
    if (!Array.isArray(S.research.active)) S.research.active = [];
    if (!Array.isArray(S.research.done)) S.research.done = [];
    if (!S.ach || typeof S.ach !== 'object') S.ach = {};
    if (typeof S.offlineCount !== 'number') S.offlineCount = 0;
    if (typeof S.seenIntro !== 'boolean') S.seenIntro = false;
    /* 实验 / 错误博物馆（v5 存档） */
    if (!S.stageTries || typeof S.stageTries !== 'object') S.stageTries = {};
    if (!Array.isArray(S.debunk)) S.debunk = [];
    /* 周常世界 BOSS（v6 存档） */
    if (!S.world || typeof S.world !== 'object') S.world = { week: '', tries: 0, cleared: false, dmg: 0, total: 0, goal: 0, players: 0, milestones: [] };
    /* 全服进度（v7）：旧档补齐，不覆盖已有值 */
    if (typeof S.world.total !== 'number') S.world.total = 0;
    if (typeof S.world.goal !== 'number') S.world.goal = 0;
    if (typeof S.world.players !== 'number') S.world.players = 0;
    if (!Array.isArray(S.world.milestones)) S.world.milestones = [];
    if (typeof S.abyssDepth !== 'number' || S.abyssDepth < 1) S.abyssDepth = 1;
    if (typeof S.memory !== 'number') S.memory = 0;
    /* 装备系统（v2 存档）—— 旧存档无缝补齐 */
    if (!S.equip) S.equip = { pen:null, paper:null, mirror:null, lamp:null, robe:null, seal:null };
    EQUIP_SLOTS.forEach(s => { if (!(s.id in S.equip)) S.equip[s.id] = null; });
    if (!Array.isArray(S.bag)) S.bag = [];
    if (!Array.isArray(S.equipSeen)) S.equipSeen = [];
    if (!Array.isArray(S.comboSeen)) S.comboSeen = [];
    if (!Array.isArray(S.quirkSeen)) S.quirkSeen = [];
    if (typeof S.carry !== 'number' || !isFinite(S.carry)) S.carry = 0;
    if (!Array.isArray(S.conceptActive)) S.conceptActive = [];
    if (typeof S.conceptTouched !== 'boolean') S.conceptTouched = false;
    if (!Array.isArray(S.conceptPresets)) S.conceptPresets = [];
    while (S.conceptPresets.length < 3) S.conceptPresets.push({ rules: [] });
    S.conceptPresets = S.conceptPresets.slice(0, 3).map(p =>
      (p && Array.isArray(p.rules)) ? { rules: p.rules.slice() } : { rules: [] });
    if (typeof S.equipUid !== 'number') S.equipUid = 1;
    S.bag = S.bag.filter(e => e && typeof e === 'object' && e.slot);
    EQUIP_SLOTS.forEach(s => {
      const e = S.equip[s.id];
      if (e && (typeof e !== 'object' || e.slot !== s.id)) S.equip[s.id] = null;
    });
    /* v3：范式曲线收紧。旧档按对数压缩重新标定，保留"玩得久所以更强"的次序，
       但不再出现 1.05^1800 这种一转过万倍的情况 */
    if ((d.ver || 1) < 3) {
      const before = S.paradigm || 0;
      if (before > PARADIGM_MIGRATE) {
        S.paradigm = Math.min(PARADIGM_CAP,
          Math.round(Math.log2(1 + before) * 14));
        /* 已花在天赋上的点数按同一比例缩，否则 paraFree 会被扣成负数 */
        S.spent = Math.min(S.paradigm,
          Math.round((S.spent || 0) * S.paradigm / before));
        S.migrateNote = `范式点已重新标定 ${fmt(before)} → ${fmt(S.paradigm)}（数值平衡调整）`;
      }
      S.ver = 3;
    }
    return true;
  } catch (e) { return false; }
}

/* ---------------- 派生数值 ---------------- */
/* 💵 概念「价值」：省下来的那些，是别人替你做的 */
function pageDiscount() { return conceptRuleOn('division') ? 0.95 : 1; }

function upgradeCost(lv) {
  const base = Math.floor(UPGRADE_BASE * Math.pow(UPGRADE_GROWTH, lv - 1));
  return Math.max(1, Math.round(base * (1 + (eqN().costMul || 0)) * pageDiscount()));  /* 「节省」 */
}

function deskList() {
  /* 旧存档 / 外部导入可能是 4 槽，这里兜底补齐 */
  while (S.desk.length < deskSlots()) S.desk.push(null);
  const out = [];
  S.desk.slice(0, deskSlots()).forEach((id, i) => {
    if (!id) return;
    const b = bookById(id);
    const st = S.books[id];
    if (!b || !st || b.type !== 'skill') return;
    out.push({ slot: i, book: b, st, q: qOf(st.q) });
  });
  return out;
}

/* 这本书的"学科"：优先用 tag（运动/力/场…，直接参与学科相性）；
   没有 tag 就退到学派简称。tag 才是战斗里真正吃克制的那一层。 */
function bookDomain(book) {
  if (!book) return '';
  if (book.tag && typeof TAGS !== 'undefined' && TAGS[book.tag]) return TAGS[book.tag];
  const sc = book.school ? SCHOOLS.find(x => x.id === book.school) : null;
  return sc ? sc.short : '通用';
}

function doctrineColor(d) {
  return (typeof DOCTRINE_COLOR !== 'undefined' && DOCTRINE_COLOR[d]) || '#8a7c62';
}

function doctrineOf(book) {
  if (!book) return '实证';
  if (book.doctrine) return book.doctrine;
  const sch = SCHOOLS.find(x => x.id === book.school);
  return sch ? sch.doctrine : '实证';
}

/* ---------------- 装备：生成 / 命名 / 汇总 ---------------- */
function affixById(id) { return AFFIXES.find(a => a.id === id); }
function equipKey(e) { return `${e.school || '?'}:${e.slot}`; }

function rollAffixes(slot, q) {
  const pool = AFFIXES.filter(a => a.slot === slot);
  const n = equipAffixCount(q);
  const used = new Set(), out = [];
  let guard = 0;
  while (out.length < n && guard++ < 80) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    if (!a || used.has(a.id)) continue;
    used.add(a.id); out.push(a.id);
  }
  return out;
}

function makeEquip(slot, q, schoolId) {
  q = Math.max(0, Math.min(QUALITIES.length - 1, q || 0));
  const e = { uid: S.equipUid++, slot, q, school: schoolId || null, affixes: rollAffixes(slot, q) };
  const k = equipKey(e);
  if (!S.equipSeen.includes(k)) S.equipSeen.push(k);
  return e;
}

function equipName(e) {
  if (!e) return '空';
  const set = EQUIP_NAMES[e.slot];
  return (set && set[e.q]) || '器物';
}

/* 带品质的完整叫法：用在纯文本场合（掉落提示、toast） */
function equipFullName(e) {
  if (!e) return '空';
  return `${equipName(e)}（${QUALITIES[e.q].grade}）`;
}

/* ================= 概念：知识的互联 ================= */
/* 同一个概念散落在书、卡、怪癖、专属能力里。
   打通一处算一层，满层给一点点数值 —— 这是「读书的副产品」，不是目的。 */
function hasSignature(sigId) {
  return EQUIP_SLOTS.some(sl => {
    const e = S.equip[sl.id];
    if (!e) return false;
    const sig = EQUIP_SIGNATURE[sl.id + ':' + e.q];
    return sig && sig.id === sigId;
  });
}

function conceptSourceHas(src) {
  if (src.type === 'book')  return !!S.books[src.id];
  if (src.type === 'card')  return (S.cards || []).indexOf(src.id) >= 0;
  if (src.type === 'sig')   return hasSignature(src.id);
  if (src.type === 'quirk') return (S.quirkSeen || []).indexOf(src.id) >= 0;
  if (src.type === 'combo') return (S.comboSeen || []).indexOf(src.id) >= 0;
  return false;
}

/* 进度缓存：conceptProgress 每次要扫 57 个来源，
   而 upgradeCost 这类函数会被渲染循环反复调用，不缓存会拖慢。
   只要「书/卡/装备/组合/怪癖」这几类来源有任何变化，签名就会变。 */
let _cpKey = null, _cpVal = null;
function conceptCacheKey() {
  return Object.keys(S.books).length + '|' +
    (S.cards || []).length + '|' +
    (S.comboSeen || []).length + '|' +
    (S.quirkSeen || []).length + '|' +
    EQUIP_SLOTS.map(sl => {
      const e = S.equip[sl.id];
      return e ? sl.id + '#' + e.q : '-';
    }).join(',');
}

/* 每个概念的进度：{ got, total, pct } */
function conceptProgress() {
  const key = conceptCacheKey();
  if (_cpKey === key && _cpVal) return _cpVal;
  const out = {};
  CONCEPTS.forEach(c => {
    const got = c.sources.filter(conceptSourceHas).length;
    out[c.id] = { got, total: c.sources.length, pct: c.sources.length ? got / c.sources.length : 0 };
  });
  _cpKey = key; _cpVal = out;
  return out;
}

/* 概念规则：只有「完全通晓」才点亮 —— 半懂不算懂。
   每条规则都刻意做得很淡（几个百分点、一次性、有上限），
   目的是让玩家觉得「我读过的东西在起作用」，而不是「我得去刷满它」。 */
function conceptRuleOn(ruleId) {
  const c = CONCEPTS.find(x => x.rule && x.rule.id === ruleId);
  if (!c) return false;
  const p = conceptProgress()[c.id];
  return !!p && p.pct >= 1;
}

/* ---------- 概念印记：规则不是白拿的，得选 ---------- */
/* 槽位从 3 起，每通晓 3 个概念多 1 个，最多 7 个。
   为什么用「通晓数」而不是关卡数：印记是概念系统自己的能力，
   用它自己的进度解锁，才有闭环感。 */
function conceptClearedCount() {
  const p = conceptProgress();
  return CONCEPTS.filter(c => p[c.id] && p[c.id].pct >= 1).length;
}

function conceptSlots() {
  const rb = (typeof researchBonus === 'function' && S.research) ? researchBonus().slot : 0;
  return 3 + Math.min(4, Math.floor(conceptClearedCount() / 3)) + rb;
}

/* 下一槽位还差几个 */
function conceptNextSlotNeed() {
  const cleared = conceptClearedCount();
  const cur = conceptSlots();
  if (cur >= 7) return null;
  return Math.max(0, (cur - 2) * 3 - cleared);
}

/* 能装的规则：必须完全通晓 */
function equipableRules() {
  const p = conceptProgress();
  return CONCEPTS.filter(c => c.rule && p[c.id] && p[c.id].pct >= 1).map(c => c.rule.id);
}

function conceptRuleEquipped(ruleId) {
  return (S.conceptActive || []).indexOf(ruleId) >= 0;
}

/* 清掉已经不再满足条件（或已失效）的印记 */
function pruneConceptRules() {
  const ok = equipableRules();
  const before = (S.conceptActive || []).length;
  S.conceptActive = (S.conceptActive || []).filter(id => ok.indexOf(id) >= 0);
  const cap = conceptSlots();
  if (S.conceptActive.length > cap) S.conceptActive = S.conceptActive.slice(0, cap);
  return S.conceptActive.length !== before;
}

function equipConceptRule(ruleId) {
  if (!conceptRuleOn(ruleId)) return { ok: false, why: '这个概念还没有完全通晓' };
  if (conceptRuleEquipped(ruleId)) return { ok: true };
  if ((S.conceptActive || []).length >= conceptSlots()) {
    return { ok: false, why: '印记槽满了，先卸下一个' };
  }
  S.conceptActive.push(ruleId);
  S.conceptTouched = true;
  return { ok: true };
}

function unequipConceptRule(ruleId) {
  S.conceptActive = (S.conceptActive || []).filter(id => id !== ruleId);
  S.conceptTouched = true;
}

/* 首次进入时自动装满：不让玩家因为没发现这个系统而零收益。
   一旦玩家自己动过（装着或卸下过），就不再替他做主。 */
function autoFillConceptRules() {
  if (S.conceptTouched) return false;
  const cap = conceptSlots();
  const can = equipableRules();
  let changed = false;
  can.forEach(id => {
    if (S.conceptActive.length >= cap) return;
    if (conceptRuleEquipped(id)) return;
    S.conceptActive.push(id);
    changed = true;
  });
  return changed;
}

/* ---------- 预设套组 ---------- */
/* 手动一条条换，打十个 BOSS 要操作三十次 —— 那个频率下没人会换。
   预设把「换」的成本从 6 次点击降到 1 次，选择才真的会发生。 */
const PRESET_COUNT = 3;

function presetLabel(i) {
  const p = S.conceptPresets && S.conceptPresets[i];
  const rules = (p && p.rules) || [];
  if (!rules.length) return '';
  const names = rules.map(rid => {
    const c = CONCEPTS.find(x => x.rule && x.rule.id === rid);
    return c ? c.icon + c.rule.name : null;
  }).filter(Boolean);
  if (!names.length) return '';
  return names.length > 2 ? names.slice(0, 2).join(' ') + ` +${names.length - 2}` : names.join(' ');
}

/* 把当前配置存进第 i 套 */
function savePreset(i) {
  if (!S.conceptPresets) S.conceptPresets = [{ rules: [] }, { rules: [] }, { rules: [] }];
  while (S.conceptPresets.length < PRESET_COUNT) S.conceptPresets.push({ rules: [] });
  S.conceptPresets[i] = { rules: (S.conceptActive || []).slice(0, conceptSlots()) };
  S.conceptTouched = true;
  return S.conceptPresets[i].rules.length;
}

/* 应用第 i 套：过滤掉已失效的，槽位不够时截断，并如实告诉玩家丢了什么 */
function applyPreset(i) {
  const p = S.conceptPresets && S.conceptPresets[i];
  if (!p || !p.rules || !p.rules.length) return { ok: false, why: '这一套还是空的' };
  const valid = equipableRules();
  const cap = conceptSlots();
  const kept = p.rules.filter(id => valid.indexOf(id) >= 0);
  const dropped = p.rules.length - kept.length;
  const cut = Math.max(0, kept.length - cap);
  S.conceptActive = kept.slice(0, cap);
  S.conceptTouched = true;
  return { ok: true, n: S.conceptActive.length, dropped, cut };
}

/* 战斗开始时快照一份，避免每帧跑 conceptProgress。
   只包含「已装上」的规则 —— 这就是选择的意义。 */
function conceptRuleSet() {
  const out = {};
  (S.conceptActive || []).forEach(rid => {
    if (conceptRuleOn(rid)) out[rid] = 1;
  });
  return out;
}

/* 汇总成可以直接加进 num 的修正 */
function conceptBonusStats() {
  const prog = conceptProgress();
  const acc = {};
  CONCEPTS.forEach(c => {
    if (!c.stats) return;
    const lv = prog[c.id].pct;
    if (lv <= 0) return;
    Object.keys(c.stats).forEach(k => {
      acc[k] = (acc[k] || 0) + c.stats[k] * lv;
    });
  });
  return acc;
}

function equipSum() {
  const num = {
    cdMul:0, ampEq:0, linkAdd:0, pageMul:0, costMul:0, rateEq:0, offlineEq:0,
    critAdd:0, critDmg:0, affAdd:0, attrIns:0, attrRigor:0, hpAdd:0, dmgCut:0,
    timeAdd:0, paraEq:0, paraAmp:0, godDmg:0, eraCut:0, atkPct:0,
  };
  const rules = {}, sigs = {};
  EQUIP_SLOTS.forEach(s => {
    const e = S.equip[s.id]; if (!e) return;
    (e.affixes || []).forEach(id => {
      const a = affixById(id); if (!a) return;
      if (a.kind === 'num') num[a.stat] = (num[a.stat] || 0) + a.val;
      else rules[a.rule] = (rules[a.rule] || 0) + 1;
    });
    /* 原典的专属能力：只跟「槽位 + 品质」绑定，不看词条 */
    const sig = EQUIP_SIGNATURE[s.id + ':' + e.q];
    if (sig) sigs[sig.id] = 1;
  });
  /* 概念加成最后并入：读得越多，这一层越厚 */
  const cb = conceptBonusStats();
  Object.keys(cb).forEach(k => { num[k] = (num[k] || 0) + cb[k]; });
  num.cdMul  = Math.max(-0.60, num.cdMul);
  num.dmgCut = Math.min((typeof DMG_CUT_CAP !== 'undefined' ? DMG_CUT_CAP : 0.60), num.dmgCut);
  num.costMul = Math.max(-0.50, num.costMul);
  return { num, rules, sigs };
}

function equippedCount() { return EQUIP_SLOTS.filter(s => S.equip[s.id]).length; }

function sortedBag() {
  const idx = id => EQUIP_SLOTS.findIndex(s => s.id === id);
  return S.bag.slice().sort((a, b) => (idx(a.slot) - idx(b.slot)) || (b.q - a.q));
}

/* 关卡结算时掷一次掉落
   v0.6：Boss 首通保底必掉（里程碑要有手感），重复刷只按 EQUIP_DROP.boss 走。
   深渊 / 世界 BOSS 的 st.idx 是负数，品质按当前最高关卡算，别掉一堆手抄本。 */
function rollEquipDrop(st, sch, force) {
  let p = (EQUIP_DROP[st.kind] || 0) + (equipSum().rules.equipDrop ? 0.04 : 0) + 0.02 * tal('drop');
  if (force) p = 1;
  if (Math.random() > p) return null;
  const idx = st.idx >= 0 ? st.idx : (S.maxStage || 0);
  const slot = EQUIP_SLOTS[Math.floor(Math.random() * EQUIP_SLOTS.length)].id;
  return makeEquip(slot, equipQualityFor(idx, st.kind), sch ? sch.id : null);
}

function addEquip(e) {
  if (!e) return null;
  S.bag.push(e);
  const cur = S.equip[e.slot];
  if (!cur || e.q > cur.q) { S.equip[e.slot] = e; return 'worn'; }
  return 'bag';
}

/* ---------------- 装备合成：保证不退化 ----------------
   规则：同槽位 + 同品质 × 2 → 升一档
   不退化 = 品质必升 1 档，且词条只增不减：
     新的词条 = 主件全部词条（原样保留）
               + 从材料里挑一条主件没有的（材料的好词条不浪费）
               + 若还没到该档位上限，再从本槽位池补一条新的
   ------------------------------------------------------------ */
/* 合成：三件同槽位、同品质 → 一件升一档。
   三合一而不是二合一，是为了让「攒材料」这件事有明显的节奏感：
   每一档要 3 件，六档下来刚好是一条能被规划出来的长线。 */
const CRAFT_NEED = 3;

function craftPreview(uidA, uidB, uidC) {
  const uids = [uidA, uidB, uidC].filter(x => x != null);
  if (uids.length !== CRAFT_NEED) return { ok:false, why:'需要凑齐 ' + CRAFT_NEED + ' 件装备' };
  const list = uids.map(uid => S.bag.find(x => x.uid === uid));
  if (list.some(x => !x)) return null;
  const [a, b, c] = list;
  if (!(a.slot === b.slot && b.slot === c.slot)) return { ok:false, why:'三件装备必须属于同一个槽位' };
  if (!(a.q === b.q && b.q === c.q)) return { ok:false, why:'三件装备必须同为「' + QUALITIES[a.q].grade + '」' };
  if (a.q >= QUALITIES.length - 1) return { ok:false, why:'已经是最高品质「' + QUALITIES[a.q].grade + '」，无法再合成' };
  const keep = a.affixes.slice();
  const extra = [];
  [b, c].forEach(x => x.affixes.forEach(id => {
    if (keep.indexOf(id) < 0 && extra.indexOf(id) < 0) extra.push(id);
  }));
  const cap = equipAffixCount(a.q + 1);
  return {
    ok: true, a, b, c, list, keep, extra, cap,
    out: { q: a.q + 1, slot: a.slot, school: a.school, affixes: keep.slice(0, cap) },
  };
}

function craftEquip(uidA, uidB, uidC) {
  const pv = craftPreview(uidA, uidB, uidC);
  if (!pv || !pv.ok) return null;
  const keep = pv.keep.slice();
  const extra = pv.extra.slice();
  const cap = equipAffixCount(pv.a.q + 1);
  /* 先把两件材料里「主件没有」的词条吸收进来 */
  while (keep.length < cap && extra.length) {
    keep.push(extra.splice(Math.floor(Math.random() * extra.length), 1)[0]);
  }
  /* 还不够就从本槽位词条池补 */
  while (keep.length < cap) {
    const pool = AFFIXES.filter(x => x.slot === pv.a.slot && keep.indexOf(x.id) < 0);
    if (!pool.length) break;
    keep.push(pool[Math.floor(Math.random() * pool.length)].id);
  }
  const out = {
    uid: S.equipUid++, slot: pv.a.slot, q: pv.a.q + 1,
    school: pv.a.school, affixes: keep,
  };
  const k = equipKey(out);
  if (!S.equipSeen.includes(k)) S.equipSeen.push(k);
  /* 消耗三件材料 */
  const uids = [uidA, uidB, uidC];
  const wasWorn = S.equip[pv.a.slot] && uids.indexOf(S.equip[pv.a.slot].uid) >= 0;
  S.bag = S.bag.filter(x => uids.indexOf(x.uid) < 0);
  S.bag.push(out);
  if (wasWorn) S.equip[out.slot] = out;
  return out;
}

/* 穿戴 / 卸下 */
function wearEquip(uid) {
  const e = S.bag.find(x => x.uid === uid);
  if (!e) return false;
  S.equip[e.slot] = e;
  return true;
}
function unwearEquip(slotId) {
  if (!S.equip[slotId]) return false;
  S.equip[slotId] = null;
  return true;
}

/* ---------------- 熔解：多余的装备换回书页 ----------------
   背景：v0.5.x 的品质被纪元白送，仓库塞满了同质的原典 —— 一堆满级等于没有满级。
   熔解是「清库房」的出口，不是赚钱的路子：数值压得比书升阶便宜得多。
   批量只熔「比身上这件差的」，绝不动你最好的装备。 */
function meltValue(e) {
  if (!e) return 0;
  const base = (typeof EQUIP_MELT_PAGE !== 'undefined' ? EQUIP_MELT_PAGE[e.q] : 8) || 8;
  return Math.round(base * (1 + 0.10 * ((e.affixes || []).length)));
}

function meltEquip(uid) {
  const i = S.bag.findIndex(x => x.uid === uid);
  if (i < 0) return 0;
  const e = S.bag[i];
  if (S.equip[e.slot] && S.equip[e.slot].uid === uid) S.equip[e.slot] = null;
  S.bag.splice(i, 1);
  craftSel = craftSel.filter(u => u !== uid);
  const gain = meltValue(e);
  S.page += gain;
  return gain;
}

/* 批量计划：真正「没用了」的才算冗余 ——
     比身上这件好的      → 留（马上换上）
     平级但还没封顶的    → 留（三件同槽同档可以合成升档）
     平级且已经封顶的    → 熔（原典再合成也不会更高，纯粹占位）
     比身上这件差的      → 熔
   这一条就是为「一堆满级装备」准备的出口。 */
function meltPlan() {
  const top = QUALITIES.length - 1;
  return S.bag.filter(e => {
    const worn = S.equip[e.slot];
    if (!worn) return false;          /* 这个槽位还空着，先别动 */
    if (worn.uid === e.uid) return false;
    if (e.q > worn.q) return false;
    if (e.q === worn.q) return e.q >= top;
    return true;
  });
}

/* 范式总加成：分段复利。前段给足爽感，后段防止指数爆炸 */
function paraMulOf(points, extra) {
  const bonus = PARA_BONUS + (extra || 0);
  const n = Math.min(PARADIGM_CAP, Math.max(0, points || 0));
  const soft = PARADIGM_SOFT_POINTS;
  if (n <= soft) return Math.pow(1 + bonus, n);
  return Math.pow(1 + bonus, soft) * Math.pow(1 + bonus * PARADIGM_SOFT_RATE, n - soft);
}

function stats() {
  const attr = { insight:0, rigor:0, intuition:0, eloquence:0, precision:0, fortitude:0, celerity:0 };
  const ES = equipSum();
  const eq = ES.num, eqRules = ES.rules, sigs = ES.sigs || {};
  let rate = 0;
  for (const id in S.books) {
    const b = bookById(id); if (!b) continue;
    const st = S.books[id]; const q = qOf(st.q);
    rate += b.rate * q.rate * (1 + LV_RATE_BONUS * (st.lv - 1));
    if (b.type === 'attr' && b.attr) {
      for (const k in b.attr) {
        attr[k] += b.attr[k] * (1 + LV_ATTR_BONUS * (st.lv - 1)) * q.rate;
      }
    }
  }
  attr.insight += eq.attrIns;
  attr.rigor += eq.attrRigor;
  /* 范式加成是复利而非叠加，但带边际递减：
     前 PARADIGM_SOFT_POINTS 点按全速，之后每点只按 PARADIGM_SOFT_RATE 计入 */
  const paraMul = paraMulOf(S.paradigm || 0, eq.paraAmp || 0);
  /* 研究课题：已结题的永久结论 */
  const RB = (typeof researchBonus === 'function') ? researchBonus() : null;
  /* 🏛️ 错误博物馆：每识破一条，产出与攻击 +1%（上限 +10%） */
  const debunkMul = 1 + Math.min(0.10, 0.01 * ((S.debunk || []).length));
  /* 🕳️ 记忆强化：每次击退遗忘 +1%（上限 +10%） */
  const memMul = 1 + Math.min(WORLD_BOSS.memoryCap / 100, 0.01 * (S.memory || 0));
  rate *= (1 + 0.10 * attr.insight) * paraMul * debunkMul * memMul * (1 + 0.12 * tal('insight')) * (1 + eq.rateEq) * (1 + (RB ? RB.rate : 0));
  const atk = (12 + attr.rigor * 2) * paraMul * debunkMul * memMul * (1 + 0.12 * tal('power')) * (1 + (eq.atkPct || 0)) * (1 + (RB ? RB.atk : 0));
  /* 生命同样吃范式复利：否则后期能秒敌人、但也被敌人秒 */
  const hp = Math.round(((120 + attr.rigor * 3) * paraMul + S.paradigm * 15 + eq.hpAdd)
    * (1 + 0.15 * tal('vitality')) * (1 + (RB ? RB.hp : 0)));
  /* 组合带来的被动（波粒二象性加暴击、感应风暴减冷却） */
  let comboCrit = 0, comboCdCut = 1;
  activeCombos().forEach(c => {
    if (c.critAdd) comboCrit += c.critAdd;
    if (c.cdCut) comboCdCut *= (1 - c.cdCut);
  });
  /* 暴击率：60% 以内与旧版完全一致（0.6% / 点），超出部分渐近到 99%
     —— 旧版在这里硬切 60%，后期 93% 的直觉点等于白拿。
     天赋「明察」给的暴击率和直觉走同一条曲线，不会绕过它 */
  const crit = Math.min(CRIT_CAP,
    critFromRaw(attr.intuition * 0.006 + eq.critAdd + comboCrit + 0.03 * tal('crit')));
  const skills = deskList();
  /* 跨范式：书桌上有两种以上方法论时，全队技能伤害 +10% */
  const docs = new Set(skills.map(d => doctrineOf(d.book)));
  const crossMul = docs.size >= 2 ? 1.10 : 1.0;
  /* 规则型词条「满架」：每本没上桌的书，技能伤害 +2% */
  const benchN = eqRules.benchBonus
    ? Object.keys(S.books).filter(id => S.desk.indexOf(id) < 0).length : 0;
  /* 📜 公理化：技能伤害 +18%，但冷却 +10% */
  const sigAmp = sigs.sigPrincipia ? 1.18 : 1;
  const sigCd  = sigs.sigPrincipia ? 1.10 : 1;
  const amp = (1 + attr.eloquence * 0.015) * crossMul * (1 + eq.ampEq) * (1 + 0.02 * benchN) * sigAmp * (1 + (RB ? RB.amp : 0));
  /* 冷却：捷才提供基础倍率（1.0 渐近到 0.30），装备/组合/专属/天赋继续往上乘，总和不低于下限 */
  const cdFromAttr = CD_FLOOR + (1 - CD_FLOOR) * Math.exp(-attr.celerity / CD_SOFT);
  const cdMul = Math.max(CD_FLOOR,
    cdFromAttr * (1 + eq.cdMul) * comboCdCut * sigCd * (1 - 0.04 * tal('cd')) * (1 + (RB ? RB.cd : 0)));
  /* 🔭 消色差：暴击伤害 1.8 → 2.5（词条与「精审」加成仍然叠加，且没有上限） */
  const critDmg = ((sigs.sigNoAberration ? 2.5 : CRIT_DMG_BASE)
    + attr.precision * CRIT_DMG_PER + (eq.critDmg || 0)) * (1 + 0.15 * tal('critdmg')) * (1 + (RB ? RB.critDmg : 0));
  /* 减伤：沉毅渐近 80%，天赋「沉稳」、课题与装备词条再叠加，总和不超上限 */
  const dmgCut = Math.min(DMG_CUT_CAP,
    DMG_CUT_CAP * (1 - Math.exp(-attr.fortitude / DMG_CUT_SOFT))
    + (eq.dmgCut || 0) + 0.03 * tal('cut') + (RB ? RB.dmgCut : 0));
  let dps = atk * AUTO_ATK_MULT;
  skills.forEach(d => {
    const lvF = 1 + 0.06 * (d.st.lv - 1);
    /* 专精：本派技能 +25%/级，其余 -8%/级 —— 这是「你选了哪一派」真正生效的地方 */
    dps += atk * d.book.mult * lvF * d.q.skill * amp * specBookMul(d.book) / (d.book.cd * cdMul);
  });

  return {
    attr, rate, atk, hp, crit, amp, dps, paraMul, skills, critDmg, sigs,
    eq, eqRules, cdMul,
    dmgCut,
    affAdd: eq.affAdd,
    linkAdd: eq.linkAdd,
    pageMul: eq.pageMul,
    godDmg: eq.godDmg,
    timeAdd: eq.timeAdd,
  };
}

/* ---------------- 关卡 ---------------- */
function schoolOf(idx) {
  const si = Math.min(SCHOOLS.length - 1, Math.max(0, Math.floor(idx / STAGES_PER_SCHOOL)));
  return { si, sch: schoolOrder(S.era)[si] };
}

/* ---------------- 研究课题 ----------------
   范式是「你看世界的方式」，所以它该花在「选择研究什么」上。
   立项 → 达成条件 → 结题拿走永久结论。 */
function researchDone(id) { return (S.research && S.research.done || []).indexOf(id) >= 0; }
function researchActive(id) { return (S.research && S.research.active || []).indexOf(id) >= 0; }

/* 当前进度 / 目标，供面板显示与判定复用 */
function researchProgress(r) {
  const n = r.need;
  switch (n.t) {
    case 'books':   return { got: Object.keys(S.books || {}).length, need: n.n };
    case 'bookLv':  return {
      got: Object.keys(S.books || {}).filter(id => (S.books[id].lv || 0) >= n.lv).length, need: n.n };
    case 'stage':   return { got: S.maxStage || 0, need: n.n };
    case 'debunk':  return { got: (S.debunk || []).length, need: n.n };
    case 'concept': return {
      got: Object.values(conceptProgress()).filter(p => p.pct >= 1).length, need: n.n };
    case 'equipQ':  return {
      got: (S.bag || []).filter(e => e.q >= n.q).length, need: n.n };
    case 'cards':   return { got: (S.cards || []).length, need: n.n };
    case 'abyss':   return { got: S.abyssDepth || 0, need: n.n };
    case 'prestige':return { got: S.prestigeCount || 0, need: n.n };
    case 'combo':   return { got: (S.comboSeen || []).length, need: n.n };
    default:        return { got: 0, need: 1 };
  }
}

function researchMet(r) {
  const p = researchProgress(r);
  return p.got >= p.need;
}

/* 已完成课题的加成汇总：一次算好，不给渲染循环添负担 */
function researchBonus() {
  const out = { rate:0, page:0, atk:0, hp:0, amp:0, cd:0, critDmg:0, dmgCut:0, abyss:0, desk:0, slot:0 };
  (S.research && S.research.done || []).forEach(id => {
    const r = RESEARCH.find(x => x.id === id);
    if (!r || !r.reward) return;
    for (const k in r.reward) out[k] = (out[k] || 0) + r.reward[k];
  });
  return out;
}

/* 结题检测：条件满足就自动完成。调用点见 checkAchievements 附近 */
function checkResearch() {
  if (!S.research || !S.research.active || !S.research.active.length) return null;
  const done = [];
  S.research.active = S.research.active.filter(id => {
    const r = RESEARCH.find(x => x.id === id);
    if (!r) return false;
    if (!researchMet(r)) return true;
    S.research.done.push(id);
    done.push(r);
    return false;
  });
  if (done.length) {
    const rb = researchBonus();
    /* 槽位类奖励要立刻反映到书桌与印记上限上 */
    deskSlots(); conceptSlots();
    done.forEach(r => {
      const txt = Object.keys(r.reward).map(k => (RESEARCH_REWARD_TEXT[k] || (() => ''))(r.reward[k])).filter(Boolean).join('、');
      toast(`结题 · ${r.name} —— ${txt}`);
      logLine(`📚 结题「${r.name}」：${txt}`, 'lg-skill');
    });
    dirty.shelf = 1; dirty.desk = 1;
  }
  return done.length ? done : null;
}

/* 天赋工具 */
function tal(id) { return (S.talents && S.talents[id]) || 0; }
function hasTalent(id) { return tal(id) > 0; }
function deskSlots() {
  const rb = (typeof researchBonus === 'function' && S.research) ? researchBonus().desk : 0;
  return DESK_SLOTS + tal('slot') + rb;
}
function paraFree() { return Math.max(0, (S.paradigm || 0) - (S.spent || 0)); }

/* ---- 周常世界 BOSS：遗忘 ---- */
function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return t.getUTCFullYear() + '-W' + String(wk).padStart(2, '0');
}

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* 每周一自动重置：次数回满，"已击退"清空；记忆强化永久保留 */
function ensureWorldWeek() {
  const wk = isoWeekKey(new Date());
  if (!S.world) S.world = { week: '', tries: 0, cleared: false, dmg: 0, total: 0, goal: 0, players: 0, milestones: [] };
  if (S.world.week !== wk) {
    S.world = { week: wk, tries: WORLD_BOSS.triesPerWeek, cleared: false, dmg: 0,
      total: 0, goal: 0, players: 0, milestones: [] };
    return true;
  }
  if (typeof S.world.tries !== 'number') S.world.tries = WORLD_BOSS.triesPerWeek;
  return false;
}

/* 同一周 → 同一配置（weak/resist/属性都由周号决定，跨玩家一致） */
function worldBossData() {
  const wk = isoWeekKey(new Date());
  const seed = hashStr(wk);
  const anchor = Math.min(SCHOOLS.length * STAGES_PER_SCHOOL - 1, Math.max(23, (S.maxStage || 24) - 1));
  const base = stageData(anchor);
  const tagKeys = Object.keys(TAGS);
  const weak = tagKeys[seed % tagKeys.length];
  const resist = tagKeys[(seed >>> 5) % tagKeys.length];
  return {
    idx: -2, si: -1, local: 0, round: 0, i: 0, kind: 'boss',
    name: WORLD_BOSS.name, emoji: WORLD_BOSS.emoji,
    weak, resist, doc: '理念',
    hp: Math.round(base.hp * WORLD_BOSS.hpMul),
    atk: Math.round(base.atk * WORLD_BOSS.atkMul * 10) / 10,
    quirk: Object.assign({ id: 'decay' }, QUIRKS.decay,
      { note: '遗忘不讲道理：同一本书用第二遍，它就已经忘了一半。' }),
    sch: { name: '理念世界', short: '遗忘', doctrine: '理念', epitaphs: WORLD_BOSS.lines, bosses: ['遗忘'] },
  };
}

/* ---- 深渊层数据：以最后一个学派 BOSS 为基准，每层 ×1.09 ---- */
function abyssData(depth) {
  if (!(depth >= 1)) depth = 1;
  const lastIdx = SCHOOLS.length * STAGES_PER_SCHOOL - 1;
  const base = stageData(lastIdx);
  const mul = Math.pow(ABYSS.growth, depth - 1);
  const isElite = depth % ABYSS.eliteEvery === 0;
  const tagKeys = Object.keys(TAGS);
  const weak = tagKeys[(depth * 7) % tagKeys.length];
  const resist = tagKeys[(depth * 5 + 3) % tagKeys.length];
  const schBase = base.sch || SCHOOLS[0];
  return {
    idx: -3, si: -1, local: depth, round: 0, i: 0,
    kind: isElite ? 'elite' : 'normal',
    name: isElite ? `深渊守门者 · 第 ${depth} 层` : `深渊 · 第 ${depth} 层`,
    emoji: isElite ? '🗝️' : '🕳️',
    weak, resist,
    doc: base.doc,
    hp: Math.round(base.hp * mul * (isElite ? 1.9 : 1)),
    atk: Math.round(base.atk * mul * (isElite ? 1.5 : 1) * 10) / 10,
    quirk: isElite
      ? Object.assign({ id: 'dilute' }, QUIRKS.dilute,
          { note: '深渊把它的伤摊进了无数层回音里，你打出去的力被一路稀释。' })
      : null,
    sch: {
      name: '深渊', short: '深渊', doctrine: base.doc || '实证',
      epitaphs: [
        '「越往下，越安静。」',
        '「这里没有学派，只有还没被忘掉的东西。」',
        '「你在数层数，层数也在数你。」',
      ],
      bosses: ['深渊守门者'],
    },
    depthLevel: depth,
    _schBaseId: schBase.id,
  };
}

function godData() {
  const last = stageData(SCHOOLS.length * STAGES_PER_SCHOOL - 1);
  /* 每次击败后按 ERA_GOD.growth 指数变强，不是线性 */
  const bo = Math.pow(ERA_GOD.growth, S.godKills || 0);
  return {
    idx: -1, si: -1, sch: SCHOOLS[0], local: 0, round: 0, i: 0,
    kind: 'boss', name: ERA_GOD.name + (S.godKills ? ` · 第 ${S.godKills + 1} 形态` : ''),
    emoji: ERA_GOD.emoji, weak: 'none', resist: 'all', doc: '理念',
    hp: Math.round(last.hp * ERA_GOD.hpBase * bo),
    atk: Math.round(last.atk * ERA_GOD.atkBase * bo * 10) / 10,
  };
}

function stageData(idx) {
  if (idx === -1) return godData();
  if (idx === -2) return worldBossData();
  if (idx === -3) return abyssData(S.abyssDepth || 1);
  const { si, sch } = schoolOf(idx);
  const local = idx - si * STAGES_PER_SCHOOL;
  const round = Math.floor(local / 8), i = local % 8;
  const bp = sch.blueprint[i];
  const mult = sch.mult || 1;
  const era = eraScale(S.era) * (1 - Math.min(0.5, eqN().eraCut || 0));  /* 「守成」 */
  const hp = STAGE_BASE_HP * mult * Math.pow(STAGE_GROWTH, local) * KIND_MULT[bp.k] * era;
  const atk = ENEMY_BASE_ATK * Math.pow(mult, 0.75) * Math.pow(ENEMY_ATK_GROWTH, local) * (bp.k === 'boss' ? 1.5 : 1) * Math.pow(era, 0.75);
  let name = bp.n;
  if (bp.k === 'elite') name = sch.elites[round] || bp.n;
  if (bp.k === 'boss') name = sch.bosses[round] || bp.n;
  /* 名人怪癖：精英按「这一轮是谁」取，BOSS 按学派取 */
  let quirk = null;
  if (bp.k === 'boss' && sch.bossQuirk && QUIRKS[sch.bossQuirk]) {
    quirk = Object.assign({ id: sch.bossQuirk }, QUIRKS[sch.bossQuirk]);
  } else if (bp.k === 'elite' && sch.eliteQuirks) {
    const e = sch.eliteQuirks[round];
    if (e && QUIRKS[e.id]) {
      quirk = Object.assign({ id: e.id }, QUIRKS[e.id], e.p || {});
      if (e.note) quirk.note = e.note;
    }
  }
  const extraWeak = (bp.k === 'boss' && sch.bossWeakExtra && sch.bossWeakExtra[round]) || [];
  return {
    idx, si, sch, local, round, i, kind: bp.k, name, emoji: bp.e,
    weak: bp.weak, resist: bp.resist, doc: bp.d || sch.doctrine,
    weakAll: extraWeak.length ? [bp.weak].concat(extraWeak) : null,
    quirk,
    hp: Math.round(hp), atk: Math.round(atk * 10) / 10,
  };
}

/* ---------------- 战斗 ---------------- */
function affinityOf(tag, st) {
  if (!tag) return 1;
  if (st.resist === 'all') return 0.8;
  /* weakAll：具体人物可以有多个额外弱点（宗教、金融这类「对人的学科」） */
  if (st.weakAll && st.weakAll.indexOf(tag) >= 0) return 1.25 + 0.05 * tal('affinity');
  if (tag === st.weak) return 1.25 + 0.05 * tal('affinity');
  if (tag === st.resist) return 0.8;
  return 1;
}

/* 方法论相性：方法论克制环 */
function doctrineAffinity(mine, theirs) {
  if (!mine || !theirs) return 1;
  if (COUNTER[mine] === theirs) return 1.25;
  if (COUNTER[theirs] === mine) return 0.8;
  return 1;
}

/* 装备加成取用：战斗中读战斗快照，战斗外临时汇总 */
function eqN() { return (B && B.eq) ? B.eq.num : equipSum().num; }
function eqR() { return (B && B.eq) ? B.eq.rules : equipSum().rules; }

/* 一本书对某个敌人的完整相性 = 学科 × 方法论（含装备词条） */
function affinityOfBook(book, st) {
  const eq = eqN(), R = eqR();
  let tagM = book ? affinityOf(book.tag, st) : 1;
  if (tagM < 1 && R.noResist) tagM = 1;   /* 「无视」：不再吃被抗惩罚 */
  if (tagM > 1) tagM += (eq.affAdd || 0); /* 「通晓」：克制倍率加成 */
  const docM = book ? doctrineAffinity(doctrineOf(book), st.doc) : 1;
  return { total: tagM * docM, tag: tagM, doc: docM };
}

function logLine(text, cls) {
  if (!B) return;
  B.log.push({ text, cls: cls || '' });
  if (B.log.length > 40) B.log.shift();
  renderLog();
}

/* 法学·立判例：书桌上有《论法的精神》或《社会契约论》时，
   开局从两条判例里裁定一条，本场有效。 */
function initPrecedent() {
  if (!B) return;
  B.prec = null;
  const has = deskList().some(d => d.book.effect === 'precedent');
  if (!has) return;
  const rules = [
    { id: 'atk', label: '攻击 +18%' },
    { id: 'def', label: '受伤 -15%' },
  ];
  B.prec = rules[Math.floor(Math.random() * rules.length)];
  logLine(`⚖️ 立判例 —— ${B.prec.label}（本场有效）`, 'lg-good');
}

function startBattle(idx) {
  /* 自动推关时也要重画地图，否则高亮会停在上一关（地图只在 dirty 时渲染） */
  dirty.map = 1;
  const st = stageData(idx);
  const P = stats();
  B = {
    idx, st,
    hp: st.hp, maxHp: st.hp,
    php: P.hp, maxPhp: P.hp,
    t: 0, atkTimer: 0, eAtkTimer: 0,
    cds: {}, guard: 0, guardSrc: null, reflect: 0, reflectSrc: null, silence: 0,
    dots: [], units: [], dmg: {}, util: {},
    over: false, log: [],
    morale: 0, interveneUsed: 0,          /* 战斗干预：士气点与已用加速秒数 */
    eq: equipSum(),                                  /* 本场装备快照 */
    limit: BATTLE_TIME + (stats().timeAdd || 0),      /* 「耐久」：限时延长 */
    _chain: false,
    comboCd: {}, rq: 0, rqT: 0, comboWave: false, sigUsed: 0, _retry: false,
    /* 概念规则快照（只有完全通晓的才在里面） */
    cr: conceptRuleSet(),
    hitCount: 0, castCount: 0, adaptStack: 0, adaptBook: null,
    duality: Math.random() < 0.5 ? 'wave' : 'particle',
    carryPending: Math.round((S.carry || 0)), suspendUsed: 0,
    /* 名人怪癖的运行时状态 */
    /* defMul 是「减伤比例」从 0 起算；atkMul 是「攻击系数」从 1 起算 —— 别搞反 */
    q: { tick: 0, spikeT: 0, shield: 0, exposed: 0, hits: 0, stacks: 0,
         atkMul: 1, defMul: 0, leapAt: 1, lastBook: null, decay: 0 },
  };
  closesVerdict();
  renderBreakdown();
  autoArrangeDesk();
  /* 「接续」：上一场击杀过，则开场几乎立刻能出手 */
  const kick = B.eq.rules.killReset ? 0.15 : 0.8;
  /* 🫧 概念「以太」：有介质托着，振动一开始就是满的 */
  if (B.cr.medium) {
    deskList().forEach(d => { B.cds[d.book.id] = 0; });
  } else {
    deskList().forEach(d => { B.cds[d.book.id] = kick + Math.random() * 0.6; });
  }
  /* 🔬 实验：同一关的重复次数。第 3 次起算"数据充分"——一次成功不算证据 */
  if (idx >= 0) {
    S.stageTries = S.stageTries || {};
    S.stageTries[idx] = (S.stageTries[idx] || 0) + 1;
    B.expTries = S.stageTries[idx];
    B.expData = B.expTries >= EXPERIMENT_NEED;
    if (B.expData) {
      const qp = st.quirk ? quirkParams(st.quirk) : '';
      logLine(`🔬 实验 ×${B.expTries}：数据充分 —— 本场伤害 +${Math.round(EXPERIMENT_BONUS * 100)}%`
        + (qp ? `　▸ 已测定：${qp}` : '　▸ 这个敌人的机制你已经摸清了'), 'lg-good');
    }
  }
  /* ⚖️ 法学·立判例：开场裁定一条本场规则 */
  initPrecedent();
  /* 学派机制的战斗内计时器 */
  B.verifyT = 0; B.priceT = 0; B.nameT = 0; B.sediment = 0; B.chainMul = 1;
  /* 🕳️ 概念「守恒」：上一场溢出的那部分，在这里还给对手 */
  if (B.cr.carry && B.carryPending > 0) {
    logLine(`⚖️ 转移：上一场溢出的 ${fmtDmg(B.carryPending)} 跟着来了。`, 'lg-good');
  }
  S.carry = 0;
  /* 💡 概念「光的本性」：这一场是波，还是粒 */
  if (B.cr.duality) {
    logLine(B.duality === 'wave'
      ? '💡 这一场，它是波 —— 你更容易击中要害。'
      : '💡 这一场，它是粒 —— 击中时会更重。', 'lg-hit');
  }
  logLine(`— 遭遇 ${st.name} —`, 'lg-skill');
  /* 规则太淡，不提醒就等于没做 —— 开场报一次「你带着什么上场」 */
  const crNames = CONCEPTS.filter(c => c.rule && B.cr[c.rule.id]).map(c => c.rule.name);
  if (crNames.length) {
    const spare = equipableRules().length - crNames.length;
    logLine(`◆ 印记：${crNames.join(' · ')}${spare > 0 ? `（还有 ${spare} 条通晓了没装）` : ''}`, 'lg-good');
  }
  if (st.quirk) {
    if (!Array.isArray(S.quirkSeen)) S.quirkSeen = [];
    if (S.quirkSeen.indexOf(st.quirk.id) < 0) { S.quirkSeen.push(st.quirk.id); save(); }
    const qd = st.quirk.note || st.quirk.desc;
    logLine(`「${st.quirk.name}」${qd}　▸ ${st.quirk.tip}`, 'lg-bad');
  }
  dirty.desk = 1;
  renderBattle(true);
}

function hitEnemy(raw, book, label, src, opts) {
  if (!B || B.over) return 0;
  const P = stats();
  const R = eqR();
  const st = B.st, q = st.quirk, qs = B.q;
  /* 「形式化」：重写规则 —— 无视抗性惩罚，也削掉对方的减伤 */
  const pierce = hasCombo('formalize') ? 0.30 : 0;
  let aff = (opts && opts.ignoreResist) ? 1 : affinityOfBook(book, st).total;
  if (pierce > 0 && aff < 1) aff = 1 - (1 - aff) * (1 - pierce);
  /* 🌐 概念「场」：场不需要接触 —— 普攻也沾到一半弱点 */
  if (B.cr && B.cr.action && !book && st.weak && aff <= 1) {
    aff = 1 + (affinityOf(st.weak, st) - 1) * 0.5;
  }

  /* ---- 「涨落」：整击落空的概率（在算伤害之前判定）---- */
  if (q && q.id === 'shrug' && Math.random() < q.chance) {
    floatText('落空', 'bad');
    if (label) logLine(`${label} 打空了 —— ${st.name} 的状态本来就不确定。`, 'lg-bad');
    return 0;
  }

  /* 💡 概念「光的本性」：这一场取波或粒 —— 波更容易打中要害，粒打中更重 */
  const dCrit = (B.cr && B.cr.duality && B.duality === 'wave') ? 0.04 : 0;
  const dCritDmg = (B.cr && B.cr.duality && B.duality === 'particle') ? 0.08 : 0;
  /* 「蔽障」让暴击彻底失效 */
  const crit = (q && q.id === 'blind') ? false : (Math.random() < (P.crit + dCrit));
  /* ⚖️ 概念「守恒」：上一场溢出的伤害，跟着这一击一起到（不吃本场暴击） */
  let carryAdd = 0;
  if (B.cr && B.cr.carry && B.carryPending > 0) { carryAdd = B.carryPending; B.carryPending = 0; }
  let dmg = raw * aff * (crit ? ((P.critDmg || 1.8) + dCritDmg) : 1) + carryAdd;
  if (B.idx === -1) dmg *= (1 + (P.godDmg || 0));   /* 「僭越」：对理念之神加伤 */

  /* ---- 怪癖：伤害修正 ---- */
  if (q) {
    if (q.id === 'dogma' && book && book.tag === st.resist) dmg *= (1 - q.penalty);
    if (q.id === 'falsify' && qs.exposed > 0) dmg *= (1 + q.amp);
    if (q.id === 'balance') dmg *= (1 - qs.defMul * (1 - pierce));
    if (q.id === 'entropy') dmg *= (1 + q.growth * qs.stacks);
    /* 「稀释」：单次伤害封顶，爆发流打不穿 */
    if (q.id === 'dilute') dmg = Math.min(dmg, B.maxHp * q.cap);
    /* 「归类」：同一本书连着用，效果递减 */
    if (q.id === 'decay' && book) {
      if (qs.lastBook === book.id) qs.decay = Math.min(q.max, qs.decay + q.step);
      else { qs.decay = 0; qs.lastBook = book.id; }
      dmg *= (1 - qs.decay);
    }
  }
  /* 📐 弹道计算：普攻有概率打出三倍（只对普通攻击生效，不吃技能） */
  if (!book && src === 'auto' && B.eq.sigs && B.eq.sigs.sigTrajectory && Math.random() < 0.20) {
    dmg *= 3;
  }
  /* 「红皇后」：双方都在加速，你也不例外 */
  if (B.rq) dmg *= (1 + 0.10 * B.rq);
  /* 🏃 概念「运动」：开场那几秒，已经动起来的东西不需要再推 */
  if (B.cr && B.cr.inertia && !book && src === 'auto' && B.t < 5) dmg *= 1.12;
  /* ♾️ 概念「无穷」：越是往后拖，越接近那个极限 */
  if (B.cr && B.cr.approach) dmg *= 1 + Math.min(0.14, Math.floor(B.t / 10) * 0.02);
  /* 🎲 概念「不确定性」：这一击本身就不准 */
  if (B.cr && B.cr.fluct) dmg *= 0.92 + Math.random() * 0.16;
  /* 🔢 概念「数论」：数到整数，就跳一格 */
  B.hitCount = (B.hitCount || 0) + 1;
  if (B.cr && B.cr.discrete && B.hitCount % 10 === 0) {
    dmg *= 1.5;
    if (label) floatText('整数', 'weak');
  }
  dmg = Math.max(1, dmg);

  /* ---- 怪癖：以太护盾，吃掉整击 ---- */
  if (q && q.id === 'ether' && qs.shield > 0) {
    qs.shield--;
    B.silence = Math.max(B.silence, q.silence);
    floatText('护盾', 'bad');
    logLine(`${st.name} 用「${q.name}」吃下这一击，顺手让你哑了 ${q.silence} 秒。`, 'lg-bad');
    flashEnemy();
    return 0;
  }

  B.hp -= dmg;
  B.dmg[src || 'auto'] = (B.dmg[src || 'auto'] || 0) + dmg;
  const affTxt = aff > 1 ? ' 克制' : (aff < 1 ? ' 被抗' : '');
  if (label) {
    logLine(`${label} ${fmtDmg(dmg)}${affTxt}${crit ? ' 暴击' : ''}`, crit ? 'lg-crit' : (aff > 1 ? 'lg-skill' : 'lg-hit'));
    floatText((crit ? '✦ ' : '') + fmtDmg(dmg), crit ? 'crit' : (aff > 1 ? 'weak' : (aff < 1 ? 'bad' : '')));
    if (crit || aff > 1) shakeEnemy();
  }
  flashEnemy();

  /* 「泡沫经济」：每次命中都有概率戳破一次 */
  if (hasCombo('bubble') && Math.random() < 0.20 && B.hp > 0) {
    const selfCost = B.php * 0.05, foeCost = B.maxHp * 0.15;
    B.php -= selfCost;
    B.hp -= foeCost;
    B.dmg['combo:bubble'] = (B.dmg['combo:bubble'] || 0) + foeCost;
    logLine(`🫧 泡沫破了：你损失 ${fmtDmg(selfCost)}，它损失 ${fmtDmg(foeCost)}。`, 'lg-good');
    hurtFeedback(selfCost, false, selfCost);
    if (B.hp <= 0) { winBattle(); return dmg; }
    if (B.php <= 0) { B.php = 0; loseBattle(); return dmg; }
  }

  /* ---- 怪癖：受击后结算 ---- */
  if (q) {
    /* 「弹性」：把打击还回去 */
    if (q.id === 'thorns' && dmg > 0) {
      const back = dmg * q.back;
      B.php -= back;
      hurtFeedback(back, false, back);
      logLine(`回弹 ${fmtDmg(back)} —— 你的力被原样还了回来。`, 'lg-bad');
      if (B.php <= 0) { B.php = 0; loseBattle(); return dmg; }
    }
    if (q.id === 'falsify') {
      qs.hits++;
      if (qs.hits >= q.hits) {
        qs.hits = 0; qs.exposed = q.dur;
        logLine(`${st.name} 被逼出破绽 —— ${q.dur} 秒内受伤 +${Math.round(q.amp * 100)}%。`, 'lg-good');
        floatText('破绽', 'weak');
      }
    }
    if (q.id === 'balance') {
      qs.defMul = Math.min(q.defCap, qs.defMul + q.defStep);
      qs.atkMul = Math.max(0.3, qs.atkMul - q.atkStep);
    }
    if (q.id === 'leap') {
      const pct = B.hp / B.maxHp;
      if (pct <= qs.leapAt - q.step + 1e-9) {
        qs.leapAt = pct;
        deskList().forEach(d => { B.cds[d.book.id] = d.book.cd; });
        logLine(`${st.name} 跃迁了一次，你的技能冷却被一起拉回原点。`, 'lg-bad');
        floatText('跃迁', 'bad');
      }
    }
  }

  /* 「连击」：暴击时额外打出一次普攻（加阀防止自递归） */
  if (crit && R.critAuto && !B._chain) {
    B._chain = true;
    hitEnemy(P.atk * AUTO_ATK_MULT, null, '连击', 'auto');
    B._chain = false;
  }
  if (B.hp <= 0) winBattle();
  return dmg;
}

/* ---------------- 怪癖：随时间结算的部分 ---------------- */
function tickQuirk(dt) {
  const q = B.st.quirk;
  if (!q) return;
  const qs = B.q;
  qs.tick += dt;
  if (qs.exposed > 0) qs.exposed = Math.max(0, qs.exposed - dt);

  if (q.id === 'bubble') {
    if (qs.tick >= q.every) {
      qs.tick -= q.every;
      const loss = B.maxHp * q.selfLoss;
      B.hp -= loss;
      B.dmg.auto = (B.dmg.auto || 0) + loss;
      const gain = loss * q.insightShare;
      S.insight += gain; S.eraInsight += gain;
      logLine(`${B.st.name} 又在补仓 —— 自损 ${fmtDmg(loss)}，你因此看懂了一点东西（洞见 +${fmt(gain)}）。`, 'lg-good');
      floatText('亏了', 'weak');
      if (B.hp <= 0) { winBattle(); return; }
    }
  } else if (q.id === 'ether') {
    if (qs.tick >= q.every) {
      qs.tick -= q.every;
      qs.shield = Math.min(2, qs.shield + 1);
      logLine(`${B.st.name} 重新布好了「${q.name}」。`, 'lg-hit');
    }
  } else if (q.id === 'compound' || q.id === 'entropy' || q.id === 'ramp') {
    if (qs.tick >= q.every) {
      qs.tick -= q.every;
      qs.stacks++;
      const pct = Math.round(q.growth * qs.stacks * 100);
      logLine(q.id === 'compound'
        ? `${B.st.name} 的攻势复利到 +${pct}% —— 越拖越贵。`
        : (q.id === 'ramp'
          ? `${B.st.name} 又爬升一档：攻击 +${pct}%。`
          : `熵在累积：双方受伤 +${pct}%。`), 'lg-bad');
    }
  } else if (q.id === 'spike') {
    /* 「脉冲」：蓄满一次，整发打出来 */
    qs.spikeT += dt;
    if (qs.spikeT >= q.every) {
      qs.spikeT -= q.every;
      const hit = B.st.atk * qs.atkMul * q.mult;
      logLine(`${B.st.name} 蓄满了 —— 一次放出 ${fmtDmg(hit)}。`, 'lg-bad');
      floatText('脉冲', 'bad');
      shakeEnemy();
      playerHurt(hit);
    }
  } else if (q.id === 'overdue') {
    if (qs.tick >= q.every) {
      qs.tick -= q.every;
      const live = deskList().filter(d => (B.cds[d.book.id] || 0) > 0);
      if (live.length) {
        const pick = live[Math.floor(Math.random() * live.length)];
        B.cds[pick.book.id] = (B.cds[pick.book.id] || 0) + q.push;
        logLine(`「${q.name}」打回来了：《${pick.book.name}》冷却 +${q.push}s。`, 'lg-bad');
      }
    }
  }
}

/* ---------------- 战斗视觉反馈 ---------------- */
function floatText(text, cls, side) {
  const host = side === 'self' ? $('#self-panel') : $('#enemy');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'float ' + (cls || '');
  el.style.left = (32 + Math.random() * 34) + '%';
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function shakeEnemy() {
  const host = $('#enemy');
  if (!host) return;
  host.classList.remove('shake');
  void host.offsetWidth;
  host.classList.add('shake');
  setTimeout(() => host.classList.remove('shake'), 220);
}

function burstParticles() {
  const host = $('#enemy');
  if (!host) return;
  for (let i = 0; i < 9; i++) {
    const p = document.createElement('i');
    p.className = 'particle';
    const a = Math.random() * Math.PI * 2;
    const r = 32 + Math.random() * 46;
    p.style.setProperty('--dx', Math.cos(a) * r + 'px');
    p.style.setProperty('--dy', (Math.sin(a) * r - 12) + 'px');
    p.style.background = ['#e8c765', '#f0d9a0', '#a8402f', '#5b8fb9'][i % 4];
    host.appendChild(p);
    setTimeout(() => p.remove(), 620);
  }
}

function flashSlot(id) {
  const el = document.querySelector(`#desk .slot[data-id="${id}"]`);
  if (!el) return;
  el.classList.remove('cast');
  void el.offsetWidth;
  el.classList.add('cast');
  setTimeout(() => el.classList.remove('cast'), 360);
}

function flashEnemy() {
  const el = $('#enemy-emoji');
  if (!el) return;
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 110);
}

/* ---------------- 战绩与诊断 ---------------- */
const BOOK_COLORS = ['#c9a227', '#5b8fb9', '#a8402f', '#8b7fd6', '#4e8a6b', '#d08a3f', '#b8543f'];

function colorOf(id) {
  if (id === 'auto') return '#7d7361';
  const i = BOOKS.findIndex(b => b.id === id);
  return BOOK_COLORS[(i < 0 ? 0 : i) % BOOK_COLORS.length];
}

function renderBreakdown() {
  const el = $('#breakdown');
  if (!el) return;
  const entries = (B && B.dmg) ? Object.entries(B.dmg).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) {
    $('#bd-bar').innerHTML = '';
    $('#bd-legend').innerHTML = '<span class="lg empty">本场伤害构成 · 交战后显示，用来判断该换哪本书</span>';
    return;
  }
  $('#bd-bar').innerHTML = entries.map(([k, v]) =>
    `<i style="width:${(v / total * 100).toFixed(1)}%;background:${colorOf(k)}"></i>`).join('');
  let html = entries.map(([k, v]) => {
    const b = bookById(k);
    const name = k === 'auto' ? '普通攻击' : (b ? b.name : '被动反弹');
    return `<span class="lg"><b style="background:${colorOf(k)}"></b>${name} ${Math.round(v / total * 100)}%</span>`;
  }).join('');
  const uptime = B.t > 0 ? B.t : 1;
  Object.entries(B.util || {}).forEach(([id, sec]) => {
    const b = bookById(id);
    if (!b || sec <= 0) return;
    html += `<span class="lg util"><b style="background:${colorOf(id)}"></b>${b.name} 生效 ${Math.round(Math.min(1, sec / uptime) * 100)}%</span>`;
  });
  $('#bd-legend').innerHTML = html;
}

function bookDps(d) {
  const P = stats();
  const lvF = 1 + LV_SKILL_BONUS * (d.st.lv - 1);
  return P.atk * d.book.mult * lvF * d.q.skill * P.amp / d.book.cd;
}

function benchSkills() {
  return Object.keys(S.books)
    .filter(id => bookById(id) && bookById(id).type === 'skill' && !S.desk.includes(id))
    .map(id => ({ id, book: bookById(id), st: S.books[id], q: qOf(S.books[id].q) }));
}

function diagnose() {
  const st = B.st, desk = deskList(), tips = [];
  const hpPct = Math.max(0, B.hp) / B.maxHp;

  const gain = prestigeGain();
  if (gain >= 2) {
    tips.push(`你已经有 ${gain} 点范式了。这一轮的数值墙靠升级翻不过去——试试范式转移：保留所有书、品质与全部装备，只重置等级，产出与攻击复利 ×${fmt(Math.pow(1 + PARA_BONUS, gain))}。`);
  }

  const resN = desk.filter(d => d.book.tag === st.resist).length;
  const weakN = desk.filter(d => d.book.tag === st.weak).length;
  if (resN >= 2 && weakN === 0) {
    tips.push(`${st.name} 抗「${TAGS[st.resist]}」，你桌上有 ${resN} 本正是这个系 —— 每次伤害都被砍 20%。换成「${TAGS[st.weak]}」系反过来能加 25%。`);
  } else if (weakN === 0) {
    tips.push(`${st.name} 的弱点是「${TAGS[st.weak]}」，你一本都没带。带上克制系，伤害直接多 25%。`);
  } else if (resN >= 1) {
    tips.push(`桌上有 ${resN} 本被它抗的「${TAGS[st.resist]}」系，等于白占槽位，换掉。`);
  }

  const bench = benchSkills();
  if (desk.length < 4) {
    const best = bench.sort((a, b) => bookDps(b) - bookDps(a))[0];
    tips.push(`书桌还空着 ${deskSlots() - desk.length} 个槽位${best ? `，《${best.book.name}》就在架上一动不动` : ''}。空槽等于白丢输出。`);
  } else {
    const weakest = desk.slice().sort((a, b) => bookDps(a) - bookDps(b))[0];
    const best = bench.sort((a, b) => bookDps(b) - bookDps(a))[0];
    if (best && weakest && bookDps(best) > bookDps(weakest) * 1.25) {
      tips.push(`《${weakest.book.name}》这场几乎没贡献，而架上《${best.book.name}》强得多 —— 换掉它。`);
    }
  }

  if (hpPct > 0 && hpPct < 0.35) {
    tips.push(`只差 ${fmt(B.hp)} 点血（还剩 ${Math.round(hpPct * 100)}%）。主力书升几级就过了。`);
  }

  const cheap = Object.keys(S.books)
    .map(id => ({ lv: S.books[id].lv, q: qOf(S.books[id].q) }))
    .filter(x => x.lv < x.q.cap)
    .map(x => upgradeCost(x.lv)).sort((a, b) => a - b)[0];
  if (cheap && S.insight > cheap * 1.5) {
    tips.push(`你有 ${fmt(S.insight)} 洞见没花 —— 升级永远比硬打划算。`);
  }

  if (!tips.length) tips.push('差得还比较多。回前几关刷书页，把主力技能书升阶，再回来。');
  return tips.slice(0, 3);
}

function showVerdict() {
  const el = $('#verdict');
  if (!el || !B) return;
  el.innerHTML = `
    <div class="vt">被 ${B.st.name} 击退</div>
    <ul>${diagnose().map(t => `<li>${t}</li>`).join('')}</ul>
    <div class="vacts">
      <button class="btn sm" onclick="closesVerdict()">知道了</button>
      <button class="btn gold sm" onclick="retryBattle()">再试一次</button>
    </div>`;
  el.hidden = false;
}

function closesVerdict() {
  const el = $('#verdict');
  if (el) el.hidden = true;
}

function retryBattle() {
  closesVerdict();
  startBattle(S.stage);
}

function castSkill(d) {
  flashSlot(d.book.id);
  const P = stats();
  const lvF = 1 + LV_SKILL_BONUS * (d.st.lv - 1);
  /* 超电磁炮：桌面上力系/运动系的书也被电磁加速了 */
  let comboSelf = 1;
  activeCombos().forEach(c => {
    if (c.boostTag && c.boostTag.indexOf(d.book.tag) >= 0) comboSelf *= (1 + c.boost);
  });
  /* 🧬 概念「演化」：一直让同一本出手，它就会长成配合你的样子 */
  let adaptMul = 1;
  if (B.cr && B.cr.adapt) {
    if (B.adaptBook === d.book.id) B.adaptStack = Math.min(5, (B.adaptStack || 0) + 1);
    else { B.adaptBook = d.book.id; B.adaptStack = 0; }
    adaptMul = 1 + 0.02 * B.adaptStack;
  }
  /* 📐 概念「公理」：一切推演，都从不需要证明的那句开始 */
  let firstMul = 1;
  if (B.cr && B.cr.selfEvid) {
    B.castCount = (B.castCount || 0) + 1;
    if (B.castCount === 1) firstMul = 1.20;
  }
  let base = P.atk * d.book.mult * lvF * d.q.skill * P.amp * comboSelf * adaptMul * firstMul
    * specBookMul(d.book);                               /* 专精：本派 +，其余 - */
  /* 全局机制修正（来自书桌上的学派书） */
  if (B.verifyT > 0) base *= 1.25;                       /* 认知·校验：看穿面板后 3 秒 */
  if (B.priceT > 0) base *= 1.15;                        /* 经济·定价：花洞见买的增益 */
  if (B.prec && B.prec.id === 'atk') base *= 1.18;       /* 法学·判例：攻击型 */
  if (B.chainMul && B.chainMul !== 1) { base *= B.chainMul; B.chainMul = 1; }  /* 信息·编排接续 */
  if (B.expData) base *= (1 + EXPERIMENT_BONUS);         /* 实验：数据充分后的熟练加成 */
  const i0 = d.slot;
  const left = (i0 % DESK_COLS !== 0) ? S.desk[i0 - 1] : null;
  const right = (i0 % DESK_COLS !== DESK_COLS - 1) ? S.desk[i0 + 1] : null;
  let same = 0;
  if (left && bookById(left) && bookById(left).tag === d.book.tag) same++;
  if (right && bookById(right) && bookById(right).tag === d.book.tag) same++;
  const linkMul = 1 + 0.08 * same + (eqN().linkAdd || 0);

  switch (d.book.effect) {
    case 'strike':
      hitEnemy(base * linkMul, d.book, `${d.book.name}`, d.book.id);
      break;
    case 'chain': {
      let total = 0;
      for (let k = 0; k < 3; k++) total += hitEnemy(base * 0.55 * linkMul, d.book, k === 0 ? `${d.book.name}（3 跳）` : '', d.book.id);
      break;
    }
    case 'burst': {
      const hits = 5;
      for (let k = 0; k < hits; k++) {
        hitEnemy(base * 1.0 * linkMul, d.book, k === 0 ? `${d.book.name}（${hits} 段）` : '', d.book.id);
        if (!B || B.over) break;
      }
      break;
    }
    case 'execute': {
      const ex = B.hp / B.maxHp < 0.35;
      hitEnemy(base * linkMul * (ex ? 2 : 1), d.book, `${d.book.name}${ex ? ' 处决' : ''}`, d.book.id);
      break;
    }
    case 'aoe':
      B.silence = 3;
      hitEnemy(base * linkMul, d.book, `${d.book.name}`, d.book.id);
      logLine('全场沉默 3 秒', 'lg-good');
      break;
    case 'guard':
      B.guard = 5; B.guardSrc = d.book.id;
      logLine(`${d.book.name}：伤害减免 60%（5 秒）`, 'lg-good');
      break;
    case 'reflect':
      B.reflect = 3; B.reflectSrc = d.book.id;
      logLine(`${d.book.name}：反弹 45%（3 秒）`, 'lg-good');
      break;
    case 'dot': {
      const per = P.atk * d.book.mult * lvF * d.q.skill * P.amp * linkMul * 0.35;
      const exist = B.dots.find(x => x.id === d.book.id);
      if (exist) { exist.stacks++; exist.until = 14; }
      else B.dots.push({ id: d.book.id, per, stacks: 1, until: 14, tag: d.book.tag, tick: 0, name: d.book.name });
      logLine(`${d.book.name}：叠加第 ${exist ? exist.stacks : 1} 层`, 'lg-skill');
      break;
    }
    case 'summon': {
      spawnUnits(d.book, d, P, lvF);
      break;
    }
    /* ---------- 以下 11 个 case 对应 11 个学派的新动词 ---------- */
    case 'heal': {
      /* 医学·救治：治疗书不造成伤害（mult 为 0），改回血。
         红线：单次治疗不超过敌人每秒输出的 1.2 倍，否则会变成无限挂机。 */
      const raw = B.maxPhp * 0.10 * lvF * d.q.skill;
      const amt = Math.min(raw, (B.st.atk || 1) * 1.2);
      const selfHeal = Math.min(B.maxPhp - B.php, amt * 0.6);
      B.php += selfHeal;
      const unitHeal = healUnits(amt * 0.8);
      logLine(`⚕️ ${d.book.name}：自身 +${fmtDmg(selfHeal)}${unitHeal > 0 ? ` · 单位 +${fmtDmg(unitHeal)}` : ''}`, 'lg-good');
      floatText('+' + fmtDmg(selfHeal), 'good', 'self');
      break;
    }
    case 'verify': {
      /* 认知·校验：先打一发，再看穿面板 —— 之后 3 秒全队伤害 +25% */
      hitEnemy(base * linkMul, d.book, `${d.book.name}（校验）`, d.book.id);
      B.verifyT = 3;
      logLine('🧠 校验：面板上的数字被看穿了 —— 3 秒内伤害 +25%。', 'lg-skill');
      break;
    }
    case 'program': {
      /* 信息·编排：这一发放完，若还有别的技能就绪，立刻接着放（只链一层） */
      hitEnemy(base * linkMul, d.book, d.book.name, d.book.id);
      if (!B._chained) {
        const nxt = deskList().find(x => x.book.id !== d.book.id && (B.cds[x.book.id] || 0) <= 0.001);
        if (nxt && B && !B.over) {
          B._chained = true;
          B.chainMul = 1.25;
          B.cds[nxt.book.id] = nxt.book.cd * (P.cdMul || 1);
          logLine(`🧮 编排：接续《${nxt.book.name}》（伤害 +25%）`, 'lg-skill');
          castSkill(nxt);
          B._chained = false;
        }
      }
      break;
    }
    case 'precedent': {
      /* 法学·立判例：本场规则已在开场裁定，这里只负责输出 */
      hitEnemy(base * linkMul, d.book, d.book.name, d.book.id);
      if (B.prec) logLine(`⚖️ 依判例而行 —— ${B.prec.label}`, 'lg-good');
      break;
    }
    case 'pricing': {
      /* 经济·定价：伤害本身一般，真正的价值在开场的自动采购 */
      hitEnemy(base * linkMul, d.book, `${d.book.name}（成交）`, d.book.id);
      break;
    }
    case 'naming': {
      /* 语言·命名：给敌人命名，这一击无视它的抗性 */
      hitEnemy(base * linkMul, d.book, `${d.book.name}（命名）`, d.book.id, { ignoreResist: true });
      B.nameT = 6;
      logLine(`🗣️ 命名：它不再是"未知"。6 秒内攻击无视抗性。`, 'lg-skill');
      break;
    }
    case 'phase': {
      /* 天文·相位：伤害随 8 秒周期起伏 */
      const ph = 1 + 0.22 * Math.sin(B.t * Math.PI / 4);
      hitEnemy(base * linkMul * ph, d.book, `${d.book.name}${ph > 1.15 ? '（近地点）' : ph < 0.9 ? '（远地点）' : ''}`, d.book.id);
      break;
    }
    case 'sediment': {
      /* 地质·沉积：伤害不立刻结算，层积到阈值后一次性爆发 */
      B.sediment = (B.sediment || 0) + base * linkMul;
      const need = B.maxHp * 0.12;
      logLine(`🪨 沉积：${fmtDmg(B.sediment)} / ${fmtDmg(need)}（达阈值即爆发）`, 'lg-good');
      if (B.sediment >= need) {
        const burst = B.sediment * 1.6;
        B.sediment = 0;
        logLine(`🏔️ 层积爆发！一口气 ${fmtDmg(burst)}`, 'lg-skill');
        hitEnemy(burst, d.book, '层积爆发', d.book.id);
      }
      break;
    }
    case 'rotation': {
      /* 生态·轮作：战斗越久，加成就越高（每 5 秒 +3%，上限 +18%） */
      const rot = 1 + Math.min(0.18, 0.03 * Math.floor(B.t / 5));
      hitEnemy(base * linkMul * rot, d.book, `${d.book.name}${rot > 1.1 ? '（已换茬）' : ''}`, d.book.id);
      break;
    }
    case 'intel': {
      /* 战略·先发：开场压制，10 秒后回归常态 */
      const mul2 = B.t <= 10 ? 1.40 : 1;
      hitEnemy(base * linkMul * mul2, d.book, `${d.book.name}${mul2 > 1 ? '（庙算）' : ''}`, d.book.id);
      break;
    }
    case 'chord': {
      /* 音乐·和弦：另一个技能也准备就绪时，两者合奏 —— 这一发 +45% */
      const partner = deskList().find(x => x.book.id !== d.book.id && (B.cds[x.book.id] || 0) <= 0.001);
      const mul3 = partner ? 1.45 : 1;
      hitEnemy(base * linkMul * mul3, d.book, `${d.book.name}${partner ? `（与《${partner.book.name}》合奏）` : ''}`, d.book.id);
      break;
    }
  }
}

/* ================= 己方单位（Unit）地基层 =================
   有血量、会被敌人打、会被治疗、会被摧毁的实体。
   医学（救治）/ 墨家（造物 + 非攻反伤）/ 博物（种群）三个学派共用这一层。
   ---------------------------------------------------------- */
function unitAlive() {
  return (B && B.units) ? B.units.filter(u => u.hp > 0) : [];
}

/* 非攻：只要场上有存活的己方单位，敌人打「你」也会被反弹。
   来源是书桌上的书（《备城门》《非攻》各带一段 unitReflect），上限 30%。 */
function unitReflectRate() {
  if (!unitAlive().length) return 0;
  let r = NONAGGRESSION.reflect || 0;
  (S.desk || []).forEach(id => {
    const b = id && bookById(id);
    if (b && b.unitReflect) r += b.unitReflect;
  });
  return Math.min(UNIT_REFLECT_AURA_CAP, r);
}

/* 召唤物总 DPS（每 2 秒出手一次，所以单次伤害 / 2） */
function unitTotalDps() {
  return unitAlive().reduce((s, u) => s + (u.atk / (u.interval || 2)), 0);
}

/* 造物 / 召唤：书决定单位类型与数量，数值按本体缩放，并守住红线 */
function spawnUnits(book, d, P, lvF) {
  if (!B) return [];
  if (!B.units) B.units = [];
  const kindId = book.unit || 'strike';
  const T = UNIT_TYPES[kindId] || UNIT_TYPES.strike;
  const n = Math.max(1, book.unitCount || 1);
  const made = [];
  for (let i = 0; i < n; i++) {
    if (unitAlive().length >= UNIT_LIMIT) break;
    const maxHp = Math.max(1, Math.round(B.maxPhp * T.hpRatio));
    const atk = P.atk * (book.mult || 0.5) * lvF * d.q.skill * P.amp * T.dmgRatio * specBookMul(book);
    const u = {
      uid: (B.unitUid = (B.unitUid || 0) + 1),
      id: book.id, name: book.name, icon: T.icon, kind: kindId,
      hp: maxHp, maxHp, atk,
      interval: 2, tick: 0, until: T.life || 12, burst: T.burst || 0.5,
      grow: book.grow || 0, growT: 0,
    };
    B.units.push(u);
    made.push(u);
  }
  /* 红线：召唤物总 DPS 不超过本体的 60%（按比例整体缩放） */
  clampUnitDps((P.dps || 0) * UNIT_DPS_CAP);
  if (made.length) {
    const left = UNIT_LIMIT - unitAlive().length;
    logLine(`${T.icon} ${book.name}：${made.length} 个「${T.name}」单位入场${left <= 0 ? '（已达上限）' : ''}`, 'lg-skill');
    floatText(`${T.icon} ×${made.length}`, 'weak');
  }
  return made;
}

/* 承伤：优先由守护单位吃，没有守护则由在场单位按 intercept 分担。
   返回真正被单位吸收的伤害量（剩余部分才落到玩家身上）。 */
function unitAbsorb(dmg) {
  const alive = unitAlive();
  if (!alive.length || dmg <= 0) return 0;
  const guards = alive.filter(u => u.kind === 'guard');
  const takers = guards.length ? guards : alive;
  const rate = Math.max(...takers.map(u => (UNIT_TYPES[u.kind] || {}).intercept || 0));
  if (rate <= 0) return 0;
  let left = dmg * rate;
  const want = left;
  takers.slice().sort((a, b) => b.hp - a.hp).forEach(u => {
    if (left <= 0) return;
    const take = Math.min(left, u.hp);
    u.hp -= take;
    left -= take;
    if (u.hp <= 0) unitDied(u);
  });
  const absorbed = want - left;
  return absorbed;
}

/* 被摧毁：留下一次余威，然后从场上移除 */
function unitDied(u) {
  if (!B) return;
  B.units = (B.units || []).filter(x => x !== u);
  const back = u.atk * 3 * (u.burst || 0.5);
  logLine(`${u.icon} ${u.name} 被摧毁 —— 残骸的余威 ${fmtDmg(back)}`, 'lg-bad');
  if (back > 0 && B.hp > 0) {
    B.hp -= back;
    B.dmg[u.id] = (B.dmg[u.id] || 0) + back;
    if (B.hp <= 0) winBattle();
  }
}

/* 治疗接口：医学学派（P2）直接调这个，平均分给存活单位 */
function healUnits(amount) {
  const alive = unitAlive();
  if (!alive.length || !(amount > 0)) return 0;
  let healed = 0;
  alive.forEach(u => {
    const h = Math.min(u.maxHp - u.hp, amount / alive.length);
    if (h > 0) { u.hp += h; healed += h; }
  });
  return healed;
}

/* 红线：召唤物总 DPS 不超过本体 60%（按比例整体缩放）。
   繁殖会不断加单位，所以每次新增都要重新夹一次。 */
function clampUnitDps(capDps) {
  const cap = Math.max(0, capDps || 0);
  const cur = unitTotalDps();
  if (cur > cap && cur > 0) {
    const k = cap / cur;
    unitAlive().forEach(u => { u.atk *= k; });
  }
}

/* 把怪癖的数值参数翻译成一句可读的"实测数据"（实验机制解锁后显示） */
function quirkParams(q) {
  if (!q) return '';
  const N = { rate:'强度', cap:'上限', back:'反弹', chance:'概率', growth:'成长', silence:'沉默',
    push:'延迟', every:'周期', per:'每次', stacks:'层数', mul:'倍率', dmg:'伤害', heal:'治疗' };
  const parts = [];
  Object.keys(q).forEach(k => {
    const v = q[k];
    if (typeof v === 'number' && N[k]) {
      parts.push(`${N[k]} ${v < 1 ? Math.round(v * 100) + '%' : v}`);
    }
  });
  return parts.slice(0, 3).join(' · ');
}

/* 学派机制的计时器与自动采购（认知校验 / 经济定价 / 语言命名） */
function tickSchoolRules(dt) {
  if (!B) return;
  if (B.verifyT > 0) B.verifyT = Math.max(0, B.verifyT - dt);
  if (B.priceT > 0) B.priceT = Math.max(0, B.priceT - dt);
  if (B.nameT > 0) B.nameT = Math.max(0, B.nameT - dt);
  const pricing = deskList().find(d => d.book.effect === 'pricing');
  if (!pricing) { B.priceCd = 0; return; }
  B.priceCd = (B.priceCd || 0) + dt;
  if (B.priceCd >= 8) {
    B.priceCd = 0;
    const cost = (S.insight || 0) * 0.03;
    if (cost > 0.5) {
      S.insight = Math.max(0, S.insight - cost);
      S.eraInsight = Math.max(0, (S.eraInsight || 0) - cost);
      B.priceT = 10;
      logLine(`🏷️ 定价：花 ${fmt(cost)} 洞见，买下 10 秒 +15% 攻击。`, 'lg-good');
    }
  }
}

/* 单位每帧结算：出手 + 存活时间 + 种群繁殖。
   抽成独立函数，方便测试直接推进（不用跑整场战斗）。 */
/* 世界 BOSS 的三阶段「侵蚀」：血量跨过阈值时它变强，并说一句 */
function worldPhaseCheck() {
  if (!B || !B.st || B.st.idx !== -2 || B.over) return;
  const pct = B.hp / Math.max(1, B.maxHp);
  const stage = pct > 0.66 ? 1 : pct > 0.33 ? 2 : 3;
  if (B.wphase && stage <= B.wphase) return;
  B.wphase = stage;
  if (stage > 1) {
    B.wphase = stage;
    B.st.atk = Math.round(B.st.atk * 1.2 * 10) / 10;
    const line = (WORLD_BOSS.lines || [])[Math.min(WORLD_BOSS.lines.length - 1, stage - 1)] || '';
    logLine(`🕳️ 遗忘加深（第 ${stage} 阶段）：攻击 +20%　${line}`, 'lg-bad');
    floatText('遗忘加深', 'weak');
  }
}

function tickUnits(dt) {
  if (!B) return;
  (B.units || []).slice().forEach(u => {
    u.until -= dt; u.tick += dt;
    if (u.hp > 0 && u.tick >= (u.interval || 2)) {
      u.tick -= (u.interval || 2);
      const dd = u.atk;
      B.hp -= dd; B.dmg[u.id] = (B.dmg[u.id] || 0) + dd;
      if (B.hp <= 0) { winBattle(); }
    }
  });
  /* 种群繁殖：整场共用一个计时器 —— 每 grow 秒多一只，撞上容纳量就停。
     不给每只单位单独计时，否则 2 只会按 2、4、8 指数翻，两次就顶满。 */
  const growers = (B.units || []).filter(u => u.grow && u.hp > 0);
  if (growers.length) {
    const interval = Math.min(...growers.map(u => u.grow));
    B.growT = (B.growT || 0) + dt;
    if (B.growT >= interval) {
      B.growT = 0;
      if (unitAlive().length < UNIT_LIMIT) {
        const src = growers[0];
        const T = UNIT_TYPES[src.kind] || UNIT_TYPES.swarm;
        B.units.push(Object.assign({}, src, {
          uid: (B.unitUid = (B.unitUid || 0) + 1),
          tick: 0, until: T.life || src.until, growT: 0,
        }));
        clampUnitDps(stats().dps * UNIT_DPS_CAP);
        logLine(`🌱 ${src.name}：种群又多了 1 个（${unitAlive().length} 个在场）`, 'lg-good');
      } else {
        B.growT = interval;      /* 到顶就停在满值，腾出位置后立刻补 */
      }
    }
  }
  B.units = (B.units || []).filter(x => x.hp > 0 && x.until > 0);
}

/* ================= 书籍组合 ================= */
/* 书桌上同时放着某两本书，就会触发第三条规则。
   组合是「换阵容」这件事的核心奖励：它让两本单独看都不算强的书，凑在一起变得不可替代。 */
function activeCombos() {
  const desk = (S.desk || []).filter(Boolean);
  if (!desk.length) return [];
  return COMBOS.filter(c => c.need.every(id => desk.indexOf(id) >= 0));
}
function hasCombo(id) {
  const desk = (S.desk || []).filter(Boolean);
  const c = COMBOS.find(x => x.id === id);
  return !!c && c.need.every(id2 => desk.indexOf(id2) >= 0);
}

/* 第一次凑齐时记下来 —— 这是「发现」，不是「解锁」 */
function noteCombos() {
  const act = activeCombos();
  if (!act.length) return;
  if (!Array.isArray(S.comboSeen)) S.comboSeen = [];
  let changed = false;
  act.forEach(c => {
    if (S.comboSeen.indexOf(c.id) >= 0) return;
    S.comboSeen.push(c.id);
    changed = true;
    logLine(`书桌上有两本书相互呼应 —— 「${c.icon} ${c.name}」`, 'lg-skill');
    setTimeout(() => toast(`发现组合 · ${c.icon} ${c.name}`), 260);
  });
  if (changed) save();
}

/* 半激活：书都到手了，但只放了一本上桌。
   不点名是哪两本 —— 只让玩家知道「有东西还没试出来」。 */
function halfCombos() {
  const desk = (S.desk || []).filter(Boolean);
  const owned = Object.keys(S.books);
  const seen = S.comboSeen || [];
  return COMBOS.filter(c => {
    if (seen.indexOf(c.id) >= 0) return false;
    if (!c.need.every(id => owned.indexOf(id) >= 0)) return false;
    const onDesk = c.need.filter(id => desk.indexOf(id) >= 0).length;
    return onDesk === 1;
  });
}

/* 主动型组合：按自己的节拍额外释放，不占书桌的冷却 */
function tickCombos(dt) {
  const all = activeCombos();
  if (!all.length) return;
  if (!B.comboCd) B.comboCd = {};

  all.filter(c => c.kind === 'active').forEach(c => {
    if (B.comboCd[c.id] == null) B.comboCd[c.id] = c.cd * 0.5;
    B.comboCd[c.id] -= dt;
    if (B.comboCd[c.id] <= 0) {
      B.comboCd[c.id] = c.cd;
      castCombo(c);
    }
  });

  /* 红皇后：双方一起加速 */
  if (all.some(c => c.id === 'redqueen')) {
    B.rqT = (B.rqT || 0) + dt;
    if (B.rqT >= 10) {
      B.rqT -= 10;
      B.rq = Math.min(12, (B.rq || 0) + 1);
      logLine(`🏃 红皇后：双方都跑快了 —— 伤害 +${Math.round(B.rq * 10)}%`, 'lg-hit');
    }
  }
}

function castCombo(c) {
  const P = stats();
  if (!B || B.over) return;
  if (c.id === 'railgun') {
    const dmg = P.atk * c.mult * P.amp;
    logLine(`⚡ 超电磁炮：弹丸离轨`, 'lg-skill');
    hitEnemy(dmg, null, '超电磁炮', 'combo:railgun', { ignoreResist: true });
    shakeEnemy();
  } else if (c.id === 'dualism') {
    B.comboWave = !B.comboWave;
    if (B.comboWave) {
      logLine('🌗 波态：它同时穿过两条缝', 'lg-skill');
      for (let k = 0; k < 3; k++) {
        hitEnemy(P.atk * 0.85 * P.amp, null, k === 0 ? '波态（3 段）' : '', 'combo:dualism');
        if (!B || B.over) break;
      }
    } else {
      logLine('🌗 粒态：它只落在一点上', 'lg-skill');
      hitEnemy(P.atk * c.mult * P.amp, null, '粒态', 'combo:dualism');
    }
  } else if (c.id === 'induction') {
    logLine('🌩️ 感应风暴：磁场自己喂自己', 'lg-skill');
    hitEnemy(P.atk * c.mult * P.amp, null, '感应风暴', 'combo:induction');
    if (B && !B.over) {
      B.silence = Math.max(B.silence, c.silence);
      logLine(`电流把你震得说不出话（沉默 ${c.silence} 秒）`, 'lg-bad');
    }
  }
}

function playerHurt(dmg) {
  if (!B || B.over) return;
  const N = B.eq.num, R = B.eq.rules;
  let real = B.guard > 0 ? dmg * 0.4 : dmg;
  real *= (1 - (N.dmgCut || 0));                                  /* 「护持」 */
  if (R.lowHp && B.php / Math.max(1, B.maxPhp) < 0.30) real *= 0.5; /* 「坚韧」 */
  if (B.prec && B.prec.id === 'def') real *= 0.85;                 /* 法学·判例：受伤 -15% */
  /* 🕳️ 概念「怀疑」：开场先不下判断，那一击也就没那么实 */
  if (B.cr && B.cr.suspend && B.t < 3 && !B.suspendUsed) {
    B.suspendUsed = 1;
    real *= 0.75;
    logLine('🕳️ 悬置：你还没决定该怎么理解它。', 'lg-good');
  }
  B.php -= real;
  /* 「汲取」：他造成的伤害有一部分回流成自己的生命 */
  if (B.st.quirk && B.st.quirk.id === 'drain' && B.hp > 0) {
    /* ♨️ 概念「熵」：倒回去的过程，不会自己发生 —— 他吃不干净 */
    const healCap = (B.cr && B.cr.noReturn) ? 0.75 : 1;
    const heal = Math.min(B.maxHp - B.hp, real * B.st.quirk.rate * healCap);
    if (heal > 0.5) {
      B.hp += heal;
      logLine(`${B.st.name} 汲取了 ${fmtDmg(heal)} —— 你的伤害正在养活他。`, 'lg-bad');
    }
  }
  /* 玩家侧飘字：减速时才逐次显示，8× 下合并成一个滚动数字，避免刷屏 */
  hurtFeedback(real, B.guard > 0, dmg);
  const reflRate = (B.reflect > 0 ? 0.45 : (R.alwaysReflect ? 0.45 : 0))
    + unitReflectRate();                 /* 非攻：机关在场时，打我也反弹 */
  if (reflRate > 0) {
    /* 红线：单次反伤不超过玩家最大生命的 8% */
    const back = Math.min(real * reflRate, B.maxPhp * UNIT_REFLECT_CAP);
    B.hp -= back;
    B.dmg[B.reflectSrc || 'auto'] = (B.dmg[B.reflectSrc || 'auto'] || 0) + back;
    logLine(`反作用：反弹 ${fmtDmg(back)}`, 'lg-good');
    if (B.hp <= 0) { winBattle(); return; }
  }
  if (B.php <= 0) {
    /* 🕰️ 时间之外：每场只挡一次 */
    if (B.eq.sigs && B.eq.sigs.sigBeyond && !B.sigUsed) {
      B.sigUsed = 1;
      B.php = Math.round(B.maxPhp * 0.30);
      logLine('🕰️ 时间之外：这一次没有结束。', 'lg-good');
      floatText('时间之外', 'weak', 'self');
      return;
    }
    B.php = 0; loseBattle();
  }
}

/* ---------------- 玩家受击反馈 ---------------- */
let hurtAccum = 0, hurtShownAt = 0;

function hurtFeedback(real, guarded, raw) {
  const now = performance.now();
  hurtAccum += real;
  /* 0.18s 内多段伤害合并成一次；避免 8× 时几十个数字叠在一起 */
  if (now - hurtShownAt < 180) return;
  hurtShownAt = now;
  const show = hurtAccum;
  hurtAccum = 0;
  if (show < 0.5) return;
  floatText('-' + fmtDmg(show) + (guarded ? ' 挡' : ''), 'hurt', 'self');
  const host = $('#self-panel');
  if (!host) return;
  host.classList.remove('hurt');
  void host.offsetWidth;
  host.classList.add('hurt');
  setTimeout(() => { const h = $('#self-panel'); if (h) h.classList.remove('hurt'); }, 240);
}

function updateBattle(dt) {
  if (!B || B.over) return;
  B.t += dt;
  if (B.guard > 0 && B.guardSrc) B.util[B.guardSrc] = (B.util[B.guardSrc] || 0) + dt;
  if (B.reflect > 0 && B.reflectSrc) B.util[B.reflectSrc] = (B.util[B.reflectSrc] || 0) + dt;
  B.guard = Math.max(0, B.guard - dt);
  B.reflect = Math.max(0, B.reflect - dt);
  B.silence = Math.max(0, B.silence - dt);

  const P = stats();

  tickQuirk(dt);
  tickCombos(dt);
  if (!B || B.over) return;

  B.atkTimer += dt;
  if (B.atkTimer >= 1) { B.atkTimer -= 1; hitEnemy(P.atk * AUTO_ATK_MULT, null, ''); }

  const R = B.eq.rules;
  const cdMul = (P.cdMul || 1);
  const opening = (B.t < 8 && R.firstCast) ? 0.7 : 1;   /* 「起手」：开场 8 秒冷却 -30% */

  deskList().forEach(d => {
    /* 沉默中若无「默书」，冷却完全冻结 */
    if (B.silence > 0 && !R.silenceRun) return;
    B.cds[d.book.id] = (B.cds[d.book.id] == null ? 0 : B.cds[d.book.id]) - dt;
    if (B.cds[d.book.id] <= 0) {
      B.cds[d.book.id] = d.book.cd * cdMul * opening;
      if (B.silence <= 0) castSkill(d);
      /* 💡 第一千次：再试一次 */
      if (B.eq.sigs && B.eq.sigs.sigRetry && !B._retry && Math.random() < 0.12 && B && !B.over) {
        B._retry = true;
        logLine('💡 第一千次：又亮了一次。', 'lg-good');
        castSkill(d);
        B._retry = false;
      }
      /* ♻️ 热力学第一定律：账要平 —— 这次的能量回到下一次 */
      if (hasCombo('perpetual') && Math.random() < 0.30) {
        B.cds[d.book.id] = 0;
        logLine('♻️ 能量守恒：这次施放没有进入冷却。', 'lg-good');
      }
    }
  });

  B.dots.forEach(dt2 => {
    dt2.until -= dt;
    dt2.tick += dt;
    if (dt2.tick >= 1) {
      dt2.tick -= 1;
      const dd = dt2.per * dt2.stacks;
      B.hp -= dd;
      B.dmg[dt2.id] = (B.dmg[dt2.id] || 0) + dd;
      if (B.hp <= 0) winBattle();
    }
  });
  B.dots = B.dots.filter(x => x.until > 0);

  tickUnits(dt);
  tickSchoolRules(dt);
  worldPhaseCheck();

  if (!B || B.over) return;

  B.eAtkTimer += dt;
  if (B.eAtkTimer >= 1.6) {
    B.eAtkTimer -= 1.6;
    /* 怪癖会改写敌人的实际攻击：复利累加、天平变软、熵双方增伤 */
    const q = B.st.quirk, qs = B.q;
    let mul = qs.atkMul;
    if (q && (q.id === 'compound' || q.id === 'entropy' || q.id === 'ramp')) {
      mul *= (1 + q.growth * qs.stacks);
    }
    if (B.rq) mul *= (1 + 0.10 * B.rq);
    const hit = B.st.atk * mul;
    /* 己方单位先承伤：有守护就让守护吃，没有守护则按单位类型分担保一部分 */
    const absorbed = unitAbsorb(hit);
    logLine(`${B.st.name} 反击 ${fmtDmg(hit)}${absorbed > 0 ? `（${fmtDmg(absorbed)} 由己方单位承受）` : ''}`, 'lg-bad');
    if (hit - absorbed > 0) playerHurt(hit - absorbed);
  }
  if (!B || B.over) return;

  if (B.t >= (B.limit || BATTLE_TIME)) loseBattle();
}

function winBattle() {
  if (!B || B.over) return;
  B.over = true;
  /* ⚖️ 概念「守恒」：打死之后多出来的那些没有消失，只是去了下一场 */
  if (B.cr && B.cr.carry) {
    const over = Math.max(0, -B.hp);
    S.carry = over * 0.10;
    if (S.carry >= 1) logLine(`⚖️ 守恒：多出来的 ${fmtDmg(S.carry)} 被存了下来。`, 'lg-good');
  } else {
    S.carry = 0;
  }
  burstParticles();
  let nextStageOverride = null;
  let gotCard = null;
  const st = B.st;
  const first = st.idx >= S.maxStage;

  const N = B.eq.num, R = B.eq.rules;
  let pages = Math.round(PAGE_DROP[st.kind] * (1 + 0.45 * st.round)
    * (1 + (N.pageMul || 0)) * (1 + 0.10 * tal('page'))
    * (1 + (typeof researchBonus === 'function' ? researchBonus().page : 0)));
  if (first && R.firstDouble) pages *= 2;          /* 「初版」：首通书页翻倍 */
  S.page += pages;
  let msg = `击败 ${st.name} · 书页 +${pages}`;

  /* 装备掉落：实体物件，范式转移后依然留着。Boss 首通保底给一件 */
  const dropEq = rollEquipDrop(st, st.sch, first && st.kind === 'boss');
  if (dropEq) {
    const how = addEquip(dropEq);
    msg += ` · ${how === 'worn' ? '装备' : '收入'}「${equipFullName(dropEq)}」`;
  }

  const dropList = [];
  if (STAGE_DROPS[st.idx]) {
    STAGE_DROPS[st.idx].forEach(d => {
      if (S.books[d.id]) { S.page += 40; dropList.push(`${bookById(d.id).name}（已有，转化书页 +40）`); }
      else { addBook(d.id); dropList.push(bookById(d.id).name); }
    });
  }
  const rare = st.sch.rare;
  if (rare && Math.random() < rare.chance) {
    if (S.books[rare.id]) S.page += 90;
    else { addBook(rare.id); dropList.push(bookById(rare.id).name + '（稀有）'); }
  }
  if (dropList.length) msg += ' · 获得 ' + dropList.join('、');

  /* 打赢了就把实验计数归零：下一关重新从"一次观察"开始 */
  if (S.stageTries && S.stageTries[st.idx]) { delete S.stageTries[st.idx]; }

  if (first) {
    S.maxStage = Math.max(S.maxStage, st.idx + 1);
    /* 🏛️ 错误博物馆：识破一条被推翻的解释 */
    const db = (typeof DEBUNKED !== 'undefined') ? DEBUNKED.find(d => d.boss === st.idx) : null;
    if (db && !(S.debunk || []).includes(db.id)) {
      S.debunk = S.debunk || [];
      S.debunk.push(db.id);
      logLine(`🏛️ 错误博物馆：识破「${db.name}」—— ${db.lesson}`, 'lg-skill');
      setTimeout(() => toast(`🏛️ 识破「${db.name}」`), 800);
    }
    const card = CARDS.find(c => c.boss === st.idx);
    if (card && !S.cards.includes(card.id)) {
      S.cards.push(card.id);
      renderCards();
      gotCard = card;
    }
    if (st.kind === 'boss' && st.sch.bossLines && st.sch.bossLines[st.round]) {
      logLine(`「${st.name}」：${st.sch.bossLines[st.round]}`, 'lg-skill');
    }
    /* 击败某学派第 1 轮 Boss → 解锁下一学派，并直接送进去 */
    if (st.kind === 'boss' && st.round === 0) {
      const nx = schoolOrder(S.era)[st.si + 1];   /* 纪元轮转后，"下一个"不是数据里的下一个 */
      if (nx && !S.unlocked.includes(nx.id)) {
        S.unlocked.push(nx.id);
        const start = (st.si + 1) * STAGES_PER_SCHOOL;
        S.maxStage = Math.max(S.maxStage, start);
        nextStageOverride = start;
        logLine(`学派解锁：${nx.name}。地图上多了一条路。`, 'lg-good');
        setTimeout(() => toast(`新学派开启 · ${nx.name}`), 700);
        dirty.map = 1; dirty.shelf = 1;
      }
    }
  }

  logLine(msg, 'lg-good');
  toast(msg.length > 46 ? msg.slice(0, 46) + '…' : msg);

  const total = SCHOOLS.length * STAGES_PER_SCHOOL;
  const next = (typeof nextStageOverride === 'number') ? nextStageOverride : st.idx + 1;

  dirty.shelf = 1; dirty.map = 1;
  checkAchievements();

  /* 🕳️ 周常世界 BOSS「遗忘」：打赢 = 击退一次，得书页 + 记忆强化 */
  if (st.idx === -2) {
    const gain = Math.round(PAGE_DROP.boss * (1 + (S.maxStage || 0) * 0.03)
      * WORLD_BOSS.pageMul * (1 + (N.pageMul || 0)));
    S.page += gain;
    S.world.cleared = true;
    S.memory = (S.memory || 0) + WORLD_BOSS.memoryPerWin;
    pushWorldDamage(st);
    logLine(`🕳️ 遗忘退去了一次。书页 +${gain}，记忆强化 +${WORLD_BOSS.memoryPerWin}`
      + `（当前 +${Math.min(WORLD_BOSS.memoryCap * 1, S.memory)}%）`, 'lg-skill');
    toast(`击退遗忘 · 书页 +${gain} · 记忆 +${WORLD_BOSS.memoryPerWin}`);
    showVictory(st, gain, [`记忆强化 +${WORLD_BOSS.memoryPerWin}`], null, null);
    renderBreakdown();
    renderBattle(true);
    save();
    return;
  }

  /* 🕳️ 深渊：推进到下一层。越深书页越多，每 5 层必掉一件装备。 */
  if (st.idx === -3) {
    const depth = st.depthLevel || (S.abyssDepth || 1);
    S.abyssDepth = depth + 1;
    const gain = Math.round(PAGE_DROP.normal * (1 + depth * ABYSS.pagePerDepth)
      * (1 + (N.pageMul || 0)) * (1 + 0.25 * tal('abyss'))
      * (1 + (typeof researchBonus === 'function' ? researchBonus().abyss : 0)));
    S.page += gain;
    const drops = [`书页 +${fmt(gain)}`];
    if (depth % ABYSS.equipEvery === 0) {
      const e = rollEquipDrop(st, null, true);   /* 每 5 层才轮到一次，这里就必掉 */
      if (e && addEquip(e)) drops.push(`装备 · ${equipFullName(e)}`);
    }
    const nextMul = Math.pow(ABYSS.growth, depth);
    logLine(`🕳️ 深渊第 ${depth} 层通过 —— 下一层强度 ×${nextMul.toFixed(2)}`, 'lg-skill');
    toast(`深渊 ${depth} 层通过 · 下一层 ×${nextMul.toFixed(2)}`);
    showVictory(st, gain, drops, null, null);
    renderBreakdown();
    renderBattle(true);
    renderAbyssbar();
    save();
    return;
  }

  /* 理念之神：给结算，不推进关卡 */
  if (st.idx === -1) {
    const godReward = Math.round(ERA_GOD.rewardBase * Math.pow(ERA_GOD.rewardGrowth, S.godKills || 0));
    S.godKills = (S.godKills || 0) + 1;
    S.paradigm += godReward;
    logLine(`理念之神第 ${S.godKills} 次被打败。它没有消失 —— 下一次会比这次硬 ${ERA_GOD.growth} 倍。`, 'lg-skill');
    toast(`击败理念之神 · 范式 +${godReward}`);
    showVictory(st, pages, dropList, gotCard, null);
    renderBreakdown();
    renderBattle(true);
    save();
    return;
  }

  /* Boss 战：出结算画面，玩家点「继续」才走 */
  if (st.kind === 'boss') {
    showVictory(st, pages, dropList, gotCard, next);
    renderBreakdown();
    renderBattle(true);
    save();
    return;
  }

  if (S.autoAdvance && next < total) {
    setTimeout(() => { if (S.autoAdvance) { S.stage = next; startBattle(next); } }, Math.max(90, 620 / (S.speed || 1)));
  } else {
    S.stage = st.idx;
  }
  renderBreakdown();
  renderBattle(true);
  save();
}

/* ---------------- Boss 结算画面 ---------------- */
let pendingAdvance = null;
let victoryTimer = null;
let pendingVictory = null;

function showVictory(st, pages, dropList, card, next) {
  pendingAdvance = typeof next === 'number' ? next : null;
  pendingVictory = { st, pages, dropList, card };
  const quote = (st.sch.epitaphs && st.sch.epitaphs[(st.round || 0) % 3]) || '';
  pendingVictory.quote = quote;
  const chips = [`<span class="vic-tag">书页 +${pages}</span>`]
    .concat(dropList.map(d => `<span class="vic-tag">${d}</span>`))
    .concat(card ? [`<span class="vic-tag card">知识卡 · ${card.title}</span>`] : [])
    .join('');

  openDialog(`
    <div class="vic">
      <div class="vic-emoji">${st.emoji}</div>
      <div class="vic-name">${st.name}</div>
      <div class="quote vic-quote" id="vic-quote"></div>
      <div class="vic-drops">${chips}</div>
    </div>
    <div class="dialog-acts">
      <button class="btn ghost sm" onclick="shareVictoryBtn()">存为图片</button>
      <button class="btn gold" onclick="victoryContinue()">继续</button>
    </div>
  `);
  typeInto($('#vic-quote'), quote ? `「${quote}」` : '', 55);

  if (victoryTimer) clearTimeout(victoryTimer);
  victoryTimer = setTimeout(() => { victoryTimer = null; victoryContinue(); }, 9000);
}

function shareVictoryBtn() {
  if (!pendingVictory) return;
  const v = pendingVictory;
  shareVictory(v.st, v.quote, v.pages, v.dropList);
}

function victoryContinue() {
  if (victoryTimer) { clearTimeout(victoryTimer); victoryTimer = null; }
  clearType();
  const n = pendingAdvance;
  pendingAdvance = null;
  closeDialog();
  if (typeof n === 'number' && S.autoAdvance && n < SCHOOLS.length * STAGES_PER_SCHOOL) {
    S.stage = n;
    dirty.map = 1;
    startBattle(n);
  }
  renderAll();
}

function loseBattle() {
  if (!B || B.over) return;
  B.over = true;
  /* 🕳️ 输给遗忘的代价：书页 -5%、随机一本等级 -1（硬下限：不会低于 1 级） */
  if (B.st && B.st.idx === -2) {
    const before = S.page || 0;
    S.page = Math.max(0, Math.floor(before * WORLD_BOSS.losePageCut));
    const lostPage = before - S.page;
    const ids = Object.keys(S.books).filter(id => S.books[id] && S.books[id].lv > 1);
    let lostName = '';
    if (ids.length) {
      const id = ids[Math.floor(Math.random() * ids.length)];
      S.books[id].lv -= 1;
      lostName = bookById(id) ? bookById(id).name : '';
    }
    S.world.cleared = false;
    /* 输也算伤害：打在它身上的血不会因为你的失败而回满 */
    pushWorldDamage(B.st);
    logLine(`🕳️ 遗忘侵蚀：书页 -${fmt(lostPage)}${lostName ? ` · 《${lostName}》等级 -1` : ''}`, 'lg-bad');
    toast('遗忘侵蚀了你的记忆');
  }
  B.php = 0;
  S.fails = (S.fails || 0) + 1;
  logLine(`你被 ${B.st.name} 击退了。退回书桌，换一种配置。`, 'lg-bad');
  renderBreakdown();
  showVerdict();
  renderBattle(true);
}

function addBook(id) {
  if (S.books[id]) return;
  S.books[id] = { lv: 1, q: bookById(id).q || 0 };
  dirty.shelf = 1;
  if (bookById(id).type === 'skill') autoDesk(id);
}

function autoDesk(id) {
  const empty = S.desk.indexOf(null);
  if (empty >= 0) { S.desk[empty] = id; dirty.desk = 1; }
}

/* ---------------- 转生 ---------------- */
/* 软上限：SOFT 以内按 sqrt，之后转对数增长，防止范式点指数膨胀 */
function rawPrestige(eraInsight) {
  const raw = Math.sqrt(Math.max(0, eraInsight) / PRESTIGE_DIV);
  let g = raw <= PRESTIGE_SOFT ? raw
    : PRESTIGE_SOFT + Math.log10(1 + (raw - PRESTIGE_SOFT)) * PRESTIGE_SOFT_LOG;
  if (!isFinite(g)) g = PRESTIGE_CAP;
  return Math.min(PRESTIGE_CAP, g);
}
function prestigeGain() {
  const g = Math.floor(rawPrestige(S.eraInsight));
  const ES = equipSum();
  const sigMul = (ES.sigs && ES.sigs.sigThought) ? 1.25 : 1;   /* 💭 思想实验 */
  return Math.floor(g * (1 + (ES.num.paraEq || 0)) * sigMul);   /* 「铭刻」「铸印」 */
}

function doPrestige() {
  const g = prestigeGain();
  if (g < 1) return;
  S.paradigm += g;
  S.prestigeCount++;
  S.era = (S.era || 1) + 1;
  S.insight = 0;
  S.eraInsight = 0;
  S.carry = 0;                 /* 转生换了纪元，上一世没打完的余力不该跟过来 */
  const R = equipSum().rules;
  /* 「不焚」：书页全部保留；「不烬」：书籍等级保留一半 */
  if (!R.keepPage) S.page = Math.floor(S.page * 0.5);
  for (const id in S.books) {
    S.books[id].lv = R.keepBook ? Math.max(1, Math.ceil(S.books[id].lv * 0.5)) : 1;
  }
  /* 装备是实体，永远留在理念世界中 */
  S.stage = 0;
  S.maxStage = 0;
  S.fails = 0;
  /* 新纪元世界重排：所有学派都在，但顺序变了 */
  S.unlocked = SCHOOLS.map(x => x.id);
  B = null;
  closeDialog();
  dirty.map = dirty.desk = dirty.shelf = 1;
  toast(`进入${eraName(S.era)} · 范式 +${g}（敌人 ×${eraScale(S.era).toFixed(1)}）`);
  startBattle(S.stage);
  save();
  renderAll();
}

/* ---------------- 挂机产出 ---------------- */
function accrue() {
  const now = Date.now();
  let dt = (now - lastAccrue) / 1000;
  lastAccrue = now;
  if (dt <= 0) return;
  if (dt > 60) dt = 60;
  const P = stats();
  const gain = P.rate * dt * (S.speed || 1);
  S.insight += gain;
  S.eraInsight += gain;
}

function applyOffline() {
  const now = Date.now();
  const gap = (now - (S.lastSave || now)) / 1000;
  if (gap < 60) return null;
  const N = equipSum().num, R = equipSum().rules;
  const cap = R.offlineCap ? 12 : OFFLINE_CAP_H;      /* 「不寐」：上限 8h → 12h */
  const hours = Math.min(gap / 3600, cap);
  const P = stats();
  const gain = P.rate * hours * 3600 * 0.6 * (1 + (N.offlineEq || 0));
  if (gain < 1) return null;
  S.insight += gain;
  S.eraInsight += gain;
  /* 离线书页：按进度微量产出（普通关掉落 × 离线折扣），不破坏「书页靠战斗」的定位 */
  const pageGain = Math.round(PAGE_DROP.normal * (1 + S.maxStage * 0.03) * hours * 0.3 * (1 + (N.pageMul || 0)));
  S.page += pageGain;
  S.offlineCount = (S.offlineCount || 0) + 1;
  /* 离线事件：每次回来都有一条 */
  const ev = (typeof OFFLINE_EVENTS !== 'undefined' && OFFLINE_EVENTS.length)
    ? OFFLINE_EVENTS[Math.floor(Math.random() * OFFLINE_EVENTS.length)] : null;
  setTimeout(() => toast(`离线 ${hours.toFixed(1)} 小时 · 洞见 +${fmt(gain)}`), 600);
  return { hours, gain, pageGain, ev };
}

/* 离线事件三选一：mul = 按当前进度折算的「几小时产出」 */
function offlinePick(rep, i) {
  if (!rep || !rep.ev || !rep.ev.opts || rep.done) return;
  const o = rep.ev.opts[i];
  if (!o) return;
  const N = equipSum().num;
  let got = 0;
  if (o.kind === 'insight') {
    got = Math.max(1, Math.round(stats().rate * 3600 * o.mul));
    S.insight += got; S.eraInsight += got;
  } else {
    got = Math.max(1, Math.round((PAGE_DROP.boss * (1 + S.maxStage * 0.02)) * o.mul * (1 + (N.pageMul || 0))));
    S.page += got;
  }
  rep.done = true;
  logLine(`🌙 ${rep.ev.icon} ${o.label}：${o.kind === 'insight' ? '洞见' : '书页'} +${fmt(got)}`, 'lg-good');
  toast(`${o.kind === 'insight' ? '洞见' : '书页'} +${fmt(got)}`);
  save(); renderResources();
  showOfflineReport(rep);
}

function showOfflineReport(rep) {
  const evHtml = !rep.ev ? '' : rep.done ? `
    <div class="lore orep-ev"><div class="lore-h">🌙 梦境已醒</div>
      <p>${rep.ev.icon} ${rep.ev.text}</p></div>`
    : `
    <div class="lore orep-ev"><div class="lore-h">🌙 离线事件</div>
      <p>${rep.ev.icon} ${rep.ev.text}</p>
      <div class="orep-opts">${rep.ev.opts.map((o, i) =>
        `<button class="btn sm${i === 1 ? ' gold' : ''}" data-oe="${i}">${o.label}</button>`).join('')}</div></div>`;
  openDialog(`
    <h3>🌙 离线战报</h3>
    <div class="orep">
      <div class="orep-row"><span>离开</span><b>${(rep.hours || 0).toFixed(1)} 小时</b></div>
      <div class="orep-row"><span>书替你读出了</span><b class="lg-good">洞见 +${fmt(rep.gain || 0)}</b></div>
      <div class="orep-row"><span>散落的</span><b class="lg-good">书页 +${fmt(rep.pageGain || 0)}</b></div>
    </div>
    ${evHtml}
    <div class="dialog-acts"><button class="btn ghost" onclick="closeDialog()">回到书房</button></div>
  `);
  if (rep.ev && !rep.done) {
    document.querySelectorAll('[data-oe]').forEach(b => {
      b.onclick = () => offlinePick(rep, parseInt(b.dataset.oe, 10));
    });
  }
}

/* ---------------- 成就 ---------------- */
function achClaimable() {
  return ACHIEVEMENTS.filter(a => S.ach[a.id] === 'got').length;
}

function checkAchievements() {
  /* 课题结题和成就同一时机判定：打完一关、拿到书、升完级都会走到这里 */
  if (typeof checkResearch === 'function') checkResearch();
  if (!S.ach) return;
  let newly = 0;
  ACHIEVEMENTS.forEach(a => {
    if (!S.ach[a.id]) {
      let hit = false;
      try { hit = !!a.check(S); } catch (e) { hit = false; }
      if (hit) { S.ach[a.id] = 'got'; newly++; }
    }
  });
  if (newly) {
    logLine(`🏆 成就达成 ×${newly} —— 去图鉴领取奖励。`, 'lg-skill');
    toast(`🏆 成就达成 ×${newly}`);
    updateCodexDot();
  }
  return newly;
}

function claimAch(id) {
  if (S.ach[id] !== 'got') return;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  const ins = Math.max(1, Math.round(stats().rate * 3600 * (a.hrs || 0)));
  S.page += a.page;
  S.insight += ins; S.eraInsight += ins;
  S.ach[id] = 'claimed';
  toast(`🏆 ${a.name} · 书页 +${fmt(a.page)} 洞见 +${fmt(ins)}`);
  save();
  renderResources();
  updateCodexDot();
  if (codexTab === 'ach') openCodex('ach');
}

/* 图鉴按钮红点：有可领成就时呼吸提示 */
function updateCodexDot() {
  const btn = $('#btn-codex');
  if (!btn) return;
  const n = achClaimable();
  let dot = btn.querySelector('.codex-dot');
  if (n > 0) {
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'codex-dot';
      btn.appendChild(dot);
    }
    dot.textContent = n > 9 ? '9+' : n;
  } else if (dot) dot.remove();
}

/* ---------------- 台词逐字浮现 + 分享卡片 ---------------- */
let typeTimer = null;
function typeInto(el, text, speed) {
  if (!el) return;
  if (typeTimer) clearInterval(typeTimer);
  el.textContent = '';
  let i = 0;
  typeTimer = setInterval(() => {
    if (!el.isConnected) { clearInterval(typeTimer); typeTimer = null; return; }
    el.textContent = text.slice(0, ++i);
    if (i >= text.length) { clearInterval(typeTimer); typeTimer = null; el.classList.add('done'); }
  }, speed || 45);
}

function clearType() { if (typeTimer) { clearInterval(typeTimer); typeTimer = null; } }

/* 一卡一图：把单张知识卡做成 640×840 竖图，最低成本的传播单位 */
function shareCard(cardId) {
  const card = CARDS.find(c => c.id === cardId);
  if (!card) return;
  const L = (typeof CARD_LORE !== 'undefined' && CARD_LORE[cardId]) || null;
  const cv = document.createElement('canvas');
  const c = cv.getContext && cv.getContext('2d');
  if (!c) { toast('当前环境不支持生成图片'); return; }
  const W = 640, H = 840;
  cv.width = W; cv.height = H;
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#211d17'); bg.addColorStop(1, '#14110d');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#8a7c62'; c.lineWidth = 2; c.strokeRect(18, 18, W - 36, H - 36);
  c.strokeStyle = '#5a5040'; c.lineWidth = 1; c.strokeRect(26, 26, W - 52, H - 52);
  const F = '"Noto Serif SC","Songti SC","SimSun",serif';
  const wrap = (text, maxW, font) => {
    c.font = font;
    const lines = []; let line = '';
    for (const ch of text) {
      if (c.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  };
  c.textAlign = 'center';
  c.fillStyle = '#c9b98f'; c.font = `26px ${F}`;
  c.fillText('知识卡', W / 2, 80);
  c.fillStyle = '#6f6350'; c.font = `15px ${F}`;
  c.fillText(L && L.year ? String(L.year) : '理念界', W / 2, 108);
  /* 标题 */
  c.fillStyle = '#e8dcc0'; c.font = `34px ${F}`;
  wrap(card.title, W - 140, `34px ${F}`).slice(0, 2).forEach((ln, i) => c.fillText(ln, W / 2, 190 + i * 44));
  /* 正文 */
  c.fillStyle = '#d8c9a3'; c.font = `21px ${F}`;
  wrap(card.text, W - 140, `21px ${F}`).slice(0, 9).forEach((ln, i) => c.fillText(ln, W / 2, 300 + i * 34));
  /* 本课要点 */
  if (L && L.lesson) {
    c.fillStyle = '#c9a227'; c.font = `20px ${F}`;
    wrap('▸ ' + L.lesson, W - 160, `20px ${F}`).slice(0, 3).forEach((ln, i) => c.fillText(ln, W / 2, 640 + i * 30));
  }
  c.fillStyle = '#6f6350'; c.font = `16px ${F}`;
  c.fillText('《知识即力量》· 学习刻不容缓', W / 2, 770);
  try {
    const a = document.createElement('a');
    a.download = 'sapere-aude-card-' + cardId + '.png';
    a.href = cv.toDataURL('image/png');
    a.click();
    toast('知识卡图片已生成');
  } catch (e) { toast('生成失败：' + e.message); }
}

/* canvas 竖版分享卡：知识卡 + 台词 + 纪元战报 */
function shareVictory(st, quote, pages, drops) {
  const cv = document.createElement('canvas');
  const c = cv.getContext && cv.getContext('2d');
  if (!c) { toast('当前环境不支持生成图片'); return; }
  const W = 640, H = 840;
  cv.width = W; cv.height = H;
  /* 背景与边框 */
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#211d17'); bg.addColorStop(1, '#14110d');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.strokeStyle = '#8a7c62'; c.lineWidth = 2;
  c.strokeRect(18, 18, W - 36, H - 36);
  c.strokeStyle = '#5a5040'; c.lineWidth = 1;
  c.strokeRect(26, 26, W - 52, H - 52);
  const F = '"Noto Serif SC","Songti SC","SimSun",serif';
  /* 顶部标题 */
  c.textAlign = 'center'; c.fillStyle = '#c9b98f';
  c.font = `26px ${F}`;
  c.fillText('知识即力量 · Sapere Aude', W / 2, 84);
  c.fillStyle = '#6f6350'; c.font = `15px ${F}`;
  c.fillText(`第 ${S.era || 1} 纪元 · ${st.sch ? st.sch.name : ''}`, W / 2, 114);
  /* Boss */
  c.font = '110px serif';
  c.fillText(st.emoji || '📜', W / 2, 260);
  c.fillStyle = '#e8dcc0'; c.font = `34px ${F}`;
  c.fillText(st.name, W / 2, 330);
  /* 台词（自动换行） */
  if (quote) {
    c.fillStyle = '#d8c9a3'; c.font = `22px ${F}`;
    let line = '', lines = [];
    for (const ch of quote) {
      if (c.measureText(line + ch).width > W - 140) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    lines.slice(0, 6).forEach((ln, i) => c.fillText(ln, W / 2, 400 + i * 34));
  }
  /* 战报 */
  c.fillStyle = '#9a8c6e'; c.font = `19px ${F}`;
  const dropsTxt = drops && drops.length ? drops.join(' · ') : '';
  c.fillText(`书页 +${pages}${dropsTxt ? ' · ' + dropsTxt : ''}`, W / 2, 620);
  /* 底部 */
  c.fillStyle = '#6f6350'; c.font = `17px ${F}`;
  c.fillText('—— 「我从未发明微积分，我只是把它说出来。」', W / 2, 720);
  c.fillText('《知识即力量》· 学习刻不容缓', W / 2, 760);
  try {
    const a = document.createElement('a');
    a.download = 'sapere-aude-victory.png';
    a.href = cv.toDataURL('image/png');
    a.click();
    toast('战报图片已生成');
  } catch (e) { toast('生成失败：' + e.message); }
}


/* ---------------- 工具 ---------------- */
/* 中文大数单位：万进（每级 ×1e4）。放到极（1e48）之后仍可继续，只是不再有专名 */
const CN_UNITS = ['', '万', '亿', '兆', '京', '垓', '秭', '穰', '沟', '涧', '正', '载', '极'];

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '0';
  if (!isFinite(n)) return '无穷';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1e4) return n < 10 ? n.toFixed(n % 1 ? 1 : 0) : Math.floor(n).toString();
  let i = 0;
  while (n >= 1e4 && i < CN_UNITS.length - 1) { n /= 1e4; i++; }
  if (i >= CN_UNITS.length - 1 && n >= 1e4) {
    /* 超出「极」：退回科学计数，避免单位表被撑爆 */
    const e = Math.floor(Math.log10(n));
    return (n / Math.pow(10, e)).toFixed(2) + 'e' + (e + i * 4);
  }
  return n.toFixed(n < 10 ? 2 : (n < 100 ? 1 : 0)) + CN_UNITS[i];
}

/* 倍率专用：×1.05 / ×12.3万 / ×3.2兆 —— 不加单位歧义 */
function fmtMul(n) {
  if (n == null || Number.isNaN(n)) return '×1';
  if (!isFinite(n)) return '×无穷';
  if (n < 1e4) return '×' + n.toFixed(n < 10 ? 2 : (n < 100 ? 1 : 0));
  return '×' + fmt(n);
}
function fmtDmg(n) { return fmt(Math.max(1, n)); }

function toast(text) {
  const w = $('#toast-wrap');
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = text;
  w.appendChild(d);
  const life = Math.max(700, 2100 / (S.speed || 1));
  setTimeout(() => { d.style.opacity = '0'; d.style.transition = '.3s'; setTimeout(() => d.remove(), 320); }, life);
  while (w.children.length > 3) w.firstChild.remove();
}

/* ---------------- 渲染 ---------------- */
function renderAll() {
  dirty.map = dirty.desk = dirty.shelf = 1;
  renderResources();
  renderMap();
  renderDesk();
  renderShelf();
  renderCards();
  renderBattle(true);
}

function renderResources() {
  const P = stats();
  $('#r-insight').textContent = fmt(S.insight);
  $('#r-insight-rate').textContent = '+' + fmt(P.rate) + '/s';
  $('#r-page').textContent = fmt(S.page);
  $('#r-para').textContent = fmt(S.paradigm);
  $('#r-para-bonus').textContent = fmtMul(P.paraMul);

  const eraEl = $('#era-label');
  if (eraEl) eraEl.textContent = eraName(S.era || 1);
  const talBtn = $('#btn-talent');
  if (talBtn) {
    const free = paraFree();
    const label = free > 0 ? `天赋 · ${free}` : '天赋';
    if (talBtn.textContent !== label) talBtn.textContent = label;
    talBtn.classList.toggle('attn', free > 0);
  }

  const g = prestigeGain();
  const btn = $('#btn-prestige');
  if (btn) {
    const label = g > 0 ? `范式转移 · ${g}` : '范式转移';
    if (btn.textContent !== label) btn.textContent = label;
    btn.classList.toggle('attn', g >= 2);
  }
  maybeOfferPrestige(g);
}

/* 时间倍率 */
function setSpeed(v, silent) {
  S.speed = v;
  document.querySelectorAll('#speed .sp').forEach(b => {
    b.classList.toggle('on', parseFloat(b.dataset.sp) === v);
  });
  if (!silent) toast(`时间倍率 ×${v}`);
  save();
}

/* 首次攒够范式时主动引导一次（加速测试中不打扰） */
function maybeOfferPrestige(g) {
  if (S.tipPrestige || g < 2) return;
  if ((S.speed || 1) > 1) return;
  const stuck = S.stage >= 16 || (S.fails || 0) >= 2;
  if (!stuck) return;
  const mask = $('#mask');
  if (!mask || mask.classList.contains('show')) return;
  S.tipPrestige = true;
  save();
  const round = Math.floor(S.stage / 8) + 1;
  openDialog(`
    <h3>该换一种解释了</h3>
    <div class="quote">"当你对世界的解释方式发生根本改变，旧的知识并没有消失，只是被重新排列了。"</div>
    <p>你攒下了 <b style="color:#e8c765">${g} 点范式</b>。第 ${round} 轮这道墙，靠把书读得更厚是翻不过去的——你需要换一个范式。</p>
    <p style="margin:0 0 6px">发动范式转移会：</p>
    <p style="margin:0">
      · <b style="color:#e0907e">清零</b>：洞见、所有书籍等级、当前关卡进度<br>
      · <b style="color:#8fd0a8">保留</b>：所有书、书籍品质、一半书页、知识卡<br>
      · <b style="color:#e8c765">获得</b>：${g} 点范式，每点永久让产出与攻击 ×${(1 + PARA_BONUS).toFixed(2)}（复利）<br>
      · <b style="color:#8fd0a8">保留</b>：身上与背包里的全部装备——它们是实体，不随范式消散
    </p>
    <div class="dialog-acts">
      <button class="btn ghost" onclick="closeDialog()">再想想</button>
      <button class="btn gold" onclick="closeDialog(); openPrestige()">看结算</button>
    </div>
  `);
}

/* null = 跟随当前关卡；玩家点了轮次按钮后临时浏览 */
let mapRoundView = null;

function renderMap() {
  if (!dirty.map) return;
  dirty.map = 0;
  const { si, sch } = schoolOf(S.stage);
  const curRound = Math.floor((S.stage - si * STAGES_PER_SCHOOL) / 8);
  const round = (mapRoundView == null) ? curRound : mapRoundView;
  $('#school-name').textContent = sch.name;

  /* 轮次按钮：当前轮高亮，超出已解锁范围的置灰 */
  document.querySelectorAll('#round-tabs button').forEach(btn => {
    const r = parseInt(btn.dataset.r, 10);
    btn.classList.toggle('on', r === round);
    const reachable = si * STAGES_PER_SCHOOL + r * 8 <= (S.maxStage || 0);
    btn.classList.toggle('lock', !reachable);
    btn.classList.toggle('cur-round', r === curRound);
    btn.onclick = () => {
      if (!reachable) { toast('这一轮还没解锁'); return; }
      mapRoundView = r;
      dirty.map = 1;
      renderMap();
    };
  });

  const wrap = $('#map');
  wrap.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const g = si * STAGES_PER_SCHOOL + round * 8 + i;
    const st = stageData(g);
    const done = S.maxStage > g;
    const cur = g === S.stage;
    const lock = g > S.maxStage;
    const d = document.createElement('div');
    d.className = 'node ' + st.kind + (done ? ' done' : '') + (cur ? ' cur' : '') + (lock ? ' lock' : '');
    d.innerHTML = `<div class="ne">${st.emoji}</div><div class="nl">${st.name.replace(' · ', '·')}</div>`;
    d.onclick = () => {
      if (lock) { toast('先打赢前面的关卡'); return; }
      S.stage = g;
      mapRoundView = null;
      dirty.map = 1;
      startBattle(g);
      save();
    };
    wrap.appendChild(d);
  }

  const totalCleared = Math.min(S.maxStage, SCHOOLS.length * STAGES_PER_SCHOOL);
  $('#map-progress').textContent = `进度 ${totalCleared} / ${SCHOOLS.length * STAGES_PER_SCHOOL}`;
  renderSchools();
  renderGodbar();
  renderWorldbar();
  renderAbyssbar();
}

function renderSchools() {
  const wrap = $('#schools');
  if (!wrap) return;
  wrap.innerHTML = '';
  const curSi = schoolOf(S.stage).si;
  /* 学派顺序会随纪元轮转，所以必须按 schoolOrder 渲染 —— 否则高亮的是数据序、
     地图却是轮转序，玩家会看到「点了音乐，地图是博物」 */
  schoolOrder(S.era).forEach((sch, si) => {
    const unlocked = S.unlocked.includes(sch.id);
    const lo = si * STAGES_PER_SCHOOL;
    const cleared = Math.max(0, Math.min(STAGES_PER_SCHOOL, (S.maxStage || 0) - lo));
    const pct = Math.round(cleared / STAGES_PER_SCHOOL * 100);
    const b = document.createElement('button');
    b.className = 'sch'
      + (si === curSi ? ' on' : '')
      + (unlocked ? '' : ' lock')
      + (cleared >= STAGES_PER_SCHOOL ? ' done' : '')
      + (cleared > 0 && cleared < STAGES_PER_SCHOOL ? ' prog' : '');
    if (cleared > 0 && cleared < STAGES_PER_SCHOOL) b.style.setProperty('--p', pct + '%');
    b.textContent = unlocked ? sch.short : '？';
    b.title = unlocked
      ? `${sch.name} · ${cleared}/${STAGES_PER_SCHOOL} 关`
      : '击败上一个学派第 1 轮 Boss 解锁';
    b.onclick = () => {
      if (!unlocked) { toast('先击败上一个学派第 1 轮的 Boss'); return; }
      const lo = si * STAGES_PER_SCHOOL, hi = lo + STAGES_PER_SCHOOL - 1;
      const target = Math.max(lo, Math.min(S.maxStage, hi));
      S.stage = target;
      mapRoundView = null;
      dirty.map = 1;
      startBattle(target);
      save();
    };
    wrap.appendChild(b);
  });
  /* 学派多了以后，当前学派可能滚出视野 —— 自动居中 */
  const on = wrap.querySelector('.sch.on');
  if (on && on.scrollIntoView) {
    try { on.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {}
  }
}

function renderDesk() {
  if (!dirty.desk) return;
  dirty.desk = 0;
  while (S.desk.length < deskSlots()) S.desk.push(null);
  const wrap = $('#desk');
  wrap.innerHTML = '';
  S.desk.slice(0, deskSlots()).forEach((id, i) => {
    const d = document.createElement('div');
    const b = id ? bookById(id) : null;
    const st = id ? S.books[id] : null;
    if (b && st) {
      const q = qOf(st.q);
      const en = B ? B.st : null;
      const aff = en ? affinityOfBook(b, en) : null;
      const mark = aff && aff.total > 1.02 ? 'adv' : (aff && aff.total < 0.98 ? 'dis' : '');
      d.className = 'slot filled' + (mark ? ' ' + mark : '');
      d.dataset.id = b.id;
      const _doc = doctrineOf(b), _docC = doctrineColor(_doc);
      d.innerHTML = `<div class="q-bar" style="background:${q.color}"></div>
        <div class="doc-bar" style="background:${_docC}" title="方法论 ${_doc}"></div>
        <div class="se">${b.emoji}</div><div class="sn">${b.name}</div>
        <div class="sc">Lv${st.lv}${aff ? ` · ×${aff.total.toFixed(2)}` : ''}</div>
        ${mark ? `<span class="aff-mark">${mark === 'adv' ? '▲' : '▼'}</span>` : ''}`;
      d.title = `${b.name} · ${q.name} Lv${st.lv}｜CD ${b.cd}s\n${bookDomain(b)} · 方法论「${_doc}」\n本关相性 ×${aff ? aff.total.toFixed(2) : '1.00'}（学科 ×${aff ? aff.tag.toFixed(2) : '1'} · 范式 ×${aff ? aff.doc.toFixed(2) : '1'}）\n${b.desc}\n点击卸下`;
      d.onclick = () => { S.desk[i] = null; dirty.desk = 1; dirty.shelf = 1; save(); renderDesk(); renderShelf(); };
    } else {
      d.className = 'slot';
      d.innerHTML = `<div class="empty">＋</div><div class="sn">空</div>`;
      d.onclick = () => pickBookForSlot(i);
    }
    wrap.appendChild(d);
  });
  const used = S.desk.filter(Boolean).length;
  $('#desk-note').textContent = `${used} / ${deskSlots()} 槽位`;
  noteCombos();          /* 第一次凑齐就记进「已发现」 */
  syncAutoSwitches();
  renderDeskTip();
}

/* 自动化开关：未解锁时置灰并提示去天赋里学 */
function syncAutoSwitches() {
  const up = $('#auto-up-sw');
  const dk = $('#auto-desk-sw');
  if (!up || !dk) return;
  const hasU = hasTalent('autoUp');
  const hasD = hasTalent('autoDesk');
  up.disabled = !hasU;
  dk.disabled = !hasD;
  up.checked = hasU && !!(S.auto && S.auto.up);
  dk.checked = hasD && !!(S.auto && S.auto.desk);
  up.parentElement.classList.toggle('on', hasU);
  dk.parentElement.classList.toggle('on', hasD);
  up.title = hasU ? '已在天赋中解锁' : '在天赋里学会「自动升级」后可用';
  dk.title = hasD ? '已在天赋中解锁' : '在天赋里学会「自动换书」后可用';
}

/* 自动化开关：未解锁时置灰并提示去天赋里学 */
/* 书桌底部：本关需要什么书、架上有哪些克制书没上桌 */
function renderDeskTip() {
  const el = $('#desk-tip');
  if (!el) return;
  if (!B) { el.className = 'hint'; el.textContent = '槽位里的书会自动施放技能。'; return; }
  const st = B.st;
  const bench = benchSkills().filter(d => affinityOfBook(d.book, st).total > 1.02);
  const onDesk = deskList().filter(d => affinityOfBook(d.book, st).total > 1.02).length;
  let tail;
  if (bench.length) {
    el.className = 'hint warn';
    tail = `架上有 ${bench.slice(0, 2).map(d => `《${d.book.name}》`).join('')} 克制却没上桌`;
  } else if (onDesk) {
    el.className = 'hint good';
    tail = `已带 ${onDesk} 本克制书，摆法没问题`;
  } else {
    el.className = 'hint warn';
    tail = '你还没有能克制它的书，去前面的关卡刷';
  }
  const line = `弱「${(st.weakAll || [st.weak]).map(t => TAGS[t]).filter(Boolean).join('·')}」抗「${TAGS[st.resist]}」范式「${st.doc}」 · ${tail}`;
  el.innerHTML = `<div class="tip-line">${line}</div>${comboStrip()}`;
  bindComboStrip(el);
}

/* 书桌底部的组合条：激活的排前面，否则提示「还差一本」 */
function comboStrip() {
  const act = activeCombos();
  if (act.length) {
    return `<div class="combo-row">${act.map(c =>
      `<span class="combo-chip" data-combo="${c.id}"><span class="ci-ic">${c.icon}</span>${c.name}</span>`).join('')}</div>`;
  }
  /* 不点名。只说「还有东西没试过」，让玩家自己去凑。 */
  const half = halfCombos();
  if (half.length) {
    return `<div class="combo-hint">✦ 桌上的书里，有 ${half.length > 1 ? '几本' : '一本'}在等着和别的东西对上</div>`;
  }
  return '';
}

function nearCombos() {
  const owned = Object.keys(S.books);
  return COMBOS.map(c => {
    const missing = c.need.filter(id => owned.indexOf(id) < 0);
    return { combo: c, missing };
  }).filter(x => x.missing.length === 1);
}

function bindComboStrip(root) {
  if (!root) return;
  root.querySelectorAll('[data-combo]').forEach(x => {
    x.onclick = () => showCombo(COMBOS.find(c => c.id === x.dataset.combo));
  });
}

/* ================= 阵容建议 ================= */
/* 单本书的「每点攻击能换多少输出」—— 用它比较不同 CD、不同倍率的书 */
function bookPower(id, st) {
  const b = bookById(id);
  const s2 = S.books[id];
  if (!b || !s2) return 0;
  const q = qOf(s2.q);
  const lvF = 1 + LV_SKILL_BONUS * (s2.lv - 1);
  const base = b.mult > 0 ? (b.mult * lvF * q.skill) / b.cd : 0.55;
  return base * affinityOfBook(b, st).total;
}

/* 组合的「等价输出」：把它的效果折算成每秒多少点攻击。
   数值是估的，只用来在几个候选阵容之间排序，不参与真实伤害结算。 */
const COMBO_VALUE = { railgun:0.40, dualism:0.42, induction:0.20, perpetual:0.45, redqueen:0.10, bubble:0.15, formalize:0.12 };

function suggestLineup() {
  const st = B ? B.st : stageData(S.stage);
  const n = deskSlots();
  const pool = Object.keys(S.books).filter(id => {
    const b = bookById(id);
    return b && b.type === 'skill';
  });
  if (!pool.length) return { picks: [], power: 0, combo: null, st };

  const power = {};
  pool.forEach(id => { power[id] = bookPower(id, st); });
  const byScore = pool.slice().sort((a, b) => power[b] - power[a]);

  /* 基线：纯按单书分数取前 n 本 */
  let best = { picks: byScore.slice(0, n), power: byScore.slice(0, n).reduce((a, id) => a + power[id], 0), combo: null };

  /* 再试：强行塞入每个可凑成的组合，看总分会不会更高 */
  COMBOS.forEach(c => {
    if (!c.need.every(id => pool.indexOf(id) >= 0)) return;
    const rest = byScore.filter(id => c.need.indexOf(id) < 0);
    const picks = c.need.concat(rest).slice(0, n);
    let sum = picks.reduce((a, id) => a + power[id], 0);
    /* perpetual 是乘性收益，按阵容总量折算 */
    const bonus = c.id === 'perpetual' ? sum * COMBO_VALUE[c.id] : COMBO_VALUE[c.id] || 0;
    sum += bonus;
    if (sum > best.power) best = { picks, power: sum, combo: c };
  });

  const cur = (S.desk || []).filter(Boolean);
  const curPower = cur.reduce((a, id) => a + (power[id] || 0), 0);
  return { picks: best.picks, power: best.power, combo: best.combo, st, cur, curPower, n };
}

function openLineup() {
  const r = suggestLineup();
  const st = r.st;
  if (!r.picks.length) {
    openDialog(`<h3>阵容建议</h3><p>你还没有任何技能书，先去推关。</p>
      <div class="dialog-acts"><button class="btn ghost" onclick="closeDialog()">好</button></div>`);
    return;
  }
  const weakTxt = (st.weakAll || [st.weak]).map(t => TAGS[t]).filter(Boolean).join('·');
  const curSet = new Set(r.cur);
  const rows = r.picks.map((id, i) => {
    const b = bookById(id);
    return `<div class="lu-row${curSet.has(id) ? '' : ' added'}">
      <span class="lu-i">${i + 1}</span>
      <span class="lu-e">${b.emoji}</span>
      <span class="lu-n">${b.name}</span>
      <span class="lu-v">${bookPower(id, st).toFixed(2)}</span>
    </div>`;
  }).join('');
  const dropped = r.cur.filter(id => r.picks.indexOf(id) < 0 && bookById(id));
  const dropRows = dropped.length
    ? `<div class="lu-sum"><span>建议撤下</span></div>` + dropped.map(id => {
        const b = bookById(id);
        return `<div class="lu-row dropped"><span class="lu-i">—</span><span class="lu-e">${b.emoji}</span>
          <span class="lu-n">${b.name}</span><span class="lu-v">${(bookPower(id, st) || 0).toFixed(2)}</span></div>`;
      }).join('')
    : '';
  const gain = r.curPower > 0 ? (r.power / r.curPower - 1) * 100 : 100;

  openDialog(`
    <h3>阵容建议 · ${st.name}</h3>
    <div class="bk-meta">
      <span>弱 ${weakTxt}</span><span>抗 ${TAGS[st.resist] || '—'}</span>
      <span>范式 ${st.doc}</span>${st.quirk ? `<span>${st.quirk.icon} ${st.quirk.name}</span>` : ''}
    </div>
    <p style="font-size:11.5px;color:#6f6557;margin:0 0 8px;line-height:1.7">
      按「每点攻击换来的输出」排序。分数已经算进学科相性与方法论克制，但没算技能的特殊效果（护盾、沉默、持续伤害）。
    </p>
    ${rows}
    ${dropRows}
    ${r.combo ? (() => {
      const known = (S.comboSeen || []).indexOf(r.combo.id) >= 0;
      return `<div class="combo-card cc-on" style="margin-top:9px">
        <div class="cc-h">${known ? r.combo.icon + ' ' + r.combo.name : '？ 未发现的组合'}</div>
        <div class="cc-eff">${known
          ? '这套阵容会激活它：' + r.combo.effect
          : '这套摆法会触发某种效果 —— 放上去自己看。'}</div>
      </div>`;
    })() : ''}
    <div class="lu-sum"><span>当前 ${r.curPower.toFixed(2)} → 建议 ${r.power.toFixed(2)}</span>
      <b>${gain >= 0 ? '+' : ''}${gain.toFixed(0)}%</b></div>
    <div class="dialog-acts">
      <button class="btn ghost" onclick="closeDialog()">取消</button>
      <button class="btn gold" id="lu-apply">按这个摆</button>
    </div>
  `);
  const applyBtn = $('#lu-apply');
  if (applyBtn) applyBtn.onclick = () => {
    const next = new Array(deskSlots()).fill(null);
    r.picks.forEach((id, i) => { if (i < next.length) next[i] = id; });
    S.desk = next;
    dirty.desk = 1; dirty.shelf = 1; save();
    closeDialog();
    renderDesk(); renderShelf();
    if (r.combo) toast(`已换上 · 激活「${r.combo.name}」`);
    else toast(`已换上 · 预期输出 ${gain >= 0 ? '+' : ''}${gain.toFixed(0)}%`);
  };
}

function showCombo(c) {
  if (!c) return;
  const on = c.need.every(id => (S.desk || []).indexOf(id) >= 0);
  openDialog(`
    <h3>${c.icon} ${c.name}</h3>
    <div class="combo-card cc-on">
      <div class="cc-tag">${c.tagline}</div>
      <div class="cc-how">${c.how}</div>
      <div class="cc-eff">效果：${c.effect}</div>
      <div class="cc-need">需要同时放在书桌上：${c.need.map(id => {
        const b = bookById(id);
        const has = !!(b && S.books[id]);
        return `<span style="color:${has ? '#8fd0a8' : '#e0907e'}">《${b ? b.name : id}》${has ? '' : '（未获得）'}</span>`;
      }).join(' + ')}</div>
    </div>
    <p style="margin:0;font-size:11.5px;color:${on ? '#8fd0a8' : '#6f6557'}">${on ? '✓ 这个组合当前已生效。' : '还没凑齐，或者书没有放上桌。'}</p>
    <div class="dialog-acts"><button class="btn ghost" onclick="closeDialog()">知道了</button></div>
  `);
}

function renderShelf() {
  if (!dirty.shelf) return;
  dirty.shelf = 0;
  elCache = {};
  const wrap = $('#shelf');
  wrap.innerHTML = '';
  const owned = Object.keys(S.books).filter(id => bookById(id) && bookById(id).type === shelfTab);
  /* 顺序固定为 BOOKS 里的定义顺序，不随等级/品质变化 */
  const orderOf = id => { const i = BOOKS.findIndex(b => b.id === id); return i < 0 ? 999 : i; };
  owned.sort((a, b) => orderOf(a) - orderOf(b));

  const total = BOOKS.filter(b => b.type === shelfTab).length;
  $('#shelf-note').textContent = `${owned.length} / ${total}`;

  if (!owned.length) {
    wrap.innerHTML = `<div style="font-size:11.5px;color:#6f6557;padding:10px 2px">还没有${shelfTab === 'skill' ? '技能' : '属性'}书。去推关。</div>`;
    return;
  }

  owned.forEach(id => {
    const b = bookById(id), st = S.books[id], q = qOf(st.q);
    const onDesk = S.desk.includes(id);
    const card = document.createElement('div');
    card.className = 'book' + (onDesk ? ' on-desk' : '');
    card.dataset.book = id;
    const lvF = b.type === 'attr'
      ? Object.keys(b.attr).map(k => `${ATTR_NAME[k]}+${(b.attr[k] * (1 + 0.1 * (st.lv - 1)) * q.rate).toFixed(0)}`).join(' ')
      : `伤害 ×${(b.mult * (1 + LV_SKILL_BONUS * (st.lv - 1)) * q.skill).toFixed(1)}`;

    card.innerHTML = `
      <div class="be">${b.emoji}</div>
      <div class="bm">
        <div class="bn">${b.name}<em style="color:${q.color};border-color:${q.color}44">${q.name}</em><em class="dtag" style="color:${doctrineColor(doctrineOf(b))};border-color:${doctrineColor(doctrineOf(b))}55" title="方法论：${doctrineOf(b)}">${doctrineOf(b)}</em></div>
        <div class="bd"><span class="dom">${bookDomain(b)}</span> · ${lvF}${b.type === 'skill' ? ` · CD ${b.cd}s` : ''} · ${(b.rate * q.rate * (1 + LV_RATE_BONUS * (st.lv - 1))).toFixed(2)}/s</div>
        <div class="bf">
          <span class="lv">Lv ${st.lv}/${q.cap}</span>
          <button class="mini" data-up="${id}">升级 ${fmt(upgradeCost(st.lv))}</button>
          ${st.q < QUALITIES.length - 1 ? `<button class="mini gold" data-q="${id}">升阶 ${fmt(QUALITIES[st.q + 1].pageCost)}页</button>` : '<span class="lv" style="color:#d0453a">已至原典</span>'}
          ${b.type === 'skill' ? `<button class="mini" data-desk="${id}">${onDesk ? '在桌上' : '上桌'}</button>` : ''}
        </div>
      </div>`;

    const upBtn = card.querySelector('[data-up]');
    if (upBtn && (st.lv >= q.cap || S.insight < upgradeCost(st.lv))) upBtn.disabled = true;
    elCache['up_' + id] = upBtn;

    if (upBtn) {
      upBtn.onmousedown = (e) => { e.preventDefault(); startHold(() => upgradeBook(id)); };
      upBtn.onmouseup = stopHold;
      upBtn.onmouseleave = stopHold;
      upBtn.ontouchstart = (e) => { e.preventDefault(); startHold(() => upgradeBook(id)); };
      upBtn.ontouchend = stopHold;
    }

    const qBtn = card.querySelector('[data-q]');
    if (qBtn) qBtn.onclick = () => { if (!refineBook(id)) toast('书页不足'); };

    const dBtn = card.querySelector('[data-desk]');
    if (dBtn) dBtn.onclick = () => {
      if (onDesk) { S.desk[S.desk.indexOf(id)] = null; }
      else {
        const empty = S.desk.indexOf(null);
        if (empty < 0) { toast('书桌满了，先卸下一本'); return; }
        S.desk[empty] = id;
      }
      dirty.desk = 1; dirty.shelf = 1; save(); renderShelf(); renderDesk();
    };

    card.title = `${b.desc}\n\n${b.quote}\n\n来源：${b.source}`;
    /* 点封面看书目详情：史实 / 今天在哪里 */
    const be = card.querySelector('.be');
    if (be) { be.style.cursor = 'pointer'; be.title = '查看书目详情'; be.onclick = () => openBookDetail(id); }
    wrap.appendChild(card);
  });
}

/* ---------------- 长按连点 ---------------- */
let holdTimer = null;
let holdDirty = false;

function startHold(fn) {
  stopHold();
  if (fn()) holdDirty = true;
  holdTimer = setInterval(() => { if (!fn()) stopHold(); else holdDirty = true; }, 100);
}

function stopHold() {
  if (holdTimer) { clearInterval(holdTimer); holdTimer = null; }
  if (holdDirty) { holdDirty = false; save(); }
}

function upgradeBook(id) {
  const st = S.books[id];
  if (!st) return false;
  const q = qOf(st.q);
  const c = upgradeCost(st.lv);
  if (st.lv >= q.cap || S.insight < c) return false;
  S.insight -= c; st.lv++;
  refreshBookCard(id);
  dirty.desk = 1;
  renderDesk();
  renderResources();
  return true;
}

function refineBook(id) {
  const st = S.books[id];
  if (!st || st.q >= QUALITIES.length - 1) return false;
  const c = Math.round(QUALITIES[st.q + 1].pageCost * (1 + (eqN().costMul || 0)) * pageDiscount());
  if (S.page < c) return false;
  S.page -= c; st.q++;
  toast(`${bookById(id).name} 升阶为 ${QUALITIES[st.q].name}`);
  dirty.shelf = 1; dirty.desk = 1;
  renderShelf(); renderDesk(); renderResources(); save();
  return true;
}

/* 只更新单张书卡，不重建整个书架（长按时才不会卡） */
function refreshBookCard(id) {
  const card = document.querySelector(`.book[data-book="${id}"]`);
  if (!card) { dirty.shelf = 1; renderShelf(); return; }
  const st = S.books[id];
  const b = bookById(id);
  if (!st || !b) return;
  const q = qOf(st.q);
  const lvEl = card.querySelector('.lv');
  if (lvEl) lvEl.textContent = `Lv ${st.lv}/${q.cap}`;
  const upBtn = card.querySelector('[data-up]');
  if (upBtn) {
    upBtn.textContent = `升级 ${fmt(upgradeCost(st.lv))}`;
    upBtn.disabled = st.lv >= q.cap || S.insight < upgradeCost(st.lv);
  }
  const bd = card.querySelector('.bd');
  if (bd) {
    const lvF = b.type === 'attr'
      ? Object.keys(b.attr).map(k => `${ATTR_NAME[k]}+${(b.attr[k] * (1 + LV_ATTR_BONUS * (st.lv - 1)) * q.rate).toFixed(0)}`).join(' ')
      : `伤害 ×${(b.mult * (1 + LV_SKILL_BONUS * (st.lv - 1)) * q.skill).toFixed(1)}`;
    bd.textContent = `${lvF}${b.type === 'skill' ? ` · CD ${b.cd}s` : ''} · ${(b.rate * q.rate * (1 + LV_RATE_BONUS * (st.lv - 1))).toFixed(2)}/s`;
  }
}

function refreshAffordability() {
  for (const k in elCache) {
    const el = elCache[k];
    if (!el || !el.isConnected) continue;
    const id = k.replace('up_', '');
    const st = S.books[id];
    if (!st) { el.disabled = true; continue; }
    const q = qOf(st.q);
    el.disabled = st.lv >= q.cap || S.insight < upgradeCost(st.lv);
  }
}

function renderCards() {
  const wrap = $('#cards');
  if (!wrap) return;
  wrap.innerHTML = '';
  CARDS.forEach(c => {
    const has = S.cards.includes(c.id);
    const d = document.createElement('div');
    d.className = 'ci' + (has ? '' : ' lock');
    d.innerHTML = `<span class="dot"></span><span class="cn">${has ? c.title : '？？？'}</span>
      <span class="cd2">${has ? '已收录' : stageData(c.boss).sch.short + ' · 第 ' + (stageData(c.boss).round + 1) + ' 轮'}</span>`;
    if (has) { d.style.cursor = 'pointer'; d.onclick = () => showCard(c); }
    wrap.appendChild(d);
  });
  $('#card-note').textContent = `${S.cards.length} / ${CARDS.length}`;
}

function renderLog() {
  const el = $('#log');
  if (!el || !B) return;
  el.innerHTML = B.log.slice(-6).map(l => `<div class="${l.cls}">${l.text}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

/* 己方单位条：场上第一次出现「你的东西」——这是地基层最直观的反馈 */
let unitSigCache = '';
function renderUnits() {
  const el = $('#units');
  if (!el) return;
  const alive = unitAlive();
  if (!alive.length) {
    if (unitSigCache !== '') { unitSigCache = ''; el.innerHTML = ''; el.hidden = true; }
    return;
  }
  const sig = alive.map(u => `${u.uid}:${Math.round(Math.max(0, u.hp) / Math.max(1, u.maxHp) * 100)}`).join('|')
    + '#' + Math.round(unitReflectRate() * 100);
  if (sig === unitSigCache) return;
  unitSigCache = sig;
  const refl = unitReflectRate();
  el.hidden = false;
  el.innerHTML = alive.map(u => {
    const T = UNIT_TYPES[u.kind] || UNIT_TYPES.strike;
    const pct = Math.max(0, u.hp / Math.max(1, u.maxHp) * 100);
    return `<div class="unit kind-${u.kind}" title="${u.name} · ${T.name}单位">
      <span class="u-ic">${u.icon}</span>
      <div class="u-bar"><i style="width:${pct.toFixed(0)}%"></i></div>
      <span class="u-hp">${fmt(Math.max(0, u.hp))}</span>
    </div>`;
  }).join('') + (refl > 0 ? `<span class="u-ref" title="非攻：机关在场时，敌人打你也会被反弹">非攻 ${Math.round(refl * 100)}%</span>` : '');
}

function renderBattle(force) {
  if (!B) return;
  /* 士气条：战斗结束时收起；新战斗第一次渲染时显示 */
  const mEl = $('#morale');
  if (mEl) {
    if (B.over) { if (!mEl.hidden) mEl.hidden = true; }
    else if (mEl.hidden) { mEl.hidden = false; renderMorale(); }
  }
  renderUnits();
  const st = B.st;
  $('#stage-idx').textContent = `第 ${st.round + 1} 轮 · ${st.i + 1} / 8`;
  $('#stage-name').textContent = st.name + (st.kind === 'boss' ? ' · 开山鼻祖' : st.kind === 'elite' ? ' · 代表人物' : '');
  $('#enemy-emoji').textContent = st.emoji;
  $('#enemy-title').textContent = st.name;

  const ehp = Math.max(0, B.hp);
  const ePct = Math.max(0, ehp / B.maxHp * 100);
  $('#enemy-hp').style.width = ePct + '%';
  $('#enemy-lag').style.width = ePct + '%';
  $('#enemy-hp-txt').textContent = `${fmt(ehp)} / ${fmt(B.maxHp)}`;

  const shp = Math.max(0, B.php);
  const sPct = Math.max(0, shp / B.maxPhp * 100);
  $('#self-hp').style.width = sPct + '%';
  $('#self-lag').style.width = sPct + '%';
  $('#self-hp-txt').textContent = `${fmt(shp)} / ${fmt(B.maxPhp)}`;

  const left = Math.max(0, (B.limit || BATTLE_TIME) - B.t);
  const tEl = $('#timer');
  tEl.textContent = left.toFixed(1) + 's';
  tEl.classList.toggle('warn', left < 10);

  $('#enemy-tags').innerHTML =
    `<span class="tag weak">弱点 ${(st.weakAll || [st.weak]).map(t => TAGS[t]).filter(Boolean).join(' · ')}</span>` +
    `<span class="tag res">抗性 ${TAGS[st.resist] || ''}</span>` +
    `<span class="tag doc">范式 ${st.doc}</span>` +
    (st.quirk ? `<span class="tag quirk" title="${st.quirk.note || st.quirk.desc}\n\n▸ ${st.quirk.tip}">${st.quirk.icon} ${st.quirk.name}</span>` : '') +
    (st.kind === 'boss' ? `<span class="tag">不可闪避</span>` : '') +
    (B.expData ? `<span class="tag exp" title="同一关挑战 ${B.expTries} 次，数据充分">🔬 实验 ×${B.expTries}</span>` : '');

  const P = stats();
  const best = P.skills.length
    ? P.skills.map(d => affinityOfBook(d.book, st).total).sort((a, b) => b - a)[0]
    : 1;
  const affEl = $('#affinity-badge');
  if (best >= 1.5) { affEl.className = 'affinity good'; affEl.textContent = `相性 · 双克制 ×${best.toFixed(2)}`; }
  else if (best > 1.02) { affEl.className = 'affinity good'; affEl.textContent = `相性 · 克制 ×${best.toFixed(2)}`; }
  else if (best < 0.98) { affEl.className = 'affinity bad'; affEl.textContent = `相性 · 被抗 ×${best.toFixed(2)}`; }
  else { affEl.className = 'affinity'; affEl.textContent = '相性 · 均势'; }

  const cds = $('#cds');
  const list = deskList();
  if (cds.children.length !== list.length) {
    cds.innerHTML = list.map(d => `<div class="cd-chip" data-cd="${d.book.id}">${d.book.emoji}<div class="cdv"></div></div>`).join('');
  }
  list.forEach((d) => {
    const chip = cds.querySelector(`[data-cd="${d.book.id}"]`);
    if (!chip) return;
    const rem = Math.max(0, B.cds[d.book.id] || 0);
    const v = chip.querySelector('.cdv');
    if (rem > 0) { v.style.display = 'flex'; v.textContent = rem.toFixed(1); chip.classList.remove('ready'); }
    else { v.style.display = 'none'; chip.classList.add('ready'); }
  });

  $('#dps-txt').textContent = `预估 DPS ${fmt(P.dps)}`;
  if (force) renderLog();
}

/* ---------------- 弹窗 ---------------- */
function openDialog(html) {
  $('#dialog').innerHTML = html;
  $('#mask').classList.add('show');
}
function closeDialog() { clearType(); $('#mask').classList.remove('show'); }

/* ---------------- 离线账号弹窗（没有 net.js 时用） ---------------- */
function saveCodeOf() {
  try { return btoa(encodeURIComponent(JSON.stringify(S))); } catch (e) { return ''; }
}

function offlineAccountDialog() {
  const code = saveCodeOf();
  return `<h3>☁️ 离线模式</h3>
    <p>现在没有连服务器，存档只存在这台设备的「这个地址」下。</p>
    <p class="bk-rel">换成线上地址（或其他电脑、其他浏览器）时，存档不会自动跟过去 —— 用下面这段搬。</p>
    <div class="lore bk-sec">
      <div class="lore-h">导出存档码</div>
      <p class="bk-rel">复制这一整串，然后打开线上版 → 顶栏「登录 / 注册」→「把本地存档搬上来」→ 粘贴。</p>
      <textarea class="net-code" id="code-out" readonly onclick="this.select()">${code}</textarea>
      <p class="bk-rel" id="code-msg">长度 ${code.length} 字符 · 第 ${S.maxStage || 0} 关 · ${S.page || 0} 页 · ${Object.keys(S.books || {}).length} 本书</p>
      <div class="net-form">
        <button class="btn ghost sm" onclick="copySaveCode()">复制存档码</button>
      </div>
    </div>
    <div class="dialog-acts">
      <button class="btn ghost" onclick="closeDialog();showIntro(true)">再看一次开场</button>
      <button class="btn gold" onclick="closeDialog()">关闭</button>
    </div>`;
}

function copySaveCode() {
  const el = $('#code-out');
  if (!el) return;
  el.select();
  el.setSelectionRange(0, 999999);
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(el.value); ok = true;
    } else { ok = document.execCommand('copy'); }
  } catch (e) { ok = false; }
  const m = $('#code-msg');
  if (m) m.textContent = ok ? '✅ 已复制到剪贴板，去线上版粘贴吧' : '自动复制失败，请手动全选（Ctrl+A）复制';
}

/* ---------------- 开场引导 ---------------- */
let introIdx = 0;

function showIntro(force) {
  if (typeof INTRO_SLIDES === 'undefined' || !INTRO_SLIDES.length) return;
  if (!force && S.seenIntro) return;
  introIdx = 0;
  S.seenIntro = true;         /* 弹过一次就不再自动弹，避免刷新反复打断 */
  save();
  renderIntro();
}

function renderIntro() {
  const sl = INTRO_SLIDES[introIdx];
  const last = introIdx >= INTRO_SLIDES.length - 1;
  const dots = INTRO_SLIDES.map((_, i) => `<i class="${i === introIdx ? 'on' : ''}"></i>`).join('');
  openDialog(`
    <div class="intro">
      <div class="intro-tag">${sl.tag}</div>
      <h3 class="intro-title">${sl.title}</h3>
      ${sl.body.map(t => `<p>${t}</p>`).join('')}
      <div class="intro-line">${sl.line}</div>
      <p class="intro-foot">${sl.foot}</p>
      <div class="intro-dots">${dots}</div>
      <div class="dialog-acts">
        ${introIdx > 0
          ? '<button class="btn ghost" onclick="introPrev()">上一页</button>'
          : '<button class="btn ghost" onclick="introSkip()">跳过</button>'}
        <button class="btn gold" onclick="${last ? 'introDone()' : 'introNext()'}">${last ? '开始' : '继续'}</button>
      </div>
    </div>
  `);
}

function introNext() { if (introIdx < INTRO_SLIDES.length - 1) { introIdx++; renderIntro(); } }
function introPrev() { if (introIdx > 0) { introIdx--; renderIntro(); } }
function introDone() { introIdx = 0; closeDialog(); toast('欢迎来到理念世界'); }
function introSkip() { introIdx = 0; closeDialog(); }

function showCard(card) {
  const L = (typeof CARD_LORE !== 'undefined' && CARD_LORE[card.id]) || null;
  openDialog(`
    <h3>知识卡 · ${card.title}</h3>
    <div class="quote">${card.text}</div>
    ${L ? `<div class="lore"><div class="lore-h">后来呢</div><p>${L.body}</p></div>` : ''}
    ${L ? `<div class="lesson">${L.lesson}</div>` : ''}
    <p style="margin:0;font-size:11.5px;color:#6f6557">它已收进你的图鉴，随时可以回看。</p>
    <div class="dialog-acts">
      <button class="btn ghost sm" onclick="shareCard('${card.id}')">存为图片</button>
      <button class="btn gold" onclick="closeDialog()">收下</button>
    </div>
  `);
}

/* ---------------- 书籍详情 ---------------- */
function openBookDetail(id) {
  const b = bookById(id), st = S.books[id];
  if (!b || !st) return;
  const q = qOf(st.q);
  const L = (typeof BOOK_LORE !== 'undefined' && BOOK_LORE[id]) || null;
  const tier = st.q;                      /* 0 手抄本 … 5 原典：读到的内容随品质增加 */
  const lvF = b.type === 'attr'
    ? Object.keys(b.attr).map(k => `${ATTR_NAME[k]} +${(b.attr[k] * (1 + 0.1 * (st.lv - 1)) * q.rate).toFixed(0)}`).join(' · ')
    : `伤害 ×${(b.mult * (1 + LV_SKILL_BONUS * (st.lv - 1)) * q.skill).toFixed(1)} · CD ${b.cd}s`;

  const sec = html => `<div class="lore bk-sec">${html}</div>`;
  const _doc = doctrineOf(b);
  const _docC = doctrineColor(_doc);
  const _dom = bookDomain(b);
  const _sc = b.school ? SCHOOLS.find(x => x.id === b.school) : null;
  const _beats = (typeof COUNTER !== 'undefined' && COUNTER[_doc]) || '—';
  const _beatenBy = (typeof COUNTER !== 'undefined')
    ? (Object.keys(COUNTER).find(k => COUNTER[k] === _doc) || '—') : '—';
  const parts = [];
  /* —— 第 0 层：任何品质都有 —— */
  parts.push(`<p class="bk-desc">${b.desc}</p>`);
  parts.push(`<div class="quote">${b.quote}</div>`);
  /* 学派 / 方法论 / 克制关系 —— 这是配阵的核心信息，不该藏在别处 */
  parts.push(sec(`<div class="lore-h">学派与方法论</div>
    <p>${_sc ? `${_sc.name}（${_sc.short}）` : '跨学派'}　·　学科「${_dom}」　·　方法论「<b style="color:${_docC}">${_doc}</b>」</p>
    <p class="bk-rel">克制 <b>${_beats}</b>（伤害 ×1.25）　·　被 <b>${_beatenBy}</b> 克制（×0.8）</p>
    <p class="bk-rel">${(typeof DOCTRINE_DESC !== 'undefined' && DOCTRINE_DESC[_doc]) || ''}</p>`));
  /* —— 第 1 层：史实 —— */
  if (tier >= 1 && L) parts.push(sec(`<div class="lore-h">史实</div><p>${L.fact}</p>`));
  /* —— 第 2 层：今天在哪里 —— */
  if (tier >= 2 && L) parts.push(sec(`<div class="lore-h">今天在哪里</div><p>${L.use}</p>`));
  /* —— 第 3 层：出处与流变（含同源书目） —— */
  if (tier >= 3) {
    const rel = BOOKS.filter(x => x.id !== b.id && (x.school === b.school || (b.tag && x.tag === b.tag)))
      .slice(0, 3).map(x => x.name);
    parts.push(sec(`<div class="lore-h">出处与流变</div>
      <p>来源：${b.source}</p>
      ${rel.length ? `<p class="bk-rel">同源书目：${rel.join(' · ')}</p>` : ''}`));
  }
  /* —— 第 4 层：机制解读 + 关联概念 —— */
  if (tier >= 4) {
    const effName = (typeof EFFECT_LABEL !== 'undefined' && EFFECT_LABEL[b.effect]) || null;
    const mech = b.type === 'attr'
      ? `放在书架上即生效，不必上桌。每升一级，它给的属性按品质系数继续放大。`
      : effName
        ? `这本书提供「${effName}」：坐在书桌槽位上，每 ${b.cd} 秒自动释放一次。${b.effect === 'summon' ? '召唤物有血量，会被敌人攻击，也会被治疗。' : ''}`
        : `坐在书桌槽位上，每 ${b.cd} 秒自动释放一次。`;
    const cons = CONCEPTS.filter(c => c.sources.some(x => x.type === 'book' && x.id === b.id));
    parts.push(sec(`<div class="lore-h">机制解读</div>
      <p>${mech}</p>
      <p class="bk-rel">关联概念：${cons.length ? cons.map(c => c.icon + c.name).join(' · ') : '暂未成为任何概念的出处'}</p>`));
  }
  /* —— 第 5 层：原典摘录 —— */
  if (tier >= 5) {
    if (L && L.excerpt) {
      /* 能确证原文的：标「原典摘录」 */
      parts.push(sec(`<div class="lore-h">原典摘录</div><p class="bk-excerpt">${L.excerpt}</p>`));
    } else if (L && L.digest) {
      /* 不能确证逐字的：如实标成「要点摘记」，并说明不是原文 */
      parts.push(sec(`<div class="lore-h">要点摘记</div>
        <p>${L.digest}</p>
        <p class="bk-rel">※ 这段是内容概述，不是原书引文。</p>`));
    } else {
      const rel = BOOKS.filter(x => x.school === b.school && x.id !== b.id).slice(0, 3).map(x => x.name);
      parts.push(sec(`<div class="lore-h">延伸</div>
        <p>这本的摘记还在整理中。先记住它的一句话：${b.quote}</p>
        ${rel.length ? `<p class="bk-rel">同学派：${rel.join(' · ')}</p>` : ''}`));
    }
  }
  /* —— 下一层能读到什么（升级动机） —— */
  const NEXT_UNLOCK = ['史实', '今天在哪里', '出处与流变', '机制解读', '原典摘录'];
  const lockNote = tier < QUALITIES.length - 1
    ? `<p class="bk-lock">🔒 升到「${QUALITIES[tier + 1].name}」还能读到：${NEXT_UNLOCK[tier]}</p>`
    : `<p class="bk-lock done">✦ 这已是最高品质，关于它的文字你都读到了。</p>`;

  openDialog(`
    <h3>${b.emoji} ${b.name}</h3>
    <div class="bk-meta">
      <em style="color:${q.color};border-color:${q.color}44">${q.name}</em>
      <em class="dtag" style="color:${_docC};border-color:${_docC}55">${_doc}</em>
      <span>Lv ${st.lv}/${q.cap}</span>
      <span>${lvF}</span>
      <span>产出 ${(b.rate * q.rate * (1 + LV_RATE_BONUS * (st.lv - 1))).toFixed(2)}/s</span>
    </div>
    ${parts.join('')}
    ${lockNote}
    <p class="bk-src">读到的层数 ${tier + 1} / ${QUALITIES.length}</p>
    <div class="dialog-acts"><button class="btn ghost" onclick="closeDialog()">合上</button></div>
  `);
}

/* ---------------- 人物属性面板 ----------------
   之前面板只给绝对数字，于是出现两个误会：
     ① 「严谨 +3323 攻击」看着像零 —— 其实它是攻击基数的 99.6%，
        只是还没乘范式复利。这里改成直接说「占你攻击的百分之多少」；
     ② 「暴击率 897%，上限 60%」—— 让人以为自己白加了 93% 的点。
        现在暴击率走渐近曲线，全程都有收益，面板如实写当前值。 */
function openStats() {
  const P = stats();
  const a = P.attr || {};
  /* 严谨在攻击基数里占多少：这才是"它到底有没有用"的诚实答案 */
  const atkBase = 12 + (a.rigor || 0) * 2;
  const rigorShare = atkBase > 0 ? ((a.rigor || 0) * 2 / atkBase * 100) : 0;
  /* 每再 +1 点能涨多少（边际收益）—— 比绝对值有用得多 */
  const marg = (key, fn) => {
    const b = fn(a[key] || 0), c = fn((a[key] || 0) + 1);
    return c - b;
  };
  const pct = x => (x * 100).toFixed(x < 0.001 ? 3 : 2) + '%';
  const row = (name, val, eff, note) => `
    <div class="stat-item">
      <div class="st-top"><span class="st-name">${name}</span><b class="st-val">${val}</b></div>
      <div class="st-eff">${eff}</div>
      <div class="st-note">${note}</div>
    </div>`;

  const rawCrit = (a.intuition || 0) * 0.006;
  const attrHtml = [
    row('悟性 insight', fmt(a.insight || 0), `洞见产出 ×${(1 + 0.10 * (a.insight || 0)).toFixed(1)}`,
        `只影响挂机收益，不加伤害也不加坦度　·　再 +1 点约 +${pct(marg('insight', n => 1 / (1 + 0.10 * n)))}`),
    row('严谨 rigor', fmt(a.rigor || 0),
        `攻击 +${fmt((a.rigor || 0) * 2)}　生命 +${fmt((a.rigor || 0) * 3)}`,
        `攻击基数的 <b>${rigorShare.toFixed(1)}%</b> 来自严谨 —— 没有它你的攻击只剩 ${fmt(12 * P.paraMul)}`),
    row('直觉 intuition', fmt(a.intuition || 0),
        `暴击率 <b>${(P.crit * 100).toFixed(1)}%</b>`,
        rawCrit <= CRIT_LINEAR
          ? `线性段内：+0.6% / 点，60% 之前不会衰减`
          : `已过线性段，渐近至 ${(CRIT_CAP * 100).toFixed(0)}%　·　再 +1 点约 +${pct(marg('intuition', n => critFromRaw(n * 0.006)))}`),
    row('雄辩 eloquence', fmt(a.eloquence || 0),
        `技能伤害 ×${(1 + 0.015 * (a.eloquence || 0)).toFixed(2)}`,
        '只放大技能，不放大普攻'),
    row('精审 precision', fmt(a.precision || 0),
        `暴击伤害 +${((a.precision || 0) * CRIT_DMG_PER * 100).toFixed(1)}%`,
        '<b>没有上限</b>，堆得越多暴击越疼'),
    row('沉毅 fortitude', fmt(a.fortitude || 0),
        `减伤 <b>${(P.dmgCut * 100).toFixed(1)}%</b>`,
        `渐近至 ${(DMG_CUT_CAP * 100).toFixed(0)}%　·　再 +1 点约 +${pct(marg('fortitude', n => DMG_CUT_CAP * (1 - Math.exp(-n / DMG_CUT_SOFT))))}`),
    row('捷才 celerity', fmt(a.celerity || 0),
        `冷却 <b>×${P.cdMul.toFixed(3)}</b>`,
        `渐近至 ×${CD_FLOOR}（最多缩减 ${((1 - CD_FLOOR) * 100).toFixed(0)}%）　·　再 +1 点约 ${pct(marg('celerity', n => CD_FLOOR + (1 - CD_FLOOR) * Math.exp(-n / CD_SOFT)))}`),
  ].join('');

  const deskN = (P.skills || []).length;
  const bookN = Object.keys(S.books || {}).length;
  const eqN2 = Object.keys(S.equip || {}).filter(k => S.equip[k]).length;

  openDialog(`
    <h3>📊 学者属性</h3>
    <p class="bk-rel" style="margin-bottom:10px">属性书放在<b>书架</b>就生效，不用上桌。同一个数字在不同属性上换来的是完全不同的东西。</p>
    <div class="stat-grid">${attrHtml}</div>

    <div class="lore bk-sec">
      <div class="lore-h">最终战斗数值</div>
      <div class="orep">
        <div class="orep-row"><span>洞见产出</span><b>${fmt(P.rate)} / 秒</b></div>
        <div class="orep-row"><span>攻击</span><b>${fmt(P.atk)}</b></div>
        <div class="orep-row"><span>生命</span><b>${fmt(P.hp)}</b></div>
        <div class="orep-row"><span>暴击率 / 暴击伤害</span><b>${((P.crit || 0) * 100).toFixed(1)}% / ×${(P.critDmg || 1.8).toFixed(2)}</b></div>
        <div class="orep-row"><span>技能倍率 / 冷却</span><b>×${(P.amp || 1).toFixed(2)} / ×${(P.cdMul || 1).toFixed(3)}</b></div>
        <div class="orep-row"><span>减伤</span><b>${((P.dmgCut || 0) * 100).toFixed(1)}%</b></div>
        <div class="orep-row"><span>理论 DPS</span><b>${fmt(P.dps)}</b></div>
      </div>
    </div>

    <div class="lore bk-sec">
      <div class="lore-h">这些数字从哪来</div>
      <div class="orep">
        <div class="orep-row"><span>范式复利</span><b>×${(P.paraMul || 1).toFixed(2)}</b></div>
        <div class="orep-row"><span>书桌 / 藏书</span><b>${deskN} 本 / ${bookN} 本</b></div>
        <div class="orep-row"><span>已装备</span><b>${eqN2} 件</b></div>
      </div>
      <p class="bk-rel">七种属性书放书架即生效；装备词条与天赋再叠加；范式是全局复利，所以「转生」比「升一级书」有用得多。暴击率、减伤、冷却都是<b>渐近曲线</b>——越接近极限涨得越慢，但<b>永远不会有白拿的点</b>；暴击伤害不设上限。</p>
    </div>

    <div class="dialog-acts"><button class="btn gold" onclick="closeDialog()">知道了</button></div>
  `);
}

/* ---------------- 图鉴 ---------------- */
let codexTab = 'book';

function openCodex(tab) {
  if (tab) codexTab = tab;
  const ownedIds = Object.keys(S.books);
  const skillN = BOOKS.filter(b => b.type === 'skill').length;
  const attrN = BOOKS.filter(b => b.type === 'attr').length;
  const gotS = BOOKS.filter(b => b.type === 'skill' && ownedIds.includes(b.id)).length;
  const gotA = BOOKS.filter(b => b.type === 'attr' && ownedIds.includes(b.id)).length;
  const cardN = CARDS.length, gotC = (S.cards || []).length;

  const head = `
    <h3>学者手册</h3>
    <div class="codex-tabs">
      <button class="ct${codexTab === 'book' ? ' on' : ''}" data-ct="book">书籍 ${gotS + gotA}/${BOOKS.length}</button>
      <button class="ct${codexTab === 'card' ? ' on' : ''}" data-ct="card">知识卡 ${gotC}/${cardN}</button>
      <button class="ct${codexTab === 'school' ? ' on' : ''}" data-ct="school">学派 ${SCHOOLS.length}</button>
      <button class="ct${codexTab === 'combo' ? ' on' : ''}" data-ct="combo">组合 ${(S.comboSeen || []).length}/${COMBOS.length}</button>
      <button class="ct${codexTab === 'concept' ? ' on' : ''}" data-ct="concept">概念 ${Object.values(conceptProgress()).filter(p => p.pct >= 1).length}/${CONCEPTS.length}</button>
      <button class="ct${codexTab === 'ach' ? ' on' : ''}" data-ct="ach">成就 ${Object.keys(S.ach).length}/${ACHIEVEMENTS.length}${achClaimable() ? ' 🏆' : ''}</button>
      <button class="ct${codexTab === 'debunk' ? ' on' : ''}" data-ct="debunk">错误博物馆 ${(S.debunk || []).length}/${DEBUNKED.length}</button>
    </div>`;

  let body = '';
  if (codexTab === 'book') {
    body = `<div class="codex-list">`;
    ['skill', 'attr'].forEach(tp => {
      body += `<div class="codex-sec">${tp === 'skill' ? `技能书 ${gotS}/${skillN}` : `属性书 ${gotA}/${attrN}`}</div>`;
      BOOKS.filter(b => b.type === tp).forEach(b => {
        const has = ownedIds.includes(b.id);
        if (has) {
          body += `<button class="cx-item" data-bk="${b.id}">
            <span class="cx-e">${b.emoji}</span>
            <span class="cx-n">${b.name}</span>
            <span class="cx-s">${b.desc.slice(0, 22)}…</span>
            <span class="cx-go">读</span>
          </button>`;
        } else {
          body += `<div class="cx-item locked">
            <span class="cx-e">？</span>
            <span class="cx-n">未知</span>
            <span class="cx-s">${b.source}</span>
          </div>`;
        }
      });
    });
    body += `</div>`;
  } else if (codexTab === 'card') {
    const got = new Set(S.cards || []);
    body = `<div class="codex-list">`;
    CARDS.slice().sort((a, b) => (a.boss || 0) - (b.boss || 0)).forEach(c => {
      const has = got.has(c.id);
      body += `<button class="cx-item${has ? '' : ' locked'}"${has ? ` data-card="${c.id}"` : ' disabled'}>
        <span class="cx-n">${has ? c.title : '未解锁'}</span>
        <span class="cx-s">${has ? (c.text.length > 26 ? c.text.slice(0, 26) + '…' : c.text) : `第 ${c.boss + 1} 关 BOSS 首杀`}</span>
        ${has ? '<span class="cx-go">读</span>' : ''}
      </button>`;
    });
    body += `</div>`;
  } else if (codexTab === 'concept') {
    const prog = conceptProgress();
    const cap = conceptSlots();
    const used = (S.conceptActive || []).filter(id => conceptRuleOn(id)).length;
    const spare = equipableRules().length - used;
    const need = conceptNextSlotNeed();
    body = `<div class="codex-list">`;
    /* 印记栏：这是「选择」发生的地方，所以放在最上面 */
    body += `<div class="slot-bar">
      <div class="sb-h">概念印记 <b>${used} / ${cap}</b>
        <span>${need !== null ? `再通晓 ${need} 个概念 +1 槽` : '已解到 7 槽'}</span>
      </div>
      <div class="sb-row">${Array.from({ length: cap }).map((_, i) => {
        const rid = (S.conceptActive || [])[i];
        const cc = rid ? CONCEPTS.find(x => x.rule && x.rule.id === rid) : null;
        return cc
          ? `<span class="sb-slot on" data-tog-slot="${rid}">${cc.icon} ${cc.rule.name}</span>`
          : `<span class="sb-slot">空</span>`;
      }).join('')}</div>
      <div class="sb-note">数值加成永久生效；规则只有装上才生效。</div>
      ${equipableRules().length === 0
        ? `<div class="sb-warn">还没有完全通晓的概念 —— 把某个概念的所有出处都找齐，就能装第一枚印记。</div>`
        : (spare > 0 ? `<div class="sb-warn">还有 ${spare} 条已通晓的规则没装 —— 按需要换。</div>` : '')}
      <div class="preset-row">
        <span class="ps-cap">预设</span>
        ${[0, 1, 2].map(i => {
          const label = presetLabel(i);
          const pr = (S.conceptPresets && S.conceptPresets[i] && S.conceptPresets[i].rules) || [];
          const same = label && pr.join('|') === (S.conceptActive || []).join('|');
          return `<span class="preset-item">
            <span class="ps-body${label ? '' : ' empty'}${same ? ' on' : ''}" data-preset="${i}"
              title="${label ? '点一下换上这套' : '点「存」把当前配置存进来'}">${label || '空'}</span>
            <span class="ps-save" data-preset-save="${i}" title="把当前配置存进这套">存</span>
          </span>`;
        }).join('')}
      </div>
    </div>`;
    body += `<div class="codex-sec">同一个概念会在书、知识卡、BOSS、装备里反复出现</div>`;
    CONCEPTS.forEach(c => {
      const p = prog[c.id];
      const full = p.pct >= 1;
      const on = full && c.rule && conceptRuleEquipped(c.rule.id);
      body += `<button class="cx-item${on ? ' equipped' : ''}" data-concept="${c.id}">
        <span class="cx-e">${c.icon}</span>
        <span class="cx-n" style="${on ? 'color:#e8c765' : (full ? 'color:#cdbf9e' : '')}">${c.name}</span>
        <span class="cx-s">${c.bonusText}${c.rule ? (full ? ' · ◆' + c.rule.name : ' · 未通晓') : ''}</span>
        <span class="cx-go">${p.got}/${p.total}</span>
        ${full && c.rule ? `<span class="cx-tog${on ? ' on' : ''}" data-tog="${c.rule.id}">${on ? '卸' : '装'}</span>` : ''}
      </button>`;
    });
    body += `</div>`;
  } else if (codexTab === 'combo') {
    const seen = S.comboSeen || [];
    const on = activeCombos().map(c => c.id);
    body = `<div class="codex-list">`;
    body += `<div class="codex-sec">已发现 ${seen.length} / ${COMBOS.length}　·　剩下的要自己试</div>`;
    COMBOS.forEach(c => {
      if (seen.indexOf(c.id) < 0) {
        const allOwned = c.need.every(id => ownedIds.indexOf(id) >= 0);
        body += `<div class="cx-item locked">
          <span class="cx-e">？</span>
          <span class="cx-n">未知组合</span>
          <span class="cx-s">${allOwned ? '需要的书都在手上，试试同时放上书桌' : '还有书没找到'}</span>
        </div>`;
        return;
      }
      const live = on.indexOf(c.id) >= 0;
      body += `<button class="cx-item" data-combo2="${c.id}">
        <span class="cx-e">${c.icon}</span>
        <span class="cx-n">${c.name}</span>
        <span class="cx-s">${c.need.map(id => bookById(id).name).join(' + ')}</span>
        <span class="cx-go">${live ? '生效中' : '已发现'}</span>
      </button>`;
    });
    body += `</div>`;
  } else if (codexTab === 'debunk') {
    const got = new Set(S.debunk || []);
    body = `<div class="codex-list">`;
    body += `<div class="codex-sec">识破 ${got.size} / ${DEBUNKED.length}　·　每识破一条：产出与攻击 +1%（上限 +10%）</div>`;
    DEBUNKED.forEach(d => {
      const has = got.has(d.id);
      if (!has) {
        const st = stageData(d.boss);
        body += `<div class="cx-item locked">
          <span class="cx-e">？</span>
          <span class="cx-n">${d.year} 年 · 未识破</span>
          <span class="cx-s">${st.sch.short} 学派第 ${st.round + 1} 轮 BOSS 首杀</span>
        </div>`;
        return;
      }
      body += `<div class="cx-item ach done" style="opacity:1;align-items:flex-start">
        <span class="cx-e">${d.icon}</span>
        <span class="cx-n" style="flex:1">
          ${d.name}<em style="color:#6f6557;font-size:11px">　${d.year}</em>
          <span class="cx-s" style="display:block;margin-top:3px;line-height:1.6">${d.wrong}</span>
          <span class="cx-s" style="display:block;margin-top:4px;color:var(--gold2)">▸ ${d.lesson}</span>
        </span>
      </div>`;
    });
    body += `</div>`;
  } else if (codexTab === 'ach') {
    body = `<div class="codex-list">`;
    body += `<div class="codex-sec">达成 ${Object.keys(S.ach).length} / ${ACHIEVEMENTS.length}　·　奖励只有书页和洞见，读书的纪念不换范式</div>`;
    Object.keys(ACH_CATS).forEach(cat => {
      const list = ACHIEVEMENTS.filter(a => a.cat === cat);
      const gotN = list.filter(a => S.ach[a.id]).length;
      body += `<div class="codex-sec">${ACH_CATS[cat]} ${gotN}/${list.length}</div>`;
      list.forEach(a => {
        const st = S.ach[a.id];
        body += `<div class="cx-item ach${st === 'claimed' ? ' done' : st === 'got' ? ' ready' : ''}">
          <span class="cx-e">${st ? a.icon : '🔒'}</span>
          <span class="cx-n">${st ? a.name : '？？？'}</span>
          <span class="cx-s">${st === 'got' ? `书页 +${fmt(a.page)} · 洞见 +${(a.hrs || 0)} 小时产出` : a.desc}</span>
          ${st === 'got' ? `<button class="btn gold sm" data-ach="${a.id}">领取</button>`
            : `<span class="cx-go">${st === 'claimed' ? '已领' : ''}</span>`}
        </div>`;
      });
    });
    body += `</div>`;
  } else {
    body = `<div class="codex-list">`;
    schoolOrder(S.era).forEach((sc, oi) => {
      const opened = (S.unlocked || []).includes(sc.id);
      const total = STAGES_PER_SCHOOL;
      const done = Math.max(0, Math.min(total, (S.maxStage || 0) - oi * total));
      const beats = COUNTER[sc.doctrine] || '—';
      const beaten = Object.keys(COUNTER).find(k => COUNTER[k] === sc.doctrine) || '—';
      body += `<div class="cx-sch${opened ? '' : ' locked'}">
        <div class="cx-sh"><b>${sc.name}</b><em>${sc.doctrine}</em></div>
        <div class="cx-sd">克制 ${beats} · 被 ${beaten} 克制</div>
        <div class="cx-sb"><i style="width:${(done / total * 100).toFixed(0)}%"></i></div>
        <div class="cx-sn">${done} / ${total} 关${opened ? '' : ' · 未解锁'}</div>
      </div>`;
    });
    body += `</div>`;
  }

  openDialog(`${head}${body}
    <div class="dialog-acts"><button class="btn ghost" onclick="closeDialog()">关闭</button></div>`);

  document.querySelectorAll('.codex-tabs .ct').forEach(el => {
    el.onclick = () => openCodex(el.dataset.ct);
  });
  document.querySelectorAll('[data-bk]').forEach(el => {
    el.onclick = () => openBookDetail(el.dataset.bk);
  });
  document.querySelectorAll('[data-card]').forEach(el => {
    const c = CARDS.find(x => x.id === el.dataset.card);
    if (c) el.onclick = () => showCard(c);
  });
  document.querySelectorAll('[data-ach]').forEach(el => {
    el.onclick = () => claimAch(el.dataset.ach);
  });
  document.querySelectorAll('[data-combo2]').forEach(el => {
    el.onclick = () => showCombo(COMBOS.find(c => c.id === el.dataset.combo2));
  });
  document.querySelectorAll('[data-concept]').forEach(el => {
    el.onclick = () => openConcept(CONCEPTS.find(c => c.id === el.dataset.concept));
  });
  document.querySelectorAll('[data-tog]').forEach(el => {
    el.onclick = (ev) => { ev.stopPropagation(); toggleConceptRule(el.dataset.tog); };
  });
  document.querySelectorAll('[data-tog-slot]').forEach(el => {
    el.onclick = (ev) => { ev.stopPropagation(); toggleConceptRule(el.dataset.togSlot); };
  });
  document.querySelectorAll('[data-preset]').forEach(el => {
    el.onclick = (ev) => { ev.stopPropagation(); usePreset(parseInt(el.dataset.preset, 10)); };
  });
  document.querySelectorAll('[data-preset-save]').forEach(el => {
    el.onclick = (ev) => { ev.stopPropagation(); storePreset(parseInt(el.dataset.presetSave, 10)); };
  });
}

function pickBookForSlot(slot) {
  const avail = Object.keys(S.books).filter(id => {
    const b = bookById(id); return b && b.type === 'skill' && !S.desk.includes(id);
  });
  if (!avail.length) { toast('没有可上桌的技能书'); return; }
  openDialog(`
    <h3>选择技能书</h3>
    <p>书桌是策略发生的地方：把克制敌人的学科放上来。</p>
    <div class="pick" id="pick-list">
      ${avail.map(id => `<div class="p" data-id="${id}">${bookById(id).emoji} ${bookById(id).name}</div>`).join('')}
    </div>
    <div class="dialog-acts"><button class="btn ghost" onclick="closeDialog()">取消</button></div>
  `);
  document.querySelectorAll('#pick-list .p').forEach(el => {
    el.onclick = () => {
      S.desk[slot] = el.dataset.id;
      dirty.desk = 1; dirty.shelf = 1; save();
      renderDesk(); renderShelf(); closeDialog();
    };
  });
}

/* ---------------- 装备面板 ---------------- */
let craftSel = [];

function equipAffixHtml(e) {
  return (e.affixes || []).map(id => {
    const a = affixById(id);
    if (!a) return '';
    return `<span class="af ${a.kind === 'rule' ? 'rule' : ''}" title="${a.desc}">${a.name} · ${a.desc}</span>`;
  }).join('');
}

/* ================= 概念详情 ================= */
/* 一个概念的所有出场记录都在这里。玩家能看到「还差哪一处」，
   这比一条孤立的「相关链接」有用：它给出的是路线，不是路标。 */
const SRC_LABEL = { book:'书', card:'知识卡', sig:'装备', quirk:'BOSS', combo:'组合' };

function openConcept(c) {
  if (!c) return;
  const p = conceptProgress()[c.id];
  const pct = Math.round(p.pct * 100);
  const rows = c.sources.map(src => {
    const has = conceptSourceHas(src);
    let title = src.id;
    if (src.type === 'book') { const b = bookById(src.id); title = b ? `《${b.name}》` : src.id; }
    else if (src.type === 'card') { const k = CARDS.find(x => x.id === src.id); title = k ? k.title : src.id; }
    else if (src.type === 'sig') {
      const sig = Object.values(EQUIP_SIGNATURE).find(x => x.id === src.id);
      title = sig ? sig.name : src.id;
    } else if (src.type === 'quirk') {
      const q = QUIRKS[src.id]; title = q ? q.name : src.id;
    } else if (src.type === 'combo') {
      const cb = COMBOS.find(x => x.id === src.id); title = cb ? cb.name : src.id;
    }
    return `<div class="cs-row${has ? ' on' : ''}">
      <span class="cs-t">${SRC_LABEL[src.type] || ''}</span>
      <span class="cs-n">${title}</span>
      <span class="cs-note">${has ? (src.note || '') : '未遇到'}</span>
      <span class="cs-m">${has ? '✓' : '·'}</span>
    </div>`;
  }).join('');

  openDialog(`
    <h3>${c.icon} ${c.name}</h3>
    <p style="font-size:12px;color:var(--ink2);line-height:1.8;margin:4px 0 10px">${c.line}</p>
    <div class="cp-bar"><i style="width:${pct}%"></i></div>
    <div class="cp-meta">
      <span>已打通 ${p.got} / ${p.total}</span>
      <b style="color:${pct >= 100 ? '#e8c765' : '#8a7c62'}">${c.bonusText} × ${pct}%</b>
    </div>
    ${c.rule ? `<div class="rule-box${pct >= 100 ? ' on' : ''}">
      <div class="rb-h">${pct >= 100 ? '◆' : '◇'} 规则 · ${c.rule.name}
        <i>${pct >= 100 ? '已生效' : '完全通晓后生效'}</i></div>
      <div class="rb-d">${c.rule.desc}</div>
      <div class="rb-l">${c.rule.line}</div>
    </div>` : ''}
    <div class="cs-list">${rows}</div>
    <div class="dialog-acts">
      <button class="btn ghost" onclick="closeDialog()">合上</button>
      ${c.rule && pct >= 100 ? (conceptRuleEquipped(c.rule.id)
        ? `<button class="btn ghost" id="concept-tog">卸下印记</button>`
        : `<button class="btn gold" id="concept-tog">装上印记</button>`) : ''}
    </div>
  `);
  const tb = $('#concept-tog');
  if (tb) tb.onclick = () => { closeDialog(); toggleConceptRule(c.rule.id); };
}

function storePreset(i) {
  const n = savePreset(i);
  save();
  if (n === 0) toast('当前没有装任何印记，存下来是空的');
  else toast(`已存为预设 ${i + 1} · ${n} 条`);
  openCodex('concept');
  dirty.desk = 1;
}

function usePreset(i) {
  const r = applyPreset(i);
  if (!r.ok) { toast(r.why); return; }
  save();
  const bits = [`已换上预设 ${i + 1} · ${r.n} 条（下一场生效）`];
  if (r.dropped > 0) bits.push(`${r.dropped} 条还没通晓，跳过了`);
  if (r.cut > 0) bits.push(`槽位不够，${r.cut} 条没装上`);
  toast(bits.join('，'));
  openCodex('concept');
  dirty.desk = 1;
}

function toggleConceptRule(ruleId) {
  if (conceptRuleEquipped(ruleId)) {
    unequipConceptRule(ruleId);
    toast('已卸下印记');
  } else {
    const r = equipConceptRule(ruleId);
    if (!r.ok) { toast(r.why); return; }
    toast('已装上印记 · 下一场生效');
  }
  save();
  openCodex('concept');
  dirty.desk = 1;
}

/* ================= 装备详情 ================= */
/* 顶级装备的「名字 → 能力 → 来历」在这里合成一件事：
   玩家是因为觉得「爱因斯坦的烟斗」有意思才点进来的，出去时顺带知道了一点东西。 */
function openEquipDetail(e) {
  if (!e) return;
  const q = QUALITIES[e.q];
  const slotDef = EQUIP_SLOTS.find(x => x.id === e.slot);
  const sig = EQUIP_SIGNATURE[e.slot + ':' + e.q];
  const lore = EQUIP_LORE[e.slot + ':' + e.q];
  openDialog(`
    <h3>${slotDef ? slotDef.icon : '▫'} ${equipName(e)}</h3>
    <div class="bk-meta">
      <em style="color:${q.color};border-color:${q.color}44">${q.grade}</em>
      <span>${slotDef ? slotDef.name : ''}</span>
    </div>
    ${sig ? `<div class="sig-box">
      <div class="sig-h">${sig.icon} ${sig.name}<i>专属</i></div>
      <div class="sig-d">${sig.desc}</div>
      <div class="sig-how">${sig.how}</div>
    </div>` : (lore ? `<div class="lore"><div class="lore-h">来历</div><p>${lore}</p></div>` : '')}
    <div class="lore"><div class="lore-h">词条</div><div class="eq-af">${equipAffixHtml(e)}</div></div>
    <div class="dialog-acts"><button class="btn ghost" onclick="closeDialog()">合上</button></div>
  `);
}

function openEquip() {
  const slotsHtml = EQUIP_SLOTS.map(s => {
    const e = S.equip[s.id];
    return `<div class="eq-slot ${e ? 'on' : 'empty'}">
      <div class="eq-ic">${s.icon}</div>
      <div class="eq-body">
        <div class="eq-nm${e ? ' clickable' : ''}"${e ? ` data-eq="${e.uid}"` : ''}>${e ? equipName(e) : '（空）'}
          ${e && EQUIP_SIGNATURE[e.slot + ':' + e.q] ? `<em class="sig-tag">${EQUIP_SIGNATURE[e.slot + ':' + e.q].icon} 专属</em>` : ''}
        </div>
        <div class="eq-ln">${s.name} · ${s.line}　<i>${s.desc}</i></div>
        <div class="eq-af">${e ? equipAffixHtml(e) : ''}</div>
        ${e && EQUIP_LORE[e.slot + ':' + e.q] ? `<div class="eq-lore">${EQUIP_LORE[e.slot + ':' + e.q]}</div>` : ''}
      </div>
      ${e ? `<button class="mini" data-off="${s.id}">卸下</button>` : ''}
    </div>`;
  }).join('');

  const bag = sortedBag();
  const plan = meltPlan();
  const planPage = plan.reduce((s, e) => s + meltValue(e), 0);
  const bagHtml = bag.length ? bag.map(e => {
    const worn = S.equip[e.slot] && S.equip[e.slot].uid === e.uid;
    const sel = craftSel.indexOf(e.uid) >= 0;
    const melt = meltValue(e);
    return `<div class="eq-item ${sel ? 'sel' : ''}">
      <div class="eq-hd">
        <b class="clickable" data-eq="${e.uid}">${equipName(e)}</b>
        <span class="qm" style="color:${QUALITIES[e.q].color}">${QUALITIES[e.q].mark}</span>
        ${worn ? '<i class="worn">已穿戴</i>' : ''}
        ${sel ? '<i class="worn">材料</i>' : ''}
      </div>
      <div class="eq-af">${equipAffixHtml(e)}</div>
      <div class="eq-acts">
        <button class="mini ${worn ? '' : 'gold'}" data-wear="${e.uid}" ${worn ? 'disabled' : ''}>穿戴</button>
        <button class="mini" data-mat="${e.uid}">${sel ? '取消' : '作材料'}</button>
        <button class="mini melt" data-melt="${e.uid}" title="熔掉换 ${melt} 书页" ${worn ? 'disabled' : ''}>熔 +${melt}</button>
      </div>
    </div>`;
  }).join('') : `<p class="hint">背包是空的。装备靠掉落：普通关 ${Math.round(EQUIP_DROP.normal * 100)}%、精英 ${Math.round(EQUIP_DROP.elite * 100)}%、Boss ${Math.round(EQUIP_DROP.boss * 100)}%（<b>首次通关必掉</b>）。</p>`;

  let craftHtml = `<p class="hint">在背包里选 <b>${CRAFT_NEED} 件同槽位、同品质</b>的装备作为材料。合成结果<b>品质必升一档，词条只增不减</b>（三件里多出来的词条会被吸收）。</p>`;
  if (craftSel.length === CRAFT_NEED) {
    const pv = craftPreview(craftSel[0], craftSel[1], craftSel[2]);
    if (pv && pv.ok) {
      const keepList = pv.keep.map(id => { const a = affixById(id); return a ? `<span class="af">${a.name}</span>` : ''; }).join('');
      const addTxt = (pv.keep.length < pv.cap)
        ? (pv.extra.length ? `<span class="af rule">＋ 吸收：${pv.extra.map(id => (affixById(id) || {}).name).filter(Boolean).join(' / ')}</span>` : '<span class="af rule">＋ 随机补新词条</span>')
        : '<span class="af">词条数已达该品质上限</span>';
      const outName = equipName({ slot: pv.a.slot, q: pv.out.q });
      craftHtml = `<div class="craft-prev">
        <div style="font-size:11.5px;color:var(--ink3);margin-bottom:4px">
          ${[pv.a, pv.b, pv.c].map(x => equipName(x)).join(' ＋ ')}
        </div>
        <div style="margin-bottom:6px">→ <b style="color:#e8c765">${outName}</b>
          <span class="qm" style="color:${QUALITIES[pv.out.q].color};border-color:${QUALITIES[pv.out.q].color}66">${QUALITIES[pv.out.q].grade}</span></div>
        <div class="eq-af">${keepList}${addTxt}</div>
        <button class="btn gold sm" id="do-craft" style="margin-top:8px">确认合成</button>
      </div>`;
    } else {
      craftHtml = `<p class="warn">${(pv && pv.why) || '无法合成'}</p>`;
    }
  } else {
    craftHtml += `<p class="hint" style="border:0;padding-top:4px">还差 ${CRAFT_NEED - craftSel.length} 件。</p>`;
  }

  let meltHtml = `<p class="hint">品质已经封顶的原典熔掉也不心疼 —— 但<b>同槽位里比身上这件差的</b>，可以一键清掉换书页。</p>`;
  if (plan.length) {
    meltHtml = `<p class="hint">有 <b>${plan.length}</b> 件已经没用了：比身上穿的差，或者已经是封顶的原典（再合成也不会更高）。
      更好的、以及还能凑合成的同档装备都会留着。
      <button class="btn ghost sm" id="do-melt" style="margin-left:6px">熔掉冗余 · 书页 +${fmt(planPage)}</button></p>`;
  }

  openDialog(`
    <h3>装备 · ${equippedCount()} / ${EQUIP_SLOTS.length} 槽位</h3>
    <p>装备是实体：范式转移不会带走它们。书决定你打什么，装备决定你<b>怎么打</b>。</p>
    <div class="eq-slots">${slotsHtml}</div>
    <h4 style="margin:14px 0 6px">背包 · ${bag.length} 件</h4>
    <div class="eq-bag">${bagHtml}</div>
    <h4 style="margin:14px 0 6px">熔解</h4>
    ${meltHtml}
    <h4 style="margin:14px 0 6px">合成（已选 ${craftSel.length} / ${CRAFT_NEED}）</h4>
    ${craftHtml}
    <div class="dialog-acts"><button class="btn" onclick="closeDialog()">关闭</button></div>
  `);

  document.querySelectorAll('[data-eq]').forEach(el => {
    el.onclick = (ev) => {
      ev.stopPropagation();
      const uid = parseInt(el.dataset.eq, 10);
      const target = S.bag.find(x => x.uid === uid) ||
        EQUIP_SLOTS.map(sd => S.equip[sd.id]).find(x => x && x.uid === uid);
      openEquipDetail(target);
    };
  });
  document.querySelectorAll('[data-off]').forEach(el => {
    el.onclick = () => { unwearEquip(el.dataset.off); save(); renderAll(); openEquip(); };
  });
  document.querySelectorAll('[data-wear]').forEach(el => {
    el.onclick = () => { wearEquip(parseInt(el.dataset.wear, 10)); save(); renderAll(); openEquip(); };
  });
  document.querySelectorAll('[data-mat]').forEach(el => {
    el.onclick = () => {
      const uid = parseInt(el.dataset.mat, 10);
      const i = craftSel.indexOf(uid);
      if (i >= 0) craftSel.splice(i, 1);
      else { craftSel.push(uid); if (craftSel.length > CRAFT_NEED) craftSel.shift(); }
      openEquip();
    };
  });
  document.querySelectorAll('[data-melt]').forEach(el => {
    el.onclick = () => {
      const uid = parseInt(el.dataset.melt, 10);
      const e = S.bag.find(x => x.uid === uid);
      if (!e) return;
      const gain = meltValue(e);
      openDialog(`
        <h3>熔解 ${equipFullName(e)}</h3>
        <p>把它倒回纸浆，换 <b>${gain}</b> 书页。身上穿的、平级的、更好的都不会被波及。</p>
        <div class="dialog-acts">
          <button class="btn ghost" onclick="closeDialog();openEquip()">算了</button>
          <button class="btn gold" id="ok-melt">熔掉</button>
        </div>`);
      const ok = $('#ok-melt');
      if (ok) ok.onclick = () => {
        meltEquip(uid);
        toast(`熔解 · 书页 +${gain}`);
        dirty.shelf = 1; save(); renderAll(); openEquip();
      };
    };
  });
  const dm = $('#do-melt');
  if (dm) dm.onclick = () => {
    const list = meltPlan().map(e => e.uid);
    const gain = list.reduce((s, uid) => s + meltValue(S.bag.find(x => x.uid === uid)), 0);
    const byQ = {};
    list.forEach(uid => { const e = S.bag.find(x => x.uid === uid); if (e) byQ[e.q] = (byQ[e.q] || 0) + 1; });
    const brk = Object.keys(byQ).sort((a, b) => b - a).map(q =>
      `<span class="af">${QUALITIES[q].grade} ×${byQ[q]}</span>`).join('');
    openDialog(`
      <h3>熔解 ${list.length} 件冗余装备</h3>
      <div class="eq-af" style="margin-bottom:8px">${brk}</div>
      <p>这批是<b>比身上穿的差</b>、或者<b>已经封顶、合成也升不动</b>的装备，熔掉换 <b>${fmt(gain)}</b> 书页。</p>
      <p class="hint">更好的、还能凑三合一同档装备、以及还空着的槽位，一件都不会动。</p>
      <div class="dialog-acts">
        <button class="btn ghost" onclick="closeDialog();openEquip()">算了</button>
        <button class="btn gold" id="ok-melt-all">确认熔掉 ${list.length} 件</button>
      </div>`);
    const ok = $('#ok-melt-all');
    if (ok) ok.onclick = () => {
      let g = 0;
      list.forEach(uid => { g += meltEquip(uid); });
      toast(`熔解 ${list.length} 件 · 书页 +${fmt(g)}`);
      dirty.shelf = 1; save(); renderAll(); openEquip();
    };
  };
  const dc = $('#do-craft');
  if (dc) dc.onclick = () => {
    const out = craftEquip(craftSel[0], craftSel[1], craftSel[2]);
    craftSel = [];
    if (!out) { toast('合成失败'); return; }
    toast(`合成成功 · ${equipFullName(out)}`);
    save(); renderAll(); openEquip();
  };
}

function openCraft() {
  const rows = RECIPES.map(r => {
    const A = bookById(r.a), Bk = bookById(r.b);
    const ha = !!S.books[r.a], hb = !!S.books[r.b];
    const la = ha ? S.books[r.a].lv : 0, lb = hb ? S.books[r.b].lv : 0;
    const ok = ha && hb && la >= r.lv && lb >= r.lv;
    return `<div class="recipe ${ok ? 'ok' : 'no'}">
      <div class="ri">${A.emoji}${Bk.emoji}</div>
      <div class="rt"><b>${A.name} + ${Bk.name}</b> → ${bookById(r.out).name}<br>
      要求：两本均 Lv${r.lv}　当前：${la} / ${lb}</div>
      <button class="mini ${ok ? 'gold' : ''}" data-craft="${r.id}" ${ok ? '' : 'disabled'}>合成</button>
    </div>`;
  }).join('');

  openDialog(`
    <h3>合成台</h3>
    <p>知识的威力来自连接。两本书满级之后，可以长出一本新的。</p>
    ${rows}
    <p style="margin-top:14px;font-size:11.5px;color:#6f6557">合成有极小概率产出一本不属于任何学派的书。别问为什么。</p>
    <div class="dialog-acts">
      <button class="btn ghost" onclick="tryRandom()">随便试试</button>
      <button class="btn" onclick="closeDialog()">关闭</button>
    </div>
  `);
  document.querySelectorAll('[data-craft]').forEach(el => {
    el.onclick = () => {
      const r = RECIPES.find(x => x.id === el.dataset.craft);
      if (!r) return;
      if (S.books[r.out]) { toast('这本你已经有了'); return; }
      addBook(r.out);
      toast(`合成成功 · ${bookById(r.out).name}`);
      dirty.shelf = 1; dirty.desk = 1;
      save(); renderShelf(); renderDesk(); closeDialog();
    };
  });
}

function tryRandom() {
  if (S.books.mugou) { toast('那本书已经在书架上了'); return; }
  if (Math.random() < EASTER_EGG_CHANCE) {
    addBook('mugou');
    openDialog(`
      <h3>合成失败……但它出现了</h3>
      <div class="quote">"老师，这本书是生物系的。"</div>
      <p style="margin:0">一堆无用的纸浆里，掉出一本封面被猪蹄踩过的手册。它已经自己走上书架了。</p>
      <div class="dialog-acts"><button class="btn gold" onclick="closeDialog()">……好吧</button></div>
    `);
    dirty.shelf = 1; save(); renderShelf();
  } else {
    const loss = Math.floor(30 + Math.random() * 60);
    S.page = Math.max(0, S.page - loss);
    toast(`合成失败，烧掉 ${loss} 书页`);
    closeDialog();
  }
}

function openPrestige() {
  const g = prestigeGain();
  const P = stats();
  openDialog(`
    <h3>范式转移</h3>
    <p>当你对世界的解释方式发生根本改变，旧的知识并没有消失，只是被重新排列了。</p>
    <div class="card-box">
      <div class="ct">结算</div>
      <div class="cd">
        本纪元累计洞见：<b>${fmt(S.eraInsight)}</b><br>
        可获得范式：<b style="color:#e8c765">${g} 点</b>（每点全局 ×${(1 + PARA_BONUS).toFixed(3)}，复利）<br>
        当前累计：<b>${S.paradigm}</b> 点 · 总加成 ×${fmtMul(P.paraMul)}<br>
        转移后：洞见与书籍等级清零，书页保留一半，已解锁的书与品质保留。
      </div>
    </div>
    <p style="margin:0;font-size:11.5px;color:#6f6557">敌人每纪元 ×${ERA_MULT}；一次转生拿满约 ${PRESTIGE_CAP} 点（×${fmtMul(Math.pow(1 + PARA_BONUS, PRESTIGE_CAP))}），够抵消约 ${(Math.log(Math.pow(1 + PARA_BONUS, PRESTIGE_CAP)) / Math.log(ERA_MULT)).toFixed(1)} 个纪元。攒够能打穿的量再转，比频繁转更划算。</p>
    <div class="dialog-acts">
      <button class="btn ghost" onclick="closeDialog()">再等等</button>
      <button class="btn gold" onclick="doPrestige()" ${g < 1 ? 'disabled' : ''}>${g < 1 ? '还差一点' : '确认转移'}</button>
    </div>
  `);
}

/* ---------------- 主循环 ---------------- */
function frame(now) {
  try { frameBody(now); } catch (e) { console.error('[frame]', e); }
  requestAnimationFrame(frame);
}
const BATTLE_STEP = 0.05;

function frameBody(now) {
  let real = (now - lastFrame) / 1000;
  lastFrame = now;
  if (real > 0.25) real = 0.25;

  const dt = real * (S.speed || 1);

  accrue();
  autoUpgradeTick(dt);
  if (B && !B.over) {
    let remain = dt, guard = 0;
    while (remain > 0.0001 && B && !B.over && guard++ < 80) {
      const step = Math.min(BATTLE_STEP, remain);
      updateBattle(step);
      remain -= step;
    }
  }

  renderResources();
  renderMap();
  renderDesk();
  renderBattle(false);

  uiClock += dt;
  if (uiClock > 0.4) { uiClock = 0; refreshAffordability(); renderShelf(); renderBreakdown(); }
}

/* ---------------- 天赋 ---------------- */
function talentCostOf(t, lv) {
  return t.cat === 'spec' ? specCost(t, lv) : t.cost;
}

function openTalents() {
  const free = paraFree();
  const chosen = specChosen();
  const rowHtml = (t) => {
    const lv = tal(t.id);
    const maxed = lv >= t.max;
    const locked = t.cat === 'spec' && chosen && chosen !== t.id;
    const cost = talentCostOf(t, lv);
    const can = !maxed && !locked && free >= cost;
    const tag = t.cat === 'spec'
      ? `<i class="tal-spec">专精 · 三选一</i>` : (t.cat === 'adv' ? `<i class="tal-spec">进阶</i>` : '');
    return `<div class="tal-row ${lv ? 'on' : ''}${locked ? ' locked' : ''}">
      <span class="lv">${lv}/${t.max}</span>
      <span class="tt"><b>${t.name}</b>　${t.desc}${maxed ? '' : ` <i>· ${cost} 点</i>`}${tag}
        ${locked ? `<i class="tal-warn">已选「${(TALENTS.find(x => x.id === chosen) || {}).name}」，这条锁死</i>` : ''}</span>
      <button class="mini ${can ? 'gold' : ''}" data-tal="${t.id}" ${can ? '' : 'disabled'}>${maxed ? '已满' : '学习'}</button>
    </div>`;
  };
  const sec = (cat, title, note) => {
    const list = TALENTS.filter(t => t.cat === cat);
    if (!list.length) return '';
    return `<div class="tal-sec">${title}${note ? `<i>${note}</i>` : ''}</div>` + list.map(rowHtml).join('');
  };
  const rows = sec('base', '基础', '')
    + sec('adv', '进阶', '数值线，想偏科就偏科')
    + sec('spec', '专精', '三选一且互斥 —— 范式主要的去处');

  const toggles = [
    hasTalent('autoUp') ? `<label class="switch" style="margin-right:14px"><input type="checkbox" id="sw-up" ${S.auto.up ? 'checked' : ''}><span>自动升级</span></label>` : '',
    hasTalent('autoDesk') ? `<label class="switch"><input type="checkbox" id="sw-desk" ${S.auto.desk ? 'checked' : ''}><span>自动换书</span></label>` : '',
  ].join('');

  openDialog(`
    <h3>天赋 · ${eraName(S.era)}</h3>
    <p>可用范式 <b style="color:#e8c765">${free}</b> 点　累计 ${S.paradigm} 点　敌人强度 ×${eraScale(S.era).toFixed(1)}</p>
    ${rows}
    ${toggles ? `<div style="display:flex;align-items:center;margin-top:12px">${toggles}</div>` : ''}
    <p style="margin:10px 0 0;font-size:11px;color:#6f6557">范式每点让全局产出与攻击 ×${(1 + PARA_BONUS).toFixed(2)}（复利累计），花在天赋上不会减少这部分。</p>
    ${free >= 120 ? `<p style="margin:6px 0 0;font-size:11px;color:#c98d76">
      范式还剩 <b>${free}</b> 点没处花？去<b>「研究所」</b>立个课题 —— 那才是范式真正的去处。</p>` : ''}
    <div class="dialog-acts"><button class="btn gold" onclick="closeDialog()">关闭</button></div>
  `);

  document.querySelectorAll('[data-tal]').forEach(el => {
    el.onclick = () => {
      const t = TALENTS.find(x => x.id === el.dataset.tal);
      if (!t) return;
      const lv = tal(t.id);
      if (lv >= t.max) return;
      /* 专精互斥：已经选了别的流派就不能点这条 */
      if (t.cat === 'spec') {
        const cur = specChosen();
        if (cur && cur !== t.id) return;
      }
      const cost = talentCostOf(t, lv);
      if (paraFree() < cost) return;
      S.spent = (S.spent || 0) + cost;
      S.talents[t.id] = lv + 1;
      toast(`学会 ${t.name} Lv${S.talents[t.id]}`);
      save();
      openTalents();
      renderAll();
    };
  });

  const swUp = $('#sw-up');
  if (swUp) swUp.onchange = (e) => { S.auto.up = e.target.checked; save(); };
  const swDesk = $('#sw-desk');
  if (swDesk) swDesk.onchange = (e) => { S.auto.desk = e.target.checked; save(); };
}

/* ---------------- 研究所 ---------------- */
function openResearch() {
  const free = paraFree();
  const actN = (S.research.active || []).length;
  const doneN = (S.research.done || []).length;
  const card = (r, state) => {
    const p = researchProgress(r);
    const pct = Math.max(0, Math.min(1, p.got / p.need));
    const rwTxt = Object.keys(r.reward)
      .map(k => (RESEARCH_REWARD_TEXT[k] || (() => ''))(r.reward[k])).filter(Boolean).join('、');
    const needTxt = (RESEARCH_NEED_TEXT[r.need.t] || (() => ''))(r.need);
    let act = '';
    if (state === 'done') act = '<i class="rs-done">已结题</i>';
    else if (state === 'active') act = '<i class="rs-run">进行中</i>';
    else if (actN >= RESEARCH_SLOTS) act = '<i class="rs-warn">同时进行已满</i>';
    else if (free < r.cost) act = `<button class="mini" disabled>需 ${r.cost} 点</button>`;
    else act = `<button class="mini gold" data-rs="${r.id}">立项 · ${r.cost} 点</button>`;
    return `<div class="rs-item ${state}">
      <div class="rs-hd"><b>${r.name}</b><span class="rs-tier">${RESEARCH_TIER_NAME[r.tier]}</span>${act}</div>
      <div class="rs-line">${r.line}</div>
      <div class="rs-need">条件：${needTxt}
        <span class="rs-bar"><i style="width:${(pct * 100).toFixed(0)}%"></i></span>
        <b>${p.got} / ${p.need}</b></div>
      <div class="rs-rw">结论：${rwTxt}</div>
    </div>`;
  };
  const list = RESEARCH.map(r => {
    const st = researchDone(r.id) ? 'done' : (researchActive(r.id) ? 'active' : 'open');
    return card(r, st);
  }).join('');

  openDialog(`
    <h3>研究所 · ${doneN} / ${RESEARCH.length} 已结题</h3>
    <p>可用范式 <b style="color:#e8c765">${free}</b> 点　同时进行 ${actN} / ${RESEARCH_SLOTS}。
       立项花范式，条件达成自动结题，结论<b>永久生效</b>。</p>
    <div class="rs-list">${list}</div>
    <div class="dialog-acts"><button class="btn gold" onclick="closeDialog()">关闭</button></div>
  `);

  document.querySelectorAll('[data-rs]').forEach(el => {
    el.onclick = () => {
      const r = RESEARCH.find(x => x.id === el.dataset.rs);
      if (!r) return;
      if ((S.research.active || []).length >= RESEARCH_SLOTS) { toast('同时进行的课题已满'); return; }
      if (paraFree() < r.cost) { toast('范式不够'); return; }
      S.spent = (S.spent || 0) + r.cost;
      S.research.active.push(r.id);
      toast(`立项 · ${r.name}`);
      save();
      checkResearch();      /* 有可能立项即达成，直接结掉 */
      openResearch();
      renderAll();
    };
  });
}

/* ---------------- 自动化 ---------------- */
let autoClock = 0;

function autoUpgradeTick(dt) {
  if (!hasTalent('autoUp') || (S.auto && S.auto.up === false)) return;
  autoClock += dt;
  if (autoClock < 0.6) return;
  autoClock = 0;
  let best = null;
  for (const id in S.books) {
    const st = S.books[id];
    const q = qOf(st.q);
    if (st.lv >= q.cap) continue;
    const c = upgradeCost(st.lv);
    if (S.insight >= c && (!best || c < best.c)) best = { id, c };
  }
  if (!best) return;
  S.insight -= best.c;
  S.books[best.id].lv++;
  dirty.shelf = 1;
  dirty.desk = 1;
}

/* 按「单次伤害 × 相性」给技能书打分，取前 N 本 */
function autoArrangeDesk() {
  if (!hasTalent('autoDesk') || (S.auto && S.auto.desk === false)) return;
  if (!B) return;
  const st = B.st;
  /* 与「阵容建议」共用同一套算法：自动换书也会主动凑组合，而不是只按相性排 */
  const r = suggestLineup();
  if (!r.picks.length) return;
  const n = deskSlots();
  const next = new Array(n).fill(null);
  r.picks.forEach((id, i) => { if (i < n) next[i] = id; });
  S.desk = next;
  dirty.desk = 1;
}

/* 理念之神入口 */
function renderGodbar() {
  const el = $('#godbar');
  if (!el) return;
  const total = SCHOOLS.length * STAGES_PER_SCHOOL;
  if (S.maxStage >= total) {
    el.hidden = false;
    el.innerHTML = `<span class="gname">理念之神 · 第 ${(S.godKills || 0) + 1} 形态</span>
      <button class="mini gold" onclick="startGod()">挑战</button>`;
  } else {
    el.hidden = true;
  }
}

function startGod() {
  closeDialog();
  startBattle(-1);
}

/* ---- 周常世界 BOSS 入口 ---- */
function startWorld() {
  closeDialog();
  ensureWorldWeek();
  if ((S.maxStage || 0) < WORLD_BOSS.unlockStage) { toast('通关第一个学派之后，遗忘才会注意到你'); return; }
  if (S.world.cleared) { toast('本周的遗忘已经被击退了'); return; }
  if (S.world.tries <= 0) { toast('本周的挑战次数用完了，下周再来'); return; }
  S.world.tries -= 1;
  save();
  /* 开打前拉一次全服进度，进度条才不会显示上周的旧数 */
  if (window.Net && window.Net.online) {
    window.Net.fetchWorld(S.world.week).then(d => {
      if (!d) return;
      S.world.total = d.total || 0;
      S.world.goal = d.goal || 0;
      S.world.players = d.players || 0;
      renderWorldbar();
    });
  }
  startBattle(-2);
}

/* ---- 全服世界 BOSS：进度与里程碑 ----
   全服目标是「每个参与者的单人目标之和」：一个人玩，目标就是自己能打完的量；
   人越多目标越大。这样进度条在任何人数下都有意义，也不会出现"人少永远打不完"。 */
const WORLD_MILESTONES = [
  { at: 0.25, page: 0.6, label: '四分之一' },
  { at: 0.50, page: 1.2, label: '过半' },
  { at: 0.75, page: 1.8, label: '四分之三' },
  { at: 1.00, page: 3.0, label: '击穿' },
];

/* 战斗结束把本场对遗忘造成的伤害上报；离线时只累加本地 */
function pushWorldDamage(st) {
  if (!st || st.idx !== -2 || !B) return;
  const dmg = Math.max(0, Math.round(B.maxHp - Math.max(0, B.hp)));
  if (dmg <= 0) return;
  S.world.dmg = (S.world.dmg || 0) + dmg;
  /* 单人目标 = 本周全部次数都打空 */
  const goal = Math.round(B.maxHp * WORLD_BOSS.triesPerWeek);
  if (window.Net && window.Net.online) {
    window.Net.reportWorld(S.world.week, dmg, goal).then(d => {
      if (!d) return;
      S.world.total = d.total || 0;
      S.world.goal = d.goal || 0;
      S.world.players = d.players || 0;
      checkWorldMilestones();
      renderWorldbar();
      save();
    });
  } else {
    S.world.total = (S.world.total || 0) + dmg;
    S.world.goal = Math.max(S.world.goal || 0, goal);
    S.world.players = Math.max(1, S.world.players || 1);
    checkWorldMilestones();
    renderWorldbar();
  }
}

/* 全服进度达到 25/50/75/100% 时，每个参与者每周各领一次 */
function checkWorldMilestones() {
  const total = S.world.total || 0, goal = S.world.goal || 0;
  if (goal <= 0) return;
  const p = total / goal;
  S.world.milestones = S.world.milestones || [];
  WORLD_MILESTONES.forEach((m, i) => {
    if (p < m.at || S.world.milestones.includes(i)) return;
    S.world.milestones.push(i);
    const gain = Math.round(PAGE_DROP.boss * m.page * (1 + (S.maxStage || 0) * 0.02));
    S.page += gain;
    const last = i === WORLD_MILESTONES.length - 1;
    if (last && !S.world.milestoneBonus) {
      S.world.milestoneBonus = true;
      S.memory = (S.memory || 0) + 1;
    }
    logLine(`🌍 全服进度 ${Math.round(m.at * 100)}%（${m.label}）：书页 +${fmt(gain)}`
      + (last ? ' · 记忆强化 +1' : ''), 'lg-skill');
    setTimeout(() => toast(`🌍 全服进度 ${Math.round(m.at * 100)}% · 书页 +${fmt(gain)}`), 600);
  });
}

/* ---- 战斗干预：点战斗区积士气，满 10 点让全队技能冷却 -1 秒 ---- */
let moraleTimer = null;

function interveneTap() {
  if (!B || B.over) return;
  const capSec = Math.round((B.limit || 45) * MORALE_CAP_RATIO);
  const used = B.interveneUsed || 0;
  B.morale = (B.morale || 0) + 1;
  if (B.morale >= MORALE_NEED) {
    if (used >= capSec) {          /* 到上限：不再给收益，但士气条保持在满格 */
      B.morale = MORALE_NEED;
      renderMorale();
      return;
    }
    B.morale -= MORALE_NEED;
    B.interveneUsed = used + 1;
    /* 全队冷却同时 -1 秒 */
    Object.keys(B.cds || {}).forEach(k => { B.cds[k] = Math.max(0, B.cds[k] - 1); });
    floatText('士气 · CD -1s', 'good');
    logLine(`🔥 士气：全队技能冷却 -1 秒（${B.interveneUsed}/${capSec}）`, 'lg-skill');
    dirty.cds = 1;
  }
  renderMorale();
}

function renderMorale() {
  const el = $('#morale');
  if (!el) return;
  if (!B || B.over) { el.hidden = true; return; }
  el.hidden = false;
  const cur = Math.min(MORALE_NEED, B.morale || 0);
  const capSec = Math.round((B.limit || 45) * MORALE_CAP_RATIO);
  const used = B.interveneUsed || 0;
  const full = used >= capSec;
  const fill = $('#morale-fill');
  if (fill) fill.style.width = (cur / MORALE_NEED * 100) + '%';
  const tip = $('#morale-tip');
  if (tip) tip.textContent = full
    ? `手动收益已达上限 ${used}/${capSec}`
    : `${cur}/${MORALE_NEED}　已加速 ${used}/${capSec} 秒`;
  el.classList.toggle('full', full);
}

/* pointerdown 连续触发 + 长按自动连发（按要求不做 0.5 秒节流） */
function initIntervene() {
  const el = $('#arena');
  if (!el || el._ivBound) return;
  el._ivBound = true;
  el.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('button')) return;
    if (ev.target.closest('#self-panel')) return;   /* 角色面板是"看属性"，不积士气 */
    interveneTap();
    if (moraleTimer) clearInterval(moraleTimer);
    moraleTimer = setInterval(interveneTap, MORALE_TAP_MS);
    const stop = () => {
      if (moraleTimer) { clearInterval(moraleTimer); moraleTimer = null; }
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  });
}

/* ---- 深渊入口 ---- */
function startAbyss() {
  closeDialog();
  S.abyssDepth = Math.max(1, S.abyssDepth || 1);
  startBattle(-3);
}

function renderAbyssbar() {
  const el = $('#abyssbar');
  if (!el) return;
  const total = SCHOOLS.length * STAGES_PER_SCHOOL;
  if ((S.maxStage || 0) < total) { el.hidden = true; return; }
  el.hidden = false;
  const d = S.abyssDepth || 1;
  el.innerHTML = `<span class="gname">🕳️ 深渊 · 第 ${d} 层</span>
    <span class="wnote">每层 ×${ABYSS.growth} · 每 ${ABYSS.eliteEvery} 层守门者 · 已到 ${d - 1} 层</span>
    <button class="mini gold" onclick="startAbyss()">深入</button>`;
}

function renderWorldbar() {
  const el = $('#worldbar');
  if (!el) return;
  if ((S.maxStage || 0) < WORLD_BOSS.unlockStage) { el.hidden = true; return; }
  ensureWorldWeek();
  el.hidden = false;
  const w = S.world;
  const memPct = Math.min(WORLD_BOSS.memoryCap, S.memory || 0);
  const total = w.total || 0, goal = w.goal || 0;
  const p = goal > 0 ? Math.min(1, total / goal) : 0;
  el.innerHTML = `<span class="gname">🕳️ 遗忘 · 世界 BOSS</span>
    <span class="wnote">${w.cleared ? '本周已击退' : `剩余 ${w.tries} 次`} · 记忆 +${memPct}%</span>
    ${goal > 0
      ? `<span class="wbar" title="全服共同削减 ${fmt(total)} / ${fmt(goal)}"><i style="width:${(p * 100).toFixed(1)}%"></i></span>
         <span class="wpct">${w.players || 1} 人 · ${Math.round(p * 100)}%</span>`
      : ''}
    ${w.cleared ? '' : `<button class="mini gold" onclick="startWorld()">挑战</button>`}`;
}

/* ---------------- 开发者面板（?dev=1 开启） ---------------- */
function devExport() {
  try { return btoa(encodeURIComponent(JSON.stringify(S))); } catch (e) { return ''; }
}

function devImport(code) {
  try {
    const d = JSON.parse(decodeURIComponent(atob(String(code).trim())));
    if (!d || !d.books) throw new Error('bad');
    S = Object.assign(defaultState(), d);
    if (!Array.isArray(S.desk)) S.desk = new Array(DESK_SLOTS).fill(null);
    while (S.desk.length < DESK_SLOTS) S.desk.push(null);
    if (!Array.isArray(S.unlocked) || !S.unlocked.length) S.unlocked = ['mechanics'];
    if (!S.era) S.era = 1;
    if (!S.talents) S.talents = {};
    if (typeof S.spent !== 'number') S.spent = 0;
    if (!S.auto) S.auto = { up: true, desk: true };
    if (typeof S.godKills !== 'number') S.godKills = 0;
    if (!S.ach || typeof S.ach !== 'object') S.ach = {};
    if (typeof S.offlineCount !== 'number') S.offlineCount = 0;
    if (typeof S.seenIntro !== 'boolean') S.seenIntro = false;
    if (!S.stageTries || typeof S.stageTries !== 'object') S.stageTries = {};
    if (!Array.isArray(S.debunk)) S.debunk = [];
    if (!S.world || typeof S.world !== 'object') S.world = { week: '', tries: 0, cleared: false, dmg: 0, total: 0, goal: 0, players: 0, milestones: [] };
    /* 全服进度（v7）：旧档补齐，不覆盖已有值 */
    if (typeof S.world.total !== 'number') S.world.total = 0;
    if (typeof S.world.goal !== 'number') S.world.goal = 0;
    if (typeof S.world.players !== 'number') S.world.players = 0;
    if (!Array.isArray(S.world.milestones)) S.world.milestones = [];
    if (typeof S.abyssDepth !== 'number' || S.abyssDepth < 1) S.abyssDepth = 1;
    if (typeof S.memory !== 'number') S.memory = 0;
    B = null;
    dirty.map = dirty.desk = dirty.shelf = 1;
    renderAll();
    startBattle(S.stage);
    save();
    return true;
  } catch (e) { return false; }
}

function devJump(n) {
  const total = SCHOOLS.length * STAGES_PER_SCHOOL;
  const v = Math.max(0, Math.min(total - 1, Math.floor(n) || 0));
  S.stage = v;
  S.maxStage = Math.max(S.maxStage, v);
  dirty.map = 1;
  startBattle(v);
  save();
}

function openDev() {
  const total = SCHOOLS.length * STAGES_PER_SCHOOL;
  openDialog(`
    <h3>开发者面板</h3>
    <p style="margin-bottom:14px">只动本地存档。改完代码刷新后，用下面的存档码把进度搬回来，不用从头打。</p>

    <span class="dev-label">跳到关卡（0 – ${total - 1}，当前 ${S.stage}）</span>
    <div class="dev-row">
      <input id="dev-stage" type="number" min="0" max="${total - 1}" value="${S.stage}">
      <button class="btn sm" id="dev-jump">跳转</button>
      <button class="btn sm" id="dev-boss">跳 Boss</button>
    </div>

    <div class="dev-grid">
      <button class="btn sm" id="dev-unlock">解锁全部学派</button>
      <button class="btn sm" id="dev-max">书籍全满</button>
      <button class="btn sm" id="dev-insight">洞见 +10 万</button>
      <button class="btn sm" id="dev-page">书页 +5000</button>
      <button class="btn sm" id="dev-para">范式 +10</button>
      <button class="btn sm" id="dev-allbooks">解锁全部书</button>
      <button class="btn sm" id="dev-talents">解锁全部天赋</button>
      <button class="btn sm" id="dev-unit">召唤测试机关</button>
    </div>

    <span class="dev-label">存档码 —— 换浏览器、换端口、清缓存前先复制这串</span>
    <textarea class="dev-code" id="dev-code">${devExport()}</textarea>
    <div class="dev-row" style="margin-top:8px">
      <button class="btn sm" id="dev-copy">复制</button>
      <button class="btn sm" id="dev-load">用这段文本导入</button>
      <button class="btn sm ghost" id="dev-reset">清档重开</button>
    </div>
    <p style="margin:8px 0 0;font-size:11px"><a href="#" id="dev-off" style="color:#6f6557">退出开发者模式</a></p>

    <div class="dialog-acts"><button class="btn gold" onclick="closeDialog()">关闭</button></div>
  `);

  const refresh = () => { dirty.map = dirty.desk = dirty.shelf = 1; renderAll(); save(); };

  $('#dev-jump').onclick = () => { devJump(parseInt($('#dev-stage').value, 10)); closeDialog(); refresh(); };
  $('#dev-boss').onclick = () => {
    let g = S.stage;
    while (g < total - 1 && stageData(g).i !== 7) g++;
    devJump(g); closeDialog(); refresh();
  };
  $('#dev-unlock').onclick = () => { S.unlocked = SCHOOLS.map(x => x.id); toast('全部学派已解锁'); refresh(); };
  $('#dev-talents').onclick = () => {
    /* 测试用：把天赋表全部点到 1，自动换书/自动升级立刻可用 */
    TALENTS.forEach(t => { if (!S.talents[t.id]) S.talents[t.id] = 1; });
    S.spent = 0;
    toast('全部天赋已解锁（自动换书可用）');
    dirty.map = dirty.shelf = dirty.desk = 1;
    refresh();
  };
  $('#dev-max').onclick = () => {
    Object.keys(S.books).forEach(id => { S.books[id].lv = qOf(S.books[id].q).cap; });
    toast('已拥有书籍已升到当前品质上限');
    refresh();
  };
  $('#dev-allbooks').onclick = () => {
    BOOKS.forEach(b => { if (!S.books[b.id]) S.books[b.id] = { lv: b.q === 2 ? 60 : 1, q: b.q || 0 }; });
    toast(`已解锁全部 ${BOOKS.length} 本书`);
    refresh();
  };
  /* P0 地基验证用：立刻在场上放一个测试机关（不占书桌，方便看承伤/血量/反伤） */
  $('#dev-unit').onclick = () => {
    if (!B || B.over) { toast('当前没有进行中的战斗'); return; }
    if (!B.units) B.units = [];
    if (unitAlive().length >= UNIT_LIMIT) { toast('已达单位上限'); return; }
    const maxHp = Math.max(1, Math.round(B.maxPhp * UNIT_TYPES.guard.hpRatio));
    B.units.push({
      uid: (B.unitUid = (B.unitUid || 0) + 1), id: 'dev', name: '测试机关',
      icon: UNIT_TYPES.guard.icon, kind: 'guard',
      hp: maxHp, maxHp, atk: stats().atk * 0.6, interval: 2, tick: 0, until: 999, burst: 0.8,
    });
    toast('已召唤测试机关（守护型）');
    renderUnits();
  };
  $('#dev-insight').onclick = () => { S.insight += 100000; S.eraInsight += 100000; toast('洞见 +100000'); refresh(); };
  $('#dev-page').onclick = () => { S.page += 5000; toast('书页 +5000'); refresh(); };
  $('#dev-para').onclick = () => { S.paradigm += 10; toast('范式 +10'); refresh(); };
  $('#dev-copy').onclick = () => {
    const el = $('#dev-code');
    el.select();
    try {
      navigator.clipboard.writeText(el.value);
      toast('已复制存档码');
    } catch (e) {
      document.execCommand && document.execCommand('copy');
      toast('已选中，按 Ctrl+C 复制');
    }
  };
  $('#dev-load').onclick = () => {
    if (devImport($('#dev-code').value)) { closeDialog(); toast('存档已导入'); }
    else toast('存档码无效');
  };
  $('#dev-off').onclick = (e) => {
    e.preventDefault();
    try { localStorage.removeItem('sa_dev'); } catch (err) {}
    location.reload();
  };
  $('#dev-reset').onclick = () => {
    if (!confirm('清空本地存档并重开？此操作不可撤销。')) return;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    location.reload();
  };
}

/* ---------------- 启动 ---------------- */
function boot() {
  const had = load();
  if (!had) { S = defaultState(); }
  lastAccrue = Date.now();

  /* 周常世界 BOSS：跨周自动重置（记忆强化永久保留） */
  if (ensureWorldWeek()) {
    setTimeout(() => toast('🕳️ 新的一周：遗忘又出现了'), 1200);
  }

  /* 印记：先清掉已失效的，再在「玩家还没动过」时自动装满 */
  pruneConceptRules();
  autoFillConceptRules();
  let offlineRep = null;
  if (had) offlineRep = applyOffline();
  /* 全新玩家：先把这个世界是什么讲清楚，再让他上手 */
  if (!had) setTimeout(() => showIntro(), 900);
  if (S.migrateNote) {
    const note = S.migrateNote;
    delete S.migrateNote;
    setTimeout(() => toast(note, 6000), 400);
    save();
  }
  if (offlineRep) setTimeout(() => showOfflineReport(offlineRep), 900);

  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t) return;
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    shelfTab = t.dataset.tab;
    dirty.shelf = 1;
    renderShelf();
  });

  $('#auto-advance').checked = !!S.autoAdvance;
  $('#auto-advance').addEventListener('change', e => { S.autoAdvance = e.target.checked; save(); });

  document.querySelectorAll('#speed .sp').forEach(b => {
    b.onclick = () => setSpeed(parseFloat(b.dataset.sp));
  });

  const devOn = /[?&]dev=1/.test(location.search) || localStorage.getItem('sa_dev') === '1';
  if (devOn) {
    try { localStorage.setItem('sa_dev', '1'); } catch (e) {}
    const db = $('#devbtn');
    db.hidden = false;
    db.onclick = openDev;
  }

  $('#auto-up-sw').onchange = (e) => { S.auto.up = e.target.checked; save(); };
  $('#auto-desk-sw').onchange = (e) => { S.auto.desk = e.target.checked; save(); };
  $('#btn-talent').onclick = openTalents;
  $('#btn-stats').onclick = openStats;
  $('#btn-research').onclick = openResearch;
  $('#btn-craft').onclick = openCraft;
  $('#btn-equip').onclick = openEquip;
  $('#btn-codex').onclick = () => openCodex();
  $('#btn-lineup').onclick = openLineup;
  $('#btn-prestige').onclick = openPrestige;
  initIntervene();
  /* 战斗区「你 · 学者」面板：点一下看属性明细 */
  const sp = $('#self-panel');
  if (sp) {
    sp.style.cursor = 'pointer';
    sp.title = '点击查看属性明细';
    sp.onclick = (ev) => { ev.stopPropagation(); openStats(); };
  }
  const sp2 = $('#btn-stats2');
  if (sp2) sp2.onclick = (ev) => { ev.stopPropagation(); openStats(); };
  $('#btn-account').onclick = () => {
    if (window.Net) { window.Net.open(); return; }
    /* 离线模式（file://）：net.js 根本没加载，这里给一个纯本地的存档码导出 */
    const el = $('#net-state'); if (el) el.textContent = '离线';
    openDialog(offlineAccountDialog());
  };
  /* net.js 在 file:// 下不启用，这里把按钮标注成"离线"，避免误以为能登录 */
  if (!window.Net) { const el = $('#net-state'); if (el) el.textContent = '离线'; }
  /* 云存档初始化：file:// 下 net.js 不会启用，这里也就什么都不做 */
  window.S = S;
  if (window.Net) window.Net.init();
  $('#btn-retry').onclick = () => startBattle(S.stage);
  $('#btn-retreat').onclick = () => {
    if (S.stage > 0) { S.stage--; dirty.map = 1; startBattle(S.stage); save(); }
  };
  $('#mask').addEventListener('click', e => {
    if (e.target.id !== 'mask') return;
    if (pendingAdvance !== null) victoryContinue();
    else closeDialog();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    else { lastAccrue = Date.now() - 1000; }
  });
  window.addEventListener('beforeunload', save);
  setInterval(() => { accrue(); save(); checkAchievements(); }, 5000);

  if (!S.desk.some(Boolean)) {
    const firstSkill = Object.keys(S.books).find(id => bookById(id) && bookById(id).type === 'skill');
    if (firstSkill) S.desk[0] = firstSkill;
  }

  setSpeed(S.speed || 1, true);
  renderAll();
  checkAchievements();
  updateCodexDot();
  startBattle(S.stage);
  requestAnimationFrame(frame);

  if (!had && !location.search.includes('nodlg')) {
    setTimeout(() => openDialog(`
      <h3>你在一间书房里醒来</h3>
      <div class="quote">桌上只有一本没有书名的册子。<br>第一页写着："你什么都不知道。"<br>第二页写着："所以你可以知道一切。"</div>
      <p style="margin:0">书会自己读出洞见。洞见用来把书读得更深。<br>但真正的知识，要去学派那里抢——他们不会同意你。</p>
      <div class="dialog-acts"><button class="btn gold" onclick="closeDialog()">翻开它</button></div>
    `), 400);
  }
}

window.addEventListener('DOMContentLoaded', boot);
