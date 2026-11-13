import { MessageFlags, type ButtonInteraction, type Interaction, type StringSelectMenuInteraction } from "discord.js";

import type { ITweetTranslationAdapter } from "#/adapters/twitter/BaseTwitterAdapter.js";
import { isSameLanguage, isVxTranslationLanguage, toVxTranslationLang } from "#/adapters/twitter/vxTranslationLang.js";
import type { Tweet } from "#/core/models/Tweet.js";
import logger from "#/utils/logger.js";

import { parseTranslateCustomId } from "./translateCustomId.js";
import { buildLanguageMenuRow } from "./translationLanguageMenu.js";
import { ownTweetText, QUOTE_PREFIX, truncate } from "./tweetText.js";

/** 翻訳を取得できなかったときの返答 */
export const TRANSLATION_FAILED = "翻訳を取得できませんでした。";

/** ポストが押した人の言語で書かれていたときの返答 */
export const TRANSLATION_ALREADY_IN_LANGUAGE = "このポストは、すでにあなたの言語で書かれています。";

/** 本文と引用元のうち、片方だけ翻訳できなかったときに添える一文 */
export const TRANSLATION_PART_FAILED = "-# 翻訳を取得できませんでした";

/** メッセージ本文の上限。Discord の制約に合わせる */
const MAX_REPLY_LENGTH = 2000;

/**
 * 収まらないときでも原文に残す文字数
 *
 * 枠は翻訳を優先して割り振るが、どの部分の訳なのか分かるよう、原文の先頭は残す。
 */
const MIN_ORIGINAL_LENGTH = 200;

type TranslateInteraction = ButtonInteraction | StringSelectMenuInteraction;

/**
 * 翻訳ボタンと言語メニューの操作を受け、翻訳をエフェメラルで返す
 *
 * - ボタン: 押した人の Discord の表示言語へ翻訳し、エフェメラルで返す
 * - 言語メニュー: 返答に付けたメニューで選ばれた言語へ翻訳し、同じ返答を書き換える
 *
 * 起動時に1つだけ登録する集約ハンドラとして使う（ADR 0009）。
 * 操作の時点で翻訳付きのポストを取得し直すため、操作ごとの状態は持たない。
 * そのためボタンに期限は無く、Bot の再起動をまたいでも使える。
 */
export class TranslationInteractionHandler {
  constructor(private readonly adapter: ITweetTranslationAdapter) {}

