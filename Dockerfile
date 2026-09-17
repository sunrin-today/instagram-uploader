FROM node:23-bookworm-slim AS builder

ENV TZ=Asia/Seoul
ENV PATH="/app/.venv/bin:${PATH}"
RUN apt-get update && apt-get install -y tzdata python3 python3-venv python3-pip \
    && ln -sf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone

WORKDIR /app
COPY package.json pnpm-lock.yaml requirements.txt ./
RUN corepack enable && corepack prepare pnpm --activate
RUN pnpm install --no-frozen-lockfile
RUN python3 -m venv .venv \
    && .venv/bin/pip install --no-cache-dir -U pip \
    && .venv/bin/pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["pnpm", "run", "start"]
