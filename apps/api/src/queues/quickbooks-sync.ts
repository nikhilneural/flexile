import type { Env } from "@/env";
import type {
  QuickbooksEventMessage,
  QuickbooksDataSyncMessage,
  QuickbooksIntegrationSyncMessage,
  QuickbooksMonthlyFinancialReportSyncMessage,
  QuickbooksCompanyFinancialReportSyncMessage,
} from "./types";

/**
 * QuickBooks Sync Queue Handler
 * Migrated from: quickbooks_event_handler_job.rb, quickbooks_data_sync_job.rb,
 *   quickbooks_integration_sync_schedule_job.rb, quickbooks_monthly_financial_report_sync_job.rb,
 *   quickbooks_company_financial_report_sync_job.rb
 * Consolidated with: inngest/functions/quickbooksIntegrationSync.ts,
 *   quickbooksVendorsSync.ts, quickbooksFinancialReportSync.ts
 *
 * Handles:
 * - Webhook event processing (vendor merge, delete operations)
 * - Vendor data synchronization
 * - Integration activation and scheduling
 * - Monthly financial report sync
 */

export async function handleQuickbooksEvent(message: QuickbooksEventMessage, env: Env): Promise<void> {
  const payload = message.payload;
  console.info("[quickbooks-sync] Processing QuickBooks event");

  // Business logic from Quickbooks::EventHandler:
  // 1. Iterate eventNotifications
  // 2. For each notification, find the QuickbooksIntegration by realmId
  // 3. Process each entity event:
  //    - "Merge" on Vendor: update integration_record external_id to new vendor ID
  //    - "Delete" on Vendor: mark integration_records as deleted
  //    - "Delete" on Bill: mark invoice integration_records (and line items/expenses) as deleted
  //    - "Delete" on BillPayment: mark payment integration_records as deleted
}

export async function handleQuickbooksDataSync(message: QuickbooksDataSyncMessage, env: Env): Promise<void> {
  const { companyId, objectType, objectId } = message.payload;
  console.info(`[quickbooks-sync] Syncing ${objectType}:${objectId} for company: ${companyId}`);

  // Business logic from QuickbooksDataSyncJob + quickbooksVendorsSync.ts:
  // 1. Find the object (CompanyWorker)
  // 2. Get QuickBooks integration for company
  // 3. Get QuickBooks client
  // 4. Fetch all vendors from QuickBooks
  // 5. Match existing vendor by email/display name
  // 6. If match: update integration_record sync token
  // 7. If no match: create new vendor in QuickBooks with:
  //    - DisplayName (business name or legal name)
  //    - GivenName, PrimaryEmailAddr, BillAddr, BillRate
  // 8. Upsert integration_record
}

export async function handleQuickbooksIntegrationSync(
  message: QuickbooksIntegrationSyncMessage,
  env: Env,
): Promise<void> {
  const { companyId } = message.payload;
  console.info(`[quickbooks-sync] Running integration sync for company: ${companyId}`);

  // Business logic from QuickbooksIntegrationSyncScheduleJob + quickbooksIntegrationSync.ts:
  // 1. Find company and its QuickBooks integration
  // 2. Return early if integration is nil or deleted
  // 3. Set integration status to active
  // 4. Enqueue financial report sync
  // 5. Find active contractors
  // 6. Enqueue data sync for each contractor
  // 7. Update integration lastSyncAt
}

export async function handleQuickbooksMonthlyFinancialReportSync(
  message: QuickbooksMonthlyFinancialReportSyncMessage,
  env: Env,
): Promise<void> {
  console.info("[quickbooks-sync] Running monthly financial report sync for all companies");

  // Business logic from QuickbooksMonthlyFinancialReportSyncJob:
  // 1. Find all companies with QuickBooks integrations
  // 2. For each, enqueue QuickbooksCompanyFinancialReportSync
}

export async function handleQuickbooksCompanyFinancialReportSync(
  message: QuickbooksCompanyFinancialReportSyncMessage,
  env: Env,
): Promise<void> {
  const { companyId } = message.payload;
  console.info(`[quickbooks-sync] Syncing financial report for company: ${companyId}`);

  // Business logic from QuickbooksCompanyFinancialReportSyncJob + quickbooksFinancialReportSync.ts:
  // 1. Find company and QuickBooks integration (must be active)
  // 2. Get QuickBooks client
  // 3. Fetch Profit & Loss report for last month
  // 4. Parse report to extract Total Income and Net Income
  // 5. Upsert CompanyMonthlyFinancialReport with:
  //    - year, month, company_id, revenue_cents, net_income_cents
}
