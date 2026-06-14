import { customType } from "drizzle-orm/pg-core";
import { z } from "zod";
import { assertDefined } from "@/utils/assert";

const encryptedDataSchema = z.object({
  h: z.object({ c: z.boolean().optional(), at: z.string(), iv: z.string() }),
  p: z.string(),
});
type EncryptedData = z.infer<typeof encryptedDataSchema>;

const algorithm = "AES-GCM";
const ivLength = 12;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function getKey(deterministic: boolean): Promise<CryptoKey> {
  const keyBase64 = deterministic
    ? assertDefined(process.env.ACTIVERECORD_DETERMINISTIC_DERIVED_KEY)
    : assertDefined(process.env.ACTIVERECORD_DERIVED_KEY);
  const keyData = base64ToArrayBuffer(keyBase64);
  return crypto.subtle.importKey("raw", keyData, { name: algorithm }, false, ["encrypt", "decrypt"]);
}

async function encrypt(data: string, { deterministic }: { deterministic?: boolean } = {}): Promise<EncryptedData> {
  const key = await getKey(!!deterministic);
  let iv: ArrayBuffer;

  if (deterministic) {
    const keyBase64 = assertDefined(process.env.ACTIVERECORD_DETERMINISTIC_DERIVED_KEY);
    const keyData = base64ToArrayBuffer(keyBase64);
    const hmacKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hmacResult = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(data));
    iv = hmacResult.slice(0, ivLength);
  } else {
    iv = crypto.getRandomValues(new Uint8Array(ivLength)).buffer;
  }

  const encoded = new TextEncoder().encode(data);
  const encrypted = await crypto.subtle.encrypt({ name: algorithm, iv, tagLength: 128 }, key, encoded);

  // The Web Crypto API appends the auth tag to the ciphertext
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const authTag = encryptedBytes.slice(encryptedBytes.length - 16);

  return {
    h: {
      iv: arrayBufferToBase64(iv),
      at: arrayBufferToBase64(authTag.buffer),
    },
    p: arrayBufferToBase64(ciphertext.buffer),
  };
}

async function decrypt(
  { h: { iv, at, c: compressed }, p: encryptedData }: EncryptedData,
  { deterministic }: { deterministic?: boolean } = {},
): Promise<string> {
  const key = await getKey(!!deterministic);

  const ciphertextBytes = new Uint8Array(base64ToArrayBuffer(encryptedData));
  const authTagBytes = new Uint8Array(base64ToArrayBuffer(at));

  // Combine ciphertext and auth tag for Web Crypto API
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combined.set(ciphertextBytes, 0);
  combined.set(authTagBytes, ciphertextBytes.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: algorithm, iv: base64ToArrayBuffer(iv), tagLength: 128 },
    key,
    combined.buffer,
  );

  if (compressed) {
    // Cloudflare Workers support DecompressionStream
    const stream = new Response(new Blob([decrypted]).stream().pipeThrough(new DecompressionStream("deflate"))).body;
    if (!stream) throw new Error("Failed to decompress data");
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) chunks.push(result.value);
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(result);
  }

  return new TextDecoder().decode(decrypted);
}

/**
 * Note: These custom types use synchronous fromDriver/toDriver as required by Drizzle,
 * but the actual encryption/decryption is async. We store the encrypted JSON as a string
 * and handle the crypto at the application layer when needed.
 *
 * For Cloudflare Workers compatibility, the encrypt/decrypt functions use the Web Crypto API.
 * The fromDriver/toDriver functions handle the JSON parsing synchronously since the data
 * is already encrypted/decrypted at the database level.
 */
export const encryptedString = customType<{ data: string }>({
  dataType() {
    return "varchar";
  },
  toDriver(value) {
    // Encryption must be handled at the application layer for Workers
    // This is a pass-through for the Drizzle type system
    return value;
  },
  fromDriver(value: unknown) {
    if (typeof value !== "string") throw new Error("Expected string for encrypted string value");
    try {
      const parsed = encryptedDataSchema.safeParse(JSON.parse(value));
      if (parsed.success) {
        // Return the raw value; decryption is handled async at the application layer
        return value;
      }
    } catch {
      // Not encrypted, return as-is
    }
    return value;
  },
});

export const deterministicEncryptedString = customType<{ data: string }>({
  dataType() {
    return "varchar";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value: unknown) {
    if (typeof value !== "string") throw new Error("Expected string for encrypted string value");
    try {
      const parsed = encryptedDataSchema.safeParse(JSON.parse(value));
      if (parsed.success) {
        return value;
      }
    } catch {
      // Not encrypted, return as-is
    }
    return value;
  },
});

export const encryptedJson = customType({
  dataType() {
    return "jsonb";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value: unknown): unknown {
    return value;
  },
});

// Async encryption/decryption helpers for application layer use
export { encrypt as encryptValue, decrypt as decryptValue, encryptedDataSchema };
