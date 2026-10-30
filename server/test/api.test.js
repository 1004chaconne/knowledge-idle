/* 服务端接口测试：node --test server/test */
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = path.join(os.tmpdir(), 'sapere-test-' + Date.now() + '.json');
process.env.DATA_FILE = TMP;
process.env.COOKIE_SECRET = 'test-secret';

const { createServer } = require('../src/server');
let server, base;

before(async () => {
  server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  await new Promise(r => server.close(r));
  try { fs.unlinkSync(TMP); } catch (e) {}
});

/* 带 cookie 的请求小工具 */
function client() {
  let cookie = '';
  return async (method, p, body) => {
    const res = await fetch(base + p, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' },
        cookie ? { Cookie: cookie } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, data };
  };
}

test('游客自动建档并拿到会话', async () => {
  const c = client();
  const r = await c('POST', '/api/auth/guest');
  assert.equal(r.status, 200);
  assert.match(r.data.uid, /^u_[0-9a-f]{18}$/);
  const me = await c('GET', '/api/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.uid, r.data.uid);
  assert.equal(me.data.guest, true);
});

test('未登录访问存档返回 401', async () => {
  const c = client();
  const r = await c('GET', '/api/save');
  assert.equal(r.status, 401);
});

test('存档上传与版本号推进', async () => {
  const c = client();
  await c('POST', '/api/auth/guest');
  const up = await c('PUT', '/api/save', { version: 0, blob: '{"a":1}' });
  assert.equal(up.status, 200);
  assert.equal(up.data.version, 1);
  const get = await c('GET', '/api/save');
  assert.equal(get.data.version, 1);
  assert.equal(get.data.blob, '{"a":1}');
});

test('版本不一致返回 409 并带回云端存档（不静默覆盖）', async () => {
  const c = client();
  await c('POST', '/api/auth/guest');
  await c('PUT', '/api/save', { version: 0, blob: '{"server":true}' });
  const conflict = await c('PUT', '/api/save', { version: 0, blob: '{"local":true}' });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.error, 'conflict');
  assert.equal(conflict.data.blob, '{"server":true}');
  assert.equal(conflict.data.version, 1);
});

test('绑定邮箱后可用邮箱密码登录（新设备）', async () => {
  const c1 = client();
  const g = await c1('POST', '/api/auth/guest');
  await c1('PUT', '/api/save', { version: 0, blob: '{"v":1}' });
  const bind = await c1('POST', '/api/auth/bind', { email: 'Test@Example.com', password: 'secret123' });
  assert.equal(bind.status, 200);

  const c2 = client();   /* 模拟另一台设备 */
  const login = await c2('POST', '/api/auth/login', { email: 'test@example.com', password: 'secret123' });
  assert.equal(login.status, 200);
  assert.equal(login.data.uid, g.data.uid, '登录后应拿到同一个账号');
  const save = await c2('GET', '/api/save');
  assert.equal(save.data.blob, '{"v":1}', '跨设备能取到同一份存档');
});

test('弱密码与重复邮箱被拒绝', async () => {
  const c = client();
  await c('POST', '/api/auth/guest');
  const weak = await c('POST', '/api/auth/bind', { email: 'a@b.com', password: '123' });
  assert.equal(weak.status, 400);
  const ok1 = await c('POST', '/api/auth/bind', { email: 'dup@b.com', password: 'secret123' });
  assert.equal(ok1.status, 200);
  const c2 = client();
  await c2('POST', '/api/auth/guest');
  const dup = await c2('POST', '/api/auth/bind', { email: 'dup@b.com', password: 'secret123' });
  assert.equal(dup.status, 409);
});

test('错误密码登录失败', async () => {
  const c = client();
  await c('POST', '/api/auth/guest');
  await c('POST', '/api/auth/bind', { email: 'x@y.com', password: 'secret123' });
  const c2 = client();
  const bad = await c2('POST', '/api/auth/login', { email: 'x@y.com', password: 'wrong-one' });
  assert.equal(bad.status, 401);
});

