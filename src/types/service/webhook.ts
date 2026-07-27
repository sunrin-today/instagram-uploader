export interface Embed {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  image?: {
    url: string;
  };
  footer?: {
    text: string;
    icon_url?: string;
  };
}

export interface WebhookAuthor {
  name: string;
  avatar_url: string;
}

export interface WebhookConfig extends Partial<WebhookAuthor> {
  content?: string;
  embeds?: Embed[];
}
