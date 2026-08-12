/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
  Award,
  CheckCircle,
  Clock,
  Briefcase,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { RepairJob, Payment, Invoice, Expense, Client, getEffectiveBillAmount } from '../types';

interface ReportsProps {
  jobs: RepairJob[];
  payments: Payment[];
  invoices: Invoice[];
  expenses: Expense[];
  clients: Client[];
}

export default function Reports({
  jobs,
  payments,
  invoices,
  expenses,
  clients
}: ReportsProps) {
  const [activeReportTab, setActiveReportTab] = useState<'daybook' | 'analytics' | 'engineers'>('daybook');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Helper quick range filters
  const setQuickRange = (range: 'today' | 'this_month' | 'all') => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    if (range === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (range === 'this_month') {
      const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
      setFromDate(monthStart);
      setToDate(todayStr);
    } else {
      setFromDate('');
      setToDate('');
    }
  };

  // Daybook metrics for selected date range
  const daybookPayments = payments.filter(p => {
    const pDate = p.date ? p.date.substring(0, 10) : '';
    if (fromDate && pDate < fromDate) return false;
    if (toDate && pDate > toDate) return false;
    return true;
  });

  const daybookExpenses = expenses.filter(e => {
    const eDate = e.date ? e.date.substring(0, 10) : '';
    if (fromDate && eDate < fromDate) return false;
    if (toDate && eDate > toDate) return false;
    return true;
  });

  const totalDaybookInward = daybookPayments.reduce((acc, curr) => acc + curr.amount, 0);
  const totalDaybookOutward = daybookExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Diagnostics metrics filtered by date range if specified
  const filteredJobs = jobs.filter(j => {
    const jDate = j.date ? j.date.substring(0, 10) : '';
    if (fromDate && jDate < fromDate) return false;
    if (toDate && jDate > toDate) return false;
    return true;
  });

  const totalJobs = filteredJobs.length;
  const completedJobs = filteredJobs.filter(j => j.status === 'Outwarded' || j.status === 'Completed' || j.status === 'Product Out').length;
  const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
  
  const estimatedRevenue = filteredJobs.reduce((s, j) => s + getEffectiveBillAmount(j), 0);

  // Engineer ratings
  const engineerStats = [
    { name: 'Jackie A', assigned: 3, completed: 2, pending: 1, rate: 66.6, revenue: 6300 },
    { name: 'Siddharth S', assigned: 1, completed: 1, pending: 0, rate: 100, revenue: 2400 }
  ];

  return (
    <div className="space-y-6">
      {/* Reports tab header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Reports & Service Analytics
            </h1>
            <p className="text-xs text-slate-400 mt-1">Audit GST files, check operational daybooks, and run engineer rating scores.</p>
          </div>

          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 self-start md:self-auto text-xs font-bold">
            <button
              onClick={() => setActiveReportTab('daybook')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeReportTab === 'daybook' ? 'bg-white text-teal-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Daybook Ledger
            </button>
            <button
              onClick={() => setActiveReportTab('analytics')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeReportTab === 'analytics' ? 'bg-white text-teal-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Repair Job Analytics
            </button>
            <button
              onClick={() => setActiveReportTab('engineers')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeReportTab === 'engineers' ? 'bg-white text-teal-600 shadow-xs' : 'text-slate-500'
              }`}
            >
              Engineer Leaderboard
            </button>
          </div>
        </div>
      </div>

      {/* Global Date Range Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="uppercase tracking-wider text-[11px] text-slate-500">Filter Reports Date Range:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Presets */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 mr-2">
            <button
              type="button"
              onClick={() => setQuickRange('today')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('this_month')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('all')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              All Time
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono">
            <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-mono">
            <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 focus:outline-hidden cursor-pointer"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => setQuickRange('all')}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-[11px]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: Daybook Ledger */}
      {activeReportTab === 'daybook' && (
        <div className="space-y-6" id="reports-daybook">
          {/* Operational summaries side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Receipts side */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center text-emerald-800">
                <span className="text-xs font-bold uppercase tracking-wider">Total Inwards (Receipts)</span>
                <span className="font-mono font-black text-sm">₹{totalDaybookInward.toFixed(2)}</span>
              </div>
              <div className="p-4 space-y-3 min-h-48 text-xs">
                {daybookPayments.length > 0 ? (
                  daybookPayments.map((p, idx) => (
                    <div key={`p-${p.id}-${idx}`} className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                      <div>
                        <p className="font-bold text-slate-700">{p.clientName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Mode: {p.mode} {p.refNo ? `(${p.refNo})` : ''}</p>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 text-sm">₹{p.amount.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-400 italic pt-12">No receipt credits recorded for the selected range.</p>
                )}
              </div>
            </div>

            {/* Expenses side */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
              <div className="p-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center text-rose-800">
                <span className="text-xs font-bold uppercase tracking-wider">Total Outwards (Expenses)</span>
                <span className="font-mono font-black text-sm">₹{totalDaybookOutward.toFixed(2)}</span>
              </div>
              <div className="p-4 space-y-3 min-h-48 text-xs">
                {daybookExpenses.length > 0 ? (
                  daybookExpenses.map((e, idx) => (
                    <div key={`e-${e.id}-${idx}`} className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                      <div>
                        <p className="font-bold text-slate-700">{e.category}</p>
                        <p className="text-[10px] text-slate-400 italic">{e.remarks || 'No notes'}</p>
                      </div>
                      <span className="font-mono font-bold text-rose-600 text-sm">₹{e.amount.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-slate-400 italic pt-12">No expense outlays recorded for the selected range.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Repair Job Analytics */}
      {activeReportTab === 'analytics' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6" id="reports-analytics">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 text-center">
            <Clock className="w-10 h-10 text-teal-500 mx-auto" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Intake Jobs</span>
              <span className="text-3xl font-extrabold text-slate-800 font-mono block mt-1">{totalJobs}</span>
            </div>
            <p className="text-[10px] text-slate-400">Total volume of diagnostic cards processed.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Diagnostics Clearance Rate</span>
              <span className="text-3xl font-extrabold text-slate-800 font-mono block mt-1">{completionRate.toFixed(1)}%</span>
            </div>
            <p className="text-[10px] text-slate-400">Completion vs pending outwards ratio.</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4 text-center">
            <DollarSign className="w-10 h-10 text-amber-500 mx-auto" />
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Est. Revenue Backlogs</span>
              <span className="text-3xl font-extrabold text-slate-800 font-mono block mt-1">₹{estimatedRevenue.toLocaleString('en-IN')}.00</span>
            </div>
            <p className="text-[10px] text-slate-400">Total diagnostic and bill backlog values.</p>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Engineer Leaderboards */}
      {activeReportTab === 'engineers' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden" id="reports-engineers">
          <div className="p-4 bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-500">
            Technician diagnostics and success tracking scorecard
          </div>
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase">
                  <th className="py-3 px-6">Rank</th>
                  <th className="py-3 px-6">Engineer Name</th>
                  <th className="py-3 px-6 text-center">Jobs Assigned</th>
                  <th className="py-3 px-6 text-center">Completed</th>
                  <th className="py-3 px-6 text-center">Pending diagnostics</th>
                  <th className="py-3 px-6 text-right">Revenue Yield</th>
                  <th className="py-3 px-6 text-right">Clearance Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {engineerStats.map((eng, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-6 flex items-center gap-1.5 font-bold font-mono text-slate-400">
                      <Award className={`w-4 h-4 ${idx === 0 ? 'text-amber-500' : 'text-slate-300'}`} />
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-800">{eng.name}</td>
                    <td className="py-3.5 px-6 text-center font-mono">{eng.assigned}</td>
                    <td className="py-3.5 px-6 text-center font-mono text-emerald-600 font-semibold">{eng.completed}</td>
                    <td className="py-3.5 px-6 text-center font-mono text-amber-500">{eng.pending}</td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-800">
                      ₹{eng.revenue.toLocaleString('en-IN')}.00
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-black text-teal-600">
                      {eng.rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
