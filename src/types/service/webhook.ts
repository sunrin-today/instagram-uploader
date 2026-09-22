export interface Embed {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
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

export interface WebhookFile {
  name: string;
  data: Buffer;
  type?: string;
}

export interface WebhookConfig extends Partial<WebhookAuthor> {
  content?: string;
  embeds?: Embed[];
  files?: WebhookFile[];
  allowed_mentions?: {
    parse?: string[];
    users?: string[];
    roles?: string[];
  };
}
