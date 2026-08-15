/**
 * Authenticated API Client for INOMS Home Server Full-Stack Architecture
 */

import { getAuthToken, setAuthToken, clearAuthToken } from './localDb';

export interface LoginResponse {
  success: boolean;
  token?: string;
  sessionId?: string;
  user?: {
    id: string;
    name: string;
    role: string;
    username?: string;
    mobile?: string;
    tenantId: string;
  };
  organization?: {
    id: string;
    name: string;
    code: string;
    ownerMobile: string;
    ownerName: string;
    status: string;
  };
  message?: string;
}

export async function loginViaApi(params: {
  tenantId: string;
  pin?: string;
  username?: string;
  password?: string;
  deviceInfo?: string;
}): Promise<LoginResponse> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (data.success && data.token) {
      setAuthToken(data.token, true);
    }
    return data;
  } catch (err: any) {
    console.warn('Login API error:', err);
    return { success: false, message: 'Could not connect to Home Server' };
  }
}

export async function logoutViaApi(): Promise<void> {
  try {
    const token = getAuthToken();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    }
  } catch (e) {}
  clearAuthToken();
}

export async function verifyTOTPViaApi(
  tenantIdOrMobile: string,
  code: string,
  secretKey?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenantIdOrMobile,
        code,
        secretKey
      })
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    return false;
  }
}

export async function verifyMasterPinViaApi(codeOrPin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/verify-master-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: codeOrPin
      })
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    return false;
  }
}

export async function verifyOrgPinViaApi(tenantId: string, pin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        pin
      })
    });
    const data = await res.json();
    if (data.success && data.token) {
      setAuthToken(data.token);
    }
    return !!data.success;
  } catch (err) {
    return false;
  }
}

export async function fetchAdminOrganizationsViaApi(): Promise<{ success: boolean; organizations?: any[]; message?: string }> {
  try {
    const token = getAuthToken();
    const res = await fetch('/api/admin/organizations', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Could not fetch admin organizations' };
  }
}

export async function staffLoginViaApi(
  tenantId: string,
  username: string,
  password: string
): Promise<{ success: boolean; user?: any; role?: string; message?: string }> {
  try {
    const res = await loginViaApi({ tenantId, username, password });
    if (res.success && res.user) {
      return { success: true, user: res.user, role: res.user.role };
    }
    return { success: false, message: res.message || 'Login failed' };
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function registerOrgViaApi(
  name: string,
  ownerMobile: string,
  ownerName?: string,
  pin?: string
): Promise<{ success: boolean; org?: any; message?: string }> {
  try {
    const res = await fetch('/api/auth/register-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, ownerMobile, ownerName, pin })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function lookupOrgByMobileViaApi(
  mobileOrCode: string
): Promise<{ success: boolean; org?: any; message?: string }> {
  try {
    const res = await fetch('/api/auth/lookup-mobile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile: mobileOrCode, code: mobileOrCode })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Could not connect to server during organization lookup' };
  }
}

export async function updateOrgViaApi(
  orgData: any
): Promise<{ success: boolean; org?: any; message?: string }> {
  try {
    const res = await fetch('/api/auth/update-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgData)
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function deleteOrgViaApi(
  id: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/auth/delete-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'Server connection error' };
  }
}

export async function fetchServerHealth(): Promise<any> {
  try {
    const res = await fetch('/api/health');
    return await res.json();
  } catch (e) {
    return { status: 'offline' };
  }
}

export async function getHomeServerDbKey(key: string): Promise<any> {
  return null;
}

export async function saveHomeServerDbKey(key: string, data: any): Promise<boolean> {
  return true;
}

export async function restoreHomeServerDb(data: any): Promise<boolean> {
  return true;
}

export async function registerHomeServerSession(
  tenantId: string,
  sessionUserId: string,
  sessionId: string,
  deviceInfo?: string
): Promise<void> {
  // Session registration handled via login tokens
}

export async function checkHomeServerSession(
  tenantId: string,
  sessionUserId: string
): Promise<{ activeSessionId?: string; deviceInfo?: string } | null> {
  return null;
}
