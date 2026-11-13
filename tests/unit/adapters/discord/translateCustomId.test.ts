import { describe, expect, it } from "vitest";

import { buildTranslateCustomId, parseTranslateCustomId } from "#/adapters/discord/translateCustomId.js";

describe("translateCustomId", () => {
  describe("buildTranslateCustomId", () => {
    it.each([
      ["https://x.com/test_user/status/1234567890", "translate:test_user:1234567890"],
      ["https://twitter.com/Test_User/status/1234567890", "translate:Test_User:1234567890"],
      ["https://x.com/test_user/status/1234567890?s=20", "translate:test_user:1234567890"],
    ])("ボタンの customId を %s から作る", (url, expected) => {
      expect(buildTranslateCustomId(url, "button")).toBe(expected);
    });

    it("言語メニューの customId はボタンと別の接頭辞にする", () => {
      expect(buildTranslateCustomId("https://x.com/test_user/status/1234567890", "menu")).toBe(
        "translate_lang:test_user:1234567890"
      );
    });

    it.each(["https://x.com/i/article/1234567890", "https://example.com/test_user/status/1", "not a url"])(
      "ポストの URL でなければ undefined にする: %s",
      (url) => {
        expect(buildTranslateCustomId(url, "button")).toBeUndefined();
      }
    );

    it("Discord の customId の上限（100文字）に収まる", () => {
      const id = buildTranslateCustomId(`https://x.com/${"a".repeat(15)}/status/${"9".repeat(20)}`, "menu");

      expect(id?.length).toBeLessThanOrEqual(100);
    });
  });

  describe("parseTranslateCustomId", () => {
    it.each(["button", "menu"] as const)("%s の customId から種類と取得先の URL を復元する", (kind) => {
      const id = buildTranslateCustomId("https://twitter.com/test_user/status/1234567890?s=20", kind);

      expect(parseTranslateCustomId(id ?? "")).toEqual({
        kind,
        url: "https://x.com/test_user/status/1234567890",
      });
    });

    // customId は Discord から届く入力なので、想定外の形は通さない
    it.each([
      "reveal_spoiler_123",
      "translate:",
      "translate:test_user",
      "translate:test_user:abc",
      "translate:a_name_that_is_too_long:123",
      "translate:test_user:123:extra",
      "translate:../evil:123",
      "translate:test_user:123/../../x",
      "xtranslate:test_user:123",
      "translate_other:test_user:123",
    ])("想定外の形は undefined にする: %s", (customId) => {
      expect(parseTranslateCustomId(customId)).toBeUndefined();
    });
  });
});
