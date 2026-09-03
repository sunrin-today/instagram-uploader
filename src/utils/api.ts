import { env } from "../constants/env";

export function apiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("X-API-Key", env.API_KEY);
  return headers;
}

export function apiFetch(path: string, init?: RequestInit) {
  const url = path.startsWith("http")
    ? path
    : `${env.API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    headers: apiHeaders(init?.headers),
  });
}

export async function apiJson<T>(path: string, init?: RequestInit) {
  const response = await apiFetch(path, init);
  const body = (await response.json()) as { data?: T };
  return { status: response.status, ok: response.ok, data: body.data };
}
