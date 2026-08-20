import { openDB, IDBPDatabase } from 'idb';
import { getAppStorageItem, setAppStorageItem } from './storage';

const DB_NAME = 'inoms_local_replica_v2';
const DB_VERSION = 1;
function isHomeServerSyncEnabled(tenantId: string): boolean {
  if (tenantId === 'org-admin') return true;
  try {
    const raw = getAppStorageItem('tenants_v3') || localStorage.getItem('tenants_v3');
    const tenants = raw ? JSON.parse(raw) : [];
    const tenant = Array.isArray(tenants) ? tenants.find((item: any) => item.id === tenantId) : null;
    return tenant?.features?.allowHomeServerSync !== false;
  } catch {
    return true;
  }
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getLocalDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Entities store: key is compound `tenantId:entity:id`
        if (!db.objectStoreNames.contains('entities')) {
          const entityStore = db.createObjectStore('entities', { keyPath: 'key' });
          entityStore.createIndex('by_tenant_entity', ['tenantId', 'entity']);
          entityStore.createIndex('by_tenant', 'tenantId');
        }

        // Pending operations queue for offline replication
        if (!db.objectStoreNames.contains('pending_ops')) {
          const opStore = db.createObjectStore('pending_ops', { keyPath: 'id' });
          opStore.createIndex('by_tenant', 'tenantId');
          opStore.createIndex('by_timestamp', 'timestamp');
        }

        // Metadata store: revisions, sync status
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      }
    }).then(async (db) => {
      // Clean up any stale backlog in pending_ops if it accumulated from previous infinite loops
      try {
        const count = await db.count('pending_ops');
        if (count > 200) {
          const tx = db.transaction('pending_ops', 'readwrite');
          await tx.objectStore('pending_ops').clear();
          await tx.done;
        }
      } catch (_) {}
      return db;
    });
  }
  return dbPromise;
}

export interface PendingOp {
  id: string;
  tenantId: string;
  entity: string;
  operation: 'create' | 'update' | 'delete';
  record: any;
  expectedVersion?: number;
  timestamp: string;
  retryCount: number;
  error?: string;
}

// Token management in storage
const SESSION_TOKEN_KEY = 'inoms_auth_token';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SESSION_TOKEN_KEY) || sessionStorage.getItem(SESSION_TOKEN_KEY);
}

export function setAuthToken(token: string, persist = true): void {
  if (typeof window === 'undefined') return;
  if (persist) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  }
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

// Event notification bus for reactive UI updates with strict tenant scoping
type EntityListener = (tenantId: string, entity: string, data: any[]) => void;
const listeners = new Set<EntityListener>();

