/**
 * Storage Adapter Module
 *
 * Provides a unified interface for storage operations that works in both
 * AWS Lambda (using S3) and Cloudflare Workers (using R2).
 * This allows gradual migration to Workers without breaking existing Lambda code.
 */

import { R2Bucket } from "@cloudflare/workers-types";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Env } from "../types/env";
import * as r2 from "./r2";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }
  return s3Client;
}

function isWorkersEnv(env: unknown): env is Env {
  return env !== null && typeof env === "object" && "SY_DAILY_STORAGE" in env;
}

export async function uploadJSON<T>(
  key: string,
  data: T,
  env?: Env,
): Promise<void> {
  if (env && isWorkersEnv(env)) {
    return r2.uploadJSON(env.SY_DAILY_STORAGE, key, data);
  }

  const client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME!;
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: "application/json",
    }),
  );
}

export async function uploadBinary(
  key: string,
  data: ArrayBuffer | Uint8Array,
  env?: Env,
): Promise<void> {
  if (env && isWorkersEnv(env)) {
    return r2.uploadBinary(env.SY_DAILY_STORAGE, key, data);
  }

  const client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME!;
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: data instanceof Uint8Array ? data : Buffer.from(data),
    }),
  );
}

export async function downloadJSON<T>(key: string, env?: Env): Promise<T> {
  if (env && isWorkersEnv(env)) {
    return r2.downloadJSON<T>(env.SY_DAILY_STORAGE, key);
  }

  const client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME!;
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
  const content = await response.Body!.transformToString();
  return JSON.parse(content) as T;
}

export async function downloadBinary(
  key: string,
  env?: Env,
): Promise<ArrayBufferLike> {
  if (env && isWorkersEnv(env)) {
    return r2.downloadBinary(env.SY_DAILY_STORAGE, key);
  }

  const client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME!;
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
  const bytes = await response.Body!.transformToByteArray();
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

export async function objectExists(key: string, env?: Env): Promise<boolean> {
  if (env && isWorkersEnv(env)) {
    return r2.objectExists(env.SY_DAILY_STORAGE, key);
  }

  const client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME!;
  try {
    await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    if ((error as { name: string }).name === "NoSuchKey") {
      return false;
    }
    throw error;
  }
}

export async function deleteObject(key: string, env?: Env): Promise<void> {
  if (env && isWorkersEnv(env)) {
    return r2.deleteObject(env.SY_DAILY_STORAGE, key);
  }

  const client = getS3Client();
  const bucketName = process.env.S3_BUCKET_NAME!;
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}
