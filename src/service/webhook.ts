import { env } from "../constants/env";
import { WebhookConfig } from "../types/service/webhook";

const WEBHOOK_AUTHOR_NAME = "선린투데이";
const WEBHOOK_AUTHOR_AVATAR_URL =
  "https://avatars.githubusercontent.com/u/166101514";

export function sendWebhook({
  content,
  embeds,
  files,
  allowed_mentions,
  name = WEBHOOK_AUTHOR_NAME,
  avatar_url = WEBHOOK_AUTHOR_AVATAR_URL,
}: WebhookConfig) {
  const payload = {
    username: name,
    avatar_url,
    content,
    embeds,
    allowed_mentions,
  };

  if (!files?.length) {
    return fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  files.forEach((file, index) => {
    form.append(
      `files[${index}]`,
      new Blob([new Uint8Array(file.data)], {
        type: file.type ?? "image/jpeg",
      }),
      file.name
    );
  });

  return fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    body: form,
  });
}
