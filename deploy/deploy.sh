#!/usr/bin/env bash
# ============================================================
#  《知识即力量》一键部署 —— 在本地跑，把前端推到腾讯云
#
#   ./deploy/deploy.sh v0.29              # 打版本号 + 跑测试 + 只传有变化的文件
#   ./deploy/deploy.sh v0.29 --no-test    # 跳过测试（急修用）
#   ./deploy/deploy.sh --dry-run v0.29    # 只看会传哪些文件，不真传
#
#   环境变量（都有默认值，一般不用改）
#     DEPLOY_HOST   服务器 IP     默认 101.43.29.99
#     DEPLOY_USER   登录用户      默认 root
#     DEPLOY_KEY    私钥路径      默认 ~/.ssh/xinmiao_deploy_rsa
#     SITE_DIR      站点目录      默认 /www/wwwroot/jieke
#     BACKUP_DIR    备份目录      默认 /www/wwwroot/_sapere-bak
# ============================================================
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-101.43.29.99}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/xinmiao_deploy_rsa}"
SITE_DIR="${SITE_DIR:-/www/wwwroot/jieke}"
BACKUP_DIR="${BACKUP_DIR:-/www/wwwroot/_sapere-bak}"
SITE_URL="${SITE_URL:-https://jieke.iyunlai.com.cn}"

info() { printf '\033[36m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m    [OK] %s\033[0m\n' "$*"; }
warn() { printf '\033[33m    [!]  %s\033[0m\n' "$*"; }
die()  { printf '\033[31m    [X]  %s\033[0m\n' "$*"; exit 1; }

VER=""; DRY=0; NOTEST=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --no-test) NOTEST=1 ;;
    -h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) die "未知参数 $a" ;;
    *)  VER="$a" ;;
  esac
done

cd "$(dirname "$0")/.." || die "进不去项目根目录"
[ -f index.html ] || die "当前目录不像项目根（找不到 index.html）"

SSH_OPTS=(-i "$DEPLOY_KEY" -o StrictHostKeyChecking=no -o LogLevel=ERROR -o ConnectTimeout=10)

# ---------- 1. 版本号 ----------
# 注意：页面上写的是 ?v=0.29（不带 v），命令行习惯写 v0.29。两个变量别混。
if [ -n "$VER" ]; then
  case "$VER" in v*) ;; *) VER="v$VER" ;; esac
  echo "$VER" | grep -Eq '^v[0-9]+\.[0-9]+(\.[0-9]+)?$' || die "版本号格式应为 v0.29 这种"
  NUM="${VER#v}"
  info "版本号 $VER"
  CUR=$(grep -o 'assets/game\.js?v=[0-9][0-9.]*' index.html | head -1 | sed 's/.*?v=//')
  if [ "$CUR" != "$NUM" ]; then
    sed -i "s/\(?v=\)[0-9][0-9.]*/\1$NUM/g" index.html
    ok "index.html 缓存版本 $CUR -> $NUM"
    BUMPED=1
  else
    ok "缓存版本已经是 $NUM"
    BUMPED=0
  fi
else
  NUM=$(grep -o 'assets/game\.js?v=[0-9][0-9.]*' index.html | head -1 | sed 's/.*?v=//')
  VER="v$NUM"
  BUMPED=0
  warn "没给版本号，按 index.html 里的 $NUM 走（不会改缓存版本，玩家可能仍吃旧 JS）"
fi

# ---------- 2. 测试门禁 ----------
if [ "$NOTEST" -eq 0 ]; then
  info "跑回归测试"
  if ! TESTOUT=$(node tools/equip-test.js 2>&1); then
    echo "$TESTOUT" | grep -E '✗|失败' | head -15
    die "测试未通过，已中止（确要强推加 --no-test）"
  fi
  ok "$(echo "$TESTOUT" | grep -E '全部通过' | tail -1 | sed 's/^ *//')"
else
  warn "已跳过测试（--no-test）"
fi

# ---------- 3. 连服务器 ----------
info "连服务器 $DEPLOY_USER@$DEPLOY_HOST"
[ -f "$DEPLOY_KEY" ] || die "找不到私钥 $DEPLOY_KEY（见 deploy/README.md）"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "test -d $SITE_DIR" \
  || die "连不上或站点目录 $SITE_DIR 不存在"
ok "站点目录 $SITE_DIR"

# ---------- 4. 算差异 ----------
info "比对本地与线上"
FILES=(index.html)
while IFS= read -r f; do FILES+=("$f"); done \
  < <(find assets -maxdepth 1 -type f \( -name '*.js' -o -name '*.css' \) | sort)

