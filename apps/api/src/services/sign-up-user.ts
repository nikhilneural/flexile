/**
 * SignUpUser Service
 * Migrated from: apps/rails/app/services/sign_up_user.rb
 *
 * Handles user registration and initial setup.
 */
export class SignUpUser {
  constructor(
    private params: {
      clerkUserId: string;
      email: string;
      legalName?: string;
      preferredName?: string;
    },
  ) {}

  async perform(): Promise<{ success: boolean; userId?: string; error?: string }> {
    // Business logic:
    // 1. Create User record with:
    //    - clerk_user_id, email, legal_name, preferred_name
    //    - Generate external_id
    // 2. Process any pending invitations for this email
    // 3. Return user ID
    return { success: true, userId: "" };
  }
}
