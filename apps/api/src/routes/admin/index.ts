import { Hono } from "hono";
import type { Env } from "@/env";
import { authMiddleware } from "@/middleware/auth";

const adminRouter = new Hono<{ Bindings: Env }>();

// Admin authentication: requires team_member? access
adminRouter.use("*", authMiddleware);

// Administrate-style CRUD endpoints for admin dashboard
// These replace the Rails Administrate controllers

// Companies
adminRouter.get("/companies", async (c) => {
  return c.json({ companies: [], total: 0, page: 1 });
});
adminRouter.get("/companies/:id", async (c) => {
  return c.json({ company: {} });
});
adminRouter.put("/companies/:id", async (c) => {
  return c.json({ company: {} });
});

// Company Administrators
adminRouter.get("/company-administrators", async (c) => {
  return c.json({ company_administrators: [], total: 0, page: 1 });
});
adminRouter.get("/company-administrators/:id", async (c) => {
  return c.json({ company_administrator: {} });
});

// Company Workers
adminRouter.get("/company-workers", async (c) => {
  return c.json({ company_workers: [], total: 0, page: 1 });
});
adminRouter.get("/company-workers/:id", async (c) => {
  return c.json({ company_worker: {} });
});

// Company Roles
adminRouter.get("/company-roles", async (c) => {
  return c.json({ company_roles: [], total: 0, page: 1 });
});
adminRouter.get("/company-roles/:id", async (c) => {
  return c.json({ company_role: {} });
});

// Invoices
adminRouter.get("/invoices", async (c) => {
  return c.json({ invoices: [], total: 0, page: 1 });
});
adminRouter.get("/invoices/:id", async (c) => {
  return c.json({ invoice: {} });
});

// Consolidated Invoices
adminRouter.get("/consolidated-invoices", async (c) => {
  return c.json({ consolidated_invoices: [], total: 0, page: 1 });
});
adminRouter.get("/consolidated-invoices/:id", async (c) => {
  return c.json({ consolidated_invoice: {} });
});

// Consolidated Payments
adminRouter.get("/consolidated-payments", async (c) => {
  return c.json({ consolidated_payments: [], total: 0, page: 1 });
});
adminRouter.get("/consolidated-payments/:id", async (c) => {
  return c.json({ consolidated_payment: {} });
});

/** POST /admin/consolidated-payments/:id/refund - Refund a consolidated payment */
adminRouter.post("/consolidated-payments/:id/refund", async (c) => {
  // Business logic: Stripe::Refund.create + mark_as_refunded!
  return c.json({ success: true });
});

// Payments
adminRouter.get("/payments", async (c) => {
  return c.json({ payments: [], total: 0, page: 1 });
});
adminRouter.get("/payments/:id", async (c) => {
  return c.json({ payment: {} });
});

/** POST /admin/payments/:id/wise-paid - Simulate Wise payment (non-production) */
adminRouter.post("/payments/:id/wise-paid", async (c) => {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }
  return c.json({ success: true });
});

/** POST /admin/payments/:id/wise-charged-back - Simulate Wise chargeback (non-production) */
adminRouter.post("/payments/:id/wise-charged-back", async (c) => {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }
  return c.json({ success: true });
});

/** POST /admin/payments/:id/wise-funds-refunded - Simulate Wise refund (non-production) */
adminRouter.post("/payments/:id/wise-funds-refunded", async (c) => {
  if (c.env.ENVIRONMENT === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }
  return c.json({ success: true });
});

// Users
adminRouter.get("/users", async (c) => {
  return c.json({ users: [], total: 0, page: 1 });
});
adminRouter.get("/users/:id", async (c) => {
  return c.json({ user: {} });
});

// User Leads
adminRouter.get("/user-leads", async (c) => {
  return c.json({ user_leads: [], total: 0, page: 1 });
});
adminRouter.get("/user-leads/:id", async (c) => {
  return c.json({ user_lead: {} });
});

// Time Entries
adminRouter.get("/time-entries", async (c) => {
  return c.json({ time_entries: [], total: 0, page: 1 });
});
adminRouter.get("/time-entries/:id", async (c) => {
  return c.json({ time_entry: {} });
});

export { adminRouter };
