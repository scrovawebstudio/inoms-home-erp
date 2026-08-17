import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let db: Database | null = null;
let sqlInstance: SqlJsStatic | null = null;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'inoms_primary.db');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const ORGS_DIR = path.join(DATA_DIR, 'orgs');

let saveTimeout: NodeJS.Timeout | null = null;

// Debounced asynchronous persist of SQLite binary file to disk
export function scheduleDbSave(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    persistDatabase();
  }, 300);
}

// Immediate synchronous persist of in-memory SQLite database to disk
export function persistDatabase(): void {
  if (!db) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('[SQLite] Error writing inoms_primary.db to disk:', err);
  }
}

// Cryptographic helpers for User and Admin authentication
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const check = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return check === hash;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Initialize SQLite database with full multi-tenant relational schema
export async function initDatabase(): Promise<Database> {
  if (!sqlInstance) {
    sqlInstance = await initSqlJs();
  }
  const SQL = sqlInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORGS_DIR)) {
    fs.mkdirSync(ORGS_DIR, { recursive: true });
  }

  let fileBuffer: Buffer | null = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      fileBuffer = fs.readFileSync(DB_FILE);
    } catch (e) {
      console.warn('[SQLite] Could not read existing DB file:', e);
    }
  }

  db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

  // Enforce foreign key constraints
  try {
    db.run('PRAGMA foreign_keys = ON;');
  } catch (e) {}

  // -------------------------------------------------------------
  // 1. PLATFORM / ADMIN DATA SCHEMA
  // -------------------------------------------------------------
  db.run(`
    -- Platform Administrators
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      full_name TEXT NOT NULL,
      email TEXT,
      mobile TEXT,
      role TEXT DEFAULT 'Platform Admin',
      status TEXT DEFAULT 'active',
      last_login_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Organizations / Tenants
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      organization_code TEXT UNIQUE,
      organization_name TEXT NOT NULL,
      name TEXT,
      code TEXT,
      owner_name TEXT,
      owner_mobile TEXT,
      owner_email TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      country TEXT DEFAULT 'India',
      gstin TEXT,
      status TEXT DEFAULT 'active',
      is_active INTEGER DEFAULT 1,
      subscription_plan TEXT DEFAULT 'trial',
      subscription_status TEXT DEFAULT 'active',
      subscription_start_date TEXT,
      subscription_expiry_date TEXT,
      subscription_end_date TEXT,
      trial_days INTEGER DEFAULT 7,
      is_trial INTEGER DEFAULT 0,
      trial_start_date TEXT,
      trial_end_date TEXT,
      max_users INTEGER DEFAULT 10,
      max_storage_mb INTEGER DEFAULT 1024,
      secret_key TEXT,
      pin TEXT,
      pin_hash TEXT,
      pin_salt TEXT,
      features_json TEXT,
      data_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER DEFAULT 1
    );

    -- Tenant Subscription History & Plans
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      plan_name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'Paid',
      status TEXT DEFAULT 'Active',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Organization Feature Toggles & Addons
    CREATE TABLE IF NOT EXISTS organization_features (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      feature_name TEXT NOT NULL,
      is_enabled INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Organization Staff / Users
    CREATE TABLE IF NOT EXISTS organization_users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      name TEXT NOT NULL,
      full_name TEXT,
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
      last_login_at TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Legacy users table alias / synchronized
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

    -- Authentication Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      device_info TEXT,
      ip_address TEXT,
      created_at TEXT,
      expires_at TEXT,
      revoked_at TEXT,
      last_active_at TEXT
    );

    -- Tenant Company Profiles & Settings
    CREATE TABLE IF NOT EXISTS tenant_configs (
      tenant_id TEXT PRIMARY KEY,
      id TEXT,
      organization_id TEXT,
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

    -- -------------------------------------------------------------
    -- 2. ORGANIZATION / BUSINESS DATA SCHEMA
    -- -------------------------------------------------------------

    -- Clients & Customers
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      client_code TEXT,
      name TEXT NOT NULL,
      company_name TEXT,
      client_type TEXT DEFAULT 'Walk-in',
      mobile TEXT,
      phone TEXT,
      alternate_mobile TEXT,
      contact_person TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      gstin TEXT,
      credit_limit REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      outstanding_balance REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'active',
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Inward / Repair Work Orders (Jobs)
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      job_number TEXT,
      job_no TEXT,
      client_id TEXT REFERENCES clients(id),
      client_name TEXT,
      client_phone TEXT,
      client_mobile TEXT,
      inward_date TEXT,
      date TEXT,
      expected_delivery_date TEXT,
      equipment_type TEXT,
      equipment TEXT,
      product_name TEXT,
      brand TEXT,
      model TEXT,
      brand_model TEXT,
      serial_number TEXT,
      serial_no TEXT,
      imei_number TEXT,
      problem_description TEXT,
      physical_condition TEXT,
      accessories_received TEXT,
      ram_hdd TEXT,
      component_specs_json TEXT,
      problems_json TEXT,
      components_checklist_json TEXT,
      additional_details TEXT,
      images_json TEXT,
      estimated_amount REAL DEFAULT 0,
      estimate_amount REAL DEFAULT 0,
      estimated_cost REAL DEFAULT 0,
      advance_amount REAL DEFAULT 0,
      advance_paid REAL DEFAULT 0,
      advance_payment_mode TEXT,
      advance_refunded INTEGER DEFAULT 0,
      advance_refund_mode TEXT,
      final_bill_amount REAL DEFAULT 0,
      action_taken TEXT,
      delivery_status TEXT,
      delivery_type TEXT,
      courier_name TEXT,
      tracking_no TEXT,
      delivered_to_name TEXT,
      delivered_by TEXT,
      is_return_case INTEGER DEFAULT 0,
      payment_status TEXT,
      repair_outcome TEXT,
      priority TEXT DEFAULT 'Normal',
      status TEXT DEFAULT 'Pending',
      assigned_to TEXT,
      assigned_technician TEXT,
      rack_location TEXT,
      rack_id TEXT,
      remarks TEXT,
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      completed_at TEXT,
      outwarded_date TEXT,
      cancelled_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Job Status Audit Lifecycle History
    CREATE TABLE IF NOT EXISTS job_status_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      old_status TEXT,
      new_status TEXT NOT NULL,
      changed_by TEXT,
      remarks TEXT,
      created_at TEXT NOT NULL
    );

    -- Outward Deliveries & Dispatch Records
    CREATE TABLE IF NOT EXISTS outward (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      outward_number TEXT,
      job_id TEXT REFERENCES jobs(id),
      client_id TEXT REFERENCES clients(id),
      outward_date TEXT NOT NULL,
      delivery_date TEXT,
      delivered_to TEXT,
      received_by TEXT,
      delivery_type TEXT,
      courier_name TEXT,
      tracking_no TEXT,
      remarks TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Billing Invoices
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      invoice_number TEXT NOT NULL,
      invoice_no TEXT,
      job_id TEXT REFERENCES jobs(id),
      client_id TEXT REFERENCES clients(id),
      client_name TEXT,
      client_phone TEXT,
      client_mobile TEXT,
      client_address TEXT,
      client_state TEXT,
      client_gstin TEXT,
      invoice_date TEXT NOT NULL,
      date TEXT,
      due_date TEXT,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax_percent REAL DEFAULT 0,
      taxable_amount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      delivery_charges REAL DEFAULT 0,
      round_off REAL DEFAULT 0,
      total REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      balance_amount REAL DEFAULT 0,
      deducted_advance REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'Cash',
      is_paid INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Paid',
      notes TEXT,
      created_by TEXT,
      updated_by TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Line Items for Invoices (Relational child table)
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      item_type TEXT DEFAULT 'Product',
      product_id TEXT,
      product_name TEXT NOT NULL,
      serial_no TEXT,
      description TEXT,
      quantity REAL DEFAULT 1,
      qty REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      rate REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      line_total REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    -- Payments Received
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      payment_number TEXT,
      payment_no TEXT,
      client_id TEXT REFERENCES clients(id),
      client_name TEXT,
      invoice_id TEXT REFERENCES invoices(id),
      job_id TEXT REFERENCES jobs(id),
      linked_job_id TEXT,
      amount REAL NOT NULL DEFAULT 0,
      payment_date TEXT NOT NULL,
      date TEXT,
      payment_mode TEXT DEFAULT 'Cash',
      mode TEXT,
      transaction_reference TEXT,
      transaction_ref TEXT,
      ref_no TEXT,
      bank_name TEXT,
      notes TEXT,
      remarks TEXT,
      received_by TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Products & Spare Parts Inventory
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      product_code TEXT,
      code TEXT,
      sku TEXT,
      name TEXT NOT NULL,
      category_id TEXT,
      category TEXT,
      description TEXT,
      unit TEXT DEFAULT 'pcs',
      hsn_code TEXT,
      purchase_price REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      price REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      minimum_stock REAL DEFAULT 0,
      min_stock_alert REAL DEFAULT 0,
      min_qty_alert REAL DEFAULT 0,
      current_stock REAL DEFAULT 0,
      stock_quantity REAL DEFAULT 0,
      stock REAL DEFAULT 0,
      rack_id TEXT,
      location TEXT,
      status TEXT DEFAULT 'active',
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Inventory Movement & Stock Transactions
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      transaction_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      quantity REAL NOT NULL,
      stock_before REAL NOT NULL,
      stock_after REAL NOT NULL,
      unit_price REAL DEFAULT 0,
      remarks TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      expense_number TEXT,
      expense_no TEXT,
      category_id TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      expense_date TEXT NOT NULL,
      date TEXT,
      payment_mode TEXT DEFAULT 'Cash',
      paid_to TEXT,
      description TEXT,
      remarks TEXT,
      recorded_by TEXT,
      created_by TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Client Account Ledger Entries
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      client_id TEXT NOT NULL REFERENCES clients(id),
      entry_type TEXT NOT NULL,
      reference_type TEXT,
      reference_id TEXT,
      ref_no TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      amount REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      description TEXT,
      date TEXT,
      data_json TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Legacy ledger table alias / synchronized
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

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'Job',
      description TEXT,
      status TEXT DEFAULT 'active',
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Storage Racks & Shelves
    CREATE TABLE IF NOT EXISTS racks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      rack_code TEXT,
      name TEXT NOT NULL,
      capacity TEXT,
      location TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Equipments & Device Catalog
    CREATE TABLE IF NOT EXISTS equipments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Common Problems Catalog
    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      tenant_id TEXT,
      title TEXT,
      name TEXT NOT NULL,
      description TEXT,
      common_solution TEXT,
      standard_cost REAL DEFAULT 0,
      data_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      version INTEGER DEFAULT 1
    );

    -- Uploaded PDFs and Documents
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT 'application/pdf',
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    -- Audit Logs (System Activity & Operations History)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      tenant_id TEXT,
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

    -- Sync Revisions & Delta Sync changelog
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
      operation TEXT NOT NULL,
      data_json TEXT,
      timestamp TEXT NOT NULL
    );
  `);

  persistDatabase();

  // Run non-destructive automated schema migration & data decomposition
  await migrateSqliteSchema(db);

  // Run automatic data migration from legacy JSON if needed
  await migrateLegacyDataIfPresent();

  // Deduplicate any duplicate organizations
  cleanupDuplicateOrgs(db);

  // Setup automated periodic backup of SQLite database file
  setupBackupScheduler();

  // Export current tenants to data/orgs/ structure for human-readable disk inspection
  try {
    exportAllTenantsToDisk();
  } catch (e) {}

  return db;
}

