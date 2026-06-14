import type { Env } from "@/env";
import type {
  GenerateIrsTaxFormsMessage,
  GenerateTaxInformationDocumentMessage,
  CheckTinValidityMessage,
  TaxFormReviewMessage,
} from "./types";

/**
 * Tax Operations Queue Handler
 * Migrated from: generate_irs_tax_forms_job.rb, generate_tax_information_document_job.rb,
 *   check_tin_validity_job.rb, tax_form_review_job.rb
 *
 * Handles:
 * - IRS tax form generation (1099-NEC, 1099-DIV, 1042-S)
 * - Tax information document generation (W-8BEN, W-9, etc.)
 * - TIN validation via IRS TINM API
 * - Annual tax form review orchestration
 */

export async function handleGenerateIrsTaxForms(message: GenerateIrsTaxFormsMessage, env: Env): Promise<void> {
  const { userComplianceInfoId, taxYear } = message.payload;
  const year = taxYear || new Date().getFullYear() - 1;
  console.info(`[tax-operations] Generating IRS tax forms for compliance info: ${userComplianceInfoId}, year: ${year}`);

  // Business logic from GenerateIrsTaxFormsJob:
  // 1. Find UserComplianceInfo and associated user
  // 2. For CompanyWorkers with required tax info:
  //    - Generate Form 1099-NEC using GenerateTaxFormService
  // 3. For CompanyInvestors with required tax info:
  //    - Determine form name (1099-DIV for US, 1042-S for foreign)
  //    - Generate using GenerateTaxFormService
  // 4. Skip if document already exists for that year/company/form
}

export async function handleGenerateTaxInformationDocument(
  message: GenerateTaxInformationDocumentMessage,
  env: Env,
): Promise<void> {
  const { userComplianceInfoId, taxYear } = message.payload;
  const year = taxYear || new Date().getFullYear();
  console.info(`[tax-operations] Generating tax information document: ${userComplianceInfoId}, year: ${year}`);

  // Business logic from GenerateTaxInformationDocumentJob:
  // 1. Find UserComplianceInfo
  // 2. Determine form name (tax_information_document_name - W-8BEN, W-9, etc.)
  // 3. For each company (clients + portfolio_companies):
  //    - Generate using GenerateTaxFormService
}

export async function handleCheckTinValidity(message: CheckTinValidityMessage, env: Env): Promise<void> {
  console.info("[tax-operations] Checking TIN validity via IRS TINM API");

  // Business logic from CheckTinValidityJob:
  // 1. Authenticate with IRS API using JWT:
  //    - Create JWT signed with RSA private key
  //    - Exchange for access token via OAuth2
  // 2. Find US users/citizens with company_investors, tax_id present, tax_id_status nil
  //    - Limited to 4,500 per run (API has 9,999/24hr limit)
  // 3. For each user:
  //    - Skip duplicate TINs and names (API penalizes duplicates)
  //    - Format name: remove apostrophes, replace special chars with spaces
  //    - Submit to TINM API with tin, name, tinType (EIN or SSN)
  //    - On responseCode 0 (success):
  //      - If previously sent invalid email: send success email
  //      - Set tax_id_status to VERIFIED
  //    - On failure:
  //      - Send failure email
  //      - Set tax_id_status to INVALID
  //    - On API error: stop processing to avoid getting blocked
}

export async function handleTaxFormReview(message: TaxFormReviewMessage, env: Env): Promise<void> {
  const { taxYear, sendEmail } = message.payload;
  const year = taxYear || new Date().getFullYear() - 1;
  const shouldSendEmail = sendEmail !== false;
  console.info(`[tax-operations] Running tax form review for year: ${year}`);

  // Business logic from TaxFormReviewJob:
  // 1. Collect eligible UserComplianceInfos for both workers and investors:
  //    - Must have required tax info for the tax year
  //    - Track unique compliance_info_ids, company_ids, and pairs
  // 2. Batch generate IRS tax forms (1000 per batch):
  //    - Enqueue GenerateIrsTaxFormsMessage for each
  // 3. If sendEmail:
  //    - Send CompanyAdministratorTaxFormReviewEmail for each company
  //    - Send UserTaxFormReviewReminderEmail for each user/company pair
}
