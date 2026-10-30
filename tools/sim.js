/* 数值模拟器：验证每个学派 8 关 × 3 轮的节奏，不参与游戏运行
   QUIET=1 只打关键节点；CAP=小时 改模拟时长上限；SCHOOLS=3 只跑前 N 个学派 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const assets = path.join(__dirname, '..', 'assets');
vm.runInThisContext(fs.readFileSync(path.join(assets, 'data.js'), 'utf8'));
vm.runInThisContext(`globalThis.D={BOOKS,QUALITIES,RECIPES,SCHOOLS,STAGES_PER_SCHOOL,DESK_SLOTS,KIND_MULT,STAGE_BASE_HP,STAGE_GROWTH,ENEMY_BASE_ATK,ENEMY_ATK_GROWTH,BATTLE_TIME,PAGE_DROP,STAGE_DROPS,TAGS,UPGRADE_BASE,UPGRADE_GROWTH,LV_ATTR_BONUS,LV_RATE_BONUS,LV_SKILL_BONUS,PRESTIGE_DIV,PARA_BONUS,AUTO_ATK_MULT,ERA_MULT,EQUIP_DROP,AFFIXES,ERA_NAMES,schoolOrder,eraScale,COUNTER,DOCTRINES,PRESTIGE_SOFT,PRESTIGE_SOFT_LOG,PRESTIGE_CAP,PARADIGM_CAP,PARADIGM_SOFT_POINTS,PARADIGM_SOFT_RATE}`);
const D = globalThis.D;
['UPGRADE_BASE','UPGRADE_GROWTH','LV_ATTR_BONUS','LV_RATE_BONUS','LV_SKILL_BONUS','STAGE_BASE_HP','STAGE_GROWTH','PRESTIGE_DIV','PARA_BONUS'].forEach(k=>{ if(process.env[k]) D[k]=parseFloat(process.env[k]); });
if(process.env.BOSS) D.KIND_MULT.boss=parseFloat(process.env.BOSS);
const QUIET = !!process.env.QUIET;
const TOTAL = D.SCHOOLS.length * D.STAGES_PER_SCHOOL;
const TIME_CAP = (parseFloat(process.env.CAP) || 4) * 3600;  /* 模拟时长上限（小时） */
/* 转生门槛。回本线（不亏）只是下限：刚好回本等于原地踏步，会无限转生。
   真实玩家会攒到明显赚一笔再转，所以默认取「回本线的 3 倍」与「单次上限的一半」中较大者 */
const BREAKEVEN = Math.ceil(Math.log(D.ERA_MULT) / Math.log(1 + D.PARA_BONUS));
/* 门槛不能高于单次上限，否则永远转不了（旧参数下确实死锁过） */
const PMIN = parseFloat(process.env.PMIN) ||
  Math.min(Math.round(D.PRESTIGE_CAP * 0.9), Math.max(BREAKEVEN, 6));
/* 真实玩家不会转生上千次：那之后 ERA_MULT^纪元 早就 Infinity 了 */
const MAXP = parseFloat(process.env.MAXP) || 30;

const bookById = id => D.BOOKS.find(b => b.id === id);
const qOf = i => D.QUALITIES[Math.max(0, Math.min(D.QUALITIES.length - 1, i))];
const upgradeCost = lv => Math.floor(D.UPGRADE_BASE * Math.pow(D.UPGRADE_GROWTH, lv - 1));

/* 与 game.js 的 stageData 对齐（含纪元缩放与学派轮转） */
function stageData(idx, era) {
  const e = era || 1;
  const si = Math.min(D.SCHOOLS.length - 1, Math.max(0, Math.floor(idx / D.STAGES_PER_SCHOOL)));
  const sch = D.schoolOrder(e)[si];
  const local = idx - si * D.STAGES_PER_SCHOOL;
  const round = Math.floor(local / 8), i = local % 8;
  const bp = sch.blueprint[i];
  const mult = sch.mult || 1;
  const es = D.eraScale(e);
  const hp = D.STAGE_BASE_HP * mult * Math.pow(D.STAGE_GROWTH, local) * D.KIND_MULT[bp.k] * es;
  const atk = D.ENEMY_BASE_ATK * Math.pow(mult, 0.75) * Math.pow(D.ENEMY_ATK_GROWTH, local) * (bp.k === 'boss' ? 1.5 : 1) * Math.pow(es, 0.75);
  return {
    idx, si, sch, local, round, i, kind: bp.k, name: bp.n,
    hp: Math.round(hp), atk: Math.round(atk * 10) / 10,
    weak: bp.weak, resist: bp.resist, doc: bp.d || sch.doctrine,
  };
}

