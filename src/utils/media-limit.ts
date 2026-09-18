export const DEFAULT_MEDIA_LIMIT = 365;

export type MediaItem = {
  id: string;
  timestamp?: string;
};

export function parseMediaLimit(value: string | undefined): number {
  if (value == null || value === "") return DEFAULT_MEDIA_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error(
      `INSTAGRAM_MEDIA_LIMIT는 1 이상의 정수여야 합니다: ${value}`
    );
  }
  return limit;
}

export function selectOldestMedia(
  media: MediaItem[],
  limit: number
): MediaItem[] {
  if (limit < 1) {
    throw new Error(`limit는 1 이상이어야 합니다: ${limit}`);
  }
  if (media.length <= limit) return [];

  return [...media]
    .sort((left, right) => {
      if (!left.timestamp && !right.timestamp) {
        return left.id.localeCompare(right.id);
      }
      if (!left.timestamp) return 1;
      if (!right.timestamp) return -1;
      return (
        left.timestamp.localeCompare(right.timestamp) ||
        left.id.localeCompare(right.id)
      );
    })
    .slice(0, media.length - limit);
}
