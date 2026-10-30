# 部署工具

把游戏前端推到 **https://jieke.iyunlai.com.cn**（腾讯云 101.43.29.99）。

工具**就在仓库里**，不需要另外打包发送 —— 台式机 `git pull` 一下就有了，以后我改脚本你也能直接拿到。

---

## 一、台式机第一次准备（只做一次）

### 1. 装 Git for Windows

它自带 `bash` / `ssh` / `tar` / `curl`，脚本全靠这些。装完确认：

```bash
git --version && bash --version && ssh -V
```

### 2. 拿到代码

```bash
git clone https://github.com/1004chaconne/knowledge-idle.git
cd knowledge-idle
git checkout main
```

### 3. 配好 SSH 密钥

服务器认的是 `~/.ssh/xinmiao_deploy_rsa` 这把钥匙。两条路选一条：

**路线 A · 直接把现有钥匙拷过去（最快，30 秒）**

在**现在这台机器**上打开 `C:\Users\HUAWEI\.ssh\`，把这两个文件复制到台式机的 `C:\Users\<用户名>\.ssh\`：

```
xinmiao_deploy_rsa        ← 私钥
xinmiao_deploy_rsa.pub    ← 公钥
```

> 建议用 U 盘或直接打开文件复制内容，别走微信/网盘 —— 这把私钥**没有口令保护**，谁拿到谁就能 root 上服务器。
> 台式机上记得收权限：Git Bash 里跑 `chmod 600 ~/.ssh/xinmiao_deploy_rsa`。

**路线 B · 台式机自己生成一把（更规范，多花 2 分钟）**

```bash
# 1) 台式机上生成，不要口令（脚本要免交互）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/xinmiao_deploy_rsa -N "" -C "desktop-deploy"

# 2) 把公钥内容发出来
cat ~/.ssh/xinmiao_deploy_rsa.pub
```

然后把这行公钥追加到服务器的 `~/.ssh/authorized_keys`（可以用现有那台机器执行，也可以在宝塔终端里粘）。

好处：两台机器各一把钥匙，哪台不用了删哪行就行，互不影响。

### 4. 自检能不能连上

```bash
ssh -i ~/.ssh/xinmiao_deploy_rsa root@101.43.29.99 "hostname; ls /www/wwwroot/jieke"
```

能打出主机名和目录列表就通了。**如果卡住或要密码，说明第 3 步没做对。**

---

## 二、日常部署

```bash
# Windows 双击也行，或命令行：
deploy\deploy.cmd v0.29

# Git Bash / 任何 bash：
bash deploy/deploy.sh v0.29
```

它按顺序做 9 件事：

| # | 动作 | 说明 |
|---|---|---|
| 1 | 改版本号 | 把 `index.html` 里所有 `?v=` 改成新版本（破浏览器缓存，**必须每次 +1**） |
| 2 | 跑测试 | `tools/equip-test.js`，不过就中止 |
| 3 | 连服务器 | 检查站点目录存在 |
| 4 | 算差异 | md5 逐文件比对，**只传真正变了的** |
| 5 | 备份 | 线上被覆盖的文件先存到 `/www/wwwroot/_sapere-bak/` |
| 6 | 上传 | `tar` 流式传，保留目录结构 |
| 7 | 校验 | 传完再比一次 md5 |
| 8 | 探活 | 首页 / 版本号 / `/api/world/current` |
| 9 | 收尾 | 打印 commit + tag 的命令，和回滚方法 |

**只动前端**（`index.html` + `assets/*.js` + `assets/*.css`）。
**不会动 `server/`，不需要重启 pm2** —— 登录和云存档不受影响。

### 常用参数

```bash
bash deploy/deploy.sh v0.29 --dry-run   # 只看会传哪些文件，不真传
bash deploy/deploy.sh v0.29 --no-test   # 跳过测试（急修用，慎用）
bash deploy/deploy.sh                   # 不改版本号，按 index.html 里的走
```

### 部署完记得提交

脚本会改 `index.html`（版本号），所以要收进 Git：

```bash
git add -A && git commit -m "release v0.29" && git tag v0.29 && git push --follow-tags
```

---

## 三、只改后端（server/）时

脚本不管这个。手动来：

```bash
# 打包（build.sh 故意排除 ecosystem.config.js，那里有线上 COOKIE_SECRET）
bash dist/build.sh v0.29

# 传上去再解压（注意：不要覆盖 server/ecosystem.config.js）
scp -i ~/.ssh/xinmiao_deploy_rsa dist/sapere-v0.29.tar.gz root@101.43.29.99:/tmp/
ssh -i ~/.ssh/xinmiao_deploy_rsa root@101.43.29.99 \
  'cd /www/wwwroot/jieke && tar -xzf /tmp/sapere-v0.29.tar.gz --exclude=server/ecosystem.config.js && pm2 restart sapere-game'
```

---

## 四、回滚

每次部署都把被覆盖的旧文件存了一份，文件名带时间戳：

```bash
# 看有哪些备份
ssh -i ~/.ssh/xinmiao_deploy_rsa root@101.43.29.99 'ls -lt /www/wwwroot/_sapere-bak/ | head -20'

# 例如恢复到 20261030-101500 那次之前
ssh -i ~/.ssh/xinmiao_deploy_rsa root@101.43.29.99 \
  'cd /www/wwwroot/jieke && cp /www/wwwroot/_sapere-bak/game.js.20261030-101500 assets/game.js'
```

---

## 五、排错

| 现象 | 原因 | 处理 |
|---|---|---|
| `Permission denied (publickey)` | 密钥没配对 | 重做「第一次准备」第 3 步 |
| 卡住不动 | 网络/安全组 | 确认 101.43.29.99:22 通；`ssh -v` 看卡在哪 |
| `md5 不符` | 磁盘满 / 权限 | `df -h`；站点属主应为 `www:www` |
| 首页 200 但版本号还是旧的 | nginx 缓存了 index.html | 宝塔里清缓存，或 `curl -H 'Cache-Control: no-cache'` |
| 改了 JS 但玩家看不到 | 版本号没 +1 | 部署时一定要带 `v0.x` 参数 |
| 部署完游戏能开但登录失败 | 动了 `server/` 或 `ecosystem.config.js` | 检查 pm2：`pm2 list \| grep sapere` |

---

## 六、安全须知

- **`server/ecosystem.config.js` 已被 `.gitignore` 排除**，里面有线上真实的 `COOKIE_SECRET`（能伪造登录 cookie）。谁都不要手动加回仓库。
- `.gitattributes` 里写了 `* -text`，**不要改**。部署靠 md5 比对判断文件是否变化，一旦 git 转换了换行符，md5 全变，会误判成"所有文件都改了"。
- `build.sh` 打包时**必须**排除 `ecosystem.config.js`，否则解压会覆盖线上密钥，所有玩家登录态瞬间失效。