function makeState() {
  return {
    insight: 0, page: 0, paradigm: 0, eraInsight: 0, era: 1, prestigeCount: 0,
    books: { wuming: { lv: 1, q: 0 }, luoti: { lv: 1, q: 0 } },
    desk: new Array(D.DESK_SLOTS).fill(null),
    stage: 0, t: 0,
  };
}

function stats(S) {
  const attr = { insight: 0, rigor: 0, intuition: 0, eloquence: 0 };
  let rate = 0;
  for (const id in S.books) {
    const b = bookById(id); if (!b) continue;
    const st = S.books[id], q = qOf(st.q);
    rate += b.rate * q.rate * (1 + D.LV_RATE_BONUS * (st.lv - 1));
    if (b.type === 'attr' && b.attr) for (const k in b.attr) attr[k] += b.attr[k] * (1 + D.LV_ATTR_BONUS * (st.lv - 1)) * q.rate;
  }
  const paraMul = (function(points){
    const n = Math.min(D.PARADIGM_CAP, Math.max(0, points || 0));
    const soft = D.PARADIGM_SOFT_POINTS, rate = D.PARADIGM_SOFT_RATE;
    if (n <= soft) return Math.pow(1 + D.PARA_BONUS, n);
    return Math.pow(1 + D.PARA_BONUS, soft) * Math.pow(1 + D.PARA_BONUS * rate, n - soft);
  })(S.paradigm);
  rate *= (1 + 0.1 * attr.insight) * paraMul;
  const atk = (12 + attr.rigor * 2) * paraMul;
  const hp = (120 + attr.rigor * 3) * paraMul + S.paradigm * 15;
  const crit = Math.min(0.6, attr.intuition * 0.006);
  const amp = 1 + attr.eloquence * 0.015;
  return { attr, rate, atk, hp, crit, amp, paraMul };
}

function deskSkills(S) {
  return S.desk.filter(Boolean).map(id => ({ book: bookById(id), st: S.books[id] })).filter(x => x.book && x.book.type === 'skill');
}

function skillDmg(S, P, d, st) {
  const lvF = 1 + D.LV_SKILL_BONUS * (d.st.lv - 1);
  const q = qOf(d.st.q);
  const aff = d.book.tag === st.weak ? 1.25 : (d.book.tag === st.resist ? 0.8 : 1);
  return P.atk * d.book.mult * lvF * q.skill * P.amp * aff * (1 + P.crit * 0.8);
}

function battle(S, idx) {
  const st = stageData(idx, S.era);
  const P = stats(S);
  const skills = deskSkills(S);
  let hp = st.hp, php = P.hp, t = 0, auto = 0;
  const cds = skills.map(() => 0.8);
  while (t < D.BATTLE_TIME) {
    const dt = 0.1; t += dt;
    auto += dt;
    if (auto >= 1) { auto -= 1; hp -= P.atk * D.AUTO_ATK_MULT; }
    skills.forEach((d, i) => {
      cds[i] -= dt;
      if (cds[i] <= 0) { cds[i] = d.book.cd; hp -= skillDmg(S, P, d, st); }
    });
    php -= st.atk / 1.6 * dt;
    if (hp <= 0) return { win: true, t, P, st };
    if (php <= 0) return { win: false, t, P, st };
  }
  return { win: false, t, P, st };
}

