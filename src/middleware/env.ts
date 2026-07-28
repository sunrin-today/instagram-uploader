import chalk from "chalk";

const requireEnv: ReadonlyArray<string> = [
  "API_BASE_URL",
  "API_KEY",
  "SCHOOL_NAME",
  "INSTAGRAM_USERNAME",
  "INSTAGRAM_PASSWORD",
];

const requireJobEnv: ReadonlyArray<string> = [
  "API_BASE_URL",
  "API_KEY",
  "SCHOOL_NAME",
  "INSTAGRAM_USERNAME",
  "INSTAGRAM_PASSWORD",
];

function validate(required: ReadonlyArray<string>) {
  for (const env of required) {
    if (!process.env[env]) {
      throw new Error(`환경변수 ${chalk.red(env)}이(가) 설정되지 않았습니다.`);
    }
  }
}

export function validateEnv() {
  validate(requireEnv);
}

export function validateJobEnv() {
  validate(requireJobEnv);
}
