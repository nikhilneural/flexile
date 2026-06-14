import { Hono } from "hono";
import type { Env } from "@/env";
import { authMiddleware } from "@/middleware/auth";
import { workersRouter } from "./workers";
import { companyInvoicesRouter } from "./invoices";
import { equityGrantExercisesRouter } from "./equity-grant-exercises";
import { equityExercisePaymentsRouter } from "./equity-exercise-payments";
import { companyRolesRouter } from "./roles";
import { searchRouter } from "./search";
import { signeeSearchRouter } from "./signee-search";
import { switchRouter } from "./switch";
import { stripeEphemeralKeysRouter } from "./stripe-ephemeral-keys";
import { companyUpdatesRouter } from "./company-updates";
import { roleApplicationsRouter } from "./role-applications";
import { lawyersRouter } from "./lawyers";
import { administratorRouter } from "./administrator";

const internalCompaniesRouter = new Hono<{ Bindings: Env }>();

internalCompaniesRouter.use("*", authMiddleware);

internalCompaniesRouter.route("/:companyId/workers", workersRouter);
internalCompaniesRouter.route("/:companyId/invoices", companyInvoicesRouter);
internalCompaniesRouter.route("/:companyId/equity-grant-exercises", equityGrantExercisesRouter);
internalCompaniesRouter.route("/:companyId/equity-exercise-payments", equityExercisePaymentsRouter);
internalCompaniesRouter.route("/:companyId/roles", companyRolesRouter);
internalCompaniesRouter.route("/:companyId/search", searchRouter);
internalCompaniesRouter.route("/:companyId/signee-search", signeeSearchRouter);
internalCompaniesRouter.route("/:companyId/switch", switchRouter);
internalCompaniesRouter.route("/:companyId/stripe-ephemeral-keys", stripeEphemeralKeysRouter);
internalCompaniesRouter.route("/:companyId/company-updates", companyUpdatesRouter);
internalCompaniesRouter.route("/:companyId/role-applications", roleApplicationsRouter);
internalCompaniesRouter.route("/:companyId/lawyers", lawyersRouter);
internalCompaniesRouter.route("/:companyId/administrator", administratorRouter);

export { internalCompaniesRouter };
