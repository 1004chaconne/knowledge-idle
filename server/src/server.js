/* 《知识即力量》服务端：零依赖（node:http + node:crypto）
   - 账号：游客自动建档，可升级为邮箱+密码
   - 存档：单 blob + 版本号，冲突返回 409（客户端让玩家选，不静默覆盖）
   - 全服世界 BOSS：伤害累计（最小实现）
   - 同时托管游戏静态文件，一个域名一次部署 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');
const auth = require('./auth');

const GAME_DIR = process.env.GAME_DIR || path.join(__dirname, '..', '..');
const MAX_BODY = 1024 * 1024;      /* 1MB，存档远小于此 */
const MAX_SAVE = 512 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/* ---- 简易限流：按 IP 每分钟 20 次（只挡 auth 与写接口） ---- */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, t: now };
  if (now - rec.t > 60000) { rec.n = 0; rec.t = now; }
  rec.n++;
  hits.set(ip, rec);
  return rec.n > (parseInt(process.env.RATE_LIMIT_MAX || '30', 10));
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too-large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { reject(new Error('bad-json')); }
    });
    req.on('error', reject);
  });
}

const now = () => Date.now();

/* 存档进度分：era 最重要（转生后 maxStage 会归零），其次转生次数、最高关卡、书页。
   用于在服务端挡住"用低进度覆盖高进度"这类不可逆事故。 */
function saveScore(blob) {
  if (!blob) return -1;
  try {
    const o = JSON.parse(blob);
    return (o.era || 1) * 1e12
      + (o.prestigeCount || 0) * 1e10
      + (o.maxStage || 0) * 1e7
      + Math.min(o.page || 0, 1e7);
  } catch (e) { return -1; }
}
const rid = () => 'u_' + crypto.randomBytes(9).toString('hex');
const normEmail = s => String(s || '').trim().toLowerCase();

function getUser(db, req) {
  const uid = auth.uidFromReq(req);
  return uid && db.users[uid] ? { uid, user: db.users[uid] } : null;
}

