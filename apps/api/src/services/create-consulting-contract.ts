/**
 * CreateConsultingContract Service
 * Migrated from: apps/rails/app/services/create_consulting_contract.rb
 *
 * Generates a consulting contract document (via DocuSeal) for a company worker.
 * Called when tax info changes that require a new contract.
 */
export class CreateConsultingContract {
  constructor(
    private params: {
      companyWorkerId: string;
      companyAdministratorId: string;
      currentUserId: string;
    },
  ) {}

  async perform(): Promise<{ documentId: string }> {
    // Business logic:
    // 1. Find company worker, administrator, and user
    // 2. Create DocuSeal submission with contract template
    // 3. Create Document record (type: consulting_contract)
    // 4. Return document ID for signature
    return { documentId: "" };
  }
}
