import { validateJobEnv } from "./middleware/env";
import { ImageService } from "./service/image";
import { InstagramService } from "./service/instagram";
import { InstagramBot } from "./service/instagram-bot";
import { WebhookErrorNotification } from "./service/webhook/notification";
import { Logger } from "./utils/logger";

import "dotenv/config";

validateJobEnv();

const logger = new Logger();

function isFinalCloudRunAttempt(): boolean {
  if (!process.env.CLOUD_RUN_JOB) return true;
  const attempt = Number(process.env.CLOUD_RUN_TASK_ATTEMPT ?? 0);
  const maxRetries = Number(process.env.JOB_MAX_RETRIES ?? 1);
  return attempt >= maxRetries;
}

const initializeBot = async () => {
  logger.info("[초기화] 봇 초기화 시작...");
  const instagramService = new InstagramService();
  const imageService = new ImageService();
  const bot = new InstagramBot(instagramService, imageService);
  await bot.init();
  logger.info("[초기화] 봇 초기화 완료");
  return bot;
};

(async () => {
  try {
    const bot = await initializeBot();
    logger.info("[Job] 일일 업로드 시작");
    await bot.postDaily({ delay: 0 });
    logger.info("[Job] 일일 업로드 완료");
    process.exit(0);
  } catch (error) {
    logger.error(`[Job] 실행 실패: ${error}`);
    if (isFinalCloudRunAttempt()) {
      await WebhookErrorNotification({
        reason: "Job 실행 실패",
        error,
      });
    } else {
      logger.warn(
        `[Job] 재시도 예정이라 오류 웹훅은 보내지 않습니다 (attempt ${process.env.CLOUD_RUN_TASK_ATTEMPT ?? 0})`
      );
    }
    process.exit(1);
  }
})();
