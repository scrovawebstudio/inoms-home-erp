import path from 'path';
import fs from 'fs';
import initSqlJs, { Database } from 'sql.js';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const ORGS_DIR = path.join(DATA_DIR, 'orgs');
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
if (!fs.existsSync(ORGS_DIR)) {
  fs.mkdirSync(ORGS_DIR, { recursive: true });
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
      id TEXT,
      name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      gstin TEXT,
      upi_id TEXT,
      config_json TEXT,
      data_json TEXT,
      deleted_at TEXT,
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

    const configCols = ['id', 'data_json', 'deleted_at'];
    for (const col of configCols) {
      try {
        db.run(`ALTER TABLE tenant_configs ADD COLUMN ${col} TEXT;`);
      } catch (e) {}
    }

    try {
      db.run(`UPDATE tenant_configs SET id = tenant_id WHERE id IS NULL OR id = '';`);
    } catch (e) {}
  } catch (err) {}

  // Run automatic data migration from legacy JSON if database is new or needs seeding
  await migrateLegacyDataIfPresent();

  // Deduplicate any duplicate organizations created previously (only if same ID or exact phone+name collision)
  try {
    const stmt = db.prepare('SELECT id, name, code, owner_mobile, created_at FROM organizations WHERE status != "deleted" ORDER BY created_at ASC, id ASC');
    const seenMap = new Map<string, string>(); // key -> id
    const idsToDelete: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const cleanMobile = (row.owner_mobile as string || '').replace(/\D/g, '');
      const cleanName = (row.name as string || '').trim().toLowerCase();
      // Only deduplicate if we have a valid non-empty mobile AND non-generic name
      if (cleanMobile.length >= 10 && cleanName && cleanName !== 'organization' && cleanName !== 'service center') {
        const dedupeKey = `${cleanName}_${cleanMobile}`;
        if (row.id === 'org-admin' || cleanMobile === '8149862034') {
          continue;
        }
        if (seenMap.has(dedupeKey)) {
          idsToDelete.push(row.id as string);
        } else {
          seenMap.set(dedupeKey, row.id as string);
        }
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

  // Export current tenants to data/orgs/ structure for human-readable disk inspection & backup
  try {
    exportAllTenantsToDisk();
  } catch (e) {}

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

// Migrate legacy JSON data & scan all JSON files in data/ to SQLite
export interface DataFolderImportResult {
  success: boolean;
  filesScanned: number;
  filesImported: string[];
  counts: Record<string, number>;
  message: string;
}

export async function scanAndImportDataFolder(force: boolean = false): Promise<DataFolderImportResult> {
  if (!db) return { success: false, filesScanned: 0, filesImported: [], counts: {}, message: 'Database not initialized' };

  console.log('[DataFolderScanner] Beginning scan of data/ directory for database files and legacy JSON...');

  const counts: Record<string, number> = {
    organizations: 0,
    clients: 0,
    jobs: 0,
    invoices: 0,
    payments: 0,
    products: 0,
    expenses: 0,
    ledger: 0,
    users: 0,
    categories: 0,
    racks: 0,
    equipments: 0,
    problems: 0,
    tenant_configs: 0
  };

  const filesImported: string[] = [];
  let filesScanned = 0;
  const now = new Date().toISOString();

  // Helper to recursively collect all .json files in DATA_DIR
  function collectJsonFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    try {
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collectJsonFiles(fullPath));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      console.warn(`[DataFolderScanner] Error reading directory ${dir}:`, e);
    }
    return results;
  }

  const jsonFiles = collectJsonFiles(DATA_DIR);
  filesScanned = jsonFiles.length;
  console.log(`[DataFolderScanner] Found ${jsonFiles.length} JSON file(s) in data folder.`);

  // Helper to process a single organization
  function importOrg(org: any) {
    if (!org || !org.id || !db) return;
    try {
      const pin = (org.pin || '1234').toString();
      const { hash: pinHash, salt: pinSalt } = hashPassword(pin);
      const orgName = org.name || (org.id === 'org-admin' ? 'Master System Admin' : `Organization ${String(org.id).replace(/^org-/, '')}`);
      const orgCode = org.code || (org.id === 'org-admin' ? 'ADMIN-00' : `ORG-${String(org.id).slice(-4)}`);
      db.run(
        `INSERT OR REPLACE INTO organizations (id, name, code, owner_mobile, owner_name, status, secret_key, pin_hash, pin_salt, subscription_plan, subscription_start_date, subscription_end_date, trial_days, is_trial, features_json, data_json, created_at, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          org.id,
          orgName,
          orgCode,
          org.ownerMobile || org.mobile || org.phone || '',
          org.ownerName || org.owner || 'Admin',
          org.status || 'active',
          org.secretKey || null,
          pinHash,
          pinSalt,
          org.subscriptionPlan || org.plan || 'monthly',
          org.subscriptionStartDate || org.createdAt || now,
          org.subscriptionEndDate || null,
          org.trialDays || 0,
          org.isTrial ? 1 : 0,
          org.features ? JSON.stringify(org.features) : null,
          JSON.stringify(org),
          org.createdAt || now,
          org.updatedAt || now
        ]
      );
      db.run(
        `INSERT OR IGNORE INTO sync_revisions (tenant_id, current_revision, last_updated) VALUES (?, 1, ?)`,
        [org.id, now]
      );
      counts.organizations = (counts.organizations || 0) + 1;
    } catch (e) {
      console.warn(`[DataFolderScanner] Error importing organization ${org.id}:`, e);
    }
  }

  // Helper to process a single company config
  function importCompanyConfig(tenantId: string, cfg: any) {
    if (!tenantId || !cfg || !db) return;
    try {
      const dataJson = JSON.stringify(cfg);
      db.run(
        `INSERT OR REPLACE INTO tenant_configs (id, tenant_id, name, phone, email, address, gstin, upi_id, config_json, data_json, updated_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          tenantId,
          tenantId,
          cfg.name || null,
          cfg.phone || null,
          cfg.email || null,
          cfg.address || null,
          cfg.gstin || null,
          cfg.upiId || null,
          dataJson,
          dataJson,
          now
        ]
      );
      counts.tenant_configs = (counts.tenant_configs || 0) + 1;
      // Also update organization name and mobile if provided in config
      if (cfg.name) {
        db.run(`UPDATE organizations SET name = ? WHERE id = ?`, [cfg.name, tenantId]);
      }
      if (cfg.phone || cfg.mobile) {
        db.run(`UPDATE organizations SET owner_mobile = ? WHERE id = ?`, [cfg.phone || cfg.mobile, tenantId]);
      }
      if (cfg.ownerName || cfg.contactPerson) {
        db.run(`UPDATE organizations SET owner_name = ? WHERE id = ?`, [cfg.ownerName || cfg.contactPerson, tenantId]);
      }
      // Also update organization name and mobile if provided in config
      if (cfg.name) {
        db.run(`UPDATE organizations SET name = ? WHERE id = ?`, [cfg.name, tenantId]);
      }
      if (cfg.phone || cfg.mobile) {
        db.run(`UPDATE organizations SET owner_mobile = ? WHERE id = ?`, [cfg.phone || cfg.mobile, tenantId]);
      }
      if (cfg.ownerName || cfg.contactPerson) {
        db.run(`UPDATE organizations SET owner_name = ? WHERE id = ?`, [cfg.ownerName || cfg.contactPerson, tenantId]);
      }
    } catch (e) {
      console.warn(`[DataFolderScanner] Error importing config for ${tenantId}:`, e);
    }
  }

  // Helper to process a record item in a collection
  function importCollectionItem(tenantId: string, colName: string, item: any) {
    if (!item || !db) return;
    const targetTenant = tenantId || item.tenantId || 'org-admin';
    const itemId = String(item.id || item.jobNo || item.invoiceNo || item.sku || item.phone || item.mobile || `${colName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
    const itemCreatedAt = item.createdAt || item.date || item.receivedDate || now;
    const itemUpdatedAt = item.updatedAt || now;

    // Normalize item object for frontend compatibility
    let normalizedItem = { ...item, id: itemId, tenantId: targetTenant };

    try {
      switch (colName) {
        case 'clients': {
          const clientName = item.name || item.clientName || 'Unknown Client';
          const clientPhone = String(item.phone || item.mobile || item.clientMobile || item.contact || '');
          const clientEmail = item.email || null;
          const clientAddress = item.address || null;
          const clientCity = item.city || item.state || null;
          const clientGstin = item.gstin || item.gst || null;
          const balance = Number(item.outstandingBalance ?? item.currentBalance ?? item.balance ?? 0);
          
          normalizedItem = {
            ...item,
            id: itemId,
            tenantId: targetTenant,
            name: clientName,
            mobile: clientPhone,
            phone: clientPhone,
            email: clientEmail || '',
            address: clientAddress || '',
            city: clientCity || '',
            gstin: clientGstin || '',
            outstandingBalance: balance,
            currentBalance: balance,
            createdAt: itemCreatedAt
          };

          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO clients (id, tenant_id, name, phone, email, address, city, gstin, credit_limit, opening_balance, current_balance, notes, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, clientName, clientPhone || null, clientEmail,
              clientAddress, clientCity, clientGstin, item.creditLimit || 0,
              item.openingBalance || 0, balance, item.notes || null, dataJson,
              itemCreatedAt, itemUpdatedAt
            ]
          );
          counts.clients = (counts.clients || 0) + 1;
          break;
        }

        case 'jobs': {
          const jobNo = item.jobNo || item.id || itemId;
          const clientName = item.clientName || item.client || 'Unknown';
          const clientPhone = String(item.clientMobile || item.clientPhone || item.phone || item.mobile || '');
          const equipment = item.equipment || item.equipmentType || 'LAPTOP';
          const brandModel = item.model || item.brandModel || item.brand || '';
          const serialNo = String(item.serialNo || item.serial_no || item.imei || '');
          const problem = item.issue || item.problemDescription || item.problem || item.reportedProblem || 'Repair Service';
          const estCost = Number(item.estimatedCost ?? item.estimateAmount ?? item.estimated_cost ?? 0);
          const advPaid = Number(item.advancePaid ?? item.advanceAmount ?? item.advance_paid ?? 0);
          const status = item.status || 'Received';

          normalizedItem = {
            ...item,
            id: itemId,
            jobNo,
            tenantId: targetTenant,
            clientId: item.clientId || '',
            clientName,
            clientMobile: clientPhone,
            equipment,
            model: brandModel,
            brandModel,
            serialNo,
            issue: problem,
            problemDescription: problem,
            status,
            estimatedCost: estCost,
            advancePaid: advPaid,
            receivedDate: itemCreatedAt,
            date: item.date || itemCreatedAt,
            createdAt: itemCreatedAt
          };

          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO jobs (id, tenant_id, job_no, client_id, client_name, client_phone, equipment_type, brand_model, serial_no, problem_description, estimated_cost, advance_paid, status, priority, assigned_to, rack_location, data_json, created_at, updated_at, completed_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, jobNo, item.clientId || null, clientName,
              clientPhone || null, equipment, brandModel || null,
              serialNo || null, problem, estCost,
              advPaid, status, item.priority || 'Normal', item.assignedTo || item.assignedTechnician || null,
              item.rackLocation || null, dataJson, itemCreatedAt, itemUpdatedAt, item.completedAt || null
            ]
          );
          counts.jobs = (counts.jobs || 0) + 1;
          break;
        }

        case 'invoices': {
          const invNo = item.invoiceNo || item.invoice_no || item.id || itemId;
          const clientName = item.clientName || item.client || 'Walk-in Client';
          const clientPhone = String(item.clientMobile || item.clientPhone || item.phone || '');
          const subtotal = Number(item.subtotal ?? item.subTotal ?? 0);
          const discount = Number(item.discount ?? 0);
          const tax = Number(item.taxAmount ?? item.tax ?? 0);
          const total = Number(item.grandTotal ?? item.totalAmount ?? item.total ?? (subtotal + tax - discount));
          const paidAmount = Number(item.paidAmount ?? item.paid ?? (item.isPaid ? total : 0));
          const balanceDue = Number(item.balanceAmount ?? item.balanceDue ?? (total - paidAmount));
          const status = item.status || (balanceDue <= 0 ? 'Paid' : 'Unpaid');
          const isPaid = item.isPaid !== undefined ? !!item.isPaid : (status === 'Paid' || balanceDue <= 0);

          normalizedItem = {
            ...item,
            id: itemId,
            invoiceNo: invNo,
            tenantId: targetTenant,
            clientId: item.clientId || '',
            clientName,
            clientMobile: clientPhone,
            date: item.date || item.invoiceDate || itemCreatedAt,
            items: Array.isArray(item.items) ? item.items : [],
            subtotal,
            discount,
            taxAmount: tax,
            grandTotal: total,
            total,
            paidAmount,
            balanceAmount: balanceDue,
            balanceDue,
            status,
            isPaid,
            paymentMode: item.paymentMode || 'Cash',
            createdAt: itemCreatedAt
          };

          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO invoices (id, tenant_id, invoice_no, job_id, client_id, client_name, client_phone, subtotal, discount, tax, total, paid_amount, balance_due, payment_mode, status, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, invNo, item.jobId || item.linkedJobId || null, item.clientId || null,
              clientName, clientPhone || null, subtotal, discount,
              tax, total, paidAmount, balanceDue,
              item.paymentMode || 'Cash', status, dataJson, itemCreatedAt, itemUpdatedAt
            ]
          );
          counts.invoices = (counts.invoices || 0) + 1;
          break;
        }

        case 'payments': {
          const payNo = item.paymentNo || item.receiptNo || item.id || itemId;
          const amount = Number(item.amount || 0);
          normalizedItem = {
            ...item,
            id: itemId,
            tenantId: targetTenant,
            paymentNo: payNo,
            amount,
            clientName: item.clientName || '',
            date: item.date || itemCreatedAt,
            paymentMode: item.paymentMode || item.method || 'Cash',
            createdAt: itemCreatedAt
          };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO payments (id, tenant_id, payment_no, client_id, client_name, invoice_id, job_id, amount, payment_mode, transaction_ref, notes, received_by, date, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, payNo, item.clientId || null, item.clientName || null,
              item.invoiceId || null, item.jobId || null, amount, item.paymentMode || item.method || 'Cash',
              item.transactionRef || item.referenceNo || null, item.notes || null, item.receivedBy || null, item.date || itemCreatedAt,
              dataJson, itemCreatedAt, itemUpdatedAt
            ]
          );
          counts.payments = (counts.payments || 0) + 1;
          break;
        }

        case 'products': {
          const pName = item.name || item.productName || 'Product';
          const pPrice = Number(item.sellingPrice ?? item.price ?? 0);
          const pCost = Number(item.purchasePrice ?? item.costPrice ?? 0);
          const pStock = Number(item.stockQty ?? item.stock ?? item.stockQuantity ?? 0);
          normalizedItem = {
            ...item,
            id: itemId,
            tenantId: targetTenant,
            name: pName,
            sellingPrice: pPrice,
            price: pPrice,
            purchasePrice: pCost,
            costPrice: pCost,
            stock: pStock,
            stockQty: pStock,
            category: item.category || 'General',
            createdAt: itemCreatedAt
          };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO products (id, tenant_id, code, name, category, description, cost_price, selling_price, stock_quantity, min_stock_alert, unit, location, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, item.code || item.partNumber || item.barcode || null, pName, item.category || null,
              item.description || null, pCost, pPrice,
              pStock, item.minStockAlert || item.minStockLevel || 0, item.unit || 'pcs',
              item.location || item.rackLocation || null, dataJson, itemCreatedAt, itemUpdatedAt
            ]
          );
          counts.products = (counts.products || 0) + 1;
          break;
        }

        case 'expenses': {
          const amount = Number(item.amount || 0);
          normalizedItem = {
            ...item,
            id: itemId,
            tenantId: targetTenant,
            amount,
            category: item.category || 'General',
            date: item.date || itemCreatedAt,
            createdAt: itemCreatedAt
          };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO expenses (id, tenant_id, expense_no, category, amount, payment_mode, description, paid_to, date, recorded_by, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, item.expenseNo || itemId, item.category || 'General', amount,
              item.paymentMode || 'Cash', item.description || null, item.paidTo || null, item.date || itemCreatedAt,
              item.recordedBy || null, dataJson, itemCreatedAt, itemUpdatedAt
            ]
          );
          counts.expenses = (counts.expenses || 0) + 1;
          break;
        }

        case 'ledger': {
          const amount = Number(item.amount || item.debit || item.credit || 0);
          normalizedItem = {
            ...item,
            id: itemId,
            tenantId: targetTenant,
            amount,
            date: item.date || itemCreatedAt,
            createdAt: itemCreatedAt
          };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO ledger (id, tenant_id, client_id, entry_type, amount, reference_id, description, balance_after, date, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, item.clientId || null, item.entryType || item.type || 'Debit', amount,
              item.referenceId || item.refNo || null, item.description || null, item.balanceAfter || item.balance || 0, item.date || itemCreatedAt,
              dataJson, itemCreatedAt, itemUpdatedAt
            ]
          );
          counts.ledger = (counts.ledger || 0) + 1;
          break;
        }

        case 'users': {
          const pass = (item.password || item.pin || '1234').toString();
          const { hash: pHash, salt: pSalt } = hashPassword(pass);
          normalizedItem = {
            ...item,
            id: itemId,
            tenantId: targetTenant,
            name: item.name || 'User',
            username: item.username || item.mobile || 'user',
            mobile: item.mobile || '',
            role: item.role || 'Technician',
            status: item.status || 'Active'
          };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO users (id, tenant_id, name, username, mobile, email, role, status, password_hash, password_salt, pin_hash, pin_salt, permissions_json, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [
              itemId, targetTenant, item.name || 'User', item.username || null, item.mobile || null,
              item.email || null, item.role || 'Technician', item.status || 'Active', pHash, pSalt,
              pHash, pSalt, item.permissions ? JSON.stringify(item.permissions) : null, dataJson,
              itemCreatedAt, itemUpdatedAt
            ]
          );
          counts.users = (counts.users || 0) + 1;
          break;
        }

        case 'categories': {
          normalizedItem = { ...item, id: itemId, tenantId: targetTenant, name: item.name || 'Category' };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO categories (id, tenant_id, name, type, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [itemId, targetTenant, item.name || 'Category', item.type || 'Job', dataJson, itemCreatedAt, itemUpdatedAt]
          );
          counts.categories = (counts.categories || 0) + 1;
          break;
        }

        case 'racks': {
          normalizedItem = { ...item, id: itemId, tenantId: targetTenant, name: item.name || 'Rack' };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO racks (id, tenant_id, name, capacity, location, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [itemId, targetTenant, item.name || 'Rack', item.capacity || null, item.location || null, dataJson, itemCreatedAt, itemUpdatedAt]
          );
          counts.racks = (counts.racks || 0) + 1;
          break;
        }

        case 'equipments': {
          normalizedItem = { ...item, id: itemId, tenantId: targetTenant, name: item.name || 'Equipment' };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO equipments (id, tenant_id, name, brand, model, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [itemId, targetTenant, item.name || 'Equipment', item.brand || null, item.model || null, dataJson, itemCreatedAt, itemUpdatedAt]
          );
          counts.equipments = (counts.equipments || 0) + 1;
          break;
        }

        case 'problems': {
          normalizedItem = { ...item, id: itemId, tenantId: targetTenant, title: item.title || item.name || 'Problem' };
          const dataJson = JSON.stringify(normalizedItem);
          db.run(
            `INSERT OR REPLACE INTO problems (id, tenant_id, title, description, common_solution, standard_cost, data_json, created_at, updated_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
            [itemId, targetTenant, item.title || item.name || 'Problem', item.description || null, item.commonSolution || null, item.standardCost || 0, dataJson, itemCreatedAt, itemUpdatedAt]
          );
          counts.problems = (counts.problems || 0) + 1;
          break;
        }
      }
    } catch (e) {
      console.warn(`[DataFolderScanner] Error importing item ${itemId} in ${colName}:`, e);
    }
  }

  // =========================================================================
  // STEP 1: SPECIFIC SCAN OF data/orgs/ (and any org-* directories)
  // =========================================================================
  const orgDirsToScan: { orgId: string; dirPath: string }[] = [];

  // Check data/orgs/
  if (fs.existsSync(ORGS_DIR)) {
    try {
      const orgEntries = fs.readdirSync(ORGS_DIR, { withFileTypes: true });
      for (const entry of orgEntries) {
        if (entry.isDirectory()) {
          orgDirsToScan.push({
            orgId: entry.name,
            dirPath: path.join(ORGS_DIR, entry.name)
          });
        }
      }
    } catch (e) {
      console.warn('[DataFolderScanner] Error reading ORGS_DIR:', e);
    }
  }

  // Check root data/ for any folders starting with org-
  if (fs.existsSync(DATA_DIR)) {
    try {
      const rootEntries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
      for (const entry of rootEntries) {
        if (entry.isDirectory() && entry.name.startsWith('org-') && entry.name !== 'orgs') {
          if (!orgDirsToScan.some(o => o.orgId === entry.name)) {
            orgDirsToScan.push({
              orgId: entry.name,
              dirPath: path.join(DATA_DIR, entry.name)
            });
          }
        }
      }
    } catch (e) {}
  }

  console.log(`[DataFolderScanner] Discovered ${orgDirsToScan.length} organization directory/directories:`, orgDirsToScan.map(o => o.orgId));

  // Process each discovered organization folder
  for (const { orgId, dirPath } of orgDirsToScan) {
    let orgDetails: any = {
      id: orgId,
      name: orgId === 'org-admin' ? 'Master System Admin' : `Organization ${orgId.replace(/^org-/, '')}`,
      code: orgId === 'org-admin' ? 'ADMIN-00' : `ORG-${orgId.slice(-4)}`,
      ownerMobile: '',
      ownerName: 'Admin',
      status: 'active',
      pin: '1234'
    };

    let companyConfig: any = null;

    try {
      // Recursively collect all JSON files in this org's directory
      const orgJsonFiles = collectJsonFiles(dirPath);
      for (const filePath of orgJsonFiles) {
        filesScanned++;
        const relPath = path.relative(DATA_DIR, filePath);
        const fileName = path.basename(filePath).toLowerCase();

        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          if (!raw.trim()) continue;
          const parsed = JSON.parse(raw);
          let importedFile = false;

          // Check if this file contains companyConfig or organization details
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            // Extract company name if available
            const extractedName = parsed.name || parsed.orgName || parsed.companyName || parsed.businessName || parsed.shopName || parsed.companyConfig?.name || parsed.config?.name;
            if (extractedName && extractedName !== 'Organization' && extractedName !== 'Service Center') {
              orgDetails.name = extractedName;
            }

            const extractedMobile = parsed.phone || parsed.mobile || parsed.ownerMobile || parsed.contact || parsed.companyConfig?.phone || parsed.companyConfig?.mobile;
            if (extractedMobile) {
              orgDetails.ownerMobile = String(extractedMobile);
            }

            const extractedOwner = parsed.ownerName || parsed.owner || parsed.contactPerson || parsed.companyConfig?.ownerName;
            if (extractedOwner) {
              orgDetails.ownerName = extractedOwner;
            }

            if (parsed.pin) orgDetails.pin = parsed.pin;
            if (parsed.secretKey) orgDetails.secretKey = parsed.secretKey;
            if (parsed.code) orgDetails.code = parsed.code;
            if (parsed.status) orgDetails.status = parsed.status;
            if (parsed.subscriptionPlan || parsed.plan) orgDetails.subscriptionPlan = parsed.subscriptionPlan || parsed.plan;

            // Company config
            if (parsed.companyConfig || parsed.config) {
              companyConfig = { ...(companyConfig || {}), ...(parsed.companyConfig || parsed.config) };
              importedFile = true;
            } else if (fileName.includes('config') || fileName.includes('setting') || fileName.includes('profile')) {
              companyConfig = { ...(companyConfig || {}), ...parsed };
              importedFile = true;
            }

            // Check for known collections
            const knownCollections = ['clients', 'jobs', 'invoices', 'payments', 'products', 'expenses', 'ledger', 'users', 'categories', 'racks', 'equipments', 'problems'];
            for (const col of knownCollections) {
              if (Array.isArray(parsed[col])) {
                for (const it of parsed[col]) {
                  importCollectionItem(orgId, col, it);
                  importedFile = true;
                }
              }
            }
          } else if (Array.isArray(parsed)) {
            // Standalone array file (e.g. clients.json, jobs.json, etc.)
            let detectedCol = '';
            if (fileName.includes('client')) detectedCol = 'clients';
            else if (fileName.includes('job') || fileName.includes('repair')) detectedCol = 'jobs';
            else if (fileName.includes('invoice') || fileName.includes('bill')) detectedCol = 'invoices';
            else if (fileName.includes('payment') || fileName.includes('receipt')) detectedCol = 'payments';
            else if (fileName.includes('product') || fileName.includes('item') || fileName.includes('inventory')) detectedCol = 'products';
            else if (fileName.includes('expense')) detectedCol = 'expenses';
            else if (fileName.includes('ledger') || fileName.includes('account')) detectedCol = 'ledger';
            else if (fileName.includes('user') || fileName.includes('technician') || fileName.includes('staff')) detectedCol = 'users';
            else if (fileName.includes('categor')) detectedCol = 'categories';
            else if (fileName.includes('rack')) detectedCol = 'racks';
            else if (fileName.includes('equipment') || fileName.includes('device')) detectedCol = 'equipments';
            else if (fileName.includes('problem') || fileName.includes('fault')) detectedCol = 'problems';

            if (detectedCol) {
              for (const it of parsed) {
                importCollectionItem(orgId, detectedCol, it);
                importedFile = true;
              }
            }
          }

          if (importedFile) {
            filesImported.push(relPath);
          }
        } catch (e) {
          console.warn(`[DataFolderScanner] Error reading file ${filePath}:`, e);
        }
      }

      // Register the organization & company config
      importOrg(orgDetails);
      if (companyConfig) {
        importCompanyConfig(orgId, companyConfig);
      }
    } catch (e) {
      console.warn(`[DataFolderScanner] Error processing org directory ${dirPath}:`, e);
    }
  }

  // =========================================================================
  // STEP 2: SCAN REMAINING ROOT & BACKUP JSON FILES IN data/
  // =========================================================================
  for (const filePath of jsonFiles) {
    try {
      // Skip files already processed in Step 1
      const relativePath = path.relative(DATA_DIR, filePath);
      if (filesImported.includes(relativePath)) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (!content || !content.trim()) continue;
      const parsed = JSON.parse(content);
      let importedSomething = false;

      // Extract tenantId from file path if possible
      const pathSegments = relativePath.split(/[/\\]/);
      let pathTenantId = 'org-admin';
      for (let i = 0; i < pathSegments.length - 1; i++) {
        if (pathSegments[i] === 'orgs' && pathSegments[i + 1]) {
          pathTenantId = pathSegments[i + 1];
          break;
        }
        if (pathSegments[i].startsWith('org-')) {
          pathTenantId = pathSegments[i];
          break;
        }
      }

      // Type 1: Keyed legacy format (inoms_db.json or org data.json)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Tenants / Organizations
        const tenants = parsed['tenants_all'] || parsed['tenants'] || parsed['organizations'];
        if (Array.isArray(tenants)) {
          for (const t of tenants) {
            importOrg(t);
            importedSomething = true;
          }
        }

        // Keys starting with tenant_ or config_ or col_
        for (const [key, val] of Object.entries(parsed)) {
          if (key.startsWith('tenant_') && key !== 'tenant_configs' && key !== 'tenants_all') {
            if (val && typeof val === 'object' && (val as any).id) {
              importOrg(val);
              importedSomething = true;
            }
          } else if (key.startsWith('config_')) {
            const tId = key.substring(7);
            if (val && typeof val === 'object') {
              importCompanyConfig(tId, val);
              importedSomething = true;
            }
          } else if (key.startsWith('col_')) {
            const parts = key.substring(4).split('_');
            if (parts.length >= 2) {
              const tId = parts[0];
              const colName = parts.slice(1).join('_');
              const items = Array.isArray((val as any)?.items) ? (val as any).items : (Array.isArray(val) ? val : []);
              for (const it of items) {
                importCollectionItem(tId, colName, it);
                importedSomething = true;
              }
            }
          }
        }

        // Type 2: Standard JSON Backup export format { tenantId, clients: [], jobs: [], ... }
        const targetTenantId = parsed.tenantId || pathTenantId || 'org-admin';
        if (parsed.companyConfig) {
          importCompanyConfig(targetTenantId, parsed.companyConfig);
          importedSomething = true;
        }

        const knownCollections = ['clients', 'jobs', 'invoices', 'payments', 'products', 'expenses', 'ledger', 'users', 'categories', 'racks', 'equipments', 'problems'];
        for (const col of knownCollections) {
          if (Array.isArray(parsed[col])) {
            for (const it of parsed[col]) {
              importCollectionItem(targetTenantId, col, it);
              importedSomething = true;
            }
          }
        }
      } else if (Array.isArray(parsed)) {
        // Type 3: Direct Array JSON file (e.g. clients.json, jobs.json, tenants.json)
        const filename = path.basename(filePath).toLowerCase();
        let detectedCol = '';
        if (filename.includes('client')) detectedCol = 'clients';
        else if (filename.includes('job') || filename.includes('repair')) detectedCol = 'jobs';
        else if (filename.includes('invoice') || filename.includes('bill')) detectedCol = 'invoices';
        else if (filename.includes('payment') || filename.includes('receipt')) detectedCol = 'payments';
        else if (filename.includes('product') || filename.includes('inventory')) detectedCol = 'products';
        else if (filename.includes('expense')) detectedCol = 'expenses';
        else if (filename.includes('ledger')) detectedCol = 'ledger';
        else if (filename.includes('user')) detectedCol = 'users';
        else if (filename.includes('categor')) detectedCol = 'categories';
        else if (filename.includes('rack')) detectedCol = 'racks';
        else if (filename.includes('equipment')) detectedCol = 'equipments';
        else if (filename.includes('problem')) detectedCol = 'problems';
        else if (filename.includes('tenant') || filename.includes('org')) {
          for (const t of parsed) {
            importOrg(t);
            importedSomething = true;
          }
        }

        if (detectedCol) {
          for (const it of parsed) {
            importCollectionItem(pathTenantId, detectedCol, it);
            importedSomething = true;
          }
        }
      }

      if (importedSomething) {
        filesImported.push(relativePath);
      }
    } catch (err) {
      console.warn(`[DataFolderScanner] Error parsing JSON file ${filePath}:`, err);
    }
  }

  // Ensure default organizations exist if still completely empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM organizations');
  let currentOrgCount = 0;
  if (countStmt.step()) {
    currentOrgCount = countStmt.getAsObject().count as number || 0;
  }
  countStmt.free();

  if (currentOrgCount === 0) {
    importOrg({
      id: 'org-admin',
      name: 'Master System Admin',
      code: 'ADMIN-00',
      ownerMobile: '+91 8149862034',
      ownerName: 'Master Admin',
      status: 'active',
      createdAt: '2026-01-01',
      secretKey: 'MASTERADMIN2FA37'
    });
    importOrg({
      id: 'org-1',
      name: 'Apex Electronics & Mobile Care',
      code: 'APEX-01',
      ownerMobile: '9876543210',
      ownerName: 'Rahul Sharma',
      status: 'active',
      createdAt: '2026-01-15'
    });
  }

  // Persist updated SQLite database to disk
  persistDatabase();

  const totalImportedItems = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`[DataFolderScanner] ✓ Scan completed. Scanned: ${filesScanned} file(s), Processed: ${filesImported.length} file(s), Total items: ${totalImportedItems}`);

  return {
    success: true,
    filesScanned,
    filesImported,
    counts,
    message: totalImportedItems > 0 
      ? `Successfully imported data from ${filesImported.length} file(s) in data folder (${totalImportedItems} total records).` 
      : `Data folder scan complete. No new unimported JSON records found.`
  };
}

