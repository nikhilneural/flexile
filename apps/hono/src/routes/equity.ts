import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAuth } from "../lib/middleware";

const equity = new Hono<AppEnv>();
equity.use("*", requireAuth);

async function companyIdFromExternal(c: any, ext: string): Promise<number | null> {
  const row = await c.env.DB.prepare("SELECT id FROM companies WHERE external_id = ?").bind(ext).first<{ id: number }>();
  return row?.id ?? null;
}

// GET /api/equity/cap-table?companyId=cmp_xxx
equity.get("/cap-table", async (c) => {
  const companyExt = c.req.query("companyId");
  if (!companyExt) return c.json({ error: "companyId is required" }, 400);
  const companyId = await companyIdFromExternal(c, companyExt);
  if (!companyId) return c.json({ error: "Company not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT ci.external_id, u.legal_name AS investor_name, ci.investment_amount_usd, ci.total_shares
       FROM company_investors ci JOIN users u ON u.id = ci.user_id
      WHERE ci.company_id = ? ORDER BY ci.total_shares DESC`,
  )
    .bind(companyId)
    .all();

  const company = await c.env.DB.prepare("SELECT fully_diluted_shares, share_price_usd FROM companies WHERE id = ?")
    .bind(companyId)
    .first<{ fully_diluted_shares: number; share_price_usd: number }>();

  const fullyDiluted = company?.fully_diluted_shares || 1;
  return c.json({
    fullyDilutedShares: company?.fully_diluted_shares,
    sharePriceUsd: company?.share_price_usd,
    holders: (results as any[]).map((r) => ({
      id: r.external_id,
      investorName: r.investor_name,
      investmentAmountUsd: r.investment_amount_usd,
      totalShares: r.total_shares,
      ownershipPercent: Math.round((r.total_shares / fullyDiluted) * 10000) / 100,
    })),
  });
});

// GET /api/equity/grants?companyId=cmp_xxx
equity.get("/grants", async (c) => {
  const companyExt = c.req.query("companyId");
  if (!companyExt) return c.json({ error: "companyId is required" }, 400);
  const companyId = await companyIdFromExternal(c, companyExt);
  if (!companyId) return c.json({ error: "Company not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT g.external_id, g.name, g.number_of_shares, g.vested_shares, g.exercise_price_usd, g.issued_at,
            u.legal_name AS holder_name
       FROM equity_grants g
       JOIN company_investors ci ON ci.id = g.company_investor_id
       JOIN users u ON u.id = ci.user_id
      WHERE ci.company_id = ? ORDER BY g.issued_at DESC`,
  )
    .bind(companyId)
    .all();

  return c.json({
    grants: (results as any[]).map((g) => ({
      id: g.external_id,
      name: g.name,
      holderName: g.holder_name,
      numberOfShares: g.number_of_shares,
      vestedShares: g.vested_shares,
      exercisePriceUsd: g.exercise_price_usd,
      issuedAt: g.issued_at,
    })),
  });
});

// GET /api/equity/dividends?companyId=cmp_xxx
equity.get("/dividends", async (c) => {
  const companyExt = c.req.query("companyId");
  if (!companyExt) return c.json({ error: "companyId is required" }, 400);
  const companyId = await companyIdFromExternal(c, companyExt);
  if (!companyId) return c.json({ error: "Company not found" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT dr.external_id AS round_id, dr.issued_at, dr.total_amount_cents, dr.status AS round_status,
            d.external_id AS dividend_id, d.amount_cents, d.status AS dividend_status, u.legal_name AS investor_name
       FROM dividend_rounds dr
       LEFT JOIN dividends d ON d.dividend_round_id = dr.id
       LEFT JOIN company_investors ci ON ci.id = d.company_investor_id
       LEFT JOIN users u ON u.id = ci.user_id
      WHERE dr.company_id = ? ORDER BY dr.issued_at DESC`,
  )
    .bind(companyId)
    .all();

  return c.json({ dividends: results });
});

export default equity;
