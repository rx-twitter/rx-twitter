#!/bin/bash
# TwitterRX デプロイスクリプト
# adnanh/webhook から実行される（command-working-directory: $COMPOSE_DIR）

set -euo pipefail

LOG_FILE="/var/log/twitterrx-deploy.log"

# 以降の出力をすべてログファイルに記録
exec >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ===== Deploy started ====="

docker compose pull
docker compose up -d --force-recreate --remove-orphans

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deploy completed"
docker compose ps
