import { describe, expect, it } from "vitest";
import { ComponentType, Locale } from "discord.js";

import { buildLanguageMenuRow, LANGUAGE_LABELS, menuLanguages } from "#/adapters/discord/translationLanguageMenu.js";
import { isVxTranslationLanguage, toVxTranslationLang } from "#/adapters/twitter/vxTranslationLang.js";

const URL = "https://x.com/test_user/status/123456789";

/** メニュー行の JSON から選択肢を取り出す */
const optionsOf = (current: string | undefined) => {
  const json = buildLanguageMenuRow(URL, current).toJSON();
  const menu = json.components[0];
  return menu.type === ComponentType.StringSelect ? menu.options : [];
};

describe("menuLanguages", () => {
  it("セレクトメニューの上限（25個）に収める", () => {
    expect(menuLanguages(undefined).length).toBeLessThanOrEqual(25);
    expect(menuLanguages("bg").length).toBeLessThanOrEqual(25);
  });

  it("すべて VxTwitter が受け付ける言語コードにする", () => {
    for (const code of menuLanguages(undefined)) {
      expect(isVxTranslationLanguage(code)).toBe(true);
    }
  });

  it("今の言語を先頭に置き、重複させない", () => {
    const languages = menuLanguages("ko");

    expect(languages[0]).toBe("ko");
    expect(languages.filter((code) => code === "ko")).toHaveLength(1);
  });

  it("一覧から外した言語でも、今の言語なら先頭に入れる", () => {
    const languages = menuLanguages("bg");

    expect(languages[0]).toBe("bg");
    expect(languages.length).toBeLessThanOrEqual(25);
  });

  it.each(Object.values(Locale))("Discord の locale %s の言語には表示名がある", (locale) => {
    // 押した人の言語は一覧から外していても先頭に入れるため、表示名が要る
    const code = toVxTranslationLang(locale);

    expect(code && LANGUAGE_LABELS[code]).toBeTruthy();
  });
});

describe("buildLanguageMenuRow", () => {
  it("言語メニューの customId を付ける", () => {
    const json = buildLanguageMenuRow(URL, "en").toJSON();

    expect(JSON.stringify(json)).toContain('"custom_id":"translate_lang:test_user:123456789"');
  });

  it("今の言語を選択済みにする", () => {
    const defaults = optionsOf("en").filter((option) => option.default);

    expect(defaults.map((option) => option.value)).toEqual(["en"]);
  });

  it("今の言語が無ければ何も選択済みにしない", () => {
    expect(optionsOf(undefined).some((option) => option.default)).toBe(false);
  });

  it("選択肢の文言はその言語での名前にする", () => {
    const ja = optionsOf(undefined).find((option) => option.value === "ja");

    expect(ja?.label).toBe("日本語");
  });
});