// Migrate legacy JSON data (inoms_db.json & data/orgs) to SQLite
async function migrateLegacyDataIfPresent(): Promise<void> {
  await scanAndImportDataFolder(false);
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

export function exportTenantToDisk(tenantId: string): void {
  if (!db || !tenantId) return;
  try {
    const orgFolder = path.join(ORGS_DIR, tenantId);
    if (!fs.existsSync(orgFolder)) {
      fs.mkdirSync(orgFolder, { recursive: true });
    }

    // Export config
    const cfgStmt = db.prepare('SELECT data_json, config_json FROM tenant_configs WHERE tenant_id = ?');
    cfgStmt.bind([tenantId]);
    if (cfgStmt.step()) {
      const row = cfgStmt.getAsObject();
      const cfgRaw = (row.config_json || row.data_json) as string;
      if (cfgRaw) {
        fs.writeFileSync(path.join(orgFolder, 'config.json'), JSON.stringify(JSON.parse(cfgRaw), null, 2));
      }
    }
    cfgStmt.free();

    // Export collections
    const collections = ['clients', 'jobs', 'invoices', 'payments', 'products', 'expenses', 'ledger', 'users', 'categories', 'racks', 'equipments', 'problems'];
    const tenantData: Record<string, any[]> = {};

    for (const col of collections) {
      const items: any[] = [];
      const stmt = db.prepare(`SELECT data_json FROM ${col} WHERE tenant_id = ? AND (deleted_at IS NULL OR deleted_at = '')`);
      stmt.bind([tenantId]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row.data_json) {
          try {
            items.push(JSON.parse(row.data_json as string));
          } catch (e) {}
        }
      }
      stmt.free();
      tenantData[col] = items;
    }

    // Write full data.json in org folder
    fs.writeFileSync(path.join(orgFolder, 'data.json'), JSON.stringify({ tenantId, ...tenantData }, null, 2));
  } catch (e) {
    console.warn(`[ExportTenant] Error exporting tenant ${tenantId} to disk:`, e);
  }
}

