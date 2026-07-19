import logger from "@/utils/logger";

import { get2StatusId } from "./generated/default";
import { SocialThread } from "./generated/model";

export class FxTwitterApi {
  /**
   * FxEmbed API からツイート情報を取得し、Zod で検証して返す。
   * 404 は undefined、検証失敗はログ出力の上 undefined を返す。
   */
  async getPostInformation(url: string): Promise<SocialThread | undefined> {
    const startTime = Date.now();
    logger.debug("FxTwitterApi: Request started", { url });

    const id = this.extractId(url);
    if (!id) {
      logger.error("FxTwitterApi: Could not extract tweet id from url", { url });
      return undefined;
    }

    try {
      const response = await get2StatusId(id);
      const duration = Date.now() - startTime;

      if (response.status === 404) {
        logger.debug("FxTwitterApi: Tweet not found (404)", { url, duration: `${duration}ms` });
        return undefined;
      }

      const parsed = SocialThread.safeParse(response.data);
      if (!parsed.success) {
        logger.error("FxTwitterApi: Response validation failed", {
          url,
          issues: parsed.error.issues,
          duration: `${duration}ms`,
        });
        return undefined;
      }

      logger.info("FxTwitterApi: Request completed", {
        url,
        statusCode: response.status,
        duration: `${duration}ms`,
      });
      return parsed.data;
    } catch (e) {
      const duration = Date.now() - startTime;
      if (process.env.NODE_ENV !== "test") {
        logger.error("FxTwitterApi: API request failed", {
          url,
          message: e instanceof Error ? e.message : String(e),
          duration: `${duration}ms`,
        });
      }
      return undefined;
    }
  }

  private extractId(url: string): string | undefined {
    const match = url.match(/\/status\/(\d{2,20})/);
    return match?.[1];
  }
}
