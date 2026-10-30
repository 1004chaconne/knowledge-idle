# 部署单：jieke.iyunlai.com.cn

> 目标机器：101.43.29.99（宝塔）　站点目录：`/www/wwwroot/jieke`　当前：PHP 8.2 + SSL（剩余 82 天）
> 本单按"零依赖 Node 进程 + Nginx 反向代理"的方式部署，与鑫淼的 `xinmiao-api` 完全隔离。

---

## 0. 先做一次备份（重要）

`jieke` 目录现在是 PHP 站点，**先打包一份再动手**：

```bash
cd /www/wwwroot
tar -czf jieke-backup-$(date +%F).tar.gz jieke
ls -lh jieke-backup-*.tar.gz
```

> 如果这个 PHP 项目还在用，**不要覆盖**——改用文末「方案 B：子目录部署」。

---

## 1. 上传并解压

本地包：`dist/sapere-v0.12.tar.gz`（171 KB）

宝塔 → 文件 → 进入 `/www/wwwroot/jieke` → 上传 → 解压，解压后目录应为：

```
/www/wwwroot/jieke/
├─ index.html
├─ assets/            （data.js / game.js / lore.js / net.js / style.css）
├─ server/
│  ├─ src/            （auth.js / index.js / server.js / store.js）
│  └─ ecosystem.config.js
└─ doc/
```

---

## 2. 检查端口（避免撞车）

```bash
ss -lntp | grep 9400 || echo "9400 空闲，可以用"
```

被占用就换一个（比如 9410），记得同步改 `ecosystem.config.js` 和 Nginx。

---

## 3. 生成密钥并启动

```bash
cd /www/wwwroot/jieke/server
openssl rand -hex 24          # 把输出填进 ecosystem.config.js 的 COOKIE_SECRET

# 改完启动
pm2 start ecosystem.config.js
pm2 save
pm2 logs sapere-game --lines 30
```

看到 `[sapere] listening on http://127.0.0.1:9400` 就成了。

---

## 4. 宝塔里把站点改成反代（方案 A，推荐）

网站 → jieke.iyunlai.com.cn → 设置 → **反向代理** → 添加：

| 项 | 值 |
|---|---|
| 代理名称 | sapere |
| 目标 URL | `http://127.0.0.1:9400` |
| 发送域名 | `$host` |

添加后在该反代的「配置文件」里确认有一行：

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

> 没有这一行，服务端会以为你在用 http，Cookie 的 `Secure` 标记就会判断错；表现为"登录后刷新又变游客"。

同时把「强制 HTTPS」打开（SSL 剩余 82 天，建议顺手开自动续签）。

---

## 5. 验证（5 条，缺一不可）

| 检查 | 期望 |
|---|---|
| `https://jieke.iyunlai.com.cn/` | 游戏能加载，右上角显示「游客」 |
| 玩 30 秒后刷新 | 进度不丢 |
| 点「游客」→ 绑定邮箱 | 提示绑定成功 |
| 无痕窗口打开同域名 → 邮箱登录 | **进度能取回来**（这条是云存档的核心验收） |
| `server/data/db.json` | 存在，且每次玩后变大 |

命令行旁证：

```bash
curl -s https://jieke.iyunlai.com.cn/api/me -i | head -3     # 未登录应返回 401
curl -s -o /dev/null -w "%{http_code}\n" https://jieke.iyunlai.com.cn/   # 200
```

---

## 6. 回滚

```bash
pm2 delete sapere-game
cd /www/wwwroot && rm -rf jieke && tar -xzf jieke-backup-YYYY-MM-DD.tar.gz
```

---

## 方案 B：子目录部署（PHP 项目还要用时）

1. 游戏解压到 `/www/wwwroot/jieke/game/`
2. `GAME_DIR=/www/wwwroot/jieke/game` 写进 `ecosystem.config.js`
3. 宝塔反代只转发 `/game/api/` → `http://127.0.0.1:9400/api/`（并把 `/game/` 转发到 9400 或直接静态）
4. 前端在 `index.html` 里加一行 `window.SAPERE_API = '/game/api';`

> 方案 B 多一层路径映射，容易踩 Cookie 作用域（`Path=/game`）的坑；
> 只有在 PHP 项目确实还要保留时才推荐。

---

## 常见问题速查

| 现象 | 处理 |
|---|---|
| 502 Bad Gateway | `pm2 status` 是否 online；端口是否与反代一致 |
| 一直显示「离线」 | 反代是否只转了 `/`、没转 `/api` |
| 登录后刷新变游客 | 缺 `X-Forwarded-Proto`；或 HTTPS 未强制 |
| 存档冲突弹窗反复出现 | 两台设备各自改过；选一边即可，之后以那台为准 |
| 想换端口 | 改 `ecosystem.config.js` → `pm2 restart sapere-game` → 同步改反代 |
