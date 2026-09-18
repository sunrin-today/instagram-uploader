import { readFile, writeFile } from "fs/promises";
import path from "path";

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { Storage } from "@google-cloud/storage";

import { env } from "../constants/env";
import { validateCaption } from "../middleware/caption";
import { upsertEnvValue } from "../utils/dotenv-file";
import { Logger } from "../utils/logger";
import { MediaItem, selectOldestMedia } from "../utils/media-limit";

const logger = new Logger();
const GRAPH_API_BASE = "https://graph.instagram.com/v25.0";
const TOKEN_SECRET_NAME = "instagram-access-token";
const MEDIA_PAGE_SIZE = 100;
const DELETE_RETRY_LIMIT = 3;
const DELETE_GAP_MS = 2000;
const RATE_LIMIT_RETRY_LIMIT = 4;

function isPermissionError(message: string): boolean {
  return /instagram_manage_contents|(?:^|[^0-9])code=10(?:[^0-9]|$)|(?:^|[^0-9])code=200(?:[^0-9]|$)|#10\b|#200\b|unsupported delete|missing permissions/i.test(
    message
  );
}

function isRateLimitError(message: string): boolean {
  return /too many actions|(?:^|[^0-9])code=9(?:[^0-9]|$)|subcode=2207074/i.test(
    message
  );
}

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
    init?: RequestInit,
    options?: { baseUrl?: string; accessToken?: string }
  ): Promise<T> {
    const url = `${options?.baseUrl ?? GRAPH_API_BASE}${path}`;
    const headers = new Headers(init?.headers);
    headers.set(
      "Authorization",
      `Bearer ${options?.accessToken ?? this.accessToken}`
    );
    const response = await fetch(url, { ...init, headers });
    const text = await response.text();
    let body = {} as T & GraphErrorBody;
    if (text) {
      try {
        body = JSON.parse(text) as T & GraphErrorBody;
      } catch {
        throw new Error(
          `[Instagram] Graph API 실패 (${response.status}): ${text}`
        );
      }
    }
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
          error?.message ?? (text || JSON.stringify(body))
        }${details ? ` (${details})` : ""}`
      );
    }
    return body;
  }

  private isCloudRunJob(): boolean {
    return Boolean(process.env.CLOUD_RUN_JOB || process.env.K_SERVICE);
  }

  private async persistRefreshedToken(token: string): Promise<void> {
    process.env.INSTAGRAM_ACCESS_TOKEN = token;

    if (this.isCloudRunJob()) {
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
      return;
    }

    const envPath = path.resolve(process.cwd(), ".env");
    try {
      const current = await readFile(envPath, "utf8");
      const { next } = upsertEnvValue(current, "INSTAGRAM_ACCESS_TOKEN", token);
      await writeFile(envPath, next, "utf8");
      logger.info("[Instagram] 갱신된 토큰을 로컬 .env에 저장했습니다");
    } catch (error) {
      logger.warn(
        `[Instagram] 로컬 .env에 갱신된 토큰을 저장하지 못했습니다: ${error}`
      );
    }
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

  private deleteRequestOptions() {
    return {
      baseUrl: env.INSTAGRAM_DELETE_GRAPH_API_BASE || GRAPH_API_BASE,
      accessToken: env.INSTAGRAM_DELETE_ACCESS_TOKEN || this.accessToken,
    };
  }

  public async listMedia(): Promise<MediaItem[]> {
    const media: MediaItem[] = [];
    let after: string | undefined;

    for (let page = 1; page <= 100; page++) {
      const query = new URLSearchParams({
        fields: "id,timestamp",
        limit: String(MEDIA_PAGE_SIZE),
      });
      if (after) query.set("after", after);

      const response = await this.graphRequest<{
        data?: Array<{ id?: string; timestamp?: string }>;
        paging?: { cursors?: { after?: string }; next?: string };
      }>(`/${this.igUserId}/media?${query.toString()}`);

      for (const item of response.data ?? []) {
        if (item.id) {
          media.push({ id: item.id, timestamp: item.timestamp });
        }
      }

      after = response.paging?.next
        ? response.paging.cursors?.after
        : undefined;
      if (!after) break;
    }

    logger.info(`[Instagram] 피드 게시물 ${media.length}개 조회`);
    return media;
  }

  public async deleteMedia(id: string): Promise<void> {
    try {
      await this.graphRequest(
        `/${id}`,
        { method: "DELETE" },
        this.deleteRequestOptions()
      );
    } catch (error) {
      const message = String(error);
      if (isPermissionError(message)) {
        throw new Error(
          `[Instagram] 게시물 삭제가 거절되었습니다. 공식 삭제는 Facebook Login과 instagram_manage_contents 권한이 필요합니다. INSTAGRAM_DELETE_ACCESS_TOKEN, INSTAGRAM_DELETE_GRAPH_API_BASE를 확인하세요. 원인: ${message}`
        );
      }
      throw error;
    }
  }

  public async trimMediaToLimit({
    dryRun = false,
  }: {
    dryRun?: boolean;
  } = {}): Promise<{
    before: number;
    deleted: number;
    after: number;
    stoppedReason?: "rate_limit";
  }> {
    const limit = env.INSTAGRAM_MEDIA_LIMIT;
    const media = await this.listMedia();
    const oldest = selectOldestMedia(media, limit);

    logger.info(
      `[Instagram] 게시물 한도 ${limit}개 유지 - 현재 ${media.length}개, 삭제 대상 ${oldest.length}개${dryRun ? " (dry-run)" : ""}`
    );

    if (oldest.length === 0) {
      return { before: media.length, deleted: 0, after: media.length };
    }

    if (dryRun) {
      for (const item of oldest) {
        logger.info(
          `[Instagram] dry-run 삭제 예정 ${item.id} (${item.timestamp ?? "timestamp 없음"})`
        );
      }
      return {
        before: media.length,
        deleted: 0,
        after: media.length,
      };
    }

    let deleted = 0;
    for (const item of oldest) {
      let lastError: unknown;
      let rateLimited = false;

      for (let attempt = 1; attempt <= RATE_LIMIT_RETRY_LIMIT; attempt++) {
        try {
          logger.info(
            `[Instagram] 오래된 게시물 삭제 ${deleted + 1}/${oldest.length} - ${item.id} (${item.timestamp ?? "timestamp 없음"})`
          );
          await this.deleteMedia(item.id);
          deleted += 1;
          lastError = undefined;
          rateLimited = false;
          break;
        } catch (error) {
          lastError = error;
          const message = String(error);
          logger.error(
            `[Instagram] 게시물 삭제 실패 (시도 ${attempt}/${RATE_LIMIT_RETRY_LIMIT}) - ${error}`
          );

          if (isPermissionError(message)) {
            break;
          }

          if (isRateLimitError(message)) {
            rateLimited = true;
            if (attempt < RATE_LIMIT_RETRY_LIMIT) {
              const waitMs = attempt * 60_000;
              logger.warn(
                `[Instagram] 삭제 속도 제한 - ${waitMs / 1000}초 대기 후 재시도`
              );
              await new Promise((resolve) => setTimeout(resolve, waitMs));
              continue;
            }
            break;
          }

          if (attempt >= DELETE_RETRY_LIMIT) break;
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
        }
      }

      if (lastError && rateLimited) {
        logger.warn(
          `[Instagram] 속도 제한으로 이번 정리를 멈춥니다. ${deleted}개 삭제됨, 나머지는 다음에 이어서 지웁니다`
        );
        return {
          before: media.length,
          deleted,
          after: media.length - deleted,
          stoppedReason: "rate_limit",
        };
      }

      if (lastError) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, DELETE_GAP_MS));
    }

    logger.info(
      `[Instagram] 게시물 한도 정리 완료 - ${media.length}개 → ${media.length - deleted}개`
    );
    return {
      before: media.length,
      deleted,
      after: media.length - deleted,
    };
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
        try {
          await this.trimMediaToLimit();
        } catch (error) {
          logger.error(
            `[Instagram] 업로드는 성공했지만 게시물 한도 정리에 실패했습니다: ${error}`
          );
        }
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
