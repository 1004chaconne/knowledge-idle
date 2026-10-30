/* 密码与会话：都用 node:crypto，不引入 bcrypt / jsonwebtoken。 */
const crypto = require('crypto');

const SECRET = process.env.COOKIE_SECRET || 'dev-secret-change-me';
const COOKIE = 'sapere_sid';

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(pw, stored) {
  if (!stored || stored.indexOf(':') < 0) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(String(pw), salt, 32).toString('hex');
  /* 定长比较，避免时序泄漏 */
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
}

function sign(uid) {
  const mac = crypto.createHmac('sha256', SECRET).update(String(uid)).digest('hex').slice(0, 32);
  return uid + '.' + mac;
}

function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const i = token.lastIndexOf('.');
  const uid = token.slice(0, i), mac = token.slice(i + 1);
  const calc = crypto.createHmac('sha256', SECRET).update(uid).digest('hex').slice(0, 32);
  return mac === calc ? uid : null;
}

function setCookie(res, uid, secure) {
  const parts = [
    `${COOKIE}=${sign(uid)}`,
    'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + 60 * 60 * 24 * 365,
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function uidFromReq(req) {
  const raw = req.headers.cookie || '';
  const m = raw.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
  return m ? verify(decodeURIComponent(m[1])) : null;
}

module.exports = { hashPassword, verifyPassword, setCookie, clearCookie, uidFromReq, COOKIE };
