import { afterEach, describe, expect, it, vi } from "vitest";

import { VxTwitterApi, VxTwitterServerError } from "#/vxtwitter/api.js";

vi.mock("#/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// 生成クライアントをモックせず、fetch のみスタブして
// 生成クライアント → orvalFetch → ラッパーの経路全体を検証する
describe("VxTwitterApi (HTTP境界統合)", () => {
  const api = new VxTwitterApi();
  const tweetUrl = "https://x.com/user/status/123";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("JSON の成功レスポンスを生成スキーマで検証して返す", async () => {
    const body = {
      date: "Sun Jan 01 00:00:00 +0000 2024",
      likes: 1,
      replies: 2,
      retweets: 3,
      text: "hello",
      tweetURL: tweetUrl,
      user_name: "User",
      user_screen_name: "user",
      user_profile_image_url: "https://x.com/user.png",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const result = await api.getPostInformation(tweetUrl);

    expect(result).toMatchObject({ text: "hello", likes: 1 });
  });

  describe("翻訳先の言語を指定した場合", () => {
    const body = {
      date: "Sun Jan 01 00:00:00 +0000 2024",
      likes: 1,
      replies: 2,
      retweets: 3,
      text: "こんにちは",
      tweetURL: tweetUrl,
      user_name: "User",
      user_screen_name: "user",
      user_profile_image_url: "https://x.com/user.png",
      lang: "ja",
      translation: { source_language: "ja", destination_language: "en", text: "Hello" },
    };
    const jsonResponse = () =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

    it("パスの末尾に言語を付けて取得する", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
      vi.stubGlobal("fetch", fetchMock);

      await api.getPostInformation(tweetUrl, "en");

      expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.vxtwitter.com/user/status/123/en");
    });

    it("translation を含めて返す", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse()));

      const result = await api.getPostInformation(tweetUrl, "en");

      expect(result?.translation).toEqual({ source_language: "ja", destination_language: "en", text: "Hello" });
    });

    it("言語を指定しなければ従来のパスで取得する", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse());
      vi.stubGlobal("fetch", fetchMock);

      await api.getPostInformation(tweetUrl);

      expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.vxtwitter.com/user/status/123");
    });
  });

  it("HTML 本文の 500 でも VxTwitterServerError をスローする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Internal Server Error</html>", {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "content-type": "text/html" },
        })
      )
    );

    await expect(api.getPostInformation(tweetUrl)).rejects.toThrow(VxTwitterServerError);
  });

  it("404 は undefined を返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Not Found", { status: 404, statusText: "Not Found" }))
    );

    const result = await api.getPostInformation(tweetUrl);

    expect(result).toBeUndefined();
  });
});