  async handle(interaction: Interaction): Promise<void> {
    const target = targetOf(interaction);
    if (!target) {
      return;
    }
    const { component, url } = target;

    try {
      const lang = await this.acknowledge(component);
      const tweet = lang ? await this.adapter.fetchTranslatedTweet(url, lang) : undefined;
      await component.editReply({
        content: formatTranslationReply(tweet, lang),
        components: [buildLanguageMenuRow(url, lang)],
        // 原文にメンションが含まれていても通知を飛ばさない
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      logger.error("TranslationInteractionHandler: Failed to reply translation", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        customId: component.customId,
        locale: component.locale,
      });
      await this.replyFailure(component, url);
    }
  }

  /**
   * 応答を遅延させ、翻訳先の言語を決める
   *
   * ボタンは新しいエフェメラルで返し、メニューは自分の載っている返答を書き換える。
   *
   * @returns 翻訳先の言語コード。決まらなければ undefined
   */
  private async acknowledge(component: TranslateInteraction): Promise<string | undefined> {
    if (component.isButton()) {
      await component.deferReply({ flags: MessageFlags.Ephemeral });
      return toVxTranslationLang(component.locale);
    }

    await component.deferUpdate();
    // 選択肢の値は Discord から届く入力なので、一覧にあるものしか使わない
    const value = component.values[0];
    return value !== undefined && isVxTranslationLanguage(value) ? value.toLowerCase() : undefined;
  }

  /**
   * 失敗を伝える。interaction の期限切れなどで伝えられない場合は諦める
   */
  private async replyFailure(component: TranslateInteraction, url: string): Promise<void> {
    try {
      if (component.deferred || component.replied) {
        await component.editReply({
          content: TRANSLATION_FAILED,
          components: [buildLanguageMenuRow(url, undefined)],
          allowedMentions: { parse: [] },
        });
      } else {
        await component.reply({ content: TRANSLATION_FAILED, flags: MessageFlags.Ephemeral });
      }
    } catch (error) {
      logger.debug("TranslationInteractionHandler: Failed to reply failure", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * 翻訳の操作であれば、その interaction と取得先を返す
 *
 * ボタンにはボタンの customId、メニューにはメニューの customId が付いているものだけを扱う。
 */
const targetOf = (interaction: Interaction): { component: TranslateInteraction; url: string } | undefined => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) {
    return undefined;
  }

  const parsed = parseTranslateCustomId(interaction.customId);
  const expectedKind = interaction.isButton() ? "button" : "menu";
  if (!parsed || parsed.kind !== expectedKind) {
    return undefined;
  }
  return { component: interaction, url: parsed.url };
};

/** 本文または引用元の、翻訳の状態 */
type PartStatus = "translated" | "same" | "failed";

/** 文字数の割り振りに応じて切り詰める本文 */
interface Segment {
  kind: "original" | "translation";
  text: string;
}

/** 返答の1行。固定の文字列か、切り詰め対象の本文 */
type Line = string | Segment;

interface Part {
  lines: Line[];
  status: PartStatus;
}

/**
 * 翻訳の返答を組み立てる
 *
 * 本文、引用元の順に、原文の下へ翻訳元と翻訳先を添えて翻訳を並べる。
 * すでに翻訳先の言語で書かれている部分は原文だけ、翻訳できなかった部分には
 * その旨を添える。どこも翻訳されなかった場合は、すでに押した人の言語で
 * 書かれているか、取得に失敗したかだけを伝える。
 *
 * VxTwitter は翻訳元と同じ言語を頼むと translation を返さないため、
 * ポストの言語と比べて見分ける。
 *
 * 文字数は allocateLengths で割り振る。
 *
 * @param lang 翻訳先の言語コード
 */
export const formatTranslationReply = (tweet: Tweet | undefined, lang: string | undefined): string => {
  if (!tweet || !lang) {
    return TRANSLATION_FAILED;
  }

  const quote = tweet.quote && tweet.quote.text.trim() !== "" ? tweet.quote : undefined;
  const ownText = ownTweetText(tweet);
  const main = ownText.trim() === "" ? undefined : formatPart(ownText, tweet, lang);
  const quotePart = quote && formatPart(quote.text, quote, lang);
  const parts = [main, quotePart].filter((part): part is Part => part !== undefined);

  if (!parts.some((part) => part.status === "translated")) {
    return parts.length > 0 && parts.every((part) => part.status === "same")
      ? TRANSLATION_ALREADY_IN_LANGUAGE
      : TRANSLATION_FAILED;
  }

  const quoteLines: Line[] = quote && quotePart ? [`${QUOTE_PREFIX}@${quote.author.id}`, ...quotePart.lines] : [];
  const lines: Line[] = [...(main?.lines ?? []), ...(main && quotePart ? [""] : []), ...quoteLines];
  return renderLines(lines);
};

const formatPart = (text: string, post: Tweet, lang: string): Part => {
  const original: Segment = { kind: "original", text };

  if (post.translation) {
    const { sourceLang, targetLang } = post.translation;
    return {
      lines: [
        original,
        "",
        `:globe_with_meridians: 翻訳 (${sourceLang} → ${targetLang})`,
        { kind: "translation", text: post.translation.text },
      ],
      status: "translated",
    };
  }

  if (post.lang && isSameLanguage(post.lang, lang)) {
    return { lines: [original], status: "same" };
  }
  return { lines: [original, TRANSLATION_PART_FAILED], status: "failed" };
};

/**
 * 行を、本文の上限に収まるよう切り詰めて連結する
 */
const renderLines = (lines: readonly Line[]): string => {
  const segments = lines.filter((line): line is Segment => typeof line !== "string");
  const fixedLength =
    lines.reduce((sum, line) => sum + (typeof line === "string" ? line.length : 0), 0) + (lines.length - 1);
  const allocations = allocateLengths(segments, MAX_REPLY_LENGTH - fixedLength);

  return lines
    .map((line) => (typeof line === "string" ? line : truncate(line.text, allocations.get(line) ?? 0)))
    .join("\n");
};

/**
 * 本文ごとの文字数を割り振る
 *
 * 1. 原文に、先頭を残す分（MIN_ORIGINAL_LENGTH）を確保する
 * 2. 残りを翻訳に割り振る。翻訳はこの返答でしか読めないため優先する
 * 3. さらに余った分を原文に割り振る
 *
 * 2 と 3 では、短い本文が使わなかった枠を長い本文へ回す。本文と引用元で
 * 枠を固定で分けると、片方が短くても、もう片方が途中で切られるため。
 */
const allocateLengths = (segments: readonly Segment[], budget: number): Map<Segment, number> => {
  const originals = segments.filter((segment) => segment.kind === "original");
  const translations = segments.filter((segment) => segment.kind === "translation");

  const reserved = new Map(originals.map((segment) => [segment, Math.min(segment.text.length, MIN_ORIGINAL_LENGTH)]));
  const reservedTotal = sum([...reserved.values()]);

  const translationLengths = fillFairly(
    translations.map((segment) => segment.text.length),
    budget - reservedTotal
  );
  const extraLengths = fillFairly(
    originals.map((segment) => segment.text.length - (reserved.get(segment) ?? 0)),
    budget - reservedTotal - sum(translationLengths)
  );

  return new Map<Segment, number>([
    ...translations.map((segment, i) => [segment, translationLengths[i]] as const),
    ...originals.map((segment, i) => [segment, (reserved.get(segment) ?? 0) + extraLengths[i]] as const),
  ]);
};

/**
 * 予算を、要求の少ない順に公平に割り振る
 *
 * 要求が公平な取り分より少なければ要求どおりに渡し、余りを残りで分け合う。
 */
const fillFairly = (demands: readonly number[], budget: number): number[] => {
  const order = demands.map((_, i) => i).sort((a, b) => demands[a] - demands[b]);
  const { given } = order.reduce(
    (acc, index, position) => {
      const share = Math.floor(acc.remaining / (order.length - position));
      const amount = Math.max(0, Math.min(demands[index], share));
      return { remaining: acc.remaining - amount, given: new Map([...acc.given, [index, amount]]) };
    },
    { remaining: Math.max(0, budget), given: new Map<number, number>() }
  );
  return demands.map((_, i) => given.get(i) ?? 0);
};

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
