/**
 * Storage Adapter Module
 *
 * Provides a unified interface for storage operations in Cloudflare Workers (R2).
 */

import { Env } from "../types/env";
import * as r2 from "./r2";

export async function uploadJSON<T>(
  key: string,
  data: T,
  env: Env,
): Promise<void> {
  return r2.uploadJSON(env.SY_DAILY_STORAGE, key, data);
}

export async function uploadBinary(
  key: string,
  data: ArrayBuffer | Uint8Array,
  env: Env,
): Promise<void> {
  return r2.uploadBinary(env.SY_DAILY_STORAGE, key, data);
}

export async function downloadJSON<T>(key: string, env: Env): Promise<T> {
  return r2.downloadJSON<T>(env.SY_DAILY_STORAGE, key);
}

export async function downloadBinary(
  key: string,
  env: Env,
): Promise<ArrayBufferLike> {
  return r2.downloadBinary(env.SY_DAILY_STORAGE, key);
}

export async function objectExists(key: string, env: Env): Promise<boolean> {
  return r2.objectExists(env.SY_DAILY_STORAGE, key);
}

export async function deleteObject(key: string, env: Env): Promise<void> {
  return r2.deleteObject(env.SY_DAILY_STORAGE, key);
}
