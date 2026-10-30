/* 在指定视口宽度下查找横向溢出元素 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Users/123/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const PORT = 9335;
const W = parseInt(process.argv[2] || '390', 10);
const FILE = 'file:///D:/work%20space/%E5%AD%A6%E4%B9%A0%E5%88%BB%E4%B8%8D%E5%AE%B9%E7%BC%93/knowledge-idle/index.html?nodlg=1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = path.join(__dirname, 'cdp-measure');
try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`, `--window-size=${W},844`, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
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
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: FILE });
  for (let i = 0; i < 40; i++) { if (await evaluate('document.readyState') === 'complete') break; await sleep(150); }
  await sleep(800);

  const info = await evaluate(`(() => {
    const out = { docW: document.documentElement.scrollWidth, winW: innerWidth, hits: [] };
    document.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 || r.width > innerWidth + 1) {
        out.hits.push({
          tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : ''),
          w: Math.round(r.width), right: Math.round(r.right)
        });
      }
    });
    out.hits = out.hits.slice(0, 14);
    return out;
  })()`);
  console.log(`视口 ${W}px  文档宽 ${info.docW}px  ${info.docW > info.winW ? '⚠ 横向溢出' : 'OK'}`);
  info.hits.forEach(h => console.log(`  ${String(h.w).padStart(4)}px  right=${h.right}  ${h.tag}`));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(__dirname, '..', 'mobile2.png'), Buffer.from(shot.data, 'base64'));
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error(e.message); chrome.kill(); process.exit(1); });
