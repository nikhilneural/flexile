import { redirect } from "next/navigation";
import { navLinks as equityNavLinks } from "@/app/equity";
import { getEffectiveCurrentUser } from "@/trpc/routes/users/demoUser";
import { assertDefined } from "@/utils/assert";

export async function GET(req: Request) {
  const user = await getEffectiveCurrentUser(req);
  if (!user) return redirect("/login");
  if (user.onboardingPath) return redirect(user.onboardingPath);
  if (user.roles.worker?.inviting_company) {
    return redirect("/company_invitations");
  }
  if (!user.currentCompanyId) {
    return redirect("/settings");
  }
  if (user.activeRole === "administrator") {
    return redirect("/invoices");
  }
  if (user.activeRole === "lawyer") {
    return redirect("/documents");
  }
  if (user.roles.worker) {
    return redirect("/invoices");
  }
  const company = assertDefined(user.companies.find((company) => company.id === user.currentCompanyId));
  return redirect(assertDefined(equityNavLinks(user, company)[0]?.route));
}
