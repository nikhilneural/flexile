// Route path helpers - these previously pointed to Rails backend but now point to the Hono API

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const approve_company_invoices_path = (companyId: string) =>
  `${API_BASE}/api/companies/${companyId}/invoices/approve`;

export const reject_company_invoices_path = (companyId: string) =>
  `${API_BASE}/api/companies/${companyId}/invoices/reject`;

export const company_invoices_path = (companyId: string) =>
  `${API_BASE}/api/companies/${companyId}/invoices`;

export const company_invoice_path = (companyId: string, invoiceId: string) =>
  `${API_BASE}/api/companies/${companyId}/invoices/${invoiceId}`;

export const new_company_invoice_path = (companyId: string) =>
  `${API_BASE}/api/companies/${companyId}/invoices/new`;

export const edit_company_invoice_path = (companyId: string, invoiceId: string) =>
  `${API_BASE}/api/companies/${companyId}/invoices/${invoiceId}/edit`;

export const export_company_invoices_path = (companyId: string) =>
  `${API_BASE}/api/companies/${companyId}/invoices/export`;

export const company_equity_grant_exercises_path = (companyId: string) =>
  `${API_BASE}/api/companies/${companyId}/equity-grant-exercises`;

export const company_equity_exercise_payment_path = (companyId: string, exerciseId: string) =>
  `${API_BASE}/api/companies/${companyId}/equity-grant-exercises/${exerciseId}/payment`;

export const resend_company_equity_grant_exercise_path = (companyId: string, exerciseId: string) =>
  `${API_BASE}/api/companies/${companyId}/equity-grant-exercises/${exerciseId}/resend`;

export const settings_bank_account_path = (id: string) =>
  `${API_BASE}/api/settings/bank-accounts/${id}`;

export const settings_bank_accounts_path = () =>
  `${API_BASE}/api/settings/bank-accounts`;

export const settings_dividend_path = () =>
  `${API_BASE}/api/settings/dividend`;

export const settings_tax_path = () =>
  `${API_BASE}/api/settings/tax`;

export const save_bank_account_onboarding_path = () =>
  `${API_BASE}/api/onboarding/bank-account`;

export const save_legal_onboarding_path = () =>
  `${API_BASE}/api/onboarding/legal`;

export const wise_account_requirements_path = () =>
  `${API_BASE}/api/wise/account-requirements`;

export const onboarding_path = () => "/onboarding";

export const bank_account_onboarding_path = () => "/onboarding/bank_account";

export const legal_onboarding_path = () => "/onboarding/legal";

export const company_administrator_onboarding_path = (companyId: string) =>
  `/companies/${companyId}/administrator/onboarding`;

export const details_company_administrator_onboarding_path = (companyId: string) =>
  `/companies/${companyId}/administrator/onboarding/details`;

export const bank_account_company_administrator_onboarding_path = (companyId: string) =>
  `/companies/${companyId}/administrator/onboarding/bank_account`;

export const added_bank_account_company_administrator_onboarding_path = (companyId: string) =>
  `/companies/${companyId}/administrator/onboarding/bank_account?added=true`;
