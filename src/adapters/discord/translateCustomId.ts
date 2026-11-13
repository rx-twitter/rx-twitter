/**
 * 翻訳ボタンと言語メニューの customId
 *
 * 押されたときに取得先を復元できるよう、スクリーンネームとポストIDを埋め込む。
 * 待ち受けはメッセージに縛られない集約ハンドラで行うため（ADR 0009）、
 * 操作に必要な情報はすべて customId に持たせる。
 *
 * 形式:
 * - ボタン: `translate:{screenName}:{tweetId}`
 * - 言語メニュー: `translate_lang:{screenName}:{tweetId}`（選んだ言語は選択肢の値で届く）
 */
export type TranslateComponentKind = "button" | "menu";

const PREFIXES: Readonly<Record<TranslateComponentKind, string>> = {
  button: "translate",
  menu: "translate_lang",
};

export interface TranslateTarget {
  kind: TranslateComponentKind;
  /** 取得先のポストの URL */
  url: string;
}

/** X のスクリーンネームは英数字と _ の15文字以内、ポストIDは数字 */
const POST_URL_PATTERN = /^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/([0-9]{1,20})(?:[/?#]|$)/;
const CUSTOM_ID_PATTERN = /^(translate|translate_lang):([A-Za-z0-9_]{1,15}):([0-9]{1,20})$/;

/**
 * ポストの URL から customId を作る
 *
 * @returns ポストの URL でない場合（記事 URL など）は undefined
 */
export const buildTranslateCustomId = (url: string, kind: TranslateComponentKind): string | undefined => {
  const match = POST_URL_PATTERN.exec(url);
  return match ? `${PREFIXES[kind]}:${match[1]}:${match[2]}` : undefined;
};

/**
 * customId から種類と取得先の URL を復元する
 *
 * customId は Discord から届く入力なので、形式を厳密に検証し、
 * 検証済みの部品からだけ URL を組み立てる。
 *
 * @returns 翻訳の customId でない場合は undefined
 */
export const parseTranslateCustomId = (customId: string): TranslateTarget | undefined => {
  const match = CUSTOM_ID_PATTERN.exec(customId);
  if (!match) {
    return undefined;
  }

  return {
    kind: match[1] === PREFIXES.menu ? "menu" : "button",
    url: `https://x.com/${match[2]}/status/${match[3]}`,
  };
};
