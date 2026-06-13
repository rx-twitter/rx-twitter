export interface VxTwitter {
  communityNote: string | null;
  conversationID: string;
  date: string;
  date_epoch: number;
  hashtags: string[];
  likes: number;
  mediaURLs: string[];
  media_extended: MediaExtended[];
  qrt: VxTwitter | null;
  possibly_sensitive: boolean;
  qrtURL: string | null;
  replies: number;
  retweets: number;
  text: string;
  tweetID: string;
  tweetURL: string;
  user_name: string;
  user_profile_image_url: string;
  user_screen_name: string;
}

export interface MediaExtended {
  altText: string | null;
  size: MediaSize;
  thumbnail_url: string;
  type: string;
  url: string;
}

export interface MediaSize {
  height: number;
  width: number;
}
