import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { TenantOrg, SystemAnnouncement, INITIAL_TENANTS } from '../components/AuthModal';
import { CompanyConfig } from '../types';
import { saveTenantCollectionViaApi } from './api';
import {
  saveLocalRecord,
  deleteLocalRecord,
  replaceLocalCollection,
  getLocalCollection,
  subscribeLocalDb
} from './localDb';
import { getAppStorageItem, setAppStorageItem } from './storage';
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

function isHomeServerSyncEnabledForTenant(tenantId: string): boolean {
  if (tenantId === 'org-admin') return true;
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const tenants = raw ? JSON.parse(raw) : [];
    const tenant = Array.isArray(tenants) ? tenants.find((item: TenantOrg) => item.id === tenantId) : null;
    return tenant?.features?.allowHomeServerSync !== false;
  } catch {
    return true;
  }
}

/**
 * Executes official Google Login popup to authenticate the user using Firebase Auth.
 * Authentication identity only — NO business data is stored or retrieved from Firebase.
 */
export async function signInWithGoogle(): Promise<{ userEmail: string; displayName: string }> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    const result = await signInWithPopup(auth, provider);
    const userEmail = result.user.email || '';
    const displayName = result.user.displayName || userEmail.split('@')[0] || '';

    return { userEmail, displayName };
  } catch (err: any) {
    console.warn('Firebase Google Auth popup notice:', err?.message || err);
    return { userEmail: '', displayName: '' };
  }
}

// -------------------------------------------------------------
// HOME SERVER MULTI-TENANT & CONFIGURATION SYNC
// -------------------------------------------------------------

let cachedTenants: TenantOrg[] | null = null;
let isFetchingTenants = false;
const tenantListeners = new Set<(tenants: TenantOrg[]) => void>();
let tenantPollTimer: any = null;

function ensureAdminActiveInList(list: TenantOrg[]): TenantOrg[] {
  let hasAdmin = false;
  const result = list.map(t => {
    if (t.id === 'org-admin' || t.id === 'org-nibban' || t.code?.toUpperCase() === 'NIBBAN' || t.code?.toUpperCase() === 'ADMIN' || t.code?.toUpperCase() === 'ADMIN-00') {
      hasAdmin = true;
      return { ...t, status: 'active' as const };
    }
    return t;
  });
  if (!hasAdmin) {
    result.unshift({
      id: 'org-admin',
      name: 'Master System Admin',
      code: 'ADMIN-00',
      ownerMobile: '+91 8149862034',
      ownerName: 'Master Admin',
      status: 'active',
      createdAt: '2026-01-01',
      subscriptionPlan: 'lifetime',
      isTrial: false,
      trialDays: 0,
      pin: '1234'
    });
  }
  return result;
}

export async function fetchTenantsOnce(force = false): Promise<TenantOrg[]> {
  if (cachedTenants && !force && !isFetchingTenants) {
    return cachedTenants;
  }

  // Load from local storage immediately so UI is instant
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && list.length > 0) {
      cachedTenants = ensureAdminActiveInList(list.filter((t: any) => !!t?.id));
    }
  } catch (e) {}

  if (isFetchingTenants) {
    return cachedTenants || INITIAL_TENANTS;
  }

  isFetchingTenants = true;
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('inoms_auth_token') || sessionStorage.getItem('inoms_auth_token') : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/auth/tenants', { headers }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success && Array.isArray(data.tenants)) {
        const serverTenants: TenantOrg[] = data.tenants;
        
        // Merge with local tenants to preserve any offline creations, giving server features precedence
        const localMap = new Map<string, TenantOrg>();
        (cachedTenants || []).forEach(t => { if (t.id) localMap.set(t.id, t); });

        serverTenants.forEach(st => {
          if (st.id) {
            const existing = localMap.get(st.id);
            localMap.set(st.id, {
              ...existing,
              ...st,
              features: st.features !== undefined ? st.features : existing?.features
            });
          }
        });

        const merged = ensureAdminActiveInList(Array.from(localMap.values()));
        cachedTenants = merged;
        setAppStorageItem('tenants_v3', JSON.stringify(merged));
        tenantListeners.forEach(cb => {
          try { cb(merged); } catch (_) {}
        });
      }
    }
  } catch (err) {
    console.warn('Fetch tenants notice:', err);
  } finally {
    isFetchingTenants = false;
  }

  return cachedTenants || INITIAL_TENANTS;
}

let tenantBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    tenantBroadcastChannel = new BroadcastChannel('inoms_tenants_broadcast');
    tenantBroadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'TENANTS_UPDATED' && Array.isArray(event.data.tenants)) {
        cachedTenants = event.data.tenants;
        setAppStorageItem('tenants_v3', JSON.stringify(cachedTenants));
        tenantListeners.forEach(cb => {
          try { cb(cachedTenants!); } catch (_) {}
        });
      }
    };
  } catch (_) {}
}

export function broadcastTenantListUpdate(tenants: TenantOrg[]) {
  if (tenantBroadcastChannel) {
    try {
      tenantBroadcastChannel.postMessage({ type: 'TENANTS_UPDATED', tenants });
    } catch (_) {}
  }
}

export function subscribeTenants(onUpdate: (tenants: TenantOrg[]) => void) {
  tenantListeners.add(onUpdate);

  // Deliver cached or local tenants immediately
  if (cachedTenants && cachedTenants.length > 0) {
    onUpdate(cachedTenants);
  } else {
    try {
      const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length > 0) {
        const safe = ensureAdminActiveInList(list);
        cachedTenants = safe;
        onUpdate(safe);
      }
    } catch (_) {}
  }

  // Trigger background server sync immediately
  fetchTenantsOnce(true);

  // Setup periodic sync every 4s if online
  if (!tenantPollTimer && typeof window !== 'undefined') {
    tenantPollTimer = setInterval(() => {
      if (navigator.onLine) {
        fetchTenantsOnce(true);
      }
    }, 4000);
  }

  return () => {
    tenantListeners.delete(onUpdate);
    if (tenantListeners.size === 0 && tenantPollTimer) {
      clearInterval(tenantPollTimer);
      tenantPollTimer = null;
    }
  };
}

export async function saveTenantToFirestore(tenant: TenantOrg): Promise<void> {
  if (!tenant?.id) return;
  
  // 1. Immediately update local cache and trigger subscribers
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const list: TenantOrg[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex(t => t.id === tenant.id);
    let nextList: TenantOrg[];
    if (index >= 0) {
      nextList = list.map(t => t.id === tenant.id ? { ...t, ...tenant } : t);
    } else {
      nextList = [...list, tenant];
    }
    const safe = ensureAdminActiveInList(nextList);
    cachedTenants = safe;
    setAppStorageItem('tenants_v3', JSON.stringify(safe));
    tenantListeners.forEach(cb => {
      try { cb(safe); } catch (_) {}
    });
  } catch (_) {}

  // 2. Persist to Home Server API
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('inoms_auth_token') || sessionStorage.getItem('inoms_auth_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) credentialsHeader(headers, token);

    const isUpdate = !!tenant.id;
    const url = isUpdate ? '/api/auth/update-org' : '/api/auth/register-org';
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(tenant)
    });
    const result = await res.json().catch(() => null);
    if (!result?.success && isUpdate) {
      // If update returned 404/false, try register
      await fetch('/api/auth/register-org', {
        method: 'POST',
        headers,
        body: JSON.stringify(tenant)
      }).catch(() => {});
    }
    // Refresh cached list from server
    await fetchTenantsOnce(true);
  } catch (err) {
    console.warn('Error saving tenant to Home Server:', err);
  }
}

function credentialsHeader(headers: Record<string, string>, token: string) {
  headers['Authorization'] = `Bearer ${token}`;
}

export async function updateTenantInFirestore(tenant: TenantOrg): Promise<void> {
  await saveTenantToFirestore(tenant);
}

export async function deleteTenantFromFirestore(tenantId: string): Promise<void> {
  // 1. Remove from local cache immediately
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const list: TenantOrg[] = raw ? JSON.parse(raw) : [];
    const nextList = ensureAdminActiveInList(list.filter(t => t.id !== tenantId));
    cachedTenants = nextList;
    setAppStorageItem('tenants_v3', JSON.stringify(nextList));
    tenantListeners.forEach(cb => {
      try { cb(nextList); } catch (_) {}
    });
  } catch (_) {}

  // 2. Delete on Home Server
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('inoms_auth_token') || sessionStorage.getItem('inoms_auth_token') : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) credentialsHeader(headers, token);

    await fetch('/api/auth/delete-org', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: tenantId })
    });
    // Refresh cached list immediately on delete
    await fetchTenantsOnce(true);
  } catch (err) {
    console.warn('Error deleting tenant from Home Server:', err);
  }
}

export function subscribeAnnouncements(onUpdate: (announcements: SystemAnnouncement[]) => void) {
  // Empty or local announcements
  return () => {};
}

export async function saveAnnouncementToFirestore(announcement: SystemAnnouncement): Promise<void> {
  // Local only
}

