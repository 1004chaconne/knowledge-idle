/* 极简 JSON 存储：写入用「临时文件 + rename」保证原子性。
   数据量很小（每人一个存档 blob），单文件足够；
   以后要换 SQLite / Prisma，只需替换这个模块的三个方法。 */
const fs = require('fs');
const path = require('path');

const DATA = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');

function empty() { return { users: {}, saves: {}, world: {} }; }

let cache = null;
let dirty = false;
let timer = null;

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    cache.users = cache.users || {};
    cache.saves = cache.saves || {};
    cache.world = cache.world || {};
  } catch (e) {
    cache = empty();
  }
  return cache;
}

function flush() {
  if (!dirty || !cache) return;
  dirty = false;
  try {
    fs.mkdirSync(path.dirname(DATA), { recursive: true });
    const tmp = DATA + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, DATA);      /* 原子替换，断电不会写坏 */
  } catch (e) {
    console.error('[store] 写入失败', e.message);
  }
}

function markDirty() {
  dirty = true;
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, 800);
}

process.on('SIGINT', () => { flush(); process.exit(0); });
process.on('SIGTERM', () => { flush(); process.exit(0); });

module.exports = { load, flush, markDirty, DATA };
