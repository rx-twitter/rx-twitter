import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { MessageFlags, type Interaction } from "discord.js";

import {
  formatTranslationReply,
  TRANSLATION_ALREADY_IN_LANGUAGE,
  TRANSLATION_FAILED,
  TRANSLATION_PART_FAILED,
  TranslationInteractionHandler,
} from "#/adapters/discord/TranslationInteractionHandler.js";
import { buildLanguageMenuRow } from "#/adapters/discord/translationLanguageMenu.js";
import type { ITweetTranslationAdapter } from "#/adapters/twitter/BaseTwitterAdapter.js";
import type { Tweet } from "#/core/models/Tweet.js";
import logger from "#/utils/logger.js";
import { createMockTweet, createMockTweetAuthor } from "../../../fixtures/mock-tweets.js";

const POST_URL = "https://x.com/test_user/status/123456789";

const translatedTweet = createMockTweet({
  text: "こんにちは",
  lang: "ja",
  translation: { text: "Hello", sourceLang: "ja", targetLang: "en" },
});

/** interaction を、ハンドラが使う部分だけ用意する */
const createInteraction = (
  overrides: { kind?: "button" | "menu" | "other"; customId?: string; locale?: string; values?: string[] } = {}
) => {
  const kind = overrides.kind ?? "button";
  const interaction = {
    isButton: () => kind === "button",
    isStringSelectMenu: () => kind === "menu",
    customId:
      overrides.customId ??
      (kind === "menu" ? "translate_lang:test_user:123456789" : "translate:test_user:123456789"),
    locale: overrides.locale ?? "en-US",
    values: overrides.values ?? [],
    deferred: false,
    replied: false,
    deferReply: vi.fn(async () => {
      interaction.deferred = true;
    }),
    deferUpdate: vi.fn(async () => {
      interaction.deferred = true;
    }),
    editReply: vi.fn(async () => undefined),
    reply: vi.fn(async () => undefined),
  };
  return interaction;
};

const asInteraction = (i: ReturnType<typeof createInteraction>) => i as unknown as Interaction;

/** editReply に渡したメニューの JSON */
const menuJsonOf = (i: ReturnType<typeof createInteraction>) => {
  const payload = i.editReply.mock.calls[0]?.[0] as unknown as { components: { toJSON(): unknown }[] };
  return JSON.stringify(payload.components.map((c) => c.toJSON()));
};

