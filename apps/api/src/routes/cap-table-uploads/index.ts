import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { paginate } from "@/db";
import {
  activeStorageAttachments,
  activeStorageBlobs,
  capTableUploads,
  companies,
  companyInvestors,
  optionPools,
  shareClasses,
  users,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const COMPLETED_STATUSES = ["completed", "canceled"] as const;
const MAX_FILES_PER_CAP_TABLE_UPLOAD = 10;

const canCreateUpload = async (db: any, companyId: bigint, userId: bigint) => {
  const existingUpload = await db.query.capTableUploads.findFirst({
    where: and(
      eq(capTableUploads.userId, userId),
      eq(capTableUploads.companyId, companyId),
      notInArray(capTableUploads.status, [...COMPLETED_STATUSES]),
    ),
  });
  if (existingUpload) return false;

  const hasExistingRecords = await Promise.all([
    db.query.optionPools.findFirst({ where: eq(optionPools.companyId, companyId) }),
    db.query.shareClasses.findFirst({ where: eq(shareClasses.companyId, companyId) }),
    db.query.companyInvestors.findFirst({ where: eq(companyInvestors.companyId, companyId) }),
  ]);
  return !hasExistingRecords.some(Boolean);
};

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/cap-table-uploads/can-create
app.get("/:companyId/cap-table-uploads/can-create", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const result = await canCreateUpload(ctx.db, ctx.company.id, ctx.user.id);
  return c.json({ canCreate: result });
});

// POST /api/companies/:companyId/cap-table-uploads
app.post(
  "/:companyId/cap-table-uploads",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ attachmentKeys: z.array(z.string()).min(1).max(MAX_FILES_PER_CAP_TABLE_UPLOAD) })),
  async (c) => {
    const ctx = c.get("company");
    const { attachmentKeys } = c.req.valid("json");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const allowedToCreate = await canCreateUpload(ctx.db, ctx.company.id, ctx.user.id);
    if (!allowedToCreate) return c.json({ error: "Cannot create new cap table upload" }, 403);

    const upload = await ctx.db.transaction(async (tx) => {
      const blobs = await Promise.all(
        attachmentKeys.map(async (key) => {
          const blob = await tx.query.activeStorageBlobs.findFirst({
            where: eq(activeStorageBlobs.key, key),
          });
          if (!blob) throw new Error("File not found");
          return blob;
        }),
      );

      const [uploadRow] = await tx
        .insert(capTableUploads)
        .values({
          companyId: ctx.company.id,
          userId: ctx.user.id,
          uploadedAt: new Date(),
          status: "submitted",
        })
        .returning();
      if (!uploadRow) throw new Error("Failed to create upload");

      await Promise.all(
        blobs.map((blob) =>
          tx.insert(activeStorageAttachments).values({
            name: "files",
            blobId: blob.id,
            recordType: "CapTableUpload",
            recordId: uploadRow.id,
          }),
        ),
      );

      return uploadRow;
    });

    return c.json({ id: upload.id }, 201);
  },
);

// GET /api/companies/:companyId/cap-table-uploads
app.get(
  "/:companyId/cap-table-uploads",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      onlyCurrentUser: z.coerce.boolean().optional(),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    const baseQuery = ctx.db
      .select({
        id: capTableUploads.id,
        status: capTableUploads.status,
        uploadedAt: capTableUploads.uploadedAt,
        user: {
          id: users.id,
          email: users.email,
          preferredName: users.preferredName,
          legalName: users.legalName,
        },
        companyName: companies.name,
      })
      .from(capTableUploads)
      .innerJoin(users, eq(users.id, capTableUploads.userId))
      .innerJoin(companies, eq(companies.id, capTableUploads.companyId))
      .where(
        and(
          notInArray(capTableUploads.status, [...COMPLETED_STATUSES]),
          ...(input.onlyCurrentUser ? [eq(capTableUploads.userId, ctx.user.id)] : []),
        ),
      )
      .orderBy(desc(capTableUploads.createdAt));

    const total = await ctx.db.$count(baseQuery.as("capTableUploads"));
    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const uploads = await paginate(baseQuery, paginationInput);

    const attachmentRows = await ctx.db.query.activeStorageAttachments.findMany({
      where: and(
        eq(activeStorageAttachments.recordType, "CapTableUpload"),
        inArray(
          activeStorageAttachments.recordId,
          uploads.map((upload) => upload.id),
        ),
        eq(activeStorageAttachments.name, "files"),
      ),
      with: { blob: { columns: { key: true, filename: true } } },
    });

    const attachmentsByRecordId = new Map<bigint, { url: string; filename: string }[]>();
    for (const attachment of attachmentRows) {
      const url = `https://${c.env.S3_PRIVATE_BUCKET}.s3.amazonaws.com/${attachment.blob.key}`;
      const existing = attachmentsByRecordId.get(attachment.recordId) || [];
      attachmentsByRecordId.set(attachment.recordId, [...existing, { url, filename: attachment.blob.filename }]);
    }

    return c.json({
      uploads: uploads.map((upload) => ({
        ...upload,
        attachments: attachmentsByRecordId.get(upload.id) || [],
      })),
      total,
    });
  },
);

export { app as capTableUploadsRouter };
