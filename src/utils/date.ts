// 날짜 관련 함수를 위한 타입 정의
export type DateIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const availableLang = ["ko", "en"] as const;
const KST = "Asia/Seoul";

export const dateName: { [key in string]: ReadonlyArray<string> } = {
  ko: ["일", "월", "화", "수", "목", "금", "토"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

/** 한국 날짜 YYYY-MM-DD. 업로드·조회·그림이 이 값을 같이 쓴다. */
export function getKstIsoDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function weekdayNameFromIso(iso: string, lang: string): string {
  if (!availableLang.includes(lang as (typeof availableLang)[number])) {
    throw new Error("(getDatName) 지원하지 않는 언어입니다.");
  }
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dateName[lang][weekday as DateIndex];
}

export function formatIsoDateKorean(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${year}년 ${month}월 ${day}일 ${weekdayNameFromIso(iso, "ko")}요일`;
}

export function monthRangeFromIso(iso: string): { from: string; to: string } {
  const [year, month] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 *
 * @param date {Date} 날짜 객체
 * @param lang 변환될 요일 언어 (ex. ko, en)
 * @returns {string} 변환될 한글 용어
 */
export function getDayName(date: Date, lang: string): string {
  if (!availableLang.includes(lang as (typeof availableLang)[number])) {
    throw new Error("(getDatName) 지원하지 않는 언어입니다.");
  }
  return dateName[lang][date.getDay() as DateIndex];
}

export function isFirstWeekdayOfMonth(date: Date | string): boolean {
  const iso = typeof date === "string" ? date : getKstIsoDate(date);
  const [year, month, day] = iso.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();

  if (firstWeekday === 0) {
    return day === 2;
  }
  if (firstWeekday === 6) {
    return day === 3;
  }
  return day === 1;
}

export function getCurrentDateKorean(date: Date): string {
  return formatIsoDateKorean(getKstIsoDate(date));
}
