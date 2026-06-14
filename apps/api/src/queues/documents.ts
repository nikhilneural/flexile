import type { Env } from "@/env";
import type {
  CreateShareCertificatePdfMessage,
  GenerateContractorInvitationMessage,
  CreateConsolidatedInvoiceReceiptMessage,
} from "./types";

/**
 * Documents Queue Handler
 * Migrated from: create_share_certificate_pdf_job.rb,
 *   generate_contractor_invitation_job.rb,
 *   create_consolidated_invoice_receipt_job.rb
 *
 * Handles:
 * - PDF generation for share certificates
 * - Contractor invitation email/delivery
 * - Consolidated invoice receipt PDF generation and email
 */

export async function handleCreateShareCertificatePdf(
  message: CreateShareCertificatePdfMessage,
  env: Env,
): Promise<void> {
  const { shareHoldingId } = message.payload;
  console.info(`[documents] Creating share certificate PDF for: ${shareHoldingId}`);

  // Business logic from CreateShareCertificatePdfJob:
  // 1. Find ShareHolding with company_investor and company
  // 2. Get primary admin for the company
  // 3. Render HTML template "ssr/share_certificate" with:
  //    - share_holding, company, admin_name
  // 4. Convert to PDF using Puppeteer/Grover (landscape, print_background)
  // 5. Create Document record:
  //    - type: share_certificate
  //    - name: "{share_holding.name} Share Certificate"
  //    - year: current year
  // 6. Attach PDF to document as ActiveStorage blob
}

export async function handleGenerateContractorInvitation(
  message: GenerateContractorInvitationMessage,
  env: Env,
): Promise<void> {
  const { companyWorkerId, isExistingUser } = message.payload;
  console.info(`[documents] Generating contractor invitation for worker: ${companyWorkerId}`);

  // Business logic from GenerateContractorInvitationJob:
  // If isExistingUser:
  //   - Send CompanyWorkerMailer.invite_worker email
  // Else:
  //   - Deliver invitation to new user:
  //     subject: "You're invited to {company.name}'s team"
  //     reply_to: company.email
}

export async function handleCreateConsolidatedInvoiceReceipt(
  message: CreateConsolidatedInvoiceReceiptMessage,
  env: Env,
): Promise<void> {
  const { consolidatedPaymentId, processedDate } = message.payload;
  console.info(`[documents] Creating consolidated invoice receipt for payment: ${consolidatedPaymentId}`);

  // Business logic from CreateConsolidatedInvoiceReceiptJob:
  // 1. Find ConsolidatedPayment and its ConsolidatedInvoice
  // 2. Render HTML template "ssr/consolidated_invoice_receipt"
  // 3. Convert to PDF using CreatePdf service
  // 4. Attach PDF to consolidated_invoice.receipt
  //    filename: "Flexile-Invoice-{invoice_number}.pdf"
  // 5. For each company administrator:
  //    - Send CompanyMailer.consolidated_invoice_receipt email
  //      with user_id, consolidated_payment_id, processed_date
}
