import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { TenantOrg, SystemAnnouncement, INITIAL_TENANTS } from '../components/AuthModal';
import { CompanyConfig } from '../types';
import { getHomeServerDbKey, saveHomeServerDbKey } from './api';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

/**
 * Executes official Google Login popup to authenticate the user using Firebase Auth.
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
    throw err;
  }
}

const TENANTS_COLLECTION = 'tenants';
const ANNOUNCEMENTS_COLLECTION = 'announcements';
const TENANT_CONFIGS_COLLECTION = 'tenant_configs';
const TENANT_COLLECTIONS_COLLECTION = 'tenant_collections';

// Global state to track Firestore quota exhaustion so we don't spam network or console when free quota limit is reached
let isFirestoreQuotaExhausted = false;
const reportedQuotaWarning = new Set<string>();

export function isQuotaExhausted(): boolean {
  return isFirestoreQuotaExhausted;
}

export function resetQuotaStatus(): void {
  isFirestoreQuotaExhausted = false;
}

// Persistent Outbox Queue for Cloud Sync Recovery
const PENDING_QUEUE_KEY = 'inoms_pending_cloud_sync_queue';

export interface PendingSyncItem {
  id: string; // collectionName_docId
  colName: string;
  docId: string;
  data: any;
  updatedAt: string;
}

export function getPendingQueue(): PendingSyncItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getPendingQueueCount(): number {
  return getPendingQueue().length;
}

function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inoms_sync_queue_changed', { detail: { count: getPendingQueueCount() } }));
  }
}

export function saveToPendingQueue(colName: string, docId: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    const queue = getPendingQueue();
    const itemId = `${colName}_${docId}`;
    const existingIndex = queue.findIndex(item => item.id === itemId);
    const newItem: PendingSyncItem = {
      id: itemId,
      colName,
      docId,
      data,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      queue[existingIndex] = newItem;
    } else {
      queue.push(newItem);
    }
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    notifyQueueChanged();
  } catch (e) {
    console.warn('Error queuing pending cloud sync:', e);
  }
}

export function removeFromPendingQueue(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const queue = getPendingQueue().filter(item => item.id !== id);
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    notifyQueueChanged();
  } catch (e) {}
}

export async function retryPendingCloudSync(): Promise<{ success: boolean; syncedCount: number; remainingCount: number; message: string }> {
  const queue = getPendingQueue();
  if (queue.length === 0) {
    isFirestoreQuotaExhausted = false;
    return { success: true, syncedCount: 0, remainingCount: 0, message: 'All local changes are already synced to Cloud Firestore!' };
  }

  let syncedCount = 0;
  let remainingCount = queue.length;
  let quotaHit = false;

  for (const item of queue) {
    try {
      await setDoc(doc(db, item.colName, item.docId), item.data, { merge: true });
      removeFromPendingQueue(item.id);
      syncedCount++;
      remainingCount--;
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('Quota') ||
        err?.message?.includes('quota') ||
        err?.message?.includes('resource-exhausted')
      ) {
        isFirestoreQuotaExhausted = true;
        quotaHit = true;
        break; // Quota still exceeded today, stop further attempts until next retry/tomorrow
      } else {
        console.warn(`Failed to sync queued item ${item.id}:`, err);
      }
    }
  }

  if (!quotaHit && remainingCount === 0) {
    isFirestoreQuotaExhausted = false;
    return {
      success: true,
      syncedCount,
      remainingCount: 0,
      message: `Successfully synced all ${syncedCount} queued local changes to Cloud Firestore!`
    };
  }

  return {
    success: false,
    syncedCount,
    remainingCount,
    message: quotaHit
      ? `Synced ${syncedCount} item(s). Cloud quota is still exceeded for today. ${remainingCount} change(s) remain safely saved in local offline storage.`
      : `Synced ${syncedCount} item(s). ${remainingCount} change(s) pending.`
  };
}

function handleFirestoreError(context: string, error: any) {
  if (
    error?.code === 'resource-exhausted' ||
    error?.message?.includes('Quota') ||
    error?.message?.includes('quota') ||
    error?.message?.includes('resource-exhausted')
  ) {
    isFirestoreQuotaExhausted = true;
    if (!reportedQuotaWarning.has(context)) {
      reportedQuotaWarning.add(context);
      console.info(`[Firestore Sync] Daily cloud write quota reached for ${context}. Seamlessly operating in offline local PC storage mode.`);
    }
    return;
  }
  console.warn(`Firestore ${context} notice:`, error?.message || error);
}

// In-memory cache to track last known JSON state per document to prevent write loops and quota waste
const lastKnownDocCache = new Map<string, string>();
const writeDebounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Real-time Firestore synchronization for Multi-Tenant Organizations, System Announcements,
 * Company Configurations, and Tenant Data Collections.
 * Includes automatic quota error handling and change-deduplication caching.
 */
