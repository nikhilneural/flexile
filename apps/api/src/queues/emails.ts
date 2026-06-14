import type { Env } from "@/env";
import type {
  CompanyAdministratorDigestEmailMessage,
  EmailBlastMessage,
  ExpenseCardGrantEmailMessage,
  ConsolidatedInvoiceCsvEmailMessage,
  DividendPaymentCsvEmailMessage,
  CompanyUpdateEmailMessage,
  CompanyUpdatePublishedMessage,
  CompanyAdministratorTaxFormReviewEmailMessage,
  UserTaxFormReviewReminderEmailMessage,
  CompanyWorkerTaxInfoReminderEmailMessage,
  CompanyAdministratorTaxDetailsReminderMessage,
} from "./types";

/**
 * Email Queue Handler
 * Migrated from: company_administrator_digest_email_job.rb, email_blast_job.rb,
 *   expense_card_grant_email_job.rb, consolidated_invoice_csv_email_job.rb,
 *   dividend_payment_csv_email_job.rb, company_update_email_job.rb,
 *   company_administrator_tax_form_review_email_job.rb,
 *   user_tax_form_review_reminder_email_job.rb,
 *   company_worker_tax_info_reminder_email_job.rb,
 *   company_administrator_tax_details_reminder_job.rb
 * Consolidated with: inngest/functions/sendCompanyUpdateEmails.ts,
 *   inngest/functions/emails/CompanyUpdatePublished.tsx
 */

export async function handleCompanyAdministratorDigestEmail(
  message: CompanyAdministratorDigestEmailMessage,
  env: Env,
): Promise<void> {
  console.info("[emails] Sending company administrator digest emails");
  // Business logic from CompanyAdministratorDigestEmailService:
  // 1. Find all companies with pending invoices
  // 2. For each company admin, send a digest email with invoice counts/amounts
}

export async function handleEmailBlast(message: EmailBlastMessage, env: Env): Promise<void> {
  console.info("[emails] Sending email blast to all company administrators");
  // Business logic: only run in production
  // Send CompanyMailer.email_blast to all CompanyAdministrators
}

export async function handleExpenseCardGrantEmail(message: ExpenseCardGrantEmailMessage, env: Env): Promise<void> {
  const { companyWorkerId } = message.payload;
  console.info(`[emails] Sending expense card grant email for worker: ${companyWorkerId}`);
  // Business logic: send CompanyWorkerMailer.expense_card_grant
}

export async function handleConsolidatedInvoiceCsvEmail(
  message: ConsolidatedInvoiceCsvEmailMessage,
  env: Env,
): Promise<void> {
  const { recipients } = message.payload;
  console.info(`[emails] Sending consolidated invoice CSV to: ${recipients.join(", ")}`);
  // Business logic (production only):
  // 1. Find ConsolidatedInvoices created in the last month
  // 2. Generate CSV using ConsolidatedInvoiceCsv
  // 3. Send AdminMailer.custom with CSV attachment
}

export async function handleDividendPaymentCsvEmail(
  message: DividendPaymentCsvEmailMessage,
  env: Env,
): Promise<void> {
  const { recipients } = message.payload;
  console.info(`[emails] Sending dividend payment CSV to: ${recipients.join(", ")}`);
  // Business logic (production only):
  // 1. Find paid Dividends with successful DividendPayments in last month
  // 2. Generate CSV using DividendPaymentCsv
  // 3. Send AdminMailer.custom with CSV attachment
}

export async function handleCompanyUpdateEmail(message: CompanyUpdateEmailMessage, env: Env): Promise<void> {
  const { companyUpdateId, userId } = message.payload;
  console.info(`[emails] Sending company update email: update=${companyUpdateId} user=${userId}`);
  // Business logic: send CompanyUpdateMailer.update_published
}

export async function handleCompanyUpdatePublished(
  message: CompanyUpdatePublishedMessage,
  env: Env,
): Promise<void> {
  const { updateId, recipients: overrideRecipients } = message.payload;
  console.info(`[emails] Sending company update published emails: update=${updateId}`);

  // Business logic from sendCompanyUpdateEmails.ts (Inngest function):
  // 1. Fetch the company update, company, and primary admin (sender)
  // 2. Get recipients:
  //    - If overrideRecipients provided, use those
  //    - Otherwise: UNION of active contractors and investors for the company
  // 3. Get company logo URL
  // 4. Get financial reports if applicable
  // 5. Render CompanyUpdatePublished email template
  // 6. Batch send via Resend (BATCH_SIZE = 100)
}

export async function handleCompanyAdministratorTaxFormReviewEmail(
  message: CompanyAdministratorTaxFormReviewEmailMessage,
  env: Env,
): Promise<void> {
  const { companyId, taxYear } = message.payload;
  console.info(`[emails] Sending tax form review email for company: ${companyId}, year: ${taxYear}`);
  // Business logic: CompanyAdministratorTaxFormReviewEmailService
}

export async function handleUserTaxFormReviewReminderEmail(
  message: UserTaxFormReviewReminderEmailMessage,
  env: Env,
): Promise<void> {
  const { userComplianceInfoId, companyId, taxYear } = message.payload;
  console.info(`[emails] Sending tax form review reminder: user=${userComplianceInfoId} company=${companyId}`);
  // Business logic: UserMailer.tax_form_review_reminder
}

export async function handleCompanyWorkerTaxInfoReminderEmail(
  message: CompanyWorkerTaxInfoReminderEmailMessage,
  env: Env,
): Promise<void> {
  const { taxYear } = message.payload;
  console.info(`[emails] Sending company worker tax info reminder for year: ${taxYear}`);
  // Business logic: CompanyWorkerReminderEmailService.confirm_tax_info_reminder
}

export async function handleCompanyAdministratorTaxDetailsReminder(
  message: CompanyAdministratorTaxDetailsReminderMessage,
  env: Env,
): Promise<void> {
  console.info("[emails] Sending tax details reminder to company administrators");
  // Business logic from CompanyAdministratorTaxDetailsReminderJob:
  // Find admins where company has irs_tax_forms and missing tax_id or phone_number
  // Send CompanyMailer.complete_tax_info for onboarded companies
}
