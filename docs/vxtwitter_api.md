# VxTwitter API 仕様書

> ベースコード: [dylanpdx/BetterTwitFix](https://github.com/dylanpdx/BetterTwitFix) (vxtwitter.com)
> エンドポイント: `https://api.vxtwitter.com/{screen_name}/status/{tweet_id}`

## 概要

VxTwitter (BetterTwitFix) は Flask ベースのサーバーで、Twitter の内部 GraphQL API からツイート情報を取得し、整形した JSON を返す。

## エンドポイント

### GET `/{screen_name}/status/{tweet_id}`

ツイートの詳細情報を取得する。

**パラメーター:**

| 名前        | 型     | 必須 | 説明                                       |
| ----------- | ------ | ---- | ------------------------------------------ |
| screen_name | string | yes  | ユーザーのスクリーンネーム (例: `Twitter`) |
| tweet_id    | string | yes  | ツイートの数値ID                           |

**クエリパラメーター:**

| 名前        | 型     | 説明                               |
| ----------- | ------ | ---------------------------------- |
| include_txt | string | `"true"` で .txt メディアURLを追加 |
| include_rtf | string | `"true"` で .rtf メディアURLを追加 |

**レスポンス (JSON):**

```json
{
  "date": "Wed Oct 05 18:40:30 +0000 2022",
  "date_epoch": 1664995230,
  "hashtags": ["example"],
  "likes": 21664,
  "mediaURLs": ["https://video.twimg.com/tweet_video/xxx.mp4", "https://pbs.twimg.com/media/xxx.jpg"],
  "media_extended": [
    {
      "altText": "画像の代替テキスト",
      "size": {
        "height": 1007,
        "width": 1179
      },
      "thumbnail_url": "https://pbs.twimg.com/media/xxx.jpg",
      "type": "image",
      "url": "https://pbs.twimg.com/media/xxx.jpg"
    },
    {
      "altText": "動画の代替テキスト",
      "duration_millis": 15000,
      "size": {
        "height": 206,
        "width": 194
      },
      "thumbnail_url": "https://pbs.twimg.com/tweet_video_thumb/xxx.jpg",
      "type": "video",
      "url": "https://video.twimg.com/tweet_video/xxx.mp4"
    }
  ],
  "replies": 2911,
  "retweets": 3229,
  "text": "ツイート本文",
  "tweetID": "1577730467436138524",
  "tweetURL": "https://twitter.com/Twitter/status/1577730467436138524",
  "user_name": "Twitter",
  "user_screen_name": "Twitter",
  "user_profile_image_url": "https://pbs.twimg.com/profile_images/xxx.jpg",
  "conversationID": "1577730467436138524",
  "possibly_sensitive": false,
  "qrtURL": null,
  "communityNote": null,
  "allSameType": true,
  "hasMedia": true,
  "combinedMediaUrl": null,
  "pollData": null,
  "article": null,
  "lang": "en",
  "replyingTo": null,
  "replyingToID": null,
  "fetched_on": 1696000000,
  "retweetURL": null,
  "translation": null
}
```

## レスポンスフィールド詳細

### トップレベル

| フィールド               | 型              | 説明                                                                         |
| ------------------------ | --------------- | ---------------------------------------------------------------------------- |
| `date`                   | string          | ツイート投稿日時 (RFC 2822形式)                                              |
| `date_epoch`             | number          | ツイート投稿日時 (Unix Epoch, 取得できない場合は未設定)                      |
| `hashtags`               | string[]        | ハッシュタグ一覧 (`#` なし)                                                  |
| `likes`                  | number          | いいね数                                                                     |
| `mediaURLs`              | string[]        | メディアのURL一覧 (video/gif/image)。古い互換用。                            |
| `media_extended`         | MediaExtended[] | メディアの詳細情報 (画像/動画/gifの区別あり)                                 |
| `replies`                | number          | リプライ数                                                                   |
| `retweets`               | number          | リツイート数                                                                 |
| `text`                   | string          | ツイート本文 (URL展開済み、t.co除去済み、220+文字の場合は note_tweet の内容) |
| `tweetID`                | string          | ツイートID (文字列)                                                          |
| `tweetURL`               | string          | ツイートへのリンク                                                           |
| `user_name`              | string          | ユーザー表示名                                                               |
| `user_screen_name`       | string          | ユーザーのスクリーンネーム (@を除く)                                         |
| `user_profile_image_url` | string          | プロフィール画像URL                                                          |
| `conversationID`         | string          | 会話スレッドID                                                               |
| `possibly_sensitive`     | boolean         | センシティブフラグ                                                           |
| `qrtURL`                 | string?         | 引用ツイートのURL (引用がない場合は null)                                    |
| `communityNote`          | string?         | Birdwatch/コミュニティノート (ない場合は null)                               |
| `allSameType`            | boolean         | 全メディアが同じタイプか                                                     |
| `hasMedia`               | boolean         | メディアを持っているか                                                       |
| `combinedMediaUrl`       | string?         | 画像結合URL (複数画像・同一タイプの場合)                                     |
| `pollData`               | PollData?       | アンケートデータ (ない場合は null)                                           |
| `article`                | Article?        | 記事データ (Twitter Blue記事, ない場合は null)                               |
| `lang`                   | string?         | 言語コード                                                                   |
| `replyingTo`             | string?         | リプライ先のユーザー名                                                       |
| `replyingToID`           | string?         | リプライ先のツイートID                                                       |
| `fetched_on`             | number          | データ取得日時 (Unix Epoch)                                                  |
| `retweetURL`             | string?         | リツイート元のURL                                                            |
| `translation`            | Translation?    | 翻訳データ (ない場合は null)                                                 |

### MediaExtended

| フィールド        | 型      | 説明                                            |
| ----------------- | ------- | ----------------------------------------------- |
| `url`             | string  | メディアの直接URL                               |
| `type`            | string  | メディアタイプ: `"image"` / `"video"` / `"gif"` / `"animated_gif"` |
| `size`            | object  | `{ width: number, height: number }`             |
| `thumbnail_url`   | string? | サムネイルURL (画像の場合は url と同じ)         |
| `altText`         | string? | 代替テキスト (ない場合は null)                  |
| `duration_millis` | number? | 動画の長さ (ミリ秒, 動画のみ。0の場合は不明)    |
| `id_str`          | string? | メディアID (文字列)                             |

### PollData

| フィールド | 型           | 説明       |
| ---------- | ------------ | ---------- |
| `options`  | PollOption[] | 選択肢一覧 |

#### PollOption

| フィールド | 型     | 説明         |
| ---------- | ------ | ------------ |
| `name`     | string | 選択肢の名前 |
| `votes`    | number | 得票数       |
| `percent`  | number | 得票率 (%)   |

### Article

| フィールド     | 型      | 説明               |
| -------------- | ------- | ------------------ |
| `title`        | string  | 記事タイトル       |
| `preview_text` | string  | プレビューテキスト |
| `image`        | string? | カバー画像URL      |

### Translation

| フィールド             | 型     | 説明         |
| ---------------------- | ------ | ------------ |
| `source_language`      | string | 翻訳元言語   |
| `destination_language` | string | 翻訳先言語   |
| `text`                 | string | 翻訳テキスト |

## 注意点

- `media_extended` は必須ではない。レスポンスに含まれない場合は `mediaURLs` で代替する（フォールバック）。
- `mediaURLs` は常に配列で返る（空配列の場合もある）。
- `qrtURL` が存在する場合、そのURLを再度 VxTwitter API に投げると引用ツイートのデータが取得できる。
- `allSameType` + `combinedMediaUrl` が利用可能な場合、Discord の埋め込み用に複数画像を1枚に結合したURLが提供される。
- `type` フィールドは `"image"` / `"video"` / `"gif"` / `"animated_gif"` のいずれか。`"animated_gif"` は Bot 内では `"video"` 相当として扱う。
- 古いツイート (API v1.1 ベース) では `media_extended` の構造が異なる可能性がある（`size` が `[w, h]` 配列だった）。
- テキストは最大 220 文字を超える場合 `note_tweet` (Twitter Blueの長文ツイート) の内容が使われる。
