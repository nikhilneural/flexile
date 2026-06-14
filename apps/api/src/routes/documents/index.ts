import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, inArray, isNotNull, isNull, not, type SQLWrapper } from "drizzle-orm";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, pagination } from "@/db";
import { activeStorageAttachments, activeStorageBlobs, documents, users } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";
import { simpleUser } from "../users/helpers";

const visibleDocuments = (companyId: bigint, userId: bigint | SQLWrapper | undefined) =>
  and(
    eq(documents.companyId, companyId),
    isNull(documents.deletedAt),
    userId ? eq(documents.userId, userId) : undefined,
  );

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/documents
app.get(
  "/:companyId/documents",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      userId: z.string().nullable().optional(),
      year: z.coerce.number().optional(),
      signable: z.coerce.boolean().optional(),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (input.userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
      return c.json({ error: "Forbidden" }, 403);

    const signable = assertDefined(and(isNull(documents.completedAt), isNotNull(documents.docusealSubmissionId)));
    const where = and(
      visibleDocuments(ctx.company.id, input.userId ? byExternalId(users, input.userId) : undefined),
      input.year ? eq(documents.year, input.year) : undefined,
      input.signable != null ? (input.signable ? signable : not(signable)) : undefined,
    );

    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const rows = await ctx.db.query.documents.findMany({
      with: { user: { columns: simpleUser.columns } },
      where,
      orderBy: [desc(documents.createdAt)],
      ...pagination(paginationInput),
    });
    const total = await ctx.db.$count(documents, where);

    const attachmentRows = await ctx.db.query.activeStorageAttachments.findMany({
      columns: { recordId: true },
      with: { blob: { columns: { key: true, filename: true } } },
      where: and(
        eq(activeStorageAttachments.recordType, "Document"),
        inArray(
          activeStorageAttachments.recordId,
          rows.map((document) => document.id),
        ),
      ),
    });

    const attachments = new Map(
      attachmentRows.map((attachment) => [
        attachment.recordId,
        `https://${c.env.S3_PRIVATE_BUCKET}.s3.amazonaws.com/${attachment.blob.key}`,
      ]),
    );

    return c.json({
      documents: rows.map((document) => ({
        ...pick(
          document,
          "id",
          "name",
          "createdAt",
          "completedAt",
          "docusealSubmissionId",
          "type",
          "contractorSignature",
          "administratorSignature",
        ),
        user: simpleUser(document.user),
        attachment: attachments.get(document.id),
      })),
      total,
    });
  },
);

// GET /api/companies/:companyId/documents/years
app.get(
  "/:companyId/documents/years",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ userId: z.string().nullable().optional() })),
  async (c) => {
    const ctx = c.get("company");
    const { userId } = c.req.valid("query");

    if (userId !== ctx.user.externalId && !ctx.companyAdministrator && !ctx.companyLawyer)
      return c.json({ error: "Forbidden" }, 403);

    const where = visibleDocuments(ctx.company.id, userId ? byExternalId(users, userId) : undefined);
    const rows = await ctx.db
      .selectDistinct(pick(documents, "year"))
      .from(documents)
      .where(where)
      .orderBy(desc(documents.year));

    return c.json(rows.map((row) => row.year));
  },
);

// POST /api/companies/:companyId/documents/:id/sign
app.post(
  "/:companyId/documents/:id/sign",
  authMiddleware,
  companyMiddleware,
  zValidator("json", z.object({ role: z.enum(["Company Representative", "Signer"]) })),
  async (c) => {
    const ctx = c.get("company");
    const id = c.req.param("id");
    const { role } = c.req.valid("json");

    if (role === "Company Representative" && !ctx.companyAdministrator && !ctx.companyLawyer)
      return c.json({ error: "Forbidden" }, 403);

    const document = await ctx.db.query.documents.findFirst({
      where: and(
        eq(documents.id, BigInt(id)),
        role === "Company Representative"
          ? and(eq(documents.companyId, ctx.company.id), isNull(documents.administratorSignature))
          : and(eq(documents.userId, ctx.user.id), isNull(documents.contractorSignature)),
      ),
    });
    if (!document) return c.json({ error: "Not Found" }, 404);

    await ctx.db
      .update(documents)
      .set({
        [role === "Company Representative" ? "administratorSignature" : "contractorSignature"]:
          ctx.user.legalName,
        completedAt: document.administratorSignature || document.contractorSignature ? new Date() : undefined,
      })
      .where(eq(documents.id, BigInt(id)));

    return c.json({ success: true });
  },
);

export { app as documentsRouter };
