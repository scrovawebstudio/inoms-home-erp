import path from 'path';
import fs from 'fs';
import initSqlJs, { Database } from 'sql.js';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const DB_PATH = path.join(DATA_DIR, 'inoms_primary.db');
const LEGACY_JSON_PATH = path.join(DATA_DIR, 'inoms_db.json');

let db: Database | null = null;
let SQL: any = null;
let saveScheduled = false;

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Password hashing utility with random salt (PBKDF2)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, actualSalt, 10000, 32, 'sha256').toString('hex');
  return { hash: derivedKey, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;
  const { hash: computedHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'));
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Persist the in-memory SQLite database to disk binary file atomically
export function persistDatabase(): void {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const tempPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, DB_PATH);
  } catch (err) {
    console.error('[SQLite] Error writing database to disk:', err);
  }
}

export function scheduleDbSave(): void {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    persistDatabase();
  }, 100);
}

// Initialize SQLite Database and create relational tables
export async function initDatabase(): Promise<Database> {
  if (db) return db;

  SQL = await initSqlJs();

  let fileBuffer: Buffer | null = null;
  if (fs.existsSync(DB_PATH)) {
    try {
      fileBuffer = fs.readFileSync(DB_PATH);
      console.log(`[SQLite] Loaded existing primary database from ${DB_PATH} (${fileBuffer.length} bytes)`);
    } catch (err) {
      console.error('[SQLite] Error reading database file, starting fresh:', err);
    }
  }

  db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Create core schema tables
  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      owner_mobile TEXT,
      owner_name TEXT,
      status TEXT DEFAULT 'active',
      secret_key TEXT,
      pin TEXT,
      pin_hash TEXT,
      pin_salt TEXT,
      subscription_plan TEXT,
      subscription_start_date TEXT,
      subscription_end_date TEXT,
      trial_days INTEGER DEFAULT 0,
      is_trial INTEGER DEFAULT 0,
      features_json TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tenant_configs (
      tenant_id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      gstin TEXT,
      upi_id TEXT,
      config_json TEXT,
      updated_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      username TEXT,
      mobile TEXT,
      email TEXT,
      role TEXT DEFAULT 'Technician',
      status TEXT DEFAULT 'Active',
      password_hash TEXT,
      password_salt TEXT,
      pin_hash TEXT,
      pin_salt TEXT,
      permissions_json TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      device_info TEXT,
      created_at TEXT,
      expires_at TEXT,
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      gstin TEXT,
      credit_limit REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      notes TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      job_no TEXT,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      equipment_type TEXT,
      brand_model TEXT,
      serial_no TEXT,
      problem_description TEXT,
      estimated_cost REAL DEFAULT 0,
      advance_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'Pending',
      priority TEXT DEFAULT 'Normal',
      assigned_to TEXT,
      rack_location TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      invoice_no TEXT,
      job_id TEXT,
      client_id TEXT,
      client_name TEXT,
      client_phone TEXT,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      payment_mode TEXT,
      status TEXT DEFAULT 'Unpaid',
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      payment_no TEXT,
      client_id TEXT,
      client_name TEXT,
      invoice_id TEXT,
      job_id TEXT,
      amount REAL DEFAULT 0,
      payment_mode TEXT,
      transaction_ref TEXT,
      notes TEXT,
      received_by TEXT,
      date TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      code TEXT,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      stock_quantity REAL DEFAULT 0,
      min_stock_alert REAL DEFAULT 0,
      unit TEXT,
      location TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      expense_no TEXT,
      category TEXT,
      amount REAL DEFAULT 0,
      payment_mode TEXT,
      description TEXT,
      paid_to TEXT,
      date TEXT,
      recorded_by TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      client_id TEXT,
      entry_type TEXT,
      amount REAL DEFAULT 0,
      reference_id TEXT,
      description TEXT,
      balance_after REAL DEFAULT 0,
      date TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS racks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      capacity TEXT,
      location TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS equipments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      title TEXT,
      name TEXT,
      description TEXT,
      common_solution TEXT,
      standard_cost REAL DEFAULT 0,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      device_info TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_revisions (
      tenant_id TEXT PRIMARY KEY,
      current_revision INTEGER DEFAULT 0,
      last_updated TEXT
    );

    CREATE TABLE IF NOT EXISTS change_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL, -- 'create', 'update', 'delete'
      data_json TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_change_log_rev ON change_log(tenant_id, revision);
    CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
  `);

  persistDatabase();

  // Ensure any newer columns exist on existing databases
  try {
    const orgCols = ['pin', 'subscription_plan', 'subscription_start_date', 'subscription_end_date', 'trial_days', 'is_trial', 'features_json', 'data_json'];
    for (const col of orgCols) {
      try {
        db.run(`ALTER TABLE organizations ADD COLUMN ${col} TEXT;`);
      } catch (e) {}
    }

    const userCols = ['data_json', 'permissions_json', 'email', 'mobile'];
    for (const col of userCols) {
      try {
        db.run(`ALTER TABLE users ADD COLUMN ${col} TEXT;`);
      } catch (e) {}
    }

    const probCols = ['name', 'title', 'data_json', 'description', 'common_solution', 'standard_cost'];
    for (const col of probCols) {
      try {
        db.run(`ALTER TABLE problems ADD COLUMN ${col} TEXT;`);
      } catch (e) {}
    }

    const catCols = ['data_json', 'type'];
    for (const col of catCols) {
      try {
        db.run(`ALTER TABLE categories ADD COLUMN ${col} TEXT;`);
      } catch (e) {}
    }

    const rackCols = ['data_json', 'capacity', 'location'];
    for (const col of rackCols) {
      try {
        db.run(`ALTER TABLE racks ADD COLUMN ${col} TEXT;`);
      } catch (e) {}
    }

    const eqCols = ['data_json', 'brand', 'model'];
    for (const col of eqCols) {
      try {
        db.run(`ALTER TABLE equipments ADD COLUMN ${col} TEXT;`);
      } catch (e) {}
    }

    const otherTables = ['ledger', 'expenses', 'clients', 'jobs', 'invoices', 'payments', 'products'];
    for (const tbl of otherTables) {
      try {
        db.run(`ALTER TABLE ${tbl} ADD COLUMN data_json TEXT;`);
      } catch (e) {}
    }
  } catch (err) {}

  // Run automatic data migration from legacy JSON if database is new or needs seeding
  await migrateLegacyDataIfPresent();

  // Deduplicate any duplicate organizations created previously
  try {
    const stmt = db.prepare('SELECT id, name, code, owner_mobile, created_at FROM organizations WHERE status != "deleted" ORDER BY created_at ASC, id ASC');
    const seenMap = new Map<string, string>(); // key -> id
    const idsToDelete: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const cleanMobile = (row.owner_mobile as string || '').replace(/\D/g, '');
      const cleanName = (row.name as string || '').trim().toLowerCase();
      const dedupeKey = `${cleanName}_${cleanMobile}`;
      if (row.id === 'org-admin' || cleanMobile === '8149862034') {
        continue;
      }
      if (dedupeKey && seenMap.has(dedupeKey)) {
        idsToDelete.push(row.id as string);
      } else if (dedupeKey) {
        seenMap.set(dedupeKey, row.id as string);
      }
    }
    stmt.free();

    for (const dupId of idsToDelete) {
      db.run('DELETE FROM organizations WHERE id = ?', [dupId]);
      console.log(`[Dedupe] Cleaned up duplicate organization record: ${dupId}`);
    }
  } catch (err) {
    console.warn('[Dedupe] Error cleaning up duplicates:', err);
  }

  // Setup automated periodic backup of SQLite database file
  setupBackupScheduler();

  return db;
}

// Retrieves current server revision for a tenant and increments it atomically
export function getNextRevision(tenantId: string): number {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare('SELECT current_revision FROM sync_revisions WHERE tenant_id = ?');
  stmt.bind([tenantId]);
  let currentRev = 0;
  if (stmt.step()) {
    currentRev = stmt.getAsObject().current_revision as number || 0;
  }
  stmt.free();

  const nextRev = currentRev + 1;
  try {
    db.run(
      'INSERT OR REPLACE INTO sync_revisions (tenant_id, current_revision, last_updated) VALUES (?, ?, ?)',
      [tenantId, nextRev, new Date().toISOString()]
    );
    scheduleDbSave();
  } catch (err) {
    console.warn('[SQLite getNextRevision Error]:', err);
  }
  return nextRev;
}

export function getCurrentRevision(tenantId: string): number {
  if (!db) return 0;
  const stmt = db.prepare('SELECT current_revision FROM sync_revisions WHERE tenant_id = ?');
  stmt.bind([tenantId]);
  let currentRev = 0;
  if (stmt.step()) {
    currentRev = stmt.getAsObject().current_revision as number || 0;
  }
  stmt.free();
  return currentRev;
}

// Log audit changes safely
export function recordAuditLog(log: {
  tenantId: string;
  userId?: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
  deviceInfo?: string;
}): void {
  if (!db) return;
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    db.run(
      `INSERT INTO audit_logs (id, tenant_id, user_id, user_name, action, entity, entity_id, details_json, ip_address, device_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        log.tenantId,
        log.userId || null,
        log.userName || null,
        log.action,
        log.entity,
        log.entityId || null,
        log.details ? JSON.stringify(log.details) : null,
        log.ipAddress || null,
        log.deviceInfo || null,
        new Date().toISOString()
      ]
    );
    scheduleDbSave();
  } catch (err) {
    console.error('[AuditLog] Error recording log:', err);
  }
}

