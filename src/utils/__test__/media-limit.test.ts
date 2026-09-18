import {
  DEFAULT_MEDIA_LIMIT,
  parseMediaLimit,
  selectOldestMedia,
} from "../media-limit";

describe("parseMediaLimit", () => {
  it("값이 없으면 365를 반환한다", () => {
    expect(parseMediaLimit(undefined)).toBe(DEFAULT_MEDIA_LIMIT);
    expect(parseMediaLimit("")).toBe(365);
  });

  it("정수 문자열을 그대로 반환한다", () => {
    expect(parseMediaLimit("200")).toBe(200);
  });

  it("잘못된 값이면 에러를 던진다", () => {
    expect(() => parseMediaLimit("abc")).toThrow(/정수/);
    expect(() => parseMediaLimit("0")).toThrow(/정수/);
    expect(() => parseMediaLimit("1.5")).toThrow(/정수/);
  });
});

describe("selectOldestMedia", () => {
  it("한도 이하면 빈 배열을 반환한다", () => {
    expect(
      selectOldestMedia(
        [
          { id: "1", timestamp: "2026-01-01T00:00:00+0000" },
          { id: "2", timestamp: "2026-01-02T00:00:00+0000" },
        ],
        2
      )
    ).toEqual([]);
  });

  it("오래된 게시물부터 초과분만큼 고른다", () => {
    const selected = selectOldestMedia(
      [
        { id: "new", timestamp: "2026-03-01T00:00:00+0000" },
        { id: "old", timestamp: "2025-01-01T00:00:00+0000" },
        { id: "mid", timestamp: "2025-06-01T00:00:00+0000" },
      ],
      1
    );

    expect(selected.map((item) => item.id)).toEqual(["old", "mid"]);
  });

  it("timestamp가 없으면 삭제 후보 뒤로 보낸다", () => {
    const selected = selectOldestMedia(
      [
        { id: "unknown" },
        { id: "old", timestamp: "2025-01-01T00:00:00+0000" },
        { id: "new", timestamp: "2026-01-01T00:00:00+0000" },
      ],
      2
    );

    expect(selected.map((item) => item.id)).toEqual(["old"]);
  });
});
