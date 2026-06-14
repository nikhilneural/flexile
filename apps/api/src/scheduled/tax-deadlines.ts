import type { Env } from "@/env";
import { publish } from "@/queues/publisher";

/**
 * Annual tax form deadline processing - runs January 15th at 6:00 AM UTC.
 *
 * Triggers tax form review and TIN validity checks ahead of filing deadlines.
 * Replaces: TaxFormReviewJob, CheckTinValidityJob (Sidekiq cron)
 */
export async function handleAnnualTaxDeadlines(env: Env): Promise<void> {
  console.info("[scheduled:tax-deadlines] Running annual tax deadline processing");

  const currentYear = new Date().getFullYear();
  const taxYear = currentYear - 1; // Tax forms are for the previous year

  // Check TIN validity for all users
  await publish(env, "tax.check-tin-validity", {});

  // Trigger tax form review for the previous year
  await publish(env, "tax.form-review", { taxYear, sendEmail: true });

  // Send reminder to workers about tax info
  await publish(env, "email.company-worker-tax-info-reminder", { taxYear });

  // Send reminder to admins about tax details
  await publish(env, "email.company-admin-tax-details-reminder", {});

  console.info("[scheduled:tax-deadlines] Annual tax deadline tasks enqueued");
}
