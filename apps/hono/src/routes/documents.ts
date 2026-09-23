import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../lib/middleware";
import { externalId } from "../lib/ids";

const documents = new Hono<AppEnv>();
documents.use("*", requireAuth);

// GET /api/documents?companyId=cmp_xxx
documents.get("/", async (c) => {
  const companyExt = c.req.query("companyId");
  if (!companyExt) return c.json({ error: "companyId is required" }, 400);
  const company = await c.env.DB.prepare("SELECT id FROM companies WHERE external_id = ?")
    .bind(companyExt)
    .first<{ id: number }>();
  if (!company) return c.json({ error: "Company not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT d.external_id, d.name, d.document_type, d.status, d.signed_at, u.legal_name AS signer_name
       FROM documents d LEFT JOIN users u ON u.id = d.user_id
      WHERE d.company_id = ? ORDER BY d.created_at DESC`,
  )
    .bind(company.id)
    .all();

  return c.json({
    documents: (results as any[]).map((d) => ({
      id: d.external_id,
      name: d.name,
      documentType: d.document_type,
      status: d.status,
      signedAt: d.signed_at,
      signerName: d.signer_name,
    })),
  });
});

// POST /api/documents -> create document
documents.post("/", async (c) => {
  const body = await c.req
    .json<{ companyId?: string; name?: string; documentType?: string; userId?: number }>()
    .catch(() => ({}));
  if (!body.companyId || !body.name) return c.json({ error: "companyId and name are required" }, 400);
  const company = await c.env.DB.prepare("SELECT id FROM companies WHERE external_id = ?")
    .bind(body.companyId)
    .first<{ id: number }>();
  if (!company) return c.json({ error: "Company not found" }, 404);

  const extId = externalId("doc");
  await c.env.DB.prepare(
    "INSERT INTO documents (external_id, company_id, user_id, name, document_type, status) VALUES (?, ?, ?, ?, ?, 'unsigned')",
  )
    .bind(extId, company.id, body.userId ?? null, body.name, body.documentType ?? "consulting_contract")
    .run();
  return c.json({ document: { id: extId, name: body.name } }, 201);
});

// POST /api/documents/:externalId/sign
documents.post("/:externalId/sign", async (c) => {
  const ext = c.req.param("externalId");
  const res = await c.env.DB.prepare(
    "UPDATE documents SET status = 'signed', signed_at = datetime('now') WHERE external_id = ?",
  )
    .bind(ext)
    .run();
  if (res.meta.changes === 0) return c.json({ error: "Document not found" }, 404);
  return c.json({ ok: true, status: "signed" });
});

export default documents;
