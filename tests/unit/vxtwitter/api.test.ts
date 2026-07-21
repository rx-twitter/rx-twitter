import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpResponseError } from "@/infrastructure/http/orvalFetch";
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
    mockGetPostInformation.mockResolvedValue(validData as never);

    const result = await api.getPostInformation("https://x.com/user/status/123");

    expect(result).toBeDefined();
    expect(result?.text).toBe("hello");
    expect(mockGetPostInformation).toHaveBeenCalledWith("user", "123");
  });

  it("404 は undefined を返す", async () => {
    mockGetPostInformation.mockRejectedValue(new HttpResponseError(404, "Not Found", "https://api.vxtwitter.com"));

    const result = await api.getPostInformation("https://x.com/user/status/123");

    expect(result).toBeUndefined();
  });

  it.each([500, 502, 503, 599])("%i は VxTwitterServerError をスローする", async (status) => {
    mockGetPostInformation.mockRejectedValue(
      new HttpResponseError(status, "Server Error", "https://api.vxtwitter.com")
    );

    let thrown: unknown;
    try {
      await api.getPostInformation("https://x.com/user/status/123");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(VxTwitterServerError);
    expect(thrown).toMatchObject({
      name: "VxTwitterServerError",
      status,
    });
  });

  it("検証に失敗したレスポンスは undefined を返す", async () => {
    vi.spyOn(VxTwitterStatus, "safeParse").mockReturnValue({ success: false, error: { issues: [] } } as never);
    mockGetPostInformation.mockResolvedValue({ likes: "not-a-number" } as never);

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

  it("5xx 以外の HTTP エラーは undefined を返す", async () => {
    mockGetPostInformation.mockRejectedValue(
      new HttpResponseError(400, "Bad Request", "https://api.vxtwitter.com")
    );

    const result = await api.getPostInformation("https://x.com/user/status/123");

    expect(result).toBeUndefined();
  });
});
