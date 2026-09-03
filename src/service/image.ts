import { spawn } from "child_process";
import path from "path";

import { MealImageInput, RestImageInput } from "../types";
import { Logger } from "../utils/logger";

const logger = new Logger();

type ImageServiceResponse = Buffer;

function scriptPath(filename: string) {
  return path.resolve(__dirname, "../../src/scripts", filename);
}

function runPython(script: string, payload: unknown): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", [script], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(detail || `python3 exited with code ${code}`));
        return;
      }

      const image = Buffer.concat(stdout);
      if (image.length < 2 || image[0] !== 0xff || image[1] !== 0xd8) {
        reject(new Error("Python이 JPEG를 반환하지 않았습니다"));
        return;
      }

      resolve(image);
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

export class ImageService {
  public async generateMealImage(
    input: MealImageInput
  ): Promise<ImageServiceResponse> {
    try {
      logger.info("[Image] 급식 이미지 생성 시작 (Python 스크립트 실행)");
      const image = await runPython(
        scriptPath("generate_meal_image.py"),
        input
      );
      logger.info("[Image] 급식 이미지 생성 완료");
      return image;
    } catch (error) {
      logger.error(`[Image] 급식 이미지 생성 실패: ${error}`);
      throw error;
    }
  }

  public async generateRestImage(
    input: RestImageInput
  ): Promise<ImageServiceResponse> {
    try {
      logger.info("[Image] 휴식 이미지 생성 시작 (Python 스크립트 실행)");
      const image = await runPython(
        scriptPath("generate_rest_image.py"),
        input
      );
      logger.info("[Image] 휴식 이미지 생성 완료");
      return image;
    } catch (error) {
      logger.error(`[Image] 휴식 이미지 생성 실패: ${error}`);
      throw error;
    }
  }
}
