/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Client,
  ClientLedgerEntry,
  RepairJob,
  Payment,
  Invoice,
  Product,
  Expense,
  SystemUser,
  ActivityLog,
  Equipment,
  Problem,
  Category,
  LocationRack
} from './types';

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'c1',
    tenantId: 'org-nibban',
    name: 'test',
    type: 'Walk-in',
    mobile: '3698523690',
    email: 'test@email.com',
    address: 'Near Gandhi Chowk',
    state: 'Bihar',
    outstandingBalance: 0
  },
  {
    id: 'c2',
    tenantId: 'org-nibban',
    name: 'gfgfgfg',
    type: 'Dealer',
    mobile: '8383838383',
    email: 'dealer@gfg.com',
    address: 'Commercial Hub, Lane 4',
    state: 'Assam',
    outstandingBalance: -700
  },
  {
    id: 'c3',
    tenantId: 'org-nibban',
    name: 'fdfdfdf',
    type: 'Dealer',
    mobile: '3443414343',
    email: 'jdhdjfkjhfjk@gmj.com',
    address: 'sdsdshdsdsds',
    state: 'Chhattisgarh',
    outstandingBalance: 1274.10
  },
  {
    id: 'c4',
    tenantId: 'org-nibban',
    name: 'Ashun Dada',
    type: 'Walk-in',
    mobile: '9090909090',
    email: 'ashun@dada.com',
    address: 'Local Street, MG Road',
    state: 'Odisha',
    outstandingBalance: 7948.20
  }
];

export const INITIAL_LEDGER: ClientLedgerEntry[] = [
  {
    id: 'l1',
    tenantId: 'org-nibban',
    clientId: 'c2',
    date: '2026-06-22',
    type: 'Payment (Advance)',
    refNo: 'UPI (₹500.0), Cash (₹200.0)',
    debit: 0,
    credit: 700,
    balance: -700
  },
  {
    id: 'l2',
    tenantId: 'org-nibban',
    clientId: 'c3',
    date: '2026-06-18',
    type: 'Invoice Gen',
    refNo: 'INV-2026-4',
    debit: 1274.10,
    credit: 0,
    balance: 1274.10
  },
  {
    id: 'l3',
    tenantId: 'org-nibban',
    clientId: 'c4',
    date: '2026-06-16',
    type: 'Invoice Gen',
    refNo: 'NTS/2026/BILL/456',
    debit: 2300,
    credit: 0,
    balance: 2300
  },
  {
    id: 'l4',
    tenantId: 'org-nibban',
    clientId: 'c4',
    date: '2026-06-16',
    type: 'Payment Received',
    refNo: 'UPI1',
    debit: 0,
    credit: 1200,
    balance: 1100
  },
  {
    id: 'l5',
    tenantId: 'org-nibban',
    clientId: 'c4',
    date: '2026-06-18',
    type: 'Invoice Gen',
    refNo: 'INV-2026-5',
    debit: 900,
    credit: 0,
    balance: 2000
  },
  {
    id: 'l6',
    tenantId: 'org-nibban',
    clientId: 'c4',
    date: '2026-06-22',
    type: 'Payment Received',
    refNo: 'Bank Transfer',
    debit: 0,
    credit: 2300,
    balance: -300
  },
  {
    id: 'l7',
    tenantId: 'org-nibban',
    clientId: 'c4',
    date: '2026-06-24',
    type: 'Invoice Gen',
    refNo: 'NTS/2026/BILL/458',
    debit: 3304,
    credit: 0,
    balance: 3004
  }
];

