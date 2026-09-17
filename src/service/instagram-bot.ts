import { env } from "../constants/env";
import { DateMeal, DelayOptions, RestImageItem } from "../types";
import { apiJson } from "../utils/api";
import {
  formatIsoDateKorean,
  getKstIsoDate,
  isFirstWeekdayOfMonth,
  monthRangeFromIso,
} from "../utils/date";
import { Logger } from "../utils/logger";

import { ImageService } from "./image";
import { InstagramService } from "./instagram";
import {
  WebhookPostNotification,
  WebhookRestNotification,
} from "./webhook/notification";

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
    await this.instagramService.login();
    logger.info("[InstagramBot] 로그인 초기화 완료");
  }

  async postDaily({ delay = 0 }: DelayOptions) {
    logger.info(`[postDaily] 시작 - delay: ${delay}분`);

    try {
      await new Promise<void>((resolve, reject) => {
        setTimeout(
          async () => {
            try {
              const date = getKstIsoDate();
              logger.info(
                `[postDaily] ${delay}분 대기 완료, 실제 업로드 작업 시작 - date: ${date}`
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

  async postRestImage(date?: string) {
    const targetDate = date ?? getKstIsoDate();
    try {
      const { from, to } = monthRangeFromIso(targetDate);
      logger.info(`[postRestImage] 휴일 API 조회 중... (${from} ~ ${to})`);
      const { ok, data } = await apiJson<DateMeal[]>(
        `/meal/period?date_from=${from}&date_to=${to}`
      );

      if (!ok) {
        logger.info("[postRestImage] 휴일 정보 조회 실패 - 빈 목록으로 진행");
      }

      const items: RestImageItem[] = (data ?? [])
        .filter((item) => item.rest)
        .map((item) => ({
          date: item.date,
          content: item.meals[0]?.meal ?? null,
        }));

      const restImage = await this.imageService.generateRestImage({
        date: targetDate,
        items,
      });

      const [year, month] = targetDate.split("-");
      const monthDate = `${year}년 ${month}월`;

      await this.instagramService.publishPhoto({
        file: restImage,
        caption: `이 달의 휴식 - ${monthDate}`,
        reason: "monthly",
      });

      logger.info("[postRestImage] Webhook 알림 전송 시작");
      await WebhookRestNotification({
        date: targetDate,
        items,
        image: restImage,
      });
      logger.info("[postRestImage] Webhook 알림 전송 완료");
      logger.info(`이 달의 휴식 이미지 업로드 성공`);
    } catch (error) {
      logger.error(`이 달의 휴식 이미지 업로드 실패: ${error}`);
      throw error;
    }
  }

  private async postMonthlyRestImage(date: string) {
    await this.postRestImage(date);
  }

  async postMealImage(date?: string): Promise<boolean> {
    const targetDate = date ?? getKstIsoDate();
    try {
      logger.info(`[postMealImage] 급식 API 조회 중... (${targetDate})`);
      const { ok, status, data } = await apiJson<DateMeal>(
        `/meal?date=${targetDate}`
      );
      logger.info(
        `[postMealImage] 급식 API 응답: status=${status}, exists=${ok}`
      );

      if (!ok || !data) {
        logger.info("[postMealImage] 급식 정보 없음 - 업로드 스킵");
        return false;
      }

      const mealImage = await this.imageService.generateMealImage({
        date: targetDate,
        meals: data.meals.map((item) => item.meal),
      });

      await this.instagramService.publishPhoto({
        file: mealImage,
        caption: `${env.SCHOOL_NAME} 오늘의 정보\n\n${formatIsoDateKorean(targetDate)}\n\n#급식표 #밥밥밥`,
      });

      logger.info("[postMealImage] Webhook 알림 전송 시작");
      await WebhookPostNotification(data, mealImage);
      logger.info("[postMealImage] Webhook 알림 전송 완료");

      logger.info(`급식 이미지 업로드 성공`);
      return true;
    } catch (error) {
      logger.error(`급식 이미지 업로드 실패: ${error}`);
      throw error;
    }
  }
}
