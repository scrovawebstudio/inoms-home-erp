/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowRight, 
  Plus, 
  Kanban, 
  Sparkles,
  Phone,
  Tag,
  ShieldCheck,
  Calendar,
  Layers,
  Check,
  Send,
  AlertTriangle,
  Truck,
  X,
  Receipt
} from 'lucide-react';
import { RepairJob, CompanyConfig, SystemUser, getEffectiveBillAmount, JobStatus, sortJobsByLatest } from '../types';
import { openWhatsAppForJob } from '../lib/whatsappUtils';

const WhatsAppIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface LiveRepairQueueProps {
  jobs: RepairJob[];
  companyConfig: CompanyConfig;
  users: SystemUser[];
  currentUser?: SystemUser | null;
  onSelectJob: (job: RepairJob) => void;
  onUpdateJob: (job: RepairJob) => void;
  onNewJobClick?: () => void;
  onOpenOutwardJob?: (jobId: string) => void;
}

export default function LiveRepairQueue({
  jobs,
  companyConfig,
  users,
  currentUser,
  onSelectJob,
  onUpdateJob,
  onNewJobClick,
  onOpenOutwardJob
}: LiveRepairQueueProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTechFilter, setSelectedTechFilter] = useState('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('all');
  const [movingJobId, setMovingJobId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'all' | 'diagnosis' | 'in_progress' | 'ready' | 'delivered'>('all');

  // Outward Delivery Modal State
  const [outwardModalJob, setOutwardModalJob] = useState<RepairJob | null>(null);
  const [outwardPaymentStatus, setOutwardPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Not Repaired'>('Unpaid');
  const [outwardPaymentMode, setOutwardPaymentMode] = useState<string>('UPI');
  const [outwardFinalBill, setOutwardFinalBill] = useState<number>(0);
  const [outwardRepairOutcome, setOutwardRepairOutcome] = useState<'Repaired' | 'Not Repaired'>('Repaired');
  const [outwardDeliveryStatus, setOutwardDeliveryStatus] = useState<string>('Handed Over');
  const [outwardCourierName, setOutwardCourierName] = useState<string>('');
  const [outwardTrackingNo, setOutwardTrackingNo] = useState<string>('');
  const [outwardActionTaken, setOutwardActionTaken] = useState<string>('');

  const handleOpenOutwardModal = (job: RepairJob, e: React.MouseEvent) => {
    e.stopPropagation();
    const effectiveBill = getEffectiveBillAmount(job) || job.estimateAmount || 0;
    const isNotRepairedJob = job.repairOutcome === 'Not Repaired' || job.paymentStatus === 'Not Repaired';
    setOutwardModalJob(job);
    setOutwardPaymentStatus(isNotRepairedJob ? 'Not Repaired' : (job.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'));
    setOutwardPaymentMode(job.advancePaymentMode || 'UPI');
    setOutwardFinalBill(isNotRepairedJob ? 0 : effectiveBill);
    setOutwardRepairOutcome(isNotRepairedJob ? 'Not Repaired' : 'Repaired');
    setOutwardDeliveryStatus(job.deliveryStatus || 'Handed Over');
    setOutwardCourierName(job.courierName || '');
    setOutwardTrackingNo(job.trackingNo || '');
    setOutwardActionTaken(job.actionTaken || 'Inspected & Repaired');
  };

  const handleConfirmOutward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outwardModalJob) return;

    const isNotRepaired = outwardRepairOutcome === 'Not Repaired' || outwardPaymentStatus === 'Not Repaired';
    const effectiveBill = isNotRepaired ? 0 : Number(outwardFinalBill) || 0;

    const updatedJob: RepairJob = {
      ...outwardModalJob,
      status: 'Product Out',
      outwardedDate: new Date().toISOString(),
      repairOutcome: isNotRepaired ? 'Not Repaired' : outwardRepairOutcome,
      paymentStatus: isNotRepaired ? 'Not Repaired' : outwardPaymentStatus,
      finalBillAmount: effectiveBill,
      advancePaymentMode: outwardPaymentStatus === 'Paid' ? outwardPaymentMode : outwardModalJob.advancePaymentMode,
      deliveryStatus: outwardDeliveryStatus,
      courierName: outwardCourierName,
      trackingNo: outwardTrackingNo,
      actionTaken: outwardActionTaken || (isNotRepaired ? 'Inspected - Device Not Repairable' : 'Inspected & Repaired'),
      updatedAt: new Date().toISOString()
    };

    onUpdateJob(updatedJob);
    setOutwardModalJob(null);
  };

  // Categorize jobs into the 4 active workflow stages shown in marketing previews:
  // 1. Diagnosis & Inspection (Device Received / Received / Pending)
  // 2. In Progress / Under Repair (Work in Progress / Approval Pending)
  // 3. Ready for Pickup / Tested OK (Device Ready / Ready / Complete & Ready)
  // 4. Delivered & Outwarded (Product Out / Outwarded / Completed)

  const activeJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchSearch = 
        !searchTerm ||
        job.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.productModel || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.clientMobile || '').includes(searchTerm);

      const matchTech = 
        selectedTechFilter === 'all' || 
        (selectedTechFilter === 'unassigned' && (!job.assignedTechnician || job.assignedTechnician === 'Unassigned')) ||
        job.assignedTechnician === selectedTechFilter;

      return matchSearch && matchTech;
    });
  }, [jobs, searchTerm, selectedTechFilter]);

  // Helper function to map any legacy or custom status to one of the 4 Kanban pillars
  const getJobKanbanStage = (status?: string): 'diagnosis' | 'in_progress' | 'ready' | 'delivered' => {
    const s = (status || '').trim().toLowerCase();
    if (!s || s === 'device received' || s === 'received' || s === 'pending') {
      return 'diagnosis';
    }
    if (s === 'work in progress' || s === 'approval pending' || s === 'in progress' || s === 'waiting parts') {
      return 'in_progress';
    }
    if (s === 'device ready' || s === 'ready' || s === 'complete & ready' || s === 'completed' || s === 'tested ok') {
      return 'ready';
    }
    if (s === 'product out' || s === 'outwarded' || s === 'delivered' || s === 'device not repairable') {
      return 'delivered';
    }
    return 'diagnosis';
  };

  const diagnosisJobs = useMemo(() => 
    activeJobs.filter(j => getJobKanbanStage(j.status) === 'diagnosis'),
    [activeJobs]
  );

  const inProgressJobs = useMemo(() => 
    activeJobs.filter(j => getJobKanbanStage(j.status) === 'in_progress'),
    [activeJobs]
  );

  const readyJobs = useMemo(() => 
    activeJobs.filter(j => getJobKanbanStage(j.status) === 'ready'),
    [activeJobs]
  );

  const deliveredJobs = useMemo(() => 
    activeJobs.filter(j => getJobKanbanStage(j.status) === 'delivered'),
    [activeJobs]
  );

  // Quick action to move a job forward or backward deterministically
  const handleQuickStatusChange = (job: RepairJob, nextStatus: JobStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    setMovingJobId(job.id);
    const updatedJob: RepairJob = {
      ...job,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };
    onUpdateJob(updatedJob);
    setTimeout(() => setMovingJobId(null), 150);
  };

  const handleAssignTech = (job: RepairJob, techName: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const updatedJob: RepairJob = {
      ...job,
      assignedTechnician: techName,
      updatedAt: new Date().toISOString()
    };
    onUpdateJob(updatedJob);
  };

  return (
    <div className="space-y-6" id="live-repair-queue-container">
      {/* Top Console Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Kanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Live Repair Queue & Workbench</h1>
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Workbench
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Visual Kanban board tracking active devices across diagnosis, bench repair, testing, and pickup.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats in Header */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Diagnosing</span>
            <span className="font-mono text-lg font-black text-amber-400">{diagnosisJobs.length}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">In Progress</span>
            <span className="font-mono text-lg font-black text-teal-400">{inProgressJobs.length}</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Ready Pickup</span>
            <span className="font-mono text-lg font-black text-emerald-400">{readyJobs.length}</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search token #, client name, model, serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter by Technician */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">Technician:</span>
            <select
              value={selectedTechFilter}
              onChange={(e) => setSelectedTechFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Technicians</option>
              <option value="unassigned">⚠️ Unassigned Benches</option>
              {users.map(u => (
                <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        {onNewJobClick && (
          <button
            onClick={onNewJobClick}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-xs hover:shadow-md cursor-pointer shrink-0"
            title="Create New Inward Job Card"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Inward / Create Job</span>
          </button>
        )}
      </div>

      {/* Mobile Stage Selector Tabs (Phone only) */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setMobileTab('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            mobileTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All ({diagnosisJobs.length + inProgressJobs.length + readyJobs.length + deliveredJobs.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('diagnosis')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'diagnosis'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          Diagnosis ({diagnosisJobs.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('in_progress')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'in_progress'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-teal-700 hover:bg-teal-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-teal-400"></span>
          Workbench ({inProgressJobs.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('ready')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'ready'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          Ready ({readyJobs.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('delivered')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
            mobileTab === 'delivered'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-purple-700 hover:bg-purple-50'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
          Delivered ({deliveredJobs.length})
        </button>
      </div>

      {/* Kanban Columns (4 Stages) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
        
        {/* COLUMN 1: Diagnosis & Inspection */}
        <div className={`bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200/90 space-y-3 min-h-[300px] md:min-h-[500px] ${
          mobileTab !== 'all' && mobileTab !== 'diagnosis' ? 'hidden md:block' : ''
        }`}>
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Diagnosis & Check</h3>
            </div>
            <span className="text-xs font-extrabold font-mono bg-white text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full shadow-2xs">
              {diagnosisJobs.length}
            </span>
          </div>

          <div className="space-y-3">
            {diagnosisJobs.length === 0 ? (
              <div className="bg-white/60 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                No jobs awaiting diagnosis
              </div>
            ) : (
              diagnosisJobs.map(job => (
                <JobKanbanCard
                  key={job.id}
                  job={job}
                  companyConfig={companyConfig}
                  users={users}
                  currentStage="diagnosis"
                  isMoving={movingJobId === job.id}
                  onSelect={() => onSelectJob(job)}
                  onNext={(e) => handleQuickStatusChange(job, 'Work in Progress', e)}
                  onAssignTech={(tech, e) => handleAssignTech(job, tech, e)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: In Progress / Workbench */}
        <div className={`bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200/90 space-y-3 min-h-[300px] md:min-h-[500px] ${
          mobileTab !== 'all' && mobileTab !== 'in_progress' ? 'hidden md:block' : ''
        }`}>
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">In Progress / Bench</h3>
            </div>
            <span className="text-xs font-extrabold font-mono bg-white text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full shadow-2xs">
              {inProgressJobs.length}
            </span>
          </div>

          <div className="space-y-3">
            {inProgressJobs.length === 0 ? (
              <div className="bg-white/60 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                No jobs currently under repair
              </div>
            ) : (
              inProgressJobs.map(job => (
                <JobKanbanCard
                  key={job.id}
                  job={job}
                  companyConfig={companyConfig}
                  users={users}
                  currentStage="in_progress"
                  isMoving={movingJobId === job.id}
                  onSelect={() => onSelectJob(job)}
                  onPrev={(e) => handleQuickStatusChange(job, 'Device Received', e)}
                  onNext={(e) => handleQuickStatusChange(job, 'Device Ready', e)}
                  onAssignTech={(tech, e) => handleAssignTech(job, tech, e)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: Ready for Pickup / Tested OK */}
        <div className={`bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200/90 space-y-3 min-h-[300px] md:min-h-[500px] ${
          mobileTab !== 'all' && mobileTab !== 'ready' ? 'hidden md:block' : ''
        }`}>
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Ready for Pickup</h3>
            </div>
            <span className="text-xs font-extrabold font-mono bg-white text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full shadow-2xs">
              {readyJobs.length}
            </span>
          </div>

          <div className="space-y-3">
            {readyJobs.length === 0 ? (
              <div className="bg-white/60 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                No jobs ready for pickup
              </div>
            ) : (
              readyJobs.map(job => (
                <JobKanbanCard
                  key={job.id}
                  job={job}
                  companyConfig={companyConfig}
                  users={users}
                  currentStage="ready"
                  isMoving={movingJobId === job.id}
                  onSelect={() => onSelectJob(job)}
                  onPrev={(e) => handleQuickStatusChange(job, 'Work in Progress', e)}
                  onNext={(e) => handleOpenOutwardModal(job, e)}
                  onAssignTech={(tech, e) => handleAssignTech(job, tech, e)}
                />
              ))
            )}
          </div>
        </div>

        {/* COLUMN 4: Outwarded / Delivered */}
        <div className={`bg-slate-100/70 p-3.5 rounded-2xl border border-slate-200/90 space-y-3 min-h-[300px] md:min-h-[500px] ${
          mobileTab !== 'all' && mobileTab !== 'delivered' ? 'hidden md:block' : ''
        }`}>
          <div className="flex items-center justify-between px-1 pb-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Delivered / Done</h3>
            </div>
            <span className="text-xs font-extrabold font-mono bg-white text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full shadow-2xs">
              {deliveredJobs.length}
            </span>
          </div>

          <div className="space-y-3">
            {deliveredJobs.length === 0 ? (
              <div className="bg-white/60 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
                No delivered items in view
              </div>
            ) : (
              deliveredJobs.slice(0, 10).map(job => (
                <JobKanbanCard
                  key={job.id}
                  job={job}
                  companyConfig={companyConfig}
                  users={users}
                  currentStage="delivered"
                  isMoving={movingJobId === job.id}
                  onSelect={() => onSelectJob(job)}
                  onPrev={(e) => handleQuickStatusChange(job, 'Device Ready', e)}
                  onAssignTech={(tech, e) => handleAssignTech(job, tech, e)}
                />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Outward Delivery & Payment Confirmation Modal */}
      {outwardModalJob && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in"
          onClick={() => setOutwardModalJob(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Outward Delivery &amp; Settlement</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Job #{outwardModalJob.id} • {outwardModalJob.clientName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOutwardModalJob(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleConfirmOutward} className="p-5 space-y-4 text-xs">
              {/* Device & Client Summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex justify-between items-center text-slate-800 font-bold">
                  <span>{outwardModalJob.productName || outwardModalJob.equipment}</span>
                  <span className="font-mono text-xs text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                    {outwardModalJob.productModel || 'Standard'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Client: <strong className="text-slate-700">{outwardModalJob.clientName}</strong></span>
                  {outwardModalJob.clientMobile && <span className="font-mono">{outwardModalJob.clientMobile}</span>}
                </div>
              </div>

              {/* Repair Outcome Toggle */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-600 uppercase text-[10px] tracking-wider">
                  Repair Outcome
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOutwardRepairOutcome('Repaired');
                      if (outwardPaymentStatus === 'Not Repaired') {
                        setOutwardPaymentStatus('Paid');
                      }
                      if (outwardFinalBill === 0) {
                        setOutwardFinalBill(getEffectiveBillAmount(outwardModalJob) || outwardModalJob.estimateAmount || 0);
                      }
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      outwardRepairOutcome === 'Repaired'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>✓</span>
                    <span>Repaired &amp; Serviced</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOutwardRepairOutcome('Not Repaired');
                      setOutwardPaymentStatus('Not Repaired');
                      setOutwardFinalBill(0);
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs transition cursor-pointer border flex items-center justify-center gap-1.5 ${
                      outwardRepairOutcome === 'Not Repaired'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>✕</span>
                    <span>Device Not Repairable</span>
                  </button>
                </div>
              </div>

              {/* Payment Status (Mandatory Selection) */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 uppercase text-[10px] tracking-wider flex items-center justify-between">
                  <span>Payment Settlement Status</span>
                  <span className="text-rose-500 font-extrabold text-[9px]">* Required</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOutwardPaymentStatus('Paid');
                      setOutwardRepairOutcome('Repaired');
                      if (outwardFinalBill === 0) {
                        setOutwardFinalBill(getEffectiveBillAmount(outwardModalJob) || outwardModalJob.estimateAmount || 0);
                      }
                    }}
                    className={`py-2.5 px-2 rounded-xl font-black text-xs transition cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      outwardPaymentStatus === 'Paid'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-400/40'
                        : 'bg-emerald-50/50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <span>✓ PAID</span>
                    <span className="text-[9px] font-normal opacity-90">Settled In Full</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOutwardPaymentStatus('Unpaid');
                      setOutwardRepairOutcome('Repaired');
                      if (outwardFinalBill === 0) {
                        setOutwardFinalBill(getEffectiveBillAmount(outwardModalJob) || outwardModalJob.estimateAmount || 0);
                      }
                    }}
                    className={`py-2.5 px-2 rounded-xl font-black text-xs transition cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      outwardPaymentStatus === 'Unpaid'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-400/40'
                        : 'bg-rose-50/50 text-rose-800 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <span>✕ UNPAID / DUE</span>
                    <span className="text-[9px] font-normal opacity-90">Post to Ledger</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOutwardPaymentStatus('Not Repaired');
                      setOutwardRepairOutcome('Not Repaired');
                      setOutwardFinalBill(0);
                    }}
                    className={`py-2.5 px-2 rounded-xl font-black text-xs transition cursor-pointer border flex flex-col items-center justify-center gap-0.5 ${
                      outwardPaymentStatus === 'Not Repaired'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-xs ring-2 ring-slate-400/40'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <span>⚪ RETURNED</span>
                    <span className="text-[9px] font-normal opacity-90">No Charge (₹0)</span>
                  </button>
                </div>
              </div>

              {/* Payment Mode & Amount if not Not-Repaired */}
              {outwardPaymentStatus !== 'Not Repaired' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-600 text-[10px] uppercase">
                      Final Bill Amount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={outwardFinalBill}
                      onChange={(e) => setOutwardFinalBill(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                    />
                    {outwardModalJob.advanceAmount && outwardModalJob.advanceAmount > 0 ? (
                      <p className="text-[10px] text-teal-700 font-medium">
                        Advance Paid: ₹{outwardModalJob.advanceAmount} (Balance: ₹{Math.max(0, outwardFinalBill - outwardModalJob.advanceAmount)})
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-600 text-[10px] uppercase">
                      Payment Mode
                    </label>
                    <select
                      value={outwardPaymentMode}
                      onChange={(e) => setOutwardPaymentMode(e.target.value)}
                      disabled={outwardPaymentStatus === 'Unpaid'}
                      className="w-full bg-white border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Delivery Handover Mode */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-600 text-[10px] uppercase">
                  Handover Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutwardDeliveryStatus('Handed Over')}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition cursor-pointer border text-center ${
                      outwardDeliveryStatus === 'Handed Over'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Counter Handover
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutwardDeliveryStatus('Courier / Dispatched')}
                    className={`py-1.5 px-3 rounded-lg font-bold text-xs transition cursor-pointer border text-center ${
                      outwardDeliveryStatus === 'Courier / Dispatched'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Courier Dispatch
                  </button>
                </div>
              </div>

              {outwardDeliveryStatus === 'Courier / Dispatched' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 text-[10px]">Courier Service</label>
                    <input
                      type="text"
                      placeholder="e.g. DTDC, BlueDart"
                      value={outwardCourierName}
                      onChange={(e) => setOutwardCourierName(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-bold text-slate-500 text-[10px]">Tracking Number</label>
                    <input
                      type="text"
                      placeholder="Tracking ID / AWB"
                      value={outwardTrackingNo}
                      onChange={(e) => setOutwardTrackingNo(e.target.value)}
                      className="w-full bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOutwardModalJob(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition shadow-md hover:shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Confirm Outward Delivery</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-Component: Kanban Card for a Single Job
interface JobKanbanCardProps {
  key?: string;
  job: RepairJob;
  companyConfig: CompanyConfig;
  users: SystemUser[];
  currentStage: 'diagnosis' | 'in_progress' | 'ready' | 'delivered';
  isMoving: boolean;
  onSelect: () => void;
  onNext?: (e: React.MouseEvent) => void;
  onPrev?: (e: React.MouseEvent) => void;
  onAssignTech: (tech: string, e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function JobKanbanCard({
  job,
  companyConfig,
  users,
  currentStage,
  isMoving,
  onSelect,
  onNext,
  onPrev,
  onAssignTech
}: JobKanbanCardProps) {
  const billAmount = getEffectiveBillAmount(job);

  // Stage-specific visual theming
  const stageTheme = {
    diagnosis: {
      border: 'border-l-4 border-l-amber-500 border-t border-r border-b border-slate-200/90',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      glow: 'hover:border-amber-400',
      btnColor: 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20',
      btnLabel: 'Start Repair'
    },
    in_progress: {
      border: 'border-l-4 border-l-teal-500 border-t border-r border-b border-slate-200/90',
      badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
      glow: 'hover:border-teal-400',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
      btnLabel: 'Mark Ready'
    },
    ready: {
      border: 'border-l-4 border-l-emerald-500 border-t border-r border-b border-slate-200/90',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      glow: 'hover:border-emerald-400',
      btnColor: 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20',
      btnLabel: 'Outward Delivery'
    },
    delivered: {
      border: 'border-l-4 border-l-purple-500 border-t border-r border-b border-slate-200/90',
      badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
      glow: 'hover:border-purple-400',
      btnColor: 'bg-slate-700 hover:bg-slate-800 text-white shadow-slate-700/20',
      btnLabel: 'Completed'
    }
  }[currentStage];

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-2xl p-4 shadow-xs hover:shadow-lg transition-all duration-150 cursor-pointer space-y-3 relative group ${stageTheme.border} ${stageTheme.glow} ${
        isMoving ? 'opacity-40 scale-95' : ''
      }`}
    >
      {/* Top Row: Token ID + Organiser Tag + Est Bill Badge */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            #{job.id}
          </span>
          <span className="text-[9px] font-bold text-teal-700 bg-teal-50 border border-teal-200/80 px-1.5 py-0.5 rounded truncate max-w-[110px]" title={companyConfig.name || 'Organiser'}>
            {companyConfig.name || 'Organiser'}
          </span>
          {job.rackLocation && (
            <span className="text-[9px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
              Rack: {job.rackLocation}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono text-xs font-black text-slate-900 block">
            ₹{billAmount > 0 ? billAmount.toLocaleString('en-IN') : (job.estimateAmount || 0).toLocaleString('en-IN')}
          </span>
          <span className="text-[9px] font-semibold text-slate-400 block -mt-0.5">
            {billAmount > 0 ? 'Final Bill' : 'Estimate'}
          </span>
        </div>
      </div>

      {/* Client and Model Info */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-xs text-slate-900 leading-snug line-clamp-1">
            {job.productName || job.equipment || 'Device'}
          </h4>
          {job.productModel && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
              {job.productModel}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium truncate">
            <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="font-semibold text-slate-800 truncate">{job.clientName}</span>
            {job.clientMobile && (
              <span className="text-[10px] text-slate-400 font-mono">({job.clientMobile})</span>
            )}
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openWhatsAppForJob(job, companyConfig);
            }}
            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition shrink-0 cursor-pointer"
            title="Share latest Job Card Status on WhatsApp"
          >
            <WhatsAppIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Reported Problem Box */}
      {job.problems && job.problems.length > 0 ? (
        <div className="bg-amber-50/80 border border-amber-200 text-amber-950 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 shadow-2xs">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="truncate">{job.problems.join(', ')}</span>
        </div>
      ) : job.problemDescription ? (
        <div className="bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] line-clamp-1">
          {job.problemDescription}
        </div>
      ) : null}

      {/* Technician Assignment & Payment Status Bar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[10px] bg-slate-50/60 -mx-4 -mb-1 px-4 py-2 rounded-b-xl">
        <div className="flex items-center gap-1.5 text-slate-600 font-medium truncate" onClick={(e) => e.stopPropagation()}>
          <Wrench className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <select
            value={job.assignedTechnician || 'Unassigned'}
            onChange={(e) => onAssignTech(e.target.value, e)}
            className="bg-white border border-slate-200 text-[10px] font-bold text-slate-800 hover:text-teal-700 px-2 py-0.5 rounded-md cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-teal-500 max-w-[120px] truncate shadow-2xs"
          >
            <option value="Unassigned">⚠️ Unassigned</option>
            {users.map(u => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Advance / Paid Badge */}
        {job.paymentStatus === 'Paid' ? (
          <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full shadow-2xs">
            ✓ PAID
          </span>
        ) : job.advanceAmount && job.advanceAmount > 0 ? (
          <span className="text-[9px] font-bold text-teal-800 bg-teal-100 border border-teal-300 px-2 py-0.5 rounded-full shadow-2xs">
            Adv ₹{job.advanceAmount}
          </span>
        ) : (
          <span className="text-[9px] font-semibold text-slate-400">
            Due ₹{(billAmount || job.estimateAmount || 0)}
          </span>
        )}
      </div>

      {/* Action Stage Transfer Controls */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer border border-slate-200"
              title="Move back to previous stage"
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openWhatsAppForJob(job, companyConfig);
            }}
            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
            title="Share latest Job Card Status on WhatsApp"
          >
            <WhatsAppIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
        </div>

        {onNext && (
          <button
            type="button"
            onClick={onNext}
            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md ${stageTheme.btnColor}`}
          >
            <span>{stageTheme.btnLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
