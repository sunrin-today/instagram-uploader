import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { Storage } from "@google-cloud/storage";

import { env } from "../constants/env";
import { validateCaption } from "../middleware/caption";
import { Logger } from "../utils/logger";

const logger = new Logger();
const GRAPH_API_BASE = "https://graph.instagram.com/v25.0";
const TOKEN_SECRET_NAME = "instagram-access-token";

type GraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export class InstagramService {
  private accessToken = env.INSTAGRAM_ACCESS_TOKEN!;
  private igUserId = env.INSTAGRAM_IG_ID!;

  private async graphRequest<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const url = `${GRAPH_API_BASE}${path}`;
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    const response = await fetch(url, { ...init, headers });
    const body = (await response.json()) as T & GraphErrorBody;
    if (!response.ok || body.error) {
      const error = body.error;
      const details = [
        error?.code != null ? `code=${error.code}` : null,
        error?.error_subcode != null ? `subcode=${error.error_subcode}` : null,
        error?.fbtrace_id ? `trace=${error.fbtrace_id}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      throw new Error(
        `[Instagram] Graph API 실패 (${response.status}): ${
          error?.message ?? JSON.stringify(body)
        }${details ? ` (${details})` : ""}`
      );
    }
    return body;
  }

  private isCloudRunJob(): boolean {
    return Boolean(process.env.CLOUD_RUN_JOB || process.env.K_SERVICE);
  }

  private async persistRefreshedToken(token: string): Promise<void> {
    if (!this.isCloudRunJob()) {
      logger.info(
        "[Instagram] 로컬 실행이라 Secret Manager에는 저장하지 않습니다"
      );
      return;
    }

    const projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      "sunrin-today";
    const client = new SecretManagerServiceClient();
    await client.addSecretVersion({
      parent: `projects/${projectId}/secrets/${TOKEN_SECRET_NAME}`,
      payload: { data: Buffer.from(token, "utf8") },
    });
    logger.info("[Instagram] 갱신된 토큰을 Secret Manager에 저장했습니다");
  }

  private async refreshAccessToken(): Promise<void> {
    logger.info("[Instagram] 액세스 토큰 갱신 시도 중...");
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", this.accessToken);

    const response = await fetch(url);
    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    } & GraphErrorBody;

    if (!response.ok || body.error || !body.access_token) {
      const message = body.error?.message ?? JSON.stringify(body);
      if (/24 hour|24시간|to refresh/i.test(message)) {
        logger.warn(
          `[Instagram] 토큰이 아직 24시간이 지나지 않아 갱신을 건너뜁니다: ${message}`
        );
        return;
      }
      throw new Error(`[Instagram] 토큰 갱신 실패: ${message}`);
    }

    this.accessToken = body.access_token;
    const days = body.expires_in
      ? Math.floor(body.expires_in / 86400)
      : undefined;
    logger.info(
      `[Instagram] 토큰 갱신 완료${days ? ` (약 ${days}일 유효)` : ""}`
    );
    await this.persistRefreshedToken(body.access_token);
  }

  public async login(): Promise<void> {
    try {
      await this.refreshAccessToken();
    } catch (error) {
      logger.warn(
        `[Instagram] 토큰 갱신 실패, 기존 토큰으로 진행: ${error}`
      );
    }

    logger.info("[Instagram] Graph API 토큰 확인 중...");
    const me = await this.graphRequest<{
      id?: string;
      user_id?: string;
      username?: string;
    }>("/me?fields=id,user_id,username");
    this.igUserId = me.id ?? me.user_id ?? this.igUserId;
    logger.info(
      `[Instagram] 토큰 확인 완료 (username: ${me.username ?? env.INSTAGRAM_USERNAME}, id: ${me.id ?? "-"}, user_id: ${me.user_id ?? "-"})`
    );
    if (env.INSTAGRAM_IG_ID && this.igUserId !== env.INSTAGRAM_IG_ID) {
      logger.warn(
        `[Instagram] INSTAGRAM_IG_ID(${env.INSTAGRAM_IG_ID})와 /me id(${this.igUserId})가 다릅니다. /me id로 게시합니다`
      );
    }
  }

  private async uploadPublicImage(file: Buffer): Promise<string> {
    const bucketName = env.GCS_BUCKET;
    if (!bucketName) {
      throw new Error(
        "[Instagram] GCS_BUCKET이 필요합니다. 공식 API는 Instagram이 가져갈 공개 이미지 URL이 있어야 합니다."
      );
    }

    const objectName = `instagram/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.jpg`;
    const storage = new Storage();
    const gcsFile = storage.bucket(bucketName).file(objectName);

    logger.info(`[Instagram] GCS 업로드 중 (${bucketName}/${objectName})`);
    await gcsFile.save(file, {
      contentType: "image/jpeg",
      resumable: false,
    });

    // 로컬 ADC에는 client_email이 없어 signed URL을 만들 수 없다.
    // 급식 이미지는 인스타에 공개되므로 버킷 공개 읽기 + 고정 URL을 쓴다.
    return `https://storage.googleapis.com/${bucketName}/${objectName}`;
  }

  private async waitForContainer(creationId: string): Promise<void> {
    for (let attempt = 1; attempt <= 10; attempt++) {
      const status = await this.graphRequest<{
        status_code?: string;
        status?: string;
      }>(`/${creationId}?fields=status_code,status`);

      if (status.status_code === "FINISHED") return;
      if (status.status_code === "ERROR") {
        throw new Error(
          `[Instagram] 미디어 컨테이너 처리 실패: ${status.status ?? "ERROR"}`
        );
      }

      logger.info(
        `[Instagram] 컨테이너 처리 대기 중 (${status.status_code ?? "IN_PROGRESS"}, ${attempt}/10)`
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error("[Instagram] 미디어 컨테이너 처리 시간 초과");
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

        const imageUrl = await this.uploadPublicImage(file);
        const container = await this.graphRequest<{ id: string }>(
          `/${this.igUserId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: imageUrl,
              caption,
            }),
          }
        );

        await this.waitForContainer(container.id);
        await this.graphRequest(`/${this.igUserId}/media_publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: container.id,
          }),
        });

        logger.info(
          `[Instagram] 사진 업로드 성공${reason ? ` - reason: ${reason}` : ""}`
        );
        return;
      } catch (error) {
        lastError = error;
        logger.error(
          `[Instagram] 사진 업로드 실패 (시도 ${attempt}/${MAX_RETRIES}) - ${error}`
        );
        if (attempt === MAX_RETRIES) break;
        await new Promise((resolve) => setTimeout(resolve, attempt * 15_000));
      }
    }

    throw lastError;
  }
}
