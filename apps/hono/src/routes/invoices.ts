import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../lib/middleware";
import { externalId } from "../lib/ids";

const invoices = new Hono<AppEnv>();
invoices.use("*", requireAuth);

async function companyIdFromExternal(c: any, ext: string): Promise<number | null> {
  const row = await c.env.DB.prepare("SELECT id FROM companies WHERE external_id = ?").bind(ext).first<{ id: number }>();
  return row?.id ?? null;
}

// GET /api/invoices?companyId=cmp_xxx
invoices.get("/", async (c) => {
  const companyExt = c.req.query("companyId");
  if (!companyExt) return c.json({ error: "companyId is required" }, 400);
  const companyId = await companyIdFromExternal(c, companyExt);
  if (!companyId) return c.json({ error: "Company not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT i.external_id, i.invoice_number, i.status, i.invoice_date, i.total_amount_cents, i.description,
            u.legal_name AS contractor_name
       FROM invoices i JOIN users u ON u.id = i.user_id
      WHERE i.company_id = ? ORDER BY i.invoice_date DESC`,
  )
    .bind(companyId)
    .all();

  const data = (results as any[]).map((r) => ({
    id: r.external_id,
    invoiceNumber: r.invoice_number,
    status: r.status,
    invoiceDate: r.invoice_date,
    totalAmountCents: r.total_amount_cents,
    description: r.description,
    contractorName: r.contractor_name,
  }));
  return c.json({ invoices: data });
});

// GET /api/invoices/:externalId -> includes line items
invoices.get("/:externalId", async (c) => {
  const ext = c.req.param("externalId");
  const inv = await c.env.DB.prepare(
    `SELECT i.*, u.legal_name AS contractor_name FROM invoices i JOIN users u ON u.id = i.user_id WHERE i.external_id = ?`,
  )
    .bind(ext)
    .first<any>();
  if (!inv) return c.json({ error: "Invoice not found" }, 404);

  const { results } = await c.env.DB.prepare(
    "SELECT description, quantity, pay_rate_cents, total_amount_cents FROM invoice_line_items WHERE invoice_id = ?",
  )
    .bind(inv.id)
    .all();

  return c.json({
    invoice: {
      id: inv.external_id,
      invoiceNumber: inv.invoice_number,
      status: inv.status,
      invoiceDate: inv.invoice_date,
      totalAmountCents: inv.total_amount_cents,
      description: inv.description,
      contractorName: inv.contractor_name,
      lineItems: (results as any[]).map((l) => ({
        description: l.description,
        quantity: l.quantity,
        payRateCents: l.pay_rate_cents,
        totalAmountCents: l.total_amount_cents,
      })),
    },
  });
});

// POST /api/invoices -> create invoice with line items
invoices.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req
    .json<{
      companyId?: string;
      invoiceNumber?: string;
      invoiceDate?: string;
      description?: string;
      lineItems?: { description: string; quantity: number; payRateCents: number }[];
    }>()
    .catch(() => ({}) as any);

  if (!body.companyId || !body.invoiceNumber) {
    return c.json({ error: "companyId and invoiceNumber are required" }, 400);
  }
  const companyId = await companyIdFromExternal(c, body.companyId);
  if (!companyId) return c.json({ error: "Company not found" }, 404);

  const lineItems = body.lineItems ?? [];
  const total = lineItems.reduce((sum, li) => sum + Math.round(li.quantity * li.payRateCents), 0);
  const extId = externalId("inv");

  const res = await c.env.DB.prepare(
    `INSERT INTO invoices (external_id, company_id, user_id, invoice_number, status, invoice_date, total_amount_cents, description)
     VALUES (?, ?, ?, ?, 'received', ?, ?, ?)`,
  )
    .bind(extId, companyId, user.id, body.invoiceNumber, body.invoiceDate ?? new Date().toISOString().slice(0, 10), total, body.description ?? null)
    .run();
  const invoiceId = res.meta.last_row_id;

  for (const li of lineItems) {
    await c.env.DB.prepare(
      "INSERT INTO invoice_line_items (invoice_id, description, quantity, pay_rate_cents, total_amount_cents) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(invoiceId, li.description, li.quantity, li.payRateCents, Math.round(li.quantity * li.payRateCents))
      .run();
  }

  return c.json({ invoice: { id: extId, invoiceNumber: body.invoiceNumber, totalAmountCents: total } }, 201);
});

// PATCH /api/invoices/:externalId/status -> approve / reject / mark paid
invoices.patch("/:externalId/status", async (c) => {
  const ext = c.req.param("externalId");
  const body = await c.req.json<{ status?: string }>().catch(() => ({}));
  const valid = ["received", "approved", "processing", "paid", "rejected"];
  if (!body.status || !valid.includes(body.status)) {
    return c.json({ error: `status must be one of ${valid.join(", ")}` }, 400);
  }
  const res = await c.env.DB.prepare(
    "UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE external_id = ?",
  )
    .bind(body.status, ext)
    .run();
  if (res.meta.changes === 0) return c.json({ error: "Invoice not found" }, 404);
  return c.json({ ok: true, status: body.status });
});

export default invoices;
