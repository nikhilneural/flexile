import type { Env } from "@/env";
import type { MessageBatch } from "@cloudflare/workers-types";
import type { QueueMessage } from "./types";
import { handlePayInvoice, handleVestStockOptions } from "./invoice-payment";
import {
  handleChargeConsolidatedInvoice,
  handleCreatePayout,
  handleProcessPaymentIntent,
  handleProcessPayout,
} from "./consolidated-payment";
import { handleProcessScheduledVesting, handleProcessEquityGrantVesting } from "./equity-vesting";
import {
  handlePayAllDividends,
  handleInvestorDividendsPayment,
  handleUpdateUpcomingDividends,
  handleUpdateUpcomingDividendValues,
} from "./dividend-payments";
import {
  handleQuickbooksEvent,
  handleQuickbooksDataSync,
  handleQuickbooksIntegrationSync,
  handleQuickbooksMonthlyFinancialReportSync,
  handleQuickbooksCompanyFinancialReportSync,
} from "./quickbooks-sync";
import { handleGithubEvent } from "./github-events";
import {
  handleCompanyAdministratorDigestEmail,
  handleEmailBlast,
  handleExpenseCardGrantEmail,
  handleConsolidatedInvoiceCsvEmail,
  handleDividendPaymentCsvEmail,
  handleCompanyUpdateEmail,
  handleCompanyUpdatePublished,
  handleCompanyAdministratorTaxFormReviewEmail,
  handleUserTaxFormReviewReminderEmail,
  handleCompanyWorkerTaxInfoReminderEmail,
  handleCompanyAdministratorTaxDetailsReminder,
} from "./emails";
import { handleSlackMessage, handleSlackWeeklyRecap } from "./slack";
import { handleStripeBalanceTopUp, handleTransferFromStripeToWise, handleStripeEvent } from "./stripe-operations";
import {
  handleWiseBalanceUpdate,
  handleWiseBalanceWebhook,
  handleWiseTopUpReminder,
  handleWiseTransferUpdate,
} from "./wise-operations";
import {
  handleGenerateIrsTaxForms,
  handleGenerateTaxInformationDocument,
  handleCheckTinValidity,
  handleTaxFormReview,
} from "./tax-operations";
import {
  handleCreateShareCertificatePdf,
  handleGenerateContractorInvitation,
  handleCreateConsolidatedInvoiceReceipt,
} from "./documents";
import { handlePayAllEquityBuybacks, handleInvestorEquityBuybacksPayment } from "./equity-buybacks";
import { handleProcessCapTableUpload } from "./cap-table";

/**
 * Main Queue Consumer - Routes messages to appropriate handlers.
 * This is the entry point for all Cloudflare Queue messages.
 *
 * Replaces:
 * - All 45+ Rails Sidekiq jobs
 * - All 6 Inngest functions
 */
export async function handleQueueBatch(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      await routeMessage(message.body, env);
      message.ack();
    } catch (err) {
      console.error(`[queue-consumer] Failed to process message type=${message.body.type}:`, err);
      message.retry();
    }
  }
}

