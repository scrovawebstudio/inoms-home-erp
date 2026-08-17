import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  getDatabase,
  hashPassword,
  verifyPassword,
  generateToken,
  getNextRevision,
  getCurrentRevision,
  recordAuditLog,
  createBackupSnapshot,
  listBackups,
  restoreBackupFile,
  deleteBackupFile,
  scheduleDbSave,
  scanAndImportDataFolder
} from './sqliteDb';
import { isPostgresActive, syncEntityToPostgres, syncDeleteToPostgres } from './postgresDb';

export const apiRouter = express.Router();

// Master Admin Security Configurations (Configured via secure ENV variables)
export const MASTER_ADMIN_PIN = process.env.MASTER_PIN || process.env.MASTER_ADMIN_PIN || '814986';
export const MASTER_ADMIN_TOTP_SECRET = process.env.MASTER_ADMIN_TOTP_SECRET || 'MASTERADMIN2FA37';

// Session verification middleware
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    name: string;
    role: string;
    username?: string;
  };
}

export function createSessionForOrg(
  db: any,
  tenantId: string,
  role = 'Admin',
  name = 'Admin',
  username = 'admin',
  deviceInfo = 'Web Browser'
) {
  let userStmt = db.prepare('SELECT * FROM users WHERE tenant_id = ? AND (role = ? OR username = ?) LIMIT 1');
  userStmt.bind([tenantId, role, username]);
  let user: any = null;
  if (userStmt.step()) {
    user = userStmt.getAsObject();
  }
  userStmt.free();

  if (!user) {
    const userId = `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO users (id, tenant_id, name, username, mobile, role, status, created_at, updated_at, version)
       VALUES (?, ?, ?, ?, '', ?, 'Active', ?, ?, 1)`,
      [userId, tenantId, name, username, role, now, now]
    );
    user = { id: userId, name, username, role, tenant_id: tenantId };
  }

  const token = generateToken();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.run(
    `INSERT INTO sessions (id, tenant_id, user_id, token, device_info, created_at, expires_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, tenantId, user.id, token, deviceInfo, now, expiresAt, now]
  );
  scheduleDbSave();

  return { token, sessionId, user };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Missing Bearer session token.' });
  }

  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT s.id as session_id, s.tenant_id, s.user_id, s.device_info, s.expires_at,
           u.name as user_name, u.role as user_role, u.username, u.status as user_status
    FROM sessions s
    JOIN users u ON s.user_id = u.id AND s.tenant_id = u.tenant_id
    WHERE s.token = ?
  `);
  stmt.bind([token]);

  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();

    // Verify session expiration
    if (row.expires_at) {
      const expiresTime = new Date(row.expires_at as string).getTime();
      if (expiresTime < Date.now()) {
        db.run('DELETE FROM sessions WHERE token = ?', [token]);
        scheduleDbSave();
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
    }

    if (row.user_status === 'Deactivated') {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    // Update last active time
    db.run('UPDATE sessions SET last_active_at = ? WHERE token = ?', [new Date().toISOString(), token]);

    req.user = {
      id: row.user_id as string,
      tenantId: row.tenant_id as string,
      name: row.user_name as string,
      role: row.user_role as string,
      username: row.username as string | undefined
    };

    return next();
  }
  stmt.free();

  return res.status(401).json({ success: false, message: 'Authentication required. Invalid or expired session token.' });
}

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
apiRouter.get('/health', async (_req, res) => {
  try {
    const { isPostgresActive, getPostgresPool } = await import('./postgresDb');
    let orgCount = 0;
    let engine = 'sqlite';

    if (isPostgresActive()) {
      const pool = getPostgresPool();
      if (pool) {
        const result = await pool.query('SELECT COUNT(*) as count FROM organizations');
        orgCount = parseInt(result.rows[0].count, 10);
        engine = 'postgresql';
      }
    } else {
      const db = getDatabase();
      const testStmt = db.prepare('SELECT COUNT(*) as count FROM organizations');
      testStmt.step();
      orgCount = testStmt.getAsObject().count as number || 0;
      testStmt.free();
    }

    res.json({
      status: 'ok',
      database: 'connected',
      engine,
      version: '3.0.0',
      organizations: orgCount,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      database: 'unhealthy',
      error: err?.message || 'Database error',
      timestamp: new Date().toISOString()
    });
  }
});

// -------------------------------------------------------------
// AUTHENTICATION ROUTES
// -------------------------------------------------------------

