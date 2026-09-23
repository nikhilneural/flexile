import type { D1Database, Fetcher } from "@cloudflare/workers-types";

export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_NAME: string;
  JWT_SECRET: string;
};

export type AuthUser = {
  id: number;
  externalId: string;
  email: string;
  legalName: string | null;
};

export type Variables = {
  user: AuthUser;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
