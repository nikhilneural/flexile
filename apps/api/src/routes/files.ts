import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";
import { createDb } from "@/db";
import { activeStorageBlobs } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { assertDefined } from "@/utils/assert";

const app = new Hono<{ Bindings: Env }>();

// POST /api/files/direct-upload
app.post(
  "/direct-upload",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      isPublic: z.boolean(),
      filename: z.string(),
      byteSize: z.number(),
      checksum: z.string(),
      contentType: z.string(),
    }),
  ),
  async (c) => {
    const { isPublic, filename, byteSize, checksum, contentType } = c.req.valid("json");
    const db = createDb(c.env);

    const key = globalThis.crypto.randomUUID();

    // Keeping upload logic Rails-compatible while we migrate
    await db.insert(activeStorageBlobs).values({
      key,
      filename,
      contentType,
      metadata: null,
      serviceName: isPublic ? "amazon_public" : "amazon",
      byteSize: BigInt(byteSize),
      checksum,
    });

    // Generate R2 presigned URL for upload
    const bucket = isPublic ? c.env.R2_PUBLIC : c.env.R2_PRIVATE;

    // Use R2 to generate a presigned upload URL
    // In practice, we'd use the R2 binding to create the URL
    // For now, return the key and let the client upload directly
    const directUploadUrl = `https://${isPublic ? "public" : "private"}.r2.dev/${key}`;

    return c.json({ directUploadUrl, key });
  },
);

export { app as filesRouter };
