import { describe, expect, it } from "vitest";

import { VxTwitterAdapter } from "#/adapters/twitter/VxTwitterAdapter.js";
import { isSameLanguage, toVxTranslationLang } from "#/adapters/twitter/vxTranslationLang.js";
import { TEST_URLS } from "../fixtures/test-urls.js";

/**
 * VxTwitter の翻訳（パス末尾の言語指定）に対する実 API のテスト。
 *
 * 言語コードの変換は tests/unit/adapters/twitter/vxTranslationLang.test.ts が
 * 上流の一覧に対して検証している。ここでしか見られないのは、変換した言語コードで
 * 実際に翻訳が返ってくることである。特に、Discord の locale と名前が違う言語
 * （zh-TW → zh-Hant、pt-BR、no → nb）が通ることを確かめる。
 *
 * 翻訳の中身には依存させず、「頼んだ言語の翻訳が返る」ことに留める。
 * NORMAL_TWEET と QUOTE_TWEET（とその引用元）は日本語のポストである前提。
 *
 *   RUN_LIVE_API_TESTS=1 npx vitest run tests/integration/vxtwitterTranslation.test.ts
 */
const RUN = process.env.RUN_LIVE_API_TESTS === "1";

describe.skipIf(!RUN)("VxTwitter 翻訳の実 API", () => {
  const adapter = new VxTwitterAdapter();
  const TIMEOUT = process.env.CI === "true" ? 30000 : 15000;

  it.each(["en-US", "ko", "zh-TW", "pt-BR", "no"])(
    "Discord の locale %s から変換した言語で、その言語の翻訳が返る",
    async (locale) => {
      const lang = toVxTranslationLang(locale) ?? "";

      const tweet = await adapter.fetchTranslatedTweet(TEST_URLS.NORMAL_TWEET, lang);

      expect(tweet).toBeDefined();
      expect(tweet?.translation?.text).toBeTruthy();
      expect(isSameLanguage(tweet?.translation?.targetLang ?? "", lang)).toBe(true);
    },
    TIMEOUT
  );

  it(
    "引用元の翻訳も同じ言語で返る",
    async () => {
      const tweet = await adapter.fetchTranslatedTweet(TEST_URLS.QUOTE_TWEET, "en");

      expect(tweet?.quote).toBeDefined();
      expect(tweet?.quote?.translation?.text).toBeTruthy();
      expect(tweet?.quote?.translation?.targetLang).toBe("en");
    },
    TIMEOUT
  );

  it(
    "ポストと同じ言語を頼むと翻訳は返らず、ポストの言語が分かる",
    async () => {
      const tweet = await adapter.fetchTranslatedTweet(TEST_URLS.NORMAL_TWEET, "ja");

      expect(tweet).toBeDefined();
      expect(tweet?.translation).toBeUndefined();
      expect(tweet?.lang).toBe("ja");
    },
    TIMEOUT
  );
});
