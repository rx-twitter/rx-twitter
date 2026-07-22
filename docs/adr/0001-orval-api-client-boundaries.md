# ADR 0001: Orval API クライアントの責務境界と生成物管理

- Status: Accepted
- Date: 2026-07-21

## Context

FxTwitter と VxTwitter のレスポンスを OpenAPI から生成した Zod スキーマで検証する。Orval の組み込み fetch クライアントはレスポンス本文を先に JSON として解析するため、上流 API が 5xx と HTML を返した場合に HTTP ステータスを使ったフォールバック判定まで到達できない。また、custom mutator を使う場合、生成クライアント側の runtime validation は保証されない。

OpenAPI とコミット済み生成物の不一致も、レビューや実行時まで検出できない状態を避ける必要がある。

## Decision

- OpenAPI を API 契約の source of truth とし、Orval でリクエスト関数、レスポンス型、Zod スキーマを生成する。
- 外部 API の DTO 型は生成された型を使用する。既存の import 名が必要な場合は生成型の互換エイリアスとして再 export し、同じ構造を手書きで重複定義しない。
- 共通 custom fetch mutator は HTTP 通信を担当する。非 2xx は本文を解析せず、ステータス付きエラーを送出する。2xx は JSON のみ解析する。
- 手書き API ラッパーは生成 Zod スキーマの `safeParse`、ログ、404 の欠損扱い、VxTwitter の 5xx フォールバック判定を担当する。
- 生成コードは Git にコミットし、CI で `npm run gen:api` 後の差分がないことを検証する。
- 生成コードは直接編集しない。

## Alternatives

### Orval の組み込み fetch と runtime validation のみに任せる

非 JSON のエラーレスポンスで JSON 解析が先に失敗し、HTTP ステータスに基づくフォールバックを安定して実行できないため採用しない。

### API ラッパーで URL 構築から fetch まで手書きする

HTTP ステータスは扱いやすいが、OpenAPI から生成したクライアントを利用する目的と重複するため採用しない。

### 生成型と同じ外部 API DTO を手書きで維持する

OpenAPI の optional／nullable と手書き型が乖離し、型アサーションで不整合が隠れるため採用しない。Bot 内部の安定したドメイン契約は `Tweet` モデルで表現する。

### 生成物をコミットしない

ビルド時の生成が必須となり、開発・レビュー時に生成結果を確認しにくくなるため採用しない。

## Consequences

- 非 JSON の 5xx でも VxTwitter から FxTwitter へフォールバックできる。
- バリデーション失敗時に Zod の issue を API コンテキストとともに記録できる。
- OpenAPI 更新時は `npm run gen:api` と生成物のコミットが必須になる。
- OpenAPI の required／optional／nullable の変更は外部 API DTO 型にも反映される。アダプターは生成型の必須項目だけを直接使用し、任意項目には明示的なフォールバックを設ける。
- custom mutator と API ラッパーの両方をテストし、責務境界を維持する必要がある。
