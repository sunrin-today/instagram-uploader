import { env } from "./constants/env";
import { validateJobEnv } from "./middleware/env";
import { InstagramService } from "./service/instagram";
import { WebhookErrorNotification } from "./service/webhook/notification";
import { Logger } from "./utils/logger";

import "dotenv/config";

validateJobEnv();

const logger = new Logger();
const dryRun =
  process.argv.includes("--dry-run") || process.argv.includes("dry-run");

(async () => {
  try {
    const instagramService = new InstagramService();
    await instagramService.login();

    logger.info(
      `[Trim] 피드 게시물을 ${env.INSTAGRAM_MEDIA_LIMIT}개로 맞춥니다${dryRun ? " (dry-run)" : ""}`
    );

    if (!dryRun) {
      logger.warn("[Trim] 3초 뒤 오래된 게시물부터 삭제합니다");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const result = await instagramService.trimMediaToLimit({ dryRun });
    logger.info(
      `[Trim] 완료 - 정리 전 ${result.before}개, 삭제 ${result.deleted}개, 정리 후 ${result.after}개`
    );
    if (result.stoppedReason === "rate_limit") {
      logger.warn(
        "[Trim] Instagram 속도 제한으로 일부만 지웠습니다. 몇 분 뒤 다시 실행하면 이어서 지웁니다"
      );
    }
    process.exit(0);
  } catch (error) {
    logger.error(`[Trim] 실패: ${error}`);
    await WebhookErrorNotification({
      reason: "게시물 한도 정리 실패",
      error,
    });
    process.exit(1);
  }
})();
