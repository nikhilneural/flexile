"use client";
import {
  type QueryKey,
  type UseQueryOptions,
  type UseMutationOptions,
  useQuery,
  useMutation,
  useSuspenseQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/src/lib/api-client";

// Generic query hook factory
export function useApiQuery<T>(
  queryKey: QueryKey,
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error>({
    queryKey,
    queryFn: ({ signal }) => apiClient.get<T>(path, params, signal),
    ...options,
  });
}

export function useApiSuspenseQuery<T>(
  queryKey: QueryKey,
  path: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  return useSuspenseQuery<T, Error>({
    queryKey,
    queryFn: ({ signal }) => apiClient.get<T>(path, params, signal),
  });
}

export function useApiMutation<TData = unknown, TVariables = unknown>(
  method: "post" | "put" | "patch" | "delete",
  path: string | ((variables: TVariables) => string),
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">,
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) => {
      const resolvedPath = typeof path === "function" ? path(variables) : path;
      return apiClient[method]<TData>(resolvedPath, variables);
    },
    ...options,
  });
}

// Invalidation helper
export function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: QueryKey[]) => {
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

// Domain-specific hooks

// Users
export function useCurrentUserData(enabled: boolean) {
  return useApiQuery(["currentUser"], "/api/users/me", undefined, { enabled });
}

// Invoices
export function useInvoices(params: {
  companyId: string;
  contractorId?: string;
  perPage?: number;
  page?: number;
  invoiceFilter?: string;
}) {
  return useApiSuspenseQuery(["invoices", params], "/api/invoices", params);
}

export function useInvoice(id: string) {
  return useApiSuspenseQuery(["invoices", id], `/api/invoices/${id}`);
}

export function useCreateInvoice() {
  return useApiMutation("post", "/api/invoices");
}

export function useUpdateInvoice(id: string) {
  return useApiMutation("put", `/api/invoices/${id}`);
}

export function useApproveInvoices() {
  return useApiMutation("post", "/api/invoices/approve");
}

export function useRejectInvoice() {
  return useApiMutation("post", "/api/invoices/reject");
}

// Contractors / People
export function useContractors(params: { companyId: string; type?: string; perPage?: number; page?: number }) {
  return useApiSuspenseQuery(["contractors", params], "/api/contractors", params);
}

export function useContractor(id: string, companyId: string) {
  return useApiSuspenseQuery(["contractors", id], `/api/contractors/${id}`, { companyId });
}

export function useCreateContractor() {
  return useApiMutation("post", "/api/contractors");
}

export function useUpdateContractor(id: string) {
  return useApiMutation("put", `/api/contractors/${id}`);
}

// Equity Grants
export function useEquityGrants(params: { companyId: string; perPage?: number; page?: number }) {
  return useApiSuspenseQuery(["equityGrants", params], "/api/equity-grants", params);
}

export function useEquityGrantTotals(params: { companyId: string }) {
  return useApiSuspenseQuery(["equityGrants", "totals", params], "/api/equity-grants/totals", params);
}

export function useEquityGrantsByCountry(params: { companyId: string }) {
  return useApiSuspenseQuery(["equityGrants", "byCountry", params], "/api/equity-grants/by-country", params);
}

export function useCreateEquityGrant() {
  return useApiMutation("post", "/api/equity-grants");
}

export function useUpdateEquityGrant(id: string) {
  return useApiMutation("put", `/api/equity-grants/${id}`);
}

// Equity Calculations
export function useEquityCalculations(params: { companyId: string; servicesInCents: number; invoiceYear: number }) {
  return useApiSuspenseQuery(["equityCalculations", params], "/api/equity-calculations", params);
}

// Equity Allocations
export function useEquityAllocationForYear(params: { companyId: string; year: number }) {
  return useApiSuspenseQuery(["equityAllocations", "forYear", params], "/api/equity-allocations/for-year", params);
}

export function useUpdateEquityAllocation() {
  return useApiMutation("put", "/api/equity-allocations");
}

// Share Holdings
export function useShareHoldings(params: { companyId: string }) {
  return useApiSuspenseQuery(["shareHoldings", params], "/api/share-holdings", params);
}

// Dividends
export function useDividends(params: { companyId: string }) {
  return useApiSuspenseQuery(["dividends", params], "/api/dividends", params);
}

// Dividend Rounds
export function useDividendRounds(params: { companyId: string }) {
  return useApiSuspenseQuery(["dividendRounds", params], "/api/dividend-rounds", params);
}

export function useDividendRound(id: string, companyId: string) {
  return useApiSuspenseQuery(["dividendRounds", id], `/api/dividend-rounds/${id}`, { companyId });
}

export function useCreateDividendRound() {
  return useApiMutation("post", "/api/dividend-rounds");
}

// Cap Table
export function useCapTable(params: { companyId: string }) {
  return useApiSuspenseQuery(["capTable", params], "/api/cap-table", params);
}

// Convertible Securities
export function useConvertibleSecurities(params: { companyId: string }) {
  return useApiSuspenseQuery(["convertibleSecurities", params], "/api/convertible-securities", params);
}

// Financing Rounds
export function useFinancingRounds(params: { companyId: string }) {
  return useApiSuspenseQuery(["financingRounds", params], "/api/financing-rounds", params);
}

export function useCreateFinancingRound() {
  return useApiMutation("post", "/api/financing-rounds");
}

// Option Pools
export function useOptionPools(params: { companyId: string }) {
  return useApiSuspenseQuery(["optionPools", params], "/api/option-pools", params);
}

export function useCreateOptionPool() {
  return useApiMutation("post", "/api/option-pools");
}

// Tender Offers
export function useTenderOffers(params: { companyId: string }) {
  return useApiSuspenseQuery(["tenderOffers", params], "/api/tender-offers", params);
}

export function useTenderOffer(id: string, companyId: string) {
  return useApiSuspenseQuery(["tenderOffers", id], `/api/tender-offers/${id}`, { companyId });
}

export function useCreateTenderOffer() {
  return useApiMutation("post", "/api/tender-offers");
}

// Documents
export function useDocuments(params: { companyId: string; userId?: string; signable?: boolean }) {
  return useApiSuspenseQuery(["documents", params], "/api/documents", params);
}

export function useCreateDocument() {
  return useApiMutation("post", "/api/documents");
}

// Document Templates
export function useDocumentTemplates(params: { companyId: string }) {
  return useApiSuspenseQuery(["documentTemplates", params], "/api/document-templates", params);
}

export function useDocumentTemplate(id: string, companyId: string) {
  return useApiSuspenseQuery(["documentTemplates", id], `/api/document-templates/${id}`, { companyId });
}

// Roles
export function useRoles(params: { companyId: string }) {
  return useApiSuspenseQuery(["roles", params], "/api/roles", params);
}

export function useRole(slug: string, companyId: string) {
  return useApiSuspenseQuery(["roles", slug], `/api/roles/${slug}`, { companyId });
}

export function useCreateRole() {
  return useApiMutation("post", "/api/roles");
}

export function useUpdateRole(id: string) {
  return useApiMutation("put", `/api/roles/${id}`);
}

// Role Applications
export function useRoleApplications(params: { companyId: string; roleSlug?: string }) {
  return useApiSuspenseQuery(["roleApplications", params], "/api/role-applications", params);
}

export function useRoleApplication(id: string, companyId: string) {
  return useApiSuspenseQuery(["roleApplications", id], `/api/role-applications/${id}`, { companyId });
}

export function useCreateRoleApplication() {
  return useApiMutation("post", "/api/role-applications");
}

// Company Updates
export function useCompanyUpdates(params: { companyId: string; perPage?: number; page?: number }) {
  return useApiSuspenseQuery(["companyUpdates", params], "/api/company-updates", params);
}

export function useCompanyUpdate(id: string, companyId: string) {
  return useApiSuspenseQuery(["companyUpdates", id], `/api/company-updates/${id}`, { companyId });
}

export function useCreateCompanyUpdate() {
  return useApiMutation("post", "/api/company-updates");
}

export function useUpdateCompanyUpdate(id: string) {
  return useApiMutation("put", `/api/company-updates/${id}`);
}

// Team Updates / Tasks
export function useTeamUpdateTasks(params: { companyId: string; invoiceId?: string }) {
  return useApiQuery(["teamUpdateTasks", params], "/api/team-update-tasks", params, {
    enabled: !!params.invoiceId,
  });
}

export function useTeamUpdates(params: { companyId: string; period?: string }) {
  return useApiSuspenseQuery(["teamUpdates", params], "/api/team-updates", params);
}

// Companies
export function useCompany(id: string) {
  return useApiSuspenseQuery(["companies", id], `/api/companies/${id}`);
}

export function useUpdateCompany(id: string) {
  return useApiMutation("put", `/api/companies/${id}`);
}

export function useCreateCompany() {
  return useApiMutation("post", "/api/companies");
}

// Company Settings
export function useCompanySettings(companyId: string) {
  return useApiSuspenseQuery(["companySettings", companyId], `/api/companies/${companyId}/settings`);
}

export function useUpdateCompanySettings(companyId: string) {
  return useApiMutation("put", `/api/companies/${companyId}/settings`);
}

// Equity Settings
export function useEquitySettings(companyId: string) {
  return useApiSuspenseQuery(["equitySettings", companyId], `/api/equity-settings`, { companyId });
}

export function useUpdateEquitySettings(companyId: string) {
  return useApiMutation("put", `/api/equity-settings`, { companyId });
}

// Onboarding
export function useOnboardingStatus(companyId: string) {
  return useApiQuery(["onboarding", companyId], `/api/onboarding`, { companyId });
}

export function useUpdateOnboarding() {
  return useApiMutation("put", "/api/onboarding");
}

// Expenses
export function useExpenses(params: { companyId: string; perPage?: number; page?: number }) {
  return useApiSuspenseQuery(["expenses", params], "/api/expenses", params);
}

export function useCreateExpense() {
  return useApiMutation("post", "/api/expenses");
}

// Company Invitations
export function useCompanyInvitations(params: { companyId?: string }) {
  return useApiSuspenseQuery(["companyInvitations", params], "/api/company-invitations", params);
}

export function useCreateCompanyInvitation() {
  return useApiMutation("post", "/api/company-invitations");
}

// Investor Entities
export function useInvestorEntities(params: { companyId: string }) {
  return useApiSuspenseQuery(["investorEntities", params], "/api/investor-entities", params);
}

export function useInvestorEntity(id: string, companyId: string) {
  return useApiSuspenseQuery(["investorEntities", id], `/api/investor-entities/${id}`, { companyId });
}

// Cap Table Uploads
export function useCapTableUploads(params: { companyId: string }) {
  return useApiSuspenseQuery(["capTableUploads", params], "/api/cap-table-uploads", params);
}

export function useCreateCapTableUpload() {
  return useApiMutation("post", "/api/cap-table-uploads");
}

// Talent Pool
export function useTalentPool(params: { companyId: string; perPage?: number; page?: number }) {
  return useApiSuspenseQuery(["talentPool", params], "/api/talent-pool", params);
}

export function useTalentPoolEntry(id: string, companyId: string) {
  return useApiSuspenseQuery(["talentPool", id], `/api/talent-pool/${id}`, { companyId });
}

// Users / Settings
export function useUser(id: string) {
  return useApiSuspenseQuery(["users", id], `/api/users/${id}`);
}

export function useUpdateUser(id: string) {
  return useApiMutation("put", `/api/users/${id}`);
}

// Payout Settings
export function usePayoutSettings(companyId: string) {
  return useApiSuspenseQuery(["payoutSettings", companyId], "/api/payout-settings", { companyId });
}

export function useUpdatePayoutSettings() {
  return useApiMutation("put", "/api/payout-settings");
}

// Tax Settings
export function useTaxSettings(companyId: string) {
  return useApiSuspenseQuery(["taxSettings", companyId], "/api/tax-settings", { companyId });
}

export function useUpdateTaxSettings() {
  return useApiMutation("put", "/api/tax-settings");
}

// File Uploads (R2 presigned URLs)
export function usePresignedUploadUrl() {
  return useApiMutation<{ url: string; key: string }, { filename: string; contentType: string }>(
    "post",
    "/api/uploads/presign",
  );
}

// Billing
export function useBillingSettings(companyId: string) {
  return useApiSuspenseQuery(["billing", companyId], `/api/billing`, { companyId });
}

export function useUpdateBilling() {
  return useApiMutation("put", "/api/billing");
}

// Equity Grant Exercises
export function useEquityGrantExercises(params: { companyId: string }) {
  return useApiSuspenseQuery(["equityGrantExercises", params], "/api/equity-grant-exercises", params);
}

export function useCreateEquityGrantExercise() {
  return useApiMutation("post", "/api/equity-grant-exercises");
}

// Admin Settings
export function useAdminSettings(companyId: string) {
  return useApiSuspenseQuery(["adminSettings", companyId], `/api/admin/settings`, { companyId });
}

export function useUpdateAdminSettings(companyId: string) {
  return useApiMutation("put", `/api/admin/settings`);
}
