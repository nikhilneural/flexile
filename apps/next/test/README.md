# Native backend tests

Vitest tests for code ported from Rails into Next.js.

```shell
# one-time: create a database with the schema loaded (e.g. via `bin/rails db:schema:load` with DATABASE_URL set)
DATABASE_URL=postgresql://username:password@127.0.0.1:5432/flexile_test pnpm test:native
```

Tests import `@/db` directly, so `DATABASE_URL` must point at a disposable database.
