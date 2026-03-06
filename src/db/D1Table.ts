/**
 * D1 Database Adapter
 *
 * Provides a simple interface for D1 database operations.
 * State is stored in Cloudflare D1.
 *
 * Environment Variables:
 * - In local development: Uses mockD1 from src/db/mockD1.ts
 * - In Workers runtime: Uses D1 binding named "DB"
 */

import { D1Database } from "@cloudflare/workers-types";
import { mockD1 } from "./mockD1";

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type Post = {
  platform: string;
  language: string;
  url: string;
};

export type BriefingRow = {
  date: string;
  collectedTime?: string;
  deduplicatedTime?: string;
  deduplicatedUsage?: string;
  summarizedTime?: string;
  summarizedUsage?: string;
  publishedToWebsiteTime?: string;
  posts?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Briefing = {
  date: string;
  collectedTime?: string;
  deduplicatedTime?: string;
  deduplicatedUsage?: Usage;
  summarizedTime?: string;
  summarizedUsage?: Usage;
  publishedToWebsiteTime?: string;
  posts?: Post[];
  createdAt?: string;
  updatedAt?: string;
};

let d1Binding: D1Database | null = null;

export function setD1Binding(db: D1Database): void {
  d1Binding = db;
}

/**
 * Parse JSON strings from D1 rows to typed objects
 */
function parseBriefingRow(row: BriefingRow): Briefing {
  return {
    date: row.date,
    collectedTime: row.collectedTime,
    deduplicatedTime: row.deduplicatedTime,
    deduplicatedUsage: row.deduplicatedUsage
      ? JSON.parse(row.deduplicatedUsage)
      : undefined,
    summarizedTime: row.summarizedTime,
    summarizedUsage: row.summarizedUsage
      ? JSON.parse(row.summarizedUsage)
      : undefined,
    publishedToWebsiteTime: row.publishedToWebsiteTime,
    posts: row.posts ? JSON.parse(row.posts) : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Get D1 database instance
 * - In local development: Uses mockD1 (in-memory SQLite)
 * - In Workers runtime: Uses the D1 binding from environment
 */
export function getDB(): D1Database {
  if (d1Binding) {
    return d1Binding;
  }

  const db = (process.env as any).DB;
  if (!db) {
    throw new Error(
      "D1 binding 'DB' not found. Ensure D1 binding is configured in wrangler.toml",
    );
  }

  return db;
}

/**
 * Get a briefing by date
 */
export async function getBriefing(date: string): Promise<Briefing | null> {
  const db = getDB();
  const result = await db
    .prepare("SELECT * FROM briefings WHERE date = ?")
    .bind(date)
    .first<BriefingRow>();

  if (!result) {
    return null;
  }

  return parseBriefingRow(result);
}

/**
 * Initialize a new briefing
 */
export async function initializeBriefing(
  date: string,
  overwrite = false,
): Promise<Briefing> {
  const db = getDB();
  const currentBriefing = await getBriefing(date);

  if (currentBriefing && !overwrite) {
    throw new Error(`Briefing ${date} already exists`);
  }

  const now = new Date().toISOString();

  if (currentBriefing) {
    await db
      .prepare("UPDATE briefings SET updatedAt = ? WHERE date = ?")
      .bind(now, date)
      .run();
  } else {
    await db
      .prepare(
        "INSERT INTO briefings (date, createdAt, updatedAt) VALUES (?, ?, ?)",
      )
      .bind(date, now, now)
      .run();
  }

  const briefing = await getBriefing(date);
  if (!briefing) {
    throw new Error(`Failed to retrieve briefing ${date} after creation`);
  }

  return briefing;
}

/**
 * Update briefing collected time
 */
export async function updateBriefingCollectedTime(
  date: string,
  collectedTime: string | Date,
  overwrite = false,
): Promise<void> {
  const db = getDB();
  const currentBriefing = await getBriefing(date);

  if (!currentBriefing) {
    throw new Error(`Briefing ${date} not found`);
  }

  if (currentBriefing.collectedTime !== undefined && !overwrite) {
    throw new Error(`Briefing ${date} already collected`);
  }

  const time =
    typeof collectedTime === "string"
      ? collectedTime
      : collectedTime.toISOString();
  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE briefings SET collectedTime = ?, updatedAt = ? WHERE date = ?",
    )
    .bind(time, now, date)
    .run();
}

/**
 * Update briefing deduplicated time and usage
 */
export async function updateBriefingDeduplicated(
  date: string,
  deduplicatedTime: string | Date,
  deduplicatedUsage: Usage,
  overwrite = false,
): Promise<void> {
  const db = getDB();
  const currentBriefing = await getBriefing(date);

  if (!currentBriefing) {
    throw new Error(`Briefing ${date} not found`);
  }

  if (currentBriefing.collectedTime === undefined) {
    throw new Error(`Briefing ${date} not collected`);
  }

  if (currentBriefing.deduplicatedTime !== undefined && !overwrite) {
    throw new Error(`Briefing ${date} already deduplicated`);
  }

  const time =
    typeof deduplicatedTime === "string"
      ? deduplicatedTime
      : deduplicatedTime.toISOString();
  const usageJson = JSON.stringify(deduplicatedUsage);
  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE briefings SET deduplicatedTime = ?, deduplicatedUsage = ?, updatedAt = ? WHERE date = ?",
    )
    .bind(time, usageJson, now, date)
    .run();
}

/**
 * Update briefing summarized time and usage
 */
export async function updateBriefingSummarizedTime(
  date: string,
  summarizedTime: string | Date,
  summarizedUsage: Usage,
  overwrite = false,
): Promise<void> {
  const db = getDB();
  const currentBriefing = await getBriefing(date);

  if (!currentBriefing) {
    throw new Error(`Briefing ${date} not found`);
  }

  if (currentBriefing.deduplicatedTime === undefined) {
    throw new Error(`Briefing ${date} not deduplicated`);
  }

  if (currentBriefing.summarizedTime !== undefined && !overwrite) {
    throw new Error(`Briefing ${date} already summarized`);
  }

  const time =
    typeof summarizedTime === "string"
      ? summarizedTime
      : summarizedTime.toISOString();
  const usageJson = JSON.stringify(summarizedUsage);
  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE briefings SET summarizedTime = ?, summarizedUsage = ?, updatedAt = ? WHERE date = ?",
    )
    .bind(time, usageJson, now, date)
    .run();
}

