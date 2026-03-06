# Project Notes

## Commands

- `yarn build` - Build Cloudflare Worker bundle
- `yarn dev` - Run Worker locally with Wrangler
- `yarn deploy` - Deploy Worker to Cloudflare
- `yarn start` - Run local Node pipeline workflow
- `yarn test` - Run tests

## Runtime

- Entry point: `src/index.ts`
- Storage: R2 (`SY_DAILY_STORAGE`)
- Database: D1 (`sy_daily_db`)
- Telegram webhook: `/webhook`
- Manual trigger: `/internal/run-pipeline`

## Core Modules

- Collection: `src/news-collection/collect.ts`
- Deduplication: `src/ai/deduplicate.ts`
- Summarization: `src/ai/summarize.ts`
- Formatting: `src/formatting/*`
- Telegram posting: `src/telegram/*`
- State operations: `src/db/D1Table.ts`

## Notes

- Pipeline is fully Cloudflare-based.
- Do not add non-Cloudflare deployment dependencies or templates.
