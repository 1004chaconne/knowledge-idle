/* 高速自动跑图：验证高倍率下长时间运行不出错、不爆数值 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Users/123/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const PORT = 9337;
const FILE = 'file:///D:/work%20space/%E5%AD%A6%E4%B9%A0%E5%88%BB%E4%B8%8D%E5%AE%B9%E7%BC%93/knowledge-idle/index.html?nodlg=1';
const SPEED = parseFloat(process.argv[2] || '8');
const SECONDS = parseFloat(process.argv[3] || '30');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = path.join(__dirname, 'cdp-play');
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`, '--window-size=1500,950', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
}

(async () => {
  let list;
  for (let i = 0; i < 40; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch (e) {}
    await sleep(250);
  }
  const t = list.find(x => x.type === 'page');
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    if (m.method === 'Runtime.exceptionThrown') console.log('  JS 异常:', m.params.exceptionDetails?.exception?.description?.split('\n')[0]);
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: FILE });
  for (let i = 0; i < 40; i++) { if (await evaluate('document.readyState') === 'complete') break; await sleep(150); }
  await sleep(600);

  await evaluate(`save = () => {}; localStorage.clear();`);
  await send('Page.navigate', { url: FILE });
  await sleep(900);

  // 自动买最便宜的升级，模拟一个不算笨的玩家
  await evaluate(`
    window.__autoBuy = setInterval(() => {
      if (typeof S === 'undefined') return;
      let best = null;
      for (const id in S.books) {
        const st = S.books[id], q = QUALITIES[Math.min(2, st.q)];
        if (st.lv >= q.cap) continue;
        const c = upgradeCost(st.lv);
        if (S.insight >= c && (!best || c < best.c)) best = { id, c };
      }
      if (best) { S.insight -= best.c; S.books[best.id].lv++; dirty.shelf = 1; dirty.desk = 1; }
      for (const id in S.books) {
        const st = S.books[id];
        if (st.q < 2 && S.page >= QUALITIES[st.q + 1].pageCost) { S.page -= QUALITIES[st.q + 1].pageCost; st.q++; }
      }
      const skills = Object.keys(S.books).filter(id => bookById(id).type === 'skill');
      const scored = skills.map(id => {
        const b = bookById(id), st = S.books[id], q = QUALITIES[Math.min(2, st.q)];
        return { id, s: b.mult * (1 + LV_SKILL_BONUS * (st.lv - 1)) * q.skill / b.cd };
      }).sort((a, b) => b.s - a.s);
      S.desk = [0, 1, 2, 3].map(i => scored[i] ? scored[i].id : null);
      dirty.desk = 1;
      if (B && B.over && B.php <= 0) startBattle(S.stage);
    }, 250);
  `);

  await evaluate(`document.querySelectorAll('#speed .sp').forEach(b => { if (parseFloat(b.dataset.sp) === ${SPEED}) b.click(); })`);
  const sp = await evaluate('S.speed');
  const TOTAL = await evaluate('SCHOOLS.length * STAGES_PER_SCHOOL');
  console.log(`倍率 ×${sp}   跑 ${SECONDS}s 实时（≈ ${(SECONDS * sp / 60).toFixed(1)} 分钟游戏时间）\n`);

  const t0 = Date.now();
  let lastStage = 0;
  while (Date.now() - t0 < SECONDS * 1000) {
    await sleep(5000);
    const snap = await evaluate(`JSON.stringify({
      stage: S.stage, max: S.maxStage, insight: Math.round(S.insight), page: Math.round(S.page),
      para: S.paradigm, books: Object.keys(S.books).length,
      hp: B ? Math.round(B.hp) : null, bt: B ? +B.t.toFixed(1) : null,
      nan: !isFinite(S.insight) || (B && !isFinite(B.hp))
    })`);
    const d = JSON.parse(snap);
    const el = ((Date.now() - t0) / 1000).toFixed(0);
    console.log(`  ${String(el).padStart(3)}s  stage ${String(d.stage).padStart(2)}/${TOTAL}  书 ${d.books}  洞见 ${d.insight}  书页 ${d.page}  范式 ${d.para}  ${d.nan ? '⚠ 数值异常' : ''}`);
    lastStage = d.stage;
  }

  const final = JSON.parse(await evaluate(`JSON.stringify({
    stage: S.stage, max: S.maxStage, para: Math.floor(Math.sqrt(S.eraInsight / PRESTIGE_DIV)),
    rate: +stats().rate.toFixed(2), atk: +stats().atk.toFixed(0), nan: !isFinite(S.insight) || !isFinite(stats().atk),
    books: Object.keys(S.books).length, cards: S.cards.length, unlocked: S.unlocked.join(',')
  })`));
  console.log(`\n最终：stage ${final.stage}/${TOTAL}  最高 ${final.max}  书 ${final.books} 本  知识卡 ${final.cards}  学派 ${final.unlocked}`);
  console.log(`产出 ${final.rate}/s  攻击 ${final.atk}  可转生 ${final.para} 点  ${final.nan ? '⚠ 数值异常' : '数值正常'}`);

  ws.close(); chrome.kill();
  process.exit(final.nan ? 1 : 0);
})().catch(e => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
