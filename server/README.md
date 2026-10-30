# 服务端部署说明（零依赖）

只用 Node 内置模块（`http` / `crypto` / `fs`），**不需要 npm install**。
一份进程同时做两件事：托管游戏静态文件 + 提供 `/api/*`。

---

## 一、本地先跑一遍（可选）

```bash
cd server
PORT=9400 COOKIE_SECRET=dev node src/index.js
# 打开 http://127.0.0.1:9400
```

跑接口测试：

```bash
node --test server/test/api.test.js
```

---

## 二、上传到服务器

需要上传的内容：

```
<游戏根目录>/
├─ index.html
├─ assets/            ← 前端（含 net.js）
├─ doc/               ← 可不传
└─ server/
   ├─ src/            ← 服务端源码
   ├─ test/           ← 可不传
   ├─ ecosystem.config.js
   └─ data/           ← 首次运行会自动创建
```

建议目录：`/www/wwwroot/sapere/`（与鑫淼的目录分开，互不影响）。

---

## 三、启动（pm2，独立进程）

```bash
cd /www/wwwroot/sapere/server
# 1) 先生成一个随机密钥，填进 ecosystem.config.js 的 COOKIE_SECRET
openssl rand -hex 24

# 2) 启动
pm2 start ecosystem.config.js
pm2 save

# 3) 看日志
pm2 logs sapere-game --lines 50
```

默认监听 `127.0.0.1:9400`（只对本机开放，由 Nginx 转发）。

---

## 四、Nginx 反向代理（宝塔面板）

新建站点 → 绑定你的空域名 → 设置里开「反向代理」到 `http://127.0.0.1:9400`。

等价的手写配置：

```nginx
server {
    listen 80;
    server_name game.example.com;

    # 关键：让服务端知道真实协议，否则 Cookie 的 Secure 标记会判断错
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;

    location / {
        proxy_pass http://127.0.0.1:9400;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

然后：SSL → 申请免费证书 → 开启「强制 HTTPS」。

---

## 五、验证清单

| 检查 | 期望 |
|---|---|
| 打开 `https://你的域名/` | 游戏能加载，顶栏右上角显示「游客」 |
| 玩 30 秒后刷新 | 进度不丢（本地存档 + 云端各一份） |
| 点顶栏「游客」→ 绑定邮箱 | 提示绑定成功，显示邮箱 |
| 换浏览器/无痕窗口打开同域名 → 用邮箱登录 | **进度能取回来** |
| `server/data/db.json` | 存在且随时间增长 |

---

## 六、备份与回滚

```bash
# 每天备份一次数据（加到宝塔计划任务里）
cp /www/wwwroot/sapere/server/data/db.json /www/wwwroot/sapere/server/data/db.$(date +%F).json
```

回滚：把旧目录还原 → `pm2 restart sapere-game`。

---

## 七、常见坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 打开是 502 | 进程没起 / 端口不对 | `pm2 status`、`pm2 logs` |
| 能玩但一直显示「离线」 | 前端连的是 `/api`，若改过路径需 `window.SAPERE_API='https://.../api'` | 检查 Nginx 是否转发了 `/api` |
| 登录后刷新又变游客 | Cookie 没带上（`SameSite`/`Secure`/域名不一致） | 确认 `X-Forwarded-Proto` 已设置、HTTPS 已启用 |
| 存档冲突弹窗反复出现 | 两台设备各改各的 | 正常行为：选一边，之后就以那台为准 |
| 想改端口 | `ecosystem.config.js` 里 `PORT` 与 Nginx 同步改 | — |