declare -A LOCAL=() REMOTE=()
for f in "${FILES[@]}"; do
  LOCAL["$f"]=$(md5sum "$f" | cut -d' ' -f1)
done
REMOTE_RAW=$(ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "cd $SITE_DIR && md5sum ${FILES[*]} 2>/dev/null || true")
while read -r h p; do
  [ -n "${p:-}" ] && REMOTE["$p"]="$h"
done <<< "$REMOTE_RAW"

CHANGED=()
for f in "${FILES[@]}"; do
  [ "${REMOTE[$f]:-}" = "${LOCAL[$f]}" ] || CHANGED+=("$f")
done

if [ "${#CHANGED[@]}" -eq 0 ]; then
  ok "线上与本地完全一致，无需部署（可能只是改了版本号？那就先提交）"
  exit 0
fi

for f in "${CHANGED[@]}"; do
  if [ -z "${REMOTE[$f]:-}" ]; then
    printf '    新增  %s\n' "$f"
  else
    printf '    改动  %s\n' "$f"
  fi
done

if [ "$DRY" -eq 1 ]; then
  warn "dry-run：以上 ${#CHANGED[@]} 个文件会被上传，实际未做任何改动"
  exit 0
fi

# ---------- 5. 备份 ----------
info "备份线上将被覆盖的文件"
STAMP="$(date +%Y%m%d-%H%M%S)"
ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" bash -s <<EOF
set -e
mkdir -p "$BACKUP_DIR"
cd "$SITE_DIR"
n=0
for f in ${CHANGED[*]}; do
  if [ -f "\$f" ]; then
    cp -a "\$f" "$BACKUP_DIR/\$(basename "\$f").$STAMP"
    n=\$((n+1))
  fi
done
echo "    已备份 \$n 个文件（后缀 $STAMP）"
EOF

# ---------- 6. 上传 ----------
info "上传 ${#CHANGED[@]} 个文件"
tar -czf - "${CHANGED[@]}" \
  | ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
      "cd $SITE_DIR && tar -xzf - && chown www:www ${CHANGED[*]} 2>/dev/null || true"
ok "上传完成"

# ---------- 7. 校验 ----------
info "校验线上文件"
VERIFY_RAW=$(ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" \
  "cd $SITE_DIR && md5sum ${CHANGED[*]}")
BAD=0
while read -r h p; do
  [ -z "${p:-}" ] && continue
  if [ "$h" = "${LOCAL[$p]}" ]; then
    printf '    md5 一致  %s\n' "$p"
  else
    printf '    md5 不符  %s\n' "$p"; BAD=1
  fi
done <<< "$VERIFY_RAW"
[ "$BAD" -eq 0 ] || die "有文件 md5 不符，请检查服务器磁盘空间/权限"

# ---------- 8. 线上探活 ----------
info "线上探活 $SITE_URL"
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_URL/" || echo 000)
[ "$CODE" = "200" ] && ok "首页 HTTP 200" || warn "首页 HTTP $CODE（非 200，请检查 nginx）"
ONLINE=$(curl -s --max-time 15 "$SITE_URL/" | grep -o "?v=$NUM" | head -1 || true)
[ -n "$ONLINE" ] && ok "首页引用已是 ?v=$NUM" || warn "首页没找到 ?v=$NUM，可能 nginx 缓存了 index.html"
API=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE_URL/api/world/current" || echo 000)
[ "$API" = "200" ] && ok "接口 /api/world/current 200（存档服务正常）" \
                   || warn "接口 HTTP $API（若 server 未改动过，可能只是网络抖动）"

# ---------- 9. 收尾 ----------
echo
printf '\033[32m部署完成 · %s\033[0m\n' "$VER"
echo
DIRTY=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  git diff --quiet -- . 2>/dev/null || DIRTY=1
fi
if [ "$DIRTY" -eq 1 ]; then
  echo "本地有未提交的改动，把它记进 Git："
  echo "  git add -A && git commit -m \"release $VER\" && git tag $VER && git push --follow-tags"
else
  echo "工作区是干净的，不用提交。"
fi
echo
echo "回滚到本次之前："
echo "  ssh -i $DEPLOY_KEY $DEPLOY_USER@$DEPLOY_HOST \\"
echo "    'ls -lt $BACKUP_DIR/*.$STAMP'   # 先看清楚有哪些"
echo "  # 再逐个 cp 回站点目录，例如："
echo "  #   cp $BACKUP_DIR/game.js.$STAMP $SITE_DIR/assets/game.js"
