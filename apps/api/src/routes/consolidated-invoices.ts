import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Env } from "@/env";
import { activeStorageAttachments, consolidatedInvoices, consolidatedInvoicesInvoices, invoices } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/consolidated-invoices/last
app.get("/:companyId/consolidated-invoices/last", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator && !ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);

  const invoice = await ctx.db.query.consolidatedInvoices.findFirst({
    columns: { createdAt: true },
    where: eq(consolidatedInvoices.companyId, ctx.company.id),
    orderBy: [desc(consolidatedInvoices.createdAt)],
  });

  return c.json({ invoice: invoice ?? null });
});

// GET /api/companies/:companyId/consolidated-invoices
app.get("/:companyId/consolidated-invoices", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

  const data = await ctx.db
    .select({
      id: consolidatedInvoices.id,
      invoiceDate: consolidatedInvoices.invoiceDate,
      totalCents: consolidatedInvoices.totalCents,
      status: consolidatedInvoices.status,
      totalContractors: sql<number>`count(distinct invoices.user_id)`,
    })
    .from(consolidatedInvoices)
    .leftJoin(
      consolidatedInvoicesInvoices,
      eq(consolidatedInvoices.id, consolidatedInvoicesInvoices.consolidatedInvoiceId),
    )
    .leftJoin(invoices, eq(consolidatedInvoicesInvoices.invoiceId, invoices.id))
    .where(eq(consolidatedInvoices.companyId, ctx.company.id))
    .groupBy(consolidatedInvoices.id)
    .orderBy(desc(consolidatedInvoices.invoiceDate));

  const receipts = await ctx.db.query.activeStorageAttachments.findMany({
    where: and(
      eq(activeStorageAttachments.recordType, "ConsolidatedInvoice"),
      inArray(
        activeStorageAttachments.recordId,
        data.map((invoice) => invoice.id),
      ),
      eq(activeStorageAttachments.name, "receipt"),
    ),
    with: { blob: true },
  });

  const results = data.map((invoice) => {
    const receipt = receipts.find(({ recordId }) => recordId === invoice.id);
    return {
      ...invoice,
      receiptUrl: receipt
        ? `https://${c.env.S3_PRIVATE_BUCKET}.s3.amazonaws.com/${receipt.blob.key}`
        : null,
    };
  });

  return c.json(results);
});

export { app as consolidatedInvoicesRouter };
