/**
 * VxTwitter が翻訳先として受け付ける言語コード
 *
 * BetterTwitFix の translation.py の validLanguages を写したもの。
 * パス末尾の言語がこの一覧（大文字・小文字は区別しない）に無いと、
 * 翻訳先として扱われず translation は null になる。
 *
 * 出典: https://github.com/dylanpdx/BetterTwitFix/blob/d75cb1aad8a2162df2b9c182d36bf15797068656/translation.py
 */
// 上流の一覧と見比べやすいよう、1行に1要素へ展開しない
// prettier-ignore
export const VX_TRANSLATION_LANGUAGES: readonly string[] = [
  "AF", "AN", "AR", "AS", "AY", "AZ", "BA", "BE", "BG", "BN", "BR", "BS", "CA", "CS", "CY", "DA", "DE", "DE-DE",
  "EL", "EN", "EO", "ES", "ES-419", "ET", "EU", "FA", "FI", "FR", "FR-FR", "GA", "GL", "GN", "GU", "HA", "HE",
  "HI", "HR", "HT", "HU", "HY", "ID", "IG", "IS", "IT", "JA", "JV", "KA", "KK", "KO", "KY", "LA", "LB", "LN",
  "LT", "LV", "MG", "MI", "MK", "ML", "MN", "MR", "MS", "MT", "MY", "NB", "NE", "NL", "OC", "OM", "PA", "PL",
  "PS", "PT-BR", "PT-PT", "QU", "RO", "RU", "SA", "SK", "SL", "SQ", "SR", "ST", "SU", "SV", "SW", "TA", "TE",
  "TG", "TH", "TK", "TL", "TN", "TR", "TS", "TT", "UK", "UR", "UZ", "VI", "WO", "XH", "YI", "ZH", "ZH-HANS",
  "ZH-HANT", "ZU",
];

const SUPPORTED = new Set(VX_TRANSLATION_LANGUAGES);

/**
 * 一覧に、名前の違う対応先がある locale
 *
 * zh-CN は一覧に無く、ZH を指定すると X の翻訳で英語が返ることがあるため、
 * 文字体系で明示する。
 */
const ALIASES: Readonly<Record<string, string>> = {
  "ZH-CN": "ZH-HANS",
  "ZH-TW": "ZH-HANT",
  NO: "NB",
};

/**
 * Discord の locale を VxTwitter の翻訳先の言語コードへ変換する
 *
 * 1. locale がそのまま一覧にあれば使う（pt-BR、es-419 など）
 * 2. 名前の違う対応先があれば使う（zh-CN → zh-Hans など）
 * 3. 地域を落として一覧にあれば使う（en-US → en など）
 *
 * 変換結果は URL のパスに入る。一覧にある値しか返さないため、
 * 不正な入力（"ja/../x" など）は一覧に当たらず undefined になる。
 *
 * @returns 対応する言語が無い場合は undefined
 */
export const toVxTranslationLang = (locale: string): string | undefined => {
  const upper = locale.toUpperCase();
  const candidates = [upper, ALIASES[upper], primaryLanguage(upper)];
  const found = candidates.find((code) => code !== undefined && SUPPORTED.has(code));
  return found?.toLowerCase();
};

/**
 * VxTwitter が翻訳先として受け付ける言語コードか（大文字・小文字は区別しない）
 */
export const isVxTranslationLanguage = (code: string): boolean => SUPPORTED.has(code.toUpperCase());

/**
 * 2つの言語コードが同じ言語を指すか
 *
 * 大文字・小文字や地域・文字体系の違いは無視し、言語そのもので比べる。
 * VxTwitter は destination_language を "KO" や "zh-hant" のように揺れた形で返すため。
 */
export const isSameLanguage = (a: string, b: string): boolean =>
  primaryLanguage(a).toLowerCase() === primaryLanguage(b).toLowerCase();

const primaryLanguage = (code: string): string => code.split("-")[0];
