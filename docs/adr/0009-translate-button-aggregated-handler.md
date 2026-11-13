# ADR 0009: 翻訳ボタンは集約ハンドラで待ち受け、翻訳は VxTwitter だけで取る

- Status: Accepted
- Date: 2026-11-13

## Context

v2 表示のポストに「翻訳」ボタンを置く。押した人の Discord の表示言語
（`interaction.locale`）へ、ポストの本文と引用元の本文を翻訳し、エフェメラルで返す。
返答には「別の言語で読む」セレクトメニューを付け、選ぶとその返答が選んだ言語の
翻訳に書き換わる。多言語のサーバーでも、各人が自分の言語で読めるようにするため。

FxTwitter と VxTwitter は、どちらも翻訳先の言語を指定すると、レスポンスの
`translation` に翻訳を入れて返す（FxTwitter はクエリ `?lang=`、VxTwitter はパス末尾）。

決めることは2つある。

1. ボタンの押下をどう待ち受けるか。スポイラーボタンは、返信ごとの collector で
   24時間だけ待ち受けている（ADR 0004）。ADR 0004 は、起動時に1つだけ置く集約ハンドラを
   見送った。押下時に Embed と Tweet データを復元する手段が要るからで、この判断は
   将来の独立した判断に委ねられていた。
2. 翻訳をどちらの API から取るか。ポストの取得は VxTwitter を優先し、失敗したら
   FxTwitter へフォールバックしている。

2026-11 時点で実 API を確かめたところ、FxTwitter は翻訳先が en・fr・de・pt などのとき、
翻訳の代わりに DeepL のエラー文（「You're using an older version of DeepL…」を
多言語で並べたもの）を `translation.text` として返した。このとき `provider` は
`"deepl"` で、`source_lang` も実際と違っていた。

## Decision

### 待ち受け

`interactionCreate` を `src/index.ts` で1回だけ登録し、`TranslationInteractionHandler` が
`customId` で振り分ける。

- ボタン: `translate:{screenName}:{tweetId}`。押した人の表示言語で翻訳し、新しいエフェメラルで返す
- 言語メニュー: `translate_lang:{screenName}:{tweetId}`。選んだ言語は選択肢の値で届く。
  メニューの載っている返答を書き換える

ADR 0004 が集約ハンドラを見送った理由は、翻訳には当てはまらない。翻訳はどのみち、
押された時点で言語を付けて API を叩き直す。そのため復元すべき状態が無く、
`customId` に取得先さえあれば足りる。

`customId` と選択肢の値は Discord から届く入力として扱う。スクリーンネームとポストIDの
形式を厳密に検証し、検証済みの部品からだけ取得先の URL を組み立てる。選択肢の値は、
VxTwitter が受け付ける言語の一覧にあるものだけを使う。

スポイラーボタンは ADR 0004 のまま変えない。集約ハンドラは `translate:` 以外の
`customId` を無視する。

### 翻訳の取得元

翻訳は VxTwitter だけで取る。FxTwitter へはフォールバックしない。
VxTwitter が失敗した場合は、取得できなかったと返す。

翻訳先の言語コードは、VxTwitter（BetterTwitFix）の `translation.py` にある
`validLanguages` を写した一覧を基準に、Discord の locale から変換する
（`src/adapters/twitter/vxTranslationLang.ts`）。一覧に無い値を指定すると、
翻訳先として扱われず `translation` は null になるため。

引用元の翻訳は、言語を付けて取得したレスポンスの `qrt.translation` に入って返る。
追加のリクエストは要らない。

### 言語メニュー

セレクトメニューの選択肢は25個までだが、Discord の locale から作れる言語は31個ある。
利用の多そうな25言語に絞る（`src/adapters/discord/translationLanguageMenu.ts`）。
外した言語でも、押した人の表示言語であれば先頭に入れる。

## Consequences

### Positive

- ボタンに期限が無い。Bot の再起動をまたいでも押せる。
- ボタンごとのリスナーやクロージャを持たないため、投稿数に比例してメモリが増えない。
- 壊れた翻訳文を利用者に見せない。

### Negative

- VxTwitter が落ちている間は翻訳できない。
- 押されるたびに VxTwitter へ1回リクエストする。同じポストを何人が押しても、キャッシュはしない。
- 言語の一覧は上流を写したものなので、上流が変わっても自動では追従しない。
- VxTwitter は対応していない言語を頼まれると、別の言語（英語など）の翻訳を返すことがある。
  頼んだ言語と違う翻訳は捨てて、取得できなかったと返す。

### Mitigation

- discord.js の `Locale` のすべてが一覧の言語へ変換できることを、単体テストで確かめる。
  Discord が locale を増やせば、テストが落ちて気づける。
- 実 API で、名前の違う言語（zh-TW → zh-Hant、pt-BR、no → nb）の翻訳が返ることを
  `tests/integration/vxtwitterTranslation.test.ts` で確かめる（`RUN_LIVE_API_TESTS=1`）。
- FxTwitter の不具合が直れば、FxTwitter へのフォールバックを改めて検討できる。

## Rejected alternatives

### FxTwitter にもフォールバックし、provider が deepl の翻訳だけ捨てる

取得できる範囲は広がる。ただ、上流の不具合を前提にした回避策をコードに持つことになり、
不具合の現れ方が変わると、壊れた翻訳がそのまま表示される。

### ポストにセレクトメニューを置く

ポストから直接言語を選べる。ただ、すべてのポストにメニューが並んで表示が重くなる。
メニューはエフェメラルの返答にだけ置く。

### ボタンを押したら、先に言語を選ばせる

毎回2回の操作が要る。大半の人は自分の表示言語で読むので、まずその言語で返し、
別の言語は返答のメニューから選べるようにした。
