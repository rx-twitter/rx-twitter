import { beforeEach, describe, expect, it, vi } from "vitest";

import { VxTwitterApi, VxTwitterServerError } from "@/vxtwitter/api";
import { VxTwitterStatus } from "@/vxtwitter/generated/model";
import type { VxTwitter } from "@/vxtwitter/vxtwitter";

vi.mock("@/utils/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/vxtwitter/generated/default", () => ({
  getPostInformation: vi.fn(),
}));

import { getPostInformation } from "@/vxtwitter/generated/default";

const mockGetPostInformation = vi.mocked(getPostInformation);

const validData: VxTwitter = {
  communityNote: null,
  conversationID: "123",
  date: "Sun Jan 01 00:00:00 +0000 2024",
  date_epoch: 1704067200,
  hashtags: [],
  likes: 1,
  mediaURLs: [],
  media_extended: [],
  qrt: null,
  possibly_sensitive: false,
  qrtURL: null,
  replies: 3,
  retweets: 2,
  text: "hello",
  tweetID: "123",
  tweetURL: "https://x.com/user/status/123",
  user_name: "User",
  user_profile_image_url: "https://x.com/a.png",
  user_screen_name: "user",
};

describe("VxTwitterApi", () => {
  let api: VxTwitterApi;

  beforeEach(() => {
    api = new VxTwitterApi();
    vi.clearAllMocks();
    vi.spyOn(VxTwitterStatus, "safeParse").mockReturnValue({
      success: true,
      data: validData,
    } as never);
  });

  it("正常なレスポンスを検証して返す", async () => {
    mockGetPostInformation.mockResolvedValue({ data: validData, status: 200, headers: new Headers() } as never);

    const result = await api.getPostInformation("https://x.com/user/status/123");

    expect(result).toBeDefined();
    expect(result?.text).toBe("hello");
    expect(mockGetPostInformation).toHaveBeenCalledWith("user", "123");
  });

  it("404 は undefined を返す", async () => {
    mockGetPostInformation.mockResolvedValue({ data: {}, status: 404, headers: new Headers() } as never);

    const result = await api.getPostInformation("https://x.com/user/status/123");

    expect(result).toBeUndefined();
  });

  it("500 は VxTwitterServerError をスローする", async () => {
    mockGetPostInformation.mockResolvedValue({ data: {}, status: 500, headers: new Headers() } as never);

    await expect(api.getPostInformation("https://x.com/user/status/123")).rejects.toThrow(VxTwitterServerError);
  });

  it("検証に失敗したレスポンスは undefined を返す", async () => {
    vi.spyOn(VxTwitterStatus, "safeParse").mockReturnValue({ success: false, error: { issues: [] } } as never);
    mockGetPostInformation.mockResolvedValue({ data: { likes: "not-a-number" }, status: 200, headers: new Headers() } as never);

    const result = await api.getPostInformation("https://x.com/user/status/123");

    expect(result).toBeUndefined();
  });

  it("screen_name/tweet_id を抽出できない URL は undefined を返す", async () => {
    const result = await api.getPostInformation("https://example.com/foo/bar");

    expect(result).toBeUndefined();
    expect(mockGetPostInformation).not.toHaveBeenCalled();
  });

  it("通信エラー時は undefined を返す", async () => {
    mockGetPostInformation.mockRejectedValue(new Error("network error"));

    const result = await api.getPostInformation("https://x.com/user/status/123");

    expect(result).toBeUndefined();
  });
});