export function exportAllTenantsToDisk(): void {
  if (!db) return;
  try {
    const stmt = db.prepare('SELECT id FROM organizations WHERE status != "deleted"');
    const orgIds: string[] = [];
    while (stmt.step()) {
      orgIds.push(stmt.getAsObject().id as string);
    }
    stmt.free();

    for (const id of orgIds) {
      exportTenantToDisk(id);
    }
  } catch (e) {
    console.warn('[ExportAllTenants] Error exporting tenants:', e);
  }
}

export async function uploadAndImportOrgsBatch(files: { path: string; content: any }[]): Promise<DataFolderImportResult> {
  if (!files || !Array.isArray(files)) {
    return { success: false, filesScanned: 0, filesImported: [], counts: {}, message: 'No files provided' };
  }

  for (const file of files) {
    if (!file.path || !file.content) continue;
    try {
      // Normalize relative path
      let cleanPath = file.path.replace(/^[/\\]+/, '').replace(/^data[/\\]+/, '');
      if (!cleanPath.startsWith('orgs/')) {
        cleanPath = `orgs/${cleanPath}`;
      }
      const targetFilePath = path.join(DATA_DIR, cleanPath);
      const targetDir = path.dirname(targetFilePath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileContentStr = typeof file.content === 'string' 
        ? file.content 
        : JSON.stringify(file.content, null, 2);

      fs.writeFileSync(targetFilePath, fileContentStr, 'utf-8');
      console.log(`[BatchUpload] Saved disk file: ${cleanPath}`);
    } catch (err) {
      console.warn(`[BatchUpload] Failed saving file ${file.path}:`, err);
    }
  }

  // Now run scanner to import into SQLite tables
  return await scanAndImportDataFolder(true);
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database is not initialized yet. Call initDatabase() first.');
  return db;
}