export function subscribeTenants(onUpdate: (tenants: TenantOrg[]) => void) {
  const cacheKey = 'tenants_all';

  getHomeServerDbKey<TenantOrg[]>('tenants_all').then(data => {
    if (data && Array.isArray(data) && data.length > 0) {
      onUpdate(data);
    }
  }).catch(() => {});

  const intervalId = setInterval(() => {
    getHomeServerDbKey<TenantOrg[]>('tenants_all').then(data => {
      if (data && Array.isArray(data)) {
        const serialized = JSON.stringify(data);
        if (lastKnownDocCache.get(cacheKey) !== serialized) {
          lastKnownDocCache.set(cacheKey, serialized);
          onUpdate(data);
        }
      }
    }).catch(() => {});
  }, 4000);

  let unsubscribe = () => {};
  if (!isFirestoreQuotaExhausted) {
    try {
      unsubscribe = onSnapshot(
        collection(db, TENANTS_COLLECTION),
        (snapshot) => {
          const tenantsList: TenantOrg[] = [];
          snapshot.forEach((docSnap) => {
            if (docSnap.exists()) {
              tenantsList.push(docSnap.data() as TenantOrg);
            }
          });
          if (tenantsList.length > 0) {
            onUpdate(tenantsList);
            saveHomeServerDbKey('tenants_all', tenantsList);
          }
        },
        (error) => {
          handleFirestoreError('subscribeTenants', error);
        }
      );
    } catch (err) {
      handleFirestoreError('subscribeTenants', err);
    }
  }

  return () => {
    clearInterval(intervalId);
    unsubscribe();
  };
}

export async function saveTenantToFirestore(tenant: TenantOrg): Promise<void> {
  if (!tenant?.id) return;
  const cacheKey = `tenant_${tenant.id}`;
  const serialized = JSON.stringify(tenant);
  if (lastKnownDocCache.get(cacheKey) === serialized) return;

  saveHomeServerDbKey(`tenant_${tenant.id}`, tenant);

  if (isFirestoreQuotaExhausted) {
    saveToPendingQueue(TENANTS_COLLECTION, tenant.id, tenant);
    return;
  }

  try {
    await setDoc(doc(db, TENANTS_COLLECTION, tenant.id), tenant, { merge: true });
    lastKnownDocCache.set(cacheKey, serialized);
  } catch (err) {
    handleFirestoreError('saveTenantToFirestore', err);
    saveToPendingQueue(TENANTS_COLLECTION, tenant.id, tenant);
  }
}

export async function deleteTenantFromFirestore(tenantId: string): Promise<void> {
  if (isFirestoreQuotaExhausted || !tenantId) return;
  try {
    await deleteDoc(doc(db, TENANTS_COLLECTION, tenantId));
    lastKnownDocCache.delete(`tenant_${tenantId}`);
  } catch (err) {
    handleFirestoreError('deleteTenantFromFirestore', err);
  }
}

export function subscribeAnnouncements(onUpdate: (announcements: SystemAnnouncement[]) => void) {
  if (isFirestoreQuotaExhausted) return () => {};
  try {
    return onSnapshot(
      collection(db, ANNOUNCEMENTS_COLLECTION),
      (snapshot) => {
        const list: SystemAnnouncement[] = [];
        snapshot.forEach((docSnap) => {
          if (docSnap.exists()) {
            list.push(docSnap.data() as SystemAnnouncement);
          }
        });
        if (list.length > 0) {
          onUpdate(list);
        }
      },
      (error) => {
        handleFirestoreError('subscribeAnnouncements', error);
      }
    );
  } catch (err) {
    handleFirestoreError('subscribeAnnouncements', err);
    return () => {};
  }
}

