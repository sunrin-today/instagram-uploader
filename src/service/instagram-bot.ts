import { env } from "../constants/env";
import { DelayOptions } from "../types";
import { getDayName, isFirstWeekdayOfMonth } from "../utils/date";
import { Logger } from "../utils/logger";

import { ImageService } from "./image";
import { InstagramService } from "./instagram";
import { WebhookPostNotification } from "./webhook/notification";

const logger = new Logger();

export class InstagramBot {
  private instagramService: InstagramService;
  private imageService: ImageService;

  constructor(instagramService: InstagramService, imageService: ImageService) {
    this.instagramService = instagramService;
    this.imageService = imageService;
  }

  async init(): Promise<void> {
    logger.info("[InstagramBot] 로그인 초기화 시작...");
    await this.instagramService.login(
      process.env.INSTAGRAM_USERNAME!,
      process.env.INSTAGRAM_PASSWORD!
    );
    logger.info("[InstagramBot] 로그인 초기화 완료");
  }

  async postDaily({ delay = 0 }: DelayOptions) {
    const date = new Date();
    logger.info(
      `[postDaily] 시작 - delay: ${delay}분, date: ${date.toISOString()}`
    );

    try {
      await new Promise<void>((resolve, reject) => {
        setTimeout(
          async () => {
            try {
              logger.info(
                `[postDaily] ${delay}분 대기 완료, 실제 업로드 작업 시작`
              );

              if (isFirstWeekdayOfMonth(date)) {
                logger.info("[postDaily] 월초 휴식 이미지 업로드 시작");
                await this.postMonthlyRestImage(date);
                logger.info("[postDaily] 월초 휴식 이미지 업로드 완료");
              }

              logger.info("[postDaily] 급식 이미지 업로드 시작");
              const mealPosted = await this.postMealImage(date);
              if (!mealPosted) {
                logger.info("[postDaily] 급식 정보 없음 - 조기 종료");
                resolve();
                return;
              }
              logger.info("[postDaily] 급식 이미지 업로드 완료");

              logger.info("[postDaily] Webhook 알림 전송 시작");
              await WebhookPostNotification();
              logger.info("[postDaily] Webhook 알림 전송 완료");

              logger.info("[postDaily] 모든 작업 완료");
              resolve();
            } catch (error) {
              logger.error(`[postDaily] 작업 중 오류: ${error}`);
              reject(error);
            }
          },
          delay * 60 * 1000
        );
      });
    } catch (error) {
      logger.error(`[postDaily] 일일 업로드 실패: ${error}`);
      throw error;
    }
  }

  async postRestImage(date?: Date) {
    const targetDate = date || new Date();
    try {
      const restImage = await this.imageService.generateRestImage();

      const monthDate = `${targetDate.getFullYear()}년 ${String(
        targetDate.getMonth() + 1
      ).padStart(2, "0")}월`;

      await this.instagramService.publishPhoto({
        file: restImage,
        caption: `이 달의 휴식 - ${monthDate}`,
        reason: "monthly",
      });
      logger.info(`이 달의 휴식 이미지 업로드 성공`);
    } catch (error) {
      logger.error(`이 달의 휴식 이미지 업로드 실패: ${error}`);
      throw error;
    }
  }

  private async postMonthlyRestImage(date: Date) {
    await this.postRestImage(date);
  }

  async postMealImage(date?: Date): Promise<boolean> {
    const targetDate = date || new Date();
    try {
      logger.info("[postMealImage] 급식 API 존재 여부 확인 중...");
      const isExist = await fetch(`${env.API_BASE_URL}/meal/today`)
        .then((res) => {
          const exists = res.status === 200;
          logger.info(`[postMealImage] 급식 API 응답: status=${res.status}, exists=${exists}`);
          return exists;
        })
        .catch((error) => {
          logger.error(`[postMealImage] 급식 API 조회 실패: ${error}`);
          return false;
        });

      if (!isExist) {
        logger.info("[postMealImage] 급식 정보 없음 - 업로드 스킵");
        return false;
      }

      const mealImage = await this.imageService.generateMealImage();
      const formattedDate = `${targetDate.getFullYear()}년 ${String(
        targetDate.getMonth() + 1
      ).padStart(2, "0")}월 ${String(targetDate.getDate()).padStart(
        2,
        "0"
      )}일 ${getDayName(targetDate, "ko")}요일`;

      await this.instagramService.publishPhoto({
        file: mealImage,
        caption: `${env.SCHOOL_NAME} 오늘의 정보\n\n${formattedDate}\n\n#급식표 #밥밥밥`,
      });

      logger.info(`급식 이미지 업로드 성공`);
      return true;
    } catch (error) {
      logger.error(`급식 이미지 업로드 실패: ${error}`);
      throw error;
    }
  }
}
