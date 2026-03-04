/**
 * Cloudflare Workers Entry Point
 *
 * Main entry point for Cloudflare Workers deployment.
 * Handles cron triggers for daily news collection and Telegram webhook updates.
 */

import { collect } from "./news-collection/collect";
import { uploadJSON } from "./storage";
import {
  getEpochSecondsMostRecent_11_PM_InDamascus,
  formatDateUTCPlus3,
} from "./utils/dateUtils";
import {
  initializeBriefing,
  updateBriefingCollectedTime,
  getBriefing,
} from "./db/D1Table";
import { Env } from "./types/env";
import { webhookCallback } from "grammy";
import { TelegramBot } from "./telegram/bot";

const ONE_MINUTE_MILLISECONDS = 60 * 1000;

function verifyWebhookSecret(request: Request, secret: string): boolean {
  const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  return secretHeader === secret;
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ error: "TELEGRAM_WEBHOOK_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!verifyWebhookSecret(request, webhookSecret)) {
    return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bot = new TelegramBot(0, env);

  try {
    const handler = webhookCallback(bot.bot, "cloudflare-mod");
    return await handler(request);
  } catch (error) {
    console.error("Error handling webhook:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
async function handleScheduled(
  event: ScheduledController,
  env: Env,
): Promise<void> {
  const date = new Date(event.scheduledTime);
  const lastMidnightInDamascus =
    getEpochSecondsMostRecent_11_PM_InDamascus(date) * 1000;
  const damascusDate = formatDateUTCPlus3(
    new Date(lastMidnightInDamascus - ONE_MINUTE_MILLISECONDS),
  );

  console.log(`Starting news collection for: ${date.toISOString()}`);

  // Check if briefing already exists (idempotency)
  const existingBriefing = await getBriefing(damascusDate);
  if (existingBriefing && existingBriefing.collectedTime) {
    console.log(`Briefing ${damascusDate} already collected, skipping`);
    return;
  }

  // Initialize briefing in D1
  await initializeBriefing(damascusDate);

  // Collect news from Telegram channels
  const collectedNews = await collect(date);
  const collectedNewsWithDate = {
    ...collectedNews,
    date: damascusDate,
  };

  // Upload to R2 storage
  const r2Key = `collected-news/${damascusDate}.json`;
  await uploadJSON(r2Key, collectedNewsWithDate, env);

  // Update briefing collected time
  await updateBriefingCollectedTime(damascusDate, new Date());

  console.log(`Successfully uploaded news data: ${r2Key}`);

  // Note: Next pipeline stages will be triggered by separate Workers or queue mechanism
  // This is different from AWS EventBridge pattern - see US-006 for webhook implementation
}

/**
 * Main Workers entry point
 *
 * Routes requests to appropriate handlers:
 * - Cron triggers -> handleScheduled
 * - HTTP requests -> fallback response
 */
export default {
  async scheduled(
    event: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ) {
    try {
      console.log("Received scheduled event");
      await handleScheduled(event, env);
    } catch (error) {
      console.error("Error in scheduled handler:", error);
      throw error;
    }
  },

  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook") {
      return handleWebhook(request, env);
    }

    return new Response(
      JSON.stringify({
        message: "Syrian Daily News Bot - Cloudflare Workers",
        status: "running",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
  },
};