// Migrate legacy JSON data (inoms_db.json & data/orgs) to SQLite
async function migrateLegacyDataIfPresent(): Promise<void> {
  if (!db) return;

  // Check if organizations already exist in SQLite
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM organizations');
  let orgCount = 0;
  if (checkStmt.step()) {
    orgCount = checkStmt.getAsObject().count as number || 0;
  }
  checkStmt.free();

  if (orgCount > 0) {
    console.log(`[Migration] SQLite database already populated with ${orgCount} organization(s).`);
    return;
  }

  console.log('[Migration] Beginning migration of legacy JSON data to SQLite primary database...');

  let legacyDb: Record<string, any> = {};
  if (fs.existsSync(LEGACY_JSON_PATH)) {
    try {
      const content = fs.readFileSync(LEGACY_JSON_PATH, 'utf-8');
      legacyDb = JSON.parse(content);
    } catch (e) {
      console.warn('[Migration] Error reading legacy JSON:', e);
    }
  }

  // Also check individual org files in data/orgs
  const orgsDir = path.join(DATA_DIR, 'orgs');
  if (fs.existsSync(orgsDir)) {
    const folders = fs.readdirSync(orgsDir, { withFileTypes: true });
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const orgFilePath = path.join(orgsDir, folder.name, 'data.json');
        if (fs.existsSync(orgFilePath)) {
          try {
            const orgData = JSON.parse(fs.readFileSync(orgFilePath, 'utf-8'));
            legacyDb = { ...legacyDb, ...orgData };
          } catch (e) {}
        }
      }
    }
  }

  const now = new Date().toISOString();

  // 1. Migrate Tenants / Organizations
  const tenantsList = legacyDb['tenants_all'] || legacyDb['tenants'] || [];
  const orgMap = new Map<string, any>();

  if (Array.isArray(tenantsList)) {
    for (const t of tenantsList) {
      if (t && t.id) orgMap.set(t.id, t);
    }
  }

  // Scan keys like tenant_ORG...
  for (const key of Object.keys(legacyDb)) {
    if (key.startsWith('tenant_') && key !== 'tenant_configs' && key !== 'tenants_all') {
      const t = legacyDb[key];
      if (t && t.id) orgMap.set(t.id, t);
    }
  }

  // Ensure default demo organizations exist if empty
  if (orgMap.size === 0) {
    orgMap.set('org-admin', {
      id: 'org-admin',
      name: 'Master System Admin',
      code: 'ADMIN-00',
      ownerMobile: '+91 8149862034',
      ownerName: 'Master Admin',
      status: 'active',
      createdAt: '2026-01-01',
      secretKey: 'MASTERADMIN2FA37'
    });
    orgMap.set('org-1', {
      id: 'org-1',
      name: 'Apex Electronics & Mobile Care',
      code: 'APEX-01',
      ownerMobile: '9876543210',
      ownerName: 'Rahul Sharma',
      status: 'active',
      createdAt: '2026-01-15'
    });
  }

  for (const [orgId, org] of orgMap.entries()) {
    const pin = (org.pin || '1234').toString();
    const { hash: pinHash, salt: pinSalt } = hashPassword(pin);
    db.run(
      `INSERT OR REPLACE INTO organizations (id, name, code, owner_mobile, owner_name, status, secret_key, pin_hash, pin_salt, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        org.id,
        org.name || 'Organization',
        org.code || 'ORG',
        org.ownerMobile || '',
        org.ownerName || 'Owner',
        org.status || 'active',
        org.secretKey || null,
        pinHash,
        pinSalt,
        org.createdAt || now,
        now
      ]
    );

    // Initialize sync revision
    db.run(
      `INSERT OR IGNORE INTO sync_revisions (tenant_id, current_revision, last_updated) VALUES (?, 1, ?)`,
      [org.id, now]
    );
  }

  // 2. Migrate Tenant Collections
  for (const [key, value] of Object.entries(legacyDb)) {
    if (key.startsWith('col_')) {
      const parts = key.substring(4).split('_');
      if (parts.length >= 2) {
        const tenantId = parts[0];
        const colName = parts.slice(1).join('_');
        const items = value && Array.isArray(value.items) ? value.items : (Array.isArray(value) ? value : []);

        for (const item of items) {
          if (!item || !item.id) continue;
          const dataJson = JSON.stringify(item);
          const itemCreatedAt = item.createdAt || now;
          const itemUpdatedAt = item.updatedAt || now;

          switch (colName) {
            case 'clients':
              db.run(
                `INSERT OR REPLACE INTO clients (id, tenant_id, name, phone, email, address, city, gstin, credit_limit, opening_balance, current_balance, notes, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.name || 'Unknown', item.phone || null, item.email || null,
                  item.address || null, item.city || null, item.gstin || null, item.creditLimit || 0,
                  item.openingBalance || 0, item.currentBalance || 0, item.notes || null, dataJson,
                  itemCreatedAt, itemUpdatedAt
                ]
              );
              break;

            case 'jobs':
              db.run(
                `INSERT OR REPLACE INTO jobs (id, tenant_id, job_no, client_id, client_name, client_phone, equipment_type, brand_model, serial_no, problem_description, estimated_cost, advance_paid, status, priority, assigned_to, rack_location, data_json, created_at, updated_at, completed_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.jobNo || item.id, item.clientId || null, item.clientName || null,
                  item.clientPhone || null, item.equipmentType || null, item.brandModel || item.model || null,
                  item.serialNo || null, item.problemDescription || item.problem || null, item.estimatedCost || 0,
                  item.advancePaid || 0, item.status || 'Pending', item.priority || 'Normal', item.assignedTo || null,
                  item.rackLocation || null, dataJson, itemCreatedAt, itemUpdatedAt, item.completedAt || null
                ]
              );
              break;

            case 'invoices':
              db.run(
                `INSERT OR REPLACE INTO invoices (id, tenant_id, invoice_no, job_id, client_id, client_name, client_phone, subtotal, discount, tax, total, paid_amount, balance_due, payment_mode, status, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.invoiceNo || item.id, item.jobId || null, item.clientId || null,
                  item.clientName || null, item.clientPhone || null, item.subtotal || 0, item.discount || 0,
                  item.tax || 0, item.total || item.grandTotal || 0, item.paidAmount || 0, item.balanceDue || 0,
                  item.paymentMode || 'Cash', item.status || 'Paid', dataJson, itemCreatedAt, itemUpdatedAt
                ]
              );
              break;

            case 'payments':
              db.run(
                `INSERT OR REPLACE INTO payments (id, tenant_id, payment_no, client_id, client_name, invoice_id, job_id, amount, payment_mode, transaction_ref, notes, received_by, date, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.paymentNo || item.id, item.clientId || null, item.clientName || null,
                  item.invoiceId || null, item.jobId || null, item.amount || 0, item.paymentMode || 'Cash',
                  item.transactionRef || null, item.notes || null, item.receivedBy || null, item.date || itemCreatedAt,
                  dataJson, itemCreatedAt, itemUpdatedAt
                ]
              );
              break;

            case 'products':
              db.run(
                `INSERT OR REPLACE INTO products (id, tenant_id, code, name, category, description, cost_price, selling_price, stock_quantity, min_stock_alert, unit, location, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.code || item.sku || null, item.name || 'Product', item.category || null,
                  item.description || null, item.costPrice || 0, item.sellingPrice || item.price || 0,
                  item.stockQuantity || item.stock || 0, item.minStockAlert || 0, item.unit || 'pcs',
                  item.location || null, dataJson, itemCreatedAt, itemUpdatedAt
                ]
              );
              break;

            case 'expenses':
              db.run(
                `INSERT OR REPLACE INTO expenses (id, tenant_id, expense_no, category, amount, payment_mode, description, paid_to, date, recorded_by, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.expenseNo || item.id, item.category || 'General', item.amount || 0,
                  item.paymentMode || 'Cash', item.description || null, item.paidTo || null, item.date || itemCreatedAt,
                  item.recordedBy || null, dataJson, itemCreatedAt, itemUpdatedAt
                ]
              );
              break;

            case 'ledger':
              db.run(
                `INSERT OR REPLACE INTO ledger (id, tenant_id, client_id, entry_type, amount, reference_id, description, balance_after, date, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.clientId || null, item.entryType || item.type || 'Debit', item.amount || 0,
                  item.referenceId || null, item.description || null, item.balanceAfter || 0, item.date || itemCreatedAt,
                  dataJson, itemCreatedAt, itemUpdatedAt
                ]
              );
              break;

            case 'users': {
              const pass = (item.password || item.pin || '1234').toString();
              const { hash: pHash, salt: pSalt } = hashPassword(pass);
              db.run(
                `INSERT OR REPLACE INTO users (id, tenant_id, name, username, mobile, email, role, status, password_hash, password_salt, pin_hash, pin_salt, permissions_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [
                  item.id, tenantId, item.name || 'User', item.username || null, item.mobile || null,
                  item.email || null, item.role || 'Technician', item.status || 'Active', pHash, pSalt,
                  pHash, pSalt, item.permissions ? JSON.stringify(item.permissions) : null, itemCreatedAt, itemUpdatedAt
                ]
              );
              break;
            }

            case 'categories':
              db.run(
                `INSERT OR REPLACE INTO categories (id, tenant_id, name, type, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [item.id, tenantId, item.name || 'Category', item.type || 'Job', dataJson, itemCreatedAt, itemUpdatedAt]
              );
              break;

            case 'racks':
              db.run(
                `INSERT OR REPLACE INTO racks (id, tenant_id, name, capacity, location, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [item.id, tenantId, item.name || 'Rack', item.capacity || null, item.location || null, dataJson, itemCreatedAt, itemUpdatedAt]
              );
              break;

            case 'equipments':
              db.run(
                `INSERT OR REPLACE INTO equipments (id, tenant_id, name, brand, model, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [item.id, tenantId, item.name || 'Equipment', item.brand || null, item.model || null, dataJson, itemCreatedAt, itemUpdatedAt]
              );
              break;

            case 'problems':
              db.run(
                `INSERT OR REPLACE INTO problems (id, tenant_id, title, description, common_solution, standard_cost, data_json, created_at, updated_at, deleted_at, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
                [item.id, tenantId, item.title || 'Problem', item.description || null, item.commonSolution || null, item.standardCost || 0, dataJson, itemCreatedAt, itemUpdatedAt]
              );
              break;
          }
        }
      }
    }
  }

  // 3. Migrate Company Configs
  for (const [key, value] of Object.entries(legacyDb)) {
    if (key.startsWith('config_')) {
      const tenantId = key.substring(7);
      if (value && typeof value === 'object') {
        db.run(
          `INSERT OR REPLACE INTO tenant_configs (tenant_id, name, phone, email, address, gstin, upi_id, config_json, updated_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            tenantId,
            value.name || null,
            value.phone || null,
            value.email || null,
            value.address || null,
            value.gstin || null,
            value.upiId || null,
            JSON.stringify(value),
            now
          ]
        );
      }
    }
  }

  persistDatabase();
  console.log('[Migration] ✓ SQLite primary database migration completed successfully!');
}

