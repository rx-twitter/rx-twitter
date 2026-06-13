import { Tweet, TweetMedia } from "@/core/models/Tweet";
import logger from "@/utils/logger";
import { VxTwitterApi, VxTwitterServerError } from "@/vxtwitter/api";
import { VxTwitter } from "@/vxtwitter/vxtwitter";

import { BaseTwitterAdapter, ITwitterAdapter } from "./BaseTwitterAdapter";

/**
 * VxTwitter API アダプター
 */
export class VxTwitterAdapter extends BaseTwitterAdapter implements ITwitterAdapter {
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
      // 500エラーの場合は上位でフォールバック処理させるため再スロー
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

  protected convertToTweet(data: unknown, depth: number = 0): Tweet | undefined {
    const vxData = data as VxTwitter;

    // 引用ツイートの変換（1階層まで）
    let quote: Tweet | undefined;
    if (vxData.qrt && depth < 1) {
      quote = this.convertToTweet(vxData.qrt, depth + 1);
    }

    // メディアの変換: media_extended を優先して使用
    const media: TweetMedia[] = vxData.media_extended.map((extended) => ({
      url: extended.url,
      thumbnailUrl: extended.thumbnail_url || extended.url,
      type: extended.type === "video" ? "video" : "photo",
    }));

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
      quote,
      timestamp: new Date(vxData.date),
    };
  }
}
