import { steps } from "..";
import LegalDetails from "../LegalDetails";

export default function Page() {
  return (
    <LegalDetails
      header="How will you be billing?"
      subheading="Your invoices and tax documents will include this information."
      nextLinkTo="/onboarding/bank_account"
      prevLinkTo="/onboarding"
      steps={steps}
    />
  );
}
