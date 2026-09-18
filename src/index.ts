import cron from "node-cron";

import { env } from "./constants/env";
import { validateEnv } from "./middleware/env";
import { ImageService } from "./service/image";
import { InstagramService } from "./service/instagram";
import { InstagramBot } from "./service/instagram-bot";
import { WebhookErrorNotification } from "./service/webhook/notification";
import { Logger } from "./utils/logger";

import "dotenv/config";

// Env가 제대로 설정되어 있는지 확인합니다
validateEnv();

const logger = new Logger();

const initializeBot = async () => {
  logger.info("[초기화] 봇 초기화 시작...");
  const instagramService = new InstagramService();
  const imageService = new ImageService();
  const bot = new InstagramBot(instagramService, imageService);
  await bot.init();
  logger.info("[초기화] 봇 초기화 완료");
  return bot;
};

const {
  INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_APP_SECRET,
  INSTAGRAM_DELETE_ACCESS_TOKEN,
  ...envForPrint
} = env;

console.log("Environments", envForPrint);

let bot: Awaited<ReturnType<typeof initializeBot>>;

(async () => {
  try {
    bot = await initializeBot();
    logger.info(
      `[Cron] 스케줄 등록: ${env.INTERVAL} (${env.RANDOM_DELAY}분 랜덤 지연)`
    );

    cron.schedule(env.INTERVAL, async () => {
      logger.info("[Cron] 일일 업로드 Cron Job 실행");
      try {
        const randomDelay = Math.floor(Math.random() * env.RANDOM_DELAY);
        logger.info(`[Cron] 랜덤 지연: ${randomDelay}분 적용`);
        await bot.postDaily({ delay: randomDelay });
        logger.info("[Cron] 일일 업로드 Cron Job 완료");
      } catch (error) {
        logger.error(`[Cron] 일일 업로드 Cron Job 실패: ${error}`);
        await WebhookErrorNotification({
          reason: "일일 업로드 실패",
          error,
        });
      }
    });

    logger.info("[App] Instagram Bot 실행됨 - Cron 스케줄 대기 중");
  } catch (error) {
    logger.error(`[App] 봇 초기화 실패 - 프로세스 종료: ${error}`);
    await WebhookErrorNotification({
      reason: "봇 초기화 실패",
      error,
    });
    process.exit(1);
  }
})();

// // 다음날 급식을 Discord Webhook으로 전송하는 스케줄링
// cron.schedule('0 22 * * *', async () => {
//     logger.info('다음날 급식 전송 Cron Job이 실행됩니다');
//     try {
//         // TODO: 급식 정보를 가져와서 Discord Webhook으로 전송하는 로직을 작성합니다
//         logger.info('다음날 급식 전송 Cron Job이 성공적으로 실행되었습니다');
//     } catch {
//         logger.error('다음날 급식 전송 Cron Job이 실패했습니다');
//     }
// });
