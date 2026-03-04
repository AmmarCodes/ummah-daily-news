/**
 * Environment bindings for Cloudflare Workers
 *
 * Defines the type for bindings that Cloudflare injects into Worker handlers.
 */

import { R2Bucket, D1Database } from "@cloudflare/workers-types";

export interface Env {
  /**
   * R2 bucket for intermediate storage of news data
   */
  SY_DAILY_STORAGE: R2Bucket;

  /**
   * D1 database for state management
   */
  sy_daily_db: D1Database;

  /**
   * EventBridge bus name (for event routing)
   */
  BUS_NAME?: string;

  /**
   * Telegram configuration (for posting messages and webhooks)
   */
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_CHANNEL_ID_ENGLISH?: string;
  TELEGRAM_CHANNEL_ID_ARABIC?: string;
  TELEGRAM_API_ID?: string;
  TELEGRAM_API_HASH?: string;
  SESSION_STRING?: string;

  /**
   * AI configuration
   */
  OPENAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_MODEL?: string;

  /**
   * GitHub token for publishing
   */
  GITHUB_TOKEN?: string;

  /**
   * Other environment variables
   */
  AWS_REGION?: string;
  STATE_TABLE_NAME?: string;
  NODE_OPTIONS?: string;
  NODE_ENV?: string;
  IS_LAMBDA?: string;
}