export async function saveAnnouncementToFirestore(announcement: SystemAnnouncement): Promise<void> {
  if (isFirestoreQuotaExhausted || !announcement?.id) return;
  const cacheKey = `announcement_${announcement.id}`;
  const serialized = JSON.stringify(announcement);
  if (lastKnownDocCache.get(cacheKey) === serialized) return;

  try {
    await setDoc(doc(db, ANNOUNCEMENTS_COLLECTION, announcement.id), announcement, { merge: true });
    lastKnownDocCache.set(cacheKey, serialized);
  } catch (err) {
    handleFirestoreError('saveAnnouncementToFirestore', err);
  }
}

export async function deleteAnnouncementFromFirestore(announcementId: string): Promise<void> {
  if (isFirestoreQuotaExhausted || !announcementId) return;
  try {
    await deleteDoc(doc(db, ANNOUNCEMENTS_COLLECTION, announcementId));
    lastKnownDocCache.delete(`announcement_${announcementId}`);
  } catch (err) {
    handleFirestoreError('deleteAnnouncementFromFirestore', err);
  }
}

export function subscribeCompanyConfig(tenantId: string, onUpdate: (config: CompanyConfig) => void) {
  if (isFirestoreQuotaExhausted || !tenantId) return () => {};
  const cacheKey = `config_${tenantId}`;
  try {
    return onSnapshot(
      doc(db, TENANT_CONFIGS_COLLECTION, tenantId),
      (docSnap) => {
        if (docSnap.exists()) {
          const config = docSnap.data() as CompanyConfig;
          lastKnownDocCache.set(cacheKey, JSON.stringify(config));
          onUpdate(config);
        }
      },
      (error) => {
        handleFirestoreError('subscribeCompanyConfig', error);
      }
    );
  } catch (err) {
    handleFirestoreError('subscribeCompanyConfig', err);
    return () => {};
  }
}

export async function saveCompanyConfigToFirestore(tenantId: string, config: CompanyConfig): Promise<void> {
  if (!tenantId) return;
  const cacheKey = `config_${tenantId}`;
  const serialized = JSON.stringify(config);
  if (lastKnownDocCache.get(cacheKey) === serialized) return;

  // Mark in cache immediately to avoid re-triggering during async call
  lastKnownDocCache.set(cacheKey, serialized);

  if (isFirestoreQuotaExhausted) {
    saveToPendingQueue(TENANT_CONFIGS_COLLECTION, tenantId, config);
    return;
  }

  try {
    await setDoc(doc(db, TENANT_CONFIGS_COLLECTION, tenantId), config, { merge: true });
  } catch (err) {
    handleFirestoreError('saveCompanyConfigToFirestore', err);
    saveToPendingQueue(TENANT_CONFIGS_COLLECTION, tenantId, config);
  }
}

const TENANT_SESSIONS_COLLECTION = 'tenant_sessions';

export async function saveUserSessionToFirestore(
  tenantId: string,
  sessionUserId: string,
  sessionId: string,
  deviceInfo?: string
): Promise<void> {
  if (!tenantId || !sessionUserId || !sessionId) return;
  const docId = `${tenantId}_${sessionUserId}`;
  const cacheKey = `session_${docId}`;
  
  // Stable payload WITHOUT volatile timestamps to avoid burning Firestore write quota on re-renders!
  const payload = {
    tenantId,
    sessionUserId,
    activeSessionId: sessionId,
    deviceInfo: deviceInfo || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown')
  };
  const serialized = JSON.stringify(payload);
  if (lastKnownDocCache.get(cacheKey) === serialized) return;

  // Immediately cache to prevent duplicate async writes
  lastKnownDocCache.set(cacheKey, serialized);

  if (isFirestoreQuotaExhausted) return;

  try {
    await setDoc(doc(db, TENANT_SESSIONS_COLLECTION, docId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(`saveUserSessionToFirestore(${docId})`, err);
  }
}

export function subscribeUserSession(
  tenantId: string,
  sessionUserId: string,
  onUpdate: (sessionData: { activeSessionId: string; deviceInfo?: string }) => void
) {
  if (!tenantId || !sessionUserId) return () => {};
  const docId = `${tenantId}_${sessionUserId}`;
  try {
    return onSnapshot(
      doc(db, TENANT_SESSIONS_COLLECTION, docId),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.activeSessionId) {
            onUpdate({ activeSessionId: data.activeSessionId, deviceInfo: data.deviceInfo });
          }
        }
      },
      (error) => {
        handleFirestoreError(`subscribeUserSession(${docId})`, error);
      }
    );
  } catch (err) {
    handleFirestoreError(`subscribeUserSession(${docId})`, err);
    return () => {};
  }
}

