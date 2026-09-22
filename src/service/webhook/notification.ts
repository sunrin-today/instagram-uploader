import { env } from "../../constants/env";
import { DateMeal, RestImageItem } from "../../types";
import { formatIsoDateKorean } from "../../utils/date";
import { Logger } from "../../utils/logger";
import { TrimOutcome } from "../../utils/media-limit";
import { sendWebhook } from "../webhook";

function trimEmbedField(trim?: TrimOutcome) {
  if (!trim) return [];
  if (!trim.ok) {
    return [
      {
        name: "피드 정리",
        value: `실패\n${trim.error.slice(0, 800)}`,
      },
    ];
  }

  const { result } = trim;
  if (result.deleted === 0 && !result.stoppedReason) {
    return [
      {
        name: "피드 정리",
        value: `${result.after}개 유지 · 삭제 없음`,
      },
    ];
  }

  let value = `${result.before}개 → ${result.after}개 · ${result.deleted}개 삭제`;
  if (result.stoppedReason === "rate_limit") {
    value += "\n속도 제한으로 일부만 삭제";
  }
  return [{ name: "피드 정리", value }];
}

const logger = new Logger();

export async function WebhookPostNotification(
  meal: DateMeal,
  image?: Buffer,
  trim?: TrimOutcome
) {
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
          fields: trimEmbedField(trim),
          footer: {
            text: formatIsoDateKorean(meal.date),
          },
          image: image ? { url: "attachment://meal.jpg" } : undefined,
        },
      ],
      files: image
        ? [{ name: "meal.jpg", data: image, type: "image/jpeg" }]
        : undefined,
    });
    logger.info("[Webhook] Discord Webhook 전송 완료");
  } catch (error) {
    logger.error(`[Webhook] 알림 전송 실패: ${error}`);
    throw error;
  }
}

export async function WebhookRestNotification({
  date,
  items,
  image,
  trim,
}: {
  date: string;
  items: RestImageItem[];
  image?: Buffer;
  trim?: TrimOutcome;
}): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) {
    logger.warn("[Webhook] DISCORD_WEBHOOK_URL 없음 - 휴일 알림 스킵");
    return;
  }

  const [year, month] = date.split("-");
  const monthLabel = `${year}년 ${month}월`;
  const description =
    items.length > 0
      ? items
          .map((item) => {
            const content = item.content ? ` · ${item.content}` : "";
            return `• **${item.date}**${content}`;
          })
          .join("\n")
      : "휴일 없음";

  try {
    logger.info("[Webhook] 휴일 업로드 알림 전송 중...");
    await sendWebhook({
      embeds: [
        {
          title: "선린투데이 휴일 업로드 알림",
          description,
          color: 0xea5c51,
          fields: trimEmbedField(trim),
          footer: {
            text: monthLabel,
          },
          image: image ? { url: "attachment://rest.jpg" } : undefined,
        },
      ],
      files: image
        ? [{ name: "rest.jpg", data: image, type: "image/jpeg" }]
        : undefined,
    });
    logger.info("[Webhook] 휴일 업로드 알림 전송 완료");
  } catch (error) {
    logger.error(`[Webhook] 휴일 알림 전송 실패: ${error}`);
    throw error;
  }
}

export function parseMentionIds(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));
}

function mentionPayload(raw?: string): {
  content?: string;
  allowed_mentions?: { parse: string[]; users: string[] };
} {
  const users = parseMentionIds(raw);
  if (users.length === 0) return {};
  return {
    content: users.map((id) => `<@${id}>`).join(" "),
    allowed_mentions: { parse: [], users },
  };
}

function formatErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const body = stack && stack !== message ? `${message}\n\n${stack}` : message;
  return body.slice(0, 3500);
}

export async function WebhookErrorNotification({
  reason,
  error,
}: {
  reason: string;
  error: unknown;
}): Promise<void> {
  if (!env.DISCORD_WEBHOOK_URL) {
    logger.warn("[Webhook] DISCORD_WEBHOOK_URL 없음 - 오류 알림 스킵");
    return;
  }

  try {
    logger.info(`[Webhook] 오류 알림 전송 중... (${reason})`);
    await sendWebhook({
      ...mentionPayload(env.DISCORD_ERROR_MENTION_IDS),
      embeds: [
        {
          title: "선린투데이 업로드 오류",
          description: `**원인:** ${reason}\n\`\`\`\n${formatErrorText(error)}\n\`\`\``,
          color: 0xed4245,
          timestamp: new Date().toISOString(),
          footer: {
            text: reason,
          },
        },
      ],
    });
    logger.info("[Webhook] 오류 알림 전송 완료");
  } catch (webhookError) {
    logger.error(`[Webhook] 오류 알림 전송 실패: ${webhookError}`);
  }
}
