import { upsertEnvValue } from "../dotenv-file";

describe("upsertEnvValue", () => {
  it("따옴표가 있는 기존 값을 같은 형식으로 교체한다", () => {
    const { next, replaced } = upsertEnvValue(
      'INSTAGRAM_ACCESS_TOKEN="old"\nSCHOOL_NAME="선린"\n',
      "INSTAGRAM_ACCESS_TOKEN",
      "new-token"
    );

    expect(replaced).toBe(true);
    expect(next).toBe(
      'INSTAGRAM_ACCESS_TOKEN="new-token"\nSCHOOL_NAME="선린"\n'
    );
  });

  it("키가 없으면 파일 끝에 추가한다", () => {
    const { next, replaced } = upsertEnvValue(
      'SCHOOL_NAME="선린"\n',
      "INSTAGRAM_ACCESS_TOKEN",
      "new-token"
    );

    expect(replaced).toBe(false);
    expect(next).toBe(
      'SCHOOL_NAME="선린"\nINSTAGRAM_ACCESS_TOKEN="new-token"\n'
    );
  });
});
