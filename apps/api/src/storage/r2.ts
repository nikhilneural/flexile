import type { Env } from "@/env";

export interface UploadOptions {
  key: string;
  body: ReadableStream | ArrayBuffer | string;
  contentType?: string;
  customMetadata?: Record<string, string>;
}

export interface GetSignedUrlOptions {
  key: string;
  expiresIn?: number; // seconds, default 7 days
  downloadFilename?: string;
}

/**
 * Uploads a file to the private R2 bucket.
 */
export const uploadToR2 = async (env: Env, options: UploadOptions): Promise<R2Object> => {
  const { key, body, contentType, customMetadata } = options;
  const object = await env.R2_PRIVATE.put(key, body, {
    httpMetadata: contentType ? { contentType } : undefined,
    customMetadata,
  });
  if (!object) throw new Error(`Failed to upload object: ${key}`);
  return object;
};

/**
 * Uploads a file to the public R2 bucket.
 */
export const uploadToR2Public = async (env: Env, options: UploadOptions): Promise<R2Object> => {
  const { key, body, contentType, customMetadata } = options;
  const object = await env.R2_PUBLIC.put(key, body, {
    httpMetadata: contentType ? { contentType } : undefined,
    customMetadata,
  });
  if (!object) throw new Error(`Failed to upload object: ${key}`);
  return object;
};

/**
 * Gets a file from the private R2 bucket.
 */
export const getFromR2 = async (env: Env, key: string): Promise<R2ObjectBody | null> => {
  return env.R2_PRIVATE.get(key);
};

/**
 * Generates a presigned URL for accessing a private R2 object.
 * Uses a signed URL approach with a time-limited token.
 */
export const getSignedUrl = async (env: Env, options: GetSignedUrlOptions): Promise<string> => {
  const { key, expiresIn = 86400 * 7, downloadFilename } = options;

  // R2 presigned URLs are not natively supported in the R2 binding API.
  // Instead, we create a signed URL that routes through our own API endpoint
  // which verifies the signature and streams the object.
  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  const payload = JSON.stringify({ key, exp: expiry, dl: downloadFilename });
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.CLERK_SECRET_KEY.slice(0, 32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  const params = new URLSearchParams({
    payload: btoa(payload),
    sig: signatureBase64,
  });

  return `/files/download?${params.toString()}`;
};

/**
 * Deletes an object from the private R2 bucket.
 */
export const deleteFromR2 = async (env: Env, key: string): Promise<void> => {
  await env.R2_PRIVATE.delete(key);
};

/**
 * Deletes an object from the public R2 bucket.
 */
export const deleteFromR2Public = async (env: Env, key: string): Promise<void> => {
  await env.R2_PUBLIC.delete(key);
};

/**
 * Lists objects in the private R2 bucket with a given prefix.
 */
export const listR2Objects = async (
  env: Env,
  prefix: string,
  options?: { limit?: number; cursor?: string },
): Promise<R2Objects> => {
  return env.R2_PRIVATE.list({
    prefix,
    limit: options?.limit,
    cursor: options?.cursor,
  });
};
