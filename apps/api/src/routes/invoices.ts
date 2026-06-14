import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { formatISO } from "date-fns";
import { and, desc, eq, gte, inArray, isNull, lt, lte, not, notInArray } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { pick } from "lodash-es";
import { z } from "zod";
import type { Env } from "@/env";
import { byExternalId, createDb, pagination, paginationSchema } from "@/db";
import {
  companyContractors,
  companies,
  invoiceApprovals,
  invoiceLineItems,
  invoices,
  users,
  activeStorageAttachments,
  activeStorageBlobs,
} from "@/db/schema";
import { authMiddleware } from "@/middleware/auth";
import { companyMiddleware } from "@/middleware/company";
import { assertDefined } from "@/utils/assert";
import { simpleUser, latestUserComplianceInfo } from "./users/helpers";

const requiresAcceptanceByPayee = (
  invoice: Pick<typeof invoices.$inferSelect, "createdById" | "userId" | "acceptedAt">,
) => invoice.createdById !== invoice.userId && invoice.acceptedAt === null;

const requiresAcceptanceByPayeeFilter = and(
  not(eq(invoices.createdById, invoices.userId)),
  isNull(invoices.acceptedAt),
);

const actionableByUserInvoiceIds = async (
  db: ReturnType<typeof createDb>,
  userId: bigint,
  company: typeof companies.$inferSelect,
) => {
  const payableQuery = db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, company.id),
        inArray(invoices.status, ["approved", "failed"]),
        gte(invoices.invoiceApprovalsCount, company.requiredInvoiceApprovalCount),
        requiresAcceptanceByPayeeFilter ? not(requiresAcceptanceByPayeeFilter) : undefined,
      ),
    );

  const approvedInvoiceIds = await db.query.invoiceApprovals.findMany({
    columns: { invoiceId: true },
    where: eq(invoiceApprovals.approverId, userId),
  });

  const needsApprovalQuery = db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, company.id),
        inArray(invoices.status, ["received", "approved", "failed"]),
        lt(invoices.invoiceApprovalsCount, company.requiredInvoiceApprovalCount),
        notInArray(
          invoices.id,
          approvedInvoiceIds.map((row) => row.invoiceId),
        ),
      ),
    );

  const result = await union(payableQuery, needsApprovalQuery);
  return result.map((row) => row.id);
};

const app = new Hono<{ Bindings: Env }>();

// GET /api/companies/:companyId/invoices
app.get(
  "/:companyId/invoices",
  authMiddleware,
  companyMiddleware,
  zValidator(
    "query",
    z.object({
      contractorId: z.string().optional(),
      invoiceFilter: z.enum(["history", "actionable"]).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
      page: z.coerce.number().optional(),
      perPage: z.coerce.number().optional(),
    }),
  ),
  async (c) => {
    const ctx = c.get("company");
    const input = c.req.valid("query");

    if (
      !ctx.companyAdministrator &&
      !(ctx.companyContractor && input.contractorId === ctx.companyContractor.externalId)
    )
      return c.json({ error: "Forbidden" }, 403);

    let where = and(
      eq(invoices.companyId, ctx.company.id),
      input.contractorId
        ? eq(invoices.companyContractorId, byExternalId(companyContractors, input.contractorId))
        : undefined,
    );
    if (input.before) where = and(where, lte(invoices.invoiceDate, input.before));
    if (input.after) where = and(where, gte(invoices.invoiceDate, input.after));
    if (input.invoiceFilter) {
      const actionableIds = await actionableByUserInvoiceIds(ctx.db, ctx.user.id, ctx.company);
      where = and(
        where,
        requiresAcceptanceByPayeeFilter ? not(requiresAcceptanceByPayeeFilter) : undefined,
        input.invoiceFilter === "actionable"
          ? inArray(invoices.id, actionableIds)
          : notInArray(invoices.id, actionableIds),
      );
    }

    const paginationInput = input.page && input.perPage ? { page: input.page, perPage: input.perPage } : {};
    const rows = await ctx.db.query.invoices.findMany({
      with: {
        rejector: { columns: simpleUser.columns },
        approvals: { with: { approver: { columns: simpleUser.columns } } },
        contractor: {
          with: {
            role: { columns: { name: true } },
            user: {
              columns: {},
              with: {
                userComplianceInfos: { ...latestUserComplianceInfo, columns: { taxInformationConfirmedAt: true } },
              },
            },
          },
        },
      },
      where,
      orderBy: [desc(invoices.invoiceDate), desc(invoices.createdAt)],
      ...pagination(paginationInput),
    });
    const count = await ctx.db.$count(invoices, where);

    return c.json({
      invoices: rows.map((invoice) => ({
        ...pick(
          invoice,
          "createdAt",
          "invoiceNumber",
          "invoiceDate",
          "totalAmountInUsdCents",
          "totalMinutes",
          "paidAt",
          "rejectedAt",
          "rejectionReason",
          "billFrom",
          "status",
          "cashAmountInCents",
          "equityAmountInCents",
          "equityPercentage",
          "invoiceType",
        ),
        requiresAcceptanceByPayee: requiresAcceptanceByPayee(invoice),
        id: invoice.externalId,
        approvals: invoice.approvals.map((approval) => ({
          approvedAt: approval.approvedAt,
          approver: simpleUser(approval.approver),
        })),
        contractor: {
          ...pick(invoice.contractor, "role"),
          user: { complianceInfo: invoice.contractor.user.userComplianceInfos[0] },
        },
        rejector: invoice.rejector && simpleUser(invoice.rejector),
      })),
      total: count,
    });
  },
);

