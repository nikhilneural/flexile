import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../lib/middleware";

const people = new Hono<AppEnv>();
people.use("*", requireAuth);

// GET /api/people?companyId=cmp_xxx -> contractors + investors + admins + lawyers
people.get("/", async (c) => {
  const companyExt = c.req.query("companyId");
  if (!companyExt) return c.json({ error: "companyId is required" }, 400);
  const company = await c.env.DB.prepare("SELECT id FROM companies WHERE external_id = ?")
    .bind(companyExt)
    .first<{ id: number }>();
  if (!company) return c.json({ error: "Company not found" }, 404);

  const contractors = await c.env.DB.prepare(
    `SELECT k.external_id, u.legal_name, u.email, k.role, k.pay_rate_usd, k.pay_rate_type, k.started_at, k.ended_at
       FROM company_contractors k JOIN users u ON u.id = k.user_id WHERE k.company_id = ?`,
  )
    .bind(company.id)
    .all();

  const investors = await c.env.DB.prepare(
    `SELECT i.external_id, u.legal_name, u.email, i.investment_amount_usd, i.total_shares
       FROM company_investors i JOIN users u ON u.id = i.user_id WHERE i.company_id = ?`,
  )
    .bind(company.id)
    .all();

  const admins = await c.env.DB.prepare(
    `SELECT a.external_id, u.legal_name, u.email
       FROM company_administrators a JOIN users u ON u.id = a.user_id WHERE a.company_id = ?`,
  )
    .bind(company.id)
    .all();

  const lawyers = await c.env.DB.prepare(
    `SELECT l.external_id, u.legal_name, u.email
       FROM company_lawyers l JOIN users u ON u.id = l.user_id WHERE l.company_id = ?`,
  )
    .bind(company.id)
    .all();

  return c.json({
    contractors: (contractors.results as any[]).map((r) => ({
      id: r.external_id,
      legalName: r.legal_name,
      email: r.email,
      role: r.role,
      payRateUsd: r.pay_rate_usd,
      payRateType: r.pay_rate_type,
      startedAt: r.started_at,
      endedAt: r.ended_at,
    })),
    investors: (investors.results as any[]).map((r) => ({
      id: r.external_id,
      legalName: r.legal_name,
      email: r.email,
      investmentAmountUsd: r.investment_amount_usd,
      totalShares: r.total_shares,
    })),
    administrators: (admins.results as any[]).map((r) => ({ id: r.external_id, legalName: r.legal_name, email: r.email })),
    lawyers: (lawyers.results as any[]).map((r) => ({ id: r.external_id, legalName: r.legal_name, email: r.email })),
  });
});

export default people;
