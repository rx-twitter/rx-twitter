# Dashboard リポジトリ側 やることリスト

## （Bot リポジトリからのサブモジュール切り離し対応）

---

## 背景

Bot リポジトリ（`discord-twitter-embed-rx`）から Dashboard のサブモジュールを削除した。
Dashboard は独立したリポジトリとして自律的に CI/CD・デプロイを行う必要がある。

通信アーキテクチャは `Bot → Redis ← Dashboard` のままで変更なし。

---

## チェックリスト

### 1. `notify-parent.yml` ワークフローの削除

- [ ] `.github/workflows/notify-parent.yml` を削除する
  - Bot リポジトリのサブモジュール更新通知が不要になったため

---

### 2. `@twitterrx/shared` の依存関係を GitHub Packages へ切り替え

現状: CI で `npm pkg set dependencies["@twitterrx/shared"]="file:../packages/shared"` とパッチして親リポジトリのローカルパスを参照している。

- [ ] `package.json` の `@twitterrx/shared` バージョンを最新の公開版に更新
  - 例: `"@twitterrx/shared": "^0.3.0"` （Bot リポジトリの `publish-shared.yml` で公開済み）
- [ ] プロジェクトルートに `.npmrc` を追加して GitHub Packages レジストリを指定する
  ```
  @twitterrx:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
  ```
- [ ] CI の `npm install` 前に `NODE_AUTH_TOKEN` を渡すよう設定する
  ```yaml
  - name: Install dependencies
    run: npm ci
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```

---

### 3. `Dockerfile` の修正

現状: Bot リポジトリのコンテキストから `COPY packages/shared ./packages/shared` でコピーしている。

- [ ] `Dockerfile` から以下を削除する
  ```dockerfile
  COPY packages/shared ./packages/shared
  ```
- [ ] `npm install` 時に GitHub Packages 認証を通すよう `ARG` / `.npmrc` を追加する
  ```dockerfile
  ARG NODE_AUTH_TOKEN
  RUN echo "@twitterrx:registry=https://npm.pkg.github.com" >> .npmrc && \
      echo "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}" >> .npmrc && \
      npm ci && \
      rm -f .npmrc
  ```
- [ ] ビルドコマンドに `--build-arg NODE_AUTH_TOKEN=...` が必要になることを README に記載する

---

### 4. イメージビルド・プッシュワークフローの新規作成

現状: Bot リポジトリの `push-image.yml` が Dashboard のイメージをビルド・プッシュしていた（削除済み）。

- [ ] `.github/workflows/push-image.yml` を新規作成する

  ```yaml
  name: push-image
  on:
    push:
      branches: [main]
    release:
      types: [published]

  env:
    IMAGE_NAME: ghcr.io/${{ github.repository }}

  jobs:
    push-image:
      runs-on: ubuntu-latest
      permissions:
        packages: write
        contents: read
      steps:
        - uses: actions/checkout@v6

        - name: Set tag
          run: |
            if [ "${{ github.event_name }}" = 'release' ]; then
              echo "TAG=${{ github.event.release.tag_name }}" >> $GITHUB_ENV
            else
              echo "TAG=latest" >> $GITHUB_ENV
            fi

        - name: Login to ghcr.io
          uses: docker/login-action@v4
          with:
            registry: ghcr.io
            username: ${{ github.actor }}
            password: ${{ secrets.GITHUB_TOKEN }}

        - name: Build and push
          run: |
            docker build \
              --build-arg NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }} \
              -t "${{ env.IMAGE_NAME }}:${{ env.TAG }}" .
            docker push "${{ env.IMAGE_NAME }}:${{ env.TAG }}"
  ```

---

### 5. ローカル開発用 compose ファイルの整備（任意）

- [ ] リポジトリルートに `compose.yml` を追加し、Dashboard 単体で起動できるようにする
  - Redis は外部ネットワーク経由（Bot 側の Redis）か、またはスタンドアロンで用意する
  - 参考: Bot リポジトリの `compose.yml.dashboard-example`

---

### 6. README の更新

- [ ] セットアップ手順から Bot リポジトリへの依存（サブモジュール・親リポジトリのコンテキスト）に関する記述を削除する
- [ ] GitHub Packages からの `@twitterrx/shared` 取得手順を追記する
- [ ] 単独デプロイ手順を記載する

---

## 関連情報

| 項目               | 値                                                     |
| ------------------ | ------------------------------------------------------ |
| 共有パッケージ     | `@twitterrx/shared` @ `https://npm.pkg.github.com`     |
| Bot リポジトリ     | `github.com/t1nyb0x/discord-twitter-embed-rx`          |
| Dashboard イメージ | `ghcr.io/twitterrx/discord-twitter-embed-rx-dashboard` |
| Redis 通信         | `config:update` Pub/Sub、`app:dashboard:version` キー  |