export async function deleteAnnouncementFromFirestore(id: string): Promise<void> {
  // Local only
}

export function subscribeCompanyConfig(tenantId: string, onUpdate: (config: CompanyConfig) => void) {
  if (!tenantId) return () => {};
  
  // Listen to localDb updates for config scoped to tenantId
  const unsub = subscribeLocalDb((tId, entity, data) => {
    if (tId === tenantId && entity === 'config' && data.length > 0) {
      onUpdate(data[0] as unknown as CompanyConfig);
    }
  });

  return unsub;
}

export async function saveCompanyConfigToFirestore(tenantId: string, config: CompanyConfig): Promise<void> {
  if (!tenantId) return;
  setAppStorageItem(`company_config_${tenantId}`, JSON.stringify(config));
  await saveLocalRecord(tenantId, 'config', { ...config, id: tenantId });
  if (!isHomeServerSyncEnabledForTenant(tenantId)) return;
  try {
    saveTenantCollectionViaApi(tenantId, 'config', undefined, config).catch(() => {});
  } catch (e) {}
}

export async function saveUserSessionToFirestore(
  tenantId: string,
  sessionUserId: string,
  sessionId: string,
  deviceInfo?: string
): Promise<void> {
  // Handled automatically by Home Server /api/auth/login and /api/auth/session
}

export function subscribeUserSession(
  tenantId: string,
  sessionUserId: string,
  onUpdate: (sessionData: { activeSessionId: string; deviceInfo?: string }) => void
) {
  return () => {};
}

// Sync status and pending queue utilities
export function isQuotaExhausted(): boolean {
  return false;
}

export function getPendingQueueCount(): number {
  return 0;
}

export function clearPendingQueue(): void {}

export async function retryPendingCloudSync(): Promise<void> {}

// -------------------------------------------------------------

export function subscribeTenantCollection<T>(
  tenantId: string,
  collectionName: string,
  onUpdate: (items: T[]) => void,
  getLocalData?: () => T[]
) {
  if (!tenantId || !collectionName) return () => {};

  // 1. Immediately check synchronous localStorage (authoritative for fresh local edits)
  let hasLoadedFromStorage = false;
  try {
    const cachedRaw = getAppStorageItem(`${collectionName}_${tenantId}`) ||
                      localStorage.getItem(`inoms_${collectionName}_${tenantId}`) ||
                      localStorage.getItem(`${collectionName}_${tenantId}`);
    if (cachedRaw !== null && cachedRaw !== undefined) {
      const parsed = JSON.parse(cachedRaw);
      if (Array.isArray(parsed)) {
        hasLoadedFromStorage = true;
        onUpdate(parsed as T[]);
        // Ensure IndexedDB replica is also synchronized with this latest snapshot
        replaceLocalCollection(tenantId, collectionName, parsed, false, false).catch(() => {});
      }
    }
  } catch (e) {}

  // 2. If storage was empty or not found, fall back to IndexedDB
  if (!hasLoadedFromStorage) {
    getLocalCollection<T>(tenantId, collectionName).then(items => {
      if (items && items.length > 0) {
        onUpdate(items);
        setAppStorageItem(`${collectionName}_${tenantId}`, JSON.stringify(items));
      } else if (tenantId === 'org-admin' && getLocalData) {
        const fallback = getLocalData();
        if (fallback && fallback.length > 0) {
          onUpdate(fallback);
        }
      }
    }).catch(() => {});
  }

  // 3. Subscribe to reactive local replica updates with strict tenant isolation
  const unsubscribe = subscribeLocalDb((tId, entity, data) => {
    if (tId === tenantId && entity === collectionName) {
      onUpdate(data as T[]);
    }
  });

  return unsubscribe;
}

export async function saveTenantCollectionToFirestore(
  tenantId: string,
  collectionName: string,
  items: any[]
): Promise<void> {
  if (!tenantId || !collectionName) return;
  const safeItems = Array.isArray(items) ? items : [];

  // 1. Save synchronously to localStorage
  setAppStorageItem(`${collectionName}_${tenantId}`, JSON.stringify(safeItems));

  // 2. Atomically replace collection in local IndexedDB replica
  await replaceLocalCollection(tenantId, collectionName, safeItems, false, false);
  if (!isHomeServerSyncEnabledForTenant(tenantId)) return;

  // 3. Persist directly to Home Server SQLite database
  try {
    saveTenantCollectionViaApi(tenantId, collectionName, safeItems).catch(() => {});
  } catch (e) {}
}
