export function getAppStorageItem(keySuffix: string): string | null {
  const primaryKey = `inoms_${keySuffix}`;
  const legacyKey = `repair_track_${keySuffix}`;
  const legacyKey2 = `nibban_${keySuffix}`;
  const val = localStorage.getItem(primaryKey);
  if (val !== null) return val;
  const val2 = localStorage.getItem(legacyKey);
  if (val2 !== null) return val2;
  return localStorage.getItem(legacyKey2);
}

export function setAppStorageItem(keySuffix: string, value: string): void {
  const primaryKey = `inoms_${keySuffix}`;
  localStorage.setItem(primaryKey, value);
}

export function removeAppStorageItem(keySuffix: string): void {
  localStorage.removeItem(`inoms_${keySuffix}`);
  localStorage.removeItem(`repair_track_${keySuffix}`);
  localStorage.removeItem(`nibban_${keySuffix}`);
}

export function getAppSessionItem(keySuffix: string): string | null {
  const primaryKey = `inoms_${keySuffix}`;
  const legacyKey = `repair_track_${keySuffix}`;
  const legacyKey2 = `nibban_${keySuffix}`;
  const val = sessionStorage.getItem(primaryKey);
  if (val !== null) return val;
  const val2 = sessionStorage.getItem(legacyKey);
  if (val2 !== null) return val2;
  return sessionStorage.getItem(legacyKey2);
}

export function setAppSessionItem(keySuffix: string, value: string): void {
  const primaryKey = `inoms_${keySuffix}`;
  sessionStorage.setItem(primaryKey, value);
}

export function removeAppSessionItem(keySuffix: string): void {
  sessionStorage.removeItem(`inoms_${keySuffix}`);
  sessionStorage.removeItem(`repair_track_${keySuffix}`);
  sessionStorage.removeItem(`nibban_${keySuffix}`);
}
