/**
 * Message types for Cloudflare Queue routing.
 * Each type corresponds to a specific handler that processes the message.
 */

export interface QueueMessage {
  type: string;
  payload: Record<string, unknown>;
}

// Invoice Payment Messages
export interface PayInvoiceMessage extends QueueMessage {
  type: "invoice.pay";
  payload: { invoiceId: string };
}

export interface VestStockOptionsMessage extends QueueMessage {
  type: "invoice.vest-stock-options";
  payload: { invoiceId: string };
}

// Consolidated Payment Messages
export interface ProcessConsolidatedPaymentMessage extends QueueMessage {
  type: "consolidated-payment.process";
  payload: { consolidatedPaymentId: string };
}

export interface ChargeConsolidatedInvoiceMessage extends QueueMessage {
  type: "consolidated-payment.charge";
  payload: { consolidatedInvoiceId: string };
}

export interface CreatePayoutMessage extends QueueMessage {
  type: "consolidated-payment.create-payout";
  payload: { consolidatedPaymentId: string };
}

export interface ProcessPaymentIntentMessage extends QueueMessage {
  type: "consolidated-payment.process-payment-intent";
  payload: { consolidatedPaymentId: string };
}

export interface ProcessPayoutMessage extends QueueMessage {
  type: "consolidated-payment.process-payout";
  payload: { consolidatedPaymentId: string };
}

// Equity Vesting Messages
export interface ProcessScheduledVestingMessage extends QueueMessage {
  type: "equity.process-scheduled-vesting";
  payload: Record<string, never>;
}

export interface ProcessEquityGrantVestingMessage extends QueueMessage {
  type: "equity.process-grant-vesting";
  payload: { equityGrantId: string };
}

// Dividend Payment Messages
export interface PayAllDividendsMessage extends QueueMessage {
  type: "dividends.pay-all";
  payload: Record<string, never>;
}

export interface InvestorDividendsPaymentMessage extends QueueMessage {
  type: "dividends.investor-payment";
  payload: { companyInvestorId: string };
}

export interface UpdateUpcomingDividendsMessage extends QueueMessage {
  type: "dividends.update-upcoming";
  payload: Record<string, never>;
}

export interface UpdateUpcomingDividendValuesMessage extends QueueMessage {
  type: "dividends.update-upcoming-values";
  payload: { companyId: string };
}

// QuickBooks Messages
export interface QuickbooksEventMessage extends QueueMessage {
  type: "quickbooks.event";
  payload: Record<string, unknown>;
}

export interface QuickbooksDataSyncMessage extends QueueMessage {
  type: "quickbooks.data-sync";
  payload: { companyId: string; objectType: string; objectId: string };
}

export interface QuickbooksIntegrationSyncMessage extends QueueMessage {
  type: "quickbooks.integration-sync";
  payload: { companyId: string };
}

export interface QuickbooksMonthlyFinancialReportSyncMessage extends QueueMessage {
  type: "quickbooks.monthly-financial-report-sync";
  payload: Record<string, never>;
}

export interface QuickbooksCompanyFinancialReportSyncMessage extends QueueMessage {
  type: "quickbooks.company-financial-report-sync";
  payload: { companyId: string };
}

// GitHub Messages
export interface GithubEventMessage extends QueueMessage {
  type: "github.event";
  payload: { webhookId: string; event: string; action: string; data: Record<string, unknown> };
}

// Email Messages
export interface CompanyAdministratorDigestEmailMessage extends QueueMessage {
  type: "email.company-admin-digest";
  payload: Record<string, never>;
}

export interface EmailBlastMessage extends QueueMessage {
  type: "email.blast";
  payload: Record<string, never>;
}

export interface ExpenseCardGrantEmailMessage extends QueueMessage {
  type: "email.expense-card-grant";
  payload: { companyWorkerId: string };
}

export interface ConsolidatedInvoiceCsvEmailMessage extends QueueMessage {
  type: "email.consolidated-invoice-csv";
  payload: { recipients: string[] };
}

export interface DividendPaymentCsvEmailMessage extends QueueMessage {
  type: "email.dividend-payment-csv";
  payload: { recipients: string[] };
}

export interface CompanyUpdateEmailMessage extends QueueMessage {
  type: "email.company-update";
  payload: { companyUpdateId: string; userId: string };
}

export interface CompanyUpdatePublishedMessage extends QueueMessage {
  type: "email.company-update-published";
  payload: { updateId: string; recipients?: Array<{ email: string }> };
}

export interface CompanyAdministratorTaxFormReviewEmailMessage extends QueueMessage {
  type: "email.company-admin-tax-form-review";
  payload: { companyId: string; taxYear: number };
}

export interface UserTaxFormReviewReminderEmailMessage extends QueueMessage {
  type: "email.user-tax-form-review-reminder";
  payload: { userComplianceInfoId: string; companyId: string; taxYear: number };
}

export interface CompanyWorkerTaxInfoReminderEmailMessage extends QueueMessage {
  type: "email.company-worker-tax-info-reminder";
  payload: { taxYear: number };
}

export interface CompanyAdministratorTaxDetailsReminderMessage extends QueueMessage {
  type: "email.company-admin-tax-details-reminder";
  payload: Record<string, never>;
}

// Slack Messages
export interface SlackMessage extends QueueMessage {
  type: "slack.send-message";
  payload: { channel: string; sender: string; text: string; color?: string; options?: Record<string, unknown> };
}

