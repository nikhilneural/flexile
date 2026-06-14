import LegalDetails from "@/app/onboarding/LegalDetails";
import { steps } from "..";

export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return (
    <LegalDetails
      header="How will you be billing?"
      subheading="Your invoices and tax documents will include this information."
      nextLinkTo={`/companies/${companyId}/worker/onboarding/bank_account`}
      prevLinkTo={`/companies/${companyId}/worker/onboarding`}
      steps={steps}
    />
  );
}
