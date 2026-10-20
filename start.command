#!/bin/zsh
cd "${0:A:h}"
TASK_NODE="$(command -v node)"
if [[ -z "$TASK_NODE" ]]; then
  TASK_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$TASK_NODE" ]]; then
  echo '需要 Node.js 22.12 或更新版本：https://nodejs.org/'
  read '?按回车关闭…'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo '请先运行 npm install 安装依赖。'
  read '?按回车关闭…'
  exit 1
fi
export PATH="$(dirname "$TASK_NODE"):$PATH"
if ! "$TASK_NODE" scripts/server.mjs start; then
  read '?按回车关闭…'
  exit 1
fi
open 'http://127.0.0.1:5173/'