export interface SlackWeeklyRecapMessage extends QueueMessage {
  type: "slack.weekly-recap";
  payload: Record<string, never>;
}

// Stripe Operations Messages
export interface StripeBalanceTopUpMessage extends QueueMessage {
  type: "stripe.balance-top-up";
  payload: Record<string, never>;
}

export interface TransferFromStripeToWiseMessage extends QueueMessage {
  type: "stripe.transfer-to-wise";
  payload: Record<string, never>;
}

export interface StripeEventMessage extends QueueMessage {
  type: "stripe.event";
  payload: { eventType: string; eventData: unknown; eventId: string };
}

// Wise Operations Messages
export interface WiseBalanceUpdateMessage extends QueueMessage {
  type: "wise.balance-update";
  payload: Record<string, never>;
}

export interface WiseBalanceWebhookMessage extends QueueMessage {
  type: "wise.balance-credit";
  payload: Record<string, unknown>;
}

export interface WiseTopUpReminderMessage extends QueueMessage {
  type: "wise.top-up-reminder";
  payload: Record<string, never>;
}

export interface WiseTransferUpdateMessage extends QueueMessage {
  type: "wise.transfer-state-change";
  payload: Record<string, unknown>;
}

// Tax Operations Messages
export interface GenerateIrsTaxFormsMessage extends QueueMessage {
  type: "tax.generate-irs-forms";
  payload: { userComplianceInfoId: string; taxYear?: number };
}

export interface GenerateTaxInformationDocumentMessage extends QueueMessage {
  type: "tax.generate-information-document";
  payload: { userComplianceInfoId: string; taxYear?: number };
}

export interface CheckTinValidityMessage extends QueueMessage {
  type: "tax.check-tin-validity";
  payload: Record<string, never>;
}

export interface TaxFormReviewMessage extends QueueMessage {
  type: "tax.form-review";
  payload: { taxYear?: number; sendEmail?: boolean };
}

// Document Messages
export interface CreateShareCertificatePdfMessage extends QueueMessage {
  type: "documents.create-share-certificate";
  payload: { shareHoldingId: string };
}

export interface GenerateContractorInvitationMessage extends QueueMessage {
  type: "documents.generate-contractor-invitation";
  payload: { companyWorkerId: string; isExistingUser?: boolean };
}

export interface CreateConsolidatedInvoiceReceiptMessage extends QueueMessage {
  type: "documents.create-consolidated-invoice-receipt";
  payload: { consolidatedPaymentId: string; processedDate: string };
}

// Equity Buyback Messages
export interface PayAllEquityBuybacksMessage extends QueueMessage {
  type: "equity-buybacks.pay-all";
  payload: Record<string, never>;
}

export interface InvestorEquityBuybacksPaymentMessage extends QueueMessage {
  type: "equity-buybacks.investor-payment";
  payload: { companyInvestorId: string };
}

// Cap Table Messages
export interface ProcessCapTableUploadMessage extends QueueMessage {
  type: "cap-table.process-upload";
  payload: { uploadId: string };
}

// Maintenance Messages
export interface DeleteOldVersionsRecordsMessage extends QueueMessage {
  type: "maintenance.delete-old-versions";
  payload: Record<string, never>;
}

// Union type of all messages
export type JobQueueMessage =
  | PayInvoiceMessage
  | VestStockOptionsMessage
  | ProcessConsolidatedPaymentMessage
  | ChargeConsolidatedInvoiceMessage
  | CreatePayoutMessage
  | ProcessPaymentIntentMessage
  | ProcessPayoutMessage
  | ProcessScheduledVestingMessage
  | ProcessEquityGrantVestingMessage
  | PayAllDividendsMessage
  | InvestorDividendsPaymentMessage
  | UpdateUpcomingDividendsMessage
  | UpdateUpcomingDividendValuesMessage
  | QuickbooksEventMessage
  | QuickbooksDataSyncMessage
  | QuickbooksIntegrationSyncMessage
  | QuickbooksMonthlyFinancialReportSyncMessage
  | QuickbooksCompanyFinancialReportSyncMessage
  | GithubEventMessage
  | CompanyAdministratorDigestEmailMessage
  | EmailBlastMessage
  | ExpenseCardGrantEmailMessage
  | ConsolidatedInvoiceCsvEmailMessage
  | DividendPaymentCsvEmailMessage
  | CompanyUpdateEmailMessage
  | CompanyUpdatePublishedMessage
  | CompanyAdministratorTaxFormReviewEmailMessage
  | UserTaxFormReviewReminderEmailMessage
  | CompanyWorkerTaxInfoReminderEmailMessage
  | CompanyAdministratorTaxDetailsReminderMessage
  | SlackMessage
  | SlackWeeklyRecapMessage
  | StripeBalanceTopUpMessage
  | TransferFromStripeToWiseMessage
  | StripeEventMessage
  | WiseBalanceUpdateMessage
  | WiseBalanceWebhookMessage
  | WiseTopUpReminderMessage
  | WiseTransferUpdateMessage
  | GenerateIrsTaxFormsMessage
  | GenerateTaxInformationDocumentMessage
  | CheckTinValidityMessage
  | TaxFormReviewMessage
  | CreateShareCertificatePdfMessage
  | GenerateContractorInvitationMessage
  | CreateConsolidatedInvoiceReceiptMessage
  | PayAllEquityBuybacksMessage
  | InvestorEquityBuybacksPaymentMessage
  | ProcessCapTableUploadMessage
  | DeleteOldVersionsRecordsMessage;
