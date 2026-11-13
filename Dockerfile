FROM --platform=$BUILDPLATFORM node:26-alpine3.23@sha256:39d8c143e60e99ae98f014bebea1e72fc96d3c9bdf9504bc3a27af5c05bfa39f AS builder

WORKDIR /app

# workspace の設定ファイルをコピー
COPY ["package.json", "package-lock.json", "./"]

# packages/shared をコピーしてビルド
COPY ["./packages", "./packages"]
RUN npm install --package-lock-only && \
    npm ci --workspace=@rx-twitter/shared && \
    npm run build --workspace=@rx-twitter/shared

# Bot のソースとビルド設定をコピー
COPY ["tsconfig.json", "./"]
COPY ["./src", "./src"]
RUN npm ci && \
    npm run compile

# 設定ファイルをコピー
COPY ["./.config", "./.config"]

FROM node:26-alpine3.23@sha256:39d8c143e60e99ae98f014bebea1e72fc96d3c9bdf9504bc3a27af5c05bfa39f AS runner

WORKDIR /app
ENV NODE_ENV=production \
    LOG_DIR=/app/bot/logs

# workspace の設定ファイルをコピー
COPY ["package.json", "package-lock.json", "./"]

# packages/shared のビルド成果物をコピー
COPY --from=builder /app/packages ./packages

# production 依存関係のみインストール
RUN npm ci --omit=dev --ignore-scripts

# Bot のビルド成果物をコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.config ./.config

# ヘルスチェック（HEALTH_PORT=9090 で /healthz エンドポイントを確認）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["sh", "-c", "wget --no-verbose --tries=1 --spider http://127.0.0.1:9090/healthz || exit 1"]

CMD ["npm", "run", "start:docker"]
