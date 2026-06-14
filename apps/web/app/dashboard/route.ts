import { redirect } from "next/navigation";
import { navLinks as equityNavLinks } from "@/app/equity";
import { currentUserSchema } from "@/models/user";
import { assertDefined } from "@/utils/assert";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:8787";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const response = await fetch(`${API_URL}/api/users/me`, {
    headers: {
      cookie,
      "User-Agent": req.headers.get("User-Agent") ?? "",
    },
  });
  if (!response.ok) return redirect("/login");
  const user = currentUserSchema.parse(await response.json());
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
