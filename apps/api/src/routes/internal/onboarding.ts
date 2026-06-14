import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "@/env";
import { authMiddleware } from "@/middleware/auth";

const onboardingRouter = new Hono<{ Bindings: Env }>();

onboardingRouter.use("*", authMiddleware);

const updateSchema = z.object({
  user: z.object({
    legal_name: z.string().min(1),
    preferred_name: z.string().min(1),
    country_code: z.string().min(1),
    citizenship_country_code: z.string().min(1),
  }),
});

const saveLegalSchema = z.object({
  user: z.object({
    street_address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().optional(),
    zip_code: z.string().min(1),
    business_entity: z.boolean().optional(),
    business_name: z.string().optional(),
    tax_id: z.string().optional(),
    birth_date: z.string().optional(),
    signature: z.string().optional(),
  }),
});

const saveBankAccountSchema = z.object({
  recipient: z.object({
    currency: z.string(),
    type: z.string(),
    details: z.record(z.unknown()),
  }),
  replace_recipient_id: z.string().optional(),
});

/** GET /internal/onboarding - Show personal details for onboarding */
onboardingRouter.get("/", async (c) => {
  // Returns onboarding personal details props
  // Business logic: checks user state and returns appropriate form data
  return c.json({ success: true, step: "personal_details" });
});

/** PUT /internal/onboarding - Update personal details */
onboardingRouter.put("/", zValidator("json", updateSchema), async (c) => {
  const { user } = c.req.valid("json");
  const allValuesPresent = Object.values(user).every((v) => v && (v as string).length > 0);
  if (!allValuesPresent) {
    return c.json({ success: false, error_message: "Please input all values" });
  }
  // Business logic: UpdateUser service call
  return c.json({ success: true });
});

/** GET /internal/onboarding/legal - Show legal details */
onboardingRouter.get("/legal", async (c) => {
  return c.json({ success: true, step: "legal_details" });
});

/** POST /internal/onboarding/save-legal - Save legal details */
onboardingRouter.post("/save-legal", zValidator("json", saveLegalSchema), async (c) => {
  const { user } = c.req.valid("json");
  const requiredFields = [user.street_address, user.city, user.zip_code];
  if (!requiredFields.every((v) => v && v.length > 0)) {
    return c.json({ success: false, error_message: "Please input all values" });
  }
  if (user.business_entity && !user.business_name) {
    return c.json({ success: false, error_message: "Please input all values" });
  }
  return c.json({ success: true });
});

/** GET /internal/onboarding/bank-account - Show bank account setup */
onboardingRouter.get("/bank-account", async (c) => {
  return c.json({ success: true, step: "bank_account" });
});

/** POST /internal/onboarding/save-bank-account - Save bank account */
onboardingRouter.post("/save-bank-account", zValidator("json", saveBankAccountSchema), async (c) => {
  const body = c.req.valid("json");
  // Business logic: Recipient::CreateService
  return c.json({ success: true, recipient: body.recipient });
});

export { onboardingRouter };
