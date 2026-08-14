const DB_NAME = 'INOMS_FS_DB';
const LEGACY_DB_NAME = 'RepairTrack_FS_DB';
const STORE_NAME = 'handles';

function getHandleKey(tenantId: string = 'org-admin'): string {
  return `target_backup_dir_handle_${tenantId}`;
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle, tenantId: string = 'org-admin'): Promise<void> {
  const key = getHandleKey(tenantId);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch {
          // Ignore upgradeneeded error
        }
      };
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const putReq = store.put(handle, key);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getDirectoryHandle(tenantId: string = 'org-admin'): Promise<FileSystemDirectoryHandle | null> {
  const key = getHandleKey(tenantId);
  const getFromDB = (dbName: string): Promise<FileSystemDirectoryHandle | null> => {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            resolve(null);
            return;
          }
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const getReq = store.get(key);
          getReq.onsuccess = () => {
            resolve(getReq.result || null);
          };
          getReq.onerror = () => resolve(null);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  };

  const currentHandle = await getFromDB(DB_NAME);
  if (currentHandle) return currentHandle;
  return await getFromDB(LEGACY_DB_NAME);
}

export async function removeDirectoryHandle(tenantId: string = 'org-admin'): Promise<void> {
  const key = getHandleKey(tenantId);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve();
          return;
        }
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const delReq = store.delete(key);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function requestFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const handleAny = handle as any;
    if (typeof handleAny.requestPermission === 'function') {
      const state = await handleAny.requestPermission({ mode: 'readwrite' });
      return state === 'granted';
    }
    return true;
  } catch {
    return false;
  }
}

export async function getLatestBackupFromDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  tenantId?: string,
  orgName?: string
): Promise<{ filename: string; data: any; mtime: number } | null> {
  try {
    const dirHandleAny = dirHandle as any;
    let perm = 'granted';
    if (typeof dirHandleAny.queryPermission === 'function') {
      perm = await dirHandleAny.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && typeof dirHandleAny.requestPermission === 'function') {
        try {
          perm = await dirHandleAny.requestPermission({ mode: 'readwrite' });
        } catch {
          // ignore
        }
      }
    }
    if (perm !== 'granted') return null;

    let newestFile: { filename: string; data: any; mtime: number } | null = null;

    if (dirHandleAny.values) {
      for await (const entry of dirHandleAny.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) {
          try {
            const file = await entry.getFile();
            const text = await file.text();
            const json = JSON.parse(text);
            if (json && typeof json === 'object' && (json.clients || json.jobs || json.invoices || json.payments || json.products)) {
              // Tenant data isolation check
              if (tenantId) {
                if (json.tenantId && json.tenantId !== tenantId) {
                  // File belongs to a different organization, ignore it!
                  continue;
                }
              }

              const mtime = file.lastModified || 0;
              if (!newestFile || mtime > newestFile.mtime) {
                newestFile = {
                  filename: entry.name,
                  data: json,
                  mtime
                };
              }
            }
          } catch {
            // ignore non-json or non-backup files
          }
        }
      }
    }
    return newestFile;
  } catch (err) {
    console.warn('Error reading directory handle files:', err);
    return null;
  }
}

export async function writeBackupToDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  jsonStr: string
): Promise<boolean> {
  try {
    const handleAny = dirHandle as any;
    if (typeof handleAny.queryPermission === 'function') {
      let perm = await handleAny.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        try {
          perm = await handleAny.requestPermission({ mode: 'readwrite' });
        } catch {
          // User gesture required or prompt dismissed
        }
      }
      if (perm !== 'granted') {
        return false;
      }
    }
    const fileHandle = await handleAny.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(jsonStr);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Direct folder write not available in current context:', err);
    return false;
  }
}
