import { getCurrentDateKorean } from "../../utils/date";
import { apiFetch } from "../../utils/api";
import { Logger } from "../../utils/logger";
import { sendWebhook } from "../webhook";

const logger = new Logger();

export async function WebhookPostNotification() {
  try {
    logger.info("[Webhook] 급식 API 조회 중...");
    const response = await apiFetch("/meal/today");
    const data = await response.json();
    logger.info("[Webhook] 급식 API 조회 완료");
    const meals = data?.data?.meals;

    if (!meals || meals.length === 0) {
      logger.info("[Webhook] 급식 정보 없음 - 조기 종료");
      return;
    }

    const mealDescription = meals
      .map((meal: { meal: string; code: string | null }) => {
        const code = meal.code ? ` · \`${meal.code}\`` : "";
        return `• **${meal.meal}**${code}`;
      })
      .join("\n");

    const mealDate = data?.data?.date
      ? new Date(`${data.data.date}T00:00:00`)
      : new Date();

    logger.info("[Webhook] Discord Webhook 전송 중...");
    await sendWebhook({
      embeds: [
        {
          title: "선린투데이 업로드 알림",
          description: mealDescription,
          color: 0x457bff,
          timestamp: mealDate.toISOString(),
          footer: {
            text: getCurrentDateKorean(mealDate),
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
