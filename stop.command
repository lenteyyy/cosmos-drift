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
if ! "$TASK_NODE" scripts/server.mjs stop; then
  read '?按回车关闭…'
  exit 1
fi
