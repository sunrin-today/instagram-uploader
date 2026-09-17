import "dotenv/config";

export const env = {
  API_BASE_URL: process.env.API_BASE_URL,
  API_KEY: process.env.API_KEY!,

  SCHOOL_NAME: process.env.SCHOOL_NAME,

  INSTAGRAM_USERNAME: process.env.INSTAGRAM_USERNAME,
  INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_IG_ID: process.env.INSTAGRAM_IG_ID,
  INSTAGRAM_APP_SECRET: process.env.INSTAGRAM_APP_SECRET,

  GCS_BUCKET: process.env.GCS_BUCKET,

  INTERVAL: process.env.INTERVAL ?? "0 7 * * 1-5",

  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  DISCORD_ERROR_MENTION_IDS: process.env.DISCORD_ERROR_MENTION_IDS,

  RANDOM_DELAY: Number(process.env.RANDOM_DELAY ?? 10),
} as const;
