import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, gt, inArray, lt, lte } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { companyContractorUpdates, companyContractorUpdateTasks, integrationRecords, invoices } from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";

const githubIntegrationJsonDataSchema = z
  .object({
    description: z.string(),
    resource_id: z.string(),
    url: z.string(),
  })
  .and(
    z.discriminatedUnion("resource_name", [
      z.object({ resource_name: z.literal("issues"), status: z.enum(["open", "closed"]) }),
      z.object({ resource_name: z.literal("pulls"), status: z.enum(["open", "closed", "merged", "draft"]) }),
    ]),
  );

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/team-update-tasks
app.get(
  "/:companyId/team-update-tasks",
  authMiddleware,
  companyMiddleware,
  zValidator("query", z.object({ invoiceId: z.string() })),
  async (c) => {
    const ctx = c.get("company");
    const { invoiceId } = c.req.valid("query");

    if (!ctx.companyAdministrator) return c.json({ error: "Forbidden" }, 403);

    const invoice = await ctx.db.query.invoices.findFirst({
      where: and(eq(invoices.externalId, invoiceId), eq(invoices.companyId, ctx.company.id)),
    });
    if (!invoice) return c.json({ error: "Not Found" }, 404);

    const previousInvoice = await ctx.db.query.invoices.findFirst({
      where: and(
        eq(invoices.companyContractorId, invoice.companyContractorId),
        lt(invoices.invoiceDate, invoice.invoiceDate),
      ),
      orderBy: [desc(invoices.invoiceDate)],
    });

    const rows = await ctx.db.query.companyContractorUpdateTasks.findMany({
      columns: { id: true, name: true, completedAt: true, createdAt: true },
      where: and(
        inArray(
          companyContractorUpdateTasks.companyContractorUpdateId,
          ctx.db
            .select({ id: companyContractorUpdates.id })
            .from(companyContractorUpdates)
            .where(eq(companyContractorUpdates.companyContractorId, invoice.companyContractorId)),
        ),
        previousInvoice ? gt(companyContractorUpdateTasks.createdAt, new Date(previousInvoice.invoiceDate)) : undefined,
        lte(companyContractorUpdateTasks.createdAt, new Date(invoice.invoiceDate)),
      ),
      orderBy: [asc(companyContractorUpdateTasks.createdAt)],
    });

    const integrationsRows = await ctx.db.query.integrationRecords.findMany({
      where: and(
        eq(integrationRecords.integratableType, "CompanyWorkerUpdateTask"),
        inArray(
          integrationRecords.integratableId,
          rows.map((task) => task.id),
        ),
      ),
    });
    const integrationsMap = new Map(
      integrationsRows.map((record: any) => [record.integratableId, record] as const),
    );

    const result = rows.map((task) => {
      const integrationRecord = integrationsMap.get(task.id) as any;
      const jsonData = integrationRecord && githubIntegrationJsonDataSchema.safeParse(integrationRecord.jsonData).data;
      return {
        ...task,
        integrationRecord: jsonData
          ? { id: integrationRecord.id, external_id: integrationRecord.integrationExternalId, ...jsonData }
          : null,
      };
    });

    return c.json(result);
  },
);

export { app as teamUpdateTasksRouter };
