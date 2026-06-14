import { Hono } from "hono";
import type { Env } from "@/env";

import { usersRouter } from "./users";
import { companiesRouter } from "./companies";
import { invoicesRouter } from "./invoices";
import { equityGrantsRouter } from "./equity-grants";
import { equityCalculationsRouter } from "./equity-calculations";
import { equityAllocationsRouter } from "./equity-allocations";
import { equitySettingsRouter } from "./equity-settings";
import { equityGrantExercisesRouter } from "./equity-grant-exercises";
import { shareHoldingsRouter } from "./share-holdings";
import { dividendsRouter } from "./dividends";
import { dividendRoundsRouter } from "./dividend-rounds";
import { capTableRouter } from "./cap-table";
import { capTableUploadsRouter } from "./cap-table-uploads";
import { convertibleSecuritiesRouter } from "./convertible-securities";
import { financingRoundsRouter } from "./financing-rounds";
import { optionPoolsRouter } from "./option-pools";
import { tenderOffersRouter } from "./tender-offers";
import { tenderOfferBidsRouter } from "./tender-offers/bids";
import { investorsRouter } from "./investors";
import { investorEntitiesRouter } from "./investor-entities";
import { consolidatedInvoicesRouter } from "./consolidated-invoices";
import { contractorsRouter } from "./contractors";
import { contractorProfilesRouter } from "./contractor-profiles";
import { documentsRouter } from "./documents";
import { rolesRouter } from "./roles";
import { roleApplicationsRouter } from "./roles/applications";
import { companyAdministratorsRouter } from "./company-administrators";
import { companyUpdatesRouter } from "./company-updates";
import { teamUpdatesRouter } from "./team-updates";
import { teamUpdateTasksRouter } from "./team-update-tasks";
import { workerAbsencesRouter } from "./worker-absences";
import { walletsRouter } from "./wallets";
import { filesRouter } from "./files";
import { expenseCardsRouter } from "./expense-cards";
import { expenseCardChargesRouter } from "./expense-cards/charges";
import { expenseCategoriesRouter } from "./expense-categories";
import { financialReportsRouter } from "./financial-reports";
import { quickbooksRouter } from "./quickbooks";
import { githubRouter } from "./github";
import { lawyersRouter } from "./lawyers";

const routes = new Hono<{ Bindings: Env }>();

// User routes (auth only, no company context)
routes.route("/api/users", usersRouter);
routes.route("/api/files", filesRouter);
routes.route("/api/contractor-profiles", contractorProfilesRouter);

// Public role routes (no auth needed)
routes.route("/api/roles", rolesRouter);

// Public role applications (no auth needed for creating)
routes.route("/api/roles", roleApplicationsRouter);

// Company-scoped routes (auth + company context via :companyId)
routes.route("/api/companies", companiesRouter);
routes.route("/api/companies", invoicesRouter);
routes.route("/api/companies", equityGrantsRouter);
routes.route("/api/companies", equityCalculationsRouter);
routes.route("/api/companies", equityAllocationsRouter);
routes.route("/api/companies", equitySettingsRouter);
routes.route("/api/companies", equityGrantExercisesRouter);
routes.route("/api/companies", shareHoldingsRouter);
routes.route("/api/companies", dividendsRouter);
routes.route("/api/companies", dividendRoundsRouter);
routes.route("/api/companies", capTableRouter);
routes.route("/api/companies", capTableUploadsRouter);
routes.route("/api/companies", convertibleSecuritiesRouter);
routes.route("/api/companies", financingRoundsRouter);
routes.route("/api/companies", optionPoolsRouter);
routes.route("/api/companies", tenderOffersRouter);
routes.route("/api/companies", tenderOfferBidsRouter);
routes.route("/api/companies", investorsRouter);
routes.route("/api/companies", investorEntitiesRouter);
routes.route("/api/companies", consolidatedInvoicesRouter);
routes.route("/api/companies", contractorsRouter);
routes.route("/api/companies", documentsRouter);
routes.route("/api/companies", rolesRouter);
routes.route("/api/companies", roleApplicationsRouter);
routes.route("/api/companies", companyAdministratorsRouter);
routes.route("/api/companies", companyUpdatesRouter);
routes.route("/api/companies", teamUpdatesRouter);
routes.route("/api/companies", teamUpdateTasksRouter);
routes.route("/api/companies", workerAbsencesRouter);
routes.route("/api/companies", walletsRouter);
routes.route("/api/companies", expenseCardsRouter);
routes.route("/api/companies", expenseCardChargesRouter);
routes.route("/api/companies", expenseCategoriesRouter);
routes.route("/api/companies", financialReportsRouter);
routes.route("/api/companies", quickbooksRouter);
routes.route("/api/companies", githubRouter);
routes.route("/api/companies", lawyersRouter);

export { routes };