describe("TranslationInteractionHandler", () => {
  let adapter: { fetchTranslatedTweet: ReturnType<typeof vi.fn<ITweetTranslationAdapter["fetchTranslatedTweet"]>> };
  let handler: TranslationInteractionHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = { fetchTranslatedTweet: vi.fn<ITweetTranslationAdapter["fetchTranslatedTweet"]>() };
    handler = new TranslationInteractionHandler(adapter);
  });

  describe("翻訳ボタン", () => {
    it("押した人の locale を VxTwitter の言語コードに変えて取得する", async () => {
      adapter.fetchTranslatedTweet.mockResolvedValue(translatedTweet);

      await handler.handle(asInteraction(createInteraction({ locale: "zh-TW" })));

      expect(adapter.fetchTranslatedTweet).toHaveBeenCalledWith(POST_URL, "zh-hant");
    });

    it("翻訳と言語メニューを、押した人にだけ見えるエフェメラルで返す", async () => {
      adapter.fetchTranslatedTweet.mockResolvedValue(translatedTweet);
      const interaction = createInteraction();

      await handler.handle(asInteraction(interaction));

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: formatTranslationReply(translatedTweet, "en"),
        components: [expect.anything()],
        allowedMentions: { parse: [] },
      });
      expect(menuJsonOf(interaction)).toBe(JSON.stringify([buildLanguageMenuRow(POST_URL, "en").toJSON()]));
    });
  });

  describe("言語メニュー", () => {
    it("選んだ言語で取得し、同じエフェメラルを書き換える", async () => {
      adapter.fetchTranslatedTweet.mockResolvedValue(translatedTweet);
      const interaction = createInteraction({ kind: "menu", values: ["ko"] });

      await handler.handle(asInteraction(interaction));

      expect(adapter.fetchTranslatedTweet).toHaveBeenCalledWith(POST_URL, "ko");
      expect(interaction.deferUpdate).toHaveBeenCalled();
      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(menuJsonOf(interaction)).toBe(JSON.stringify([buildLanguageMenuRow(POST_URL, "ko").toJSON()]));
    });

    it("VxTwitter が受け付けない値は取得せず、失敗を返す", async () => {
      // 選択肢の値は Discord から届く入力なので、一覧に無いものは使わない
      const interaction = createInteraction({ kind: "menu", values: ["ja/../x"] });

      await handler.handle(asInteraction(interaction));

      expect(adapter.fetchTranslatedTweet).not.toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: TRANSLATION_FAILED }));
    });
  });

  it.each([
    ["スポイラーのボタン", createInteraction({ customId: "reveal_spoiler_123" })],
    ["ボタンの customId を持つメニュー", createInteraction({ kind: "menu", customId: "translate:test_user:1" })],
    ["メニューの customId を持つボタン", createInteraction({ customId: "translate_lang:test_user:1" })],
    ["ボタンでもメニューでもない", createInteraction({ kind: "other" })],
  ])("%s は無視する", async (_, interaction) => {
    await handler.handle(asInteraction(interaction));

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.deferUpdate).not.toHaveBeenCalled();
    expect(adapter.fetchTranslatedTweet).not.toHaveBeenCalled();
  });

  it("取得中の例外は記録して、失敗を返す", async () => {
    adapter.fetchTranslatedTweet.mockRejectedValue(new Error("boom"));
    const interaction = createInteraction();

    await expect(handler.handle(asInteraction(interaction))).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ error: "boom", customId: "translate:test_user:123456789" })
    );
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: TRANSLATION_FAILED }));
  });

  it("応答の遅延に失敗しても例外を外へ出さない", async () => {
    // interaction の期限切れなど。Bot は止めない
    const interaction = createInteraction();
    interaction.deferReply.mockRejectedValue(new Error("Unknown interaction"));

    await expect(handler.handle(asInteraction(interaction))).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe("formatTranslationReply", () => {
  const quoted = (overrides: Partial<Tweet> = {}): Tweet =>
    createMockTweet({
      author: createMockTweetAuthor({ id: "quoted_user" }),
      text: "引用元",
      lang: "ja",
      translation: { text: "Quoted", sourceLang: "ja", targetLang: "en" },
      ...overrides,
    });

  it("原文の下に、翻訳元と翻訳先を添えて翻訳を並べる", () => {
    expect(formatTranslationReply(translatedTweet, "en")).toBe(
      "こんにちは\n\n:globe_with_meridians: 翻訳 (ja → en)\nHello"
    );
  });

  it("引用元があれば、本文のあとに引用元の原文と翻訳を並べる", () => {
    const tweet = { ...translatedTweet, quote: quoted() };

    expect(formatTranslationReply(tweet, "en")).toBe(
      [
        "こんにちは",
        "",
        ":globe_with_meridians: 翻訳 (ja → en)",
        "Hello",
        "",
        "QT: @quoted_user",
        "引用元",
        "",
        ":globe_with_meridians: 翻訳 (ja → en)",
        "Quoted",
      ].join("\n")
    );
  });

  it("引用元がすでに押した人の言語なら、引用元は原文だけ載せる", () => {
    const tweet = { ...translatedTweet, quote: quoted({ lang: "en", text: "Already English", translation: undefined }) };

    expect(formatTranslationReply(tweet, "en")).toBe(
      "こんにちは\n\n:globe_with_meridians: 翻訳 (ja → en)\nHello\n\nQT: @quoted_user\nAlready English"
    );
  });

  it("本文が空なら、引用元だけを載せる", () => {
    const tweet = createMockTweet({ text: "", lang: "zxx", quote: quoted() });

    expect(formatTranslationReply(tweet, "en")).toBe(
      "QT: @quoted_user\n引用元\n\n:globe_with_meridians: 翻訳 (ja → en)\nQuoted"
    );
  });

  it("片方だけ翻訳できなかったら、その部分に取得できなかったと添える", () => {
    const tweet = { ...translatedTweet, quote: quoted({ lang: "lt", translation: undefined }) };

    expect(formatTranslationReply(tweet, "en")).toBe(
      `こんにちは\n\n:globe_with_meridians: 翻訳 (ja → en)\nHello\n\nQT: @quoted_user\n引用元\n${TRANSLATION_PART_FAILED}`
    );
  });

  it.each([false, true])("2000字に収める（引用元あり: %s）", (withQuote) => {
    const long = (sourceLang: string) =>
      createMockTweet({
        text: "あ".repeat(4000),
        lang: sourceLang,
        translation: { text: "a".repeat(4000), sourceLang, targetLang: "en" },
      });
    const tweet = withQuote ? { ...long("ja"), quote: long("ko") } : long("ja");

    const reply = formatTranslationReply(tweet, "en");

    expect(reply.length).toBeLessThanOrEqual(2000);
    expect(reply).toContain(":globe_with_meridians: 翻訳 (ja → en)");
    if (withQuote) {
      expect(reply).toContain(":globe_with_meridians: 翻訳 (ko → en)");
    }
  });

  describe("文字数の割り振り", () => {
    const post = (text: string, translation: string, sourceLang = "ja"): Tweet =>
      createMockTweet({ text, lang: sourceLang, translation: { text: translation, sourceLang, targetLang: "en" } });

    it("本文が短ければ、余った枠を引用元に回して最後まで載せる", () => {
      // 半分ずつ固定で分けると、引用元の翻訳が 500 字で切られていた
      const quoteText = "引".repeat(600);
      const quoteTranslation = "q".repeat(900);
      const tweet = { ...post("短い", "Short"), quote: post(quoteText, quoteTranslation) };

      const reply = formatTranslationReply(tweet, "en");

      expect(reply).toContain(quoteText);
      expect(reply).toContain(quoteTranslation);
      expect(reply).not.toContain("...");
    });

    it("引用元が短ければ、余った枠を本文に回して最後まで載せる", () => {
      const text = "本".repeat(600);
      const translation = "m".repeat(900);
      const tweet = { ...post(text, translation), quote: post("短い", "Short") };

      const reply = formatTranslationReply(tweet, "en");

      expect(reply).toContain(text);
      expect(reply).toContain(translation);
    });

    it("収まらなければ、原文より翻訳を優先して残す", () => {
      // 原文は元のポストで読めるが、翻訳はこの返答でしか読めない
      const reply = formatTranslationReply(post("あ".repeat(4000), "a".repeat(4000)), "en");

      const originalLength = reply.split("あ").length - 1;
      const translationLength = reply.split("a").length - 1;
      expect(translationLength).toBeGreaterThan(originalLength);
    });

    it("収まらなくても、原文は先頭の一部を残す", () => {
      const reply = formatTranslationReply(post("あ".repeat(4000), "a".repeat(4000)), "en");

      expect(reply.startsWith("あ".repeat(100))).toBe(true);
    });

    it("収まる分は切らない", () => {
      const text = "あ".repeat(800);
      const translation = "a".repeat(1000);

      const reply = formatTranslationReply(post(text, translation), "en");

      expect(reply).toBe(`${text}\n\n:globe_with_meridians: 翻訳 (ja → en)\n${translation}`);
    });
  });

  it.each([
    ["ja", "ja"],
    ["en", "en"],
    ["zh", "zh-hant"],
  ])("どこも翻訳されず、ポストの言語 %s が %s と同じなら、そう伝える", (lang, target) => {
    const tweet = createMockTweet({ lang, translation: undefined });

    expect(formatTranslationReply(tweet, target)).toBe(TRANSLATION_ALREADY_IN_LANGUAGE);
  });

  it("本文と引用元のどちらも同じ言語なら、そう伝える", () => {
    const tweet = createMockTweet({ lang: "en", quote: quoted({ lang: "en", translation: undefined }) });

    expect(formatTranslationReply(tweet, "en")).toBe(TRANSLATION_ALREADY_IN_LANGUAGE);
  });

  it("本文は同じ言語でも、引用元を翻訳できなければ取得できなかったと伝える", () => {
    // 「すでにあなたの言語」と返すと、引用元が読めないことに気づけない
    const tweet = createMockTweet({ lang: "en", quote: quoted({ lang: "lt", translation: undefined }) });

    expect(formatTranslationReply(tweet, "en")).toBe(TRANSLATION_FAILED);
  });

  it("どこも翻訳されず、言語も違うなら取得できなかったと伝える", () => {
    const tweet = createMockTweet({ lang: "lt", translation: undefined });

    expect(formatTranslationReply(tweet, "ja")).toBe(TRANSLATION_FAILED);
  });

  it.each([
    ["ポストを取得できない", undefined, "ja"],
    ["言語が決まらない", translatedTweet, undefined],
  ])("%s なら取得できなかったと伝える", (_, tweet, lang) => {
    expect(formatTranslationReply(tweet, lang)).toBe(TRANSLATION_FAILED);
  });
});
