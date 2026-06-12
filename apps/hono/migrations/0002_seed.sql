-- Seed data for Flexile-Hono. Password for every demo user is: password123
-- (hash = sha256("flexile-static-salt" + "password123"))

DELETE FROM dividends;
DELETE FROM dividend_rounds;
DELETE FROM equity_grants;
DELETE FROM share_classes;
DELETE FROM documents;
DELETE FROM invoice_line_items;
DELETE FROM invoices;
DELETE FROM company_lawyers;
DELETE FROM company_investors;
DELETE FROM company_contractors;
DELETE FROM company_administrators;
DELETE FROM companies;
DELETE FROM users;

-- Users (password123)
INSERT INTO users (id, external_id, email, password_hash, legal_name, preferred_name, country_code) VALUES
  (1, 'usr_admin01',   'admin@acme.test',     '6e43d170e9a05cb1397a2a7b111c7db9d9b2c399d67cdb7513075788fbbdb326', 'Alice Admin',      'Alice',  'US'),
  (2, 'usr_dev001',    'dev@acme.test',       '6e43d170e9a05cb1397a2a7b111c7db9d9b2c399d67cdb7513075788fbbdb326', 'Bob Builder',      'Bob',    'CA'),
  (3, 'usr_invest01',  'investor@acme.test',  '6e43d170e9a05cb1397a2a7b111c7db9d9b2c399d67cdb7513075788fbbdb326', 'Carol Capital',    'Carol',  'GB'),
  (4, 'usr_lawyer01',  'lawyer@acme.test',    '6e43d170e9a05cb1397a2a7b111c7db9d9b2c399d67cdb7513075788fbbdb326', 'Dan Defense',      'Dan',    'US');

-- Company
INSERT INTO companies (id, external_id, name, email, public_name, tax_id, country_code, is_trusted, share_price_usd, fully_diluted_shares) VALUES
  (1, 'cmp_acme001', 'Acme Robotics Inc.', 'finance@acme.test', 'Acme Robotics', '88-1234567', 'US', 1, 4.25, 10000000);

-- Roles
INSERT INTO company_administrators (id, external_id, user_id, company_id) VALUES
  (1, 'adm_001', 1, 1);

INSERT INTO company_contractors (id, external_id, user_id, company_id, role, pay_rate_usd, pay_rate_type, started_at) VALUES
  (1, 'con_001', 2, 1, 'Senior Engineer', 120.00, 'hourly', '2024-01-15');

INSERT INTO company_investors (id, external_id, user_id, company_id, investment_amount_usd, total_shares) VALUES
  (1, 'inv_001', 3, 1, 250000.00, 500000);

INSERT INTO company_lawyers (id, external_id, user_id, company_id) VALUES
  (1, 'law_001', 4, 1);

-- Invoices
INSERT INTO invoices (id, external_id, company_id, user_id, invoice_number, status, invoice_date, total_amount_cents, description) VALUES
  (1, 'inv_2024_001', 1, 2, 'INV-2024-001', 'paid',     '2024-05-01', 960000, 'May engineering work'),
  (2, 'inv_2024_002', 1, 2, 'INV-2024-002', 'approved', '2024-06-01', 720000, 'June engineering work'),
  (3, 'inv_2024_003', 1, 2, 'INV-2024-003', 'received', '2024-06-30', 480000, 'Late June sprint');

INSERT INTO invoice_line_items (invoice_id, description, quantity, pay_rate_cents, total_amount_cents) VALUES
  (1, 'Backend API development', 80, 12000, 960000),
  (2, 'Frontend feature work',   60, 12000, 720000),
  (3, 'Bug fixes & code review', 40, 12000, 480000);

-- Documents
INSERT INTO documents (id, external_id, company_id, user_id, name, document_type, status, signed_at) VALUES
  (1, 'doc_001', 1, 2, 'Consulting Agreement - Bob Builder', 'consulting_contract', 'signed',   '2024-01-15'),
  (2, 'doc_002', 1, 2, 'W-9 Tax Form',                       'tax_document',        'completed','2024-01-16'),
  (3, 'doc_003', 1, 3, 'Stock Option Agreement - Carol',     'equity_plan_contract','unsigned', NULL);

-- Equity
INSERT INTO share_classes (id, company_id, name, original_issue_price_usd, preferred) VALUES
  (1, 1, 'Common',      0.01, 0),
  (2, 1, 'Series A',    2.50, 1);

INSERT INTO equity_grants (id, external_id, company_investor_id, name, number_of_shares, vested_shares, exercise_price_usd, issued_at) VALUES
  (1, 'grt_001', 1, 'GRANT-2024-A', 500000, 125000, 0.50, '2024-01-01');

INSERT INTO dividend_rounds (id, external_id, company_id, issued_at, total_amount_cents, status) VALUES
  (1, 'drd_001', 1, '2024-04-01', 5000000, 'issued');

INSERT INTO dividends (id, external_id, dividend_round_id, company_investor_id, amount_cents, status) VALUES
  (1, 'div_001', 1, 1, 5000000, 'paid');
