/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Dynamically computes an Organization / Company Prefix from the Company Name or Tenant Code.
 * E.g., "Nibban Tech Solutions" -> "NTS"
 *       "Nibban Technologies" -> "NTS" or "NT"
 *       "ABC Electronics" -> "ABC"
 *       "Apex Computer Services" -> "ACS"
 */
export function getOrgPrefix(companyName: string, tenantCode?: string): string {
  if (tenantCode && tenantCode !== 'ADMIN-00' && tenantCode.includes('-')) {
    const codePrefix = tenantCode.split('-')[0].trim().toUpperCase();
    if (codePrefix && codePrefix.length >= 2) return codePrefix;
  }

  if (!companyName) return 'ERP';

  const cleanName = companyName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const rawWords = cleanName.split(/\s+/).filter(Boolean);

  if (rawWords.length === 0) return 'ERP';

  // Filter out noise words if multi-word
  const stopWords = ['AND', 'THE', 'PVT', 'LTD', 'INC', 'CO', 'TECHNOLOGIES', 'ENTERPRISES'];
  let filtered = rawWords.filter(w => !stopWords.includes(w.toUpperCase()));
  if (filtered.length === 0) filtered = rawWords;

  if (filtered.length >= 3) {
    return (filtered[0][0] + filtered[1][0] + filtered[2][0]).toUpperCase();
  } else if (filtered.length === 2) {
    return (filtered[0][0] + filtered[1][0]).toUpperCase();
  } else if (filtered.length === 1) {
    const single = filtered[0];
    if (single.length >= 3) {
      return single.substring(0, 3).toUpperCase();
    }
    return single.toUpperCase();
  }

  return 'ERP';
}
