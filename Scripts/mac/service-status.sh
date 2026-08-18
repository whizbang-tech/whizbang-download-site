#!/bin/zsh
set -euo pipefail

launchctl print system/com.whizbang.download-site | egrep 'state =|runs =|last exit code =' || true
curl --fail --silent --show-error http://127.0.0.1:8091/download/health
curl --fail --silent --show-error https://api.whizbang.quest/live