// Scheduled Home Server Backup Engine
export function createBackupSnapshot(): string {
  if (!db) throw new Error('Database not initialized');
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const filename = `inoms-backup-${timestamp}.db`;
  const backupFilePath = path.join(BACKUPS_DIR, filename);

  const data = db.export();
  fs.writeFileSync(backupFilePath, Buffer.from(data));
  console.log(`[Backup] SQLite database backup created: ${filename} (${data.length} bytes)`);

  // Retention: Keep all backups indefinitely (manual deletion enabled)
  return filename;
}

export function deleteBackupFile(filename: string): boolean {
  // Prevent path traversal attacks
  const safeFilename = path.basename(filename);
  const filePath = path.join(BACKUPS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file ${safeFilename} not found`);
  }
  fs.unlinkSync(filePath);
  console.log(`[Backup] Deleted backup file: ${safeFilename}`);
  return true;
}

export function listBackups(): { filename: string; sizeBytes: number; createdAt: string }[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  try {
    return fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('inoms-backup-') && f.endsWith('.db'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          filename: f,
          sizeBytes: stats.size,
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    return [];
  }
}

export function restoreBackupFile(filename: string): boolean {
  const filePath = path.join(BACKUPS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file ${filename} not found`);
  }
  const fileBuffer = fs.readFileSync(filePath);
  db = new SQL.Database(fileBuffer);
  persistDatabase();
  console.log(`[Backup] Restored database from backup: ${filename}`);
  return true;
}

function setupBackupScheduler(): void {
  // Run backup every 24 hours (and immediately once on server boot if none exist today)
  setInterval(() => {
    try {
      createBackupSnapshot();
    } catch (e) {
      console.error('[Backup] Scheduled backup failed:', e);
    }
  }, 24 * 60 * 60 * 1000);
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database is not initialized yet. Call initDatabase() first.');
  return db;
}
