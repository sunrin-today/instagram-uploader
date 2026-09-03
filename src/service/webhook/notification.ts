import { DateMeal } from "../../types";
import { formatIsoDateKorean } from "../../utils/date";
import { Logger } from "../../utils/logger";
import { sendWebhook } from "../webhook";

const logger = new Logger();

export async function WebhookPostNotification(meal: DateMeal) {
  try {
    const meals = meal.meals;

    if (!meals || meals.length === 0) {
      logger.info("[Webhook] 급식 정보 없음 - 조기 종료");
      return;
    }

    const mealDescription = meals
      .map((item) => {
        const code = item.code ? ` · \`${item.code}\`` : "";
        return `• **${item.meal}**${code}`;
      })
      .join("\n");

    logger.info("[Webhook] Discord Webhook 전송 중...");
    await sendWebhook({
      embeds: [
        {
          title: "선린투데이 업로드 알림",
          description: mealDescription,
          color: 0x457bff,
          timestamp: `${meal.date}T00:00:00+09:00`,
          footer: {
            text: formatIsoDateKorean(meal.date),
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
