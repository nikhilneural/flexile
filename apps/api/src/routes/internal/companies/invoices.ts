import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const companyInvoicesRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/invoices/new - New invoice form props */
companyInvoicesRouter.get("/new", async (c) => {
  return c.json({ invoice: {}, form_props: {} });
});

/** POST /internal/companies/:companyId/invoices - Create an invoice */
companyInvoicesRouter.post("/", async (c) => {
  // Business logic: CreateOrUpdateInvoiceService
  return c.body(null, 201);
});

/** GET /internal/companies/:companyId/invoices/:id/edit - Edit invoice form */
companyInvoicesRouter.get("/:id/edit", async (c) => {
  const invoiceId = c.req.param("id");
  return c.json({ invoice: { id: invoiceId }, form_props: {} });
});

/** PUT /internal/companies/:companyId/invoices/:id - Update an invoice */
companyInvoicesRouter.put("/:id", async (c) => {
  // Business logic: CreateOrUpdateInvoiceService
  return c.body(null, 204);
});

/** GET /internal/companies/:companyId/invoices/microdeposit-verification-details */
companyInvoicesRouter.get("/microdeposit-verification-details", async (c) => {
  return c.json({ details: null });
});

/** GET /internal/companies/:companyId/invoices/export - Export invoices as CSV */
companyInvoicesRouter.get("/export", async (c) => {
  // Business logic: InvoiceCsv generation
  c.header("Content-Type", "text/csv");
  c.header("Content-Disposition", `attachment; filename=invoices-${new Date().toISOString().slice(0, 10)}.csv`);
  return c.body("");
});

const approveSchema = z.object({
  approve_ids: z.array(z.string()).optional(),
  pay_ids: z.array(z.string()).optional(),
});

/** POST /internal/companies/:companyId/invoices/approve - Approve/pay invoices */
companyInvoicesRouter.post("/approve", zValidator("json", approveSchema), async (c) => {
  const { approve_ids, pay_ids } = c.req.valid("json");
  // Business logic: ApproveManyInvoices + ApproveAndPayOrChargeForInvoices
  return c.body(null, 200);
});

const rejectSchema = z.object({
  ids: z.array(z.string()),
  reason: z.string().optional(),
});

/** POST /internal/companies/:companyId/invoices/reject - Reject invoices */
companyInvoicesRouter.post("/reject", zValidator("json", rejectSchema), async (c) => {
  const { ids, reason } = c.req.valid("json");
  // Business logic: RejectManyInvoices
  return c.body(null, 200);
});

export { companyInvoicesRouter };
