export function getAppStorageItem(keySuffix: string): string | null {
  try {
    const primaryKey = `inoms_${keySuffix}`;
    const legacyKey = `repair_track_${keySuffix}`;
    const legacyKey2 = `nibban_${keySuffix}`;
    const val = localStorage.getItem(primaryKey);
    if (val !== null) return val;
    const val2 = localStorage.getItem(legacyKey);
    if (val2 !== null) return val2;
    return localStorage.getItem(legacyKey2);
  } catch {
    return null;
  }
}

export function setAppStorageItem(keySuffix: string, value: string): void {
  try {
    const primaryKey = `inoms_${keySuffix}`;
    localStorage.setItem(primaryKey, value);
  } catch {}
}

export function removeAppStorageItem(keySuffix: string): void {
  try {
    localStorage.removeItem(`inoms_${keySuffix}`);
    localStorage.removeItem(`repair_track_${keySuffix}`);
    localStorage.removeItem(`nibban_${keySuffix}`);
  } catch {}
}

export function getAppSessionItem(keySuffix: string): string | null {
  try {
    const primaryKey = `inoms_${keySuffix}`;
    const legacyKey = `repair_track_${keySuffix}`;
    const legacyKey2 = `nibban_${keySuffix}`;
    const val = sessionStorage.getItem(primaryKey);
    if (val !== null) return val;
    const val2 = sessionStorage.getItem(legacyKey);
    if (val2 !== null) return val2;
    return sessionStorage.getItem(legacyKey2);
  } catch {
    return null;
  }
}

export function setAppSessionItem(keySuffix: string, value: string): void {
  try {
    const primaryKey = `inoms_${keySuffix}`;
    sessionStorage.setItem(primaryKey, value);
  } catch {}
}

export function removeAppSessionItem(keySuffix: string): void {
  try {
    sessionStorage.removeItem(`inoms_${keySuffix}`);
    sessionStorage.removeItem(`repair_track_${keySuffix}`);
    sessionStorage.removeItem(`nibban_${keySuffix}`);
  } catch {}
}

