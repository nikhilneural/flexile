type CompanyFlags = { expenseCardsEnabled: boolean };
type ContractorInfo = { endedAt: string | null; onTrial: boolean; role: { expenseCardEnabled: boolean } };

export const policies = {
  "expenseCards.create": ({ companyContractor, company }) =>
    companyContractor &&
    !companyContractor.endedAt &&
    company.expenseCardsEnabled &&
    !companyContractor.onTrial &&
    companyContractor.role.expenseCardEnabled,
} satisfies Record<
  string,
  (ctx: {
    user: unknown;
    company: CompanyFlags;
    companyAdministrator: unknown;
    companyContractor: ContractorInfo | undefined;
    companyInvestor: unknown;
    companyLawyer: unknown;
  }) => unknown
>;
