import { and, eq, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Env } from "@/env";
import * as schema from "./schema";

/**
 * Creates a Drizzle ORM database instance using Hyperdrive's connection string.
 * Hyperdrive provides automatic connection pooling for PostgreSQL on Cloudflare Workers.
 */
export const createDb = (env: Env) => {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  return drizzle({
    connection: connectionString,
    schema,
  });
};

export type Database = ReturnType<typeof createDb>;

export const byExternalId = (
  table: PgTable & { id: PgColumn; externalId: PgColumn },
  externalId: string,
  where?: SQL,
) =>
  sql`(SELECT ${table.id} FROM ${table} WHERE ${eq(table.externalId, externalId)}${where ? sql` AND ${where}` : sql``} LIMIT 1)`;

export const paginationSchema = z.object({ page: z.number(), perPage: z.number() }).or(z.object({}));
export const pagination = (obj: z.infer<typeof paginationSchema>) => ({
  ...("page" in obj ? { offset: (obj.page - 1) * obj.perPage, limit: obj.perPage } : {}),
});
export const paginate = <T extends { limit: (limit: number) => { offset: (offset: number) => unknown } }>(
  query: T,
  obj: z.infer<typeof paginationSchema>,
): T | (T extends { limit: (limit: number) => { offset: (offset: number) => infer R } } ? R : never) =>
  // @ts-expect-error -- this isn't worth typing correctly, but it works!
  "page" in obj ? query.limit(obj.perPage).offset((obj.page - 1) * obj.perPage) : query;
