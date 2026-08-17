-- ============================================================================
-- INOMS (Inward Outward Management System) - PostgreSQL Initial Schema Migration
-- Migration: 001_initial_schema.sql
-- Description: Multi-tenant relational schema with foreign keys, indexes,
--              numeric financial precision, and audit logging.
-- ============================================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS / TENANTS
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

CREATE INDEX IF NOT EXISTS idx_orgs_code ON organizations(code);
CREATE INDEX IF NOT EXISTS idx_orgs_mobile ON organizations(owner_mobile);
CREATE INDEX IF NOT EXISTS idx_orgs_status ON organizations(status);

-- 2. TENANT CONFIGURATIONS
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

-- 3. USERS & STAFF
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
    version INTEGER DEFAULT 1,
    CONSTRAINT uq_users_tenant_username UNIQUE (tenant_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(tenant_id, role);

-- 4. USER AUTHENTICATION SESSIONS
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

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON sessions(tenant_id);

-- 5. CLIENTS / CUSTOMERS
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

CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(tenant_id, name);

-- 6. REPAIR JOBS / INWARD-OUTWARD TICKETS
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
    version INTEGER DEFAULT 1,
    CONSTRAINT uq_jobs_tenant_job_no UNIQUE (tenant_id, job_no)
);

CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_no ON jobs(tenant_id, job_no);

-- 7. BILLING INVOICES
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
    version INTEGER DEFAULT 1,
    CONSTRAINT uq_invoices_tenant_inv_no UNIQUE (tenant_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(tenant_id, status);

-- 8. PAYMENTS & TRANSACTIONS
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

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON payments(tenant_id, client_id);

-- 9. PRODUCTS & INVENTORY
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
    version INTEGER DEFAULT 1,
    CONSTRAINT uq_products_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(tenant_id, code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(tenant_id, category);

-- 10. EXPENSES
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
    version INTEGER DEFAULT 1,
    CONSTRAINT uq_expenses_tenant_exp_no UNIQUE (tenant_id, expense_no)
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);

-- 11. FINANCIAL LEDGER
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

CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_client ON ledger(tenant_id, client_id);

-- 12. CATEGORIES
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

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- 13. RACKS & STORAGE LOCATIONS
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

CREATE INDEX IF NOT EXISTS idx_racks_tenant ON racks(tenant_id);

-- 14. EQUIPMENTS & MODELS
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

CREATE INDEX IF NOT EXISTS idx_equipments_tenant ON equipments(tenant_id);

-- 15. COMMON PROBLEMS & SOLUTIONS
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

CREATE INDEX IF NOT EXISTS idx_problems_tenant ON problems(tenant_id);

-- 16. AUDIT LOGS
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

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(tenant_id, entity, entity_id);

-- 17. SYNC REVISIONS & DELTA CHANGELOG (GIT-LIKE SYNC SUPPORT)
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

CREATE INDEX IF NOT EXISTS idx_change_log_rev ON change_log(tenant_id, revision);
CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(tenant_id, entity, entity_id);
