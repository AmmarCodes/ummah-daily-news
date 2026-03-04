/**
 * Cloudflare Workers Entry Point
 *
 * Main entry point for Cloudflare Workers deployment.
 * Handles cron triggers for daily news collection and Telegram webhook updates.
 */

import { collect } from "./news-collection/collect";
import { uploadJSON, downloadJSON } from "./storage";
import {
  getEpochSecondsMostRecent_11_PM_InDamascus,
  formatDateUTCPlus3,
} from "./utils/dateUtils";
import {
  initializeBriefing,
  updateBriefingCollectedTime,
  updateBriefingDeduplicated,
  updateBriefingSummarizedTime,
  updateBriefingPublishedToWebsiteTime,
  updateBriefingPost,
  getBriefing,
  setD1Binding,
} from "./db/D1Table";
import { Env } from "./types/env";
import { webhookCallback } from "grammy";
import { TelegramBot } from "./telegram/bot";
import { deduplicate } from "./ai/deduplicate";
import { summarize } from "./ai/summarize";
import { getCurrentUsage, resetCurrentUsage } from "./ai/getLLMProvider";
import { prioritizeAndFormat } from "./prioritizeAndFormat";
import { ContentLanguage, ProcessedNews, SimplifiedNewsWithMetadata } from "./types";

const ONE_MINUTE_MILLISECONDS = 60 * 1000;
const TELEGRAM_LANGUAGES: ContentLanguage[] = ["english", "arabic"];
const ZERO_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
};

function verifyWebhookSecret(request: Request, secret: string): boolean {
  const secretHeader = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  return secretHeader === secret;
}

function verifyPipelineTriggerToken(request: Request, token: string): boolean {
  const header = request.headers.get("X-Pipeline-Token");
  return header === token;
}

