/**
 * SearchService
 * Migrated from: apps/rails/app/services/search_service.rb
 *
 * Full-text search across company entities (invoices, contractors, updates, etc.)
 */
export class SearchService {
  constructor(
    private params: {
      companyId: string;
      query: string;
      recordsForSearch: string[];
    },
  ) {}

  search(): Array<{ type: string; id: string; title: string; url: string }> {
    // Business logic:
    // 1. Normalize query (lowercase, trim)
    // 2. Search across allowed record types:
    //    - Invoices: by number, worker name
    //    - CompanyWorkers: by name, email
    //    - CompanyUpdates: by title
    //    - Roles: by name
    // 3. Limit results per type
    // 4. Format and return results with type, id, title, and url
    return [];
  }
}
