#!/usr/bin/env bash
# 固定验收入口的薄封装：把参数原样转给仓库根的 check/check.mjs。
#
#   bash scripts/check.sh              # 跑全部 10 个场景
#   bash scripts/check.sh -list        # 列出全部场景
#   bash scripts/check.sh --only merge
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

if command -v node >/dev/null 2>&1; then
  exec node check/check.mjs "$@"
fi
echo "需要 Node.js 22（找不到 node）" >&2
exit 2
