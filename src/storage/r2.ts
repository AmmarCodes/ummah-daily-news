/**
 * R2 Storage Utility Module
 *
 * Provides functions for uploading to and downloading from Cloudflare R2 bucket.
 */

import { R2Bucket } from "@cloudflare/workers-types";

/**
 * Upload JSON data to R2
 *
 * @param bucket - R2 bucket instance from env binding
 * @param key - Object key (path in bucket)
 * @param data - JSON data to upload
 * @throws Error if upload fails (e.g., invalid credentials)
 */
export async function uploadJSON<T>(
  bucket: R2Bucket,
  key: string,
  data: T,
): Promise<void> {
  try {
    await bucket.put(key, JSON.stringify(data));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload to R2 (${key}): ${errorMessage}`);
  }
}

/**
 * Upload binary data to R2
 *
 * @param bucket - R2 bucket instance from env binding
 * @param key - Object key (path in bucket)
 * @param data - Binary data to upload (ArrayBuffer, Uint8Array, etc.)
 * @throws Error if upload fails (e.g., invalid credentials)
 */
export async function uploadBinary(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer | Uint8Array,
): Promise<void> {
  try {
    await bucket.put(key, data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to upload to R2 (${key}): ${errorMessage}`);
  }
}

/**
 * Download JSON data from R2
 *
 * @param bucket - R2 bucket instance from env binding
 * @param key - Object key (path in bucket)
 * @returns Parsed JSON data
 * @throws Error if download fails or object not found
 */
export async function downloadJSON<T>(
  bucket: R2Bucket,
  key: string,
): Promise<T> {
  try {
    const object = await bucket.get(key);
    if (!object) {
      throw new Error(`Object not found: ${key}`);
    }
    const text = await object.text();
    return JSON.parse(text) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download from R2 (${key}): ${errorMessage}`);
  }
}

/**
 * Download binary data from R2
 *
 * @param bucket - R2 bucket instance from env binding
 * @param key - Object key (path in bucket)
 * @returns Binary data as ArrayBuffer
 * @throws Error if download fails or object not found
 */
export async function downloadBinary(
  bucket: R2Bucket,
  key: string,
): Promise<ArrayBufferLike> {
  try {
    const object = await bucket.get(key);
    if (!object) {
      throw new Error(`Object not found: ${key}`);
    }
    return await object.arrayBuffer();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download from R2 (${key}): ${errorMessage}`);
  }
}

/**
 * Check if object exists in R2
 *
 * @param bucket - R2 bucket instance from env binding
 * @param key - Object key (path in bucket)
 * @returns true if object exists, false otherwise
 */
export async function objectExists(
  bucket: R2Bucket,
  key: string,
): Promise<boolean> {
  try {
    const object = await bucket.head(key);
    return object !== null;
  } catch {
    return false;
  }
}

/**
 * Delete object from R2
 *
 * @param bucket - R2 bucket instance from env binding
 * @param key - Object key (path in bucket)
 * @throws Error if delete fails
 */
export async function deleteObject(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to delete from R2 (${key}): ${errorMessage}`);
  }
}
