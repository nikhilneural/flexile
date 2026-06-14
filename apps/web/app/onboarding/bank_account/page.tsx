import { steps } from "..";
import BankAccount from "../BankAccount";

export default function Page() {
  return (
    <BankAccount
      header="Get paid fast"
      subheading="Once you start submitting invoices, your payments will automatically be sent to this bank account."
      nextLinkTo="/company_invitations/new"
      steps={steps}
    />
  );
}
