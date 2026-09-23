# Flexile · Hono + Cloudflare Stack

This is the **Flexile** payroll & equity domain ported to the **Cloudflare stack**:

- **[Hono](https://hono.dev)** — web framework running on Cloudflare Workers
- **Cloudflare Workers** — serverless runtime (the entire app, API + static assets)
- **Cloudflare D1** — SQLite database (replaces the Rails/Postgres + Drizzle layer)
- **Wrangler** — local dev + deployment
- **Web Crypto** — JWT sessions (HS256) + password hashing (no Node-only deps)

The original repo was a Rails API + Next.js/tRPC frontend. This port reimplements
the core domain — **auth, companies & roles, invoices, people, documents, and
equity (cap table / grants / dividends)** — as a self-contained Worker.

## Architecture

```
apps/hono/
├── src/
│   ├── index.ts            # Hono app: wires routes + serves SPA via ASSETS
│   ├── types.ts            # Cloudflare bindings (DB, ASSETS) + context types
│   ├── lib/
│   │   ├── auth.ts         # JWT sign/verify + password hashing (Web Crypto)
│   │   ├── middleware.ts   # requireAuth: cookie/bearer -> load user from D1
│   │   └── ids.ts          # external-id generator
│   └── routes/
│       ├── auth.ts         # login / signup / logout / me
│       ├── companies.ts    # list (with roles) / detail+metrics / create
│       ├── invoices.ts     # list / detail+line items / create / status update
│       ├── documents.ts    # list / create / sign
│       ├── equity.ts       # cap table / option grants / dividends
│       └── people.ts       # contractors / investors / admins / lawyers
├── public/                 # frontend SPA (served by the Worker)
│   ├── index.html
│   └── app.js
├── migrations/
│   ├── 0001_init.sql       # D1 schema
│   └── 0002_seed.sql       # demo data
└── wrangler.toml
```

## Run locally

```bash
cd apps/hono
npm install
npx wrangler d1 migrations apply flexile-db --local   # creates + seeds the DB
npx wrangler dev --ip 0.0.0.0 --port 8788
```

Open http://localhost:8788

## Demo accounts (password: `password123`)

| Email                | Role          |
| -------------------- | ------------- |
| admin@acme.test      | Administrator |
| dev@acme.test        | Contractor    |
| investor@acme.test   | Investor      |
| lawyer@acme.test     | Lawyer        |

## API

| Method | Path                                   | Description                       |
| ------ | -------------------------------------- | --------------------------------- |
| GET    | `/api/health`                          | Health/status                     |
| POST   | `/api/auth/login`                      | Email + password -> JWT cookie    |
| POST   | `/api/auth/signup`                     | Create account                    |
| POST   | `/api/auth/logout`                     | Clear session                     |
| GET    | `/api/auth/me`                         | Current user                      |
| GET    | `/api/companies`                       | Companies for user + their roles  |
| GET    | `/api/companies/:id`                   | Company detail + metrics          |
| POST   | `/api/companies`                       | Create company (becomes admin)    |
| GET    | `/api/invoices?companyId=`             | List invoices                     |
| GET    | `/api/invoices/:id`                    | Invoice + line items              |
| POST   | `/api/invoices`                        | Create invoice                    |
| PATCH  | `/api/invoices/:id/status`             | Approve / pay / reject            |
| GET    | `/api/people?companyId=`               | All people by role                |
| GET    | `/api/documents?companyId=`            | List documents                    |
| POST   | `/api/documents` / `/:id/sign`         | Create / sign document            |
| GET    | `/api/equity/cap-table?companyId=`     | Cap table + ownership %           |
| GET    | `/api/equity/grants?companyId=`        | Option grants                     |
| GET    | `/api/equity/dividends?companyId=`     | Dividend rounds + payouts         |

## Deploy to Cloudflare

```bash
# Create the D1 database, then put its id in wrangler.toml
npx wrangler d1 create flexile-db
npx wrangler d1 migrations apply flexile-db --remote
npx wrangler deploy
```