/* 贪心策略：按「伤害/CD」排序上书桌 */
function autoDesk(S) {
  const skills = Object.keys(S.books).filter(id => bookById(id).type === 'skill');
  const scored = skills.map(id => {
    const b = bookById(id), st = S.books[id], q = qOf(st.q);
    const lvF = 1 + D.LV_SKILL_BONUS * (st.lv - 1);
    return { id, score: (b.mult * lvF * q.skill) / b.cd };
  }).sort((a, b) => b.score - a.score);
  S.desk = Array.from({ length: D.DESK_SLOTS }, (_, i) => scored[i] ? scored[i].id : null);
}

function buy(S, log) {
  let bought = true;
  while (bought) {
    bought = false;
    let best = null;
    for (const id of Object.keys(S.books)) {
      const st = S.books[id], q = qOf(st.q);
      if (st.lv >= q.cap) continue;
      const c = upgradeCost(st.lv);
      if (S.insight >= c && (!best || c < best.c)) best = { id, c };
    }
    if (best) { S.insight -= best.c; S.books[best.id].lv++; bought = true; }
  }
  for (const id of Object.keys(S.books)) {
    const st = S.books[id];
    if (st.q < D.QUALITIES.length - 1) {
      const c = D.QUALITIES[st.q + 1].pageCost;
      if (S.page >= c) { S.page -= c; st.q++; log.push(`升阶 ${bookById(id).name} → ${D.QUALITIES[st.q].name} @${fmtTime(S.t)}`); }
    }
  }
}

/* 卡住且范式够了就转生 —— 不模拟就永远看不到后期内容。
   真实玩家不会一卡就转，所以要有「连续失败 N 次」+「距上次至少 30 分钟」两道闸门，
   否则范式会雪崩，模拟结果毫无意义 */
