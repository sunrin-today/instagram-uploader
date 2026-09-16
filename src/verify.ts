import { validateJobEnv } from "./middleware/env";
import { InstagramService } from "./service/instagram";
import { Logger } from "./utils/logger";

import "dotenv/config";

validateJobEnv();

const logger = new Logger();

(async () => {
  try {
    const instagramService = new InstagramService();
    await instagramService.login();
    logger.info("[Verify] 토큰과 계정 연결은 정상입니다. 게시물은 올리지 않았습니다.");
    process.exit(0);
  } catch (error) {
    logger.error(`[Verify] 실패: ${error}`);
    process.exit(1);
  }
})();
