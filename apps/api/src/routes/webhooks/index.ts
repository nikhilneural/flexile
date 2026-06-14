import { Hono } from "hono";
import type { Env } from "@/env";
import { stripeWebhookRouter } from "./stripe";
import { githubWebhookRouter } from "./github";
import { quickbooksWebhookRouter } from "./quickbooks";
import { wiseWebhookRouter } from "./wise";

const webhooksRouter = new Hono<{ Bindings: Env }>();

webhooksRouter.route("/stripe", stripeWebhookRouter);
webhooksRouter.route("/github", githubWebhookRouter);
webhooksRouter.route("/quickbooks", quickbooksWebhookRouter);
webhooksRouter.route("/wise", wiseWebhookRouter);

export { webhooksRouter };
