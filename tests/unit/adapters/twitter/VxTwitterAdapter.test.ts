import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaUrl } from "../../../fixtures/testMediaUrl";

import type { VxTwitterApi } from "@/vxtwitter/api";
import { VxTwitterServerError } from "@/vxtwitter/api";
import type { VxTwitter, MediaSize } from "@/vxtwitter/vxtwitter";
import { VxTwitterAdapter } from "@/adapters/twitter/VxTwitterAdapter";

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const createVxTwitterData = (
  overrides: Partial<VxTwitter> = {},
): VxTwitter => ({
  communityNote: null,
  conversationID: "123456789",
  date: "Sun Jan 01 00:00:00 +0000 2024",
  date_epoch: 1704067200,
  hashtags: [],
  likes: 100,
  mediaURLs: [],
  media_extended: [],
  qrt: null,
  possibly_sensitive: false,
  qrtURL: null,
  replies: 10,
  retweets: 50,
  text: "This is a test tweet",
  tweetID: "123456789",
  tweetURL: "https://x.com/test_user/status/123456789",
  user_name: "Test User",
  user_profile_image_url: mediaUrl("icon.jpg"),
  user_screen_name: "test_user",
  ...overrides,
});

describe("VxTwitterAdapter", () => {
  let mockApi: { getPostInformation: ReturnType<typeof vi.fn> };
  let adapter: VxTwitterAdapter;

  beforeEach(() => {
    mockApi = { getPostInformation: vi.fn() };
    adapter = new VxTwitterAdapter(mockApi as VxTwitterApi);
  });

  describe("fetchTweet", () => {
    it("正常なレスポンスからTweetモデルを生成できる", async () => {
      const vxData = createVxTwitterData();
      mockApi.getPostInformation.mockResolvedValue(vxData);

      const result = await adapter.fetchTweet(
        "https://x.com/test_user/status/123456789",
      );

      expect(result).toBeDefined();
      expect(result?.url).toBe("https://x.com/test_user/status/123456789");
      expect(result?.text).toBe("This is a test tweet");
      expect(result?.author.name).toBe("Test User(@test_user)");
      expect(result?.author.url).toBe("https://x.com/test_user");
      expect(result?.metrics.likes).toBe(100);
      expect(result?.metrics.replies).toBe(10);
      expect(result?.metrics.retweets).toBe(50);
    });

    it("URL を vxtwitter 形式に変換してリクエストする", async () => {
      mockApi.getPostInformation.mockResolvedValue(createVxTwitterData());

      await adapter.fetchTweet("https://x.com/user/status/123");

      expect(mockApi.getPostInformation).toHaveBeenCalledWith(
        "https://api.vxtwitter.com/user/status/123",
      );
    });

    it("twitter.com の URL も変換できる", async () => {
      mockApi.getPostInformation.mockResolvedValue(createVxTwitterData());

      await adapter.fetchTweet("https://twitter.com/user/status/123");

      expect(mockApi.getPostInformation).toHaveBeenCalledWith(
        "https://api.vxtwitter.com/user/status/123",
      );
    });

    it("画像メディアを含むツイートを変換できる", async () => {
      const vxData = createVxTwitterData({
        mediaURLs: [mediaUrl("photo.jpg")],
        media_extended: [
          {
            altText: null,
            size: { height: 900, width: 1200 },
            thumbnail_url: mediaUrl("photo.jpg"),
            type: "image",
            url: mediaUrl("photo.jpg"),
          },
        ],
      });
      mockApi.getPostInformation.mockResolvedValue(vxData);

      const result = await adapter.fetchTweet("https://x.com/user/status/123");

      expect(result?.media).toHaveLength(1);
      expect(result?.media[0].type).toBe("photo");
      expect(result?.media[0].url).toBe(mediaUrl("photo.jpg"));
    });

    it("動画メディアを含むツイートを変換できる", async () => {
      const vxData = createVxTwitterData({
        mediaURLs: [mediaUrl("video.mp4")],
        media_extended: [
          {
            altText: null,
            size: { height: 720, width: 960 },
            thumbnail_url: mediaUrl("thumb.jpg"),
            type: "video",
            url: mediaUrl("video.mp4"),
          },
        ],
      });
      mockApi.getPostInformation.mockResolvedValue(vxData);

      const result = await adapter.fetchTweet("https://x.com/user/status/123");

      expect(result?.media).toHaveLength(1);
      expect(result?.media[0].type).toBe("video");
      expect(result?.media[0].thumbnailUrl).toBe(
        mediaUrl("thumb.jpg"),
      );
    });

    it("引用ツイート（qrt）を含む場合 quote が設定される", async () => {
      const quotedData = createVxTwitterData({
        tweetURL: "https://x.com/quoted_user/status/999",
        user_screen_name: "quoted_user",
        user_name: "Quoted User",
        text: "Original tweet",
      });
      const vxData = createVxTwitterData({
        qrt: quotedData,
        text: "Check this out!",
      });
      mockApi.getPostInformation.mockResolvedValue(vxData);

      const result = await adapter.fetchTweet("https://x.com/user/status/123");

      expect(result?.quote).toBeDefined();
      expect(result?.quote?.url).toBe("https://x.com/quoted_user/status/999");
      expect(result?.quote?.text).toBe("Original tweet");
    });

    it("qrt が入れ子 2階層目は変換しない（depth 制限）", async () => {
      const deepQrt = createVxTwitterData({ text: "deep nested" });
      const quotedData = createVxTwitterData({
        qrt: deepQrt,
        text: "level 1 quote",
      });
      const vxData = createVxTwitterData({ qrt: quotedData });
      mockApi.getPostInformation.mockResolvedValue(vxData);

      const result = await adapter.fetchTweet("https://x.com/user/status/123");

      expect(result?.quote).toBeDefined();
      expect(result?.quote?.quote).toBeUndefined();
    });

    it("API が undefined を返す場合 undefined を返す", async () => {
      mockApi.getPostInformation.mockResolvedValue(undefined);

      const result = await adapter.fetchTweet("https://x.com/user/status/123");

      expect(result).toBeUndefined();
    });

    it("VxTwitterServerError は再スローする", async () => {
      mockApi.getPostInformation.mockRejectedValue(
        new VxTwitterServerError(500, "Internal Server Error"),
      );

      await expect(
        adapter.fetchTweet("https://x.com/user/status/123"),
      ).rejects.toThrow(VxTwitterServerError);
    });

    it("一般エラーは undefined を返す", async () => {
      mockApi.getPostInformation.mockRejectedValue(new Error("network error"));

      const result = await adapter.fetchTweet("https://x.com/user/status/123");

      expect(result).toBeUndefined();
    });
  });
});
