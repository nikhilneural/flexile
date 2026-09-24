import dotenv from "dotenv";
import pg from "pg";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: "apps/next/.env.local" });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("BEGIN");

  // 1. User
  await client.query(`
    INSERT INTO users (id, email, encrypted_password, clerk_id, external_id, legal_name, preferred_name, street_address, city, state, zip_code, country_code, citizenship_country_code, signed_documents, team_member, sent_invalid_tax_id_email, inviting_company, created_at, updated_at)
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET clerk_id = EXCLUDED.clerk_id, email = EXCLUDED.email
  `, [
    "nikhiltestingemail@gmail.com",
    "",
    "user_3JjorfZ7Dwgk7PAwyjhDubP9PFn",
    "user_3JjorfZ7Dwgk7PAwyjhDubP9PFn",
    "Nikhil Testing",
    "Nikhil",
    "123 Market St",
    "San Francisco",
    "CA",
    "94105",
    "US",
    "US",
    true,
    false,
    false,
    false
  ]);

  // 2. Company
  await client.query(`
    INSERT INTO companies (id, external_id, name, email, street_address, city, state, zip_code, country_code, is_trusted, expense_cards_enabled, required_invoice_approval_count, created_at, updated_at)
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, external_id = EXCLUDED.external_id
  `, [
    "1",
    "FillanadPay Inc.",
    "billing@fillanadpay.com",
    "123 Market St",
    "San Francisco",
    "CA",
    "94105",
    "US",
    true,
    true,
    1
  ]);

  // 3. Company Administrator
  await client.query(`
    INSERT INTO company_administrators (id, company_id, user_id, external_id, created_at, updated_at)
    VALUES (1, 1, 1, $1, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, ["admin_1"]);

  // 4. Company Role
  await client.query(`
    INSERT INTO company_roles (id, company_id, name, job_description, external_id, created_at, updated_at)
    VALUES (1, 1, $1, $2, $3, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, ["Full Stack Engineer", "Software Engineering Role", "role_1"]);

  // 5. Company Contractor
  await client.query(`
    INSERT INTO company_contractors (id, company_id, user_id, company_role_id, external_id, started_at, pay_rate_type, pay_rate_in_subunits, hours_per_week, created_at, updated_at)
    VALUES (1, 1, 1, 1, $1, NOW(), 0, 10000, 40, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, ["worker_1"]);

  // 6. User Compliance Info
  await client.query(`
    INSERT INTO user_compliance_infos (id, user_id, citizenship_country_code, tax_id, tax_information_confirmed_at, created_at, updated_at)
    VALUES (1, 1, 'US', '123456789', NOW(), NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // 7. TOS Agreement
  await client.query(`
    INSERT INTO tos_agreements (id, user_id, ip_address, created_at, updated_at)
    VALUES (1, 1, '127.0.0.1', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `);

  // 8. Demo Invoices
  await client.query(`
    INSERT INTO invoices (id, user_id, company_id, created_by_id, company_contractor_id, invoice_number, invoice_type, invoice_date, due_on, status, bill_from, bill_to, total_amount_in_usd_cents, cash_amount_in_cents, equity_percentage, equity_amount_in_cents, equity_amount_in_options, external_id, created_at, updated_at)
    VALUES 
    (1, 1, 1, 1, 1, $1, $2, $3, $4, $5, $6, $7, 800000, 800000, 0, 0, 0, $8, NOW(), NOW()),
    (2, 1, 1, 1, 1, $9, $10, $11, $12, $13, $14, $15, 800000, 800000, 0, 0, 0, $16, NOW(), NOW()),
    (3, 1, 1, 1, 1, $17, $18, $19, $20, $21, $22, $23, 800000, 800000, 0, 0, 0, $24, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `, [
    "INV-001", "services", "2026-09-01", "2026-09-15", "paid", "Nikhil Testing", "FillanadPay Inc.", "inv_1",
    "INV-002", "services", "2026-09-15", "2026-09-30", "approved", "Nikhil Testing", "FillanadPay Inc.", "inv_2",
    "INV-003", "services", "2026-09-24", "2026-10-08", "received", "Nikhil Testing", "FillanadPay Inc.", "inv_3"
  ]);

  // Reset sequences
  await client.query('SELECT setval(\'users_id_seq\', (SELECT COALESCE(MAX(id), 1) FROM users))');
  await client.query('SELECT setval(\'companies_id_seq\', (SELECT COALESCE(MAX(id), 1) FROM companies))');
  await client.query('SELECT setval(\'company_administrators_id_seq\', (SELECT COALESCE(MAX(id), 1) FROM company_administrators))');
  await client.query('SELECT setval(\'company_roles_id_seq\', (SELECT COALESCE(MAX(id), 1) FROM company_roles))');
  await client.query('SELECT setval(\'company_contractors_id_seq\', (SELECT COALESCE(MAX(id), 1) FROM company_contractors))');
  await client.query('SELECT setval(\'invoices_id_seq\', (SELECT COALESCE(MAX(id), 1) FROM invoices))');

  await client.query("COMMIT");
  console.log("Seeding completed successfully!");
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Seeding failed:", err);
} finally {
  await client.end();
}