/* ---------------- API ---------------- */
async function api(req, res, url) {
  const db = store.load();
  const p = url.pathname;
  const ip = req.socket.remoteAddress || '-';
  /* 只对 auth 接口限流：存档同步本来就很频繁，挡它会误伤正常玩家 */
  if (req.method !== 'GET' && p.startsWith('/api/auth/') && limited(ip)) {
    return json(res, 429, { error: 'too-many-requests' });
  }
  const secure = (req.headers['x-forwarded-proto'] === 'https');

  /* 游客建档：返回 uid，并把会话写进 httpOnly cookie */
  if (p === '/api/auth/guest' && req.method === 'POST') {
    const uid = rid();
    db.users[uid] = { uid, guest: true, email: null, pass: null, createdAt: now(), lastSeenAt: now() };
    db.saves[uid] = { ver: 0, blob: '', updatedAt: 0 };
    store.markDirty();
    auth.setCookie(res, uid, secure);
    return json(res, 200, { uid, guest: true, email: null });
  }

  /* 升级为邮箱账号 */
  if (p === '/api/auth/bind' && req.method === 'POST') {
    const who = getUser(db, req);
    if (!who) return json(res, 401, { error: 'not-logged-in' });
    const body = await readBody(req);
    const email = normEmail(body.email);
    const password = String(body.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'bad-email' });
    if (password.length < 6) return json(res, 400, { error: 'weak-password' });
    if (Object.values(db.users).some(u => u.email === email)) return json(res, 409, { error: 'email-taken' });
    who.user.email = email;
    who.user.pass = auth.hashPassword(password);
    who.user.guest = false;
    store.markDirty();
    return json(res, 200, { uid: who.uid, email });
  }

  if (p === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const email = normEmail(body.email);
    const u = Object.values(db.users).find(x => x.email === email);
    if (!u || !auth.verifyPassword(String(body.password || ''), u.pass)) {
      return json(res, 401, { error: 'bad-credentials' });
    }
    u.lastSeenAt = now();
    store.markDirty();
    auth.setCookie(res, u.uid, secure);
    return json(res, 200, { uid: u.uid, email: u.email, guest: false });
  }

  if (p === '/api/auth/logout' && req.method === 'POST') {
    auth.clearCookie(res);
    return json(res, 200, { ok: true });
  }

  if (p === '/api/me' && req.method === 'GET') {
    const who = getUser(db, req);
    if (!who) return json(res, 401, { error: 'not-logged-in' });
    who.user.lastSeenAt = now();
    return json(res, 200, { uid: who.uid, email: who.user.email, guest: !!who.user.guest });
  }

  /* 存档：GET 取云端，PUT 上传（带版本号，冲突 409） */
  if (p === '/api/save' && req.method === 'GET') {
    const who = getUser(db, req);
    if (!who) return json(res, 401, { error: 'not-logged-in' });
    const s = db.saves[who.uid] || { ver: 0, blob: '', updatedAt: 0 };
    return json(res, 200, { version: s.ver, updatedAt: s.updatedAt, blob: s.blob });
  }

  if (p === '/api/save' && req.method === 'PUT') {
    const who = getUser(db, req);
    if (!who) return json(res, 401, { error: 'not-logged-in' });
    const body = await readBody(req);
    const blob = String(body.blob || '');
    if (blob.length > MAX_SAVE) return json(res, 413, { error: 'save-too-large' });
    const cur = db.saves[who.uid] || { ver: 0, blob: '', updatedAt: 0 };
    const clientVer = typeof body.version === 'number' ? body.version : -1;
    if (clientVer !== cur.ver) {
      /* 冲突：把云端那份原样退回，由客户端让玩家决定 */
      return json(res, 409, { error: 'conflict', version: cur.ver, updatedAt: cur.updatedAt, blob: cur.blob });
    }
    /* 最后一道防线：低进度不许覆盖高进度。
       客户端可以被绕过、可以被旧页面误操作，服务端必须自己守住。 */
    const oldScore = saveScore(cur.blob);
    const newScore = saveScore(blob);
    const forceWrite = body.force === true;
    if (!forceWrite && oldScore > 0 && newScore >= 0 && newScore < oldScore * 0.9) {
      return json(res, 409, {
        error: 'regression',
        message: '新存档进度明显低于云端，已拒绝覆盖',
        version: cur.ver, updatedAt: cur.updatedAt, blob: cur.blob,
      });
    }

    db.saves[who.uid] = { ver: cur.ver + 1, blob, updatedAt: now() };
    store.markDirty();
    return json(res, 200, { version: cur.ver + 1, updatedAt: db.saves[who.uid].updatedAt });
  }

  /* 全服世界 BOSS：上报伤害 / 查询本周总量 */
  if (p === '/api/world/report' && req.method === 'POST') {
    const who = getUser(db, req);
    if (!who) return json(res, 401, { error: 'not-logged-in' });
    const body = await readBody(req);
    const week = String(body.week || '').slice(0, 12);
    const dmg = Math.max(0, Math.min(1e15, Number(body.dmg) || 0));
    const goal = Math.max(0, Math.min(1e15, Number(body.goal) || 0));
    if (!/^\d{4}-W\d{2}$/.test(week)) return json(res, 400, { error: 'bad-week' });
    const W = db.world[week] || (db.world[week] = { total: 0, players: {}, goals: {} });
    W.players = W.players || {};
    W.goals = W.goals || {};
    W.total = (W.total || 0) + dmg;
    W.players[who.uid] = (W.players[who.uid] || 0) + dmg;
    /* 全服目标 = 每个参与者「单人目标」之和。
       这样 1 个人玩时目标就是自己能打完的量，人越多目标越大，永远有意义。 */
    if (goal > 0) W.goals[who.uid] = Math.max(W.goals[who.uid] || 0, goal);
    store.markDirty();
    const goalSum = Object.keys(W.goals).reduce((a, k) => a + (W.goals[k] || 0), 0);
    return json(res, 200, {
      week, total: W.total, mine: W.players[who.uid],
      goal: goalSum, players: Object.keys(W.players).length,
    });
  }

  if (p === '/api/world/current' && req.method === 'GET') {
    const week = String(url.searchParams.get('week') || '').slice(0, 12);
    const W = db.world[week] || { total: 0, players: {}, goals: {} };
    const who = getUser(db, req);
    const goalSum = Object.keys(W.goals || {}).reduce((a, k) => a + (W.goals[k] || 0), 0);
    return json(res, 200, {
      week,
      total: W.total || 0,
      mine: who ? ((W.players || {})[who.uid] || 0) : 0,
      goal: goalSum,
      players: Object.keys(W.players || {}).length,
    });
  }

  return json(res, 404, { error: 'not-found' });
}

/* ---------------- 静态文件 ---------------- */
function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.join(GAME_DIR, rel);
  const root = path.resolve(GAME_DIR);
  if (!path.resolve(file).startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      /* 游戏文件改完就要立刻生效，所以不缓存 html/js/css */
      'Cache-Control': ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(buf);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    if (url.pathname.startsWith('/api/')) {
      try { await api(req, res, url); }
      catch (e) {
        const code = e.message === 'too-large' ? 413 : e.message === 'bad-json' ? 400 : 500;
        json(res, code, { error: e.message || 'server-error' });
      }
      return;
    }
    serveStatic(req, res, url);
  });
}

module.exports = { createServer, GAME_DIR };
