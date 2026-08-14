/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Wrench, Printer, CheckCircle2, AlertTriangle, Calendar, User, Phone, MapPin, Tag, ShieldCheck, Check, ArrowRight, Layers } from 'lucide-react';
import { RepairJob, CompanyConfig, getEffectiveBillAmount } from '../types';

interface JobViewModalProps {
  job: RepairJob | null;
  companyConfig: CompanyConfig;
  onClose: () => void;
}

export default function JobViewModal({ job, companyConfig, onClose }: JobViewModalProps) {
  if (!job) return null;

  const totalAmount = getEffectiveBillAmount(job);
  const isPaid = job.paymentStatus === 'Paid';

  // 7 Connected Workflow Stages matching the marketing visualizer:
  // 1. Customer / Item Received
  // 2. Inward Entry Generated
  // 3. Repair Tracking (Diagnosis/Bench)
  // 4. Inventory & Parts Usage
  // 5. Billing & Invoicing
  // 6. Payment & Handover
  // 7. Business Records & Accounts

  const getStageIndex = () => {
    if (job.status === 'Product Out' || job.status === 'Outwarded' || job.status === 'Completed') {
      return isPaid ? 7 : 6;
    }
    if (job.status === 'Device Ready' || job.status === 'Ready' || job.status === 'Complete & Ready') {
      return 5;
    }
    if (job.status === 'Work in Progress' || job.status === 'Approval Pending') {
      return 4;
    }
    if (job.status === 'Device Received' || job.status === 'Received') {
      return 3;
    }
    return 2;
  };

  const currentStageNum = getStageIndex();

  const WORKFLOW_STAGES = [
    { num: 1, title: 'Item Received', desc: 'Customer details logged' },
    { num: 2, title: 'Inward Token', desc: 'Barcode/Token generated' },
    { num: 3, title: 'Diagnosis', desc: 'Fault & checklist inspect' },
    { num: 4, title: 'Bench Repair', desc: 'Parts & technician work' },
    { num: 5, title: 'Ready / QA', desc: 'Tested OK & Bill ready' },
    { num: 6, title: 'Payment Out', desc: 'Settlement & Handover' },
    { num: 7, title: 'Ledger Closed', desc: 'Accounts & record saved' }
  ];

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full my-8 overflow-hidden animate-slide-up cursor-default flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-white">Job Card #{job.id}</h3>
                <span className="text-[10px] bg-teal-500 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase">
                  {job.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-teal-400" /> <strong className="text-slate-300">IN Date:</strong> <span className="font-mono text-slate-200">{job.inDate || job.inwardDate || job.createdAt || job.date}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" /> <strong className="text-slate-300">OUT Date:</strong> <span className="font-mono text-slate-200">{job.outDate || job.outwardedDate || (job.status === 'Product Out' || job.status === 'Outwarded' ? 'Outwarded' : 'In Workshop')}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7-Stage Connected Workflow Stepper Banner */}
        <div className="bg-slate-950 text-white px-5 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 text-teal-400">
              <Layers className="w-3.5 h-3.5" /> 7-Stage Connected Lifecycle
            </span>
            <span>Stage 0{currentStageNum} of 07</span>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WORKFLOW_STAGES.map(stage => {
              const isCompleted = stage.num < currentStageNum;
              const isCurrent = stage.num === currentStageNum;
              return (
                <div key={stage.num} className="space-y-1 text-center">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isCompleted 
                        ? 'bg-emerald-500' 
                        : isCurrent 
                        ? 'bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.8)]' 
                        : 'bg-slate-800'
                    }`}
                  ></div>
                  <span className={`text-[9px] font-bold block truncate ${
                    isCurrent ? 'text-teal-300' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}>
                    {stage.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs text-slate-700">
          {/* Shop & Client Info Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <div className="space-y-1">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-teal-600" /> Client Details
              </h4>
              <p className="font-bold text-sm text-slate-900">{job.clientName}</p>
              <p className="font-mono text-slate-600 flex items-center gap-1 text-[11px]">
                <Phone className="w-3 h-3 text-slate-400" /> {job.clientMobile}
              </p>
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-purple-600" /> Device & Model Details
              </h4>
              <p className="font-bold text-sm text-slate-900">{job.equipment || 'Device'} - {job.productName || 'General Product'}</p>
              <p className="text-slate-600 font-medium">Model: {job.productModel || 'N/A'}</p>
              <p className="font-mono text-slate-500 text-[11px]">Serial No: {job.serialNo || '—'}</p>
              {job.ramHdd && <p className="font-mono text-slate-500 text-[10px]">RAM/Storage: {job.ramHdd}</p>}
            </div>
          </div>

          {/* Problems Reported */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 uppercase tracking-wide text-[11px] border-b border-slate-200 pb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Diagnosis & Problems Reported
            </h4>
            {job.problems && job.problems.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {job.problems.map((p, i) => (
                  <li key={i} className="bg-amber-50/60 border border-amber-200/60 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                    {p}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 italic">No specific problem logged</p>
            )}
          </div>

          {/* Financial Summary */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Financial Breakdown</h4>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-800 pt-3">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Estimate</span>
                <span className="font-mono text-sm font-bold text-slate-200">₹{(job.estimateAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Advance Paid</span>
                <span className="font-mono text-sm font-bold text-emerald-400">₹{(job.advanceAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Final Bill</span>
                <span className="font-mono text-base font-black text-amber-400">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="flex justify-between items-center border-t border-slate-800 pt-2 text-[11px]">
              <span className="text-slate-400">Payment Status:</span>
              <span className={`px-2.5 py-0.5 rounded-md font-extrabold font-mono text-[11px] ${
                job.paymentStatus === 'Paid'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : job.paymentStatus === 'Not Repaired'
                  ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {job.paymentStatus === 'Paid'
                  ? '✓ PAID IN FULL'
                  : job.paymentStatus === 'Not Repaired'
                  ? '⚪ NOT REPAIRED'
                  : '✕ PAYMENT PENDING / UNPAID'}
              </span>
            </div>
          </div>

          {/* Outward & Delivery info if present */}
          {(job.deliveryType || job.courierName || job.trackingNo || job.deliveredToName) && (
            <div className="bg-teal-50/60 p-3.5 rounded-xl border border-teal-200/80 space-y-1">
              <h4 className="font-bold text-teal-900 uppercase tracking-wide text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" /> Outward Delivery Information
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-teal-800 pt-1">
                <div>
                  <span className="text-slate-500 font-semibold block text-[10px]">Delivery Type:</span>
                  <span className="font-bold">{job.deliveryType || 'Counter Handover'}</span>
                </div>
                {job.courierName && (
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px]">Courier / Transport:</span>
                    <span className="font-bold font-mono">{job.courierName}</span>
                  </div>
                )}
                {job.trackingNo && (
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px]">Tracking Reference:</span>
                    <span className="font-mono font-bold text-teal-700">{job.trackingNo}</span>
                  </div>
                )}
                {job.deliveredToName && (
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px]">Delivered To:</span>
                    <span className="font-bold">{job.deliveredToName}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100">
            <p>Managed by {companyConfig.name || 'Service ERP'} • Phone: {companyConfig.phone || '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
