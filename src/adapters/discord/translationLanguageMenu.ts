import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";

import { buildTranslateCustomId } from "./translateCustomId.js";

/** セレクトメニューに載せられる選択肢の上限。Discord の制約に合わせる */
const MAX_MENU_OPTIONS = 25;

const MENU_PLACEHOLDER = "別の言語で読む";

/**
 * 言語の表示名（その言語での名前）
 *
 * キーは VxTwitter の言語コード（小文字）。Discord の locale から変換される
 * すべての言語を持つ。押した人の言語は、メニューの一覧から外していても先頭に入れるため。
 */
export const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  ja: "日本語",
  en: "English",
  ko: "한국어",
  "zh-hans": "简体中文",
  "zh-hant": "繁體中文",
  es: "Español",
  "es-419": "Español (Latinoamérica)",
  "pt-br": "Português (Brasil)",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  ru: "Русский",
  uk: "Українська",
  pl: "Polski",
  nl: "Nederlands",
  sv: "Svenska",
  nb: "Norsk",
  da: "Dansk",
  fi: "Suomi",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  th: "ไทย",
  id: "Bahasa Indonesia",
  hi: "हिन्दी",
  cs: "Čeština",
  el: "Ελληνικά",
  bg: "Български",
  hr: "Hrvatski",
  hu: "Magyar",
  ro: "Română",
  lt: "Lietuvių",
};

/**
 * メニューに並べる言語（並び順どおり）
 *
 * Discord の locale から作れる言語は25個を超えるため、利用の多そうな言語に絞る。
 * 外したのは es-419（es にまとめる）、lt（実 API で英語の翻訳が返った）、
 * bg・hr・hu・ro。
 */
const MENU_LANGUAGES: readonly string[] = [
  "ja",
  "en",
  "ko",
  "zh-hans",
  "zh-hant",
  "es",
  "pt-br",
  "fr",
  "de",
  "it",
  "ru",
  "uk",
  "pl",
  "nl",
  "sv",
  "nb",
  "da",
  "fi",
  "tr",
  "vi",
  "th",
  "id",
  "hi",
  "cs",
  "el",
];

/**
 * メニューに並べる言語を決める
 *
 * 今表示している言語を先頭に置く。一覧から外した言語でも先頭に入れ、
 * 上限を超える分は末尾から削る。
 */
export const menuLanguages = (current: string | undefined): string[] => {
  const head = current && LANGUAGE_LABELS[current] ? [current] : [];
  return [...head, ...MENU_LANGUAGES.filter((code) => code !== current)].slice(0, MAX_MENU_OPTIONS);
};

/**
 * 翻訳の返答に付ける「別の言語で読む」メニュー
 *
 * @param url 翻訳するポストの URL
 * @param current 今表示している翻訳の言語。選択済みとして示す
 */
export const buildLanguageMenuRow = (
  url: string,
  current: string | undefined
): ActionRowBuilder<StringSelectMenuBuilder> => {
  const options = menuLanguages(current).map((code) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(LANGUAGE_LABELS[code] ?? code)
      .setValue(code)
      .setDefault(code === current)
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(buildTranslateCustomId(url, "menu") ?? "")
    .setPlaceholder(MENU_PLACEHOLDER)
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
};
