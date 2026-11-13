import { describe, expect, it } from "vitest";
import { Locale } from "discord.js";

import {
  isSameLanguage,
  isVxTranslationLanguage,
  toVxTranslationLang,
  VX_TRANSLATION_LANGUAGES,
} from "#/adapters/twitter/vxTranslationLang.js";

describe("toVxTranslationLang", () => {
  it.each([
    ["ja", "ja"],
    ["ko", "ko"],
    ["en-US", "en"], // EN-US は一覧に無い
    ["en-GB", "en"],
    ["es-ES", "es"],
    ["es-419", "es-419"], // 一覧にそのままある
    ["sv-SE", "sv"],
    ["pt-BR", "pt-br"], // PT は一覧に無い
    ["zh-CN", "zh-hans"], // ZH-CN は一覧に無く、ZH では英語が返ることがある
    ["zh-TW", "zh-hant"],
    ["no", "nb"], // NO は一覧に無い
  ])("%s を %s にする", (locale, expected) => {
    expect(toVxTranslationLang(locale)).toBe(expected);
  });

  it.each(Object.values(Locale))("Discord の locale %s は一覧にある言語へ変換できる", (locale) => {
    // Discord が locale を増やしたときに、翻訳できない言語が生まれたことに気づけるようにする
    const lang = toVxTranslationLang(locale);

    expect(lang).toBeDefined();
    expect(VX_TRANSLATION_LANGUAGES).toContain(lang?.toUpperCase());
  });

  it("一覧に無い言語は undefined にする", () => {
    expect(toVxTranslationLang("xx-YY")).toBeUndefined();
  });

  it.each(["", "ja/../x", "ja?x=1", "日本語", "a"])("言語コードとして不正な %j は undefined にする", (locale) => {
    // 変換結果は URL のパスに入るため、形式を満たさないものは通さない
    expect(toVxTranslationLang(locale)).toBeUndefined();
  });
});

describe("isSameLanguage", () => {
  it.each([
    ["ja", "ja"],
    ["en", "EN"], // DeepL 経由の翻訳では destination_language が大文字で返る
    ["zh", "zh-hans"],
    ["zh-hant", "zh-Hant"],
    ["pt", "pt-br"],
  ])("%s と %s は同じ言語とみなす", (a, b) => {
    expect(isSameLanguage(a, b)).toBe(true);
  });

  it.each([
    ["ja", "en"],
    ["en", "lt"], // 頼んだ言語と違う言語で返ってくることがある
  ])("%s と %s は別の言語とみなす", (a, b) => {
    expect(isSameLanguage(a, b)).toBe(false);
  });
});

describe("isVxTranslationLanguage", () => {
  it.each(["ja", "en", "zh-hans", "pt-br", "ZH-HANT"])("一覧にある %s は受け付ける", (code) => {
    expect(isVxTranslationLanguage(code)).toBe(true);
  });

  // セレクトメニューの値は Discord から届く入力なので、一覧に無いものは通さない
  it.each(["", "en-us", "zh-cn", "ja/../x", "xx"])("一覧に無い %j は受け付けない", (code) => {
    expect(isVxTranslationLanguage(code)).toBe(false);
  });
});