export const INITIAL_JOBS: RepairJob[] = [
  {
    id: 'NTS/2026/101',
    tenantId: 'org-nibban',
    clientId: 'c3',
    clientName: 'fdfdfdf',
    clientMobile: '3443414343',
    date: '2026-06-22',
    equipment: 'MOTHERBOARD',
    productName: 'ddfdfdfd',
    productModel: 'ddfdfdf | dffd',
    serialNo: 'ddfdfdf',
    problems: ['NO POWER ON'],
    problemDescription: 'fafdaf',
    componentsChecklist: {
      Harddisk: true,
      RAM: false,
      Adapter: false,
      Battery: false,
      Keyboard: false,
      Mouse: false,
      Bag: false,
      Pendrive: false,
      'External Drive': false,
      'Data Cable': false,
      Cover: false
    },
    additionalDetails: 'Client mentioned it shut down abruptly',
    images: [],
    estimateAmount: 4000,
    remarks: 'IC replacement needed',
    assignedTechnician: 'Jackie A',
    status: 'Received'
  },
  {
    id: 'NTS/2026/100',
    tenantId: 'org-nibban',
    clientId: 'c4',
    clientName: 'Ashun Dada',
    clientMobile: '9090909090',
    date: '2026-06-16',
    equipment: 'LAPTOP',
    productName: 'DELL INSPIRON 2520',
    productModel: 'DXUHDHJKDHD',
    serialNo: 'HDJHDJKHDJKHDJK',
    problems: ['HINGE BROKEN'],
    problemDescription: 'Left hinge broken from body, screws missing.',
    componentsChecklist: {
      Harddisk: true,
      RAM: true,
      Adapter: true,
      Battery: true,
      Keyboard: false,
      Mouse: false,
      Bag: true,
      Pendrive: false,
      'External Drive': false,
      'Data Cable': false,
      Cover: false
    },
    additionalDetails: 'Includes charger and laptop bag',
    images: [],
    estimateAmount: 2300,
    remarks: 'Hinge repair + body fabrication',
    assignedTechnician: 'Jackie A',
    status: 'Outwarded',
    outwardedDate: '2026-06-22',
    finalBillAmount: 2300,
    actionTaken: 'Hinges repaired, reinforced with synthetic resin.',
    deliveryStatus: 'Completed',
    isReturnCase: false
  }
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'p1',
    tenantId: 'org-nibban',
    date: '2026-06-26',
    clientId: 'c3',
    clientName: 'fdfdfdf',
    amount: 2200,
    mode: 'UPI',
    refNo: 'UPI12002302302',
    remarks: 'Advance'
  },
  {
    id: 'p2',
    tenantId: 'org-nibban',
    date: '2026-06-22',
    clientId: 'c2',
    clientName: 'gfgfgfg',
    amount: 700,
    mode: 'UPI',
    refNo: 'UPI9203923920',
    remarks: 'Bill settlement'
  },
  {
    id: 'p3',
    tenantId: 'org-nibban',
    date: '2026-06-22',
    clientId: 'c4',
    clientName: 'Ashun Dada',
    amount: 2300,
    mode: 'Bank Transfer',
    refNo: 'TXN98329382',
    remarks: 'Hinge Job Settlement'
  },
  {
    id: 'p4',
    tenantId: 'org-nibban',
    date: '2026-06-16',
    clientId: 'c4',
    clientName: 'Ashun Dada',
    amount: 1300,
    mode: 'UPI',
    refNo: 'UPI320392039',
    remarks: 'Inward token'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'NTS/2026/BILL/457',
    tenantId: 'org-nibban',
    date: '2026-06-22',
    clientId: 'c3',
    clientName: 'fdfdfdf',
    clientMobile: '3443414343',
    linkedJobId: 'NTS/2026/101',
    items: [
      {
        id: 'item1',
        productName: 'Repair / Service Charge - DESKTOP',
        serialNo: 'NTS/2026/100',
        qty: 1,
        rate: 4000,
        total: 4000
      },
      {
        id: 'item2',
        productName: 'DELL KEYBOARD',
        serialNo: 'DK-2032',
        qty: 1,
        rate: 2000,
        total: 2000
      }
    ],
    subtotal: 6000,
    discount: 1800,
    taxPercent: 18,
    taxAmount: 0, // In standard composable forms, GST is computed or included
    deliveryCharges: 0,
    grandTotal: 4200,
    paidAmount: 4200,
    balanceAmount: 0,
    paymentMode: 'UPI'
  },
  {
    id: 'INV-2026-4',
    tenantId: 'org-admin',
    date: '2026-06-18',
    clientId: 'c3',
    clientName: 'fdfdfdf',
    clientMobile: '3443414343',
    items: [
      {
        id: 'item1',
        productName: 'Mouse Premium Logic',
        serialNo: 'MS-202',
        qty: 1,
        rate: 1080,
        total: 1080
      }
    ],
    subtotal: 1080,
    discount: 0,
    taxPercent: 18,
    taxAmount: 194.10,
    deliveryCharges: 0,
    grandTotal: 1274.10,
    paidAmount: 0,
    balanceAmount: 1274.10,
    paymentMode: 'Credit'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod1',
    tenantId: 'org-nibban',
    name: 'DELL KEYBOARD',
    category: 'KEYBOARD',
    location: 'Rack 1',
    hsnCode: '84716040',
    price: 500,
    stock: 7,
    minQtyAlert: 2,
    description: 'Dell KB216 Wired USB Keyboard'
  },
  {
    id: 'prod2',
    tenantId: 'org-nibban',
    name: 'NMFNM <Nfm',
    category: 'ADAPTER',
    location: 'Rack 2',
    hsnCode: '85044090',
    price: 1200,
    stock: 6,
    minQtyAlert: 1,
    description: 'Universal Power Adapter'
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp1',
    tenantId: 'org-nibban',
    date: '2026-06-16',
    category: 'BEER',
    amount: 50,
    remarks: 'Relaxing after busy day'
  },
  {
    id: 'exp2',
    tenantId: 'org-nibban',
    date: '2026-06-18',
    category: 'STAFF PAYMENT',
    amount: 2000,
    remarks: 'Advance paid to Jackie'
  }
];

