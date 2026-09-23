import { vi } from "vitest";

// `server-only` throws outside a React Server environment; tests run in plain Node.
vi.mock("server-only", () => ({}));

// `@/env` validates every production secret; tests only need the database.
process.env.CI ??= "1"; // disables the Drizzle query logger
process.env.DATABASE_URL ??= "postgresql://flexile:flexile@127.0.0.1:5432/flexile_test";
vi.mock("@/env", () => ({ default: { DATABASE_URL: process.env.DATABASE_URL } }));
