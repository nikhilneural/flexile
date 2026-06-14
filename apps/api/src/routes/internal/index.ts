import { Hono } from "hono";
import type { Env } from "@/env";
import { onboardingRouter } from "./onboarding";
import { companyInvitationsRouter } from "./company-invitations";
import { internalRolesRouter } from "./roles";
import { wiseAccountRequirementsRouter } from "./wise-account-requirements";
import { internalCompaniesRouter } from "./companies";
import { settingsRouter } from "./settings";
import { demoRouter } from "./demo";

const internalRouter = new Hono<{ Bindings: Env }>();

internalRouter.route("/onboarding", onboardingRouter);
internalRouter.route("/company-invitations", companyInvitationsRouter);
internalRouter.route("/roles", internalRolesRouter);
internalRouter.route("/wise-account-requirements", wiseAccountRequirementsRouter);
internalRouter.route("/companies", internalCompaniesRouter);
internalRouter.route("/settings", settingsRouter);
internalRouter.route("/demo", demoRouter);

export { internalRouter };
