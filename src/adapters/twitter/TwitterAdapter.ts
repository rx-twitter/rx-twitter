import { Tweet } from "@/core/models/Tweet";
import logger from "@/utils/logger";
import { VxTwitterServerError } from "@/vxtwitter/api";

import { ITwitterAdapter } from "./BaseTwitterAdapter";
import { FxTwitterAdapter } from "./FxTwitterAdapter";
import { VxTwitterAdapter } from "./VxTwitterAdapter";

/**
 * 複数のTwitterアダプターを統合し、フォールバック機能を提供
 */
export class TwitterAdapter implements ITwitterAdapter {
  constructor(
    private readonly primaryAdapter: ITwitterAdapter,
    private readonly fallbackAdapter: ITwitterAdapter
  ) {}

  /**
   * ツイートを取得（プライマリが失敗したらフォールバックを試行）
   * @param url ツイートURL
   * @returns ツイートデータまたはundefined
   */
  async fetchTweet(url: string): Promise<Tweet | undefined> {
    try {
      // まずプライマリアダプターで試行
      const primaryResult = await this.primaryAdapter.fetchTweet(url);
      if (primaryResult) {
        return primaryResult;
      }

      logger.debug("Primary adapter failed, trying fallback");

      // フォールバックアダプターで試行
      const fallbackResult = await this.fallbackAdapter.fetchTweet(url);
      return fallbackResult;
    } catch (error) {
      // VxTwitterが5xxエラーを返した場合、フォールバックを試行
      if (error instanceof VxTwitterServerError) {
        logger.warn("VxTwitter returned a server error, trying FxTwitter fallback", { status: error.status });
        const fallbackResult = await this.fallbackAdapter.fetchTweet(url);
        return fallbackResult;
      }
      // その他のエラーは再スロー
      throw error;
    }
  }

  /**
   * デフォルトのインスタンスを作成（VxTwitterが優先、FxTwitterがフォールバック）
   */
  static createDefault(): TwitterAdapter {
    const vxAdapter = new VxTwitterAdapter();
    const fxAdapter = new FxTwitterAdapter();
    return new TwitterAdapter(vxAdapter, fxAdapter);
  }
}
