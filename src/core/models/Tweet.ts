export interface Tweet {
  url: string;
  author: TweetAuthor;
  text: string;
  metrics: TweetMetrics;
  media: TweetMedia[];
  article?: TweetArticle;
  poll?: TweetPoll;
  quote?: Tweet;
  timestamp: Date;
  /** 投稿の言語（X の判定による。"ja" など） */
  lang?: string;
  /** 翻訳先の言語を指定して取得したときの翻訳 */
  translation?: TweetTranslation;
}

export interface TweetTranslation {
  text: string;
  /** 翻訳元の言語（小文字。"ja" など） */
  sourceLang: string;
  /** 翻訳先の言語（小文字。"en" など） */
  targetLang: string;
}

export interface TweetAuthor {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
}

export interface TweetMetrics {
  replies: number;
  likes: number;
  retweets: number;
}

export interface TweetMedia {
  url: string;
  thumbnailUrl: string;
  type: "photo" | "video";
}

export interface TweetArticle {
  id?: string;
  title: string;
  previewText: string;
  imageUrl?: string;
}

export interface TweetPoll {
  options: TweetPollOption[];
}

export interface TweetPollOption {
  label: string;
  votes: number;
  percentage: number;
}