test('世界 BOSS 伤害累计（全服总量 + 个人贡献）', async () => {
  const c = client();
  await c('POST', '/api/auth/guest');
  const week = '2026-W44';
  const r1 = await c('POST', '/api/world/report', { week, dmg: 100 });
  assert.equal(r1.status, 200);
  assert.equal(r1.data.total, 100);
  const r2 = await c('POST', '/api/world/report', { week, dmg: 50 });
  assert.equal(r2.data.total, 150);
  assert.equal(r2.data.mine, 150);
  const cur = await c('GET', '/api/world/current?week=' + week);
  assert.equal(cur.data.total, 150);
  const bad = await c('POST', '/api/world/report', { week: 'nope', dmg: 1 });
  assert.equal(bad.status, 400);
});

test('全服目标 = 各参与者单人目标之和（人多目标大）', async () => {
  const week = '2026-W45';
  const a = client(); await a('POST', '/api/auth/guest');
  const ra = await a('POST', '/api/world/report', { week, dmg: 100, goal: 300 });
  assert.equal(ra.data.goal, 300, '第一个参与者：目标 300');
  assert.equal(ra.data.players, 1);

  const b = client(); await b('POST', '/api/auth/guest');
  const rb = await b('POST', '/api/world/report', { week, dmg: 200, goal: 500 });
  assert.equal(rb.data.goal, 800, '两人：目标 300+500=800');
  assert.equal(rb.data.total, 300, '总量累计 100+200');
  assert.equal(rb.data.players, 2);

  /* 同一个人再打一次：目标取较大值，不叠加 */
  const ra2 = await a('POST', '/api/world/report', { week, dmg: 50, goal: 400 });
  assert.equal(ra2.data.goal, 900, '本人目标升到 400 → 全服 400+500=900');
  assert.equal(ra2.data.mine, 150, '个人贡献累计 100+50');

  /* current 也要返回 goal / players */
  const cur = await b('GET', '/api/world/current?week=' + week);
  assert.equal(cur.data.goal, 900);
  assert.equal(cur.data.players, 2);
  assert.equal(cur.data.total, 350);
});

test('低进度存档不能覆盖高进度，除非显式 force', async () => {
  const c = client();
  await c('POST', '/api/auth/guest');
  const high = JSON.stringify({ era: 5, prestigeCount: 4, maxStage: 480, page: 20778, books: { luoti: { lv: 28 } } });
  const low  = JSON.stringify({ era: 1, prestigeCount: 0, maxStage: 3, page: 36, books: {} });
  const up = await c('PUT', '/api/save', { version: 0, blob: high });
  assert.equal(up.status, 200);

  /* 模拟"旧页面/误操作用小存档覆盖" */
  const bad = await c('PUT', '/api/save', { version: 1, blob: low });
  assert.equal(bad.status, 409);
  assert.equal(bad.data.error, 'regression');
  assert.equal(bad.data.blob, high, '被拒绝时应把云端那份退回');

  /* 云端没被改动 */
  const still = await c('GET', '/api/save');
  assert.equal(still.data.blob, high, '高进度存档仍然完好');

  /* 明确要回退时才允许 */
  const forced = await c('PUT', '/api/save', { version: 1, blob: low, force: true });
  assert.equal(forced.status, 200);
});

test('正常推进（进度更高）不受保护机制影响', async () => {
  const c = client();
  await c('POST', '/api/auth/guest');
  await c('PUT', '/api/save', { version: 0, blob: JSON.stringify({ era: 1, maxStage: 3, page: 36 }) });
  const up = await c('PUT', '/api/save', { version: 1, blob: JSON.stringify({ era: 1, maxStage: 8, page: 300 }) });
  assert.equal(up.status, 200, '进度前进必须能存上去');
});

test('全服伤害有上限保护，负值被夹到 0', async () => {
  const c = client(); await c('POST', '/api/auth/guest');
  const week = '2026-W46';
  const neg = await c('POST', '/api/world/report', { week, dmg: -999, goal: -5 });
  assert.equal(neg.data.total, 0, '负伤害不计入');
  assert.equal(neg.data.goal, 0, '负目标被忽略');
});

test('静态文件：首页与 assets 可访问，路径穿越被挡', async () => {
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  const html = await home.text();
  assert.ok(html.includes('知识即力量') || html.includes('<html'));
  const js = await fetch(base + '/assets/data.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  const evil = await fetch(base + '/../package.json');
  assert.equal(evil.status >= 400, true);
});
