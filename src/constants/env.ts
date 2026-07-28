export const env = {
  API_BASE_URL: process.env.API_BASE_URL,
  API_KEY: process.env.API_KEY!,

  SCHOOL_NAME: process.env.SCHOOL_NAME,

  INSTAGRAM_USERNAME: process.env.INSTAGRAM_USERNAME,
  INSTAGRAM_PASSWORD: process.env.INSTAGRAM_PASSWORD,

  INTERVAL: process.env.INTERVAL ?? "0 7 * * 1-5",

  DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,

  RANDOM_DELAY: Number(process.env.RANDOM_DELAY ?? 10),
} as const;
