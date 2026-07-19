import { describe, it, expect } from "vitest";
import { mediaUrl } from "../../../fixtures/testMediaUrl";
import {
  createMockTweet,
  MOCK_TWEET_WITH_QUOTE,
  MOCK_TWEET_WITH_PHOTO,
  MOCK_TWEET_WITH_MENTIONS,
  MOCK_TWEET_WITH_MENTIONS_AND_URL,
  MOCK_TWEET_WITH_QUOTE_AND_MENTIONS,
  MOCK_TWEET_WITH_LONG_TEXT,
  MOCK_TWEET_WITH_DOUBLE_AT,
  MOCK_TWEET_WITH_FULLWIDTH_AT,
} from "../../../fixtures/mock-tweets";
import { DiscordEmbedBuilder } from "@/adapters/discord/EmbedBuilder";

describe("DiscordEmbedBuilder", () => {
  const builder = new DiscordEmbedBuilder();

  describe("build", () => {
    it("基本的なツイートからEmbedを生成できる", () => {
      const tweet = createMockTweet();
      const embeds = builder.build(tweet);

      expect(embeds).toHaveLength(1);
      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.author?.name).toBe(tweet.author.name);
      expect(embedData.author?.url).toBe(tweet.author.url);
      expect(embedData.author?.icon_url).toBe(tweet.author.iconUrl);
      expect(embedData.title).toBe(tweet.author.name);
      expect(embedData.url).toBe(tweet.url);
      expect(embedData.description).toBe(tweet.text);
      expect(embedData.timestamp).toBeDefined();
    });

    it("メトリクス情報がフィールドに含まれる", () => {
      const tweet = createMockTweet({
        metrics: { replies: 10, likes: 100, retweets: 50 },
      });
      const embeds = builder.build(tweet);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.fields).toHaveLength(3);
      expect(embedData.fields?.[0].name).toBe(":arrow_right_hook: replies");
      expect(embedData.fields?.[0].value).toBe("10");
      expect(embedData.fields?.[1].name).toBe(":hearts: likes");
      expect(embedData.fields?.[1].value).toBe("100");
      expect(embedData.fields?.[2].name).toBe(":arrows_counterclockwise: retweets");
      expect(embedData.fields?.[2].value).toBe("50");
    });

    it("引用ツイートの情報が説明文に含まれる", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_QUOTE);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.description).toContain("QT:");
      expect(embedData.description).toContain("[`@quoted_user`](https://x.com/quoted_user)");
      expect(embedData.description).toContain("Original tweet");
      expect(embedData.description).toContain(MOCK_TWEET_WITH_QUOTE.quote?.url);
    });

    it("メディアがない場合は1つのEmbedを返す", () => {
      const tweet = createMockTweet({ media: [] });
      const embeds = builder.build(tweet);

      expect(embeds).toHaveLength(1);
    });

    it("メディアがある場合は各メディアごとにEmbedを生成する", () => {
      const tweet = createMockTweet({
        media: [
          { url: mediaUrl("photo1.jpg"), thumbnailUrl: mediaUrl("photo1.jpg"), type: "photo" },
          { url: mediaUrl("photo2.jpg"), thumbnailUrl: mediaUrl("photo2.jpg"), type: "photo" },
        ],
      });
      const embeds = builder.build(tweet);

      expect(embeds).toHaveLength(2);
      expect(embeds[0].toJSON().image?.url).toBe(mediaUrl("photo1.jpg"));
      expect(embeds[1].toJSON().image?.url).toBe(mediaUrl("photo2.jpg"));
    });

    it("画像の場合はサムネイルURLが設定される", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_PHOTO);

      expect(embeds).toHaveLength(1);
      expect(embeds[0].toJSON().image?.url).toBeDefined();
    });

    it("テキストが空の場合でもEmbedを生成できる", () => {
      const tweet = createMockTweet({ text: "" });
      const embeds = builder.build(tweet);

      expect(embeds).toHaveLength(1);
      expect(embeds[0].toJSON().description).toBeUndefined();
    });

    it("Embedの色が正しく設定される", () => {
      const tweet = createMockTweet();
      const embeds = builder.build(tweet);

      expect(embeds[0].toJSON().color).toBe(9016025);
    });

    it("@メンションがクリック可能なリンクに変換される", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_MENTIONS);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.description).toContain("[`@user_name`](https://x.com/user_name)");
      expect(embedData.description).toContain("[`@another_user`](https://x.com/another_user)");
    });

    it("URL内の@は変換されない", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_MENTIONS_AND_URL);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.description).toContain("[`@twitter`](https://x.com/twitter)");
      expect(embedData.description).toContain("[`@github`](https://x.com/github)");
      expect(embedData.description).toContain("https://x.com/@twitter");
    });

    it("引用ツイート内の@メンションもリンク化される", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_QUOTE_AND_MENTIONS);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.description).toContain("[`@someone`](https://x.com/someone)");
      expect(embedData.description).toContain("[`@quoted_user`](https://x.com/quoted_user)");
      expect(embedData.description).toContain("[`@friend`](https://x.com/friend)");
    });

    it("アンダースコアを含むメンションのリンク表示が装飾されない", () => {
      const tweet = createMockTweet({
        text: "Hello @_user_name_",
        quote: createMockTweet({
          author: {
            id: "_quoted_user_",
            name: "Quoted User",
            url: "https://x.com/_quoted_user_",
            iconUrl: "https://example.com/icon.jpg",
          },
        }),
      });
      const embeds = builder.build(tweet);

      const description = embeds[0].toJSON().description;

      expect(description).toContain("[`@_user_name_`](https://x.com/_user_name_)");
      expect(description).toContain("[`@_quoted_user_`](https://x.com/_quoted_user_)");
    });

    it("4096文字を超える説明文は省略される", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_LONG_TEXT);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.description?.length).toBe(4096);
      expect(embedData.description).toMatch(/\.\.\.$/);
    });

    it("連続する@の最後のみがリンク化される", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_DOUBLE_AT);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.description).toContain("@[`@user`](https://x.com/user)");
      expect(embedData.description).toContain("@@[`@test`](https://x.com/test)");
    });

    it("全角@もリンク化される", () => {
      const embeds = builder.build(MOCK_TWEET_WITH_FULLWIDTH_AT);

      const embed = embeds[0];
      const embedData = embed.toJSON();

      expect(embedData.description).toContain("[`@user`](https://x.com/user)");
      expect(embedData.description).toContain("＠[`@test`](https://x.com/test)");
    });
  });
});