export const MASTER_ADMIN_USER: SystemUser = {
  id: 'u1',
  tenantId: 'org-admin',
  name: "Master System Admin",
  mobile: '8149862034',
  email: 'admin@mastersystem.com',
  username: 'scrova',
  password: '1234',
  pin: '1234',
  role: 'Admin',
  permissions: {
    dashboard: true,
    operations: true,
    accounts: true,
    setup: true,
    reports: true
  }
};

export const INITIAL_ORG_USERS: SystemUser[] = [
  {
    id: 'u-inoms-admin',
    tenantId: 'org-admin',
    name: 'INOMS Admin',
    mobile: '9876543210',
    email: 'admin@inoms.com',
    username: 'inoms',
    password: '1234',
    pin: '1234',
    role: 'Admin',
    permissions: {
      dashboard: true,
      operations: true,
      accounts: true,
      setup: true,
      reports: true
    }
  },
  {
    id: 'u2',
    tenantId: 'org-admin',
    name: 'Jackie A',
    mobile: '9188160629',
    email: 'test@gmail.com',
    username: 'jackie',
    password: '1234',
    pin: '1234',
    role: 'Technician',
    permissions: {
      dashboard: true,
      operations: true,
      accounts: false,
      setup: false,
      reports: false
    }
  }
];

export const INITIAL_USERS: SystemUser[] = [
  MASTER_ADMIN_USER,
  ...INITIAL_ORG_USERS
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'log1',
    timestamp: '24/06/2026 01:34',
    user: 'inoms',
    action: 'TAKE_BACKUP',
    details: 'Manual Google Drive backup taken'
  },
  {
    id: 'log2',
    timestamp: '24/06/2026 00:36',
    user: 'inoms',
    action: 'LOGIN',
    details: 'User logged in: inoms (Admin)'
  },
  {
    id: 'log3',
    timestamp: '23/06/2026 21:55',
    user: 'inoms',
    action: 'ASSIGN_TECH',
    details: 'Assigned job INOMS/2026/102 to technician Jackie A'
  },
  {
    id: 'log4',
    timestamp: '21/06/2026 14:54',
    user: 'inoms',
    action: 'LOGIN',
    details: 'User logged in: inoms (Admin)'
  },
  {
    id: 'log5',
    timestamp: '21/06/2026 13:26',
    user: 'inoms',
    action: 'DELETE_BACKUP',
    details: 'Deleted Google Drive backup: inoms_service_backup.db'
  }
];

export const EQUIPMENT_TYPES: Equipment[] = [
  { id: 'eq1', name: 'DESKTOP' },
  { id: 'eq2', name: 'LAPTOP' },
  { id: 'eq3', name: 'MOTHERBOARD' },
  { id: 'eq4', name: 'PRINTER' }
];

export const COMMON_PROBLEMS: Problem[] = [
  { id: 'pb1', name: 'HINGE BROKEN' },
  { id: 'pb2', name: 'NO DISPLAY' },
  { id: 'pb3', name: 'NO POWER ON' }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat1', name: 'ADAPTER' },
  { id: 'cat2', name: 'BATTERY' },
  { id: 'cat3', name: 'KEYBOARD' },
  { id: 'cat4', name: 'MOTHERBOARD' },
  { id: 'cat5', name: 'SCREEN' }
];

export const INITIAL_RACKS: LocationRack[] = [
  { id: 'r1', name: 'Rack 1' },
  { id: 'r2', name: 'Rack 2' },
  { id: 'r3', name: 'Rack 3' }
];

export const SHOP_TERMS = [
  'Subject to Cuttack jurisdiction only.',
  'Goods once sold cannot be returned back.',
  'Repair warranties are valid for 30 days from invoice date.',
  'Device unclaimed for more than 90 days will be disposed of.'
];
