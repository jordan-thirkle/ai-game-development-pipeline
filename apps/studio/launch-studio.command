#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  printf '\nBYJTT Studio needs Node.js 26 or newer. Install Node, then open this launcher again.\n'
  printf 'Press Return to close.\n'
  read -r _
  exit 1
fi

if node tools/studio-launcher.mjs; then
  exit 0
else
  status=$?
fi
printf '\nStudio could not start. The error above is safe to copy into ChatGPT for diagnosis.\n'
printf 'Press Return to close.\n'
read -r _
exit "$status"