/**
 * Update briefing published to website time
 */
export async function updateBriefingPublishedToWebsiteTime(
  date: string,
  publishedToWebsiteTime: string | Date,
  overwrite = false,
): Promise<void> {
  const db = getDB();
  const currentBriefing = await getBriefing(date);

  if (!currentBriefing) {
    throw new Error(`Briefing ${date} not found`);
  }

  if (currentBriefing.summarizedTime === undefined) {
    throw new Error(`Briefing ${date} not summarized`);
  }

  if (currentBriefing.publishedToWebsiteTime !== undefined && !overwrite) {
    throw new Error(`Briefing ${date} already published to website`);
  }

  const time =
    typeof publishedToWebsiteTime === "string"
      ? publishedToWebsiteTime
      : publishedToWebsiteTime.toISOString();
  const now = new Date().toISOString();

  await db
    .prepare(
      "UPDATE briefings SET publishedToWebsiteTime = ?, updatedAt = ? WHERE date = ?",
    )
    .bind(time, now, date)
    .run();
}

/**
 * Add a post to the briefing
 */
export async function updateBriefingPost(
  date: string,
  formatter: string,
  language: string,
  postUrl: string,
  overwrite = false,
): Promise<void> {
  const db = getDB();
  const currentBriefing = await getBriefing(date);

  if (!currentBriefing) {
    throw new Error(`Briefing ${date} not found`);
  }

  if (currentBriefing.publishedToWebsiteTime === undefined) {
    throw new Error(`Briefing ${date} not published to website`);
  }

  const posts = currentBriefing.posts ?? [];
  const existingPostIndex = posts.findIndex(
    (post) => post.platform === formatter && post.language === language,
  );

  if (existingPostIndex !== -1 && !overwrite) {
    const existingPost = posts[existingPostIndex];
    throw new Error(
      `Briefing ${date} already has a post for ${formatter} in ${language}, URL: ${existingPost.url}`,
    );
  }

  if (existingPostIndex !== -1) {
    posts[existingPostIndex] = { platform: formatter, language, url: postUrl };
  } else {
    posts.push({ platform: formatter, language, url: postUrl });
  }

  const postsJson = JSON.stringify(posts);
  const now = new Date().toISOString();

  await db
    .prepare("UPDATE briefings SET posts = ?, updatedAt = ? WHERE date = ?")
    .bind(postsJson, now, date)
    .run();
}
