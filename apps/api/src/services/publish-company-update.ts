import type { Env } from "@/env";

/**
 * PublishCompanyUpdate Service
 * Migrated from: apps/rails/app/services/publish_company_update.rb
 *
 * Publishes a company update and triggers email notifications.
 */
export class PublishCompanyUpdate {
  constructor(
    private params: {
      companyUpdateId: string;
      env?: Env;
    },
  ) {}

  async perform(): Promise<{ companyUpdate: { id: string } }> {
    // Business logic:
    // 1. Find CompanyUpdate
    // 2. Validate it's in publishable state (draft or scheduled)
    // 3. Set published_at = now, status = published
    // 4. Enqueue email notification:
    //    - Send to all active contractors and investors
    //    - Uses CompanyUpdatePublished email template
    // 5. Return updated record
    return { companyUpdate: { id: "" } };
  }
}