function setRuntimeBindings(env: Env): void {
  setD1Binding(env.sy_daily_db);

  const stringEnv: Array<keyof Env> = [
    "AI_MODEL",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "ANTHROPIC_API_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHANNEL_ID_ENGLISH",
    "TELEGRAM_CHANNEL_ID_ARABIC",
    "GITHUB_TOKEN",
  ];

  for (const key of stringEnv) {
    const value = env[key];
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}

function getTelegramChannelId(env: Env, language: ContentLanguage): number {
  const raw =
    language === "english"
      ? env.TELEGRAM_CHANNEL_ID_ENGLISH
      : env.TELEGRAM_CHANNEL_ID_ARABIC;

  const fallback =
    language === "english"
      ? env.TELEGRAM_CHANNEL_ID_ARABIC
      : env.TELEGRAM_CHANNEL_ID_ENGLISH;
  const value = raw || fallback;

  if (!value) {
    throw new Error(`TELEGRAM channel ID for ${language} is not configured`);
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid TELEGRAM channel ID for ${language}: ${value}`);
  }

  return parsed;
}

function getTelegramPostUrl(channelId: number, messageId: number): string {
  const channel = channelId.toString();
  if (channel.startsWith("-100")) {
    return `https://t.me/c/${channel.slice(4)}/${messageId}`;
  }
  return `https://t.me/${channel}/${messageId}`;
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

  const bot = new TelegramBot(undefined, env);

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
  options?: { simulateAI?: boolean },
): Promise<void> {
  setRuntimeBindings(env);
  const simulateAI = options?.simulateAI === true;

  const date = new Date(event.scheduledTime);
  const lastMidnightInDamascus =
    getEpochSecondsMostRecent_11_PM_InDamascus(date) * 1000;
  const damascusDate = formatDateUTCPlus3(
    new Date(lastMidnightInDamascus - ONE_MINUTE_MILLISECONDS),
  );

  console.log(`Starting pipeline for scheduled event: ${date.toISOString()}`);

  let briefing = await getBriefing(damascusDate);
  if (!briefing) {
    await initializeBriefing(damascusDate);
    briefing = await getBriefing(damascusDate);
  }

  if (!briefing) {
    throw new Error(`Failed to initialize briefing ${damascusDate}`);
  }

  const collectedKey = `collected-news/${damascusDate}.json`;
  let collectedNewsWithDate = await downloadJSON<{
    newsItems: string[];
    numberOfPosts: number;
    numberOfSources: number;
    date: string;
  }>(collectedKey, env).catch(() => null);

  if (!briefing.collectedTime || !collectedNewsWithDate) {
    const collectedNews = await collect(date);
    collectedNewsWithDate = {
      ...collectedNews,
      date: damascusDate,
    };
    await uploadJSON(collectedKey, collectedNewsWithDate, env);

    if (!briefing.collectedTime) {
      await updateBriefingCollectedTime(damascusDate, new Date(), true);
    }
    console.log(`Stage collect complete: ${collectedKey}`);
  } else {
    console.log(`Stage collect skipped (already complete): ${collectedKey}`);
  }

  briefing = await getBriefing(damascusDate);
  if (!briefing) {
    throw new Error(`Briefing ${damascusDate} disappeared during pipeline`);
  }

  const deduplicatedKey = `deduplicated-news/${damascusDate}.json`;
  let deduplicatedNews = await downloadJSON<SimplifiedNewsWithMetadata>(
    deduplicatedKey,
    env,
  ).catch(() => null);

  if (!briefing.deduplicatedTime || !deduplicatedNews) {
    const deduplicatedItems = simulateAI
      ? collectedNewsWithDate.newsItems
          .slice(0, 20)
          .map((text, index) => ({
            text,
            sources: [`https://example.com/source/${index + 1}`],
          }))
      : await (async () => {
          resetCurrentUsage();
          return deduplicate(collectedNewsWithDate.newsItems);
        })();
    deduplicatedNews = {
      items: deduplicatedItems,
      numberOfPosts: collectedNewsWithDate.numberOfPosts,
      numberOfSources: collectedNewsWithDate.numberOfSources,
      date: damascusDate,
    };
    await uploadJSON(deduplicatedKey, deduplicatedNews, env);
    if (!briefing.deduplicatedTime) {
      await updateBriefingDeduplicated(
        damascusDate,
        new Date(),
        simulateAI ? ZERO_USAGE : getCurrentUsage(),
        true,
      );
    }
    console.log(`Stage deduplicate complete: ${deduplicatedKey}`);
  } else {
    console.log(`Stage deduplicate skipped (already complete): ${deduplicatedKey}`);
  }

  briefing = await getBriefing(damascusDate);
  if (!briefing) {
    throw new Error(`Briefing ${damascusDate} disappeared during pipeline`);
  }

  const summarizedKey = `summarized-news/${damascusDate}.json`;
  let summarizedNews = await downloadJSON<ProcessedNews>(summarizedKey, env).catch(
    () => null,
  );

  if (!briefing.summarizedTime || !summarizedNews) {
    const summarizedResponse = simulateAI
      ? await summarize(
          deduplicatedNews.items.map(
            (item) => `${item.text}\n${item.sources.join("\n")}`,
          ),
          true,
        )
      : await (async () => {
          resetCurrentUsage();
          return summarize(
            deduplicatedNews.items.map(
              (item) => `${item.text}\n${item.sources.join("\n")}`,
            ),
          );
        })();
    summarizedNews = {
      newsResponse: summarizedResponse,
      numberOfPosts: deduplicatedNews.numberOfPosts,
      numberOfSources: deduplicatedNews.numberOfSources,
      date: damascusDate,
    };
    await uploadJSON(summarizedKey, summarizedNews, env);
    if (!briefing.summarizedTime) {
      await updateBriefingSummarizedTime(
        damascusDate,
        new Date(),
        simulateAI ? ZERO_USAGE : getCurrentUsage(),
        true,
      );
    }
    console.log(`Stage summarize complete: ${summarizedKey}`);
  } else {
    console.log(`Stage summarize skipped (already complete): ${summarizedKey}`);
  }

  briefing = await getBriefing(damascusDate);
  if (!briefing) {
    throw new Error(`Briefing ${damascusDate} disappeared during pipeline`);
  }

  if (!briefing.publishedToWebsiteTime) {
    await updateBriefingPublishedToWebsiteTime(damascusDate, new Date(), true);
    console.log("Stage publish-state complete: marked publishedToWebsiteTime");
  } else {
    console.log("Stage publish-state skipped (already complete)");
  }

  briefing = await getBriefing(damascusDate);
  if (!briefing) {
    throw new Error(`Briefing ${damascusDate} disappeared during pipeline`);
  }

  for (const language of TELEGRAM_LANGUAGES) {
    const alreadyPosted = briefing.posts?.some(
      (post) => post.platform === "telegram" && post.language === language,
    );
    if (alreadyPosted) {
      console.log(`Stage telegram ${language} skipped (already posted)`);
      continue;
    }

    const formatted = prioritizeAndFormat(summarizedNews, language, "telegram");
    if (!formatted) {
      console.log(`Stage telegram ${language} skipped (no items to post)`);
      continue;
    }

    const channelId = getTelegramChannelId(env, language);
    const telegramBot = new TelegramBot(channelId, env);
    const result = await telegramBot.postMessage(formatted.message);
    const postUrl = getTelegramPostUrl(channelId, result.message_id);
    await updateBriefingPost(damascusDate, "telegram", language, postUrl, true);
    console.log(`Stage telegram ${language} complete: ${postUrl}`);
  }
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

    if (url.pathname === "/internal/run-pipeline") {
      if (!env.TELEGRAM_BOT_TOKEN) {
        return new Response(
          JSON.stringify({ error: "TELEGRAM_BOT_TOKEN not configured" }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }

      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({ error: "Method not allowed, use POST" }),
          { status: 405, headers: { "Content-Type": "application/json" } },
        );
      }

      if (!verifyPipelineTriggerToken(request, env.TELEGRAM_BOT_TOKEN)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const scheduledAt = Date.now();
      const simulateAI = url.searchParams.get("simulate") === "true";
      const manualEvent = {
        cron: "manual",
        scheduledTime: scheduledAt,
        noRetry() {
          // no-op for manual trigger
        },
      } as ScheduledController;

      try {
        await handleScheduled(manualEvent, env, { simulateAI });
        return new Response(
          JSON.stringify({
            status: "ok",
            mode: "manual",
            simulateAI,
            scheduledTime: new Date(scheduledAt).toISOString(),
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      } catch (error) {
        console.error("Error in manual pipeline trigger:", error);
        return new Response(
          JSON.stringify({
            status: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
    }

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
