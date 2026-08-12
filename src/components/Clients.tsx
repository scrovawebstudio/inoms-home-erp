/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  FileSpreadsheet,
  Download,
  Upload,
  X,
  CreditCard,
  UserCheck,
  Building,
  Receipt,
  ShieldCheck,
  CheckCircle2,
  Power,
  DollarSign,
  Calendar
} from 'lucide-react';
import { Client, ClientLedgerEntry, ClientType, RepairJob, Invoice, CompanyConfig, getEffectiveBillAmount } from '../types';
import { TenantOrg } from './AuthModal';
import AddClientModal from './AddClientModal';
import JobViewModal from './JobViewModal';
import InvoiceViewModal from './InvoiceViewModal';

interface ClientsProps {
  clients: Client[];
  ledger: ClientLedgerEntry[];
  jobs?: RepairJob[];
  invoices?: Invoice[];
  companyConfig?: CompanyConfig;
  tenants?: TenantOrg[];
  isAdmin?: boolean;
  isStaff?: boolean;
  onAddClient: (client: Omit<Client, 'id'>) => void;
  onEditClient: (client: Client) => void;
  onDeleteClient: (id: string) => void;
  onUpdateLedgerEntry?: (entry: ClientLedgerEntry) => void;
  onNavigateToBillingForOrg?: (orgName: string, orgMobile: string) => void;
  onToggleTenantStatus?: (tenantId: string) => void;
  onRegisterOrg?: (newTenant: TenantOrg) => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToInvoice?: (invoiceId: string) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi'
];

