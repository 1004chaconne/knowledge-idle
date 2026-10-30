/* ==========================================================
   云存档 / 账号（客户端）
   ------------------------------------------------------------
   设计原则：localStorage 永远是真相源，云端只是备份与跨设备。
   · 用 file:// 打开 或 没有 /api  → Net 不启用，游戏行为与以前完全一致
   · 首次进入自动建游客号并把本地进度推上去
   · 版本不一致 → 弹窗让玩家自己选（绝不静默覆盖）
   ========================================================== */
(function () {
  const HTTPS = location.protocol === 'https:';
  const API = (typeof window.SAPERE_API === 'string')
    ? window.SAPERE_API
    : (location.protocol.indexOf('http') === 0 ? '/api' : null);
  if (!API) return;

  const VER_KEY = 'sapere_net_ver';
  const SAVE_KEY = 'sapere_aude_v1';

  /* 救援入口：?reset=1 清掉本机的存档与版本记录，强制从云端重新拉一份。
     用于"本机残留旧存档、怎么刷都不对"的情况。清完立刻把参数从地址栏抹掉，
     避免 reload 后再次触发形成死循环。 */
  try {
    if (location.search.indexOf('reset=1') >= 0) {
      if (!sessionStorage.getItem('sapere_reset_done')) {
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(VER_KEY);
        sessionStorage.setItem('sapere_reset_done', '1');
      }
      /* 把参数改掉，否则 reload 后又会清一次，形成"永远都是新档"的死循环 */
      try { history.replaceState(null, '', location.pathname + '?reset=done'); } catch (e) {}
    }
  } catch (e) {}

  /* 进度权重：era 最重要（转生后 maxStage 会归零），其次转生次数、最高关卡、书页 */
  function progressScore(blob) {
    if (!blob) return -1;
    try {
      const o = JSON.parse(blob);
      return (o.era || 1) * 1e12
        + (o.prestigeCount || 0) * 1e10
        + (o.maxStage || 0) * 1e7
        + Math.min(o.page || 0, 1e7);
    } catch (e) { return -1; }
  }

  function blobSummary(blob) {
    if (!blob) return '空';
    try {
      const o = JSON.parse(blob);
      return `第 ${o.maxStage || 0} 关 · ${o.page || 0} 页 · 第 ${o.era || 1} 纪元 · ${Object.keys(o.books || {}).length} 本书`;
    } catch (e) { return '无法解析'; }
  }

  const Net = {
    api: API, uid: '', email: '', guest: true, ver: 0,
    online: false, busy: false, queued: false, timer: null, stop: false,

    async req(method, path, body) {
      const res = await fetch(API + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
      let data = null;
      try { data = await res.json(); } catch (e) {}
      return { status: res.status, data };
    },

    async init() {
      try {
        let me = await this.req('GET', '/me');
        if (me.status === 401) {
          const g = await this.req('POST', '/auth/guest');
          if (g.status !== 200) return;
          me = { status: 200, data: g.data };
        }
        if (me.status !== 200) return;
        this.uid = me.data.uid;
        this.email = me.data.email || '';
        this.guest = !!me.data.guest;
        this.online = true;
        this.ver = parseInt(localStorage.getItem(VER_KEY) || '0', 10) || 0;
        this.ui();
        await this.pull();
      } catch (e) {
        /* 断网就安静地离线，不打扰玩家 */
      }
    },

    /* 启动时拉取：云端空 → 推本地；版本一致 → 无事；不一致 → 让玩家选 */
    async pull() {
      const r = await this.req('GET', '/save');
      if (r.status !== 200) return;
      const cloud = r.data;
      const localBlob = localStorage.getItem(SAVE_KEY) || '';
      if (!cloud.blob) {          /* 云端空档：把本地进度送上去 */
        if (localBlob) await this.push(true);
        return;
      }
      if (cloud.version === this.ver) return;     /* 同一个版本，无需处理 */

      const cs = progressScore(cloud.blob);
      const ls = progressScore(localBlob);
      /* 云端进度明显更高 → 自动采用。让玩家来选，就一定有人点错丢档。 */
      if (ls < 0 || cs > ls * 1.05) {
        /* 关键：先立旗挡住游戏自己的 save()，否则内存里的旧档会在 reload 前写回去 */
        window.__netLoading = true;
        localStorage.setItem(SAVE_KEY, cloud.blob);
        localStorage.setItem(VER_KEY, String(cloud.version));
        this.ver = cloud.version;
        this.pendingConflict = null;
        /* 立刻 reload，不留任何时间窗口；万一 reload 被拦，5 秒后自动解锁存档 */
        setTimeout(() => { window.__netLoading = false; }, 5000);
        try { location.reload(); } catch (e) {}
        return;
      }
      /* 本机更高或旗鼓相当 → 保留本机，只做标记，绝不自动覆盖云端 */
      this.conflict(cloud, localBlob, true);
    },

    /* 本地存档变化 → 防抖 4 秒推一次 */
    onLocalSave() {
      if (!this.online || this.stop) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.timer = null; this.push(); }, 4000);
    },

    async push(force, overwrite) {
      if (!this.online) return false;
      /* 有未解决的冲突时，坚决不用本机去推——那正是丢档的路径 */
      if (this.pendingConflict && !force) return false;
      if (this.busy) { this.queued = true; return false; }
      this.busy = true;
      try {
        const blob = localStorage.getItem(SAVE_KEY) || JSON.stringify(window.S || {});
        const r = await this.req('PUT', '/save', { version: this.ver, blob, force: !!overwrite });
        if (r.status === 200) {
          this.ver = r.data.version;
          localStorage.setItem(VER_KEY, String(this.ver));
          this.pendingConflict = null;
          this.ui('已同步 ' + new Date().toLocaleTimeString().slice(0, 5));
          this.busy = false;
          return true;
        } else if (r.status === 409) {
          this.conflict(r.data, blob);
          if (r.data && r.data.error === 'regression') {
            this.ui('⚠️ 云端进度更高');
          }
        }
      } catch (e) { /* 离线，等下一次 */ }
      this.busy = false;
      if (this.queued) { this.queued = false; this.push(); }
      return false;
    },

    /* 冲突：默认只做标记（不弹全屏），玩家点开账号时才处理 */
    conflict(cloud, localBlob, silent) {
      this.pendingConflict = cloud;
      this.pendingLocalBlob = localBlob;
      this.markConflict();
      if (silent) return;
    },

    markConflict() {
      const el = document.getElementById('net-state');
      if (el) {
        el.textContent = '⚠️ 待同步';
        el.title = '云端与本机进度不一致，点这里处理';
      }
    },

    /* 玩家明确选了保留哪一边 */
    async resolveConflict(useCloud) {
      const cloud = this.pendingConflict;
      if (!cloud) return;
      if (useCloud) {
        localStorage.setItem(SAVE_KEY, cloud.blob);
        localStorage.setItem(VER_KEY, String(cloud.version));
        location.reload();
        return;
      }
      /* 用本机覆盖云端 = 危险操作，必须二次确认并说清丢什么 */
      const cur = localStorage.getItem(SAVE_KEY) || '';
      const cs = progressScore(cloud.blob);
      const ls = progressScore(cur);
      if (cs > ls) {
        const yes = confirm(
          '⚠️ 云端进度比本机更高\n\n' +
          '云端：' + blobSummary(cloud.blob) + '\n' +
          '本机：' + blobSummary(cur) + '\n\n' +
          '继续会用本机覆盖云端，云端那份就没了（无法撤销）。\n' +
          '如果你只是想把本机进度存上去，请先确认本机确实更新。'
        );
        if (!yes) return;
      }
      this.ver = cloud.version;                 /* 用云端版本号强制覆盖 */
      const ok = await this.push(true, true);   /* overwrite=true：明确要回退时才带 force */
      if (ok) { this.pendingConflict = null; location.reload(); }
      else alert('上传失败，请稍后重试（可能在另一台设备上刚改过）');
    },

    /* 旧实现（保留兼容，但不再自动弹全屏） */
    showConflictDialog(cloud, localBlob) {
      const fmtTime = t => t ? new Date(t).toLocaleString() : '未知';
      const localSize = (localBlob || '').length;
      const cloudSize = (cloud.blob || '').length;
      const cloudVer = cloud.version, cloudTime = fmtTime(cloud.updatedAt);
      window.__netConflict = async (useCloud) => {
        if (useCloud) {
          localStorage.setItem(SAVE_KEY, cloud.blob);
          localStorage.setItem(VER_KEY, String(cloudVer));
          location.reload();
        } else {
          const r = await this.req('PUT', '/save', { version: cloudVer, blob: localBlob });
          if (r.status === 200) {
            this.ver = r.data.version;
            localStorage.setItem(VER_KEY, String(this.ver));
            location.reload();
          } else {
            alert('上传失败，请稍后重试');
          }
        }
      };
      openDialog(`
        <h3>☁️ 发现两份不同的进度</h3>
        <p style="margin:6px 0 10px">云端和这台设备上的记录不一致。请选择保留哪一份（<b>不会自动覆盖</b>）。</p>
        <div class="orep">
          <div class="orep-row"><span>云端</span><b>${cloudVer} 版 · ${cloudSize} 字节</b></div>
          <div class="orep-row"><span>云端时间</span><b>${cloudTime}</b></div>
          <div class="orep-row"><span>本机</span><b>${localSize} 字节 · 本机版本 ${this.ver}</b></div>
        </div>
        <div class="dialog-acts">
          <button class="btn ghost" onclick="__netConflict(false)">用本机覆盖云端</button>
          <button class="btn gold" onclick="__netConflict(true)">用云端覆盖本机</button>
        </div>
      `);
    },

    async bind(email, password) {
      const r = await this.req('POST', '/auth/bind', { email, password });
      if (r.status === 200) { this.email = r.data.email; this.guest = false; this.ui(); return { ok: true }; }
      const msg = { 'email-taken': '这个邮箱已经被绑定了', 'bad-email': '邮箱格式不对', 'weak-password': '密码至少 6 位' };
      return { ok: false, why: msg[r.data && r.data.error] || '绑定失败' };
    },

    async login(email, password) {
      const r = await this.req('POST', '/auth/login', { email, password });
      if (r.status === 200) {
        this.uid = r.data.uid; this.email = r.data.email; this.guest = false;
        /* 换账号了：本机版本号属于上一个账号，必须清掉 */
        localStorage.removeItem(VER_KEY);
        this.ver = -1;
        return { ok: true };
      }
      return { ok: false, why: '邮箱或密码不对' };
    },

    /* 登录后决定怎么合档：一样就直接用，不一样就摆给玩家选，云端空就把本机推上去 */
    async loginThenLoad(email, password) {
      const r = await this.login(email, password);
      if (!r.ok) return r;
      const sr = await this.req('GET', '/save');
      if (sr.status !== 200) return { ok: true };
      const cloud = sr.data;
      const localBlob = localStorage.getItem(SAVE_KEY) || '';
      if (!cloud.blob) {
        this.ver = cloud.version || 0;
        if (localBlob) await this.push(true);
        location.reload();
        return { ok: true };
      }
      if (localBlob && localBlob === cloud.blob) {
        this.ver = cloud.version;
        localStorage.setItem(VER_KEY, String(cloud.version));
        location.reload();
        return { ok: true };
      }
      this.conflict(cloud, localBlob);
      return { ok: true, needChoice: true };
    },

    async logout() {
      await this.req('POST', '/auth/logout');
      this.online = false; this.uid = ''; this.email = ''; this.stop = true;
      this.ui();
    },

    /* ---- 存档码：跨域搬存档的唯一通道 ---- */
    toCode() {
      const raw = localStorage.getItem(SAVE_KEY) || (window.S ? JSON.stringify(window.S) : '');
      if (!raw) return '';
      try { return btoa(encodeURIComponent(raw)); } catch (e) { return ''; }
    },

    /* 解析存档码：只做校验，不改任何状态。
       粘贴过来的码可能带换行、空格，甚至被某些渠道把 + 转成空格、/ 转成 _，
       所以先清洗再解，否则 atob 会直接抛错——这是"粘了没反应"的主因。 */
    parseCode(code) {
      let clean = String(code || '').replace(/[\s\u00a0]+/g, '');   /* 去掉所有空白 */
      clean = clean.replace(/-/g, '+').replace(/_/g, '/');           /* base64url 兼容 */
      clean = clean.replace(/=+$/, '');                              /* 去掉尾部 = 再补齐 */
      while (clean.length % 4 !== 0) clean += '=';
      let raw;
      try { raw = decodeURIComponent(atob(clean)); }
      catch (e) { return { ok: false, why: '存档码格式不对（可能复制时被截断了，注意要以 = 结尾）' }; }
      let obj;
      try { obj = JSON.parse(raw); } catch (e) { return { ok: false, why: '存档内容损坏' }; }
      if (!obj || typeof obj !== 'object' || !obj.books) return { ok: false, why: '这不是一份有效的游戏存档' };
      return { ok: true, raw, obj };
    },

    /* 导入：先写本地，再强制覆盖云端（用云端当前版本号，绕过 409） */
    async importCode(code) {
      const r = this.parseCode(code);
      if (!r.ok) return r;
      localStorage.setItem(SAVE_KEY, r.raw);
      if (!this.online) return { ok: true, offline: true };
      const cur = await this.req('GET', '/save');
      const v = (cur.status === 200 && cur.data) ? (cur.data.version || 0) : 0;
      const up = await this.req('PUT', '/save', { version: v, blob: r.raw });
      if (up.status === 200) {
        this.ver = up.data.version;
        localStorage.setItem(VER_KEY, String(this.ver));
        return { ok: true, cloud: true };
      }
      return { ok: false, why: '已写入本机，但上传云端失败（' + up.status + '）' };
    },

    /* ---- 全服世界 BOSS ---- */
    async fetchWorld(week) {
      if (!this.online) return null;
      try {
        const r = await this.req('GET', '/world/current?week=' + encodeURIComponent(week));
        return r.status === 200 ? r.data : null;
      } catch (e) { return null; }
    },

    async reportWorld(week, dmg, goal) {
      if (!this.online) return null;
      try {
        const r = await this.req('POST', '/world/report', { week, dmg, goal });
        return r.status === 200 ? r.data : null;
      } catch (e) { return null; }
    },

    ui(note) {
      const el = document.getElementById('net-state');
      if (!el) return;
      if (note) {            /* 临时提示（如"已同步 12:34"），2.5 秒后回到账号状态 */
        el.textContent = note;
        clearTimeout(this._uiT);
        this._uiT = setTimeout(() => this.ui(), 2500);
        return;
      }
      el.textContent = this.online
        ? (this.email ? this.email.split('@')[0] : '登录 / 注册')
        : '离线';
      el.title = this.online ? '点击管理账号与云存档' : '当前为离线模式';
    },

    open() {
      if (!this.online) {
        const code = this.toCode();
        openDialog(`<h3>☁️ 离线模式</h3>
          <p>当前是离线模式（存档只在这台设备的这个地址下）。想搬到线上或换设备，用下面的存档码。</p>
          <div class="lore bk-sec">
            <div class="lore-h">导出存档码</div>
            <p class="bk-rel">点一下选中全部，复制后到线上版点「导入存档码」粘贴。</p>
            <textarea class="net-code" id="code-out" readonly onclick="this.select()">${code}</textarea>
            <p class="bk-rel" id="net-cmsg">长度 ${code.length} 字符</p>
            <div class="net-form">
              <button class="btn ghost sm" onclick="Net.copyCode()">复制存档码</button>
            </div>
          </div>
          <div class="dialog-acts">
            <button class="btn ghost" onclick="closeDialog();showIntro(true)">再看一次开场</button>
            <button class="btn gold" onclick="closeDialog()">关闭</button>
          </div>`);
        return;
      }
      openDialog(`
        <h3>☁️ 账号与云存档</h3>
        <div class="orep">
          <div class="orep-row"><span>当前账号</span><b>${this.email || '游客（未绑定）'}</b></div>
          <div class="orep-row"><span>云存档版本</span><b>${this.ver < 0 ? '待同步' : this.ver}</b></div>
        </div>
        ${this.pendingConflict ? `
          <div class="lore bk-sec net-warn">
            <div class="lore-h">⚠️ 发现另一份进度</div>
            <p class="bk-rel">
              <b>云端</b>：${blobSummary(this.pendingConflict.blob)}<br>
              <b>本机</b>：${blobSummary(localStorage.getItem(SAVE_KEY) || '')}
            </p>
            <div class="net-form">
              <button class="btn gold sm" onclick="Net.resolveConflict(true)">载入云端进度</button>
              <button class="btn ghost sm" onclick="Net.resolveConflict(false)">把本机存为云端</button>
            </div>
            <p class="bk-rel" style="color:#a8544a">※ 第二个按钮会覆盖云端，若云端进度更高会要求你二次确认。</p>
          </div>` : ''}
        ${this.guest ? `
          <div class="lore bk-sec">
            <div class="lore-h">① 保存进度 · 绑定邮箱</div>
            <p class="bk-rel">把现在的游客进度绑到一个邮箱上。绑定后换设备也能接着玩。</p>
            <div class="net-form">
              <input id="net-email" type="email" placeholder="you@example.com" autocomplete="username">
              <input id="net-pass" type="password" placeholder="设置密码（至少 6 位）" autocomplete="new-password">
              <button class="btn gold sm" id="net-bind">绑定</button>
            </div>
            <p class="bk-rel" id="net-msg"></p>
          </div>
          <div class="lore bk-sec">
            <div class="lore-h">② 已有账号 · 登录</div>
            <p class="bk-rel">在别的设备上绑定过？用邮箱和密码登回来，进度从云端取回。</p>
            <div class="net-form">
              <input id="net-lemail" type="email" placeholder="you@example.com" autocomplete="username">
              <input id="net-lpass" type="password" placeholder="密码" autocomplete="current-password">
              <button class="btn ghost sm" id="net-login">登录</button>
            </div>
            <p class="bk-rel" id="net-lmsg"></p>
          </div>` : `
          <div class="lore bk-sec">
            <div class="lore-h">已绑定邮箱</div>
            <p class="bk-rel">换设备时用同一个邮箱登录即可取回进度。</p>
          </div>`}
        <div class="lore bk-sec">
          <div class="lore-h">${this.guest ? '③' : '·'} 把本地存档搬上来</div>
          <p class="bk-rel">在离线版打开「登录 / 注册」点「复制存档码」，把那一长串粘贴到这里。导入会<b>覆盖云端</b>当前进度。</p>
          <textarea class="net-code" id="net-code" placeholder="粘贴存档码…"></textarea>
          <div class="net-form">
            <button class="btn gold sm" id="net-import">导入并覆盖云端</button>
            <button class="btn ghost sm" id="net-export">导出当前存档码</button>
          </div>
          <p class="bk-rel" id="net-imsg"></p>
        </div>
        <div class="dialog-acts">
          <button class="btn ghost sm" onclick="closeDialog();showIntro(true)">再看一次开场</button>
          <button class="btn ghost sm" onclick="Net.push(true);closeDialog()">立即同步</button>
          <button class="btn ghost sm" onclick="Net.logout().then(closeDialog)">退出账号</button>
          <button class="btn gold" onclick="closeDialog()">关闭</button>
        </div>
      `);
      const bind = document.getElementById('net-bind');
      if (bind) {
        bind.onclick = async () => {
          const email = (document.getElementById('net-email').value || '').trim();
          const pass = document.getElementById('net-pass').value || '';
          document.getElementById('net-msg').textContent = '绑定中…';
          const r = await this.bind(email, pass);
          document.getElementById('net-msg').textContent = r.ok ? '绑定成功，进度已关联到这个邮箱。' : r.why;
          if (r.ok) setTimeout(() => this.open(), 800);
        };
      }
      const imp = document.getElementById('net-import');
      if (imp) {
        imp.onclick = async () => {
          const code = (document.getElementById('net-code').value || '').trim();
          const msg = document.getElementById('net-imsg');
          if (!code) { msg.textContent = '先粘贴存档码'; return; }
          const chk = this.parseCode(code);
          if (!chk.ok) { msg.textContent = chk.why; return; }
          const o = chk.obj;
          msg.textContent = `检测到存档：第 ${o.maxStage || 0} 关 · ${o.page || 0} 页 · ${Object.keys(o.books || {}).length} 本书 —— 正在上传…`;
          const r2 = await this.importCode(code);
          if (r2.ok) { msg.textContent = '导入成功，正在重新载入…'; setTimeout(() => location.reload(), 900); }
          else msg.textContent = r2.why;
        };
      }
      const exp = document.getElementById('net-export');
      if (exp) {
        exp.onclick = () => {
          const ta = document.getElementById('net-code');
          ta.value = this.toCode();
          ta.select();
          document.getElementById('net-imsg').textContent = '已生成，Ctrl+C 复制走（也可以用来备份）';
        };
      }
      const lg = document.getElementById('net-login');
      if (lg) {
        lg.onclick = async () => {
          const email = (document.getElementById('net-lemail').value || '').trim();
          const pass = document.getElementById('net-lpass').value || '';
          document.getElementById('net-lmsg').textContent = '登录中…';
          const r = await this.loginThenLoad(email, pass);
          if (!r.ok) document.getElementById('net-lmsg').textContent = r.why;
          else if (r.needChoice) document.getElementById('net-lmsg').textContent = '请先选择保留哪一份进度';
        };
      }
    },
  };

  Net.copyCode = function () {
    const el = document.getElementById('code-out');
    if (!el) return;
    el.select();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.value);
      } else { document.execCommand('copy'); }
      const m = document.getElementById('net-cmsg');
      if (m) m.textContent = '已复制到剪贴板';
    } catch (e) {
      const m = document.getElementById('net-cmsg');
      if (m) m.textContent = '复制失败，请手动全选复制';
    }
  };

  window.Net = Net;

  /* 关页前用 sendBeacon 兜底推一次，避免最后一段进度丢在本地 */
  window.addEventListener('pagehide', () => {
    if (!Net.online) return;
    try {
      const blob = localStorage.getItem(SAVE_KEY) || '';
      if (blob) {
        navigator.sendBeacon = navigator.sendBeacon || function () { return false; };
        fetch(API + '/save', {
          method: 'PUT', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ version: Net.ver, blob }),
        });
      }
    } catch (e) {}
  });
})();