// Automatic non-destructive schema migration to upgrade existing SQLite databases
async function migrateSqliteSchema(database: Database): Promise<void> {
  try {
    // Helper to safely add column if not exists
    const ensureColumns = (table: string, columns: { name: string; type: string }[]) => {
      try {
        const stmt = database.prepare(`PRAGMA table_info(${table})`);
        const existing = new Set<string>();
        while (stmt.step()) {
          const row = stmt.getAsObject();
          existing.add(row.name as string);
        }
        stmt.free();

        for (const col of columns) {
          if (!existing.has(col.name)) {
            try {
              database.run(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type};`);
              console.log(`[Schema Migration] Added column ${col.name} to ${table}`);
            } catch (err) {
              console.warn(`[Schema Migration] Failed adding ${col.name} to ${table}:`, err);
            }
          }
        }
      } catch (err) {
        console.warn(`[Schema Migration] PRAGMA table_info error on ${table}:`, err);
      }
    };

    // 1. Ensure columns for organizations
    ensureColumns('organizations', [
      { name: 'organization_code', type: 'TEXT' },
      { name: 'organization_name', type: 'TEXT' },
      { name: 'name', type: 'TEXT' },
      { name: 'code', type: 'TEXT' },
      { name: 'owner_name', type: 'TEXT' },
      { name: 'owner_mobile', type: 'TEXT' },
      { name: 'owner_email', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'city', type: 'TEXT' },
      { name: 'state', type: 'TEXT' },
      { name: 'pincode', type: 'TEXT' },
      { name: 'country', type: 'TEXT DEFAULT "India"' },
      { name: 'gstin', type: 'TEXT' },
      { name: 'status', type: 'TEXT DEFAULT "active"' },
      { name: 'is_active', type: 'INTEGER DEFAULT 1' },
      { name: 'subscription_plan', type: 'TEXT DEFAULT "monthly"' },
      { name: 'subscription_status', type: 'TEXT DEFAULT "active"' },
      { name: 'subscription_start_date', type: 'TEXT' },
      { name: 'subscription_expiry_date', type: 'TEXT' },
      { name: 'subscription_end_date', type: 'TEXT' },
      { name: 'trial_days', type: 'INTEGER DEFAULT 7' },
      { name: 'is_trial', type: 'INTEGER DEFAULT 0' },
      { name: 'trial_start_date', type: 'TEXT' },
      { name: 'trial_end_date', type: 'TEXT' },
      { name: 'max_users', type: 'INTEGER DEFAULT 10' },
      { name: 'max_storage_mb', type: 'INTEGER DEFAULT 1024' },
      { name: 'secret_key', type: 'TEXT' },
      { name: 'pin', type: 'TEXT' },
      { name: 'pin_hash', type: 'TEXT' },
      { name: 'pin_salt', type: 'TEXT' },
      { name: 'features_json', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' },
      { name: 'version', type: 'INTEGER DEFAULT 1' },
      { name: 'created_at', type: 'TEXT' },
      { name: 'updated_at', type: 'TEXT' }
    ]);

    // 2. Ensure columns for clients
    ensureColumns('clients', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'client_code', type: 'TEXT' },
      { name: 'company_name', type: 'TEXT' },
      { name: 'client_type', type: 'TEXT DEFAULT "Walk-in"' },
      { name: 'mobile', type: 'TEXT' },
      { name: 'alternate_mobile', type: 'TEXT' },
      { name: 'contact_person', type: 'TEXT' },
      { name: 'state', type: 'TEXT' },
      { name: 'pincode', type: 'TEXT' },
      { name: 'outstanding_balance', type: 'REAL DEFAULT 0' },
      { name: 'status', type: 'TEXT DEFAULT "active"' }
    ]);

    // 3. Ensure columns for jobs
    ensureColumns('jobs', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'job_number', type: 'TEXT' },
      { name: 'job_no', type: 'TEXT' },
      { name: 'client_name', type: 'TEXT' },
      { name: 'client_phone', type: 'TEXT' },
      { name: 'client_mobile', type: 'TEXT' },
      { name: 'inward_date', type: 'TEXT' },
      { name: 'date', type: 'TEXT' },
      { name: 'expected_delivery_date', type: 'TEXT' },
      { name: 'equipment', type: 'TEXT' },
      { name: 'equipment_type', type: 'TEXT' },
      { name: 'product_name', type: 'TEXT' },
      { name: 'brand', type: 'TEXT' },
      { name: 'model', type: 'TEXT' },
      { name: 'brand_model', type: 'TEXT' },
      { name: 'serial_number', type: 'TEXT' },
      { name: 'serial_no', type: 'TEXT' },
      { name: 'imei_number', type: 'TEXT' },
      { name: 'physical_condition', type: 'TEXT' },
      { name: 'accessories_received', type: 'TEXT' },
      { name: 'ram_hdd', type: 'TEXT' },
      { name: 'component_specs_json', type: 'TEXT' },
      { name: 'problems_json', type: 'TEXT' },
      { name: 'problem', type: 'TEXT' },
      { name: 'problem_description', type: 'TEXT' },
      { name: 'components_checklist_json', type: 'TEXT' },
      { name: 'additional_details', type: 'TEXT' },
      { name: 'images_json', type: 'TEXT' },
      { name: 'estimated_amount', type: 'REAL DEFAULT 0' },
      { name: 'estimate_amount', type: 'REAL DEFAULT 0' },
      { name: 'estimated_cost', type: 'REAL DEFAULT 0' },
      { name: 'advance_amount', type: 'REAL DEFAULT 0' },
      { name: 'advance_paid', type: 'REAL DEFAULT 0' },
      { name: 'advance_payment_mode', type: 'TEXT' },
      { name: 'advance_refunded', type: 'INTEGER DEFAULT 0' },
      { name: 'advance_refund_mode', type: 'TEXT' },
      { name: 'final_bill_amount', type: 'REAL DEFAULT 0' },
      { name: 'action_taken', type: 'TEXT' },
      { name: 'delivery_status', type: 'TEXT' },
      { name: 'delivery_type', type: 'TEXT' },
      { name: 'courier_name', type: 'TEXT' },
      { name: 'tracking_no', type: 'TEXT' },
      { name: 'delivered_to_name', type: 'TEXT' },
      { name: 'delivered_by', type: 'TEXT' },
      { name: 'is_return_case', type: 'INTEGER DEFAULT 0' },
      { name: 'payment_status', type: 'TEXT' },
      { name: 'repair_outcome', type: 'TEXT' },
      { name: 'assigned_technician', type: 'TEXT' },
      { name: 'assigned_to', type: 'TEXT' },
      { name: 'rack_id', type: 'TEXT' },
      { name: 'rack_location', type: 'TEXT' },
      { name: 'remarks', type: 'TEXT' },
      { name: 'outwarded_date', type: 'TEXT' },
      { name: 'cancelled_at', type: 'TEXT' }
    ]);

    // 4. Ensure columns for invoices
    ensureColumns('invoices', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'invoice_number', type: 'TEXT' },
      { name: 'client_mobile', type: 'TEXT' },
      { name: 'client_address', type: 'TEXT' },
      { name: 'client_state', type: 'TEXT' },
      { name: 'client_gstin', type: 'TEXT' },
      { name: 'invoice_date', type: 'TEXT' },
      { name: 'date', type: 'TEXT' },
      { name: 'due_date', type: 'TEXT' },
      { name: 'tax_percent', type: 'REAL DEFAULT 0' },
      { name: 'taxable_amount', type: 'REAL DEFAULT 0' },
      { name: 'tax_amount', type: 'REAL DEFAULT 0' },
      { name: 'cgst', type: 'REAL DEFAULT 0' },
      { name: 'sgst', type: 'REAL DEFAULT 0' },
      { name: 'igst', type: 'REAL DEFAULT 0' },
      { name: 'delivery_charges', type: 'REAL DEFAULT 0' },
      { name: 'round_off', type: 'REAL DEFAULT 0' },
      { name: 'grand_total', type: 'REAL DEFAULT 0' },
      { name: 'balance_amount', type: 'REAL DEFAULT 0' },
      { name: 'deducted_advance', type: 'REAL DEFAULT 0' },
      { name: 'is_paid', type: 'INTEGER DEFAULT 0' }
    ]);

    // 5. Ensure columns for payments
    ensureColumns('payments', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'payment_number', type: 'TEXT' },
      { name: 'linked_job_id', type: 'TEXT' },
      { name: 'payment_date', type: 'TEXT' },
      { name: 'mode', type: 'TEXT' },
      { name: 'transaction_reference', type: 'TEXT' },
      { name: 'ref_no', type: 'TEXT' },
      { name: 'bank_name', type: 'TEXT' },
      { name: 'remarks', type: 'TEXT' }
    ]);

    // 6. Ensure columns for products
    ensureColumns('products', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'product_code', type: 'TEXT' },
      { name: 'sku', type: 'TEXT' },
      { name: 'category_id', type: 'TEXT' },
      { name: 'hsn_code', type: 'TEXT' },
      { name: 'purchase_price', type: 'REAL DEFAULT 0' },
      { name: 'selling_price', type: 'REAL DEFAULT 0' },
      { name: 'price', type: 'REAL DEFAULT 0' },
      { name: 'tax_rate', type: 'REAL DEFAULT 0' },
      { name: 'minimum_stock', type: 'REAL DEFAULT 0' },
      { name: 'min_qty_alert', type: 'REAL DEFAULT 0' },
      { name: 'current_stock', type: 'REAL DEFAULT 0' },
      { name: 'stock', type: 'REAL DEFAULT 0' },
      { name: 'rack_id', type: 'TEXT' },
      { name: 'status', type: 'TEXT DEFAULT "active"' }
    ]);

    // 7. Ensure columns for organization_users and users
    ensureColumns('organization_users', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'full_name', type: 'TEXT' },
      { name: 'name', type: 'TEXT' },
      { name: 'username', type: 'TEXT' },
      { name: 'mobile', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'role', type: 'TEXT DEFAULT "Technician"' },
      { name: 'status', type: 'TEXT DEFAULT "active"' },
      { name: 'permissions_json', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' },
      { name: 'last_login_at', type: 'TEXT' }
    ]);

    ensureColumns('users', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'name', type: 'TEXT' },
      { name: 'username', type: 'TEXT' },
      { name: 'mobile', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'role', type: 'TEXT' },
      { name: 'permissions_json', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' }
    ]);

    // 8. Ensure columns for tenant_configs
    ensureColumns('tenant_configs', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'name', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'gstin', type: 'TEXT' },
      { name: 'upi_id', type: 'TEXT' },
      { name: 'config_json', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' },
      { name: 'version', type: 'INTEGER DEFAULT 1' },
      { name: 'updated_at', type: 'TEXT' }
    ]);

    // 9. Ensure columns for expenses
    ensureColumns('expenses', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'expense_number', type: 'TEXT' },
      { name: 'expense_no', type: 'TEXT' },
      { name: 'category', type: 'TEXT' },
      { name: 'amount', type: 'REAL DEFAULT 0' },
      { name: 'payment_mode', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'remarks', type: 'TEXT' },
      { name: 'paid_to', type: 'TEXT' },
      { name: 'date', type: 'TEXT' },
      { name: 'expense_date', type: 'TEXT' },
      { name: 'recorded_by', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' }
    ]);

    // 10. Ensure columns for ledger
    ensureColumns('ledger', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'client_id', type: 'TEXT' },
      { name: 'entry_type', type: 'TEXT' },
      { name: 'amount', type: 'REAL DEFAULT 0' },
      { name: 'reference_id', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'balance_after', type: 'REAL DEFAULT 0' },
      { name: 'date', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' }
    ]);

    // 11. Ensure columns for master setup tables
    ensureColumns('categories', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' }
    ]);
    ensureColumns('racks', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' }
    ]);
    ensureColumns('equipments', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' }
    ]);
    ensureColumns('problems', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'tenant_id', type: 'TEXT' },
      { name: 'data_json', type: 'TEXT' }
    ]);

    // 12. Ensure columns for audit_logs
    ensureColumns('audit_logs', [
      { name: 'organization_id', type: 'TEXT' },
      { name: 'ip_address', type: 'TEXT' },
      { name: 'device_info', type: 'TEXT' }
    ]);

    // Initialize Default Platform Master Admin if not present
    try {
      const adminCheck = database.prepare('SELECT id FROM admin_users WHERE username = ?');
      adminCheck.bind(['masteradmin']);
      const hasAdmin = adminCheck.step();
      adminCheck.free();

      if (!hasAdmin) {
        const { hash, salt } = hashPassword('admin123');
        const now = new Date().toISOString();
        database.run(
          `INSERT INTO admin_users (id, username, password_hash, password_salt, full_name, email, mobile, role, status, created_at, updated_at)
           VALUES ('admin-master', 'masteradmin', ?, ?, 'Master System Administrator', 'admin@inoms.local', '8149862034', 'Master Admin', 'active', ?, ?)`,
          [hash, salt, now, now]
        );
        console.log('[Schema Migration] Seeded default Master Admin (username: masteradmin)');
      }
    } catch (err) {
      console.warn('[Schema Migration] Admin seeding check:', err);
    }

    // Ensure Master System Admin and initial organizations exist if not already present
    try {
      const defaultOrgs = [
        {
          id: 'org-admin',
          name: 'Master System Admin',
          code: 'ADMIN-00',
          owner_name: 'Master Admin',
          owner_mobile: '+91 8149862034',
          status: 'active',
          pin: '1234',
          subscription_plan: 'lifetime',
          trial_days: 0,
          is_trial: 0
        },
        {
          id: 'org-nibban',
          name: 'Nibban Technologies',
          code: 'NIBBAN-01',
          owner_name: 'Nibban Admin',
          owner_mobile: '+91 9876543210',
          status: 'active',
          pin: '1234',
          subscription_plan: 'monthly',
          trial_days: 0,
          is_trial: 0
        }
      ];

      for (const org of defaultOrgs) {
        const checkStmt = database.prepare('SELECT id FROM organizations WHERE id = ?');
        checkStmt.bind([org.id]);
        const exists = checkStmt.step();
        checkStmt.free();

        if (!exists) {
          const now = new Date().toISOString();
          const { hash, salt } = hashPassword(org.pin);
          database.run(
            `INSERT INTO organizations (
              id, organization_code, organization_name, name, code, owner_name, owner_mobile,
              status, is_active, subscription_plan, subscription_status, subscription_start_date,
              trial_days, is_trial, pin_hash, pin_salt, created_at, updated_at, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'active', ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              org.id, org.code, org.name, org.name, org.code, org.owner_name, org.owner_mobile,
              org.status, org.subscription_plan, now, org.trial_days, org.is_trial,
              hash, salt, now, now
            ]
          );
          console.log(`[Schema Migration] Ensured organization record: ${org.name} (${org.id})`);
        }
      }
    } catch (orgErr) {
      console.warn('[Schema Migration] Organization check warning:', orgErr);
    }

    // Synchronize organization_id across all tables from tenant_id
    const syncOrgIdTables = ['clients', 'jobs', 'invoices', 'payments', 'products', 'expenses', 'ledger', 'categories', 'racks', 'equipments', 'problems', 'audit_logs'];
    for (const tbl of syncOrgIdTables) {
      try {
        database.run(`UPDATE ${tbl} SET organization_id = tenant_id WHERE (organization_id IS NULL OR organization_id = '') AND tenant_id IS NOT NULL;`);
      } catch (e) {}
    }

    // Sync organization_name and code aliases in organizations
    try {
      database.run(`UPDATE organizations SET organization_name = name WHERE (organization_name IS NULL OR organization_name = '') AND name IS NOT NULL;`);
      database.run(`UPDATE organizations SET organization_code = code WHERE (organization_code IS NULL OR organization_code = '') AND code IS NOT NULL;`);
      database.run(`UPDATE organizations SET name = organization_name WHERE (name IS NULL OR name = '') AND organization_name IS NOT NULL;`);
      database.run(`UPDATE organizations SET code = organization_code WHERE (code IS NULL OR code = '') AND organization_code IS NOT NULL;`);
    } catch (e) {}

    // Synchronize organization_users from legacy users table
    try {
      database.run(`
        INSERT OR IGNORE INTO organization_users (
          id, organization_id, tenant_id, name, full_name, username, mobile, email,
          role, status, password_hash, password_salt, pin_hash, pin_salt, permissions_json,
          data_json, created_at, updated_at, deleted_at, version
        )
        SELECT 
          id, tenant_id, tenant_id, name, name, username, mobile, email,
          role, status, password_hash, password_salt, pin_hash, pin_salt, permissions_json,
          data_json, created_at, updated_at, deleted_at, version
        FROM users
      `);
    } catch (e) {}

    // Extract invoice_items from existing invoices data_json
    try {
      const invStmt = database.prepare('SELECT id, tenant_id, organization_id, data_json, created_at FROM invoices WHERE data_json IS NOT NULL AND data_json != ""');
      while (invStmt.step()) {
        const row = invStmt.getAsObject();
        const orgId = (row.organization_id || row.tenant_id) as string;
        try {
          const parsed = JSON.parse(row.data_json as string);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            for (let i = 0; i < parsed.items.length; i++) {
              const item = parsed.items[i];
              const itemId = item.id || `item_${row.id}_${i}`;
              database.run(
                `INSERT OR REPLACE INTO invoice_items (
                  id, organization_id, invoice_id, item_type, product_id, product_name, serial_no,
                  description, quantity, qty, unit_price, rate, discount, tax_rate, tax_amount,
                  line_total, total, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  itemId,
                  orgId,
                  row.id as string,
                  'Product',
                  item.productId || null,
                  item.productName || item.name || 'Item',
                  item.serialNo || null,
                  item.description || null,
                  item.qty || item.quantity || 1,
                  item.qty || item.quantity || 1,
                  item.rate || item.unitPrice || 0,
                  item.rate || item.unitPrice || 0,
                  item.discount || 0,
                  item.taxRate || 0,
                  item.taxAmount || 0,
                  item.total || item.lineTotal || 0,
                  item.total || item.lineTotal || 0,
                  row.created_at || new Date().toISOString(),
                  new Date().toISOString()
                ]
              );
            }
          }
        } catch (e) {}
      }
      invStmt.free();
    } catch (err) {
      console.warn('[Schema Migration] Extract invoice_items warning:', err);
    }

    // Populate subscriptions table from organizations if missing
    try {
      const orgStmt = database.prepare('SELECT id, subscription_plan, subscription_start_date, subscription_end_date, created_at FROM organizations');
      while (orgStmt.step()) {
        const org = orgStmt.getAsObject();
        const subId = `sub_${org.id}`;
        database.run(
          `INSERT OR IGNORE INTO subscriptions (id, organization_id, plan_name, start_date, end_date, amount, payment_status, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, 'Paid', 'Active', ?, ?)`,
          [
            subId,
            org.id as string,
            (org.subscription_plan as string) || 'trial',
            (org.subscription_start_date as string) || (org.created_at as string) || new Date().toISOString().split('T')[0],
            (org.subscription_end_date as string) || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            (org.created_at as string) || new Date().toISOString(),
            new Date().toISOString()
          ]
        );
      }
      orgStmt.free();
    } catch (e) {}

    // Populate ledger_entries from legacy ledger table
    try {
      database.run(`
        INSERT OR IGNORE INTO ledger_entries (
          id, organization_id, tenant_id, client_id, entry_type, reference_type, reference_id,
          debit, credit, amount, balance_after, balance, description, date, data_json,
          created_at, updated_at, deleted_at, version
        )
        SELECT 
          id, tenant_id, tenant_id, client_id, entry_type, 'transaction', reference_id,
          CASE WHEN entry_type = 'Debit' THEN amount ELSE 0 END,
          CASE WHEN entry_type = 'Credit' THEN amount ELSE 0 END,
          amount, balance_after, balance_after, description, date, data_json,
          created_at, updated_at, deleted_at, version
        FROM ledger
      `);
    } catch (e) {}

    // High-Performance Multi-Tenant Relational Indexes (Safely created after all column migrations)
    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS idx_orgs_code ON organizations(organization_code);',
      'CREATE INDEX IF NOT EXISTS idx_orgs_status ON organizations(status);',
      'CREATE INDEX IF NOT EXISTS idx_org_users_org ON organization_users(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);',
      'CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_clients_org ON clients(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(organization_id, mobile);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(organization_id, client_id);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(organization_id, status);',
      'CREATE INDEX IF NOT EXISTS idx_job_status_history_job ON job_status_history(job_id);',
      'CREATE INDEX IF NOT EXISTS idx_outward_org ON outward(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(organization_id, client_id);',
      'CREATE INDEX IF NOT EXISTS idx_invoice_items_inv ON invoice_items(invoice_id);',
      'CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_payments_inv ON payments(organization_id, invoice_id);',
      'CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_inv_tx_prod ON inventory_transactions(product_id);',
      'CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_ledger_entries_client ON ledger_entries(organization_id, client_id);',
      'CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(organization_id, entity_type, entity_id);',
      'CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);',
      'CREATE INDEX IF NOT EXISTS idx_change_log_rev ON change_log(tenant_id, revision);'
    ];

    for (const sql of indexStatements) {
      try {
        database.run(sql);
      } catch (idxErr) {}
    }

    persistDatabase();
    console.log('[Schema Migration] SQLite schema verification and relational migration completed.');
  } catch (globalMigrationErr) {
    console.error('[Schema Migration] Error during schema migration:', globalMigrationErr);
  }
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

// Log audit changes safely with organization scoping
export function recordAuditLog(log: {
  tenantId: string;
  organizationId?: string;
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
  const orgId = log.organizationId || log.tenantId || 'org-admin';
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    db.run(
      `INSERT INTO audit_logs (id, organization_id, tenant_id, user_id, user_name, action, entity, entity_id, details_json, ip_address, device_info, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        log.tenantId || orgId,
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

// Data import & scanner results
export interface DataFolderImportResult {
  success: boolean;
  filesScanned: number;
  filesImported: string[];
  counts: Record<string, number>;
  message: string;
}

// Scan and import all data files from the data/ folder (JSON files, legacy backups, etc.)
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
    problems: 0
  };

  const filesImported: string[] = [];
  const scannedFiles: string[] = [];

  function collectJsonFiles(dir: string) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Avoid scanning backups archive repeatedly
          if (entry.name !== 'backups' && entry.name !== 'node_modules') {
            collectJsonFiles(fullPath);
          }
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          scannedFiles.push(fullPath);
        }
      }
    } catch (e) {
      console.warn(`[DataFolderScanner] Could not read dir: ${dir}`, e);
    }
  }

  collectJsonFiles(DATA_DIR);
  console.log(`[DataFolderScanner] Found ${scannedFiles.length} JSON file(s) in data directory.`);

  db.run('BEGIN TRANSACTION');
  try {
    for (const filePath of scannedFiles) {
      try {
        const contentStr = fs.readFileSync(filePath, 'utf-8');
        if (!contentStr || contentStr.trim() === '') continue;
        const parsed = JSON.parse(contentStr);
        const relPath = path.relative(DATA_DIR, filePath);

        // Case 1: organizations.json
        if (path.basename(filePath) === 'organizations.json' && Array.isArray(parsed)) {
          for (const org of parsed) {
            if (!org || !org.id) continue;
            const now = org.createdAt || new Date().toISOString();
            const { hash, salt } = hashPassword(org.pin || '1234');
            const code = org.code || `${org.name?.substring(0, 4).toUpperCase() || 'ORG'}-${Math.floor(10 + Math.random() * 90)}`;
            const isTr = org.isTrial !== undefined ? (org.isTrial ? 1 : 0) : (org.subscriptionPlan === 'trial' ? 1 : 0);
            const subPlan = org.subscriptionPlan || (isTr ? 'trial' : 'monthly');
            const subStart = org.subscriptionStartDate || now.split('T')[0];
            const tDays = org.trialDays !== undefined ? Number(org.trialDays) : (isTr ? 7 : 30);
            let subEnd = org.subscriptionEndDate || '';
            if (!subEnd) {
              const d = new Date();
              d.setDate(d.getDate() + (tDays || 7));
              subEnd = d.toISOString().split('T')[0];
            }

            // Check if organization already exists so we preserve user-updated status (e.g. deactivated)
            const checkStmt = db.prepare('SELECT status, version FROM organizations WHERE id = ?');
            checkStmt.bind([org.id]);
            let existingStatus = null;
            if (checkStmt.step()) {
              existingStatus = checkStmt.getAsObject().status;
            }
            checkStmt.free();

            const orgStatus = existingStatus || org.status || 'active';

            db.run(
              `INSERT OR REPLACE INTO organizations (
                id, organization_code, organization_name, name, code, owner_mobile, owner_name, status, secret_key, pin, pin_hash, pin_salt,
                subscription_plan, subscription_start_date, subscription_end_date, trial_days, is_trial, features_json, data_json, created_at, updated_at, version
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [
                org.id, code, org.name || 'Organization', org.name || 'Organization', code,
                org.ownerMobile || null, org.ownerName || null, orgStatus,
                org.secretKey || null, org.pin || '1234', hash, salt,
                subPlan, subStart, subEnd, tDays, isTr,
                org.features ? JSON.stringify(org.features) : null,
                JSON.stringify({ ...org, status: orgStatus }), now, now
              ]
            );
            counts.organizations++;
          }
          filesImported.push(relPath);
        }

        // Case 2: Full tenant snapshot or collections data
        const targetTenantId = parsed.tenantId || (filePath.includes('/orgs/') ? path.basename(path.dirname(filePath)) : null) || 'org-admin';

        if (parsed.companyConfig || parsed.name && parsed.phone && !parsed.jobNo) {
          const cfg = parsed.companyConfig || parsed;
          db.run(
            `INSERT OR REPLACE INTO tenant_configs (tenant_id, organization_id, id, name, phone, email, address, gstin, upi_id, config_json, data_json, updated_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              targetTenantId, targetTenantId, targetTenantId, cfg.name || null, cfg.phone || null, cfg.email || null,
              cfg.address || null, cfg.gstin || null, cfg.upiId || null,
              JSON.stringify(cfg), JSON.stringify(cfg), new Date().toISOString()
            ]
          );
        }

        const collectionsMap: Record<string, string> = {
          clients: 'clients',
          jobs: 'jobs',
          invoices: 'invoices',
          payments: 'payments',
          products: 'products',
          expenses: 'expenses',
          ledger: 'ledger',
          users: 'users',
          categories: 'categories',
          racks: 'racks',
          equipments: 'equipments',
          problems: 'problems'
        };

        for (const [key, tbl] of Object.entries(collectionsMap)) {
          const items = parsed[key] || (Array.isArray(parsed) && path.basename(filePath).startsWith(key) ? parsed : null);
          if (Array.isArray(items)) {
            for (const item of items) {
              if (!item || !item.id) continue;
              const now = item.createdAt || new Date().toISOString();
              const orgId = item.tenantId || targetTenantId;
              const dataJson = JSON.stringify(item);

              if (tbl === 'clients') {
                db.run(
                  `INSERT OR REPLACE INTO clients (id, organization_id, tenant_id, name, company_name, client_type, mobile, phone, email, address, city, state, gstin, credit_limit, opening_balance, current_balance, notes, data_json, created_at, updated_at, version)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, orgId, item.name || 'Client', item.companyName || null,
                    item.type || 'Walk-in', item.mobile || item.phone || null, item.phone || null,
                    item.email || null, item.address || null, item.city || null, item.state || null,
                    item.gstin || null, item.creditLimit || 0, item.openingBalance || 0,
                    item.currentBalance || item.outstandingBalance || 0, item.notes || null,
                    dataJson, now, now
                  ]
                );
                counts.clients++;
              } else if (tbl === 'jobs') {
                db.run(
                  `INSERT OR REPLACE INTO jobs (
                    id, organization_id, tenant_id, job_number, job_no, client_id, client_name, client_phone, client_mobile,
                    inward_date, date, equipment_type, equipment, product_name, brand, model, brand_model,
                    serial_number, serial_no, problem_description, estimated_amount, estimate_amount, advance_amount, advance_paid,
                    status, priority, assigned_to, assigned_technician, rack_location, data_json, created_at, updated_at, version
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, orgId, item.jobNo || item.id, item.jobNo || item.id,
                    item.clientId || null, item.clientName || null, item.clientMobile || item.clientPhone || null,
                    item.clientMobile || null, item.inwardDate || item.date || now, item.date || now,
                    item.equipment || item.equipmentType || null, item.equipment || null,
                    item.productName || null, item.brand || null, item.model || item.productModel || null,
                    item.brandModel || item.model || null, item.serialNo || null, item.serialNo || null,
                    item.problemDescription || item.problem || null, item.estimateAmount || item.estimatedCost || 0,
                    item.estimateAmount || 0, item.advanceAmount || item.advancePaid || 0, item.advancePaid || 0,
                    item.status || 'Pending', item.priority || 'Normal', item.assignedTechnician || item.assignedTo || null,
                    item.assignedTechnician || null, item.rackLocation || null, dataJson, now, now
                  ]
                );
                counts.jobs++;
              } else if (tbl === 'invoices') {
                db.run(
                  `INSERT OR REPLACE INTO invoices (
                    id, organization_id, tenant_id, invoice_number, invoice_no, job_id, client_id, client_name, client_phone,
                    subtotal, discount, tax, total, grand_total, paid_amount, balance_due, balance_amount, payment_mode, status,
                    invoice_date, date, data_json, created_at, updated_at, version
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, orgId, item.invoiceNo || item.id, item.invoiceNo || item.id,
                    item.jobId || item.linkedJobId || null, item.clientId || null, item.clientName || null,
                    item.clientPhone || item.clientMobile || null, item.subtotal || 0, item.discount || 0,
                    item.tax || item.taxAmount || 0, item.grandTotal || item.total || 0, item.grandTotal || item.total || 0,
                    item.paidAmount || 0, item.balanceDue || item.balanceAmount || 0, item.balanceDue || item.balanceAmount || 0,
                    item.paymentMode || 'Cash', item.status || (item.isPaid ? 'Paid' : 'Unpaid'),
                    item.date || now, item.date || now, dataJson, now, now
                  ]
                );
                counts.invoices++;
              } else if (tbl === 'payments') {
                db.run(
                  `INSERT OR REPLACE INTO payments (
                    id, organization_id, tenant_id, payment_number, payment_no, client_id, client_name, invoice_id, job_id,
                    amount, payment_mode, mode, transaction_reference, transaction_ref, notes, received_by, payment_date, date,
                    data_json, created_at, updated_at, version
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, orgId, item.paymentNo || item.id, item.paymentNo || item.id,
                    item.clientId || null, item.clientName || null, item.invoiceId || null, item.jobId || item.linkedJobId || null,
                    item.amount || 0, item.mode || item.paymentMode || 'Cash', item.mode || 'Cash',
                    item.refNo || item.transactionRef || null, item.refNo || item.transactionRef || null,
                    item.remarks || item.notes || null, item.receivedBy || null, item.date || now, item.date || now,
                    dataJson, now, now
                  ]
                );
                counts.payments++;
              } else if (tbl === 'products') {
                db.run(
                  `INSERT OR REPLACE INTO products (
                    id, organization_id, tenant_id, product_code, code, sku, name, category, description,
                    cost_price, selling_price, price, stock_quantity, stock, min_stock_alert, unit, location,
                    data_json, created_at, updated_at, version
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, orgId, item.code || item.sku || null, item.code || null, item.sku || null,
                    item.name || 'Product', item.category || null, item.description || null,
                    item.costPrice || 0, item.sellingPrice || item.price || 0, item.sellingPrice || item.price || 0,
                    item.stockQuantity || item.stock || 0, item.stock || 0, item.minStockAlert || item.minQtyAlert || 0,
                    item.unit || 'pcs', item.location || null, dataJson, now, now
                  ]
                );
                counts.products++;
              } else if (tbl === 'expenses') {
                db.run(
                  `INSERT OR REPLACE INTO expenses (
                    id, organization_id, tenant_id, expense_number, expense_no, category, amount, payment_mode,
                    description, remarks, paid_to, expense_date, date, recorded_by, data_json, created_at, updated_at, version
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, orgId, item.expenseNo || item.id, item.expenseNo || item.id,
                    item.category || 'General', item.amount || 0, item.paymentMode || 'Cash',
                    item.description || item.remarks || null, item.remarks || null, item.paidTo || null,
                    item.date || now, item.date || now, item.recordedBy || null, dataJson, now, now
                  ]
                );
                counts.expenses++;
              } else if (tbl === 'ledger') {
                db.run(
                  `INSERT OR REPLACE INTO ledger (
                    id, tenant_id, client_id, entry_type, amount, reference_id, description, balance_after,
                    date, data_json, created_at, updated_at, version
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, item.clientId || null, item.type || item.entryType || 'Debit',
                    item.amount || item.debit || item.credit || 0, item.refNo || item.referenceId || null,
                    item.description || null, item.balance || item.balanceAfter || 0, item.date || now,
                    dataJson, now, now
                  ]
                );
                db.run(
                  `INSERT OR REPLACE INTO ledger_entries (
                    id, organization_id, tenant_id, client_id, entry_type, reference_type, reference_id,
                    debit, credit, amount, balance_after, balance, description, date, data_json, created_at, updated_at, version
                  ) VALUES (?, ?, ?, ?, ?, 'transaction', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                  [
                    item.id, orgId, orgId, item.clientId || null, item.type || item.entryType || 'Debit',
                    item.refNo || item.referenceId || null, item.debit || 0, item.credit || 0,
                    item.amount || item.debit || item.credit || 0, item.balance || item.balanceAfter || 0,
                    item.balance || item.balanceAfter || 0, item.description || null, item.date || now,
                    dataJson, now, now
                  ]
                );
                counts.ledger++;
              }
            }
            if (!filesImported.includes(relPath)) {
              filesImported.push(relPath);
            }
          }
        }
      } catch (fileErr) {
        console.warn(`[DataFolderScanner] Error processing ${filePath}:`, fileErr);
      }
    }
    db.run('COMMIT');
    persistDatabase();
    console.log('[DataFolderScanner] Import transaction committed successfully.');
  } catch (txErr) {
    db.run('ROLLBACK');
    console.error('[DataFolderScanner] Transaction failed and rolled back:', txErr);
    return { success: false, filesScanned: scannedFiles.length, filesImported, counts, message: `Import error: ${txErr}` };
  }

  return {
    success: true,
    filesScanned: scannedFiles.length,
    filesImported,
    counts,
    message: `Scanned ${scannedFiles.length} files. Successfully imported ${filesImported.length} file datasets.`
  };
}

// Migrate legacy JSON on first startup
async function migrateLegacyDataIfPresent(): Promise<void> {
  if (!db) return;
  try {
    const orgCountStmt = db.prepare('SELECT COUNT(*) as cnt FROM organizations');
    let orgCount = 0;
    if (orgCountStmt.step()) {
      orgCount = orgCountStmt.getAsObject().cnt as number || 0;
    }
    orgCountStmt.free();

    // If zero organizations in database, perform full initial scan
    if (orgCount === 0) {
      console.log('[SQLite Seed] Empty database detected. Seeding data from files...');
      await scanAndImportDataFolder(true);
    }
  } catch (err) {
    console.warn('[SQLite Legacy Migration Error]:', err);
  }
}

// Deduplicate any duplicate organizations safely
function cleanupDuplicateOrgs(database: Database): void {
  try {
    const protectedOrgIds = new Set(['org-admin']);
    const stmt = database.prepare('SELECT id, name, code, owner_mobile, created_at FROM organizations WHERE status != "deleted" ORDER BY created_at ASC, id ASC');
    const seenMap = new Map<string, string>();
    const idsToDelete: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const orgId = row.id as string;
      if (protectedOrgIds.has(orgId)) {
        continue;
      }
      const cleanMobile = (row.owner_mobile as string || '').replace(/\D/g, '');
      const cleanName = (row.name as string || '').trim().toLowerCase();
      if (cleanMobile.length >= 10 && cleanName && cleanName !== 'organization' && cleanName !== 'service center') {
        const dedupeKey = `${cleanName}_${cleanMobile}`;
        if (cleanMobile === '8149862034') {
          continue;
        }
        if (seenMap.has(dedupeKey)) {
          idsToDelete.push(orgId);
        } else {
          seenMap.set(dedupeKey, orgId);
        }
      }
    }
    stmt.free();

    for (const dupId of idsToDelete) {
      database.run('DELETE FROM organizations WHERE id = ?', [dupId]);
      console.log(`[Dedupe] Cleaned up duplicate organization record: ${dupId}`);
    }
  } catch (err) {
    console.warn('[Dedupe] Error cleaning up duplicates:', err);
  }
}

// Backup creation and management
export function createBackupSnapshot(): string {
  if (!db) throw new Error('Database not initialized');
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `inoms_backup_${timestamp}.db`;
  const backupPath = path.join(BACKUPS_DIR, filename);

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(backupPath, buffer);
  console.log(`[Backup] Created backup snapshot: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);

  // Maintain max 30 backups
  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('inoms_backup_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 30) {
      for (const oldFile of files.slice(30)) {
        fs.unlinkSync(path.join(BACKUPS_DIR, oldFile.name));
      }
    }
  } catch (cleanupErr) {}

  return filename;
}

export function listBackups(): { filename: string; sizeBytes: number; createdAt: string }[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  try {
    return fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.startsWith('inoms_backup_') && f.endsWith('.db'))
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

export function deleteBackupFile(filename: string): boolean {
  const filePath = path.join(BACKUPS_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function restoreBackupFile(filename: string): boolean {
  const filePath = path.join(BACKUPS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file ${filename} not found`);
  }
  if (!sqlInstance) {
    throw new Error('SQLite engine not initialized yet');
  }
  const fileBuffer = fs.readFileSync(filePath);
  db = new sqlInstance.Database(fileBuffer);
  persistDatabase();
  console.log(`[Backup] Restored database from backup: ${filename}`);
  return true;
}

function setupBackupScheduler(): void {
  const timer = setInterval(() => {
    try {
      createBackupSnapshot();
    } catch (e) {
      console.error('[Backup] Scheduled backup failed:', e);
    }
  }, 24 * 60 * 60 * 1000);
  if (timer.unref) timer.unref();
}

export function exportTenantToDisk(tenantId: string): void {
  if (!db || !tenantId) return;
  try {
    const orgFolder = path.join(ORGS_DIR, tenantId);
    if (!fs.existsSync(orgFolder)) {
      fs.mkdirSync(orgFolder, { recursive: true });
    }

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

    const collections = ['clients', 'jobs', 'invoices', 'payments', 'products', 'expenses', 'ledger', 'users', 'categories', 'racks', 'equipments', 'problems'];
    const tenantData: Record<string, any[]> = {};

    for (const col of collections) {
      const items: any[] = [];
      try {
        const stmt = db.prepare(`SELECT data_json FROM ${col} WHERE (tenant_id = ? OR organization_id = ?)`);
        stmt.bind([tenantId, tenantId]);
        while (stmt.step()) {
          const row = stmt.getAsObject();
          if (row.data_json) {
            try {
              items.push(JSON.parse(row.data_json as string));
            } catch (e) {}
          }
        }
        stmt.free();
      } catch (err) {}
      tenantData[col] = items;
    }

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

  return await scanAndImportDataFolder(true);
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database is not initialized yet. Call initDatabase() first.');
  return db;
}