export default function Clients({
  clients,
  ledger,
  jobs = [],
  invoices = [],
  companyConfig = {
    name: 'Service ERP',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    bankName: '',
    bankAccountNo: '',
    upiId: '',
    upiQrUrl: '',
    signatureUrl: '',
    syncMode: 'offline',
    lanHostIp: '',
    driveConnected: false,
    autoBackupTimes: []
  },
  tenants = [],
  isAdmin = false,
  isStaff = false,
  onAddClient,
  onEditClient,
  onDeleteClient,
  onUpdateLedgerEntry,
  onNavigateToBillingForOrg,
  onToggleTenantStatus,
  onRegisterOrg,
  onNavigateToJob,
  onNavigateToInvoice
}: ClientsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedLedgerClient, setSelectedLedgerClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // In-page modal viewer states (prevents page navigation)
  const [viewingJob, setViewingJob] = useState<RepairJob | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Edit Ledger Balance state
  const [isEditingLedgerBalance, setIsEditingLedgerBalance] = useState(false);
  const [newLedgerBalance, setNewLedgerBalance] = useState<number>(0);

  // Edit individual ledger entry state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogDebit, setEditLogDebit] = useState<number>(0);
  const [editLogCredit, setEditLogCredit] = useState<number>(0);
  const [editLogRefNo, setEditLogRefNo] = useState<string>('');
  const [editLogType, setEditLogType] = useState<string>('');

  const [activeLedgerTab, setActiveLedgerTab] = useState<'jobs' | 'statement'>('jobs');
  const [ledgerFromDate, setLedgerFromDate] = useState('');
  const [ledgerToDate, setLedgerToDate] = useState('');

  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSampleCsv = () => {
    const headers = "Name,Mobile,Type,Email,State,Address,OpeningBalance\n";
    const row1 = "Apex Technologies,9876543210,Dealer,contact@apextech.com,Maharashtra,\"123 Business Park, Mumbai\",5000\n";
    const row2 = "Ramesh Kumar,9123456789,Walk-in,ramesh@gmail.com,Maharashtra,,\"Shop 4, Market Yard, Pune\",0\n";
    const blob = new Blob([headers + row1 + row2], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'client_bulk_upload_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBulkCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) {
          alert('CSV file is empty or missing data rows.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const mobileIdx = headers.findIndex(h => h.includes('mobile') || h.includes('phone'));
        const typeIdx = headers.findIndex(h => h.includes('type'));
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const stateIdx = headers.findIndex(h => h.includes('state'));
        const gstinIdx = headers.findIndex(h => h.includes('gst'));
        const addressIdx = headers.findIndex(h => h.includes('address'));
        const balIdx = headers.findIndex(h => h.includes('balance') || h.includes('opening'));

        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const rawRow = lines[i];
          const regex = /(?:,|\n|^)(?:"([^"]*)"|([^",\n]*))/g;
          const matches: string[] = [];
          let match;
          while ((match = regex.exec(rawRow)) !== null) {
            matches.push(match[1] !== undefined ? match[1] : match[2]);
          }

          const getVal = (idx: number) => (idx >= 0 && matches[idx] !== undefined ? matches[idx].trim() : '');

          const name = getVal(nameIdx);
          const mobile = getVal(mobileIdx);

          if (!name || !mobile) continue;

          const typeVal = getVal(typeIdx);
          const validTypes: ClientType[] = ['Walk-in', 'Dealer'];
          const type: ClientType = validTypes.includes(typeVal as ClientType) ? (typeVal as ClientType) : 'Walk-in';

          const email = getVal(emailIdx);
          const state = getVal(stateIdx) || 'Maharashtra';
          const address = getVal(addressIdx);
          const outstandingBalance = Number(getVal(balIdx)) || 0;

          onAddClient({
            name,
            mobile,
            type,
            email,
            state,
            address: address || '',
            outstandingBalance
          });

          importedCount++;
        }

        if (importedCount > 0) {
          alert(`✓ Successfully imported ${importedCount} clients from CSV spreadsheet!`);
        } else {
          alert('No valid client rows found. Please check CSV format (Name and Mobile columns are required).');
        }
      } catch (err) {
        alert('Failed to parse CSV file. Please make sure it is a valid CSV file.');
      }
      if (e.target) e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Filter clients based on search
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.mobile.includes(searchTerm) ||
    c.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter SaaS Tenant Organizations if Admin
  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.ownerMobile.includes(searchTerm)
  );

  const handleOpenAdd = () => {
    setEditingClient(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setShowAddModal(true);
  };

  const handleOpenLedger = (client: Client) => {
    setSelectedLedgerClient(client);
    setNewLedgerBalance(client.outstandingBalance || 0);
    setIsEditingLedgerBalance(false);
    setActiveLedgerTab('jobs');
    setLedgerFromDate('');
    setLedgerToDate('');
    setShowLedgerModal(true);
  };

  const handleSaveLedgerBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedgerClient) return;

    const updated: Client = {
      ...selectedLedgerClient,
      outstandingBalance: Number(newLedgerBalance) || 0
    };

    onEditClient(updated);
    setSelectedLedgerClient(updated);
    setIsEditingLedgerBalance(false);
  };

  // Get ledger logs for client filtered by date range
  const clientLedgerLogs = ledger.filter(l => {
    if (l.clientId !== selectedLedgerClient?.id) return false;
    if (ledgerFromDate) {
      const lDate = l.date ? l.date.substring(0, 10) : '';
      if (lDate && lDate < ledgerFromDate) return false;
    }
    if (ledgerToDate) {
      const lDate = l.date ? l.date.substring(0, 10) : '';
      if (lDate && lDate > ledgerToDate) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            {isAdmin ? (
              <>
                <Building className="w-5 h-5 text-teal-600" /> Client Organizations{' '}
                <span className="text-xs font-semibold bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full border border-teal-200">
                  {tenants.length} Organizations
                </span>
              </>
            ) : (
              <>
                Clients Ledger <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{clients.length} Total</span>
              </>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isAdmin
              ? 'Manage organization billing, subscription statuses, and generate software licensing invoices.'
              : 'Manage client accounts, view ledger statements, and track outstanding service balances.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <button
                onClick={() => {
                  if (onNavigateToBillingForOrg) {
                    onNavigateToBillingForOrg(tenants[0]?.name || 'Organization', tenants[0]?.ownerMobile || '');
                  }
                }}
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                Generate License Invoice
              </button>
            </>
          ) : (
            <>
              <input
                type="file"
                ref={csvFileInputRef}
                accept=".csv"
                onChange={handleBulkCsvUpload}
                className="hidden"
              />
              <button
                onClick={handleDownloadSampleCsv}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
                title="Download sample CSV template for bulk importing clients"
              >
                <Download className="w-4 h-4" />
                Download Sample
              </button>
              <button
                onClick={() => csvFileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
                title="Bulk import clients from CSV spreadsheet"
              >
                <Upload className="w-4 h-4" />
                Bulk Upload
              </button>
              <button
                onClick={handleOpenAdd}
                id="add-client-btn"
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Client
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Search Header */}
        <div className="p-4 border-b border-slate-50 bg-slate-50/40 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder={isAdmin ? "Search Client Org Name, Code, or Owner Mobile..." : "Search by Name, Mobile, Email, or State..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {isAdmin ? (
            /* ADMIN VIEW: CLIENT ORGANIZATIONS */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6 whitespace-nowrap">Invoicing & Control</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Organization Name</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Tenant Code</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Owner / Admin Name</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Mobile Contact</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Monthly Plan</th>
                  <th className="py-3.5 px-6 text-center whitespace-nowrap">Platform Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTenants.length > 0 ? (
                  filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (onNavigateToBillingForOrg) {
                                onNavigateToBillingForOrg(tenant.name, tenant.ownerMobile);
                              }
                            }}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Generate Subscription Invoice"
                          >
                            <Receipt className="w-3.5 h-3.5" /> Issue Invoice
                          </button>
                          {onToggleTenantStatus && tenant.id !== 'org-admin' && (
                            <button
                              onClick={() => onToggleTenantStatus(tenant.id)}
                              className={`p-1.5 rounded-lg font-bold transition cursor-pointer ${
                                tenant.status === 'active'
                                  ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                              title={tenant.status === 'active' ? 'Deactivate Access' : 'Activate Access'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-6 whitespace-nowrap font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-teal-600 shrink-0" />
                          <span>{tenant.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-6 whitespace-nowrap font-mono font-bold text-teal-700">
                        {tenant.code}
                      </td>

                      <td className="py-3 px-6 whitespace-nowrap text-slate-700 font-medium">
                        {tenant.ownerName || 'Organization Admin'}
                      </td>

                      <td className="py-3 px-6 whitespace-nowrap font-mono text-slate-600">
                        {tenant.ownerMobile}
                      </td>

                      <td className="py-3 px-6 whitespace-nowrap font-mono font-bold text-slate-800">
                        ₹2,999 / mo <span className="text-[10px] text-slate-400 font-normal">(Standard Plan)</span>
                      </td>

                      <td className="py-3 px-6 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                          tenant.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${tenant.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {tenant.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                      No subscriber organizations found matching search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* STORE CLIENTS VIEW */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6 whitespace-nowrap">Actions</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Type</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Client Name</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Mobile Number</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">Email Address</th>
                  <th className="py-3.5 px-6 whitespace-nowrap">State</th>
                  <th className="py-3.5 px-6 text-right whitespace-nowrap">Ledger Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/60 transition">
                      {/* Action buttons */}
                      <td className="py-3 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {!isStaff && (
                            <button
                              onClick={() => handleOpenEdit(client)}
                              title="Edit Client"
                              className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenLedger(client)}
                            title="View Ledger Statement"
                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                          {!isStaff && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${client.name}?`)) {
                                  onDeleteClient(client.id);
                                }
                              }}
                              title="Delete Client"
                              className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Client Type badge */}
                      <td className="py-3 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            client.type === 'Walk-in'
                              ? 'bg-slate-100 text-slate-600'
                              : client.type === 'Dealer'
                              ? 'bg-teal-50 text-teal-600'
                              : 'bg-amber-50 text-amber-600'
                          }`}
                        >
                          {client.type}
                        </span>
                      </td>

                      {/* Client Name */}
                      <td className="py-3 px-6 whitespace-nowrap font-semibold text-slate-800">
                        <button
                          type="button"
                          onClick={() => handleOpenLedger(client)}
                          className="font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer flex items-center gap-1.5 group"
                          title="Click to view Client Ledger & Repair Jobs History"
                        >
                          <span>{client.name}</span>
                        </button>
                      </td>

                      {/* Mobile Number */}
                      <td className="py-3 px-6 whitespace-nowrap font-mono text-slate-600">{client.mobile}</td>

                      {/* Email */}
                      <td className="py-3 px-6 whitespace-nowrap text-slate-500">{client.email || '—'}</td>

                      {/* State */}
                      <td className="py-3 px-6 whitespace-nowrap text-slate-600">{client.state}</td>

                      {/* Outstanding ledger balance */}
                      <td className="py-3 px-6 text-right whitespace-nowrap font-mono font-bold text-slate-800">
                        <span className={client.outstandingBalance < 0 ? 'text-emerald-600' : client.outstandingBalance > 0 ? 'text-rose-600' : 'text-slate-500'}>
                          {client.outstandingBalance < 0 ? 'CR ' : client.outstandingBalance > 0 ? 'DR ' : ''}
                          ₹{Math.abs(client.outstandingBalance).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-medium">
                      No clients found matching query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Client Modal */}
      <AddClientModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingClient(null);
        }}
        onAddClient={onAddClient}
        editingClient={editingClient}
        onEditClient={onEditClient}
      />

      {/* Client Ledger Statement Modal */}
      {showLedgerModal && selectedLedgerClient && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLedgerModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-4xl w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-slate-800 text-teal-300 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-fit mb-1">
                  Client ledger Account
                </span>
                <h2 className="text-xl font-bold tracking-tight">{selectedLedgerClient.name}</h2>
                <div className="flex gap-4 text-xs text-slate-400 mt-1 font-medium">
                  <span>Mobile: <strong className="font-mono text-slate-200">{selectedLedgerClient.mobile}</strong></span>
                  <span>Email: <strong className="text-slate-200">{selectedLedgerClient.email || 'N/A'}</strong></span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
                <span className={`text-2xl font-black font-mono block ${
                  selectedLedgerClient.outstandingBalance < 0 ? 'text-emerald-400' : selectedLedgerClient.outstandingBalance > 0 ? 'text-rose-400' : 'text-slate-300'
                }`}>
                  {selectedLedgerClient.outstandingBalance < 0 ? 'CR ' : selectedLedgerClient.outstandingBalance > 0 ? 'DR ' : ''}
                  ₹{Math.abs(selectedLedgerClient.outstandingBalance).toFixed(2)}
                </span>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setNewLedgerBalance(selectedLedgerClient.outstandingBalance || 0);
                      setIsEditingLedgerBalance(!isEditingLedgerBalance);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-300 hover:text-teal-200 bg-teal-900/60 hover:bg-teal-900 border border-teal-700/60 rounded-lg px-2.5 py-1 transition cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    {isEditingLedgerBalance ? 'Cancel Edit' : 'Edit Balance'}
                  </button>
                  <button
                    onClick={() => setShowLedgerModal(false)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-white border border-slate-700 rounded-lg px-2.5 py-1 hover:bg-slate-800 transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Close
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Edit Ledger Balance Banner */}
            {isEditingLedgerBalance && (
              <form onSubmit={handleSaveLedgerBalance} className="p-4 bg-teal-50 border-b border-teal-100 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                <div className="flex-1 w-full flex items-center gap-3">
                  <label className="text-xs font-bold text-teal-900 whitespace-nowrap">Updated Client Ledger Balance (₹):</label>
                  <input
                    type="number"
                    value={newLedgerBalance === 0 ? '' : newLedgerBalance}
                    onChange={(e) => setNewLedgerBalance(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full max-w-xs bg-white border border-teal-300 rounded-xl px-3.5 py-1.5 font-mono font-bold text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    placeholder="Enter correct amount (e.g. 1200)"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditingLedgerBalance(false)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition shadow-xs cursor-pointer"
                  >
                    Save Ledger Balance
                  </button>
                </div>
              </form>
            )}

            {/* Sub Navigation Tabs */}
            {(() => {
              const clientJobs = (jobs || []).filter(j => {
                if (j.clientId !== selectedLedgerClient.id) return false;
                const jobDateStr = j.date || j.createdAt || '';
                if (ledgerFromDate) {
                  const jDate = jobDateStr ? jobDateStr.substring(0, 10) : '';
                  if (jDate && jDate < ledgerFromDate) return false;
                }
                if (ledgerToDate) {
                  const jDate = jobDateStr ? jobDateStr.substring(0, 10) : '';
                  if (jDate && jDate > ledgerToDate) return false;
                }
                return true;
              });
              return (
                <div>
                  <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveLedgerTab('jobs')}
                      className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer flex items-center gap-2 border-b-2 ${
                        activeLedgerTab === 'jobs'
                          ? 'bg-white text-teal-700 border-teal-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
                      }`}
                    >
                      <span>🛠️ Job Cards & Repair History</span>
                      <span className="px-1.5 py-0.2 text-[10px] bg-teal-100 text-teal-800 rounded-full font-bold">
                        {clientJobs.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLedgerTab('statement')}
                      className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer flex items-center gap-2 border-b-2 ${
                        activeLedgerTab === 'statement'
                          ? 'bg-white text-teal-700 border-teal-600 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/50'
                      }`}
                    >
                      <span>📑 Financial Ledger Statements</span>
                      <span className="px-1.5 py-0.2 text-[10px] bg-slate-200 text-slate-700 rounded-full font-bold">
                        {clientLedgerLogs.length}
                      </span>
                    </button>
                  </div>

                  {/* Date Range Sorting Bar for Statements & Job History */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-50/80 border-b border-slate-200">
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <span>Filter Statement by Date Range:</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
                        <input
                          type="date"
                          value={ledgerFromDate}
                          onChange={(e) => setLedgerFromDate(e.target.value)}
                          className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
                        <input
                          type="date"
                          value={ledgerToDate}
                          onChange={(e) => setLedgerToDate(e.target.value)}
                          className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
                        />
                      </div>

                      {(ledgerFromDate || ledgerToDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerFromDate('');
                            setLedgerToDate('');
                          }}
                          className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                          title="Clear date range filter"
                        >
                          <X className="w-3.5 h-3.5 text-slate-600" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Summary Calculation Bar */}
                  {(() => {
                    const clientJobsList = jobs.filter(j => j.clientId === selectedLedgerClient.id);
                    const totalAdvanceTaken = clientJobsList.reduce((sum, j) => sum + (j.advanceAmount || 0), 0);
                    const totalFinalBill = clientJobsList.reduce((sum, j) => sum + getEffectiveBillAmount(j), 0);
                    const totalPaymentsReceived = (ledger || []).filter(p => p.clientId === selectedLedgerClient.id).reduce((sum, p) => sum + (p.credit || 0), 0);
                    const netBalance = (selectedLedgerClient.outstandingBalance !== undefined)
                      ? selectedLedgerClient.outstandingBalance
                      : Math.max(0, totalFinalBill - totalAdvanceTaken - totalPaymentsReceived);

                    return (
                      <div className="mx-6 mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Advance Paid</span>
                          <span className="text-base font-black text-teal-400 font-mono">₹{totalAdvanceTaken.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Final Bill</span>
                          <span className="text-base font-black text-blue-400 font-mono">₹{totalFinalBill.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Payments Received</span>
                          <span className="text-base font-black text-emerald-400 font-mono">₹{totalPaymentsReceived.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                          <span className="text-[10px] uppercase font-extrabold text-amber-300 block tracking-wider">Outstanding Balance</span>
                          <span className="text-base font-black text-amber-400 font-mono">₹{netBalance.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tab 1: Job Cards & Device History */}
                  {activeLedgerTab === 'jobs' && (
                    <div className="p-6">
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="py-3 px-4 whitespace-nowrap">Job ID</th>
                              <th className="py-3 px-4 whitespace-nowrap">Product / Equipment</th>
                              <th className="py-3 px-4 whitespace-nowrap">Serial & Specs</th>
                              <th className="py-3 px-4 whitespace-nowrap">Status</th>
                              <th className="py-3 px-4 whitespace-nowrap">Payment</th>
                              <th className="py-3 px-4 whitespace-nowrap">Advance Taken</th>
                              <th className="py-3 px-4 text-right whitespace-nowrap">Final Bill (₹)</th>
                              <th className="py-3 px-4 whitespace-nowrap">Delivery Info</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {clientJobs.length > 0 ? (
                              clientJobs.map((job, cjIdx) => {
                                const existingInv = (invoices || []).find(inv => inv.linkedJobId === job.id);
                                return (
                                    <tr key={`cj-${job.id}-${cjIdx}`} className="hover:bg-slate-50/70 transition">
                                      <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                                        <button
                                          type="button"
                                          onClick={() => setViewingJob(job)}
                                          title="Click to view full Job Card details"
                                          className="text-teal-600 hover:text-teal-800 hover:underline cursor-pointer flex items-center gap-1 font-mono font-bold"
                                        >
                                          #{job.id}
                                        </button>
                                      </td>
                                      <td className="py-3 px-4 font-semibold text-slate-800 min-w-[140px]">
                                        <div>{job.productName || 'Device'}</div>
                                        <div className="text-[10px] text-slate-500 font-normal">{job.productModel || job.equipment}</div>
                                      </td>
                                      <td className="py-3 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                                        <div className="font-mono text-slate-700">SN: {job.serialNo || '—'}</div>
                                        <div className="text-[10px] text-slate-500">RAM/HDD: {job.ramHdd || '—'}</div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                          {job.status || 'Received'}
                                        </span>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                          <span
                                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black w-fit ${
                                              job.paymentStatus === 'Unpaid'
                                                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            }`}
                                          >
                                            {job.paymentStatus === 'Unpaid' ? '✕ UNPAID' : '✓ PAID'}
                                          </span>
                                          {existingInv && (
                                            <button
                                              type="button"
                                              onClick={() => setViewingInvoice(existingInv)}
                                              title="Click to view Tax Invoice"
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-mono text-[10px] font-bold cursor-pointer w-fit"
                                            >
                                              <Receipt className="w-3 h-3 text-purple-600" />
                                              #{existingInv.id}
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                                        {job.advanceAmount && job.advanceAmount > 0 ? (
                                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono font-bold">
                                            ₹{job.advanceAmount} {job.advancePaymentMode ? `(${job.advancePaymentMode})` : ''}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 italic">No Advance</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 text-sm whitespace-nowrap">
                                        ₹{(job.finalBillAmount !== undefined && job.finalBillAmount > 0 ? job.finalBillAmount : (job.estimateAmount || 0)).toLocaleString('en-IN')}
                                      </td>
                                      <td className="py-3 px-4 text-xs font-medium text-slate-600 min-w-[150px]">
                                        <div className="font-bold text-slate-700">{job.deliveryType || 'Handover / Counter'}</div>
                                        {job.courierName && (
                                          <div className="text-[10px] text-teal-700 font-mono">
                                            {job.courierName} {job.trackingNo ? `(TRK: ${job.trackingNo})` : ''}
                                          </div>
                                        )}
                                        {(job.deliveredToName || job.deliveredBy) && (
                                          <div className="text-[10px] text-slate-500">
                                            {job.deliveredToName ? `To: ${job.deliveredToName}` : ''} {job.deliveredBy ? `| By: ${job.deliveredBy}` : ''}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                            ) : (
                              <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                                  No repair job cards logged for this client yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Financial Ledger Statements */}
                  {activeLedgerTab === 'statement' && (
                    <div className="p-6">
                      <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="py-3 px-4">Date</th>
                              <th className="py-3 px-4">Transaction Type</th>
                              <th className="py-3 px-4">Reference No</th>
                              <th className="py-3 px-4 text-right">Debit (DR)</th>
                              <th className="py-3 px-4 text-right">Credit (CR)</th>
                              <th className="py-3 px-4 text-right">Running Balance</th>
                              <th className="py-3 px-4 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {clientLedgerLogs.length > 0 ? (
                              clientLedgerLogs.map((log, logIdx) => {
                                const isEditingThisRow = editingLogId === log.id;
                                return (
                                  <tr key={`log-${log.id || logIdx}-${logIdx}`} className="hover:bg-slate-50 transition">
                                    <td className="py-3 px-4 text-slate-500 font-mono">{log.date}</td>
                                    <td className="py-3 px-4 font-semibold text-slate-700">
                                      {isEditingThisRow ? (
                                        <input
                                          type="text"
                                          value={editLogType}
                                          onChange={(e) => setEditLogType(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs"
                                        />
                                      ) : (
                                        log.type
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-slate-600 italic">
                                      {isEditingThisRow ? (
                                        <input
                                          type="text"
                                          value={editLogRefNo}
                                          onChange={(e) => setEditLogRefNo(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-md px-2 py-1 text-xs"
                                        />
                                      ) : (
                                        (() => {
                                          const ref = log.refNo || '';
                                          // Check if matched to invoice
                                          const invMatch = (invoices || []).find(i => i.id === ref || ref.includes(i.id) || (ref.includes('BILL') && ref.includes(i.id.split('/').pop() || '')));
                                          // Check if matched to job
                                          const jobMatch = (jobs || []).find(j => j.id === ref || ref.includes(j.id) || (j.id.split('/').pop() && ref.includes(j.id.split('/').pop() || '')));

                                          if (invMatch) {
                                            return (
                                              <button
                                                type="button"
                                                onClick={() => setViewingInvoice(invMatch)}
                                                title="Click to open Tax Invoice"
                                                className="inline-flex items-center gap-1 font-mono font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded cursor-pointer text-[11px]"
                                              >
                                                <Receipt className="w-3 h-3 text-purple-600" />
                                                {ref}
                                              </button>
                                            );
                                          }

                                          if (jobMatch) {
                                            return (
                                              <button
                                                type="button"
                                                onClick={() => setViewingJob(jobMatch)}
                                                title="Click to open Job Card"
                                                className="inline-flex items-center gap-1 font-mono font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded cursor-pointer text-[11px]"
                                              >
                                                #{ref}
                                              </button>
                                            );
                                          }

                                          return <span>{ref || '—'}</span>;
                                        })()
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-rose-600 font-medium">
                                      {isEditingThisRow ? (
                                        <input
                                          type="number"
                                          value={editLogDebit}
                                          onChange={(e) => setEditLogDebit(Number(e.target.value))}
                                          className="w-24 text-right bg-white border border-rose-300 rounded-md px-2 py-1 text-xs font-bold font-mono"
                                          placeholder="0"
                                        />
                                      ) : (
                                        log.debit > 0 ? `₹${log.debit.toFixed(2)}` : '—'
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono text-emerald-600 font-medium">
                                      {isEditingThisRow ? (
                                        <input
                                          type="number"
                                          value={editLogCredit}
                                          onChange={(e) => setEditLogCredit(Number(e.target.value))}
                                          className="w-24 text-right bg-white border border-emerald-300 rounded-md px-2 py-1 text-xs font-bold font-mono"
                                          placeholder="0"
                                        />
                                      ) : (
                                        log.credit > 0 ? `₹${log.credit.toFixed(2)}` : '—'
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                                      ₹{log.balance.toFixed(2)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {isEditingThisRow ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (onUpdateLedgerEntry) {
                                                onUpdateLedgerEntry({
                                                  ...log,
                                                  debit: editLogDebit,
                                                  credit: editLogCredit,
                                                  refNo: editLogRefNo,
                                                  type: editLogType
                                                });
                                              }
                                              setEditingLogId(null);
                                            }}
                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-md cursor-pointer"
                                          >
                                            Save
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingLogId(null)}
                                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-semibold rounded-md cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingLogId(log.id);
                                            setEditLogDebit(log.debit || 0);
                                            setEditLogCredit(log.credit || 0);
                                            setEditLogRefNo(log.refNo || '');
                                            setEditLogType(log.type || '');
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-200 rounded-md text-[10px] font-semibold transition cursor-pointer"
                                          title="Edit entry amount"
                                        >
                                          <Edit2 className="w-2.5 h-2.5" /> Edit
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={7} className="text-center py-6 text-slate-400 italic">
                                  No transactions found on ledger account.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* In-page Job Card Viewer Modal */}
      {viewingJob && (
        <JobViewModal
          job={viewingJob}
          companyConfig={companyConfig}
          onClose={() => setViewingJob(null)}
        />
      )}

      {/* In-page Invoice Viewer Modal */}
      {viewingInvoice && (
        <InvoiceViewModal
          invoice={viewingInvoice}
          companyConfig={companyConfig}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div>
  );
}
