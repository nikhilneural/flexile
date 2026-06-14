import BankAccount from "@/app/onboarding/BankAccount";
import { steps } from "..";

export default function Page() {
  return (
    <BankAccount
      header="Get paid fast"
      subheading="'Once you start submitting invoices, your payments will automatically be sent to this bank account.'"
      nextLinkTo="/dashboard"
      steps={steps}
    />
  );
}
