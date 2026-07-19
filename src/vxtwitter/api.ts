import { getPostInformation } from "./generated/default";
import { VxTwitterStatus } from "./generated/model";
import type { VxTwitter } from "./vxtwitter";
import logger from "@/utils/logger";

export class VxTwitterServerError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "VxTwitterServerError";
  }
}

export class VxTwitterApi {
  /**
   * VxTwitter API からツイート情報を取得し、Zod で検証して返す。
   * 404 は undefined、500 は VxTwitterServerError をスロー（フォールバック用）、
   * 検証失敗はログ出力の上 undefined を返す。
   */
  async getPostInformation(url: string): Promise<VxTwitter | undefined> {
    const startTime = Date.now();
    logger.debug("VxTwitterApi: Request started", { url });

    const params = this.extractParams(url);
    if (!params) {
      logger.error("VxTwitterApi: Could not extract screen_name/tweet_id from url", { url });
      return undefined;
    }

    try {
      const response = await getPostInformation(params.screenName, params.tweetId);
      const duration = Date.now() - startTime;

      if (response.status === 500) {
        logger.warn("VxTwitterApi: Server error (500), fallback will be attempted", {
          url,
          duration: `${duration}ms`,
        });
        throw new VxTwitterServerError(response.status, `VxTwitter API returned 500 error for ${url}`);
      }

      if (response.status === 404) {
        logger.debug("VxTwitterApi: Tweet not found (404)", { url, duration: `${duration}ms` });
        return undefined;
      }

      const parsed = VxTwitterStatus.safeParse(response.data);
      if (!parsed.success) {
        logger.error("VxTwitterApi: Response validation failed", {
          url,
          issues: parsed.error.issues,
          duration: `${duration}ms`,
        });
        return undefined;
      }

      logger.info("VxTwitterApi: Request completed", {
        url,
        statusCode: response.status,
        duration: `${duration}ms`,
      });
      return parsed.data as VxTwitter;
    } catch (e) {
      if (e instanceof VxTwitterServerError) {
        throw e;
      }
      const duration = Date.now() - startTime;
      if (process.env.NODE_ENV !== "test") {
        logger.error("VxTwitterApi: API request failed", {
          url,
          message: e instanceof Error ? e.message : String(e),
          duration: `${duration}ms`,
        });
      }
      return undefined;
    }
  }

  private extractParams(url: string): { screenName: string; tweetId: string } | undefined {
    const match = url.match(
      /(?:api\.vxtwitter\.com|\/(?:x|twitter)(?:\.com)?)\/([^/]+)\/status\/(\d{2,20})/,
    );
    if (!match) {
      return undefined;
    }
    return { screenName: match[1], tweetId: match[2] };
  }
}
