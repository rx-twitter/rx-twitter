import {
  BaseTwitterAdapter,
  ITweetTranslationAdapter,
  ITwitterAdapter,
} from "#/adapters/twitter/BaseTwitterAdapter.js";
import { isSameLanguage, isVxTranslationLanguage } from "#/adapters/twitter/vxTranslationLang.js";
import type { Tweet, TweetArticle, TweetMedia, TweetTranslation } from "#/core/models/Tweet.js";
import { extractArticleId } from "#/core/services/TweetProcessor.js";
import logger from "#/utils/logger.js";
import { VxTwitterApi, VxTwitterServerError } from "#/vxtwitter/api.js";
import type { VxTwitter } from "#/vxtwitter/vxtwitter.js";

/**
 * VxTwitter API アダプター
 */
export class VxTwitterAdapter extends BaseTwitterAdapter implements ITwitterAdapter, ITweetTranslationAdapter {
  private readonly api: VxTwitterApi;
  private readonly URL_REGEX = /\/(x|twitter)/;

  constructor(api?: VxTwitterApi) {
    super();
    this.api = api || new VxTwitterApi();
  }

  protected transformUrl(url: string): string {
    return url.replace(this.URL_REGEX, "/api.vxtwitter");
  }

  async fetchTweet(url: string): Promise<Tweet | undefined> {
    try {
      const apiUrl = this.transformUrl(url);
      const data = await this.api.getPostInformation(apiUrl);

      if (!data) {
        return undefined;
      }

      return this.convertToTweet(data);
    } catch (error) {
      // 5xxエラーの場合は上位でフォールバック処理させるため再スロー
      if (error instanceof VxTwitterServerError) {
        logger.warn("VxTwitterAdapter: Server error, will try fallback", { status: error.status });
        throw error;
      }
      logger.error("VxTwitterAdapter: Failed to fetch tweet", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  protected convertToTweet(data: VxTwitter, depth: number = 0): Tweet | undefined {
    const vxData = data;

    // 引用ツイートの変換（1階層まで）
    let quote: Tweet | undefined;
    if (vxData.qrt && depth < 1) {
      quote = this.convertToTweet(vxData.qrt, depth + 1);
    }

    // メディアの変換: media_extended を優先、なければ mediaURLs でフォールバック
    const media: TweetMedia[] =
      vxData.media_extended && vxData.media_extended.length > 0
        ? vxData.media_extended.map((extended) => ({
            url: extended.url,
            thumbnailUrl: extended.thumbnail_url || extended.url,
            type:
              extended.type === "video" || extended.type === "gif" || extended.type === "animated_gif"
                ? "video"
                : "photo",
          }))
        : vxData.mediaURLs && vxData.mediaURLs.length > 0
          ? vxData.mediaURLs.map((url) => ({
              url,
              thumbnailUrl: url,
              type: this.getMediaType(url),
            }))
          : [];

    const pollOptions = vxData.pollData?.options?.flatMap((option) => {
      if (option.name === undefined || option.votes === undefined || option.percent === undefined) {
        return [];
      }

      return [
        {
          label: option.name,
          votes: option.votes,
          percentage: option.percent,
        },
      ];
    });
    const poll = pollOptions && pollOptions.length > 0 ? { options: pollOptions } : undefined;
    const article = this.convertArticle(vxData.article, vxData.text);

    return {
      url: vxData.tweetURL,
      author: this.createAuthor(
        vxData.user_screen_name,
        vxData.user_name,
        vxData.user_screen_name,
        vxData.user_profile_image_url
      ),
      text: vxData.text,
      metrics: this.createMetrics(vxData.replies, vxData.likes, vxData.retweets),
      media,
      article,
      poll,
      quote,
      timestamp: new Date(vxData.date),
      lang: vxData.lang ?? undefined,
      translation: this.convertTranslation(vxData.translation),
    };
  }

  /**
   * 翻訳付きでツイートを取得する
   *
   * 翻訳は FxTwitter へフォールバックしない。FxTwitter は翻訳先によって、
   * DeepL のエラー文を翻訳として返すことがあるため（2026-11 時点）。
   * そのため 5xx も上位へ投げずにここで握る。
   */
  async fetchTranslatedTweet(url: string, lang: string): Promise<Tweet | undefined> {
    // 言語コードは URL のパスに入るため、一覧に無いものは渡さない
    const requested = isVxTranslationLanguage(lang) ? lang : undefined;

    try {
      const data = await this.api.getPostInformation(this.transformUrl(url), requested);
      if (!data) {
        return undefined;
      }

      const tweet = this.convertToTweet(data);
      return tweet && this.keepRequestedTranslation(tweet, requested);
    } catch (error) {
      logger.warn("VxTwitterAdapter: Failed to fetch translated tweet", {
        lang,
        status: error instanceof VxTwitterServerError ? error.status : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * 頼んだ言語の翻訳だけを残す（引用元も含む）
   *
   * 非対応の言語を頼むと、VxTwitter は別の言語（英語など）の翻訳を返すことがある。
   */
  private keepRequestedTranslation(tweet: Tweet, lang: string | undefined): Tweet {
    const matches = tweet.translation && lang !== undefined && isSameLanguage(tweet.translation.targetLang, lang);
    return {
      ...tweet,
      translation: matches ? tweet.translation : undefined,
      quote: tweet.quote && this.keepRequestedTranslation(tweet.quote, lang),
    };
  }

  private convertTranslation(data: VxTwitter["translation"]): TweetTranslation | undefined {
    if (!data?.text || !data.source_language || !data.destination_language) {
      return undefined;
    }

    return {
      text: data.text,
      sourceLang: data.source_language.toLowerCase(),
      targetLang: data.destination_language.toLowerCase(),
    };
  }

  private convertArticle(data: VxTwitter["article"], text: string): TweetArticle | undefined {
    if (!data?.title || !data.preview_text) {
      return undefined;
    }

    return {
      id: extractArticleId(text),
      title: data.title,
      previewText: data.preview_text,
      imageUrl: data.image ?? undefined,
    };
  }
}