export function subscribeTenantCollection<T>(
  tenantId: string,
  collectionName: string,
  onUpdate: (items: T[]) => void,
  getLocalData?: () => T[]
) {
  if (!tenantId || !collectionName) return () => {};
  const docId = `${tenantId}_${collectionName}`;
  const cacheKey = `collection_${docId}`;

  // 1. First attempt Home Server DB load immediately
  getHomeServerDbKey<{ items: T[] }>(`col_${docId}`).then(data => {
    if (data && Array.isArray(data.items) && data.items.length > 0) {
      lastKnownDocCache.set(cacheKey, JSON.stringify(data.items));
      onUpdate(data.items);
    }
  }).catch(() => {});

  // 2. Set up interval polling for real-time Home Server multi-device sync (every 3s)
  const intervalId = setInterval(() => {
    getHomeServerDbKey<{ items: T[] }>(`col_${docId}`).then(data => {
      if (data && Array.isArray(data.items)) {
        const serialized = JSON.stringify(data.items);
        if (lastKnownDocCache.get(cacheKey) !== serialized) {
          lastKnownDocCache.set(cacheKey, serialized);
          onUpdate(data.items);
        }
      }
    }).catch(() => {});
  }, 3000);

  // 3. Firestore subscription (if quota is available)
  let unsubscribeFirestore = () => {};
  if (!isFirestoreQuotaExhausted) {
    try {
      unsubscribeFirestore = onSnapshot(
        doc(db, TENANT_COLLECTIONS_COLLECTION, docId),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.items)) {
              const cloudItems = data.items as T[];
              lastKnownDocCache.set(cacheKey, JSON.stringify(cloudItems));
              onUpdate(cloudItems);
              // Mirror to Home Server DB
              saveHomeServerDbKey(`col_${docId}`, { items: cloudItems, updatedAt: new Date().toISOString() });
            }
          } else {
            if (getLocalData && !isFirestoreQuotaExhausted) {
              const local = getLocalData();
              if (local && local.length > 0) {
                saveTenantCollectionToFirestore(tenantId, collectionName, local);
              }
            }
          }
        },
        (error) => {
          handleFirestoreError(`subscribeTenantCollection(${docId})`, error);
        }
      );
    } catch (err) {
      handleFirestoreError(`subscribeTenantCollection(${docId})`, err);
    }
  }

  return () => {
    clearInterval(intervalId);
    unsubscribeFirestore();
  };
}

export async function saveTenantCollectionToFirestore(tenantId: string, collectionName: string, items: any[]): Promise<void> {
  if (!tenantId || !collectionName) return;
  const docId = `${tenantId}_${collectionName}`;
  const cacheKey = `collection_${docId}`;
  const serialized = JSON.stringify(items);
  if (lastKnownDocCache.get(cacheKey) === serialized) return;

  // Immediately mark in cache to suppress duplicate triggers
  lastKnownDocCache.set(cacheKey, serialized);

  const payload = {
    items,
    updatedAt: new Date().toISOString()
  };

  // Always save directly to Home Server persistent database in /app/data/inoms_db.json
  saveHomeServerDbKey(`col_${docId}`, payload);

  if (isFirestoreQuotaExhausted) {
    saveToPendingQueue(TENANT_COLLECTIONS_COLLECTION, docId, payload);
    return;
  }

  // Debounce writes by 1500ms for Firestore to conserve quota
  if (writeDebounceTimers.has(cacheKey)) {
    clearTimeout(writeDebounceTimers.get(cacheKey)!);
  }

  writeDebounceTimers.set(
    cacheKey,
    setTimeout(async () => {
      try {
        await setDoc(doc(db, TENANT_COLLECTIONS_COLLECTION, docId), payload, { merge: true });
      } catch (err) {
        handleFirestoreError(`saveTenantCollectionToFirestore(${docId})`, err);
        saveToPendingQueue(TENANT_COLLECTIONS_COLLECTION, docId, payload);
      }
    }, 1500)
  );
}

