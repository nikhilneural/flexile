import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";

const adminOnboardingRouter = new Hono<{ Bindings: Env }>();

/** GET /internal/companies/:companyId/administrator/onboarding/details - Company onboarding details */
adminOnboardingRouter.get("/details", async (c) => {
  return c.json({ company_onboarding_props: {} });
});

const updateSchema = z.object({
  company: z.object({
    name: z.string().min(1),
    street_address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zip_code: z.string().min(1),
  }),
  legal_name: z.string().min(1),
});

/** PUT /internal/companies/:companyId/administrator/onboarding - Update company details */
adminOnboardingRouter.put("/", zValidator("json", updateSchema), async (c) => {
  const body = c.req.valid("json");
  const allValuesPresent =
    Object.values(body.company).every((v) => v && (v as string).length > 0) && body.legal_name.length > 0;
  if (!allValuesPresent) {
    return c.json({ success: false, error_message: "Please input all values" });
  }
  // Business logic: create company if initial onboarding, then update
  return c.json({ success: true });
});

/** GET /internal/companies/:companyId/administrator/onboarding/bank-account - Bank account setup */
adminOnboardingRouter.get("/bank-account", async (c) => {
  // Business logic: fetch stripe setup intent
  return c.json({
    client_secret: null,
    setup_intent_status: null,
    stripe_public_key: null,
    name: null,
    email: null,
    unsigned_document_id: null,
  });
});

/** POST /internal/companies/:companyId/administrator/onboarding/added-bank-account */
adminOnboardingRouter.post("/added-bank-account", async (c) => {
  // Business logic: update bank account status to processing
  return c.json({ success: true });
});

export { adminOnboardingRouter };
