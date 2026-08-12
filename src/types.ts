/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClientType = 'Walk-in' | 'Dealer';

export interface Client {
  id: string;
  tenantId?: string;
  name: string;
  type: ClientType;
  mobile: string;
  phone?: string;
  contactPerson?: string;
  email: string;
  address: string;
  state: string;
  outstandingBalance: number;
}

export interface ClientLedgerEntry {
  id: string;
  tenantId?: string;
  clientId: string;
  date: string;
  type: string;
  refNo: string;
  debit: number;
  credit: number;
  balance: number;
}

export type JobStatus = 'Received' | 'Work in Progress' | 'Approval Pending' | 'Ready' | 'Product Out' | 'Pending' | 'Completed' | 'Complete & Ready' | 'Outwarded';

export interface Problem {
  id: string;
  tenantId?: string;
  name: string;
}

export interface Equipment {
  id: string;
  tenantId?: string;
  name: string;
}

export interface Category {
  id: string;
  tenantId?: string;
  name: string;
}

export interface LocationRack {
  id: string;
  tenantId?: string;
  name: string;
}

export interface RepairJob {
  id: string; // Job ID (e.g. ALG/2026/101)
  tenantId?: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  inDate?: string;
  inwardDate?: string;
  outDate?: string;
  equipment: string;
  productName: string;
  productModel: string;
  serialNo: string;
  ramHDD?: string;
  ramHdd?: string;
  componentSpecs?: { [key: string]: string };
  problems: string[]; // List of selected problem names
  problemDescription: string;
  componentsChecklist: { [key: string]: boolean };
  additionalDetails: string;
  images: string[];
  estimateAmount: number;
  remarks: string;
  assignedTechnician: string;
  status: JobStatus;
  outwardedDate?: string;
  finalBillAmount?: number;
  actionTaken?: string;
  deliveryStatus?: string;
  deliveryType?: string;
  courierName?: string;
  trackingNo?: string;
  deliveredToName?: string;
  deliveredBy?: string;
  isReturnCase?: boolean;
  advanceAmount?: number;
  advancePaymentMode?: string;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Not Repaired';
  repairOutcome?: 'Repaired' | 'Not Repaired';
  advanceRefunded?: boolean;
  advanceRefundMode?: string;
}

export interface Payment {
  id: string;
  tenantId?: string;
  date: string;
  clientId: string;
  clientName: string;
  amount: number;
  mode: string; // UPI, Cash, Bank Transfer
  refNo?: string;
  remarks?: string;
  invoiceId?: string;
  linkedJobId?: string;
}

export interface InvoiceItem {
  id: string;
  productName: string;
  serialNo: string;
  qty: number;
  rate: number;
  total: number;
}

export interface Invoice {
  id: string; // Invoice No (e.g. ALG/2026/BILL/457)
  tenantId?: string;
  date: string;
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientAddress?: string;
  clientState?: string;
  clientGstin?: string;
  linkedJobId?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxPercent: number;
  taxAmount: number;
  deliveryCharges: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode: string;
  isPaid?: boolean;
  deductedAdvance?: number;
}

export interface Product {
  id: string;
  tenantId?: string;
  name: string;
  category: string;
  location: string;
  hsnCode: string;
  price: number;
  stock: number;
  minQtyAlert: number;
  description?: string;
}

export interface Expense {
  id: string;
  tenantId?: string;
  date: string;
  category: string; // Beer, Cigarette, Staff Payment, Others
  amount: number;
  remarks?: string;
}

export interface SystemUser {
  id: string;
  tenantId?: string;
  name: string;
  mobile: string;
  email: string;
  username: string;
  password?: string;
  pin?: string;
  role: 'Admin' | 'Front Desk' | 'Technician' | 'HR';
  permissions: { [key: string]: boolean };
  isDeactivated?: boolean;
  status?: 'Active' | 'Deactivated';
}

export interface ActivityLog {
  id: string;
  tenantId?: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface TenantThemePalette {
  buttonBg: string;       // Primary / Action Buttons Color
  buttonText: string;     // Button Text Color
  sidebarBg: string;      // Left Navigation Sidebar Background
  sidebarText: string;    // Sidebar Text Color
  appBg: string;          // Main Workspace Background Color
  fontAccent: string;     // Accent / Highlight Font Color
  topHeaderBg: string;    // Top Bar Header Background
}

export const DEFAULT_THEME_PALETTE: TenantThemePalette = {
  buttonBg: '#0d9488',
  buttonText: '#ffffff',
  sidebarBg: '#0f172a',
  sidebarText: '#94a3b8',
  appBg: '#f8fafc',
  fontAccent: '#0f766e',
  topHeaderBg: '#ffffff'
};

export interface CompanyConfig {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  logoUrl?: string;
  signatureUrl?: string;
  upiId?: string;
  upiQrUrl?: string;
  bankAccountName?: string;
  bankName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  syncMode: 'offline' | 'wifi' | 'lan';
  cloudSyncEnabled?: boolean;
  lanHostIp: string;
  driveConnected: boolean;
  driveAccountEmail?: string;
  driveAccessToken?: string;
  driveFolderPath?: string;
  lastDriveBackupTime?: string;
  autoBackupTimes: string[];
  localBackupEnabled?: boolean;
  localBackupPath?: string;
  localBackupScheduleTime?: string;
  localBackupFrequency?: 'on_sync';
  lastLocalBackupTime?: string;
  themePalette?: TenantThemePalette;
  appName?: string;
  appTagline?: string;
  appLogoUrl?: string;
}

export const getEffectiveBillAmount = (job: Partial<RepairJob>): number => {
  if (job.repairOutcome === 'Not Repaired') {
    return 0;
  }
  if (job.finalBillAmount !== undefined && job.finalBillAmount !== null) {
    return job.finalBillAmount;
  }
  return job.estimateAmount || 0;
};

export function sortJobsByLatest(jobsList: RepairJob[]): RepairJob[] {
  return [...jobsList].sort((a, b) => {
    const getEffectiveTime = (j: RepairJob): number => {
      if (j.updatedAt) {
        const t = new Date(j.updatedAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (j.createdAt) {
        const t = new Date(j.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (j.date) {
        const t = new Date(j.date).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      return 0;
    };

    const timeA = getEffectiveTime(a);
    const timeB = getEffectiveTime(b);

    if (timeA > 0 || timeB > 0) {
      if (timeA !== timeB) {
        return timeB - timeA;
      }
    }

    // Compare job ID numerical part descending
    const numA = parseInt(a.id.split('/').pop() || '0', 10);
    const numB = parseInt(b.id.split('/').pop() || '0', 10);
    if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
      return numB - numA;
    }
    return b.id.localeCompare(a.id);
  });
}

