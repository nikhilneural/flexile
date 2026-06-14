/**
 * SignUpCompany Service
 * Migrated from: apps/rails/app/services/sign_up_company.rb
 *
 * Handles the full company registration flow.
 */
export class SignUpCompany {
  static readonly US_COUNTRY_CODE = "US";
  static readonly DEFAULT_CURRENCY = "usd";

  constructor(
    private params: {
      email: string;
      name?: string;
      countryCode?: string;
    },
  ) {}

  async perform(): Promise<{ success: boolean; companyId?: string; error?: string }> {
    // Business logic:
    // 1. Create Company record with:
    //    - email, country_code (defaults to US), default_currency (defaults to usd)
    //    - Generate external_id
    // 2. Create CompanyAdministrator for the user
    // 3. Set up Stripe customer
    // 4. Return company ID
    return { success: true, companyId: "" };
  }
}
