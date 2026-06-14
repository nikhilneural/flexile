import { steps } from "@/app/companies/[companyId]/investor/onboarding";
import BankAccount from "@/app/onboarding/BankAccount";

export default function Page() {
  return (
    <BankAccount
      header="Set up a payout method"
      subheading="Dividends will be paid out automatically to the selected account."
      nextLinkTo="/dashboard"
      steps={steps}
    />
  );
}
