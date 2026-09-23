import path from "node:path";
import { defineConfig } from "vitest/config";

// Native (non-Rails) backend unit/integration tests. Requires DATABASE_URL pointing at a
// database with the Flexile schema loaded (see apps/next/test/README.md).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "apps/next") } },
  test: {
    include: ["apps/next/**/*.test.ts"],
    environment: "node",
    setupFiles: ["apps/next/test/setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
