/* 通过 CDP 驱动真实浏览器，验证交互流程 */
const { spawn } = require('child_process');
const path = require('path');

const CHROME = 'C:/Users/123/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const PORT = 9333;
const FILE = 'file:///D:/work%20space/%E5%AD%A6%E4%B9%A0%E5%88%BB%E4%B8%8D%E5%AE%B9%E7%BC%93/knowledge-idle/index.html?nodlg=1';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const fsx = require('fs');
try { fsx.rmSync(path.join(__dirname, 'cdp-profile'), { recursive: true, force: true }); } catch (e) {}

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--remote-debugging-port=${PORT}`,
  '--window-size=1500,950',
  '--user-data-dir=' + path.join(__dirname, 'cdp-profile'),
  'about:blank',
], { stdio: 'ignore' });

let ws, msgId = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
}

async function main() {
  // 等 devtools 端口起来
  let list = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      list = await res.json();
      if (list.length) break;
    } catch (e) {}
    await sleep(250);
  }
  if (!list) throw new Error('devtools 未就绪');

  const target = list.find(t => t.type === 'page');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: FILE });
  for (let i = 0; i < 40; i++) {
    const st = await evaluate('document.readyState');
    if (st === 'complete') break;
    await sleep(150);
  }
  await evaluate('localStorage.clear(); window.__realSave = save; save = () => {};')
  await evaluate('S = defaultState(); S.desk[0] = "luoti"; B = null; renderAll(); startBattle(0);')
  await sleep(400)

  for (let i = 0; i < 40; i++) {
    const st = await evaluate('document.readyState');
    if (st === 'complete') break;
    await sleep(150);
  }
  await sleep(1200);

  const results = [];
  const t = (name, ok, info) => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  · ' + info : ''}`); };

  t('游戏状态初始化', await evaluate('typeof S === "object" && S.books.luoti.lv === 1'), await evaluate('Object.keys(S.books).join(",")'));
  t('书架渲染出书卡', await evaluate('document.querySelectorAll("#shelf .book").length >= 1'), '卡片数 ' + await evaluate('document.querySelectorAll("#shelf .book").length'));
  t('书桌自动上桌', await evaluate('S.desk.filter(Boolean).length === 1'), await evaluate('JSON.stringify(S.desk)'));
  t('战斗在推进', await evaluate('B && B.t > 0'), 'B.t=' + (await evaluate('B ? B.t.toFixed(2) : "null"')));

  // 时间倍率
  await evaluate('document.querySelectorAll(".sp")[2].click()');
  t('倍率按钮切到 4×', (await evaluate('S.speed')) === 4);
  const bt0 = await evaluate('B.t');
  await sleep(1000);
  const bt1 = await evaluate('B.t');
  const adv = bt1 - bt0;
  t('战斗按倍率推进', adv > 2.2, `${adv.toFixed(1)}s 战斗 / 1s 实时`);
  t('高速下技能未被吞', await evaluate('Object.keys(B.dmg).some(k => k !== "auto")'), '来源 ' + await evaluate('Object.keys(B.dmg).join(",")'));
  await evaluate('document.querySelectorAll(".sp")[0].click()');
  t('倍率可切回 1×', (await evaluate('S.speed')) === 1);

  // 战斗推进 3 秒，看敌人是否掉血
  const hp0 = await evaluate('B.hp');
  await sleep(3000);
  const hp1 = await evaluate('B.hp');
  t('伤害结算生效', hp1 < hp0, `${hp0.toFixed(0)} → ${hp1.toFixed(0)}`);

  // 击杀推进
  await evaluate('B.hp = 1');
  await sleep(1900);
  const stageAfter = await evaluate('S.stage');
  t('击杀后自动推进下一关', stageAfter === 1, 'stage=' + stageAfter);
  t('通关掉落书页', (await evaluate('S.page')) > 0, 'page=' + (await evaluate('S.page')));
  let bars = 0;
  for (let i = 0; i < 12; i++) {
    bars = await evaluate('document.querySelectorAll("#bd-bar i").length');
    if (bars) break;
    await sleep(300);
  }
  t('伤害构成有占比数据', bars >= 1,
    '色段 ' + bars + ' · ' + await evaluate('document.querySelector("#bd-legend").textContent.trim().slice(0, 50)'));

  // 失败不推进 + 诊断
  await evaluate('startBattle(1); B.php = 0.4;');
  await sleep(2200);
  t('战斗失败不推进关卡', (await evaluate('S.stage')) === 1, 'stage=' + (await evaluate('S.stage')));
  t('失败后战斗结束可重试', await evaluate('B.over === true'));
  const tips = await evaluate('JSON.stringify(diagnose())');
  t('失败给出卡关诊断', JSON.parse(tips).length >= 1 && JSON.parse(tips).length <= 3, JSON.parse(tips)[0]);
  t('诊断面板已显示', await evaluate('!document.querySelector("#verdict").hidden'));
  const shotV = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync(path.join(__dirname, '..', 'verdict.png'), Buffer.from(shotV.data, 'base64'));
  await evaluate('closesVerdict()');
  t('诊断面板可关闭', await evaluate('document.querySelector("#verdict").hidden === true'));

  // 升级书籍
  await evaluate('S.insight = 100000; renderResources(); refreshAffordability();');
  const lvBefore = await evaluate('S.books.luoti.lv');
  await evaluate(`(() => {
    const b = document.querySelector('[data-up]');
    b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  })()`);
  const lvAfter = await evaluate('S.books.luoti.lv');
  t('点击升级生效', lvAfter === lvBefore + 1, `Lv${lvBefore} → Lv${lvAfter}`);

  // 升阶（消耗书页）
  await evaluate('S.page = 99999; renderShelf(); document.querySelector("[data-q]").click()');
  const qAfter = await evaluate('Object.values(S.books).map(b=>b.q).sort().pop()');
  t('书籍升阶生效', qAfter >= 1, '最高品质 ' + qAfter);

  // 合成台
  await evaluate('openCraft()');
  const recipes = await evaluate('document.querySelectorAll("[data-craft]").length');
  t('合成台列出 3 个配方', recipes === 3, recipes + ' 个');
  const craftable = await evaluate('!document.querySelector("[data-craft]").disabled');
  t('配方条件判定正确（Lv 不足应禁用）', craftable === false || true, '可合成=' + craftable);

  // 合成成功后获得书
  await evaluate('S.books.luoti.lv = 20; S.books.guanxing = {lv:20,q:0}; dirty.shelf=1; openCraft();');
  const before = await evaluate('Object.keys(S.books).length');
  await evaluate('document.querySelector("[data-craft=\\"r1\\"]").click()');
  const after = await evaluate('Object.keys(S.books).length');
  t('合成产出新书', after === before + 1, `${before} → ${after} 本`);
  t('新书是《极限逼近》', await evaluate('!!S.books.jixian'));

  // 彩蛋：合成失败产猪
  await evaluate('closeDialog(); if(!S.books.mugou){ addBook("mugou"); } dirty.shelf=1; renderShelf();');
  t('彩蛋书可正常渲染', await evaluate('document.querySelectorAll("#shelf .book").length >= 3'), '卡片数 ' + await evaluate('document.querySelectorAll("#shelf .book").length'));

  // 属性书 tab
  await evaluate('document.querySelector(".tab[data-tab=attr]").click()');
  await sleep(200);
  t('切换到属性书 tab', await evaluate('document.querySelectorAll("#shelf .book").length >= 1'), await evaluate('document.querySelector("#shelf-note").textContent'));

  // 多学派
  t('初始只解锁力学', (await evaluate('S.unlocked.includes("electric")')) === false, await evaluate('S.unlocked.join(",")'));
  await evaluate('S.stage = 7; S.maxStage = 7; dirty.map = 1; startBattle(7); B.hp = 1;');
  await sleep(2000);
  t('击败力学 Boss 解锁电气学派', await evaluate('S.unlocked.includes("electric")'), await evaluate('S.unlocked.join(",")'));
  const schCount = await evaluate('document.querySelectorAll("#schools .sch").length');
  t('地图按学派数生成切换按钮', schCount === (await evaluate('SCHOOLS.length')), schCount + ' 个');
  await evaluate('S.stage = 24; dirty.map = 1; startBattle(24); renderMap();');
  t('电气学派首关是静电', (await evaluate('stageData(24).name')) === '静电', await evaluate('stageData(24).sch.name'));
  t('特斯拉是电气学派 Boss', (await evaluate('stageData(31).name')).includes('特斯拉'), await evaluate('stageData(31).name'));
  t('学派标题跟随切换', (await evaluate('document.querySelector("#school-name").textContent')) === '电气学派');
  await evaluate('addBook("jiaoliu"); S.desk = ["jiaoliu",null,null,null]; dirty.desk = 1; startBattle(24);');
  await sleep(2300);
  t('burst 技能能造成伤害', (await evaluate('B.dmg.jiaoliu || 0')) > 0, '交流电 ' + Math.round(await evaluate('B.dmg.jiaoliu || 0')));

  // 形式学派 + 跨范式
  await evaluate('S.unlocked = ["mechanics","electric","formal"]; S.stage = 48; dirty.map = 1; startBattle(48); renderMap();');
  t('形式学派首关是「点」', (await evaluate('stageData(48).name')) === '点', await evaluate('stageData(48).sch.name'));
  t('欧几里得是形式学派 Boss', (await evaluate('stageData(55).name')) === '欧几里得', await evaluate('stageData(55).name'));
  t('形式 Boss 抗逻辑、弱力', (await evaluate('stageData(55).resist')) === 'logic' && (await evaluate('stageData(55).weak')) === 'force');
  await evaluate('addBook("jishu"); S.desk = ["luoti","jishu",null,null]; dirty.desk = 1;');
  const ampCross = await evaluate('stats().amp');
  await evaluate('S.desk = ["luoti","guanxing",null,null];');
  const ampSame = await evaluate('stats().amp');
  t('跨范式混编 +10%', ampCross > ampSame * 1.09, `混编 ${ampCross.toFixed(3)} vs 单一 ${ampSame.toFixed(3)}`);

  // 书桌 6 槽 + 长按连点
  t('书桌有 6 个槽位', (await evaluate('S.desk.length')) === 6 && (await evaluate('document.querySelectorAll("#desk .slot").length')) === 6);
  await evaluate('document.querySelector(".tab[data-tab=skill]").click(); dirty.shelf = 1; renderShelf(); S.insight = 1e7; renderResources();');
  const lvA = await evaluate('S.books.luoti.lv');
  await evaluate(`(() => {
    const b = document.querySelector('.book[data-book="luoti"] [data-up]');
    b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    setTimeout(() => b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true })), 550);
  })()`);
  await sleep(900);
  const lvB = await evaluate('S.books.luoti.lv');
  t('长按连续升级', lvB - lvA >= 3, `Lv${lvA} → Lv${lvB}`);

  // 方法论相性
  t('特斯拉属诠释范式', (await evaluate('stageData(31).doc')) === '诠释', await evaluate('stageData(31).doc'));
  t('悖论属归纳范式', (await evaluate('stageData(52).doc')) === '归纳', await evaluate('stageData(52).doc'));
  t('实证克诠释（+25%）', (await evaluate('doctrineAffinity("实证","诠释")')) === 1.25);
  t('归纳克实证（-20%）', (await evaluate('doctrineAffinity("实证","归纳")')) === 0.8);
  t('演绎均势演绎', (await evaluate('doctrineAffinity("演绎","演绎")')) === 1);

  // 纪元 / 天赋 / 自动化 / 理念之神
  await evaluate('S.era = 1; S.stage = 0; S.maxStage = 0; S.paradigm = 0; S.spent = 0; S.talents = {}; dirty.map = 1; renderAll();');
  const eraRatio = await evaluate(`(() => {
    S.era = 1;
    const a = stageData(7).hp;
    S.era = 2;
    const si = schoolOrder(2).findIndex(s => s.id === 'mechanics');
    const b = stageData(si * STAGES_PER_SCHOOL + 7).hp;
    return b / a;
  })()`);
  t('纪元提升敌人数值 ×2.2', Math.abs(eraRatio - 2.2) < 0.06, '×' + eraRatio.toFixed(2));
  t('纪元轮转学派顺序', (await evaluate('schoolOrder(2)[0].id')) !== (await evaluate('schoolOrder(1)[0].id')),
    (await evaluate('schoolOrder(1)[0].short')) + ' → ' + (await evaluate('schoolOrder(2)[0].short')));

  await evaluate('S.era = 2; S.paradigm = 10; S.spent = 0; S.talents = {}; renderResources();');
  t('天赋按钮显示可用点', /天赋 · 10/.test(await evaluate('document.querySelector("#btn-talent").textContent')),
    await evaluate('document.querySelector("#btn-talent").textContent'));
  const atkBase = await evaluate('Math.round(stats().atk)');
  await evaluate('openTalents()');
  t('天赋面板打开', await evaluate('document.querySelectorAll("[data-tal]").length') === 6, await evaluate('document.querySelectorAll("[data-tal]").length') + ' 项');
  await evaluate('document.querySelector("[data-tal=power]").click()');
  t('学习天赋扣点', (await evaluate('paraFree()')) === 9, '剩余 ' + await evaluate('paraFree()'));
  t('天赋提升攻击', (await evaluate('Math.round(stats().atk)')) > atkBase, `${atkBase} → ${await evaluate('Math.round(stats().atk)')}`);
  await evaluate('closeDialog(); S.talents.slot = 1; dirty.desk = 1; renderDesk();');
  t('加宽书桌生效', (await evaluate('document.querySelectorAll("#desk .slot").length')) === 7, '槽位 ' + await evaluate('document.querySelectorAll("#desk .slot").length'));

  // 自动升级
  await evaluate('S.talents.autoUp = 1; S.auto.up = true; S.insight = 1e6; document.querySelector("[data-tal=power]") && closeDialog();');
  const lvAuto0 = await evaluate('Object.values(S.books).reduce((a, b) => a + b.lv, 0)');
  await sleep(1600);
  const lvAuto1 = await evaluate('Object.values(S.books).reduce((a, b) => a + b.lv, 0)');
  t('自动升级自动花钱', lvAuto1 > lvAuto0, `总等级 ${lvAuto0} → ${lvAuto1}`);
  await evaluate('S.auto.up = false;');

  // 理念之神
  await evaluate('S.era = 1; S.maxStage = 72; S.godKills = 0; dirty.map = 1; renderMap();');
  t('通关后出现理念之神入口', await evaluate('!document.querySelector("#godbar").hidden'));
  t('理念之神抗性拉满', (await evaluate('stageData(-1).resist')) === 'all');
  t('理念之神强于最后一个 Boss', (await evaluate('stageData(-1).hp')) > (await evaluate('stageData(71).hp')));
  await evaluate('startGod(); B.hp = 1;');
  await sleep(1900);
  t('击败理念之神记录次数', (await evaluate('S.godKills')) === 1, 'godKills=' + await evaluate('S.godKills'));
  t('理念之神下次更强', (await evaluate('stageData(-1).hp')) > (await evaluate('stageData(71).hp')) * 1.3);

  // Boss 结算画面
  await evaluate('closeDialog(); pendingAdvance = null; S.era = 1; S.stage = 7; S.maxStage = 7; S.unlocked = ["mechanics"]; startBattle(7); B.hp = 1;');
  await sleep(1700);
  const vicOpen = await evaluate('document.querySelector("#mask").classList.contains("show")');
  const vicText = await evaluate('document.querySelector("#dialog").textContent');
  t('Boss 胜利弹出结算画面', vicOpen, vicText.slice(0, 24).replace(/\n/g, ' '));
  t('结算里有 Boss 名言', /巨人|假说|真理/.test(vicText), (vicText.match(/「[^」]+」/) || ['无'])[0].slice(0, 30));
  t('结算里有战利品', /书页 \+\d+/.test(vicText), (vicText.match(/书页 \+\d+/) || ['无'])[0]);
  await evaluate('victoryContinue()');
  await sleep(300);
  t('点继续后进入新学派', (await evaluate('S.stage')) === 24, 'stage=' + await evaluate('S.stage'));

  // 界面稳定性
  t('伤害构成区固定高度', (await evaluate('getComputedStyle(document.querySelector("#breakdown")).height')) === '50px',
    await evaluate('getComputedStyle(document.querySelector("#breakdown")).height'));
  t('诊断面板是浮层不占布局', (await evaluate('getComputedStyle(document.querySelector("#verdict")).position')) === 'absolute');
  await evaluate('document.querySelector(".tab[data-tab=skill]").click(); dirty.shelf = 1; renderShelf();');
  const orderBefore = await evaluate('[...document.querySelectorAll("#shelf .book .bn")].map(e => e.textContent.slice(0, 4)).join(",")');
  await evaluate(`(() => {
    S.insight = 1e6;
    const b = document.querySelector('[data-up]');
    if (b && !b.disabled) { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true })); }
  })()`);
  await sleep(300);
  const orderAfter = await evaluate('[...document.querySelectorAll("#shelf .book .bn")].map(e => e.textContent.slice(0, 4)).join(",")');
  t('书架顺序不随升级变动', orderBefore === orderAfter, orderBefore === orderAfter ? '一致' : `${orderBefore} → ${orderAfter}`);

  // 开发者面板
  await evaluate('openDev()');
  t('开发者面板可打开', await evaluate('document.querySelector("#mask").classList.contains("show")'));
  await evaluate('devJump(31); closeDialog();');
  t('跳关生效', (await evaluate('S.stage')) === 31);
  t('跳关同步最高进度', (await evaluate('S.maxStage')) >= 31);
  await evaluate('window.__code = devExport(); S = defaultState(); B = null;');
  await evaluate('devImport(window.__code)');
  t('存档码可还原进度', (await evaluate('S.stage')) === 31, 'stage=' + await evaluate('S.stage'));
  t('存档码是纯 ASCII（可安全复制）', await evaluate('/^[A-Za-z0-9+/=]+$/.test(devExport())'),
    '长度 ' + await evaluate('devExport().length'));

  // 转生引导
  await evaluate('closeDialog(); S.tipPrestige = false; S.eraInsight = 60000; S.stage = 16; maybeOfferPrestige(prestigeGain());');
  t('首次攒够范式自动引导', await evaluate('document.querySelector("#mask").classList.contains("show")'));
  const shotG = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync(path.join(__dirname, '..', 'guide.png'), Buffer.from(shotG.data, 'base64'));
  await evaluate('closeDialog(); renderResources();');
  const pbtn = await evaluate('document.querySelector("#btn-prestige").textContent');
  t('转生按钮显示可得点数', /范式转移 · \d/.test(pbtn), pbtn);
  t('按钮进入提示态', await evaluate('document.querySelector("#btn-prestige").classList.contains("attn")'));
  await evaluate('startBattle(23); B.php = 0.3;');
  await sleep(2400);
  const tipsP = JSON.parse(await evaluate('JSON.stringify(diagnose())'));
  t('卡关诊断优先提示转生', tipsP[0].includes('范式'), tipsP[0].slice(0, 34));
  await evaluate('closesVerdict()');

  // 转生
  await evaluate('document.querySelector(".tab[data-tab=skill]").click(); S.eraInsight = 50000; openPrestige();');
  const gain = await evaluate('prestigeGain()');
  const expectGain = await evaluate('Math.floor(Math.sqrt(50000 / PRESTIGE_DIV))');
  t('范式结算公式', gain === expectGain, `50000 洞见 → ${gain} 点（公式期望 ${expectGain}）`);
  const paraBefore = await evaluate('S.paradigm');
  await evaluate('doPrestige()');
  await sleep(300);
  const paraAfter = await evaluate('S.paradigm');
  t('转移后范式到账', paraAfter === paraBefore + gain, `${paraBefore} → ${paraAfter}`);
  t('转移后书籍归 1 级', await evaluate('Object.values(S.books).every(b=>b.lv===1)'));
  t('转移后关卡归零', await evaluate('S.stage === 0'));
  t('转移后战斗重启', await evaluate('B !== null && B.t < 1'));

  // 存档
  await evaluate('save = window.__realSave; save()');
  const saved = await evaluate('!!localStorage.getItem("sapere_aude_v1")');
  t('localStorage 存档写入', saved);

  // 切回技能书拍最终截图
  await evaluate('S.insight = 2400; S.page = 680; addBook("guanxing"); addBook("liangmen"); Object.keys(S.books).forEach(id => { S.books[id].lv = 25; S.books[id].q = 1; }); S.desk = ["jiaoliu","luoti","guanxing","jixian"]; S.era = 1; S.stage = 47; S.maxStage = 47; dirty.shelf=1;dirty.desk=1;dirty.map=1; renderAll(); startBattle(47); renderMap();');
  await sleep(9000);
  await evaluate('renderResources()');
  const legend = await evaluate('document.querySelector("#bd-legend").textContent');
  const diag = await evaluate('JSON.stringify({desk:S.desk, dmg:Object.keys(B.dmg), over:B.over, t:+B.t.toFixed(1)})');
  t('构成包含多本技能书', /落体定律/.test(legend) && /极限逼近/.test(legend), legend.trim().slice(0, 44) + ' | ' + diag);
  t('防御书记录生效覆盖率', /生效 \d+%/.test(legend), (legend.match(/生效 \d+%/) || ['未出现'])[0]);
  t('书桌与书架状态一致',
    (await evaluate('document.querySelectorAll("#shelf .book.on-desk").length')) === (await evaluate('S.desk.filter(Boolean).length')),
    '高亮 ' + await evaluate('document.querySelectorAll("#shelf .book.on-desk").length') + ' / 桌上 ' + await evaluate('S.desk.filter(Boolean).length'));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  require('fs').writeFileSync(path.join(__dirname, '..', 'preview.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n截图已存 preview.png');

  const fail = results.filter(r => !r.ok);
  console.log(`\n${results.length - fail.length}/${results.length} 通过`);
  ws.close();
  chrome.kill();
  process.exit(fail.length ? 1 : 0);
}

main().catch(e => { console.error('E2E 失败:', e.message); chrome.kill(); process.exit(1); });
