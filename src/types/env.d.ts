declare namespace NodeJS {
  interface ProcessEnv {
    API_BASE_URL: string;
    API_KEY: string;

    SCHOOL_NAME: string;

    INSTAGRAM_USERNAME?: string;
    INSTAGRAM_ACCESS_TOKEN: string;
    INSTAGRAM_IG_ID: string;
    INSTAGRAM_APP_SECRET?: string;
    INSTAGRAM_MEDIA_LIMIT?: string;
    INSTAGRAM_DELETE_ACCESS_TOKEN?: string;
    INSTAGRAM_DELETE_GRAPH_API_BASE?: string;

    GCS_BUCKET?: string;

    INTERVAL?: string;

    RANDOM_DELAY?: string;

    DISCORD_WEBHOOK_URL: string;
    DISCORD_ERROR_MENTION_IDS?: string;
  }
}
