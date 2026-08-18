/**
 * Real-time Multi-Tab & Cross-Device Synchronization Coordinator
 * Provides zero-lag cross-tab synchronization via BroadcastChannel and 
 * lightweight fast polling against the Home Server revision log.
 */

import { bootstrapTenantFromHomeServer, pullDeltaFromHomeServer } from './localDb';

export interface SyncBroadcastMessage {
  type: 'MUTATION' | 'SYNC_REQUEST' | 'RELOAD_COLLECTION';
  tenantId: string;
  entity?: string;
  items?: any[];
  config?: any;
  revision?: number;
  timestamp: string;
  senderTabId: string;
}

const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const BROADCAST_CHANNEL_NAME = 'inoms_live_sync_bus';
const LOCAL_STORAGE_PULSE_KEY = 'inoms_live_sync_pulse';

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  console.warn('[Sync Broadcast] BroadcastChannel not supported, falling back to storage pulse:', e);
}

type SyncCallback = (msg: SyncBroadcastMessage) => void;
const subscribers = new Set<SyncCallback>();

// Listen to incoming messages on BroadcastChannel
if (channel) {
  channel.onmessage = (event) => {
    const msg: SyncBroadcastMessage = event.data;
    if (msg && msg.senderTabId !== TAB_ID) {
      subscribers.forEach(cb => {
        try {
          cb(msg);
        } catch (err) {
          console.warn('[Sync Broadcast] Subscriber callback error:', err);
        }
      });
    }
  };
}

// Fallback for browsers / iframes that restrict BroadcastChannel: window storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === LOCAL_STORAGE_PULSE_KEY && event.newValue) {
      try {
        const msg: SyncBroadcastMessage = JSON.parse(event.newValue);
        if (msg && msg.senderTabId !== TAB_ID) {
          subscribers.forEach(cb => {
            try {
              cb(msg);
            } catch (err) {
              console.warn('[Sync Broadcast] Storage subscriber callback error:', err);
            }
          });
        }
      } catch (_) {}
    }
  });
}

/**
 * Broadcast an entity mutation to all other tabs and windows in real-time (<1ms)
 */
export function broadcastLocalMutation(
  tenantId: string,
  entity: string,
  items?: any[],
  config?: any
): void {
  if (typeof window === 'undefined') return;

  const msg: SyncBroadcastMessage = {
    type: 'MUTATION',
    tenantId,
    entity,
    items,
    config,
    timestamp: new Date().toISOString(),
    senderTabId: TAB_ID
  };

  if (channel) {
    try {
      channel.postMessage(msg);
    } catch (_) {}
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_PULSE_KEY, JSON.stringify(msg));
  } catch (_) {}
}

/**
 * Subscribe to real-time cross-tab broadcasts
 */
export function subscribeSyncBroadcast(callback: SyncCallback): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Fast check of server revision (<5ms)
 */
export async function checkServerRevision(tenantId: string): Promise<number> {
  if (!tenantId || typeof window === 'undefined') return 0;
  try {
    const res = await fetch(`/api/sync/version?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.currentRevision || 0;
  } catch {
    return 0;
  }
}

/**
 * Active Cross-Device Live Polling Service
 * Checks Home Server revision every intervalMs (default 3.5s) and immediately on tab focus.
 * When a remote device makes an edit, onRemoteDelta is triggered to update the live UI.
 */
export function startLiveSyncPolling(
  tenantId: string,
  onRemoteDelta: () => Promise<void> | void,
  intervalMs = 3500
): () => void {
  if (!tenantId || typeof window === 'undefined') return () => {};

  let isPolling = false;
  let lastRevision = 0;
  let isChecking = false;

  // Initialize current revision
  checkServerRevision(tenantId).then(rev => {
    lastRevision = rev;
  });

  const runCheck = async () => {
    if (isChecking || !navigator.onLine) return;
    isChecking = true;
    try {
      const serverRev = await checkServerRevision(tenantId);
      if (serverRev > 0) {
        if (lastRevision > 0 && serverRev > lastRevision) {
          console.info(`[Live Sync] Remote modification detected on server (rev ${lastRevision} -> ${serverRev}). Pulling updates...`);
          lastRevision = serverRev;
          await onRemoteDelta();
        } else {
          lastRevision = Math.max(lastRevision, serverRev);
        }
      }
    } catch (err) {
      // Silent catch
    } finally {
      isChecking = false;
    }
  };

  const intervalTimer = setInterval(runCheck, intervalMs);

  const onFocusOrVisible = () => {
    if (document.visibilityState === 'visible') {
      runCheck();
    }
  };

  window.addEventListener('focus', onFocusOrVisible);
  document.addEventListener('visibilitychange', onFocusOrVisible);

  return () => {
    clearInterval(intervalTimer);
    window.removeEventListener('focus', onFocusOrVisible);
    document.removeEventListener('visibilitychange', onFocusOrVisible);
  };
}
