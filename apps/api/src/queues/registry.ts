import { z } from "zod";

/**
 * Queue Registry - Central definition of all queue names and message schemas.
 * Provides type-safe queue publishing with Zod validation.
 */

// Queue name constants
export const QUEUES = {
  JOBS: "QUEUE_JOBS",
  EMAILS: "QUEUE_EMAILS",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Message type constants organized by domain
export const MESSAGE_TYPES = {
  // Invoice Payment
  INVOICE_PAY: "invoice.pay",
  INVOICE_VEST_STOCK_OPTIONS: "invoice.vest-stock-options",

  // Consolidated Payment
  CONSOLIDATED_PAYMENT_PROCESS: "consolidated-payment.process",
  CONSOLIDATED_PAYMENT_CHARGE: "consolidated-payment.charge",
  CONSOLIDATED_PAYMENT_CREATE_PAYOUT: "consolidated-payment.create-payout",
  CONSOLIDATED_PAYMENT_PROCESS_INTENT: "consolidated-payment.process-payment-intent",
  CONSOLIDATED_PAYMENT_PROCESS_PAYOUT: "consolidated-payment.process-payout",

  // Equity Vesting
  EQUITY_PROCESS_SCHEDULED_VESTING: "equity.process-scheduled-vesting",
  EQUITY_PROCESS_GRANT_VESTING: "equity.process-grant-vesting",

  // Dividend Payments
  DIVIDENDS_PAY_ALL: "dividends.pay-all",
  DIVIDENDS_INVESTOR_PAYMENT: "dividends.investor-payment",
  DIVIDENDS_UPDATE_UPCOMING: "dividends.update-upcoming",
  DIVIDENDS_UPDATE_UPCOMING_VALUES: "dividends.update-upcoming-values",

  // QuickBooks
  QUICKBOOKS_EVENT: "quickbooks.event",
  QUICKBOOKS_DATA_SYNC: "quickbooks.data-sync",
  QUICKBOOKS_INTEGRATION_SYNC: "quickbooks.integration-sync",
  QUICKBOOKS_MONTHLY_FINANCIAL_REPORT_SYNC: "quickbooks.monthly-financial-report-sync",
  QUICKBOOKS_COMPANY_FINANCIAL_REPORT_SYNC: "quickbooks.company-financial-report-sync",

  // GitHub
  GITHUB_EVENT: "github.event",

  // Email
  EMAIL_COMPANY_ADMIN_DIGEST: "email.company-admin-digest",
  EMAIL_BLAST: "email.blast",
  EMAIL_EXPENSE_CARD_GRANT: "email.expense-card-grant",
  EMAIL_CONSOLIDATED_INVOICE_CSV: "email.consolidated-invoice-csv",
  EMAIL_DIVIDEND_PAYMENT_CSV: "email.dividend-payment-csv",
  EMAIL_COMPANY_UPDATE: "email.company-update",
  EMAIL_COMPANY_UPDATE_PUBLISHED: "email.company-update-published",
  EMAIL_COMPANY_ADMIN_TAX_FORM_REVIEW: "email.company-admin-tax-form-review",
  EMAIL_USER_TAX_FORM_REVIEW_REMINDER: "email.user-tax-form-review-reminder",
  EMAIL_COMPANY_WORKER_TAX_INFO_REMINDER: "email.company-worker-tax-info-reminder",
  EMAIL_COMPANY_ADMIN_TAX_DETAILS_REMINDER: "email.company-admin-tax-details-reminder",

  // Slack
  SLACK_SEND_MESSAGE: "slack.send-message",
  SLACK_WEEKLY_RECAP: "slack.weekly-recap",

  // Stripe
  STRIPE_BALANCE_TOP_UP: "stripe.balance-top-up",
  STRIPE_TRANSFER_TO_WISE: "stripe.transfer-to-wise",
  STRIPE_EVENT: "stripe.event",

  // Wise
  WISE_BALANCE_UPDATE: "wise.balance-update",
  WISE_BALANCE_CREDIT: "wise.balance-credit",
  WISE_TOP_UP_REMINDER: "wise.top-up-reminder",
  WISE_TRANSFER_STATE_CHANGE: "wise.transfer-state-change",

  // Tax Operations
  TAX_GENERATE_IRS_FORMS: "tax.generate-irs-forms",
  TAX_GENERATE_INFORMATION_DOCUMENT: "tax.generate-information-document",
  TAX_CHECK_TIN_VALIDITY: "tax.check-tin-validity",
  TAX_FORM_REVIEW: "tax.form-review",

  // Documents
  DOCUMENTS_CREATE_SHARE_CERTIFICATE: "documents.create-share-certificate",
  DOCUMENTS_GENERATE_CONTRACTOR_INVITATION: "documents.generate-contractor-invitation",
  DOCUMENTS_CREATE_CONSOLIDATED_INVOICE_RECEIPT: "documents.create-consolidated-invoice-receipt",

  // Equity Buybacks
  EQUITY_BUYBACKS_PAY_ALL: "equity-buybacks.pay-all",
  EQUITY_BUYBACKS_INVESTOR_PAYMENT: "equity-buybacks.investor-payment",

  // Cap Table
  CAP_TABLE_PROCESS_UPLOAD: "cap-table.process-upload",

  // Maintenance
  MAINTENANCE_DELETE_OLD_VERSIONS: "maintenance.delete-old-versions",
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

// Zod schemas for message payloads
export const messageSchemas = {
  // Invoice Payment
  [MESSAGE_TYPES.INVOICE_PAY]: z.object({ invoiceId: z.string() }),
  [MESSAGE_TYPES.INVOICE_VEST_STOCK_OPTIONS]: z.object({ invoiceId: z.string() }),

  // Consolidated Payment
  [MESSAGE_TYPES.CONSOLIDATED_PAYMENT_PROCESS]: z.object({ consolidatedPaymentId: z.string() }),
  [MESSAGE_TYPES.CONSOLIDATED_PAYMENT_CHARGE]: z.object({ consolidatedInvoiceId: z.string() }),
  [MESSAGE_TYPES.CONSOLIDATED_PAYMENT_CREATE_PAYOUT]: z.object({ consolidatedPaymentId: z.string() }),
  [MESSAGE_TYPES.CONSOLIDATED_PAYMENT_PROCESS_INTENT]: z.object({ consolidatedPaymentId: z.string() }),
  [MESSAGE_TYPES.CONSOLIDATED_PAYMENT_PROCESS_PAYOUT]: z.object({ consolidatedPaymentId: z.string() }),

  // Equity Vesting
  [MESSAGE_TYPES.EQUITY_PROCESS_SCHEDULED_VESTING]: z.object({}),
  [MESSAGE_TYPES.EQUITY_PROCESS_GRANT_VESTING]: z.object({ equityGrantId: z.string() }),

  // Dividend Payments
  [MESSAGE_TYPES.DIVIDENDS_PAY_ALL]: z.object({}),
  [MESSAGE_TYPES.DIVIDENDS_INVESTOR_PAYMENT]: z.object({ companyInvestorId: z.string() }),
  [MESSAGE_TYPES.DIVIDENDS_UPDATE_UPCOMING]: z.object({}),
  [MESSAGE_TYPES.DIVIDENDS_UPDATE_UPCOMING_VALUES]: z.object({ companyId: z.string() }),

  // QuickBooks
  [MESSAGE_TYPES.QUICKBOOKS_EVENT]: z.object({}).passthrough(),
  [MESSAGE_TYPES.QUICKBOOKS_DATA_SYNC]: z.object({
    companyId: z.string(),
    objectType: z.string(),
    objectId: z.string(),
  }),
  [MESSAGE_TYPES.QUICKBOOKS_INTEGRATION_SYNC]: z.object({ companyId: z.string() }),
  [MESSAGE_TYPES.QUICKBOOKS_MONTHLY_FINANCIAL_REPORT_SYNC]: z.object({}),
  [MESSAGE_TYPES.QUICKBOOKS_COMPANY_FINANCIAL_REPORT_SYNC]: z.object({ companyId: z.string() }),

  // GitHub
  [MESSAGE_TYPES.GITHUB_EVENT]: z.object({
    webhookId: z.string(),
    event: z.string(),
    action: z.string(),
    data: z.record(z.unknown()),
  }),

  // Email
  [MESSAGE_TYPES.EMAIL_COMPANY_ADMIN_DIGEST]: z.object({}),
  [MESSAGE_TYPES.EMAIL_BLAST]: z.object({}),
  [MESSAGE_TYPES.EMAIL_EXPENSE_CARD_GRANT]: z.object({ companyWorkerId: z.string() }),
  [MESSAGE_TYPES.EMAIL_CONSOLIDATED_INVOICE_CSV]: z.object({ recipients: z.array(z.string()) }),
  [MESSAGE_TYPES.EMAIL_DIVIDEND_PAYMENT_CSV]: z.object({ recipients: z.array(z.string()) }),
  [MESSAGE_TYPES.EMAIL_COMPANY_UPDATE]: z.object({ companyUpdateId: z.string(), userId: z.string() }),
  [MESSAGE_TYPES.EMAIL_COMPANY_UPDATE_PUBLISHED]: z.object({
    updateId: z.string(),
    recipients: z.array(z.object({ email: z.string() })).optional(),
  }),
  [MESSAGE_TYPES.EMAIL_COMPANY_ADMIN_TAX_FORM_REVIEW]: z.object({
    companyId: z.string(),
    taxYear: z.number(),
  }),
  [MESSAGE_TYPES.EMAIL_USER_TAX_FORM_REVIEW_REMINDER]: z.object({
    userComplianceInfoId: z.string(),
    companyId: z.string(),
    taxYear: z.number(),
  }),
  [MESSAGE_TYPES.EMAIL_COMPANY_WORKER_TAX_INFO_REMINDER]: z.object({ taxYear: z.number() }),
  [MESSAGE_TYPES.EMAIL_COMPANY_ADMIN_TAX_DETAILS_REMINDER]: z.object({}),

  // Slack
  [MESSAGE_TYPES.SLACK_SEND_MESSAGE]: z.object({
    channel: z.string(),
    sender: z.string(),
    text: z.string(),
    color: z.string().optional(),
    options: z.record(z.unknown()).optional(),
  }),
  [MESSAGE_TYPES.SLACK_WEEKLY_RECAP]: z.object({}),

  // Stripe
  [MESSAGE_TYPES.STRIPE_BALANCE_TOP_UP]: z.object({}),
  [MESSAGE_TYPES.STRIPE_TRANSFER_TO_WISE]: z.object({}),
  [MESSAGE_TYPES.STRIPE_EVENT]: z.object({
    eventType: z.string(),
    eventData: z.unknown(),
    eventId: z.string(),
  }),

  // Wise
  [MESSAGE_TYPES.WISE_BALANCE_UPDATE]: z.object({}),
  [MESSAGE_TYPES.WISE_BALANCE_CREDIT]: z.object({}).passthrough(),
  [MESSAGE_TYPES.WISE_TOP_UP_REMINDER]: z.object({}),
  [MESSAGE_TYPES.WISE_TRANSFER_STATE_CHANGE]: z.object({}).passthrough(),

  // Tax Operations
  [MESSAGE_TYPES.TAX_GENERATE_IRS_FORMS]: z.object({
    userComplianceInfoId: z.string(),
    taxYear: z.number().optional(),
  }),
  [MESSAGE_TYPES.TAX_GENERATE_INFORMATION_DOCUMENT]: z.object({
    userComplianceInfoId: z.string(),
    taxYear: z.number().optional(),
  }),
  [MESSAGE_TYPES.TAX_CHECK_TIN_VALIDITY]: z.object({}),
  [MESSAGE_TYPES.TAX_FORM_REVIEW]: z.object({
    taxYear: z.number().optional(),
    sendEmail: z.boolean().optional(),
  }),

  // Documents
  [MESSAGE_TYPES.DOCUMENTS_CREATE_SHARE_CERTIFICATE]: z.object({ shareHoldingId: z.string() }),
  [MESSAGE_TYPES.DOCUMENTS_GENERATE_CONTRACTOR_INVITATION]: z.object({
    companyWorkerId: z.string(),
    isExistingUser: z.boolean().optional(),
  }),
  [MESSAGE_TYPES.DOCUMENTS_CREATE_CONSOLIDATED_INVOICE_RECEIPT]: z.object({
    consolidatedPaymentId: z.string(),
    processedDate: z.string(),
  }),

  // Equity Buybacks
  [MESSAGE_TYPES.EQUITY_BUYBACKS_PAY_ALL]: z.object({}),
  [MESSAGE_TYPES.EQUITY_BUYBACKS_INVESTOR_PAYMENT]: z.object({ companyInvestorId: z.string() }),

  // Cap Table
  [MESSAGE_TYPES.CAP_TABLE_PROCESS_UPLOAD]: z.object({ uploadId: z.string() }),

  // Maintenance
  [MESSAGE_TYPES.MAINTENANCE_DELETE_OLD_VERSIONS]: z.object({}),
} as const;

// Type helper to infer payload type from message type
export type PayloadForType<T extends MessageType> = z.infer<(typeof messageSchemas)[T]>;

// Queue routing - determines which queue a message type is sent to
const EMAIL_TYPES: MessageType[] = [
  MESSAGE_TYPES.EMAIL_COMPANY_ADMIN_DIGEST,
  MESSAGE_TYPES.EMAIL_BLAST,
  MESSAGE_TYPES.EMAIL_EXPENSE_CARD_GRANT,
  MESSAGE_TYPES.EMAIL_CONSOLIDATED_INVOICE_CSV,
  MESSAGE_TYPES.EMAIL_DIVIDEND_PAYMENT_CSV,
  MESSAGE_TYPES.EMAIL_COMPANY_UPDATE,
  MESSAGE_TYPES.EMAIL_COMPANY_UPDATE_PUBLISHED,
  MESSAGE_TYPES.EMAIL_COMPANY_ADMIN_TAX_FORM_REVIEW,
  MESSAGE_TYPES.EMAIL_USER_TAX_FORM_REVIEW_REMINDER,
  MESSAGE_TYPES.EMAIL_COMPANY_WORKER_TAX_INFO_REMINDER,
  MESSAGE_TYPES.EMAIL_COMPANY_ADMIN_TAX_DETAILS_REMINDER,
];

/**
 * Get the queue binding name for a given message type.
 * Email messages go to the dedicated email queue, all others go to the jobs queue.
 */
export function getQueueForType(type: MessageType): QueueName {
  if (EMAIL_TYPES.includes(type)) {
    return QUEUES.EMAILS;
  }
  return QUEUES.JOBS;
}
