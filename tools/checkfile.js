/* 验证 file:// 下 localStorage 是否跨会话持久 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Users/123/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const PORT = 9351;
const FILE = 'file:///D:/work%20space/%E5%AD%A6%E4%B9%A0%E5%88%BB%E4%B8%8D%E5%AE%B9%E7%BC%93/knowledge-idle/index.html?nodlg=1';
const profile = path.join(__dirname, 'cdp-filetest');
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(fn) {
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${PORT}`, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 40; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch (e) {}
    await sleep(250);
  }
  const t = list.find(x => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result.value; };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: FILE });
  for (let i = 0; i < 40; i++) { if (await ev('document.readyState') === 'complete') break; await sleep(150); }
  await sleep(800);
  const out = await fn(ev);
  ws.close(); chrome.kill(); await sleep(800);
  return out;
}

(async () => {
  const r1 = await run(async ev => {
    await ev('localStorage.setItem("__probe","hello-file"); S.insight = 12345; save();');
    return await ev('JSON.stringify({ probe: localStorage.getItem("__probe"), insight: S.insight, hasSave: !!localStorage.getItem("sapere_aude_v1") })');
  });
  console.log('第一次运行（写入）：', r1);

  const r2 = await run(async ev => {
    return await ev('JSON.stringify({ probe: localStorage.getItem("__probe"), insight: Math.round(S.insight) })');
  });
  console.log('第二次运行（重启浏览器）：', r2);

  const ok = JSON.parse(r2).probe === 'hello-file';
  console.log(ok ? '\n✅ file:// 的 localStorage 跨会话保留，可以直接双击打开' : '\n❌ file:// 存档不保留，必须用本地服务器');
  process.exit(ok ? 0 : 1);
})();