function tryPrestige(S, log) {
  const raw = Math.sqrt(Math.max(0, S.eraInsight) / D.PRESTIGE_DIV);
  let g = raw <= D.PRESTIGE_SOFT ? raw
    : D.PRESTIGE_SOFT + Math.log10(1 + (raw - D.PRESTIGE_SOFT)) * D.PRESTIGE_SOFT_LOG;
  if (!isFinite(g)) g = D.PRESTIGE_CAP;
  g = Math.floor(Math.min(D.PRESTIGE_CAP, g));
  /* 回本线：敌人每纪元 ×ERA_MULT，要抵消它需要 g ≈ (ERA_MULT-1)/PARA_BONUS 点范式。
     低于这个数转生就是净亏，会滚进死亡螺旋 */
  if (g < PMIN) return false;
  if (S.t - (S.lastPrestige || 0) < 1800) return false;
  if ((S.prestigeCount || 0) >= MAXP) return false;
  S.paradigm += g;
  S.prestigeCount = (S.prestigeCount || 0) + 1;
  S.era = (S.era || 1) + 1;
  S.insight = 0; S.eraInsight = 0;
  S.page = Math.floor(S.page * 0.5);
  for (const id in S.books) S.books[id].lv = 1;
  S.stage = 0;
  log.push(`转生 → 第 ${S.era} 纪元（范式 +${g}，累计 ${S.paradigm}）@${fmtTime(S.t)}`);
  return true;
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function grantDrops(S, idx, log) {
  const d = D.STAGE_DROPS[idx];
  if (d) d.forEach(x => {
    if (!S.books[x.id]) { S.books[x.id] = { lv: 1, q: bookById(x.id).q || 0 }; log.push(`获得《${bookById(x.id).name}》@${fmtTime(S.t)}`); }
  });
  const sch = stageData(idx, S.era).sch;
  const rare = sch && sch.rare;
  if (rare && Math.random() < rare.chance && !S.books[rare.id]) {
    S.books[rare.id] = { lv: 1, q: bookById(rare.id).q || 0 };
    log.push(`获得《${bookById(rare.id).name}》@${fmtTime(S.t)}`);
  }
}

function run() {
  const S = makeState();
  const log = [];
  const stageLog = [];
  let failStreak = 0;
  let iter = 0;
  const MAX_ITER = 40000;   /* 兜底：卡死时不要空转到天荒地老 */

  while (S.stage < TOTAL && S.t < TIME_CAP && iter++ < MAX_ITER) {
    autoDesk(S);
    const r = battle(S, S.stage);
    /* 失败时玩家不会立刻重来，会挂机攒资源 —— 只推进 0.1 秒会让模拟空转到超时 */
    const spent = r.win ? r.t : Math.max(r.t, 12);
    S.t += spent;
    S.insight += stats(S).rate * spent;
    S.eraInsight += stats(S).rate * spent;

    if (r.win) {
      const st = stageData(S.stage, S.era);
      S.page += Math.round(D.PAGE_DROP[st.kind] * (1 + 0.45 * st.round));
      grantDrops(S, S.stage, log);
      stageLog.push({ stage: S.stage, era: S.era, round: st.round, i: st.i, kind: st.kind, t: S.t, P: r.P, ehp: st.hp, sch: st.sch });
      S.stage++;
      failStreak = 0;
      autoDesk(S);
    } else {
      failStreak++;
      /* 打不过：连续卡了 8 次才考虑转生，再回头刷前一关 */
      if (failStreak >= 8 && tryPrestige(S, log)) { failStreak = 0; buy(S, log); continue; }
      const farm = Math.max(0, S.stage - 1);
      if (S.stage > 0 && Math.random() < 0.5) {
        const fr = battle(S, farm);
        S.t += fr.t;
        const fs2 = stats(S);
        S.insight += fs2.rate * fr.t; S.eraInsight += fs2.rate * fr.t;
        if (fr.win) {
          const st2 = stageData(farm, S.era);
          S.page += Math.round(D.PAGE_DROP[st2.kind] * (1 + 0.45 * st2.round));
        }
      }
    }
    buy(S, log);
    if (S.t > TIME_CAP) break;
  }

  /* 每个学派「第 1 轮 Boss」首次达成的时刻 —— 内容推进速度的核心指标 */
  const firstBoss = new Map();
  stageLog.forEach(s => {
    if (s.i === 7 && !firstBoss.has(s.sch.id)) firstBoss.set(s.sch.id, s.t);
  });

  if (QUIET) {
    const marks = D.SCHOOLS.map(sch => {
      const t = firstBoss.get(sch.id);
      return `${sch.short} ${t == null ? '--' : fmtTime(t)}`;
    });
    console.log(marks.join(' | '));
    console.log(`  转生 ${S.prestigeCount} 次 · 第 ${S.era} 纪元 · 范式 ${S.paradigm} · ATK ${stats(S).atk.toFixed(0)} · 书 ${Object.keys(S.books).length} 本 · 到达第 ${Math.min(TOTAL, S.stage + 1)} 关 · 总时长 ${fmtTime(S.t)}`);
    return;
  }

  console.log('=== 各学派首 Boss 达成时刻 ===');
  D.SCHOOLS.forEach(sch => {
    const t = firstBoss.get(sch.id);
    console.log(`  ${sch.short}（${sch.doctrine}）  ${t == null ? '未达成' : fmtTime(t)}`);
  });
  console.log('\n=== 转生节点 ===');
  log.filter(l => l.startsWith('转生')).forEach(l => console.log('  ' + l));
  console.log('\n=== 通关节奏 ===');
  stageLog.forEach(s => {
    console.log(`${fmtTime(s.t).padStart(6)}  E${s.era} ${s.sch.short} ${s.round + 1}轮-${s.i + 1} ${s.kind.padEnd(6)} EHP ${String(s.ehp).padStart(9)}  ATK ${s.P.atk.toFixed(0).padStart(7)}`);
  });
  console.log('\n=== 关键节点 ===');
  log.filter(l => !l.startsWith('转生')).forEach(l => console.log('  ' + l));
  console.log(`\n最终：t=${fmtTime(S.t)}  纪元=${S.era}  转生=${S.prestigeCount}  书籍数=${Object.keys(S.books).length}  洞见/秒=${stats(S).rate.toFixed(2)}  ATK=${stats(S).atk.toFixed(0)}`);
  const lvs = Object.entries(S.books).map(([id, v]) => `${bookById(id).name} Lv${v.lv}${qOf(v.q).mark}`).join(' / ');
  console.log('书况：' + lvs);
}

run();
