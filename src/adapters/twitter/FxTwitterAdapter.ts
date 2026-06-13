import { Tweet, TweetMedia } from "@/core/models/Tweet";
import { FxTwitterApi } from "@/fxtwitter/api";
import { Tweet as FxTweet } from "@/fxtwitter/fxtwitter";
import logger from "@/utils/logger";

import { BaseTwitterAdapter, ITwitterAdapter } from "./BaseTwitterAdapter";

/**
 * FxTwitter API アダプター
 */
export class FxTwitterAdapter extends BaseTwitterAdapter implements ITwitterAdapter {
  private readonly api: FxTwitterApi;
  private readonly URL_REGEX = /\/(x|twitter)/;

  constructor(api?: FxTwitterApi) {
    super();
    this.api = api || new FxTwitterApi();
  }

  protected transformUrl(url: string): string {
    return url.replace(this.URL_REGEX, "/api.fxtwitter");
  }

  async fetchTweet(url: string): Promise<Tweet | undefined> {
    try {
      const apiUrl = this.transformUrl(url);
      const response = await this.api.getPostInformation(apiUrl);

      if (!response || !response.tweet) {
        return undefined;
      }

      return this.convertToTweet(response.tweet);
    } catch (error) {
      logger.error("FxTwitterAdapter: Failed to fetch tweet", {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  protected convertToTweet(data: unknown, depth: number = 0): Tweet | undefined {
    const fxData = data as FxTweet;

    // 引用ツイートの変換（1階層まで）
    let quote: Tweet | undefined;
    if (fxData.quote && depth < 1) {
      quote = this.convertToTweet(fxData.quote, depth + 1);
    }

    // メディアの変換: media.all を優先して使用（photos/videos を統一的に扱える）
    const media: TweetMedia[] = [];
    if (fxData.media?.all) {
      for (const item of fxData.media.all) {
        media.push({
          url: item.url,
          thumbnailUrl: item.thumbnail_url || item.url,
          type: item.type === "video" || item.type === "animated_gif" ? "video" : "photo",
        });
      }
    }

    return {
      url: fxData.url,
      author: this.createAuthor(
        fxData.author.id,
        fxData.author.name,
        fxData.author.screen_name,
        fxData.author.avatar_url
      ),
      text: fxData.text,
      metrics: this.createMetrics(fxData.replies, fxData.likes, fxData.retweets),
      media,
      quote,
      timestamp: new Date(fxData.created_at),
    };
  }
}
