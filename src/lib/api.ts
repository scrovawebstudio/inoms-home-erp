/**
 * Secure Backend API Client for INOMS Full-Stack System
 */

export async function verifyTOTPViaApi(secretKey: string, code: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretKey, code })
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.warn('API verify-totp call error, falling back to local verification:', err);
  }
  return false;
}

export async function verifyMasterPinViaApi(codeOrPin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify-master-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeOrPin, pin: codeOrPin })
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.warn('API verify-master-pin call error:', err);
  }
  return false;
}

export async function staffLoginViaApi(username: string, password: string, userList: any[]): Promise<{
  success: boolean;
  user?: any;
  role?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/auth/staff-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, userList })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('API staff-login call error:', err);
    return { success: false, message: 'Server connection error' };
  }
}

export async function registerOrgViaApi(name: string, ownerMobile: string, ownerName?: string, pin?: string): Promise<{
  success: boolean;
  org?: any;
  message?: string;
}> {
  try {
    const res = await fetch('/api/auth/register-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ownerMobile, ownerName, pin })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('API register-org call error:', err);
    return { success: false, message: 'Server connection error' };
  }
}

// Home Server Database API Client Helpers
export async function getHomeServerDbKey<T = any>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/db/get?key=${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      return data.data;
    }
  } catch (err) {
    console.warn(`Home Server DB fetch error for key "${key}":`, err);
  }
  return null;
}

export async function saveHomeServerDbKey(key: string, data: any): Promise<boolean> {
  try {
    const res = await fetch('/api/db/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data })
    });
    if (res.ok) {
      const result = await res.json();
      return !!result.success;
    }
  } catch (err) {
    console.warn(`Home Server DB save error for key "${key}":`, err);
  }
  return false;
}

export async function restoreHomeServerDb(fullDb: Record<string, any>): Promise<boolean> {
  try {
    const res = await fetch('/api/db/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullDb })
    });
    if (res.ok) {
      const result = await res.json();
      return !!result.success;
    }
  } catch (err) {
    console.warn('Home Server DB restore error:', err);
  }
  return false;
}