async function routeMessage(msg: QueueMessage, env: Env): Promise<void> {
  console.info(`[queue-consumer] Routing message: ${msg.type}`);

  switch (msg.type) {
    // Invoice Payment
    case "invoice.pay":
      return handlePayInvoice(msg as any, env);
    case "invoice.vest-stock-options":
      return handleVestStockOptions(msg as any, env);

    // Consolidated Payment
    case "consolidated-payment.charge":
      return handleChargeConsolidatedInvoice(msg as any, env);
    case "consolidated-payment.create-payout":
      return handleCreatePayout(msg as any, env);
    case "consolidated-payment.process-payment-intent":
      return handleProcessPaymentIntent(msg as any, env);
    case "consolidated-payment.process-payout":
      return handleProcessPayout(msg as any, env);

    // Equity Vesting
    case "equity.process-scheduled-vesting":
      return handleProcessScheduledVesting(msg as any, env);
    case "equity.process-grant-vesting":
      return handleProcessEquityGrantVesting(msg as any, env);

    // Dividend Payments
    case "dividends.pay-all":
      return handlePayAllDividends(msg as any, env);
    case "dividends.investor-payment":
      return handleInvestorDividendsPayment(msg as any, env);
    case "dividends.update-upcoming":
      return handleUpdateUpcomingDividends(msg as any, env);
    case "dividends.update-upcoming-values":
      return handleUpdateUpcomingDividendValues(msg as any, env);

    // QuickBooks
    case "quickbooks.event":
      return handleQuickbooksEvent(msg as any, env);
    case "quickbooks.data-sync":
      return handleQuickbooksDataSync(msg as any, env);
    case "quickbooks.integration-sync":
      return handleQuickbooksIntegrationSync(msg as any, env);
    case "quickbooks.monthly-financial-report-sync":
      return handleQuickbooksMonthlyFinancialReportSync(msg as any, env);
    case "quickbooks.company-financial-report-sync":
      return handleQuickbooksCompanyFinancialReportSync(msg as any, env);

    // GitHub
    case "github.event":
      return handleGithubEvent(msg as any, env);

    // Emails
    case "email.company-admin-digest":
      return handleCompanyAdministratorDigestEmail(msg as any, env);
    case "email.blast":
      return handleEmailBlast(msg as any, env);
    case "email.expense-card-grant":
      return handleExpenseCardGrantEmail(msg as any, env);
    case "email.consolidated-invoice-csv":
      return handleConsolidatedInvoiceCsvEmail(msg as any, env);
    case "email.dividend-payment-csv":
      return handleDividendPaymentCsvEmail(msg as any, env);
    case "email.company-update":
      return handleCompanyUpdateEmail(msg as any, env);
    case "email.company-update-published":
      return handleCompanyUpdatePublished(msg as any, env);
    case "email.company-admin-tax-form-review":
      return handleCompanyAdministratorTaxFormReviewEmail(msg as any, env);
    case "email.user-tax-form-review-reminder":
      return handleUserTaxFormReviewReminderEmail(msg as any, env);
    case "email.company-worker-tax-info-reminder":
      return handleCompanyWorkerTaxInfoReminderEmail(msg as any, env);
    case "email.company-admin-tax-details-reminder":
      return handleCompanyAdministratorTaxDetailsReminder(msg as any, env);

    // Slack
    case "slack.send-message":
      return handleSlackMessage(msg as any, env);
    case "slack.weekly-recap":
      return handleSlackWeeklyRecap(msg as any, env);

    // Stripe Operations
    case "stripe.balance-top-up":
      return handleStripeBalanceTopUp(msg as any, env);
    case "stripe.transfer-to-wise":
      return handleTransferFromStripeToWise(msg as any, env);
    case "stripe.event":
    case "stripe.setup-intent.succeeded":
    case "stripe.setup-intent.canceled":
    case "stripe.setup-intent.failed":
    case "stripe.setup-intent.requires-action":
    case "stripe.charge.refunded":
    case "stripe.payment-intent":
    case "stripe.payout.paid":
    case "stripe.issuing-transaction.created":
    case "stripe.issuing-transaction.updated":
      return handleStripeEvent(msg as any, env);

    // Wise Operations
    case "wise.balance-update":
      return handleWiseBalanceUpdate(msg as any, env);
    case "wise.balance-credit":
      return handleWiseBalanceWebhook(msg as any, env);
    case "wise.top-up-reminder":
      return handleWiseTopUpReminder(msg as any, env);
    case "wise.transfer-state-change":
      return handleWiseTransferUpdate(msg as any, env);

    // Tax Operations
    case "tax.generate-irs-forms":
      return handleGenerateIrsTaxForms(msg as any, env);
    case "tax.generate-information-document":
      return handleGenerateTaxInformationDocument(msg as any, env);
    case "tax.check-tin-validity":
      return handleCheckTinValidity(msg as any, env);
    case "tax.form-review":
      return handleTaxFormReview(msg as any, env);

    // Documents
    case "documents.create-share-certificate":
      return handleCreateShareCertificatePdf(msg as any, env);
    case "documents.generate-contractor-invitation":
      return handleGenerateContractorInvitation(msg as any, env);
    case "documents.create-consolidated-invoice-receipt":
      return handleCreateConsolidatedInvoiceReceipt(msg as any, env);

    // Equity Buybacks
    case "equity-buybacks.pay-all":
      return handlePayAllEquityBuybacks(msg as any, env);
    case "equity-buybacks.investor-payment":
      return handleInvestorEquityBuybacksPayment(msg as any, env);

    // Cap Table
    case "cap-table.process-upload":
      return handleProcessCapTableUpload(msg as any, env);

    // Maintenance
    case "maintenance.delete-old-versions":
      // Business logic from DeleteOldVersionsRecordsJob:
      // Delete PaperTrail::Version records exceeding 10M rows
      console.info("[queue-consumer] Running old versions cleanup");
      break;

    default:
      console.warn(`[queue-consumer] Unknown message type: ${msg.type}`);
  }
}
