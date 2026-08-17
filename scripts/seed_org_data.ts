import fs from 'fs';
import path from 'path';
import {
  INITIAL_CLIENTS,
  INITIAL_JOBS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_PRODUCTS,
  INITIAL_EXPENSES,
  INITIAL_LEDGER,
  INITIAL_CATEGORIES,
  INITIAL_RACKS,
  EQUIPMENT_TYPES,
  COMMON_PROBLEMS,
  INITIAL_ORG_USERS
} from '../src/data';
import { initDatabase, scanAndImportDataFolder } from '../server/sqliteDb';

async function main() {
  const orgDir = path.join(process.cwd(), 'data', 'orgs', 'org-nibban');
  if (!fs.existsSync(orgDir)) {
    fs.mkdirSync(orgDir, { recursive: true });
  }

  const payload = {
    tenantId: 'org-nibban',
    name: 'Nibban Technologies',
    code: 'NIBBAN-01',
    ownerName: 'Nibban Admin',
    ownerMobile: '+91 9876543210',
    clients: INITIAL_CLIENTS,
    jobs: INITIAL_JOBS,
    invoices: INITIAL_INVOICES,
    payments: INITIAL_PAYMENTS,
    products: INITIAL_PRODUCTS,
    expenses: INITIAL_EXPENSES,
    ledger: INITIAL_LEDGER,
    users: INITIAL_ORG_USERS,
    categories: INITIAL_CATEGORIES,
    racks: INITIAL_RACKS,
    equipments: EQUIPMENT_TYPES,
    problems: COMMON_PROBLEMS
  };

  fs.writeFileSync(path.join(orgDir, 'data.json'), JSON.stringify(payload, null, 2));
  console.log('✅ Generated data/orgs/org-nibban/data.json');

  await initDatabase();
  const res = await scanAndImportDataFolder(true);
  console.log('✅ Scanned and imported data:', res);
}

main().catch(console.error);