// GET /api/companies/:companyId/invoices/:id
app.get("/:companyId/invoices/:id", authMiddleware, companyMiddleware, async (c) => {
  const ctx = c.get("company");
  const id = c.req.param("id");

  if (!ctx.companyAdministrator && !ctx.companyContractor) return c.json({ error: "Forbidden" }, 403);

  const invoice = await ctx.db.query.invoices.findFirst({
    where: and(
      eq(invoices.externalId, id),
      eq(invoices.companyId, ctx.company.id),
      !ctx.companyAdministrator
        ? eq(invoices.companyContractorId, assertDefined(ctx.companyContractor).id)
        : undefined,
    ),
    with: {
      lineItems: { columns: { description: true, totalAmountCents: true, minutes: true, payRateInSubunits: true } },
      expenses: { columns: { id: true, totalAmountInCents: true, description: true, expenseCategoryId: true } },
      contractor: {
        with: {
          user: {
            columns: { externalId: true },
            with: {
              userComplianceInfos: {
                ...latestUserComplianceInfo,
                columns: { taxInformationConfirmedAt: true, businessEntity: true, legalName: true },
              },
            },
          },
        },
      },
      rejector: { columns: simpleUser.columns },
      approvals: { with: { approver: { columns: simpleUser.columns } } },
    },
  });

  if (!invoice) return c.json({ error: "Not Found" }, 404);

  const attachmentRows = await ctx.db.query.activeStorageAttachments.findMany({
    where: and(
      eq(activeStorageAttachments.recordType, "InvoiceExpense"),
      inArray(
        activeStorageAttachments.recordId,
        invoice.expenses.map((expense) => expense.id),
      ),
      eq(activeStorageAttachments.name, "attachment"),
    ),
    with: { blob: { columns: { key: true, filename: true } } },
  });

  const attachments = new Map(
    attachmentRows.map((attachment) => [
      attachment.recordId,
      `https://${c.env.S3_PRIVATE_BUCKET}.s3.amazonaws.com/${attachment.blob.key}`,
    ]),
  );

  return c.json({
    ...pick(
      invoice,
      "createdAt",
      "invoiceNumber",
      "invoiceDate",
      "totalAmountInUsdCents",
      "totalMinutes",
      "paidAt",
      "rejectedAt",
      "rejectionReason",
      "billFrom",
      "billTo",
      "cashAmountInCents",
      "equityAmountInCents",
      "notes",
      "status",
      "streetAddress",
      "city",
      "state",
      "zipCode",
      "countryCode",
      "equityPercentage",
      "minAllowedEquityPercentage",
      "maxAllowedEquityPercentage",
    ),
    userId: invoice.contractor.user.externalId,
    requiresAcceptanceByPayee: requiresAcceptanceByPayee(invoice),
    expenses: invoice.expenses.map((expense) => ({
      ...expense,
      attachment: attachments.get(expense.id),
    })),
    lineItems: invoice.lineItems,
    id: invoice.externalId,
    approvals: invoice.approvals.map((approval) => ({
      approvedAt: approval.approvedAt,
      approver: simpleUser(approval.approver),
    })),
    rejector: invoice.rejector && simpleUser(invoice.rejector),
    contractor: {
      ...pick(invoice.contractor, "payRateType"),
      user: { complianceInfo: invoice.contractor.user.userComplianceInfos[0] },
    },
  });
});

export { app as invoicesRouter };
