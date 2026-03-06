# Syrian Daily News Bot

Cloudflare Workers bot that collects Syrian news from curated Telegram channels, deduplicates and summarizes it with AI, publishes to the website, and posts daily updates to Telegram in English and Arabic.

## Architecture

- Runtime: Cloudflare Workers (`src/index.ts`)
- Storage: Cloudflare R2 (`SY_DAILY_STORAGE`)
- State DB: Cloudflare D1 (`sy_daily_db`)
- Triggering:
- Scheduled cron via `wrangler.toml` (`1 20 * * *`)
- Manual pipeline endpoint: `POST /internal/run-pipeline`
- Webhook endpoint: `POST /webhook`

Pipeline stages are executed inside the Worker in this order:
1. Collect
2. Deduplicate
3. Summarize
4. Publish website state
5. Post to Telegram (English + Arabic)

## Prerequisites

- Node.js 22+
- Yarn
- Wrangler CLI
- Cloudflare account with Workers, R2, and D1 enabled

## Local Setup

1. Install dependencies:

```bash
yarn install
```

2. Copy `.env.example` to `.env` and fill values.

3. Run local scripts:

```bash
yarn start
```

4. Run Worker dev server:

```bash
yarn dev
```

## Deploy

```bash
yarn build
yarn deploy
```

## Useful Scripts

- `scripts/simulate-daily-trigger.sh`: calls the Worker manual pipeline endpoint
- `scripts/pull-remote-files.sh`: downloads all R2 objects to `cache/remote-files/<bucket>`

## Required Secrets/Bindings

Set via Wrangler:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `SESSION_STRING`
- `TELEGRAM_CHANNEL_ID_ENGLISH`
- `TELEGRAM_CHANNEL_ID_ARABIC`
- `OPENROUTER_API_KEY` and/or `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`
- `AI_MODEL`
- `GITHUB_TOKEN`

And ensure bindings in `wrangler.toml`:

- D1: `sy_daily_db`
- R2: `SY_DAILY_STORAGE`
