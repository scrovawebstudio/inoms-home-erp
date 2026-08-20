/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Printer,
  X,
  CreditCard,
  UserCheck,
  Calendar,
  DollarSign,
  Receipt,
  FileCheck,
  Edit,
  Trash2,
  Wrench
} from 'lucide-react';
import { Payment, Client, CompanyConfig, SystemUser, Invoice, RepairJob, getEffectiveBillAmount } from '../types';
import JobViewModal from './JobViewModal';
import InvoiceViewModal from './InvoiceViewModal';

interface PaymentsProps {
  payments: Payment[];
  clients: Client[];
  invoices?: Invoice[];
  jobs?: RepairJob[];
  companyConfig: CompanyConfig;
  userRole?: string;
  currentUser?: SystemUser | null;
  onAddPayment: (payment: Omit<Payment, 'id'>) => void;
  onUpdatePayment?: (payment: Payment) => void;
  onDeletePayment?: (paymentId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
  onNavigateToInvoice?: (invoiceId: string) => void;
}

export default function Payments({
  payments,
  clients,
  invoices = [],
  jobs = [],
  companyConfig,
  userRole,
  currentUser,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onNavigateToJob,
  onNavigateToInvoice
}: PaymentsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);
  const [viewingJob, setViewingJob] = useState<RepairJob | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Edit Payment State for Organization Owner
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editMode, setEditMode] = useState<string>('UPI');
  const [editRefNo, setEditRefNo] = useState<string>('');
  const [editRemarks, setEditRemarks] = useState<string>('');

  const isOrgOwner = userRole === 'Admin' || currentUser?.role === 'Admin' || (!userRole && !currentUser);

  // Form states for Add Payment
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [mode, setMode] = useState('UPI');
  const [refNo, setRefNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [linkedRef, setLinkedRef] = useState('');

  // Filter payments by search term and selected date range
  const filteredPayments = [...payments].sort((first, second) => {
    const firstTime = new Date(first.date || 0).getTime();
    const secondTime = new Date(second.date || 0).getTime();
    return secondTime - firstTime || second.id.localeCompare(first.id);
  }).filter(p => {
    const matchesSearch =
      p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.refNo && p.refNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.mode.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (fromDate) {
      const pDate = p.date ? p.date.substring(0, 10) : '';
      if (pDate && pDate < fromDate) return false;
    }
    if (toDate) {
      const pDate = p.date ? p.date.substring(0, 10) : '';
      if (pDate && pDate > toDate) return false;
    }

    return true;
  });

  const handleOpenAdd = () => {
    setClientId(clients[0]?.id || '');
    setAmount(0);
    setMode('UPI');
    setRefNo('');
    setRemarks('');
    setLinkedRef('');
    setShowAddPayment(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Amount must be greater than zero.');
      return;
    }
    const clientObj = clients.find(c => c.id === clientId);

    let linkedJobId: string | undefined = undefined;
    let invoiceId: string | undefined = undefined;
    if (linkedRef.startsWith('job:')) {
      linkedJobId = linkedRef.replace('job:', '');
    } else if (linkedRef.startsWith('inv:')) {
      invoiceId = linkedRef.replace('inv:', '');
    }

    onAddPayment({
      date: new Date().toISOString().split('T')[0],
      clientId,
      clientName: clientObj?.name || 'Unknown',
      amount,
      mode,
      refNo: refNo || (linkedJobId ? `JOB-${linkedJobId}` : (invoiceId ? `INV-${invoiceId}` : undefined)),
      remarks: remarks || undefined,
      linkedJobId,
      invoiceId
    });
    setShowAddPayment(false);
  };

  const handleOpenEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setEditAmount(payment.amount);
    setEditMode(payment.mode);
    setEditRefNo(payment.refNo || '');
    setEditRemarks(payment.remarks || '');
  };

  const handleSaveEditPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    if (editAmount <= 0) {
      alert('Payment amount must be greater than zero.');
      return;
    }

    const updated: Payment = {
      ...editingPayment,
      amount: editAmount,
      mode: editMode,
      refNo: editRefNo || undefined,
      remarks: editRemarks || undefined
    };

    if (onUpdatePayment) {
      onUpdatePayment(updated);
    }
    setEditingPayment(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Payments Received <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">₹{payments.reduce((s, p) => s + p.amount, 0).toLocaleString('en-IN')} Total Credits</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track advance receipts, cash balances, and issue direct payment slips.</p>
        </div>
        <div>
          <button
            onClick={handleOpenAdd}
            id="record-payment-btn"
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Payment Record
          </button>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Client Name, Payment Mode, Ref number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Date Range Sorting Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
              />
            </div>

            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                title="Reset Date Range Filter"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-6">Action</th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6">Client Name</th>
                <th className="py-3.5 px-6">Mode</th>
                <th className="py-3.5 px-6">Ref/TXN Number</th>
                <th className="py-3.5 px-6">Linked Job / Invoice</th>
                <th className="py-3.5 px-6 text-right">Amount Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p, pIdx) => {
                  // Determine linked invoice & job
                  const matchedInv = (invoices || []).find(inv => 
                    inv.id === p.invoiceId || 
                    inv.id === p.refNo || 
                    p.refNo?.includes(inv.id) ||
                    (p.linkedJobId && inv.linkedJobId === p.linkedJobId)
                  );
                  const matchedJob = (jobs || []).find(j => 
                    j.id === p.linkedJobId || 
                    j.id === p.refNo || 
                    p.refNo?.includes(j.id) ||
                    (p.invoiceId && invoices?.find(inv => inv.id === p.invoiceId)?.linkedJobId === j.id)
                  );

                  return (
                    <tr key={p.id ? `${p.id}-${pIdx}` : `p-${pIdx}`} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-6 flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedReceipt(p)}
                          title="View Payment Receipt"
                          className="p-1.5 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditPayment(p)}
                          title="Edit Payment Receipt"
                          className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {onDeletePayment && (
                          <button
                            onClick={() => setDeletingPayment(p)}
                            title="Delete Payment Receipt"
                            className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-6 font-mono text-slate-500">{p.date}</td>
                      <td className="py-3 px-6 font-semibold text-slate-800">{p.clientName}</td>
                      <td className="py-3 px-6">
                        <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[10px]">
                          {p.mode}
                        </span>
                      </td>
                      <td className="py-3 px-6 font-mono text-slate-500">{p.refNo || '—'}</td>
                      <td className="py-3 px-6">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {matchedJob && (
                            <button
                              type="button"
                              onClick={() => setViewingJob(matchedJob)}
                              title="Click to view linked Repair Job Card"
                              className="inline-flex items-center gap-1 font-mono font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded cursor-pointer text-[10px]"
                            >
                              <Wrench className="w-3 h-3 text-teal-600" />
                              #{matchedJob.id}
                            </button>
                          )}
                          {matchedInv && (
                            <button
                              type="button"
                              onClick={() => setViewingInvoice(matchedInv)}
                              title="Click to view linked Tax Invoice"
                              className="inline-flex items-center gap-1 font-mono font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded cursor-pointer text-[10px]"
                            >
                              <Receipt className="w-3 h-3 text-purple-600" />
                              #{matchedInv.id}
                            </button>
                          )}
                          {!matchedJob && !matchedInv && (
                            <span className="text-slate-400 italic text-[11px]">General Ledger</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-slate-800">
                        ₹{p.amount.toLocaleString('en-IN')}.00
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 italic">
                    No payment credits found matching search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddPayment(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xs font-bold text-slate-800">Record Credit Payment</h2>
              <button onClick={() => setShowAddPayment(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Select Client *</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-800"
                  >
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.mobile})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Amount Received (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={amount === 0 ? '' : amount}
                    onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-sm font-bold text-teal-600 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Payment Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700"
                  >
                    <option value="UPI">UPI / QR Scan</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card Swipe</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Transaction / Ref No</label>
                  <input
                    type="text"
                    placeholder="Reference / UPI ID / Bank TXN"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Link to Job Card / Tax Invoice (Optional)</label>
                <select
                  value={linkedRef}
                  onChange={(e) => setLinkedRef(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700"
                >
                  <option value="">General Client Payment (Unlinked)</option>
                  {(jobs || []).filter(j => j.clientId === clientId).map(j => (
                    <option key={`job:${j.id}`} value={`job:${j.id}`}>
                      🛠️ Job Card #{j.id} - {j.productName || j.equipment} (₹{getEffectiveBillAmount(j)})
                    </option>
                  ))}
                  {(invoices || []).filter(inv => inv.clientId === clientId).map(inv => (
                    <option key={`inv:${inv.id}`} value={`inv:${inv.id}`}>
                      📄 Tax Invoice #{inv.id} (₹{inv.grandTotal})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="Advance / Partial billing clear"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPayment(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition cursor-pointer text-xs"
                >
                  Credit Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Record Modal (Organization Owner Only) */}
      {editingPayment && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPayment(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold tracking-tight">Edit Payment Record</h2>
                <p className="text-xs text-slate-400">Client: {editingPayment.clientName} (Owner Access)</p>
              </div>
              <button onClick={() => setEditingPayment(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayment} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Payment Amount Received (₹)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                  className="w-full border-2 border-teal-500 rounded-xl px-3.5 py-2.5 font-mono font-bold text-sm bg-teal-50/20 text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Payment Mode</label>
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5"
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cash">Cash Credit</option>
                  <option value="NEFT/RTGS">NEFT / RTGS / IMPS</option>
                  <option value="Cheque">Bank Cheque</option>
                  <option value="Card">Credit / Debit Card</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Transaction / Ref Number</label>
                <input
                  type="text"
                  placeholder="TXN ID / Ref Number"
                  value={editRefNo}
                  onChange={(e) => setEditRefNo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase">Remarks / Notes</label>
                <input
                  type="text"
                  placeholder="Reason for amount edit"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition cursor-pointer"
                >
                  Save Amount Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedReceipt && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedReceipt(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print p-4 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Payment receipt</span>
              <button onClick={() => setSelectedReceipt(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 space-y-6">
              {/* Receipt main card */}
              <div className="printable-area bg-white p-6 rounded-xl border border-slate-200 shadow-xs text-center space-y-4">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{companyConfig.name}</h3>
                <span className="text-[9px] bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-500 inline-block uppercase">Official Receipt</span>
                
                <div className="py-2 border-y border-dashed border-slate-200">
                  <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Amount Received</span>
                  <span className="text-3xl font-black font-mono text-emerald-600">₹{selectedReceipt.amount.toLocaleString('en-IN')}.00</span>
                </div>

                <div className="text-left space-y-2 text-[11px] text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Received From:</span>
                    <span className="font-bold text-slate-800">{selectedReceipt.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction Date:</span>
                    <span className="font-mono text-slate-700">{selectedReceipt.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Mode:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedReceipt.mode}</span>
                  </div>
                  {selectedReceipt.refNo && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">TXN Ref:</span>
                      <span className="font-mono text-slate-700">{selectedReceipt.refNo}</span>
                    </div>
                  )}
                  {selectedReceipt.remarks && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Remarks:</span>
                      <span className="italic text-slate-700">{selectedReceipt.remarks}</span>
                    </div>
                  )}
                </div>

                {/* Scan to Verify Payment */}
                <div className="pt-4 flex flex-col items-center gap-1.5 border-t border-slate-100 bg-slate-50/50 p-3 rounded-lg">
                  <div className="w-20 h-20 bg-white rounded border border-slate-200 p-1">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-slate-800">
                      <rect width="100" height="100" fill="white" />
                      <rect x="10" y="10" width="20" height="20" fill="black" />
                      <rect x="70" y="10" width="20" height="20" fill="black" />
                      <rect x="10" y="70" width="20" height="20" fill="black" />
                      <rect x="40" y="40" width="20" height="20" fill="black" />
                    </svg>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 tracking-wide uppercase">Scan to Verify Transaction</span>
                </div>
              </div>

              <div className="no-print flex justify-end gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Payment Modal */}
      {deletingPayment && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingPayment(null);
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full p-6 space-y-4 animate-slide-up cursor-default text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Delete Payment Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete the payment receipt of <strong className="text-slate-800">₹{deletingPayment.amount.toLocaleString('en-IN')}</strong> for <strong className="text-slate-800">{deletingPayment.clientName}</strong>?
              </p>
              <p className="text-[11px] text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-3 font-semibold">
                ⚠️ This action will automatically restore the client's ledger balance by ₹{deletingPayment.amount.toLocaleString('en-IN')}.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPayment(null)}
                className="w-full py-2.5 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deletingPayment && onDeletePayment) {
                    onDeletePayment(deletingPayment.id);
                  }
                  setDeletingPayment(null);
                }}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Card View Modal */}
      {viewingJob && (
        <JobViewModal
          job={viewingJob}
          companyConfig={companyConfig}
          onClose={() => setViewingJob(null)}
        />
      )}

      {/* Invoice View Modal */}
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
