/**
 * Generates an organization-specific prefix for backup file names.
 * - Master Admin / Master System Admin -> "Master_Admin"
 * - Nibban Technologies -> "Nibban"
 * - Any other organization -> Cleaned name (e.g. "Sri_Krishna_Computers")
 */
export function getBackupOrgPrefix(orgName?: string, orgId?: string): string {
  if (orgId === 'org-admin') return 'Master_Admin';
  if (!orgName) return 'INOMS';

  const lower = orgName.trim().toLowerCase();
  if (
    lower.includes('master admin') ||
    lower.includes('master system admin') ||
    lower === 'admin' ||
    lower === 'master'
  ) {
    return 'Master_Admin';
  }

  if (lower.includes('inoms') || lower.includes('nibban')) {
    return 'INOMS';
  }

  // Sanitize name: convert non-alphanumeric to underscores
  const clean = orgName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return clean || 'INOMS';
}
