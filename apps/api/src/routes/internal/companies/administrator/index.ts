import { Hono } from "hono";
import type { Env } from "@/env";
import { adminOnboardingRouter } from "./onboarding";
import { adminGithubRouter } from "./github";
import { adminQuickbooksRouter } from "./quickbooks";
import { adminEquityGrantsRouter } from "./equity-grants";
import { adminStripeMicrodepositRouter } from "./stripe-microdeposit-verifications";
import { adminEquitySettingsRouter } from "./equity-settings";

const administratorRouter = new Hono<{ Bindings: Env }>();

administratorRouter.route("/onboarding", adminOnboardingRouter);
administratorRouter.route("/github", adminGithubRouter);
administratorRouter.route("/quickbooks", adminQuickbooksRouter);
administratorRouter.route("/equity-grants", adminEquityGrantsRouter);
administratorRouter.route("/stripe-microdeposit-verifications", adminStripeMicrodepositRouter);
administratorRouter.route("/equity-settings", adminEquitySettingsRouter);

export { administratorRouter };
