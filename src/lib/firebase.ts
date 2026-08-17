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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

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

export async function fetchTenantsOnce(force = false): Promise<TenantOrg[]> {
  if (cachedTenants && !force && !isFetchingTenants) {
    return cachedTenants;
  }
  if (isFetchingTenants) {
    return cachedTenants || [];
  }

  isFetchingTenants = true;
  try {
    const res = await fetch('/api/auth/tenants');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tenants)) {
        const list: TenantOrg[] = data.tenants;
        const seen = new Map<string, boolean>();
        const deduped: TenantOrg[] = [];
        for (const t of list) {
          if (!t || !t.id) continue;
          const cleanMobile = (t.ownerMobile || '').replace(/\D/g, '');
          const cleanName = (t.name || '').trim().toLowerCase();
          const dedupeKey = t.id === 'org-admin' ? 'org-admin' : `${cleanName}_${cleanMobile}`;
          if (!seen.has(t.id) && !seen.has(dedupeKey)) {
            seen.set(t.id, true);
            seen.set(dedupeKey, true);
            deduped.push(t);
          }
        }
        cachedTenants = deduped;
        tenantListeners.forEach(cb => {
          try { cb(deduped); } catch (e) {}
        });
      }
    }
  } catch (err) {
    // Graceful offline fallback
  } finally {
    isFetchingTenants = false;
  }
  return cachedTenants || [];
}

export function subscribeTenants(onUpdate: (tenants: TenantOrg[]) => void) {
  tenantListeners.add(onUpdate);

  // If we already have cached data, deliver immediately
  if (cachedTenants && cachedTenants.length > 0) {
    onUpdate(cachedTenants);
  } else {
    fetchTenantsOnce();
  }

  // Set up gentle shared polling only once across all subscribers (every 60s, paused if hidden)
  if (!tenantPollTimer) {
    tenantPollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchTenantsOnce(true);
      }
    }, 60000);
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
  // Delegated to Home Server API
  try {
    const isUpdate = !!tenant.id;
    const url = isUpdate ? '/api/auth/update-org' : '/api/auth/register-org';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenant)
    });
    const result = await res.json();
    if (!result.success && isUpdate) {
      // If update returned 404/false, try register
      await fetch('/api/auth/register-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenant)
      });
    }
    // Refresh cached list immediately on update
    await fetchTenantsOnce(true);
  } catch (err) {
    console.warn('Error saving tenant to Home Server:', err);
  }
}

export async function updateTenantInFirestore(tenant: TenantOrg): Promise<void> {
  await saveTenantToFirestore(tenant);
}

export async function deleteTenantFromFirestore(tenantId: string): Promise<void> {
  try {
    await fetch('/api/auth/delete-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  await saveLocalRecord(tenantId, 'config', { ...config, id: tenantId });
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

  // 1. Immediately load from local IndexedDB replica strictly scoped to tenantId
  getLocalCollection<T>(tenantId, collectionName).then(items => {
    if (items && items.length > 0) {
      onUpdate(items);
    } else {
      // Check tenant-specific storage cache
      try {
        const cached = localStorage.getItem(`app_storage_${collectionName}_${tenantId}`) || localStorage.getItem(`${collectionName}_${tenantId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            onUpdate(parsed);
            return;
          }
        }
      } catch (e) {}

      // ONLY for Master Admin org allow initial seed fallback; all real tenant orgs remain strictly isolated & empty
      if (tenantId === 'org-admin' && getLocalData) {
        const fallback = getLocalData();
        if (fallback && fallback.length > 0) {
          onUpdate(fallback);
        }
      }
    }
  });

  // 2. Subscribe to reactive local replica updates with strict tenant isolation
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
  // 1. Atomically replace collection in local IndexedDB replica
  await replaceLocalCollection(tenantId, collectionName, items, false, false);
  // 2. Persist directly to Home Server SQLite database
  try {
    saveTenantCollectionViaApi(tenantId, collectionName, items).catch(() => {});
  } catch (e) {}
}
