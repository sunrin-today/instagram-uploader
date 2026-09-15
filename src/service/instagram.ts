import fs from "fs";
import { IgApiClient, IgResponseError } from "igramapi";
import path from "path";

import { validateCaption } from "../middleware/caption";
import { Logger } from "../utils/logger";

const logger = new Logger();
const STATE_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(STATE_DIR, "instagram_state.json");

/**
 * igramapi 1.48.3 기본값은 Instagram 347.x라서
 * 로그인 시 "Your version of Instagram is out of date"로 거절된다.
 * 유지되는 비공식 클라이언트(instagrapi)의 앱 프로필로 덮어쓴다.
 */
const INSTAGRAM_APP = {
  APP_VERSION: "446.0.0.49.77",
  APP_VERSION_CODE: "385211303",
  BLOKS_VERSION_ID:
    "935a519904e9017324cdedb64a283a3c2c1a3d5b0bbc698b451f5aef72cc11df",
} as const;

const INSTAGRAM_DEVICES = [
  "34/14; 480dpi; 1344x2992; Google/google; Pixel 8 Pro; husky; husky",
];

export class InstagramService {
  private username: string = "";
  private password: string = "";
  private instagramInstance: IgApiClient;

  constructor() {
    this.instagramInstance = new IgApiClient();
    this.patchPhotoUpload();
  }

  private applyCurrentAppVersion() {
    const constants = this.instagramInstance.state.constants as {
      APP_VERSION: string;
      APP_VERSION_CODE: string;
      BLOKS_VERSION_ID: string;
    };
    constants.APP_VERSION = INSTAGRAM_APP.APP_VERSION;
    constants.APP_VERSION_CODE = INSTAGRAM_APP.APP_VERSION_CODE;
    constants.BLOKS_VERSION_ID = INSTAGRAM_APP.BLOKS_VERSION_ID;
    logger.info(
      `[Instagram] 앱 버전 적용 (${INSTAGRAM_APP.APP_VERSION} / ${INSTAGRAM_APP.APP_VERSION_CODE})`
    );
  }

  /**
   * instagram-private-api의 upload.photo는 X-Instagram-Rupload-Params에
   * upload_media_height / upload_media_width를 포함하지 않지만,
   * Instagram 최신 API는 이 두 필드를 필수로 요구한다 (412 Precondition Failed 원인).
   * 누락된 필드를 추가하는 monkey-patch.
   */
  private patchPhotoUpload() {
    const ig = this.instagramInstance;

    (ig.upload as any).photo = async (options: {
      file: Buffer;
      uploadId?: string;
      waterfallId?: string;
      isSidecar?: boolean;
    }) => {
      // generate_meal_image.py / generate_rest_image.py 모두 1024x1024 고정 출력
      const width = 1024;
      const height = 1024;

      const uploadId = options.uploadId ?? Date.now();
      const random10 = Math.floor(Math.random() * 9000000000) + 1000000000;
      const name = `${uploadId}_0_${random10}`;
      const contentLength = options.file.byteLength;

      const ruploadParams: Record<string, string> = {
        retry_context: JSON.stringify({
          num_step_auto_retry: 0,
          num_reupload: 0,
          num_step_manual_retry: 0,
        }),
        media_type: "1",
        upload_id: String(uploadId),
        xsharing_user_ids: JSON.stringify([]),
        image_compression: JSON.stringify({
          lib_name: "moz",
          lib_version: "3.1.m",
          quality: "80",
        }),
        upload_media_height: String(height),
        upload_media_width: String(width),
      };
      if (options.isSidecar) ruploadParams.is_sidecar = "1";

      logger.info(
        `[Instagram] 업로드 params 패치 적용 (${width}x${height}, ${contentLength}bytes)`
      );

      const { body } = await (ig as any).request.send({
        url: `/rupload_igphoto/${name}`,
        method: "POST",
        headers: {
          X_FB_PHOTO_WATERFALL_ID: options.waterfallId ?? "",
          "X-Entity-Type": "image/jpeg",
          Offset: 0,
          "X-Instagram-Rupload-Params": JSON.stringify(ruploadParams),
          "X-Entity-Name": name,
          "X-Entity-Length": contentLength,
          "Content-Type": "application/octet-stream",
          "Content-Length": contentLength,
          "Accept-Encoding": "gzip",
        },
        body: options.file,
      });
      return body;
    };
  }

