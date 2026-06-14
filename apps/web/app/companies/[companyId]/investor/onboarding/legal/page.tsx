import LegalDetails from "@/app/onboarding/LegalDetails";
import { steps } from "..";
export default async function Page({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  return (
    <LegalDetails
      header="What's your legal entity?"
      subheading="Your tax documents will include this information."
      nextLinkTo={`/companies/${companyId}/investor/onboarding/bank_account`}
      prevLinkTo={`/companies/${companyId}/investor/onboarding`}
      steps={steps}
    />
  );
}