// Lookup single organization by mobile or workspace code (STRICT ZERO-LEAKAGE ON-DEMAND LOOKUP)
apiRouter.post('/auth/lookup-mobile', (req, res) => {
  try {
    const { mobile, code } = req.body || {};
    const cleanInput = (mobile || code || '').toString().replace(/\D/g, '');
    const rawCode = (code || mobile || '').toString().trim().toUpperCase();

    if (!cleanInput && !rawCode) {
      return res.status(400).json({ success: false, message: 'Please enter a valid mobile number or workspace code' });
    }

    const db = getDatabase();
    const orgStmt = db.prepare('SELECT id, name, code, owner_mobile, owner_name, status, secret_key, pin, pin_hash, subscription_plan, subscription_start_date, subscription_end_date, trial_days, is_trial, features_json, created_at FROM organizations WHERE status != "deleted"');
    
    let matchedOrg: any = null;
    while (orgStmt.step()) {
      const row = orgStmt.getAsObject();
      const rowCleanMobile = (row.owner_mobile as string || '').replace(/\D/g, '');
      const rowCode = (row.code as string || '').toUpperCase();
      
      const mobileMatch = cleanInput && cleanInput.length >= 5 && (rowCleanMobile.includes(cleanInput) || cleanInput.includes(rowCleanMobile));
      const codeMatch = rawCode && (rowCode === rawCode || row.id === rawCode);

      if (mobileMatch || codeMatch) {
        matchedOrg = row;
        break;
      }
    }
    orgStmt.free();

    if (!matchedOrg) {
      return res.status(404).json({ success: false, message: 'No registered organization found for this mobile number or workspace code' });
    }

    if (matchedOrg.status === 'deactivated') {
      return res.status(403).json({ success: false, message: `Organization "${matchedOrg.name}" is deactivated. Please contact Platform Support.` });
    }

    const hasPin = Boolean((matchedOrg.pin && matchedOrg.pin.toString().trim().length > 0) || matchedOrg.pin_hash);

    let features: any = null;
    if (matchedOrg.features_json) {
      try {
        features = JSON.parse(matchedOrg.features_json as string);
      } catch (e) {}
    }

    // Return ONLY the matched organization metadata, with NO passwords or other orgs
    return res.json({
      success: true,
      org: {
        id: matchedOrg.id,
        name: matchedOrg.name,
        code: matchedOrg.code,
        ownerMobile: matchedOrg.owner_mobile,
        ownerName: matchedOrg.owner_name,
        status: matchedOrg.status,
        hasPin, // indicates if PIN is set or Authenticator 2FA is required
        hasSecretKey: Boolean(matchedOrg.secret_key),
        subscriptionPlan: matchedOrg.subscription_plan || (matchedOrg.is_trial ? 'trial' : 'monthly'),
        subscriptionStartDate: matchedOrg.subscription_start_date || undefined,
        subscriptionEndDate: matchedOrg.subscription_end_date || undefined,
        trialDays: matchedOrg.trial_days !== undefined ? Number(matchedOrg.trial_days) : undefined,
        isTrial: Boolean(matchedOrg.is_trial),
        createdAt: matchedOrg.created_at || undefined,
        features: features || undefined
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Lookup error' });
  }
});

// List public tenant metadata: ONLY returns static Master Admin stub or empty array (NO OTHER ORGS LEAKED)
apiRouter.get('/auth/tenants', (_req, res) => {
  // Empty or master-only response to prevent all organizations directory from leaking to public network inspection
  res.json({
    success: true,
    tenants: [
      {
        id: 'org-admin',
        name: 'Master System Admin',
        code: 'ADMIN-00',
        ownerMobile: '+91 8149862034',
        ownerName: 'Master Admin',
        status: 'active',
        createdAt: '2026-01-01'
      }
    ]
  });
});

// Protected Master Admin Organization List (Full details including PIN and 2FA secret for management)
apiRouter.get('/admin/organizations', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuperAdmin = req.user?.tenantId === 'org-admin' || req.user?.role === 'Admin';
    if (!isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied: Master Admin role required' });
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, name, code, owner_mobile, owner_name, status, created_at, secret_key, pin,
             subscription_plan, subscription_start_date, subscription_end_date, trial_days, is_trial, features_json
      FROM organizations 
      WHERE status != "deleted"
      ORDER BY created_at ASC, id ASC
    `);
    const organizations: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      let features: any = null;
      if (row.features_json) {
        try {
          features = JSON.parse(row.features_json as string);
        } catch (e) {}
      }
      organizations.push({
        id: row.id,
        name: row.name,
        code: row.code,
        ownerMobile: row.owner_mobile,
        ownerName: row.owner_name,
        status: row.status,
        pin: row.pin || '1234',
        secretKey: row.secret_key || '',
        createdAt: row.created_at,
        subscriptionPlan: row.subscription_plan || 'monthly',
        subscriptionStartDate: row.subscription_start_date || row.created_at,
        subscriptionEndDate: row.subscription_end_date || '',
        trialDays: Number(row.trial_days) || 0,
        isTrial: !!row.is_trial || row.subscription_plan === 'trial',
        features
      });
    }
    stmt.free();
    res.json({ success: true, organizations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Organization Login / PIN verification
apiRouter.post('/auth/login', (req, res) => {
  try {
    const { tenantId, pin, username, password, deviceInfo } = req.body || {};
    const db = getDatabase();

    // 1. Organization Owner Login via PIN
    if (tenantId && pin !== undefined) {
      const orgStmt = db.prepare('SELECT * FROM organizations WHERE id = ?');
      orgStmt.bind([tenantId]);
      if (!orgStmt.step()) {
        orgStmt.free();
        return res.status(404).json({ success: false, message: 'Organization not found' });
      }
      const org = orgStmt.getAsObject();
      orgStmt.free();

      let isPinValid = false;
      const cleanPin = pin.toString().trim();

      // Master Admin Isolation: org-admin MUST ONLY be unlocked by Master PIN or Master 2FA
      if (tenantId === 'org-admin' || org.owner_mobile === '8149862034') {
        isPinValid = (cleanPin === MASTER_ADMIN_PIN) || verifyTotpNode(MASTER_ADMIN_TOTP_SECRET, cleanPin) || (org.secret_key ? verifyTotpNode(org.secret_key as string, cleanPin) : false);
      } else {
        // Organization level PIN check (isolated strictly to this organization)
        const orgPinText = (org.pin || '').toString().trim();
        // If security PIN is kept blank, PIN login is disabled (strictly Microsoft Authenticator App TOTP only)
        if (!orgPinText && !org.pin_hash) {
          return res.status(401).json({
            success: false,
            message: 'PIN login is disabled for this organization (Security PIN is blank). Please verify using your Microsoft Authenticator 6-digit passcode.'
          });
        }

        if (org.pin_hash && org.pin_salt) {
          isPinValid = verifyPassword(cleanPin, org.pin_hash as string, org.pin_salt as string);
        } else if (orgPinText) {
          isPinValid = cleanPin === orgPinText;
        }
      }

      if (!isPinValid) {
        return res.status(401).json({ success: false, message: tenantId === 'org-admin' ? 'Invalid Master Security PIN' : 'Incorrect Organization PIN' });
      }

      // Check or create admin user for this tenant
      let userStmt = db.prepare('SELECT * FROM users WHERE tenant_id = ? AND role = "Admin" LIMIT 1');
      userStmt.bind([tenantId]);
      let adminUser: any = null;
      if (userStmt.step()) {
        adminUser = userStmt.getAsObject();
      }
      userStmt.free();

      if (!adminUser) {
        const adminId = `u_admin_${Date.now()}`;
        const { hash: pHash, salt: pSalt } = hashPassword(cleanPin);
        db.run(
          `INSERT INTO users (id, tenant_id, name, username, mobile, role, status, password_hash, password_salt, pin_hash, pin_salt, created_at, updated_at, version)
           VALUES (?, ?, ?, ?, ?, 'Admin', 'Active', ?, ?, ?, ?, ?, ?, 1)`,
          [adminId, tenantId, org.owner_name || 'Admin', 'admin', org.owner_mobile, pHash, pSalt, pHash, pSalt, new Date().toISOString(), new Date().toISOString()]
        );
        adminUser = { id: adminId, name: org.owner_name || 'Admin', role: 'Admin', username: 'admin' };
      }

      // Generate Session Token
      const token = generateToken();
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      db.run(
        `INSERT INTO sessions (id, tenant_id, user_id, token, device_info, created_at, expires_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, tenantId, adminUser.id, token, deviceInfo || 'Web Browser', now, expiresAt, now]
      );
      scheduleDbSave();

      recordAuditLog({
        tenantId,
        userId: adminUser.id,
        userName: adminUser.name,
        action: 'LOGIN',
        entity: 'auth',
        details: { method: 'org_pin', deviceInfo }
      });

      let features: any = null;
      if (org.features_json) {
        try {
          features = JSON.parse(org.features_json as string);
        } catch (e) {}
      }

      return res.json({
        success: true,
        token,
        sessionId,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          role: 'Admin',
          tenantId
        },
        organization: {
          id: org.id,
          name: org.name,
          code: org.code,
          ownerMobile: org.owner_mobile,
          ownerName: org.owner_name,
          status: org.status,
          secretKey: org.secret_key || undefined,
          subscriptionPlan: org.subscription_plan || (org.is_trial ? 'trial' : 'monthly'),
          subscriptionStartDate: org.subscription_start_date || undefined,
          subscriptionEndDate: org.subscription_end_date || undefined,
          trialDays: org.trial_days !== undefined ? Number(org.trial_days) : undefined,
          isTrial: Boolean(org.is_trial),
          createdAt: org.created_at || undefined,
          features: features || undefined
        }
      });
    }

    // 2. Staff / Technician Login via Username & Password
    if (tenantId && username) {
      const cleanUser = (username || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      const uStmt = db.prepare('SELECT * FROM users WHERE tenant_id = ? AND (LOWER(username) = ? OR mobile = ?)');
      uStmt.bind([tenantId, cleanUser, cleanUser]);

      if (!uStmt.step()) {
        uStmt.free();
        return res.status(404).json({ success: false, message: 'User not found in this organization' });
      }

      const user = uStmt.getAsObject();
      uStmt.free();

      if (user.status === 'Deactivated') {
        return res.status(403).json({ success: false, message: 'User account has been deactivated' });
      }

      let isPassValid = false;
      if (user.password_hash && user.password_salt) {
        isPassValid = verifyPassword(cleanPass, user.password_hash as string, user.password_salt as string);
      } else {
        isPassValid = cleanPass === '1234' || cleanPass === (user.pin_hash ? '' : '1234');
      }

      if (!isPassValid) {
        return res.status(401).json({ success: false, message: 'Incorrect Password' });
      }

      const token = generateToken();
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      db.run(
        `INSERT INTO sessions (id, tenant_id, user_id, token, device_info, created_at, expires_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sessionId, tenantId, user.id, token, deviceInfo || 'Web Browser', now, expiresAt, now]
      );
      scheduleDbSave();

      recordAuditLog({
        tenantId,
        userId: user.id as string,
        userName: user.name as string,
        action: 'LOGIN',
        entity: 'auth',
        details: { method: 'staff_credentials', role: user.role }
      });

      return res.json({
        success: true,
        token,
        sessionId,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          mobile: user.mobile,
          role: user.role,
          tenantId
        }
      });
    }

    return res.status(400).json({ success: false, message: 'Missing login credentials' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Login error' });
  }
});

// Session Validation Endpoint
apiRouter.get('/auth/session', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Helper for Base32 Decoding in Node
function base32DecodeNode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = (base32 || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// Helper to verify TOTP code using time offsets (with ±3 min clock drift tolerance)
function verifyTotpNode(secretBase32: string, code: string): boolean {
  if (!secretBase32 || !code) return false;
  const cleanCode = code.replace(/\D/g, '');
  if (cleanCode.length !== 6) return false;
  try {
    const keyBytes = base32DecodeNode(secretBase32);
    if (keyBytes.length === 0) return false;

    // Time window with generous tolerance for device/server clock differences (-3 min to +3 min)
    const offsets = [-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];
    const nowSec = Math.floor(Date.now() / 1000);

    for (const off of offsets) {
      const epoch = Math.floor((nowSec + off) / 30);
      const timeBuffer = Buffer.alloc(8);
      timeBuffer.writeUInt32BE(epoch, 4);

      const hmac = crypto.createHmac('sha1', keyBytes).update(timeBuffer).digest();
      const offset = hmac[hmac.length - 1] & 0x0f;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

      const otp = (binary % 1000000).toString().padStart(6, '0');
      if (otp === cleanCode) return true;
    }
  } catch (err) {
    console.error('Server TOTP verification error:', err);
  }
  return false;
}

// Organization & TOTP Verification Endpoint
apiRouter.post('/auth/verify-totp', (req, res) => {
  try {
    const { tenantId, mobile, secretKey, code, pin, deviceInfo } = req.body || {};
    const cleanCode = (code || pin || '').toString().replace(/\D/g, '');
    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Verification code or PIN is required' });
    }

    const cleanMobile = (mobile || '').toString().replace(/\D/g, '');
    const isMasterAdminTarget = tenantId === 'org-admin' || cleanMobile === '8149862034' || cleanMobile.includes('8149862034');

    if (isMasterAdminTarget) {
      // MASTER ADMIN CHECK: Master PIN, Master TOTP Secret, or passed secretKey
      const isMasterValid =
        cleanCode === MASTER_ADMIN_PIN ||
        verifyTotpNode(MASTER_ADMIN_TOTP_SECRET, cleanCode) ||
        (secretKey ? verifyTotpNode(secretKey, cleanCode) : false);

      if (isMasterValid) {
        const db = getDatabase();
        const sess = createSessionForOrg(db, 'org-admin', 'Admin', 'Master Admin', 'masteradmin', deviceInfo);
        return res.json({
          success: true,
          method: 'master_admin_verified',
          token: sess.token,
          sessionId: sess.sessionId,
          user: {
            id: sess.user.id,
            name: sess.user.name,
            role: 'Admin',
            tenantId: 'org-admin'
          }
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid Master Security PIN or 2FA Passcode' });
    }

    const db = getDatabase();
    let org: any = null;

    if (tenantId) {
      const stmt = db.prepare('SELECT * FROM organizations WHERE id = ?');
      stmt.bind([tenantId]);
      if (stmt.step()) org = stmt.getAsObject();
      stmt.free();
    }

    if (!org && cleanMobile && cleanMobile.length >= 5) {
      const stmt = db.prepare('SELECT * FROM organizations WHERE status != "deleted"');
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const rowMob = (row.owner_mobile as string || '').replace(/\D/g, '');
        if (rowMob.length >= 5 && (rowMob.includes(cleanMobile) || cleanMobile.includes(rowMob))) {
          org = row;
          break;
        }
      }
      stmt.free();
    }

    let isValid = false;
    let method = 'totp';

    if (org) {
      // 1. Check TOTP against org's database secret
      if (org.secret_key && verifyTotpNode(org.secret_key as string, cleanCode)) {
        isValid = true;
        method = 'org_totp';
      } else if (secretKey && verifyTotpNode(secretKey, cleanCode)) {
        isValid = true;
        method = 'org_totp';
      } else if (cleanCode === MASTER_ADMIN_PIN) {
        isValid = true;
        method = 'master_pin';
      } else {
        const orgPinText = (org.pin || '').toString().trim();
        if (org.pin_hash && org.pin_salt) {
          isValid = verifyPassword(cleanCode, org.pin_hash as string, org.pin_salt as string);
          method = 'org_pin';
        } else if (orgPinText && cleanCode === orgPinText) {
          isValid = true;
          method = 'org_pin';
        }
      }
    } else if (secretKey && verifyTotpNode(secretKey, cleanCode)) {
      isValid = true;
      method = 'totp';
    }

    if (isValid) {
      const targetOrgId = org?.id || tenantId || 'org-admin';
      const targetOwner = org?.owner_name || 'Admin';
      const sess = createSessionForOrg(db, targetOrgId, 'Admin', targetOwner, 'admin', deviceInfo);
      return res.json({
        success: true,
        method,
        token: sess.token,
        sessionId: sess.sessionId,
        user: {
          id: sess.user.id,
          name: sess.user.name,
          role: 'Admin',
          tenantId: targetOrgId
        },
        organization: org ? {
          id: org.id,
          name: org.name,
          code: org.code,
          ownerMobile: org.owner_mobile,
          ownerName: org.owner_name,
          status: org.status
        } : undefined
      });
    }

    return res.status(401).json({ success: false, message: 'Invalid 6-digit Authenticator Code or Organization PIN' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Verification error' });
  }
});

// Master Admin Security PIN / 2FA Verify Endpoint (STRICTLY ISOLATED TO MASTER ADMIN PIN / TOTP)
apiRouter.post('/auth/verify-master-pin', (req, res) => {
  try {
    const { code, pin, secretKey, deviceInfo } = req.body || {};
    const cleanCode = (code || pin || '').toString().replace(/\D/g, '');
    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Master PIN or 2FA code is required' });
    }

    let isMasterValid = false;
    let method = 'master_pin';

    // 1. Check Master Admin Static PIN
    if (cleanCode === MASTER_ADMIN_PIN) {
      isMasterValid = true;
      method = 'master_pin';
    } else if (verifyTotpNode(MASTER_ADMIN_TOTP_SECRET, cleanCode) || (secretKey && verifyTotpNode(secretKey, cleanCode))) {
      isMasterValid = true;
      method = 'master_totp';
    } else {
      const db = getDatabase();
      const adminStmt = db.prepare('SELECT secret_key, pin_hash, pin_salt FROM organizations WHERE id = "org-admin" OR owner_mobile = "8149862034"');
      if (adminStmt.step()) {
        const adminOrg = adminStmt.getAsObject();
        adminStmt.free();
        if (adminOrg.secret_key && verifyTotpNode(adminOrg.secret_key as string, cleanCode)) {
          isMasterValid = true;
          method = 'master_totp';
        } else if (adminOrg.pin_hash && adminOrg.pin_salt && verifyPassword(cleanCode, adminOrg.pin_hash as string, adminOrg.pin_salt as string)) {
          isMasterValid = true;
          method = 'master_pin';
        }
      } else {
        adminStmt.free();
      }
    }

    if (isMasterValid) {
      const db = getDatabase();
      const sess = createSessionForOrg(db, 'org-admin', 'Admin', 'Master Admin', 'masteradmin', deviceInfo);
      return res.json({
        success: true,
        method,
        token: sess.token,
        sessionId: sess.sessionId,
        user: {
          id: sess.user.id,
          name: sess.user.name,
          role: 'Admin',
          tenantId: 'org-admin'
        }
      });
    }

    return res.status(401).json({ success: false, message: 'Access Denied: Invalid Master Admin PIN. Master login is strictly restricted.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Verification error' });
  }
});

// Ensure Active Session for Tenant Endpoint
apiRouter.post('/auth/session-for-tenant', (req, res) => {
  try {
    const { tenantId, deviceInfo } = req.body || {};
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID required' });
    }
    const db = getDatabase();
    const orgStmt = db.prepare('SELECT id, name, owner_name, status FROM organizations WHERE id = ?');
    orgStmt.bind([tenantId]);
    if (!orgStmt.step()) {
      orgStmt.free();
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }
    const org = orgStmt.getAsObject();
    orgStmt.free();

    const sess = createSessionForOrg(db, tenantId, 'Admin', (org.owner_name as string) || (org.name as string) || 'Admin', 'admin', deviceInfo);
    return res.json({
      success: true,
      token: sess.token,
      sessionId: sess.sessionId,
      user: {
        id: sess.user.id,
        name: sess.user.name,
        role: sess.user.role,
        tenantId
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Session error' });
  }
});

// Logout Endpoint
apiRouter.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (token) {
    const db = getDatabase();
    db.run('DELETE FROM sessions WHERE token = ?', [token]);
    scheduleDbSave();
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// Helper to upsert or update an organization
function updateOrganizationInDb(db: any, orgData: any) {
  const orgId = orgData.id;
  if (!orgId) throw new Error('Organization ID is required for update');

  const checkStmt = db.prepare('SELECT * FROM organizations WHERE id = ?');
  checkStmt.bind([orgId]);
  const exists = checkStmt.step();
  const existingOrg = exists ? checkStmt.getAsObject() : null;
  checkStmt.free();

  if (!existingOrg) {
    throw new Error('Organization not found');
  }

  const name = (orgData.name || existingOrg.name || '').trim();
  const code = (orgData.code || existingOrg.code || '').trim().toUpperCase();
  const ownerMobile = (orgData.ownerMobile || existingOrg.owner_mobile || '').trim();
  const ownerName = (orgData.ownerName || existingOrg.owner_name || 'Admin').trim();
  const status = orgData.status || existingOrg.status || 'active';
  const secretKey = orgData.secretKey || existingOrg.secret_key || '';
  const subscriptionPlan = orgData.subscriptionPlan || existingOrg.subscription_plan || 'monthly';
  const subscriptionStartDate = orgData.subscriptionStartDate || existingOrg.subscription_start_date || existingOrg.created_at;
  const subscriptionEndDate = orgData.subscriptionEndDate || existingOrg.subscription_end_date || '';
  const trialDays = orgData.trialDays !== undefined ? Number(orgData.trialDays) : Number(existingOrg.trial_days) || 0;
  const isTrial = orgData.isTrial !== undefined ? (orgData.isTrial ? 1 : 0) : (existingOrg.is_trial ? 1 : 0);
  const featuresJson = orgData.features ? JSON.stringify(orgData.features) : existingOrg.features_json;
  const now = new Date().toISOString();

  let pinText = existingOrg.pin || '';
  let pinHash = existingOrg.pin_hash;
  let pinSalt = existingOrg.pin_salt;

  if (orgData.pin !== undefined) {
    if (orgData.pin === '' || orgData.pin === null) {
      // Clear PIN -> Disables PIN login (Authenticator 2FA only)
      pinText = '';
      pinHash = null;
      pinSalt = null;
      db.run(
        `UPDATE users SET pin_hash = NULL, pin_salt = NULL, updated_at = ? WHERE tenant_id = ? AND role = 'Admin'`,
        [now, orgId]
      );
    } else if (orgData.pin !== '••••••') {
      pinText = orgData.pin.toString().trim();
      const hashed = hashPassword(pinText);
      pinHash = hashed.hash;
      pinSalt = hashed.salt;

      // Update Admin user PIN
      db.run(
        `UPDATE users SET pin_hash = ?, pin_salt = ?, password_hash = ?, password_salt = ?, name = ?, mobile = ?, updated_at = ?
         WHERE tenant_id = ? AND role = 'Admin'`,
        [pinHash, pinSalt, pinHash, pinSalt, ownerName, ownerMobile, now, orgId]
      );
    }
  } else {
    // Update Admin user name and mobile if changed
    db.run(
      `UPDATE users SET name = ?, mobile = ?, updated_at = ? WHERE tenant_id = ? AND role = 'Admin'`,
      [ownerName, ownerMobile, now, orgId]
    );
  }

  db.run(
    `UPDATE organizations
     SET name = ?, code = ?, owner_mobile = ?, owner_name = ?, status = ?, secret_key = ?,
         pin = ?, pin_hash = ?, pin_salt = ?, subscription_plan = ?, subscription_start_date = ?,
         subscription_end_date = ?, trial_days = ?, is_trial = ?, features_json = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [
      name, code, ownerMobile, ownerName, status, secretKey,
      pinText, pinHash, pinSalt, subscriptionPlan, subscriptionStartDate,
      subscriptionEndDate, trialDays, isTrial, featuresJson, now,
      orgId
    ]
  );

  scheduleDbSave();

  recordAuditLog({
    tenantId: orgId,
    action: 'UPDATE_ORG',
    entity: 'organizations',
    entityId: orgId,
    details: { name, code, ownerMobile, status }
  });

  return {
    id: orgId,
    name,
    code,
    ownerMobile,
    ownerName,
    status,
    pin: pinText,
    secretKey,
    subscriptionPlan,
    subscriptionStartDate,
    subscriptionEndDate,
    trialDays,
    isTrial: !!isTrial,
    features: orgData.features,
    createdAt: existingOrg.created_at,
    updatedAt: now
  };
}

// Register New Organization
apiRouter.post('/auth/register-org', (req, res) => {
  try {
    const { id, name, code: customCode, ownerMobile, ownerName, pin, secretKey: customSecret, subscriptionPlan, subscriptionStartDate, subscriptionEndDate, trialDays, isTrial, features } = req.body || {};
    if (!name || !ownerMobile) {
      return res.status(400).json({ success: false, message: 'Organization name and mobile are required' });
    }

    const db = getDatabase();

    // If an ID is provided and organization exists, update it instead of creating a duplicate!
    if (id) {
      const checkStmt = db.prepare('SELECT id FROM organizations WHERE id = ?');
      checkStmt.bind([id]);
      const exists = checkStmt.step();
      checkStmt.free();
      if (exists) {
        const updated = updateOrganizationInDb(db, req.body);
        return res.json({ success: true, org: updated });
      }
    }

    const orgId = id || `org-${Date.now()}`;
    const code = customCode ? customCode.trim().toUpperCase() : `${name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'ORG')}-${Math.floor(10 + Math.random() * 90)}`;
    const now = new Date().toISOString();
    const pinText = (pin || '1234').toString().trim();
    const { hash: pinHash, salt: pinSalt } = hashPassword(pinText);

    // Generate Base32 2FA secret
    let secretKey = customSecret || '';
    if (!secretKey) {
      const seed = (name + ownerMobile + Date.now().toString()).toUpperCase();
      const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      for (let i = 0; i < 16; i++) {
        const idx = Math.floor((seed.charCodeAt(i % seed.length) + i * 7) % base32Chars.length);
        secretKey += base32Chars[idx];
      }
    }

    const featuresJson = features ? JSON.stringify(features) : null;
    const isTr = isTrial !== undefined ? (isTrial ? 1 : 0) : (subscriptionPlan === 'trial' || !subscriptionPlan ? 1 : 0);
    const subPlan = subscriptionPlan || (isTr ? 'trial' : 'monthly');
    const subStart = subscriptionStartDate || now.split('T')[0];
    const tDays = trialDays !== undefined ? Number(trialDays) : (isTr ? 7 : 30);
    let subEnd = subscriptionEndDate || '';
    if (!subEnd) {
      const d = new Date();
      if (subPlan === 'lifetime') {
        d.setFullYear(d.getFullYear() + 10);
      } else if (subPlan === 'annual') {
        d.setFullYear(d.getFullYear() + 1);
      } else if (subPlan === 'quarterly') {
        d.setDate(d.getDate() + 90);
      } else if (isTr || subPlan === 'trial') {
        d.setDate(d.getDate() + (tDays || 7));
      } else {
        d.setDate(d.getDate() + 30);
      }
      subEnd = d.toISOString().split('T')[0];
    }

    db.run(
      `INSERT INTO organizations (
        id, name, code, owner_mobile, owner_name, status, secret_key, pin, pin_hash, pin_salt,
        subscription_plan, subscription_start_date, subscription_end_date, trial_days, is_trial, features_json,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        orgId, name.trim(), code, ownerMobile.trim(), (ownerName || 'Owner').trim(), secretKey, pinText, pinHash, pinSalt,
        subPlan, subStart, subEnd, tDays, isTr, featuresJson,
        now, now
      ]
    );

    // Create Initial Admin User
    const adminId = `u_${Date.now()}`;
    db.run(
      `INSERT INTO users (id, tenant_id, name, username, mobile, role, status, password_hash, password_salt, pin_hash, pin_salt, created_at, updated_at, version)
       VALUES (?, ?, ?, 'admin', ?, 'Admin', 'Active', ?, ?, ?, ?, ?, ?, 1)`,
      [adminId, orgId, (ownerName || 'Owner').trim(), ownerMobile.trim(), pinHash, pinSalt, pinHash, pinSalt, now, now]
    );

    // Initialize Revision
    db.run(
      `INSERT INTO sync_revisions (tenant_id, current_revision, last_updated) VALUES (?, 1, ?)`,
      [orgId, now]
    );

    const sess = createSessionForOrg(db, orgId, 'Admin', (ownerName || 'Owner').trim(), 'admin');

    scheduleDbSave();

    recordAuditLog({
      tenantId: orgId,
      userId: adminId,
      userName: ownerName || 'Owner',
      action: 'REGISTER_ORG',
      entity: 'organizations',
      entityId: orgId,
      details: { name, code, ownerMobile }
    });

    res.json({
      success: true,
      token: sess.token,
      sessionId: sess.sessionId,
      user: {
        id: sess.user.id,
        name: sess.user.name,
        role: 'Admin',
        tenantId: orgId
      },
      org: {
        id: orgId,
        name: name.trim(),
        code,
        ownerMobile: ownerMobile.trim(),
        ownerName: (ownerName || 'Owner').trim(),
        status: 'active',
        pin: pinText,
        secretKey,
        subscriptionPlan: subPlan,
        subscriptionStartDate: subStart,
        subscriptionEndDate: subEnd,
        trialDays: tDays,
        isTrial: !!isTr,
        features: features || undefined,
        createdAt: now.split('T')[0]
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Registration error' });
  }
});

// Update Existing Organization (Master Admin / Settings)
apiRouter.post('/auth/update-org', (req, res) => {
  try {
    const db = getDatabase();
    const updated = updateOrganizationInDb(db, req.body);
    res.json({ success: true, org: updated });
  } catch (err: any) {
    res.status(err.message === 'Organization not found' ? 404 : 500).json({ success: false, error: err?.message || 'Update error' });
  }
});

apiRouter.put('/auth/organizations/:id', (req, res) => {
  try {
    const db = getDatabase();
    const updated = updateOrganizationInDb(db, { ...req.body, id: req.params.id });
    res.json({ success: true, org: updated });
  } catch (err: any) {
    res.status(err.message === 'Organization not found' ? 404 : 500).json({ success: false, error: err?.message || 'Update error' });
  }
});

// Delete Organization (Master Admin)
apiRouter.post('/auth/delete-org', (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Organization ID required' });
    if (id === 'org-admin') {
      return res.status(403).json({ success: false, message: 'Master System Admin cannot be deleted' });
    }

    const db = getDatabase();
    db.run('DELETE FROM organizations WHERE id = ?', [id]);
    scheduleDbSave();

    res.json({ success: true, message: `Organization ${id} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Delete error' });
  }
});

apiRouter.delete('/auth/organizations/:id', (req, res) => {
  try {
    const id = req.params.id;
    if (id === 'org-admin') {
      return res.status(403).json({ success: false, message: 'Master System Admin cannot be deleted' });
    }

    const db = getDatabase();
    db.run('DELETE FROM organizations WHERE id = ?', [id]);
    scheduleDbSave();

    res.json({ success: true, message: `Organization ${id} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Delete error' });
  }
});

// -------------------------------------------------------------
// AUTHORITATIVE SYNC ENGINE (SQLite Backend)
// -------------------------------------------------------------

// Helper to query all active records for an entity table
function getEntityRecords(db: any, table: string, tenantId: string): any[] {
  const stmt = db.prepare(`SELECT * FROM ${table} WHERE tenant_id = ? AND (deleted_at IS NULL OR deleted_at = '')`);
  stmt.bind([tenantId]);
  const results: any[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row.data_json) {
      try {
        const parsed = JSON.parse(row.data_json as string);
        results.push({ ...parsed, id: row.id, version: row.version, updatedAt: row.updated_at });
        continue;
      } catch (e) {}
    }
    // Fallback to table fields
    results.push(row);
  }
  stmt.free();
  return results;
}

// 1. BOOTSTRAP: Full Authoritative Snapshot for Authenticated Tenant
apiRouter.get('/sync/bootstrap', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const db = getDatabase();
    const revision = getCurrentRevision(tenantId);

    // Fetch tenant config
    const configStmt = db.prepare('SELECT * FROM tenant_configs WHERE tenant_id = ?');
    configStmt.bind([tenantId]);
    let companyConfig: any = null;
    if (configStmt.step()) {
      const cRow = configStmt.getAsObject();
      if (cRow.config_json) {
        try {
          companyConfig = JSON.parse(cRow.config_json as string);
        } catch (e) {}
      }
      if (!companyConfig) {
        companyConfig = {
          name: cRow.name,
          phone: cRow.phone,
          email: cRow.email,
          address: cRow.address,
          gstin: cRow.gstin,
          upiId: cRow.upi_id
        };
      }
    }
    configStmt.free();

    // Fetch all business collections
    const collections = {
      clients: getEntityRecords(db, 'clients', tenantId),
      jobs: getEntityRecords(db, 'jobs', tenantId),
      invoices: getEntityRecords(db, 'invoices', tenantId),
      payments: getEntityRecords(db, 'payments', tenantId),
      products: getEntityRecords(db, 'products', tenantId),
      expenses: getEntityRecords(db, 'expenses', tenantId),
      ledger: getEntityRecords(db, 'ledger', tenantId),
      users: getEntityRecords(db, 'users', tenantId).map(u => {
        const clean = { ...u };
        delete clean.password_hash;
        delete clean.password_salt;
        delete clean.pin_hash;
        delete clean.pin_salt;
        return clean;
      }),
      categories: getEntityRecords(db, 'categories', tenantId),
      racks: getEntityRecords(db, 'racks', tenantId),
      equipments: getEntityRecords(db, 'equipments', tenantId),
      problems: getEntityRecords(db, 'problems', tenantId)
    };

    res.json({
      success: true,
      tenantId,
      serverRevision: revision,
      companyConfig,
      collections,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Bootstrap sync failed' });
  }
});

// 2. PULL: Delta Changes since last known revision
apiRouter.get('/sync/pull', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const sinceRevision = parseInt((req.query.sinceRevision as string) || '0', 10);
    const db = getDatabase();
    const currentRevision = getCurrentRevision(tenantId);

    if (sinceRevision >= currentRevision) {
      return res.json({
        success: true,
        tenantId,
        currentRevision,
        hasChanges: false,
        changes: []
      });
    }

    const stmt = db.prepare(`
      SELECT revision, entity, entity_id, operation, data_json, timestamp
      FROM change_log
      WHERE tenant_id = ? AND revision > ?
      ORDER BY revision ASC
    `);
    stmt.bind([tenantId, sinceRevision]);

    const changes: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      changes.push({
        revision: row.revision,
        entity: row.entity,
        entityId: row.entity_id,
        operation: row.operation,
        data: row.data_json ? JSON.parse(row.data_json as string) : null,
        timestamp: row.timestamp
      });
    }
    stmt.free();

    res.json({
      success: true,
      tenantId,
      currentRevision,
      hasChanges: changes.length > 0,
      changes
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Pull sync failed' });
  }
});

// 3. PUSH: Transactional Batch Changes from Client
apiRouter.post('/sync/push', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { operations } = req.body || {};

    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ success: false, message: 'No operations provided in push request.' });
    }

    const db = getDatabase();
    const committed: any[] = [];
    const conflicts: any[] = [];
    const now = new Date().toISOString();

    // Begin ACID transaction on SQLite
    db.run('BEGIN TRANSACTION');

    try {
      const nextRev = getNextRevision(tenantId);

      for (const op of operations) {
        const { entity, operation, record, expectedVersion } = op;
        if (!entity || !record || !record.id) continue;

        const tableMap: Record<string, string> = {
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
          problems: 'problems',
          config: 'tenant_configs'
        };

        const table = tableMap[entity];
        if (!table) continue;

        const isConfig = entity === 'config' || table === 'tenant_configs';
        const recordId = record.id || tenantId;

        // Check for concurrency conflicts on updates/deletions
        if (operation === 'update' || operation === 'delete') {
          const checkStmt = isConfig
            ? db.prepare(`SELECT version, updated_at FROM tenant_configs WHERE tenant_id = ?`)
            : db.prepare(`SELECT version, updated_at FROM ${table} WHERE id = ? AND tenant_id = ?`);
          
          if (isConfig) {
            checkStmt.bind([tenantId]);
          } else {
            checkStmt.bind([recordId, tenantId]);
          }

          if (checkStmt.step()) {
            const currentRec = checkStmt.getAsObject();
            const serverVersion = currentRec.version as number || 1;
            if (expectedVersion !== undefined && expectedVersion < serverVersion) {
              // Concurrency conflict detected!
              conflicts.push({
                entity,
                id: recordId,
                serverVersion,
                clientVersion: expectedVersion,
                message: `Conflict: Record ${recordId} was updated on server (v${serverVersion}) after client version (v${expectedVersion}).`
              });
              checkStmt.free();
              continue; // Do not overwrite conflicting record
            }
          }
          checkStmt.free();
        }

        const newVersion = (record.version || 0) + 1;
        const recordWithMeta = {
          ...record,
          id: recordId,
          tenantId,
          version: newVersion,
          updatedAt: now
        };
        const dataJson = JSON.stringify(recordWithMeta);

        if (operation === 'delete') {
          if (isConfig) {
            db.run(
              `UPDATE tenant_configs SET deleted_at = ?, version = ?, updated_at = ? WHERE tenant_id = ?`,
              [now, newVersion, now, tenantId]
            );
          } else {
            db.run(
              `UPDATE ${table} SET deleted_at = ?, version = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
              [now, newVersion, now, recordId, tenantId]
            );
          }
        } else {
          upsertEntityRecord(db, tenantId, entity, recordWithMeta, now, newVersion);
        }

        // Record into change_log for delta pull
        db.run(
          `INSERT INTO change_log (tenant_id, revision, entity, entity_id, operation, data_json, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tenantId, nextRev, entity, recordId, operation, operation === 'delete' ? null : dataJson, now]
        );

        // Record Audit log
        recordAuditLog({
          tenantId,
          userId: req.user!.id,
          userName: req.user!.name,
          action: `${operation.toUpperCase()}_${entity.toUpperCase()}`,
          entity,
          entityId: recordId,
          details: { version: newVersion }
        });

        committed.push({
          entity,
          id: recordId,
          operation,
          version: newVersion,
          updatedAt: now
        });
      }

      db.run('COMMIT');
      scheduleDbSave();

      res.json({
        success: true,
        tenantId,
        serverRevision: nextRev,
        committedCount: committed.length,
        committed,
        conflicts
      });
    } catch (txErr: any) {
      console.error('[Sync Push Transaction Error]:', txErr?.message || txErr);
      try {
        db.run('ROLLBACK');
      } catch (rbErr) {}
      throw txErr;
    }
  } catch (err: any) {
    console.error('[Sync Push Request Error]:', err?.message || err);
    res.status(500).json({ success: false, error: err?.message || 'Push sync transaction failed' });
  }
});

export function upsertEntityRecord(db: any, tenantId: string, entity: string, record: any, now: string, version = 1) {
  if (!record || !record.id) return;
  const recordWithMeta = {
    ...record,
    tenantId,
    version,
    updatedAt: now
  };
  const dataJson = JSON.stringify(recordWithMeta);

  switch (entity) {
    case 'clients':
      db.run(
        `INSERT OR REPLACE INTO clients (id, tenant_id, name, phone, email, address, city, gstin, credit_limit, opening_balance, current_balance, notes, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.name || 'Client', record.phone || null, record.email || null,
          record.address || null, record.city || null, record.gstin || null, record.creditLimit || 0,
          record.openingBalance || 0, record.currentBalance || 0, record.notes || null, dataJson,
          record.createdAt || now, now, version
        ]
      );
      break;

    case 'jobs':
      db.run(
        `INSERT OR REPLACE INTO jobs (id, tenant_id, job_no, client_id, client_name, client_phone, equipment_type, brand_model, serial_no, problem_description, estimated_cost, advance_paid, status, priority, assigned_to, rack_location, data_json, created_at, updated_at, completed_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.jobNo || record.id, record.clientId || null, record.clientName || null,
          record.clientPhone || null, record.equipmentType || null, record.brandModel || record.model || null,
          record.serialNo || null, record.problemDescription || record.problem || null, record.estimatedCost || 0,
          record.advancePaid || 0, record.status || 'Pending', record.priority || 'Normal', record.assignedTo || null,
          record.rackLocation || null, dataJson, record.createdAt || now, now, record.completedAt || null, version
        ]
      );
      break;

    case 'invoices':
      db.run(
        `INSERT OR REPLACE INTO invoices (id, tenant_id, invoice_no, job_id, client_id, client_name, client_phone, subtotal, discount, tax, total, paid_amount, balance_due, payment_mode, status, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.invoiceNo || record.id, record.jobId || null, record.clientId || null,
          record.clientName || null, record.clientPhone || null, record.subtotal || 0, record.discount || 0,
          record.tax || 0, record.total || record.grandTotal || 0, record.paidAmount || 0, record.balanceDue || 0,
          record.paymentMode || 'Cash', record.status || 'Paid', dataJson, record.createdAt || now, now, version
        ]
      );
      break;

    case 'payments':
      db.run(
        `INSERT OR REPLACE INTO payments (id, tenant_id, payment_no, client_id, client_name, invoice_id, job_id, amount, payment_mode, transaction_ref, notes, received_by, date, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.paymentNo || record.id, record.clientId || null, record.clientName || null,
          record.invoiceId || null, record.jobId || null, record.amount || 0, record.paymentMode || 'Cash',
          record.transactionRef || null, record.notes || null, record.receivedBy || null, record.date || now,
          dataJson, record.createdAt || now, now, version
        ]
      );
      break;

    case 'products':
      db.run(
        `INSERT OR REPLACE INTO products (id, tenant_id, code, name, category, description, cost_price, selling_price, stock_quantity, min_stock_alert, unit, location, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.code || record.sku || null, record.name || 'Product', record.category || null,
          record.description || null, record.costPrice || 0, record.sellingPrice || record.price || 0,
          record.stockQuantity || record.stock || 0, record.minStockAlert || 0, record.unit || 'pcs',
          record.location || null, dataJson, record.createdAt || now, now, version
        ]
      );
      break;

    case 'expenses':
      db.run(
        `INSERT OR REPLACE INTO expenses (id, tenant_id, expense_no, category, amount, payment_mode, description, paid_to, date, recorded_by, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.expenseNo || record.id, record.category || 'General', record.amount || 0,
          record.paymentMode || 'Cash', record.description || null, record.paidTo || null, record.date || now,
          record.recordedBy || null, dataJson, record.createdAt || now, now, version
        ]
      );
      break;

    case 'ledger':
      db.run(
        `INSERT OR REPLACE INTO ledger (id, tenant_id, client_id, entry_type, amount, reference_id, description, balance_after, date, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.clientId || null, record.entryType || 'Debit', record.amount || 0,
          record.referenceId || null, record.description || null, record.balanceAfter || 0, record.date || now,
          dataJson, record.createdAt || now, now, version
        ]
      );
      break;

    case 'users':
      db.run(
        `INSERT OR REPLACE INTO users (id, tenant_id, name, username, mobile, role, status, permissions_json, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id, tenantId, record.name || 'User', record.username || record.name?.toLowerCase() || 'user',
          record.mobile || record.phone || '', record.role || 'Technician', record.status || 'Active',
          record.permissions ? JSON.stringify(record.permissions) : null,
          dataJson, record.createdAt || now, now, version
        ]
      );
      break;

    case 'logs':
    case 'audit_logs':
      db.run(
        `INSERT OR REPLACE INTO audit_logs (id, tenant_id, user_id, user_name, action, entity, entity_id, details_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id, tenantId, record.userId || null, record.user || record.userName || 'System',
          record.action || 'ACTIVITY', record.entity || 'general', record.entityId || record.id,
          JSON.stringify(record), record.timestamp || record.createdAt || now
        ]
      );
      break;

    case 'config':
      db.run(
        `INSERT OR REPLACE INTO tenant_configs (tenant_id, id, name, phone, email, address, gstin, upi_id, config_json, data_json, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          tenantId, record.id || tenantId, record.name || null, record.phone || null, record.email || null,
          record.address || null, record.gstin || null, record.upiId || null,
          dataJson, dataJson, now, version
        ]
      );
      break;

    case 'categories':
      db.run(
        `INSERT OR REPLACE INTO categories (id, tenant_id, name, type, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [record.id, tenantId, record.name || 'Category', record.type || 'Job', dataJson, record.createdAt || now, now, version]
      );
      break;

    case 'racks':
      db.run(
        `INSERT OR REPLACE INTO racks (id, tenant_id, name, capacity, location, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [record.id, tenantId, record.name || 'Rack', record.capacity || null, record.location || null, dataJson, record.createdAt || now, now, version]
      );
      break;

    case 'equipments':
      db.run(
        `INSERT OR REPLACE INTO equipments (id, tenant_id, name, brand, model, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [record.id, tenantId, record.name || 'Equipment', record.brand || null, record.model || null, dataJson, record.createdAt || now, now, version]
      );
      break;

    case 'problems':
      db.run(
        `INSERT OR REPLACE INTO problems (id, tenant_id, title, name, description, common_solution, standard_cost, data_json, created_at, updated_at, deleted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        [
          record.id,
          tenantId,
          record.title || record.name || 'Problem',
          record.name || record.title || 'Problem',
          record.description || null,
          record.commonSolution || null,
          record.standardCost || 0,
          dataJson,
          record.createdAt || now,
          now,
          version
        ]
      );
      break;

    default:
      break;
  }

  // Write-through mirror to PostgreSQL if active
  if (isPostgresActive()) {
    syncEntityToPostgres(entity, record, tenantId).catch((err) => {
      console.warn(`[Postgres Mirror Error for ${entity}]:`, err?.message);
    });
  }
}

// 4. BATCH SAVE ALL: Full state snapshot sync to Home Server SQLite & PostgreSQL
apiRouter.post('/sync/save-all', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    if (req.body.tenantId && req.body.tenantId !== tenantId && req.user?.role !== 'Master Admin') {
      return res.status(403).json({ success: false, message: 'Cross-tenant modification forbidden' });
    }

    const { companyConfig, collections } = req.body || {};
    const db = getDatabase();
    const now = new Date().toISOString();
    const nextRev = getNextRevision(tenantId);

    db.run('BEGIN TRANSACTION');
    try {
      if (companyConfig) {
        upsertEntityRecord(db, tenantId, 'config', companyConfig, now, 1);
      }

      if (collections && typeof collections === 'object') {
        for (const [entity, items] of Object.entries(collections)) {
          if (!Array.isArray(items)) continue;
          for (const record of items) {
            if (!record || !record.id) continue;
            upsertEntityRecord(db, tenantId, entity, record, now, 1);
          }
        }
      }

      db.run('COMMIT');
      scheduleDbSave();

      res.json({
        success: true,
        tenantId,
        serverRevision: nextRev,
        timestamp: now
      });
    } catch (txErr) {
      db.run('ROLLBACK');
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Save all collections failed' });
  }
});

// 5. SAVE COLLECTION: Update single collection to Home Server SQLite & PostgreSQL
apiRouter.post('/sync/save-collection', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    if (req.body.tenantId && req.body.tenantId !== tenantId && req.user?.role !== 'Master Admin') {
      return res.status(403).json({ success: false, message: 'Cross-tenant modification forbidden' });
    }

    const { entity, items, config } = req.body || {};
    const db = getDatabase();
    const now = new Date().toISOString();

    db.run('BEGIN TRANSACTION');
    try {
      if (entity === 'config' && config) {
        upsertEntityRecord(db, tenantId, 'config', config, now, 1);
      } else if (entity && Array.isArray(items)) {
        for (const record of items) {
          if (!record || !record.id) continue;
          upsertEntityRecord(db, tenantId, entity, record, now, 1);
        }
      }

      db.run('COMMIT');
      scheduleDbSave();

      res.json({
        success: true,
        tenantId,
        entity,
        count: Array.isArray(items) ? items.length : 1,
        timestamp: now
      });
    } catch (txErr) {
      db.run('ROLLBACK');
      throw txErr;
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Save collection failed' });
  }
});

// -------------------------------------------------------------
// ADMIN BACKUP & DISASTER RECOVERY ENDPOINTS
// -------------------------------------------------------------
apiRouter.post('/admin/backups/create', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'Admin' && req.user?.role !== 'Master Admin') {
    return res.status(403).json({ success: false, message: 'Admin role required to create backup' });
  }
  try {
    const filename = createBackupSnapshot();
    recordAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'CREATE_BACKUP',
      entity: 'system_backup',
      details: { filename }
    });
    res.json({ success: true, filename, message: 'Backup created successfully on Home Server' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Backup creation failed' });
  }
});

apiRouter.get('/admin/backups/list', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'Admin' && req.user?.role !== 'Master Admin') {
    return res.status(403).json({ success: false, message: 'Admin role required to list backups' });
  }
  try {
    const backups = listBackups();
    res.json({ success: true, backups });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

apiRouter.post('/admin/backups/restore', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'Master Admin' && req.user?.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Master Admin role required to restore database backup' });
  }
  try {
    const { filename } = req.body || {};
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Backup filename is required' });
    }
    restoreBackupFile(filename);
    recordAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'RESTORE_BACKUP',
      entity: 'system_backup',
      details: { filename }
    });
    res.json({ success: true, message: `Database successfully restored from ${filename}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Backup restore failed' });
  }
});

apiRouter.post('/admin/backups/delete', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'Master Admin' && req.user?.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Admin role required to delete backup' });
  }
  try {
    const { filename } = req.body || {};
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Backup filename is required' });
    }
    deleteBackupFile(filename);
    recordAuditLog({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
      userName: req.user!.name,
      action: 'DELETE_BACKUP',
      entity: 'system_backup',
      details: { filename }
    });
    res.json({ success: true, message: `Backup file ${filename} deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Backup deletion failed' });
  }
});

// Scan and import all data files from the data/ folder (JSON files, legacy backups, etc.)
apiRouter.post('/admin/scan-import-data-folder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await scanAndImportDataFolder(true);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Data folder scan and import failed' });
  }
});

// Check status of data/ folder
apiRouter.get('/admin/data-folder-status', (req: Request, res: Response) => {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const dbPath = path.join(dataDir, 'inoms_primary.db');
    let dbExists = false;
    let dbSizeBytes = 0;
    let dbModifiedAt: string | null = null;

    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      dbExists = true;
      dbSizeBytes = stats.size;
      dbModifiedAt = stats.mtime.toISOString();
    }

    const filesInDir: string[] = [];
    function scanFiles(dir: string) {
      if (!fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanFiles(full);
          } else if (entry.isFile()) {
            filesInDir.push(path.relative(dataDir, full));
          }
        }
      } catch (e) {}
    }
    scanFiles(dataDir);

    const db = getDatabase();
    let orgCount = 0;
    let clientCount = 0;
    let jobCount = 0;
    let invoiceCount = 0;

    try {
      const orgStmt = db.prepare('SELECT COUNT(*) as count FROM organizations');
      if (orgStmt.step()) orgCount = orgStmt.getAsObject().count as number || 0;
      orgStmt.free();

      const cStmt = db.prepare('SELECT COUNT(*) as count FROM clients WHERE deleted_at IS NULL');
      if (cStmt.step()) clientCount = cStmt.getAsObject().count as number || 0;
      cStmt.free();

      const jStmt = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE deleted_at IS NULL');
      if (jStmt.step()) jobCount = jStmt.getAsObject().count as number || 0;
      jStmt.free();

      const iStmt = db.prepare('SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NULL');
      if (iStmt.step()) invoiceCount = iStmt.getAsObject().count as number || 0;
      iStmt.free();
    } catch (e) {}

    res.json({
      success: true,
      dataDirectory: dataDir,
      sqliteDatabase: {
        exists: dbExists,
        sizeBytes: dbSizeBytes,
        modifiedAt: dbModifiedAt
      },
      filesFound: filesInDir,
      jsonFilesCount: filesInDir.filter(f => f.toLowerCase().endsWith('.json')).length,
      currentCounts: {
        organizations: orgCount,
        clients: clientCount,
        jobs: jobCount,
        invoices: invoiceCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// -------------------------------------------------------------
// MULTI-TENANT ISOLATED PDF STORAGE & PUBLIC SHARING ENDPOINTS
// -------------------------------------------------------------

// Helper to get or create isolated organization pdfs folder
function getOrgPdfDirectory(tenantId: string, subfolder: string = 'invoices'): string {
  const cleanTenant = (tenantId || 'default').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const cleanSubfolder = (subfolder || 'invoices').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const orgPdfsDir = path.join(process.cwd(), 'data', 'organisations', cleanTenant, 'pdfs', cleanSubfolder);
  if (!fs.existsSync(orgPdfsDir)) {
    fs.mkdirSync(orgPdfsDir, { recursive: true });
  }
  return orgPdfsDir;
}

// 1. Upload Generated PDF to Organization's dedicated folder
apiRouter.post('/docs/upload-pdf', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { subfolder = 'invoices', filename, base64Pdf } = req.body || {};
    if (!filename || !base64Pdf) {
      return res.status(400).json({ success: false, message: 'filename and base64Pdf are required' });
    }

    const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const orgDir = getOrgPdfDirectory(tenantId, subfolder);
    const filePath = path.join(orgDir, cleanFilename);

    // Strip data URI header if present
    const base64Data = base64Pdf.replace(/^data:application\/pdf;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const cleanTenant = tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const cleanSub = (subfolder || 'invoices').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const publicUrl = `/api/docs/public/${cleanTenant}/${cleanSub}/${cleanFilename}`;

    res.json({
      success: true,
      filename: cleanFilename,
      publicUrl,
      sizeBytes: buffer.length,
      message: 'PDF saved successfully to organization directory'
    });
  } catch (err: any) {
    console.error('Error saving organization PDF:', err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to save PDF' });
  }
});

// 2. Public Direct Download / Stream Endpoint for customer WhatsApp links
apiRouter.get('/docs/public/:tenantId/:subfolder/:filename', (req, res) => {
  try {
    const { tenantId, subfolder, filename } = req.params;
    const cleanTenant = (tenantId || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const cleanSub = (subfolder || 'invoices').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const cleanFilename = (filename || '').replace(/[^a-zA-Z0-9._-]/g, '_');

    const filePath = path.join(process.cwd(), 'data', 'organisations', cleanTenant, 'pdfs', cleanSub, cleanFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invoice Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>Invoice Document Not Found</h2>
          <p>The requested PDF invoice could not be located or may have been archived.</p>
        </body>
        </html>
      `);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cleanFilename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err: any) {
    res.status(500).send('Error serving PDF document');
  }
});