export function subscribeLocalDb(listener: EntityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(tenantId: string, entity: string, data: any[]) {
  listeners.forEach(l => {
    try {
      l(tenantId, entity, data);
    } catch (e) {
      console.warn('Listener notification error:', e);
    }
  });
}

// -------------------------------------------------------------
// LOCAL REPLICA DATA ACCESS
// -------------------------------------------------------------

export async function getLocalCollection<T = any>(tenantId: string, entity: string): Promise<T[]> {
  const db = await getLocalDB();
  const tx = db.transaction('entities', 'readonly');
  const index = tx.store.index('by_tenant_entity');
  const records = await index.getAll([tenantId, entity]);
  return records
    .filter(r => !r.deletedAt)
    .map(r => r.data as T);
}

export async function saveLocalRecord<T extends { id: string; version?: number }>(
  tenantId: string,
  entity: string,
  record: T,
  queuePush = true,
  operation: 'create' | 'update' = 'update'
): Promise<void> {
  const db = await getLocalDB();
  const key = `${tenantId}:${entity}:${record.id}`;
  const now = new Date().toISOString();

  const entityRecord = {
    key,
    tenantId,
    entity,
    id: record.id,
    version: record.version || 1,
    updatedAt: now,
    deletedAt: null,
    data: record
  };

  const tx = db.transaction(['entities', 'pending_ops'], 'readwrite');
  await tx.objectStore('entities').put(entityRecord);

    if (queuePush && isHomeServerSyncEnabled(tenantId) && getAuthToken()) {
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pendingOp: PendingOp = {
      id: opId,
      tenantId,
      entity,
      operation,
      record,
      expectedVersion: record.version,
      timestamp: now,
      retryCount: 0
    };
    await tx.objectStore('pending_ops').put(pendingOp);
  }

  await tx.done;

  // Trigger background push if online and authenticated
  if (queuePush && isHomeServerSyncEnabled(tenantId) && navigator.onLine && getAuthToken()) {
    pushPendingOperations(tenantId).catch(() => {});
  }
}

export async function deleteLocalRecord(
  tenantId: string,
  entity: string,
  recordId: string,
  queuePush = true
): Promise<void> {
  const db = await getLocalDB();
  const key = `${tenantId}:${entity}:${recordId}`;
  const now = new Date().toISOString();

  const tx = db.transaction(['entities', 'pending_ops'], 'readwrite');
  const existing = await tx.objectStore('entities').get(key);

  if (existing) {
    existing.deletedAt = now;
    existing.updatedAt = now;
    await tx.objectStore('entities').put(existing);
  }

    if (queuePush && isHomeServerSyncEnabled(tenantId) && getAuthToken()) {
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const pendingOp: PendingOp = {
      id: opId,
      tenantId,
      entity,
      operation: 'delete',
      record: { id: recordId, version: existing?.version },
      expectedVersion: existing?.version,
      timestamp: now,
      retryCount: 0
    };
    await tx.objectStore('pending_ops').put(pendingOp);
  }

  await tx.done;

  if (queuePush && isHomeServerSyncEnabled(tenantId) && navigator.onLine && getAuthToken()) {
    pushPendingOperations(tenantId).catch(() => {});
  }
}

// Replace an entire local collection safely (e.g. from local memory bulk mirror)
export async function replaceLocalCollection<T extends { id: string }>(
  tenantId: string,
  entity: string,
  items: T[],
  queuePush = false,
  notify = false
): Promise<void> {
  if (!tenantId || !entity) return;
  const safeItems = Array.isArray(items) ? items : [];
  const db = await getLocalDB();
  const tx = db.transaction(['entities', 'pending_ops'], 'readwrite');
  const entitiesStore = tx.objectStore('entities');
  const pendingStore = tx.objectStore('pending_ops');
  const now = new Date().toISOString();

  // 1. Clear out records that are no longer in items for this tenant and entity
  const index = entitiesStore.index('by_tenant_entity');
  const existingRecords = await index.getAll([tenantId, entity]);
  const newItemIdSet = new Set(safeItems.map(it => it.id));

  for (const existing of existingRecords) {
    if (!newItemIdSet.has(existing.id)) {
      await entitiesStore.delete(existing.key);
      if (queuePush && isHomeServerSyncEnabled(tenantId) && getAuthToken()) {
        await pendingStore.put({
          id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          tenantId,
          entity,
          operation: 'delete',
          record: { id: existing.id },
          timestamp: now,
          retryCount: 0
        });
      }
    }
  }

  // 2. Put fresh/updated items
  for (const item of safeItems) {
    if (!item?.id) continue;
    const key = `${tenantId}:${entity}:${item.id}`;
    await entitiesStore.put({
      key,
      tenantId,
      entity,
      id: item.id,
      version: (item as any).version || 1,
      updatedAt: (item as any).updatedAt || now,
      deletedAt: null,
      data: item
    });

    if (queuePush && isHomeServerSyncEnabled(tenantId) && getAuthToken()) {
      await pendingStore.put({
        id: `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenantId,
        entity,
        operation: 'update',
        record: item,
        timestamp: now,
        retryCount: 0
      });
    }
  }

  await tx.done;

  if (queuePush && isHomeServerSyncEnabled(tenantId) && navigator.onLine && getAuthToken()) {
    pushPendingOperations(tenantId).catch(() => {});
  }

  if (notify) {
    const all = await getLocalCollection(tenantId, entity);
    notifyListeners(tenantId, entity, all);
  }
}

// -------------------------------------------------------------
// SYNCHRONIZATION WITH HOME SERVER
// -------------------------------------------------------------

// 1. Full Authoritative Bootstrap on Login or New Device Setup
export async function bootstrapTenantFromHomeServer(tenantId: string): Promise<{
  serverRevision: number;
  companyConfig: any;
  collections: Record<string, any[]>;
} | null> {
  if (!tenantId) return null;
  if (!isHomeServerSyncEnabled(tenantId)) return null;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`/api/sync/bootstrap?tenantId=${encodeURIComponent(tenantId)}`, { headers });
    if (!res.ok) {
      if (res.status === 401 && token) {
        clearAuthToken();
      }
      return null;
    }

    const data = await res.json();
    if (!data.success) {
      return null;
    }

    let collections = data.collections || {};
    const totalServerRecords = Object.values(collections).reduce((acc: number, arr: any) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

    // Local-first merge: never discard records created or edited while the
    // server was disabled or unreachable. Local records win on duplicate IDs.
    const entityList = ['clients', 'jobs', 'invoices', 'products', 'ledger', 'payments', 'expenses', 'users', 'categories', 'racks', 'equipments', 'problems', 'logs'];
    const localCollections: Record<string, any[]> = {};
    let localHasData = false;
    for (const entityName of entityList) {
      let parsed: any[] = [];
      // A present localStorage collection is a complete tenant snapshot and
      // must remain authoritative so local deletions are not resurrected.
      const stored = getAppStorageItem(`${entityName}_${tenantId}`) || getAppStorageItem(`app_storage_${entityName}_${tenantId}`);
      if (stored !== null && stored !== undefined) {
        try {
          const storedParsed = JSON.parse(stored);
          if (Array.isArray(storedParsed)) parsed = storedParsed;
        } catch (e) {}
      } else {
        try {
          parsed = await getLocalCollection(tenantId, entityName);
        } catch (e) {}
      }
      if (parsed.length || stored !== null && stored !== undefined) {
        localHasData = true;
        localCollections[entityName] = parsed;
      } else {
        const indexedRecords = await getLocalCollection(tenantId, entityName).catch(() => []);
        if (indexedRecords.length) {
          localHasData = true;
          localCollections[entityName] = indexedRecords;
        }
      }
    }

    if (localHasData) {
      const mergedCollections: Record<string, any[]> = { ...collections };
      for (const entityName of entityList) {
        const serverItems = Array.isArray(collections[entityName]) ? collections[entityName] : [];
        const localItems = localCollections[entityName] || [];
        const merged = new Map<string, any>();
        serverItems.forEach(item => { if (item?.id) merged.set(item.id, item); });
        localItems.forEach(item => { if (item?.id) merged.set(item.id, item); });
        if (merged.size > 0) mergedCollections[entityName] = Array.from(merged.values());
      }
      collections = mergedCollections;

      const localConfigRaw = getAppStorageItem(`company_config_${tenantId}`);
      let localConfig: any = data.companyConfig || null;
      if (localConfigRaw) {
        try { localConfig = JSON.parse(localConfigRaw); } catch (e) {}
      }
      if (token) {
        await fetch('/api/sync/save-all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-tenant-id': tenantId,
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ tenantId, companyConfig: localConfig, collections })
        }).catch(() => {});
      }
      data.companyConfig = localConfig;
    }

    // Safeguard: If server returned 0 records, check if local storage has valid records
    // Prevent accidental data wipe on refresh when server was newly initialized
    if (totalServerRecords === 0) {
      if (localHasData) {
        console.info(`[Bootstrap] Home Server has 0 records for ${tenantId}, preserving ${Object.keys(localCollections).length} local collections.`);
        return {
          serverRevision: 1,
          companyConfig: data.companyConfig,
          collections: localCollections
        };
      }
    }

    const db = await getLocalDB();
    const tx = db.transaction(['entities', 'metadata'], 'readwrite');
    const entitiesStore = tx.objectStore('entities');
    const metaStore = tx.objectStore('metadata');
    const now = new Date().toISOString();

    // Clear existing local entities for this tenant to eliminate old stale replicas
    const index = entitiesStore.index('by_tenant');
    const existingKeys = await index.getAllKeys(tenantId);
    for (const k of existingKeys) {
      await entitiesStore.delete(k);
    }

    // Populate fresh authoritative entities from Home Server
    for (const [entityName, items] of Object.entries(collections)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item?.id) continue;
          const key = `${tenantId}:${entityName}:${item.id}`;
          await entitiesStore.put({
            key,
            tenantId,
            entity: entityName,
            id: item.id,
            version: item.version || 1,
            updatedAt: item.updatedAt || now,
            deletedAt: null,
            data: item
          });
        }
      }
    }

    // Store server revision & metadata
    await metaStore.put({
      key: `revision_${tenantId}`,
      revision: data.serverRevision || 1,
      lastSyncTime: now
    });

    if (data.companyConfig) {
      await metaStore.put({
        key: `config_${tenantId}`,
        config: data.companyConfig
      });
      setAppStorageItem(`company_config_${tenantId}`, JSON.stringify(data.companyConfig));
    }

    await tx.done;

    // Populate app storage and notify UI of fresh authoritative data
    for (const [entityName, items] of Object.entries(collections)) {
      if (Array.isArray(items) && items.length > 0) {
        setAppStorageItem(`${entityName}_${tenantId}`, JSON.stringify(items));
      }
      notifyListeners(tenantId, entityName, (items || []) as any[]);
    }

    return data;
  } catch (err) {
    return null;
  }
}

// 2. Incremental Delta Pull
export async function pullDeltaFromHomeServer(tenantId: string): Promise<number> {
  if (!tenantId) return 0;
  if (!isHomeServerSyncEnabled(tenantId)) return 0;
  const token = getAuthToken();

  try {
    const db = await getLocalDB();
    const meta = await db.get('metadata', `revision_${tenantId}`);
    const sinceRevision = meta?.revision || 0;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/sync/pull?sinceRevision=${sinceRevision}&tenantId=${encodeURIComponent(tenantId)}`, { headers });
    if (!res.ok) {
      if (res.status === 401 && token) clearAuthToken();
      return sinceRevision;
    }

    const data = await res.json();
    if (!data.success || !data.hasChanges || !Array.isArray(data.changes)) {
      return sinceRevision;
    }

    const tx = db.transaction(['entities', 'metadata'], 'readwrite');
    const entitiesStore = tx.objectStore('entities');
    const metaStore = tx.objectStore('metadata');
    const affectedEntities = new Set<string>();

    for (const change of data.changes) {
      const { entity, entityId, operation, data: recordData } = change;
      const key = `${tenantId}:${entity}:${entityId}`;

      if (operation === 'delete') {
        const existing = await entitiesStore.get(key);
        const existingUpdatedAt = existing?.data?.updatedAt || existing?.updatedAt || '';
        const remoteTimestamp = change.timestamp || '';
        if (existing && (!existingUpdatedAt || !remoteTimestamp || existingUpdatedAt <= remoteTimestamp)) {
          existing.deletedAt = change.timestamp || new Date().toISOString();
          await entitiesStore.put(existing);
        }
      } else if (recordData) {
        const existing = await entitiesStore.get(key);
        const localUpdatedAt = existing?.data?.updatedAt || existing?.updatedAt || '';
        const remoteUpdatedAt = recordData.updatedAt || change.timestamp || '';
        if (!existing || !localUpdatedAt || !remoteUpdatedAt || localUpdatedAt <= remoteUpdatedAt) {
          await entitiesStore.put({
            key,
            tenantId,
            entity,
            id: entityId,
            version: recordData.version || 1,
            updatedAt: remoteUpdatedAt || new Date().toISOString(),
            deletedAt: null,
            data: recordData
          });
        }
      }
      affectedEntities.add(entity);
    }

    await metaStore.put({
      key: `revision_${tenantId}`,
      revision: data.currentRevision,
      lastSyncTime: new Date().toISOString()
    });

    await tx.done;

    // Notify affected UI components
    for (const ent of affectedEntities) {
      const fresh = await getLocalCollection(tenantId, ent);
      notifyListeners(tenantId, ent, fresh);
    }

    return data.currentRevision;
  } catch (err) {
    return 0;
  }
}

// 3. Push Pending Operations to Home Server
let isPushing = false;
export async function pushPendingOperations(tenantId: string): Promise<{
  success: boolean;
  committedCount: number;
  remainingCount: number;
}> {
  if (!tenantId) return { success: false, committedCount: 0, remainingCount: 0 };
  if (!isHomeServerSyncEnabled(tenantId)) return { success: false, committedCount: 0, remainingCount: 0 };
  const token = getAuthToken();

  if (isPushing) return { success: true, committedCount: 0, remainingCount: 0 };
  isPushing = true;

  try {
    const db = await getLocalDB();
    const index = db.transaction('pending_ops').store.index('by_tenant');
    const ops = await index.getAll(tenantId);

    if (ops.length === 0) {
      return { success: true, committedCount: 0, remainingCount: 0 };
    }

    // Safety guard: de-duplicate operations by entity+recordId keeping only newest
    const opMap = new Map<string, PendingOp>();
    for (const op of ops) {
      const recId = op.record?.id || op.id;
      const opKey = `${op.entity}:${recId}`;
      opMap.set(opKey, op);
    }
    const deduplicatedOps = Array.from(opMap.values()).slice(0, 100);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/sync/push', {
      method: 'POST',
      headers,
      body: JSON.stringify({ tenantId, operations: deduplicatedOps })
    });

    if (!res.ok) {
      if (res.status === 401 && token) clearAuthToken();
      return { success: false, committedCount: 0, remainingCount: ops.length };
    }

    const result = await res.json();
    if (result.success) {
      const tx = db.transaction(['pending_ops', 'metadata'], 'readwrite');
      for (const op of ops) {
        await tx.objectStore('pending_ops').delete(op.id);
      }
      if (result.serverRevision) {
        await tx.objectStore('metadata').put({
          key: `revision_${tenantId}`,
          revision: result.serverRevision,
          lastSyncTime: new Date().toISOString()
        });
      }
      await tx.done;

      return {
        success: true,
        committedCount: result.committedCount || ops.length,
        remainingCount: 0
      };
    } else {
      return { success: false, committedCount: 0, remainingCount: ops.length };
    }
  } catch (err) {
    return { success: false, committedCount: 0, remainingCount: 1 };
  } finally {
    isPushing = false;
  }
}

export async function getPendingOperationsCount(tenantId: string): Promise<number> {
  try {
    const db = await getLocalDB();
    const index = db.transaction('pending_ops').store.index('by_tenant');
    const count = await index.count(tenantId);
    return count;
  } catch {
    return 0;
  }
}

