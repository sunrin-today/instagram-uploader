import { env } from "../../constants/env";
import { Logger } from "../../utils/logger";
import { sendWebhook } from "../webhook";

const logger = new Logger();

export async function WebhookPostNotification() {
  try {
    logger.info("[Webhook] 급식 API 조회 중...");
    const response = await fetch(`${env.API_BASE_URL}/meal/today`);
    const data = await response.json();
    logger.info("[Webhook] 급식 API 조회 완료");
    const meals = data?.data?.meals;

    if (!meals || meals.length === 0) {
      logger.info("[Webhook] 급식 정보 없음 - 조기 종료");
      return;
    }

    const mealDescription: string = meals
      .map((meal: any) => {
        return `- ${meal.meal} ${meal.code}\n`;
      })
      .join("");

    // 급식 정보가 있을 경우
    logger.info("[Webhook] Discord Webhook 전송 중...");
    await sendWebhook({
      embeds: [
        {
          title: "선린투데이 업로드 알림",
          description: `
                        \`\`\`${mealDescription}\`\`\`
                    `,
          color: 0x457bff,
          timestamp: new Date().toISOString(),
          image: {
            url: "https://item.kakaocdn.net/do/c838c164801d148d4fe09b83adada4c88f324a0b9c48f77dbce3a43bd11ce785",
          },
        },
      ],
    });
    logger.info("[Webhook] Discord Webhook 전송 완료");
  } catch (error) {
    logger.error(`[Webhook] 알림 전송 실패: ${error}`);
    throw error;
  }
}
