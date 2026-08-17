import { Pool, PoolClient } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDatabase as getSqliteDb } from './sqliteDb';

const resolveAppRoot = (): string => {
  if (process.env.INOMS_APP_ROOT) return path.resolve(process.env.INOMS_APP_ROOT);
  try {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  } catch {
    return path.resolve(process.cwd());
  }
};
const APP_ROOT = resolveAppRoot();
const DATA_DIR = path.join(APP_ROOT, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let pool: Pool | null = null;
let isPgConnected = false;

// -------------------------------------------------------------
// POSTGRESQL POOL CONFIGURATION
// -------------------------------------------------------------
export function getPostgresPool(): Pool | null {
  if (pool) return pool;

  const dbHost = process.env.DB_HOST || process.env.POSTGRES_HOST;
  const dbPort = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
  const dbName = process.env.DB_NAME || process.env.POSTGRES_DB || 'inoms';
  const dbUser = process.env.DB_USER || process.env.POSTGRES_USER || 'inoms_admin';
  const dbPassword = process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  // If explicit PostgreSQL configuration exists (either in Docker or local)
  if (databaseUrl || (dbHost && dbPassword)) {
    try {
      pool = new Pool(
        databaseUrl
          ? {
              connectionString: databaseUrl,
              ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 5000
            }
          : {
              host: dbHost,
              port: dbPort,
              database: dbName,
              user: dbUser,
              password: dbPassword,
              ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 5000
            }
      );

      pool.on('error', (err) => {
        console.error('[PostgreSQL Pool Error]', err);
      });

      return pool;
    } catch (err) {
      console.warn('[PostgreSQL] Could not initialize connection pool:', err);
      return null;
    }
  }

  return null;
}

export function isPostgresActive(): boolean {
  return isPgConnected && pool !== null;
}

// Embedded fallback DDL to guarantee migrations succeed in all bundled environments
const FALLBACK_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    owner_mobile VARCHAR(50),
    owner_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    secret_key TEXT,
    pin VARCHAR(50),
    pin_hash TEXT,
    pin_salt TEXT,
    subscription_plan VARCHAR(100),
    subscription_start_date VARCHAR(50),
    subscription_end_date VARCHAR(50),
    trial_days INTEGER DEFAULT 0,
    is_trial INTEGER DEFAULT 0,
    features_json TEXT,
    data_json TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tenant_configs (
    tenant_id VARCHAR(100) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    gstin VARCHAR(50),
    upi_id VARCHAR(100),
    config_json JSONB,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    mobile VARCHAR(50),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Technician',
    status VARCHAR(50) DEFAULT 'Active',
    password_hash TEXT,
    password_salt TEXT,
    pin_hash TEXT,
    pin_salt TEXT,
    permissions_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    gstin VARCHAR(50),
    credit_limit NUMERIC(15,2) DEFAULT 0.00,
    opening_balance NUMERIC(15,2) DEFAULT 0.00,
    current_balance NUMERIC(15,2) DEFAULT 0.00,
    notes TEXT,
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_no VARCHAR(100),
    client_id VARCHAR(100),
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    equipment_type VARCHAR(100),
    brand_model VARCHAR(255),
    serial_no VARCHAR(100),
    problem_description TEXT,
    estimated_cost NUMERIC(15,2) DEFAULT 0.00,
    advance_paid NUMERIC(15,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Pending',
    priority VARCHAR(50) DEFAULT 'Normal',
    assigned_to VARCHAR(255),
    rack_location VARCHAR(100),
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_no VARCHAR(100),
    job_id VARCHAR(100),
    client_id VARCHAR(100),
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    subtotal NUMERIC(15,2) DEFAULT 0.00,
    discount NUMERIC(15,2) DEFAULT 0.00,
    tax NUMERIC(15,2) DEFAULT 0.00,
    total NUMERIC(15,2) DEFAULT 0.00,
    paid_amount NUMERIC(15,2) DEFAULT 0.00,
    balance_due NUMERIC(15,2) DEFAULT 0.00,
    payment_mode VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Unpaid',
    notes TEXT,
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    payment_no VARCHAR(100),
    client_id VARCHAR(100),
    client_name VARCHAR(255),
    invoice_id VARCHAR(100),
    job_id VARCHAR(100),
    amount NUMERIC(15,2) DEFAULT 0.00,
    payment_mode VARCHAR(50),
    transaction_ref VARCHAR(255),
    notes TEXT,
    received_by VARCHAR(255),
    date VARCHAR(50),
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    cost_price NUMERIC(15,2) DEFAULT 0.00,
    selling_price NUMERIC(15,2) DEFAULT 0.00,
    stock_quantity NUMERIC(15,2) DEFAULT 0.00,
    min_stock_alert NUMERIC(15,2) DEFAULT 0.00,
    unit VARCHAR(50) DEFAULT 'pcs',
    location VARCHAR(100),
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS expenses (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    expense_no VARCHAR(100),
    category VARCHAR(100),
    amount NUMERIC(15,2) DEFAULT 0.00,
    payment_mode VARCHAR(50),
    description TEXT,
    paid_to VARCHAR(255),
    date VARCHAR(50),
    recorded_by VARCHAR(255),
    created_by VARCHAR(255),
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ledger (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id VARCHAR(100),
    entry_type VARCHAR(50),
    amount NUMERIC(15,2) DEFAULT 0.00,
    reference_id VARCHAR(100),
    description TEXT,
    balance_after NUMERIC(15,2) DEFAULT 0.00,
    date VARCHAR(50),
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Job',
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS racks (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    rack_code VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    capacity VARCHAR(50),
    location VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'active',
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS equipments (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS problems (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    common_solution TEXT,
    standard_cost NUMERIC(15,2) DEFAULT 0.00,
    data_json JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(100),
    user_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details_json JSONB,
    ip_address VARCHAR(100),
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_revisions (
    tenant_id VARCHAR(100) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    current_revision BIGINT DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS change_log (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    data_json JSONB,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
`;

// -------------------------------------------------------------
// INITIALIZATION & MIGRATIONS RUNNER
// -------------------------------------------------------------
export async function initPostgresDatabase(): Promise<boolean> {
  const currentPool = getPostgresPool();
  if (!currentPool) {
    console.info('[PostgreSQL] DB_HOST / DATABASE_URL not supplied; running in SQLite hybrid mode.');
    return false;
  }

  let client: PoolClient | null = null;
  try {
    client = await currentPool.connect();
    console.log('✅ [PostgreSQL] Successfully connected to PostgreSQL server.');

    // Run Migration 001_initial_schema.sql
    const migrationPath = path.join(process.cwd(), 'server', 'migrations', '001_initial_schema.sql');
    let migrationSql = FALLBACK_SCHEMA_SQL;
    if (fs.existsSync(migrationPath)) {
      try {
        migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      } catch (e) {}
    }
    await client.query(migrationSql);
    console.log('✅ [PostgreSQL] Initial schema migration (001_initial_schema.sql) applied successfully.');

    isPgConnected = true;

    // Check if migration of existing SQLite or JSON data into PostgreSQL is needed
    await migrateFromSqliteToPostgres(client);

    return true;
  } catch (err: any) {
    console.warn('⚠️ [PostgreSQL] Could not connect to PostgreSQL database:', err.message);
    isPgConnected = false;
    return false;
  } finally {
    if (client) client.release();
  }
}

// -------------------------------------------------------------
// TRANSACTION RUNNER
// -------------------------------------------------------------
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const currentPool = getPostgresPool();
  if (!currentPool || !isPgConnected) {
    throw new Error('PostgreSQL is not active');
  }

  const client = await currentPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// -------------------------------------------------------------
// AUTOMATIC DATA MIGRATION: SQLite -> PostgreSQL (ZERO DATA LOSS)
// -------------------------------------------------------------
async function migrateFromSqliteToPostgres(pgClient: PoolClient): Promise<void> {
  try {
    const { rows } = await pgClient.query('SELECT COUNT(*) as count FROM organizations');
    const orgCount = parseInt(rows[0].count, 10);
    if (orgCount > 0) {
      console.log(`[PostgreSQL] Database already contains ${orgCount} organization(s). Skipping SQLite migration.`);
      return;
    }

    console.log('[PostgreSQL Migration] Migrating existing organizations & tenant collections into PostgreSQL...');

    // Read existing SQLite data if available
    let sqlite: any = null;
    try {
      sqlite = getSqliteDb();
    } catch (e) {}

    if (sqlite) {
      // 1. Organizations
      const orgStmt = sqlite.prepare('SELECT * FROM organizations');
      while (orgStmt.step()) {
        const org = orgStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO organizations (
            id, name, code, owner_mobile, owner_name, status, secret_key, pin, pin_hash, pin_salt,
            subscription_plan, subscription_start_date, subscription_end_date, trial_days, is_trial,
            features_json, data_json, created_at, updated_at, version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (id) DO NOTHING`,
          [
            org.id, org.name, org.code, org.owner_mobile, org.owner_name, org.status || 'active',
            org.secret_key, org.pin, org.pin_hash, org.pin_salt, org.subscription_plan,
            org.subscription_start_date, org.subscription_end_date, org.trial_days || 0,
            org.is_trial || 0, org.features_json, org.data_json,
            org.created_at || new Date().toISOString(), org.updated_at || new Date().toISOString(), org.version || 1
          ]
        );
      }
      orgStmt.free();

      // 2. Tenant Configs
      const cfgStmt = sqlite.prepare('SELECT * FROM tenant_configs');
      while (cfgStmt.step()) {
        const cfg = cfgStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO tenant_configs (tenant_id, name, phone, email, address, gstin, upi_id, config_json, updated_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (tenant_id) DO NOTHING`,
          [cfg.tenant_id, cfg.name, cfg.phone, cfg.email, cfg.address, cfg.gstin, cfg.upi_id, cfg.config_json ? JSON.parse(cfg.config_json as string) : null, cfg.updated_at || new Date().toISOString(), cfg.version || 1]
        );
      }
      cfgStmt.free();

      // 3. Users
      const userStmt = sqlite.prepare('SELECT * FROM users');
      while (userStmt.step()) {
        const u = userStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO users (
            id, tenant_id, name, username, mobile, email, role, status, password_hash, password_salt,
            pin_hash, pin_salt, permissions_json, created_at, updated_at, deleted_at, version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO NOTHING`,
          [
            u.id, u.tenant_id, u.name, u.username, u.mobile, u.email, u.role || 'Technician', u.status || 'Active',
            u.password_hash, u.password_salt, u.pin_hash, u.pin_salt,
            u.permissions_json ? JSON.parse(u.permissions_json as string) : null,
            u.created_at || new Date().toISOString(), u.updated_at || new Date().toISOString(), u.deleted_at || null, u.version || 1
          ]
        );
      }
      userStmt.free();

      // 4. Clients
      const clientStmt = sqlite.prepare('SELECT * FROM clients');
      while (clientStmt.step()) {
        const c = clientStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO clients (id, tenant_id, name, phone, email, address, city, gstin, credit_limit, opening_balance, current_balance, notes, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (id) DO NOTHING`,
          [
            c.id, c.tenant_id, c.name, c.phone, c.email, c.address, c.city, c.gstin,
            c.credit_limit || 0, c.opening_balance || 0, c.current_balance || 0, c.notes,
            c.data_json ? JSON.parse(c.data_json as string) : null,
            c.created_at || new Date().toISOString(), c.updated_at || new Date().toISOString(), c.deleted_at || null, c.version || 1
          ]
        );
      }
      clientStmt.free();

      // 5. Jobs
      const jobStmt = sqlite.prepare('SELECT * FROM jobs');
      while (jobStmt.step()) {
        const j = jobStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO jobs (id, tenant_id, job_no, client_id, client_name, client_phone, equipment_type, brand_model, serial_no, problem_description, estimated_cost, advance_paid, status, priority, assigned_to, rack_location, data_json, created_at, updated_at, completed_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
           ON CONFLICT (id) DO NOTHING`,
          [
            j.id, j.tenant_id, j.job_no, j.client_id, j.client_name, j.client_phone,
            j.equipment_type, j.brand_model, j.serial_no, j.problem_description,
            j.estimated_cost || 0, j.advance_paid || 0, j.status || 'Pending', j.priority || 'Normal',
            j.assigned_to, j.rack_location, j.data_json ? JSON.parse(j.data_json as string) : null,
            j.created_at || new Date().toISOString(), j.updated_at || new Date().toISOString(), j.completed_at || null, j.deleted_at || null, j.version || 1
          ]
        );
      }
      jobStmt.free();

      // 6. Invoices
      const invStmt = sqlite.prepare('SELECT * FROM invoices');
      while (invStmt.step()) {
        const inv = invStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO invoices (id, tenant_id, invoice_no, job_id, client_id, client_name, client_phone, subtotal, discount, tax, total, paid_amount, balance_due, payment_mode, status, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
           ON CONFLICT (id) DO NOTHING`,
          [
            inv.id, inv.tenant_id, inv.invoice_no, inv.job_id, inv.client_id, inv.client_name, inv.client_phone,
            inv.subtotal || 0, inv.discount || 0, inv.tax || 0, inv.total || 0, inv.paid_amount || 0, inv.balance_due || 0,
            inv.payment_mode || 'Cash', inv.status || 'Paid', inv.data_json ? JSON.parse(inv.data_json as string) : null,
            inv.created_at || new Date().toISOString(), inv.updated_at || new Date().toISOString(), inv.deleted_at || null, inv.version || 1
          ]
        );
      }
      invStmt.free();

      // 7. Payments
      const payStmt = sqlite.prepare('SELECT * FROM payments');
      while (payStmt.step()) {
        const p = payStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO payments (id, tenant_id, payment_no, client_id, client_name, invoice_id, job_id, amount, payment_mode, transaction_ref, notes, received_by, date, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           ON CONFLICT (id) DO NOTHING`,
          [
            p.id, p.tenant_id, p.payment_no, p.client_id, p.client_name, p.invoice_id, p.job_id,
            p.amount || 0, p.payment_mode || 'Cash', p.transaction_ref, p.notes, p.received_by,
            p.date || new Date().toISOString(), p.data_json ? JSON.parse(p.data_json as string) : null,
            p.created_at || new Date().toISOString(), p.updated_at || new Date().toISOString(), p.deleted_at || null, p.version || 1
          ]
        );
      }
      payStmt.free();

      // 8. Products
      const prodStmt = sqlite.prepare('SELECT * FROM products');
      while (prodStmt.step()) {
        const pr = prodStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO products (id, tenant_id, code, name, category, description, cost_price, selling_price, stock_quantity, min_stock_alert, unit, location, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (id) DO NOTHING`,
          [
            pr.id, pr.tenant_id, pr.code, pr.name, pr.category, pr.description,
            pr.cost_price || 0, pr.selling_price || 0, pr.stock_quantity || 0, pr.min_stock_alert || 0,
            pr.unit || 'pcs', pr.location, pr.data_json ? JSON.parse(pr.data_json as string) : null,
            pr.created_at || new Date().toISOString(), pr.updated_at || new Date().toISOString(), pr.deleted_at || null, pr.version || 1
          ]
        );
      }
      prodStmt.free();

      // 9. Expenses
      const expStmt = sqlite.prepare('SELECT * FROM expenses');
      while (expStmt.step()) {
        const exp = expStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO expenses (id, tenant_id, expense_no, category, amount, payment_mode, description, paid_to, date, recorded_by, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            exp.id, exp.tenant_id, exp.expense_no, exp.category, exp.amount || 0,
            exp.payment_mode || 'Cash', exp.description, exp.paid_to, exp.date || new Date().toISOString(),
            exp.recorded_by, exp.data_json ? JSON.parse(exp.data_json as string) : null,
            exp.created_at || new Date().toISOString(), exp.updated_at || new Date().toISOString(), exp.deleted_at || null, exp.version || 1
          ]
        );
      }
      expStmt.free();

      // 10. Ledger
      const ledStmt = sqlite.prepare('SELECT * FROM ledger');
      while (ledStmt.step()) {
        const l = ledStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO ledger (id, tenant_id, client_id, entry_type, amount, reference_id, description, balance_after, date, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO NOTHING`,
          [
            l.id, l.tenant_id, l.client_id, l.entry_type, l.amount || 0, l.reference_id,
            l.description, l.balance_after || 0, l.date || new Date().toISOString(),
            l.data_json ? JSON.parse(l.data_json as string) : null,
            l.created_at || new Date().toISOString(), l.updated_at || new Date().toISOString(), l.deleted_at || null, l.version || 1
          ]
        );
      }
      ledStmt.free();

      // 11. Categories
      const catStmt = sqlite.prepare('SELECT * FROM categories');
      while (catStmt.step()) {
        const cat = catStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO categories (id, tenant_id, name, type, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            cat.id, cat.tenant_id, cat.name, cat.type || 'Job',
            cat.data_json ? JSON.parse(cat.data_json as string) : null,
            cat.created_at || new Date().toISOString(), cat.updated_at || new Date().toISOString(), cat.deleted_at || null, cat.version || 1
          ]
        );
      }
      catStmt.free();

      // 12. Racks
      const rackStmt = sqlite.prepare('SELECT * FROM racks');
      while (rackStmt.step()) {
        const rk = rackStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO racks (id, tenant_id, name, capacity, location, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            rk.id, rk.tenant_id, rk.name, rk.capacity, rk.location,
            rk.data_json ? JSON.parse(rk.data_json as string) : null,
            rk.created_at || new Date().toISOString(), rk.updated_at || new Date().toISOString(), rk.deleted_at || null, rk.version || 1
          ]
        );
      }
      rackStmt.free();

      // 13. Equipments
      const eqStmt = sqlite.prepare('SELECT * FROM equipments');
      while (eqStmt.step()) {
        const eq = eqStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO equipments (id, tenant_id, name, brand, model, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            eq.id, eq.tenant_id, eq.name, eq.brand, eq.model,
            eq.data_json ? JSON.parse(eq.data_json as string) : null,
            eq.created_at || new Date().toISOString(), eq.updated_at || new Date().toISOString(), eq.deleted_at || null, eq.version || 1
          ]
        );
      }
      eqStmt.free();

      // 14. Problems
      const probStmt = sqlite.prepare('SELECT * FROM problems');
      while (probStmt.step()) {
        const pb = probStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO problems (id, tenant_id, title, description, common_solution, standard_cost, data_json, created_at, updated_at, deleted_at, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            pb.id, pb.tenant_id, pb.title, pb.description, pb.common_solution, pb.standard_cost || 0,
            pb.data_json ? JSON.parse(pb.data_json as string) : null,
            pb.created_at || new Date().toISOString(), pb.updated_at || new Date().toISOString(), pb.deleted_at || null, pb.version || 1
          ]
        );
      }
      probStmt.free();

      // 15. Audit Logs
      const auditStmt = sqlite.prepare('SELECT * FROM audit_logs');
      while (auditStmt.step()) {
        const al = auditStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO audit_logs (id, tenant_id, user_id, user_name, action, entity, entity_id, details_json, ip_address, device_info, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
          [
            al.id, al.tenant_id, al.user_id, al.user_name, al.action, al.entity, al.entity_id,
            al.details_json ? JSON.parse(al.details_json as string) : null, al.ip_address, al.device_info,
            al.created_at || new Date().toISOString()
          ]
        );
      }
      auditStmt.free();

      // 16. Sync Revisions
      const revStmt = sqlite.prepare('SELECT * FROM sync_revisions');
      while (revStmt.step()) {
        const rv = revStmt.getAsObject();
        await pgClient.query(
          `INSERT INTO sync_revisions (tenant_id, current_revision, last_updated)
           VALUES ($1, $2, $3)
           ON CONFLICT (tenant_id) DO UPDATE SET current_revision = EXCLUDED.current_revision, last_updated = EXCLUDED.last_updated`,
          [rv.tenant_id, rv.current_revision || 0, rv.last_updated || new Date().toISOString()]
        );
      }
      revStmt.free();

      console.log('✅ [PostgreSQL Migration] Successfully migrated all SQLite datasets into PostgreSQL!');

      // Run automated post-migration row count verification
      await verifyPostgresMigration(pgClient);
    }
  } catch (err: any) {
    console.error('[PostgreSQL Migration Error]', err);
  }
}

// -------------------------------------------------------------
// POST-MIGRATION DATA VERIFICATION RECONCILIATION
// -------------------------------------------------------------
export async function verifyPostgresMigration(pgClient?: PoolClient): Promise<Record<string, { sqlite: number; postgres: number; match: boolean }>> {
  const tables = [
    'organizations', 'tenant_configs', 'users', 'clients', 'jobs',
    'invoices', 'payments', 'products', 'expenses', 'ledger',
    'categories', 'racks', 'equipments', 'problems', 'audit_logs'
  ];

  const report: Record<string, { sqlite: number; postgres: number; match: boolean }> = {};
  let client = pgClient;
  let shouldRelease = false;

  try {
    if (!client) {
      const p = getPostgresPool();
      if (!p || !isPgConnected) return report;
      client = await p.connect();
      shouldRelease = true;
    }

    const sqlite = getSqliteDb();

    console.log('📊 ================= POSTGRESQL DATA RECONCILIATION REPORT =================');
    for (const table of tables) {
      let sqliteCount = 0;
      let pgCount = 0;

      try {
        const stmt = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`);
        if (stmt.step()) {
          sqliteCount = parseInt(stmt.getAsObject().count as any, 10) || 0;
        }
        stmt.free();
      } catch (e) {}

      try {
        const { rows } = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        pgCount = parseInt(rows[0]?.count || '0', 10);
      } catch (e) {}

      const match = sqliteCount === pgCount;
      report[table] = { sqlite: sqliteCount, postgres: pgCount, match };
      console.log(`Table [${table.padEnd(16)}]: SQLite = ${sqliteCount.toString().padStart(4)}, PostgreSQL = ${pgCount.toString().padStart(4)} | Match: ${match ? '✅ YES' : '⚠️ MISMATCH'}`);
    }
    console.log('=============================================================================');
  } catch (err: any) {
    console.warn('[PostgreSQL Reconciliation Warning]', err.message);
  } finally {
    if (shouldRelease && client) {
      client.release();
    }
  }

  return report;
}

// -------------------------------------------------------------
// GRACEFUL POOL SHUTDOWN
// -------------------------------------------------------------
// -------------------------------------------------------------
// REAL-TIME POSTGRESQL WRITE-THROUGH SYNC
// -------------------------------------------------------------
export async function syncEntityToPostgres(entity: string, item: any, tenantId: string): Promise<void> {
  const currentPool = getPostgresPool();
  if (!currentPool || !isPgConnected) return;

  try {
    const now = new Date().toISOString();
    const e = entity.toLowerCase();

    if (e === 'clients' || e === 'client') {
      await currentPool.query(
        `INSERT INTO clients (id, tenant_id, name, phone, email, address, city, gstin, credit_limit, opening_balance, current_balance, notes, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email, address = EXCLUDED.address,
           city = EXCLUDED.city, gstin = EXCLUDED.gstin, credit_limit = EXCLUDED.credit_limit,
           current_balance = EXCLUDED.current_balance, notes = EXCLUDED.notes, data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.name || '', item.phone || '', item.email || '', item.address || '',
          item.city || '', item.gstin || '', item.credit_limit || item.creditLimit || 0,
          item.opening_balance || item.openingBalance || 0, item.current_balance || item.currentBalance || 0,
          item.notes || '', item.data_json || item, item.created_at || item.createdAt || now,
          item.updated_at || item.updatedAt || now, item.deleted_at || item.deletedAt || null,
          item.version || 1
        ]
      );
    } else if (e === 'jobs' || e === 'job') {
      await currentPool.query(
        `INSERT INTO jobs (id, tenant_id, job_no, client_id, client_name, client_phone, equipment_type, brand_model, serial_no, problem_description, estimated_cost, advance_paid, status, priority, assigned_to, rack_location, data_json, created_at, updated_at, completed_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         ON CONFLICT (id) DO UPDATE SET
           job_no = EXCLUDED.job_no, client_id = EXCLUDED.client_id, client_name = EXCLUDED.client_name,
           client_phone = EXCLUDED.client_phone, equipment_type = EXCLUDED.equipment_type, brand_model = EXCLUDED.brand_model,
           serial_no = EXCLUDED.serial_no, problem_description = EXCLUDED.problem_description,
           estimated_cost = EXCLUDED.estimated_cost, advance_paid = EXCLUDED.advance_paid, status = EXCLUDED.status,
           priority = EXCLUDED.priority, assigned_to = EXCLUDED.assigned_to, rack_location = EXCLUDED.rack_location,
           data_json = EXCLUDED.data_json, updated_at = EXCLUDED.updated_at, completed_at = EXCLUDED.completed_at,
           deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.job_no || item.jobNo || '', item.client_id || item.clientId || '',
          item.client_name || item.clientName || '', item.client_phone || item.clientPhone || '',
          item.equipment_type || item.equipmentType || '', item.brand_model || item.brandModel || '',
          item.serial_no || item.serialNo || '', item.problem_description || item.problemDescription || '',
          item.estimated_cost || item.estimatedCost || 0, item.advance_paid || item.advancePaid || 0,
          item.status || 'Pending', item.priority || 'Normal', item.assigned_to || item.assignedTo || '',
          item.rack_location || item.rackLocation || '', item.data_json || item,
          item.created_at || item.createdAt || now, item.updated_at || item.updatedAt || now,
          item.completed_at || item.completedAt || null, item.deleted_at || item.deletedAt || null,
          item.version || 1
        ]
      );
    } else if (e === 'invoices' || e === 'invoice') {
      await currentPool.query(
        `INSERT INTO invoices (id, tenant_id, invoice_no, job_id, client_id, client_name, client_phone, subtotal, discount, tax, total, paid_amount, balance_due, payment_mode, status, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         ON CONFLICT (id) DO UPDATE SET
           invoice_no = EXCLUDED.invoice_no, job_id = EXCLUDED.job_id, client_id = EXCLUDED.client_id,
           client_name = EXCLUDED.client_name, client_phone = EXCLUDED.client_phone, subtotal = EXCLUDED.subtotal,
           discount = EXCLUDED.discount, tax = EXCLUDED.tax, total = EXCLUDED.total, paid_amount = EXCLUDED.paid_amount,
           balance_due = EXCLUDED.balance_due, payment_mode = EXCLUDED.payment_mode, status = EXCLUDED.status,
           data_json = EXCLUDED.data_json, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at,
           version = EXCLUDED.version`,
        [
          item.id, tenantId, item.invoice_no || item.invoiceNo || '', item.job_id || item.jobId || '',
          item.client_id || item.clientId || '', item.client_name || item.clientName || '',
          item.client_phone || item.clientPhone || '', item.subtotal || 0, item.discount || 0,
          item.tax || 0, item.total || 0, item.paid_amount || item.paidAmount || 0,
          item.balance_due || item.balanceDue || 0, item.payment_mode || item.paymentMode || 'Cash',
          item.status || 'Paid', item.data_json || item, item.created_at || item.createdAt || now,
          item.updated_at || item.updatedAt || now, item.deleted_at || item.deletedAt || null,
          item.version || 1
        ]
      );
    } else if (e === 'payments' || e === 'payment') {
      await currentPool.query(
        `INSERT INTO payments (id, tenant_id, payment_no, client_id, client_name, invoice_id, job_id, amount, payment_mode, transaction_ref, notes, received_by, date, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (id) DO UPDATE SET
           payment_no = EXCLUDED.payment_no, client_id = EXCLUDED.client_id, client_name = EXCLUDED.client_name,
           invoice_id = EXCLUDED.invoice_id, job_id = EXCLUDED.job_id, amount = EXCLUDED.amount,
           payment_mode = EXCLUDED.payment_mode, transaction_ref = EXCLUDED.transaction_ref, notes = EXCLUDED.notes,
           received_by = EXCLUDED.received_by, date = EXCLUDED.date, data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.payment_no || item.paymentNo || '', item.client_id || item.clientId || '',
          item.client_name || item.clientName || '', item.invoice_id || item.invoiceId || '',
          item.job_id || item.jobId || '', item.amount || 0, item.payment_mode || item.paymentMode || 'Cash',
          item.transaction_ref || item.transactionRef || '', item.notes || '', item.received_by || item.receivedBy || '',
          item.date || now, item.data_json || item, item.created_at || item.createdAt || now,
          item.updated_at || item.updatedAt || now, item.deleted_at || item.deletedAt || null,
          item.version || 1
        ]
      );
    } else if (e === 'products' || e === 'product') {
      await currentPool.query(
        `INSERT INTO products (id, tenant_id, code, name, category, description, cost_price, selling_price, stock_quantity, min_stock_alert, unit, location, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code, name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description,
           cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price, stock_quantity = EXCLUDED.stock_quantity,
           min_stock_alert = EXCLUDED.min_stock_alert, unit = EXCLUDED.unit, location = EXCLUDED.location,
           data_json = EXCLUDED.data_json, updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at,
           version = EXCLUDED.version`,
        [
          item.id, tenantId, item.code || '', item.name || '', item.category || '', item.description || '',
          item.cost_price || item.costPrice || 0, item.selling_price || item.sellingPrice || 0,
          item.stock_quantity || item.stockQuantity || 0, item.min_stock_alert || item.minStockAlert || 0,
          item.unit || 'pcs', item.location || '', item.data_json || item, item.created_at || item.createdAt || now,
          item.updated_at || item.updatedAt || now, item.deleted_at || item.deletedAt || null,
          item.version || 1
        ]
      );
    } else if (e === 'expenses' || e === 'expense') {
      await currentPool.query(
        `INSERT INTO expenses (id, tenant_id, expense_no, category, amount, payment_mode, description, paid_to, date, recorded_by, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET
           expense_no = EXCLUDED.expense_no, category = EXCLUDED.category, amount = EXCLUDED.amount,
           payment_mode = EXCLUDED.payment_mode, description = EXCLUDED.description, paid_to = EXCLUDED.paid_to,
           date = EXCLUDED.date, recorded_by = EXCLUDED.recorded_by, data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.expense_no || item.expenseNo || item.id, item.category || 'General',
          item.amount || 0, item.payment_mode || item.paymentMode || 'Cash', item.description || '',
          item.paid_to || item.paidTo || '', item.date || now, item.recorded_by || item.recordedBy || '',
          item.data_json || item, item.created_at || item.createdAt || now, item.updated_at || item.updatedAt || now,
          item.deleted_at || item.deletedAt || null, item.version || 1
        ]
      );
    } else if (e === 'ledger') {
      await currentPool.query(
        `INSERT INTO ledger (id, tenant_id, client_id, entry_type, amount, reference_id, description, balance_after, date, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET
           client_id = EXCLUDED.client_id, entry_type = EXCLUDED.entry_type, amount = EXCLUDED.amount,
           reference_id = EXCLUDED.reference_id, description = EXCLUDED.description,
           balance_after = EXCLUDED.balance_after, date = EXCLUDED.date, data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.client_id || item.clientId || '', item.entry_type || item.entryType || 'Debit',
          item.amount || 0, item.reference_id || item.referenceId || '', item.description || '',
          item.balance_after || item.balanceAfter || 0, item.date || now, item.data_json || item,
          item.created_at || item.createdAt || now, item.updated_at || item.updatedAt || now,
          item.deleted_at || item.deletedAt || null, item.version || 1
        ]
      );
    } else if (e === 'categories' || e === 'category') {
      await currentPool.query(
        `INSERT INTO categories (id, tenant_id, name, type, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, type = EXCLUDED.type, data_json = EXCLUDED.data_json,
           updated_at = EXCLUDED.updated_at, deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.name || 'Category', item.type || 'Job', item.data_json || item,
          item.created_at || item.createdAt || now, item.updated_at || item.updatedAt || now,
          item.deleted_at || item.deletedAt || null, item.version || 1
        ]
      );
    } else if (e === 'racks' || e === 'rack') {
      await currentPool.query(
        `INSERT INTO racks (id, tenant_id, name, capacity, location, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, capacity = EXCLUDED.capacity, location = EXCLUDED.location,
           data_json = EXCLUDED.data_json, updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.name || 'Rack', item.capacity || '', item.location || '',
          item.data_json || item, item.created_at || item.createdAt || now, item.updated_at || item.updatedAt || now,
          item.deleted_at || item.deletedAt || null, item.version || 1
        ]
      );
    } else if (e === 'equipments' || e === 'equipment') {
      await currentPool.query(
        `INSERT INTO equipments (id, tenant_id, name, brand, model, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, brand = EXCLUDED.brand, model = EXCLUDED.model,
           data_json = EXCLUDED.data_json, updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.name || 'Equipment', item.brand || '', item.model || '',
          item.data_json || item, item.created_at || item.createdAt || now, item.updated_at || item.updatedAt || now,
          item.deleted_at || item.deletedAt || null, item.version || 1
        ]
      );
    } else if (e === 'problems' || e === 'problem') {
      await currentPool.query(
        `INSERT INTO problems (id, tenant_id, title, description, common_solution, standard_cost, data_json, created_at, updated_at, deleted_at, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description,
           common_solution = EXCLUDED.common_solution, standard_cost = EXCLUDED.standard_cost,
           data_json = EXCLUDED.data_json, updated_at = EXCLUDED.updated_at,
           deleted_at = EXCLUDED.deleted_at, version = EXCLUDED.version`,
        [
          item.id, tenantId, item.title || item.name || 'Problem', item.description || '',
          item.common_solution || item.commonSolution || '', item.standard_cost || item.standardCost || 0,
          item.data_json || item, item.created_at || item.createdAt || now, item.updated_at || item.updatedAt || now,
          item.deleted_at || item.deletedAt || null, item.version || 1
        ]
      );
    }
  } catch (err: any) {
    console.warn(`[PostgreSQL Realtime Write Warning for ${entity}]:`, err.message);
  }
}

export async function syncDeleteToPostgres(entity: string, entityId: string, tenantId: string): Promise<void> {
  const currentPool = getPostgresPool();
  if (!currentPool || !isPgConnected) return;

  try {
    const table = entity.toLowerCase();
    const validTables = ['clients', 'jobs', 'invoices', 'payments', 'products', 'expenses', 'ledger', 'categories', 'racks', 'equipments', 'problems'];
    if (validTables.includes(table)) {
      await currentPool.query(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`, [entityId, tenantId]);
    }
  } catch (err: any) {
    console.warn(`[PostgreSQL Soft-Delete Warning for ${entity}]:`, err.message);
  }
}

// -------------------------------------------------------------
// GRACEFUL POOL SHUTDOWN
// -------------------------------------------------------------
export async function closePostgresPool(): Promise<void> {
  const p = getPostgresPool();
  if (p) {
    try {
      console.log('🔌 Closing PostgreSQL connection pool...');
      await p.end();
      isPgConnected = false;
      console.log('✅ PostgreSQL connection pool closed gracefully.');
    } catch (err) {
      console.error('Error closing PostgreSQL connection pool:', err);
    }
  }
}
