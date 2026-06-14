import type { Env } from "@/env";

/**
 * ApproveAndPayOrChargeForInvoices Service
 * Migrated from: apps/rails/app/services/approve_and_pay_or_charge_for_invoices.rb
 *
 * Orchestrates the full invoice payment flow:
 * 1. Approves invoices
 * 2. Determines payment method (direct via Wise for trusted companies, Stripe charge otherwise)
 * 3. Creates consolidated invoices and triggers payment
 */
export class ApproveAndPayOrChargeForInvoices {
  constructor(
    private params: {
      userId: string;
      companyId: string;
      invoiceIds: string[];
      env: Env;
    },
  ) {}

  async perform(): Promise<void> {
    // Business logic:
    // 1. Find company and invoices
    // 2. Approve all invoices (update status, set approved_at, approver)
    // 3. Determine payment strategy:
    //    a. If company is_trusted: create ConsolidatedInvoice, then directly process via Wise
    //    b. Otherwise: create ConsolidatedInvoice, charge via Stripe ACH
    // 4. For Stripe path:
    //    - Call ConsolidatedInvoiceCreation to group invoices
    //    - Enqueue ChargeConsolidatedInvoiceMessage
    // 5. For direct path:
    //    - Call ConsolidatedInvoiceCreation
    //    - Enqueue individual PayInvoice messages for each invoice
    // 6. If invoice has equity component:
    //    - Enqueue VestStockOptionsMessage
  }
}
