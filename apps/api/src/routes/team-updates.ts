import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { endOfWeek, formatISO, isFuture } from "date-fns";
import { and, asc, desc, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, type Database } from "@/db";
import {
  companyContractors,
  companyContractorUpdates,
  companyContractorUpdateTasks,
  integrationRecords,
  integrations,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assert } from "@/utils/assert";

const isActive = (contractor: typeof companyContractors.$inferSelect | null): boolean =>
  !!contractor && (!contractor.endedAt || isFuture(contractor.endedAt));

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

const companyGithubIntegration = (companyId: bigint) =>
  and(eq(integrations.companyId, companyId), eq(integrations.type, "GithubIntegration"));

export const getUpdateList = async ({
  db,
  companyId,
  contractorId,
  period,
}: {
  db: Database;
  companyId: bigint;
  contractorId?: string | undefined;
  period: string[] | undefined;
}) => {
  const rows = await db.query.companyContractorUpdates.findMany({
    columns: { id: true, periodStartsOn: true, periodEndsOn: true, publishedAt: true, companyContractorId: true },
    with: {
      tasks: {
        columns: { id: true, name: true, completedAt: true },
        orderBy: [asc(companyContractorUpdateTasks.position)],
      },
    },
    where: and(
      isNotNull(companyContractorUpdates.publishedAt),
      eq(companyContractorUpdates.companyId, companyId),
      period ? inArray(companyContractorUpdates.periodStartsOn, period) : undefined,
      contractorId
        ? eq(companyContractorUpdates.companyContractorId, byExternalId(companyContractors, contractorId))
        : undefined,
    ),
    orderBy: [desc(companyContractorUpdates.publishedAt)],
  });

  const integrationsRows = await db.query.integrationRecords.findMany({
    where: and(
      eq(integrationRecords.integratableType, "CompanyWorkerUpdateTask"),
      inArray(
        integrationRecords.integratableId,
        rows.flatMap((update) => update.tasks.map((task) => task.id)),
      ),
    ),
  });
  const integrationsMap = new Map(
    integrationsRows.map((record: any) => [record.integratableId, record] as const),
  );

  return rows.map((update) => ({
    ...update,
    tasks: update.tasks.map((task) => {
      const integrationRecord = integrationsMap.get(task.id) as any;
      const jsonData = integrationRecord && githubIntegrationJsonDataSchema.safeParse(integrationRecord.jsonData).data;
      return {
        ...task,
        integrationRecord: jsonData
          ? { id: integrationRecord.id, external_id: integrationRecord.integrationExternalId, ...jsonData }
          : null,
      };
    }),
  }));
};

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/team-updates
app.get(
  "/:companyId/team-updates",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      contractorId: z.string().optional(),
      period: z.string().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (!ctx.companyAdministrator && !isActive(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

    const period = input.period ? input.period.split(",") : undefined;
    const results = await getUpdateList({
      db: ctx.db,
      companyId: ctx.company.id,
      contractorId: input.contractorId,
      period,
    });

    return c.json(results);
  },
);

// POST /api/companies/:companyId/team-updates
app.post(
  "/:companyId/team-updates",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "json",
    z.object({
      periodStartsOn: z.string(),
      tasks: z.array(
        z.object({
          id: z.number().nullable().optional(),
          name: z.string(),
          completedAt: z.string().nullable().optional(),
          integrationRecord: z
            .object({
              id: z.number().nullable().optional(),
              external_id: z.string(),
              description: z.string(),
              resource_id: z.string(),
              url: z.string(),
              resource_name: z.enum(["issues", "pulls"]),
              status: z.string(),
            })
            .nullable()
            .optional(),
        }),
      ),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("json");

    if (!isActive(ctx.companyContractor)) return c.json({ error: "Forbidden" }, 403);

    await ctx.db.transaction(async (tx) => {
      const [update] = await tx
        .insert(companyContractorUpdates)
        .values({
          companyId: ctx.company.id,
          periodStartsOn: input.periodStartsOn,
          periodEndsOn: formatISO(endOfWeek(input.periodStartsOn), { representation: "date" }),
          companyContractorId: ctx.companyContractor!.id,
          publishedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [companyContractorUpdates.companyContractorId, companyContractorUpdates.periodStartsOn],
          set: { publishedAt: new Date() },
        })
        .returning();
      if (!update) return c.json({ error: "Failed" }, 400);

      const deleted = await tx
        .delete(companyContractorUpdateTasks)
        .where(
          and(
            eq(companyContractorUpdateTasks.companyContractorUpdateId, update.id),
            notInArray(
              companyContractorUpdateTasks.id,
              input.tasks.flatMap((task) => (task.id ? [BigInt(task.id)] : [])),
            ),
          ),
        )
        .returning();

      await tx
        .delete(integrationRecords)
        .where(
          and(
            eq(integrationRecords.integratableType, "CompanyWorkerUpdateTask"),
            inArray(
              integrationRecords.integratableId,
              deleted
                .map((task) => task.id)
                .concat(input.tasks.flatMap((task) => (task.id && !task.integrationRecord ? [BigInt(task.id)] : []))),
            ),
          ),
        );

      const githubIntegration = await tx.query.integrations.findFirst({
        columns: { id: true },
        where: companyGithubIntegration(ctx.company.id),
      });

      for (const [index, task] of input.tasks.entries()) {
        const data = {
          position: index,
          name: task.name,
          completedAt: task.completedAt,
        };
        let taskId = task.id ? BigInt(task.id) : null;
        if (taskId) {
          const [updated] = await tx
            .update(companyContractorUpdateTasks)
            .set(data)
            .where(
              and(
                eq(companyContractorUpdateTasks.id, taskId),
                eq(companyContractorUpdateTasks.companyContractorUpdateId, update.id),
              ),
            )
            .returning();
          if (!updated) return c.json({ error: "Not Found" }, 404);
        } else {
          const [inserted] = await tx
            .insert(companyContractorUpdateTasks)
            .values({ companyContractorUpdateId: update.id, ...data })
            .returning();
          assert(inserted != null);
          taskId = inserted.id;
        }
        if (githubIntegration && task.integrationRecord) {
          const { id: recordId, ...integrationRecord } = task.integrationRecord;
          if (recordId) {
            await tx
              .update(integrationRecords)
              .set({ integrationExternalId: integrationRecord.external_id, jsonData: integrationRecord })
              .where(
                and(
                  eq(integrationRecords.integratableType, "CompanyWorkerUpdateTask"),
                  eq(integrationRecords.integratableId, taskId),
                  eq(integrationRecords.id, BigInt(recordId)),
                ),
              );
          } else {
            await tx.insert(integrationRecords).values({
              integrationId: githubIntegration.id,
              integrationExternalId: integrationRecord.external_id,
              integratableType: "CompanyWorkerUpdateTask",
              integratableId: taskId,
              jsonData: integrationRecord,
            });
          }
        }
      }
    });

    return c.json({ success: true });
  },
);

export { app as teamUpdatesRouter };