  private async saveState(): Promise<void> {
    try {
      if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
      }
      const serialized = await this.instagramInstance.state.serialize();
      delete serialized.constants;
      fs.writeFileSync(STATE_FILE, JSON.stringify(serialized));
      logger.info("[Instagram] 세션 상태 저장 완료");
    } catch (error) {
      logger.warn(`[Instagram] 세션 상태 저장 실패 (무시): ${error}`);
    }
  }

  private async loadState(): Promise<boolean> {
    try {
      if (!fs.existsSync(STATE_FILE)) return false;
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      await this.instagramInstance.state.deserialize(raw);
      logger.info("[Instagram] 저장된 세션 상태 복원 완료");
      return true;
    } catch (error) {
      logger.warn(`[Instagram] 세션 상태 복원 실패, 재로그인 진행: ${error}`);
      try {
        fs.unlinkSync(STATE_FILE);
      } catch {}
      return false;
    }
  }

  public async login(username: string, password: string): Promise<void> {
    this.username = username;
    this.password = password;

    logger.info(`[Instagram] 로그인 시도 중 (username: ${this.username})`);
    this.instagramInstance.state.generateDevice(
      this.username,
      INSTAGRAM_DEVICES
    );
    logger.info("[Instagram] 기기 정보 생성 완료");

    const stateLoaded = await this.loadState();
    this.applyCurrentAppVersion();

    if (stateLoaded) {
      logger.info(`[Instagram] 세션 재사용 (username: ${this.username})`);
      return;
    }

    try {
      logger.info("[Instagram] preLoginFlow 실행 중...");
      await this.instagramInstance.simulate.preLoginFlow();
      logger.info("[Instagram] account.login API 호출 중...");
      await this.instagramInstance.account.login(this.username, this.password);
      logger.info(`[Instagram] 로그인 성공 (username: ${this.username})`);
      logger.info("[Instagram] postLoginFlow 실행 중...");
      try {
        await this.instagramInstance.simulate.postLoginFlow();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.warn(
          `[Instagram] postLoginFlow 실패 (무시하고 진행): ${errMsg}`
        );
      }
      await this.saveState();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : "";
      logger.error(
        `[Instagram] 로그인 실패 (username: ${this.username}) - ${errMsg}`
      );
      logger.error(`[Instagram] 상세 에러: ${errStack}`);
      throw error;
    }
  }

  public async publishPhoto({
    file,
    caption,
    reason,
  }: {
    file: Buffer;
    caption: string;
    reason?: string;
  }): Promise<void> {
    if (!validateCaption(caption)) {
      logger.warn("[Instagram] caption 검증 실패 - 업로드 스킵");
      return;
    }

    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.info(
          `[Instagram] 사진 업로드 시작 (시도 ${attempt}/${MAX_RETRIES})${reason ? ` (reason: ${reason})` : ""}`
        );
        await this.instagramInstance.publish.photo({ file, caption });
        logger.info(
          `[Instagram] 사진 업로드 성공 (username: ${this.username})${reason ? ` - reason: ${reason}` : ""}`
        );
        return;
      } catch (error) {
        lastError = error;
        const body =
          error instanceof IgResponseError
            ? JSON.stringify(error.response?.body ?? null)
            : null;
        const retriable =
          error instanceof IgResponseError &&
          (error.response?.body as any)?.debug_info?.retriable === true;

        logger.error(
          `[Instagram] 사진 업로드 실패 (시도 ${attempt}/${MAX_RETRIES}) - ${error}`
        );
        if (body) logger.error(`[Instagram] Instagram 응답 바디: ${body}`);

        if (!retriable || attempt === MAX_RETRIES) break;

        const delay = attempt * 15_000;
        logger.info(`[Instagram] ${delay / 1000}초 후 재시도...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError;
  }
}
