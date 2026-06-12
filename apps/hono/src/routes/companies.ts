import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../lib/middleware";
import { externalId } from "../lib/ids";

const companies = new Hono<AppEnv>();
companies.use("*", requireAuth);

// GET /api/companies  -> companies the current user belongs to, with their roles
companies.get("/", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.external_id, c.name, c.public_name, c.share_price_usd, c.fully_diluted_shares,
            (SELECT 1 FROM company_administrators a WHERE a.company_id = c.id AND a.user_id = ?1) AS is_admin,
            (SELECT 1 FROM company_contractors    k WHERE k.company_id = c.id AND k.user_id = ?1) AS is_contractor,
            (SELECT 1 FROM company_investors      i WHERE i.company_id = c.id AND i.user_id = ?1) AS is_investor,
            (SELECT 1 FROM company_lawyers        l WHERE l.company_id = c.id AND l.user_id = ?1) AS is_lawyer
       FROM companies c
      WHERE c.id IN (
        SELECT company_id FROM company_administrators WHERE user_id = ?1
        UNION SELECT company_id FROM company_contractors WHERE user_id = ?1
        UNION SELECT company_id FROM company_investors   WHERE user_id = ?1
        UNION SELECT company_id FROM company_lawyers     WHERE user_id = ?1
      )
      ORDER BY c.name`,
  )
    .bind(user.id)
    .all();

  const data = (results as any[]).map((r) => ({
    id: r.external_id,
    name: r.name,
    publicName: r.public_name,
    sharePriceUsd: r.share_price_usd,
    fullyDilutedShares: r.fully_diluted_shares,
    roles: {
      administrator: !!r.is_admin,
      contractor: !!r.is_contractor,
      investor: !!r.is_investor,
      lawyer: !!r.is_lawyer,
    },
  }));
  return c.json({ companies: data });
});

// GET /api/companies/:externalId -> details + summary metrics
companies.get("/:externalId", async (c) => {
  const extId = c.req.param("externalId");
  const company = await c.env.DB.prepare(
    "SELECT * FROM companies WHERE external_id = ?",
  )
    .bind(extId)
    .first<any>();
  if (!company) return c.json({ error: "Company not found" }, 404);

  const counts = await c.env.DB.batch([
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM company_contractors WHERE company_id = ?").bind(company.id),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM company_investors WHERE company_id = ?").bind(company.id),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM invoices WHERE company_id = ?").bind(company.id),
    c.env.DB.prepare(
      "SELECT COALESCE(SUM(total_amount_cents),0) AS s FROM invoices WHERE company_id = ? AND status = 'paid'",
    ).bind(company.id),
  ]);

  return c.json({
    company: {
      id: company.external_id,
      name: company.name,
      publicName: company.public_name,
      email: company.email,
      taxId: company.tax_id,
      countryCode: company.country_code,
      sharePriceUsd: company.share_price_usd,
      fullyDilutedShares: company.fully_diluted_shares,
    },
    metrics: {
      contractors: (counts[0].results[0] as any).n,
      investors: (counts[1].results[0] as any).n,
      invoices: (counts[2].results[0] as any).n,
      totalPaidCents: (counts[3].results[0] as any).s,
    },
  });
});

// POST /api/companies  -> create a company; creator becomes administrator
companies.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ name?: string; email?: string; publicName?: string }>().catch(() => ({}));
  if (!body.name) return c.json({ error: "Company name is required" }, 400);

  const extId = externalId("cmp");
  const res = await c.env.DB.prepare(
    "INSERT INTO companies (external_id, name, email, public_name) VALUES (?, ?, ?, ?)",
  )
    .bind(extId, body.name, body.email ?? null, body.publicName ?? body.name)
    .run();
  const companyId = res.meta.last_row_id;

  await c.env.DB.prepare(
    "INSERT INTO company_administrators (external_id, user_id, company_id) VALUES (?, ?, ?)",
  )
    .bind(externalId("adm"), user.id, companyId)
    .run();

  return c.json({ company: { id: extId, name: body.name } }, 201);
});

export default companies;
