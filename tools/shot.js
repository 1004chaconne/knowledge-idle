/* 通用截图：node shot.js <宽度> <输出名> [要执行的JS] */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Users/123/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const PORT = 9341;
const W = parseInt(process.argv[2] || '1500', 10);
const OUT = process.argv[3] || 'shot.png';
const JS = process.argv[4] || '';
const URL_ = process.argv[5] || 'file:///D:/work%20space/%E5%AD%A6%E4%B9%A0%E5%88%BB%E4%B8%8D%E5%AE%B9%E7%BC%93/knowledge-idle/index.html?nodlg=1&dev=1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = path.join(__dirname, 'cdp-shot');
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`, `--window-size=${W},900`, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });

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
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  for (let i = 0; i < 40; i++) { if (await evaluate('document.readyState') === 'complete') break; await sleep(150); }
  await sleep(1200);
  if (JS) { const r = await evaluate(JS); await sleep(1200); if (r !== undefined) console.log('JS 返回:', JSON.stringify(r)); }
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '..', OUT), Buffer.from(shot.data, 'base64'));
  console.log('已保存 ' + OUT);
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('失败:', e.message); chrome.kill(); process.exit(1); });
