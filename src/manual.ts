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

const bot = initializeBot();

// 업로드 스케줄링

async function postManually() {
  logger.info("수동 업로드가 실행됩니다");
  try {
    (await bot).postDaily({ delay: 0 });
    logger.info("수동 업로드가 성공적으로 실행되었습니다");
  } catch (error) {
    logger.error("수동 업로드가  실패했습니다");
    await WebhookErrorNotification({
      reason: "수동 업로드 실패",
      error,
    });
  }
}

async function postMealManually() {
  logger.info("급식 이미지 수동 업로드가 실행됩니다");
  try {
    await (await bot).postMealImage();
    logger.info("급식 이미지 수동 업로드가 성공적으로 실행되었습니다");
  } catch (error) {
    logger.error("급식 이미지 수동 업로드가 실패했습니다");
    await WebhookErrorNotification({
      reason: "급식 이미지 수동 업로드 실패",
      error,
    });
  }
}

async function postRestManually() {
  logger.info("휴식 이미지 수동 업로드가 실행됩니다");
  try {
    await (await bot).postRestImage();
    logger.info("휴식 이미지 수동 업로드가 성공적으로 실행되었습니다");
  } catch (error) {
    logger.error("휴식 이미지 수동 업로드가 실패했습니다");
    await WebhookErrorNotification({
      reason: "휴식 이미지 수동 업로드 실패",
      error,
    });
  }
}

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

logger.info("[App] 수동 업로드 모드 - 5초 후 실행");

setTimeout(async () => {
  try {
    const mode = process.argv[2];
    logger.info(`[App] 실행 모드: ${mode || "전체"}`);
    if (mode === "meal") {
      await postMealManually();
    } else if (mode === "rest") {
      await postRestManually();
    } else {
      await postManually();
    }
  } catch (error) {
    logger.error(`[App] 수동 업로드 실패: ${error}`);
    await WebhookErrorNotification({
      reason: "수동 업로드 실패",
      error,
    });
    process.exit(1);
  }
}, 5000);
