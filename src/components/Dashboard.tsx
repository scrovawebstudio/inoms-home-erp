/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Users,
  Inbox,
  CreditCard,
  Truck,
  ArrowRight,
  TrendingUp,
  Briefcase,
  FileText,
  DollarSign,
  Settings,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  PieChart as PieIcon,
  Wrench,
  CheckCircle2,
  Clock,
  X,
  Activity,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Client, RepairJob, Payment, Invoice } from '../types';

interface DashboardProps {
  clients: Client[];
  jobs: RepairJob[];
  payments: Payment[];
  invoices?: Invoice[];
  onNavigate: (tab: string) => void;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncedAt?: string;
  justSynced?: boolean;
}

export default function Dashboard({
  clients,
  jobs,
  payments,
  invoices,
  onNavigate,
  onSync,
  isSyncing,
  lastSyncedAt,
  justSynced
}: DashboardProps) {
  const [chartView, setChartView] = useState<'donut' | 'trend'>('donut');
  const [trendRange, setTrendRange] = useState<'7d' | '1m' | '1y' | 'custom'>('7d');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');

  // Calculate real metric breakdowns from jobs
  const totalClients = clients.length;
  const totalInwards = jobs.length;

  const inwardReceivedCount = jobs.filter(j => (j.status as string) === 'Device Received' || (j.status as string) === 'Received' || (j.status as string) === 'Pending' || !j.status).length;
  const underDiagnosisCount = jobs.filter(j => (j.status as string) === 'Work in Progress' || (j.status as string) === 'Approval Pending').length;
  const readyForDeliveryCount = jobs.filter(j => (j.status as string) === 'Device Ready' || (j.status as string) === 'Ready' || (j.status as string) === 'Complete & Ready' || (j.status as string) === 'Completed').length;
  const notRepairableCount = jobs.filter(j => (j.status as string) === 'Device Not repairable' || j.repairOutcome === 'Not Repaired').length;
  const outwardedCount = jobs.filter(j => (j.status as string) === 'Outwarded' || (j.status as string) === 'Product Out').length;

  const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  // Circular Donut Chart Data with matching colors
  const statusPieData = [
    {
      name: 'Device Received',
      count: inwardReceivedCount,
      color: '#3b82f6', // Blue
      bgClass: 'bg-blue-50',
      textClass: 'text-blue-600',
      borderClass: 'border-blue-500'
    },
    {
      name: 'Under Diagnosis',
      count: underDiagnosisCount,
      color: '#f59e0b', // Amber
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-600',
      borderClass: 'border-amber-500'
    },
    {
      name: 'Device Ready',
      count: readyForDeliveryCount,
      color: '#10b981', // Emerald
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-600',
      borderClass: 'border-emerald-500'
    },
    {
      name: 'Not Repairable',
      count: notRepairableCount,
      color: '#f43f5e', // Rose
      bgClass: 'bg-rose-50',
      textClass: 'text-rose-600',
      borderClass: 'border-rose-500'
    },
    {
      name: 'Outwarded / Delivered',
      count: outwardedCount,
      color: '#8b5cf6', // Purple
      bgClass: 'bg-purple-50',
      textClass: 'text-purple-600',
      borderClass: 'border-purple-500'
    }
  ];

  // If all job counts are zero, show friendly demo slice distribution for visualization
  const hasJobData = statusPieData.some(d => d.count > 0);
  const chartPieData = hasJobData
    ? statusPieData.map(d => ({ ...d, value: d.count }))
    : [
        { name: 'Device Received', value: 3, count: 0, color: '#3b82f6', bgClass: 'bg-blue-50', textClass: 'text-blue-600', borderClass: 'border-blue-500' },
        { name: 'Under Diagnosis', value: 4, count: 0, color: '#f59e0b', bgClass: 'bg-amber-50', textClass: 'text-amber-600', borderClass: 'border-amber-500' },
        { name: 'Device Ready', value: 5, count: 0, color: '#10b981', bgClass: 'bg-emerald-50', textClass: 'text-emerald-600', borderClass: 'border-emerald-500' },
        { name: 'Not Repairable', value: 1, count: 0, color: '#f43f5e', bgClass: 'bg-rose-50', textClass: 'text-rose-600', borderClass: 'border-rose-500' },
        { name: 'Outwarded / Delivered', value: 2, count: 0, color: '#8b5cf6', bgClass: 'bg-purple-50', textClass: 'text-purple-600', borderClass: 'border-purple-500' }
      ];

  // Calculate real income trend data dynamically based on organization payments
  const calculateRealTrendData = () => {
    if (!payments || payments.length === 0) {
      return [{ name: 'No Payments Recorded', amount: 0 }];
    }

    if (trendRange === '7d') {
      const dateMap: { [dateStr: string]: number } = {};
      const sortedPayments = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      sortedPayments.forEach(p => {
        const d = p.date ? p.date.substring(0, 10) : 'Today';
        dateMap[d] = (dateMap[d] || 0) + Number(p.amount);
      });

      const entries = Object.entries(dateMap).slice(-7);
      if (entries.length === 0) return [{ name: 'Today', amount: 0 }];

      return entries.map(([dateKey, totalAmount]) => {
        try {
          const dt = new Date(dateKey);
          const formatted = isNaN(dt.getTime())
            ? dateKey
            : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          return { name: formatted, amount: totalAmount };
        } catch {
          return { name: dateKey, amount: totalAmount };
        }
      });
    }

    if (trendRange === '1m') {
      const weekMap: { [weekLabel: string]: number } = {
        'Week 1': 0,
        'Week 2': 0,
        'Week 3': 0,
        'Week 4': 0
      };

      const now = new Date().getTime();
      payments.forEach(p => {
        const pTime = new Date(p.date).getTime();
        const diffDays = Math.floor((now - pTime) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) weekMap['Week 4'] += Number(p.amount);
        else if (diffDays <= 14) weekMap['Week 3'] += Number(p.amount);
        else if (diffDays <= 21) weekMap['Week 2'] += Number(p.amount);
        else weekMap['Week 1'] += Number(p.amount);
      });

      return Object.entries(weekMap).map(([name, amount]) => ({ name, amount }));
    }

    if (trendRange === '1y') {
      const monthMap: { [monthLabel: string]: number } = {};
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      payments.forEach(p => {
        try {
          const dt = new Date(p.date);
          const mName = isNaN(dt.getTime()) ? 'Recent' : monthNames[dt.getMonth()];
          monthMap[mName] = (monthMap[mName] || 0) + Number(p.amount);
        } catch {
          monthMap['Recent'] = (monthMap['Recent'] || 0) + Number(p.amount);
        }
      });

      if (Object.keys(monthMap).length === 0) {
        return monthNames.slice(0, 6).map(m => ({ name: m, amount: 0 }));
      }

      return Object.entries(monthMap).map(([name, amount]) => ({ name, amount }));
    }

    // Custom Date Range filter
    if (trendRange === 'custom') {
      let filteredPayments = [...payments];
      if (customFromDate) {
        filteredPayments = filteredPayments.filter(p => {
          const pDate = p.date ? p.date.substring(0, 10) : '';
          return pDate && pDate >= customFromDate;
        });
      }
      if (customToDate) {
        filteredPayments = filteredPayments.filter(p => {
          const pDate = p.date ? p.date.substring(0, 10) : '';
          return pDate && pDate <= customToDate;
        });
      }

      if (filteredPayments.length === 0) {
        return [{ name: 'No Payments', amount: 0 }];
      }

      const dateMap: { [dateStr: string]: number } = {};
      const sortedPayments = filteredPayments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      sortedPayments.forEach(p => {
        const d = p.date ? p.date.substring(0, 10) : 'Today';
        dateMap[d] = (dateMap[d] || 0) + Number(p.amount);
      });

      return Object.entries(dateMap).map(([dateKey, totalAmount]) => {
        try {
          const dt = new Date(dateKey);
          const formatted = isNaN(dt.getTime())
            ? dateKey
            : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          return { name: formatted, amount: totalAmount };
        } catch {
          return { name: dateKey, amount: totalAmount };
        }
      });
    }

    // Default: Group by all individual payment dates
    const dateMap: { [dateStr: string]: number } = {};
    const sortedPayments = [...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sortedPayments.forEach(p => {
      const d = p.date ? p.date.substring(0, 10) : 'Today';
      dateMap[d] = (dateMap[d] || 0) + Number(p.amount);
    });

    return Object.entries(dateMap).map(([dateKey, totalAmount]) => {
      try {
        const dt = new Date(dateKey);
        const formatted = isNaN(dt.getTime())
          ? dateKey
          : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return { name: formatted, amount: totalAmount };
      } catch {
        return { name: dateKey, amount: totalAmount };
      }
    });
  };

  const activeTrendData = calculateRealTrendData();
  const trendTotalRevenue = activeTrendData.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="space-y-6" id="dashboard-container">
      {/* Top Welcome Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Workshop Overview &amp; Live Operations <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-bold border border-teal-200">Live Station Intelligence</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Real-time status indicators, workbench queue, and job distribution graph across your organization.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('live_queue')}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-teal-300 text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs hover:shadow-md cursor-pointer border border-slate-700"
          >
            <Layers className="w-4 h-4 text-teal-400" />
            <span>Open Live Queue</span>
          </button>
          <button
            onClick={onSync}
            disabled={isSyncing}
            id="sync-data-btn"
            title={`Click to trigger manual data sync with Home Server. Last synced: ${lastSyncedAt || 'Just now'}`}
            className={`flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs hover:shadow-md cursor-pointer border ${
              isSyncing
                ? 'bg-teal-600 text-white border-teal-500 shadow-teal-500/20 animate-pulse'
                : justSynced
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
                : 'bg-teal-600 hover:bg-teal-700 text-white border-teal-700'
            }`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-teal-200" />
                <span>Syncing to Server...</span>
              </>
            ) : justSynced ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Synced Just Now</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Sync Station Data</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Operational Overview Metrics - Color matched to the circular chart */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="metrics-grid">
        {/* Box 1: Inward Received (Blue) */}
        <div 
          onClick={() => onNavigate('inwards')}
          className="bg-white p-5 rounded-2xl border border-slate-100 border-l-4 border-l-blue-500 shadow-xs flex items-center justify-between transition hover:shadow-md cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0 group-hover:scale-110 transition">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Inward</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800 tracking-tight">{inwardReceivedCount}</span>
                <span className="text-[10px] text-blue-600 font-bold font-mono">#{totalInwards} Tokens</span>
              </div>
            </div>
          </div>
          <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" title="Color matched to circular graph slice"></span>
        </div>

        {/* Box 2: Under Diagnosis (Amber) */}
        <div 
          onClick={() => onNavigate('live_queue')}
          className="bg-white p-5 rounded-2xl border border-slate-100 border-l-4 border-l-amber-500 shadow-xs flex items-center justify-between transition hover:shadow-md cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0 group-hover:scale-110 transition">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Repairs in Progress</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800 tracking-tight">{underDiagnosisCount}</span>
                <span className="text-[10px] text-amber-600 font-bold font-mono">+{readyForDeliveryCount} Ready</span>
              </div>
            </div>
          </div>
          <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" title="Color matched to circular graph slice"></span>
        </div>

        {/* Box 3: Ready for Delivery (Teal/Emerald) */}
        <div 
          onClick={() => onNavigate('outwards')}
          className="bg-white p-5 rounded-2xl border border-slate-100 border-l-4 border-l-emerald-500 shadow-xs flex items-center justify-between transition hover:shadow-md cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0 group-hover:scale-110 transition">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Outward</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800 tracking-tight">{outwardedCount}</span>
                <span className="text-[10px] text-emerald-600 font-bold font-mono">Delivered</span>
              </div>
            </div>
          </div>
          <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" title="Color matched to circular graph slice"></span>
        </div>

        {/* Box 4: Pending Dues (Rose) */}
        <div 
          onClick={() => onNavigate('clients')}
          className="bg-white p-5 rounded-2xl border border-slate-100 border-l-4 border-l-rose-500 shadow-xs flex items-center justify-between transition hover:shadow-md cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0 group-hover:scale-110 transition">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Dues</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-rose-600 font-mono">
                  ₹{clients.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" title="Color matched to circular graph slice"></span>
        </div>
      </div>

      {/* Main Content Layout (Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Circular Donut Graph or Income Trend Toggle */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {chartView === 'donut' ? (
                  <>
                    <PieIcon className="w-5 h-5 text-teal-600" />
                    <span>Job Status</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5 text-teal-600" />
                    <span>Income Trend & Revenue Graph</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {chartView === 'donut'
                  ? 'Visual job distribution across diagnosis and repair status stages with matched data boxes.'
                  : 'Total volume of credit sales & advance payments generated across time.'}
              </p>
            </div>
            
            {/* View Toggle Buttons */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setChartView('donut')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  chartView === 'donut'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PieIcon className="w-3.5 h-3.5" />
                <span>Status Chart</span>
              </button>
              <button
                type="button"
                onClick={() => setChartView('trend')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                  chartView === 'trend'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Revenue Trend</span>
              </button>
            </div>
          </div>

          {/* VIEW A: Circular Donut Graph */}
          {chartView === 'donut' && (
            <div className="flex flex-col md:flex-row items-center justify-around gap-6 py-2">
              {/* Donut Chart Container */}
              <div className="relative w-64 h-64 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={100}
                      paddingAngle={4}
                      cornerRadius={6}
                      dataKey="value"
                    >
                      {chartPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={3} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)'
                      }}
                      formatter={(value: any, name: any, item: any) => [
                        `${item.payload.count || value} Jobs`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Donut Ring Badge */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-800 tracking-tight">{totalInwards}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Jobs</span>
                </div>
              </div>

              {/* Color-Matched Status Legend List */}
              <div className="flex-1 w-full space-y-2.5 max-w-sm">
                {statusPieData.map((item, idx) => {
                  const pct = totalInwards > 0 ? Math.round((item.count / totalInwards) * 100) : 0;
                  return (
                    <div
                      key={item.name ? `${item.name}-${idx}` : `status-${idx}`}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs transition hover:scale-[1.01] ${item.bgClass} ${item.borderClass}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: item.color }}
                        ></span>
                        <span className="font-bold text-slate-800">{item.name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-black text-sm ${item.textClass}`}>{item.count} Jobs</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW B: Interactive Line Chart */}
          {chartView === 'trend' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
                {/* Total Revenue badge for selected trend period */}
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    {trendRange === '7d' ? '7D Revenue:' : trendRange === '1m' ? '1M Revenue:' : trendRange === '1y' ? '1Y Revenue:' : 'Period Revenue:'}
                  </span>
                  <span className="text-xs font-black text-teal-800 bg-teal-100/80 px-2.5 py-1 rounded-lg border border-teal-200 shadow-2xs font-mono">
                    ₹{trendTotalRevenue.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Trend Range Buttons */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/80 shadow-2xs">
                  {(['7d', '1m', '1y', 'custom'] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTrendRange(range)}
                      className={`px-3 py-1 rounded-md text-xs font-extrabold uppercase transition cursor-pointer ${
                        trendRange === range
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range Picker Bar when Custom range is selected */}
              {trendRange === 'custom' && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <span>Select Custom Date Range:</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">From:</span>
                      <input
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">To:</span>
                      <input
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
                      />
                    </div>

                    {(customFromDate || customToDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomFromDate('');
                          setCustomToDate('');
                        }}
                        className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
                        title="Clear custom dates"
                      >
                        <X className="w-3.5 h-3.5 text-slate-600" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value: any) => [`₹${value}`, 'Revenue']}
                    />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#0d9488"
                      strokeWidth={3}
                      dot={{ r: 4, stroke: '#0d9488', strokeWidth: 2, fill: '#ffffff' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Quick Action Links & Mini Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-teal-600" />
              Quick Actions
            </h2>
            <p className="text-xs text-slate-400 mb-4">Direct navigation to active diagnostic and account workflows.</p>

            <div className="grid grid-cols-2 gap-3" id="quick-links">
              <button
                type="button"
                onClick={() => onNavigate('clients')}
                className="flex flex-col items-start p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 hover:border-blue-200 rounded-xl transition text-left cursor-pointer group"
              >
                <Users className="w-5 h-5 text-blue-600 mb-2 transition group-hover:scale-110" />
                <span className="text-xs font-bold text-slate-700">Clients</span>
                <span className="text-[10px] text-slate-400 mt-1">Manage profiles</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('inwards')}
                className="flex flex-col items-start p-4 bg-purple-50/50 hover:bg-purple-50 border border-purple-100 hover:border-purple-200 rounded-xl transition text-left cursor-pointer group"
              >
                <Briefcase className="w-5 h-5 text-purple-600 mb-2 transition group-hover:scale-110" />
                <span className="text-xs font-bold text-slate-700">Repair Inwards</span>
                <span className="text-[10px] text-slate-400 mt-1">Job entries</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('billing')}
                className="flex flex-col items-start p-4 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 hover:border-emerald-200 rounded-xl transition text-left cursor-pointer group"
              >
                <FileText className="w-5 h-5 text-emerald-600 mb-2 transition group-hover:scale-110" />
                <span className="text-xs font-bold text-slate-700">Invoices</span>
                <span className="text-[10px] text-slate-400 mt-1">Tax billing</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('expenses')}
                className="flex flex-col items-start p-4 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 hover:border-rose-200 rounded-xl transition text-left cursor-pointer group"
              >
                <DollarSign className="w-5 h-5 text-rose-600 mb-2 transition group-hover:scale-110" />
                <span className="text-xs font-bold text-slate-700">Expenses</span>
                <span className="text-[10px] text-slate-400 mt-1">Outflow track</span>
              </button>
            </div>
          </div>

          {/* Shop Operations Pulse - Live Workbench & Floor Intelligence */}
          <div className="border-t border-slate-100 pt-4 mt-2 bg-gradient-to-br from-slate-50 to-teal-50/30 p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-600"></span>
                </span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Shop Operations Pulse
                </h3>
              </div>
              <span className="text-[9px] bg-teal-100/80 text-teal-800 border border-teal-200/80 px-2 py-0.5 rounded-full font-black tracking-wide">
                LIVE STATUS
              </span>
            </div>

            <div className="space-y-2">
              {/* Row 1: Workbench Active */}
              <div
                onClick={() => onNavigate('live_queue')}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 hover:border-amber-300 hover:bg-amber-50/40 transition cursor-pointer text-xs group"
                title="Click to view active workbench repair jobs"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition" />
                  <span className="text-slate-600 font-medium group-hover:text-slate-900">Workbench Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70 text-xs">
                    {underDiagnosisCount} in repair
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 transition" />
                </div>
              </div>

              {/* Row 2: Ready for Pickup */}
              <div
                onClick={() => onNavigate('outwards')}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 hover:border-emerald-300 hover:bg-emerald-50/40 transition cursor-pointer text-xs group"
                title="Click to view devices ready for delivery/outward"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition" />
                  <span className="text-slate-600 font-medium group-hover:text-slate-900">Ready for Pickup</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/70 text-xs">
                    {readyForDeliveryCount} devices
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 transition" />
                </div>
              </div>

              {/* Row 3: Intake / New Inwards */}
              <div
                onClick={() => onNavigate('inwards')}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 hover:border-blue-300 hover:bg-blue-50/40 transition cursor-pointer text-xs group"
                title="Click to view inward received jobs"
              >
                <div className="flex items-center gap-2">
                  <Inbox className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition" />
                  <span className="text-slate-600 font-medium group-hover:text-slate-900">Intake / Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/70 text-xs">
                    {inwardReceivedCount} queue
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 transition" />
                </div>
              </div>

              {/* Row 4: Outstanding Collections */}
              <div
                onClick={() => onNavigate('clients')}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 hover:border-rose-300 hover:bg-rose-50/40 transition cursor-pointer text-xs group"
                title="Click to view clients with outstanding balances"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition" />
                  <span className="text-slate-600 font-medium group-hover:text-slate-900">Pending Dues</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/70 text-xs">
                    ₹{clients.reduce((acc, c) => acc + (c.outstandingBalance || 0), 0).toLocaleString('en-IN')}
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-slate-700 transition" />
                </div>
              </div>
            </div>

            {/* Live Synchronized Footer Indicator */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
              <span className="flex items-center gap-1.5 text-slate-600">
                <RefreshCw className={`w-3 h-3 text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing to Server...' : 'Real-time Server Sync'}</span>
              </span>
              <span className="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-100">
                {lastSyncedAt ? `Synced ${lastSyncedAt}` : 'Live Active'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
