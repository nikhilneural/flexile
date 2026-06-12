-- Flexile core schema ported to Cloudflare D1 (SQLite)
-- Models a representative subset of the Flexile domain:
-- users, companies, roles (admin/contractor/investor/lawyer),
-- invoices + line items, documents, equity (grants, share classes, dividends).

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id     TEXT NOT NULL UNIQUE,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT,
  legal_name      TEXT,
  preferred_name  TEXT,
  country_code    TEXT DEFAULT 'US',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id         TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  email               TEXT,
  public_name         TEXT,
  tax_id              TEXT,
  country_code        TEXT DEFAULT 'US',
  is_trusted          INTEGER NOT NULL DEFAULT 0,
  share_price_usd     REAL DEFAULT 0,
  fully_diluted_shares INTEGER DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Company roles (one row per user-company relationship per role type)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_administrators (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS company_contractors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id     TEXT NOT NULL UNIQUE,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role            TEXT,
  pay_rate_usd    REAL DEFAULT 0,
  pay_rate_type   TEXT NOT NULL DEFAULT 'hourly', -- hourly | project_based
  started_at      TEXT,
  ended_at        TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS company_investors (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id           TEXT NOT NULL UNIQUE,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  investment_amount_usd REAL DEFAULT 0,
  total_shares          INTEGER DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, company_id)
);

CREATE TABLE IF NOT EXISTS company_lawyers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, company_id)
);

-- ---------------------------------------------------------------------------
-- Invoices + line items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id           TEXT NOT NULL UNIQUE,
  company_id            INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number        TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'received', -- received | approved | processing | paid | rejected
  invoice_date          TEXT NOT NULL DEFAULT (date('now')),
  total_amount_cents    INTEGER NOT NULL DEFAULT 0,
  description           TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id        INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  quantity          REAL NOT NULL DEFAULT 1,
  pay_rate_cents    INTEGER NOT NULL DEFAULT 0,
  total_amount_cents INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Documents (contracts, tax docs, equity plans, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id   TEXT NOT NULL UNIQUE,
  company_id    INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'consulting_contract',
  status        TEXT NOT NULL DEFAULT 'unsigned', -- unsigned | signed | completed
  signed_at     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Equity: share classes, equity grants, dividend rounds, dividends
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS share_classes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  original_issue_price_usd REAL DEFAULT 0,
  preferred       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equity_grants (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id           TEXT NOT NULL UNIQUE,
  company_investor_id   INTEGER NOT NULL REFERENCES company_investors(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  number_of_shares      INTEGER NOT NULL DEFAULT 0,
  vested_shares         INTEGER NOT NULL DEFAULT 0,
  exercise_price_usd    REAL NOT NULL DEFAULT 0,
  issued_at             TEXT NOT NULL DEFAULT (date('now')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dividend_rounds (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id         TEXT NOT NULL UNIQUE,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  issued_at           TEXT NOT NULL DEFAULT (date('now')),
  total_amount_cents  INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'issued',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dividends (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id         TEXT NOT NULL UNIQUE,
  dividend_round_id   INTEGER NOT NULL REFERENCES dividend_rounds(id) ON DELETE CASCADE,
  company_investor_id INTEGER NOT NULL REFERENCES company_investors(id) ON DELETE CASCADE,
  amount_cents        INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'issued', -- issued | paid
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_documents_company ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_grants_investor ON equity_grants(company_investor_id);
CREATE INDEX IF NOT EXISTS idx_dividends_round ON dividends(dividend_round_id);
