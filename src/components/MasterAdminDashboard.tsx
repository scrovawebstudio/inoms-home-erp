import React, { useState } from 'react';
import MicrosoftAuthQR, { generateBase32Secret } from './MicrosoftAuthQR';
import { TenantOrg, SystemAnnouncement } from './AuthModal';
import {
  Building,
  Plus,
  ShieldCheck,
  Power,
  Trash2,
  Send,
  Bell,
  Search,
  Key,
  Copy,
  Check,
  QrCode,
  Smartphone,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Users,
  Briefcase,
  DollarSign,
  Share2,
  X,
  RefreshCw,
  Lock,
  Unlock,
  Edit
} from 'lucide-react';

interface MasterAdminDashboardProps {
  tenants: TenantOrg[];
  announcements: SystemAnnouncement[];
  onRegisterOrg: (newTenant: TenantOrg) => void;
  onUpdateTenant?: (updatedTenant: TenantOrg) => void;
  onToggleTenantStatus: (tenantId: string) => void;
  onDeleteTenant: (tenantId: string) => void;
  onSendAnnouncement: (announcement: Omit<SystemAnnouncement, 'id' | 'createdAt' | 'createdBy'>) => void;
  onDeleteAnnouncement: (id: string) => void;
  jobsCountByTenant?: Record<string, number>;
  revenueByTenant?: Record<string, number>;
}

export default function MasterAdminDashboard({
  tenants,
  announcements,
  onRegisterOrg,
  onUpdateTenant,
  onToggleTenantStatus,
  onDeleteTenant,
  onSendAnnouncement,
  onDeleteAnnouncement,
  jobsCountByTenant = {},
  revenueByTenant = {}
}: MasterAdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [showSensitiveKeys, setShowSensitiveKeys] = useState<boolean>(false);

  // Register New Org Modal state
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [regStep, setRegStep] = useState<number>(1);
  const [regName, setRegName] = useState<string>('');
  const [regMobile, setRegMobile] = useState<string>('');
  const [regOwner, setRegOwner] = useState<string>('');
  const [regPin, setRegPin] = useState<string>('1234');
  const [regSecretKey, setRegSecretKey] = useState<string>('');

  // Edit Org Modal state
  const [editingOrg, setEditingOrg] = useState<TenantOrg | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editOwnerName, setEditOwnerName] = useState<string>('');
  const [editOwnerMobile, setEditOwnerMobile] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('1234');
  const [editSecretKey, setEditSecretKey] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'deactivated'>('active');

  const handleOpenEditModal = (org: TenantOrg) => {
    setEditingOrg(org);
    setEditName(org.name);
    setEditCode(org.code);
    setEditOwnerName(org.ownerName || '');
    setEditOwnerMobile(org.ownerMobile);
    setEditPin(org.pin);
    setEditSecretKey(org.secretKey || '');
    setEditStatus(org.status);
  };

  const handleSaveEditOrg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    if (!editName.trim() || !editCode.trim() || !editOwnerMobile.trim() || !editPin.trim()) {
      alert('Please fill in all required organization fields.');
      return;
    }

    const updated: TenantOrg = {
      ...editingOrg,
      name: editName.trim(),
      code: editCode.trim().toUpperCase(),
      ownerName: editOwnerName.trim() || 'Org Admin',
      ownerMobile: editOwnerMobile.trim(),
      pin: editPin.trim(),
      secretKey: editSecretKey.trim() || generateBase32Secret(),
      status: editStatus
    };

    if (onUpdateTenant) {
      onUpdateTenant(updated);
    }
    setEditingOrg(null);
  };

  // Share Access Credential Modal
  const [selectedShareOrg, setSelectedShareOrg] = useState<TenantOrg | null>(null);
  const [copiedCreds, setCopiedCreds] = useState<boolean>(false);

  // Broadcast Message State
  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastTarget, setBroadcastTarget] = useState<string>('all');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning' | 'urgent'>('info');
  const [broadcastSentSuccess, setBroadcastSentSuccess] = useState<boolean>(false);

  // Filtered orgs
  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ownerMobile.includes(searchTerm) ||
      (t.ownerName && t.ownerName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'active') return matchesSearch && t.status === 'active';
    if (statusFilter === 'deactivated') return matchesSearch && t.status === 'deactivated';
    return matchesSearch;
  });

  const activeCount = tenants.filter(t => t.status === 'active').length;
  const deactivatedCount = tenants.filter(t => t.status === 'deactivated').length;

  const handleOpenRegisterModal = () => {
    setRegName('');
    setRegMobile('+91 ');
    setRegOwner('');
    setRegPin('1234');
    setRegStep(1);
    setShowRegisterModal(true);
  };

  const handleProceedTo2FASetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regMobile) return;
    const secret = generateBase32Secret(regName + regMobile);
    setRegSecretKey(secret);
    setRegStep(2);
  };

  const handleFinalizeRegistration = () => {
    if (!regName || !regMobile) return;
    const newOrg: TenantOrg = {
      id: `org-${Date.now()}`,
      name: regName,
      code: `${regName.substring(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      pin: regPin || '1234',
      ownerMobile: regMobile,
      ownerName: regOwner || 'Org Administrator',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      secretKey: regSecretKey
    };

    onRegisterOrg(newOrg);
    setShowRegisterModal(false);
    setSelectedShareOrg(newOrg);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;

    onSendAnnouncement({
      title: broadcastTitle,
      message: broadcastMessage,
      targetTenantId: broadcastTarget,
      severity: broadcastSeverity
    });

    setBroadcastTitle('');
    setBroadcastMessage('');
    setBroadcastSentSuccess(true);
    setTimeout(() => setBroadcastSentSuccess(false), 3000);
  };

  const handleCopyAccessDetails = (org: TenantOrg) => {
    const text = `🔑 *SAAS WORKSPACE ACCESS CREDENTIALS*
---------------------------------------
🏢 Organization: ${org.name}
🆔 Workspace Code: ${org.code}
📱 Owner Mobile: ${org.ownerMobile}
👤 Owner Name: ${org.ownerName || 'Admin'}
🔑 Master PIN: ${org.pin}
🔐 2FA Secret Key: ${org.secretKey || 'Standard TOTP'}
---------------------------------------
Login Page: Access with registered mobile and PIN on the portal.`;

    navigator.clipboard.writeText(text);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold tracking-tight text-white">Platform Master Admin Dashboard</h1>
            <span className="bg-teal-500/20 text-teal-300 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-teal-500/30 uppercase">
              Super Admin Level
            </span>
          </div>
          <p className="text-xs text-slate-300">
            Control SaaS tenant organization accounts, manage active/deactivated access, broadcast system announcements, and register new organizations.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenRegisterModal}
          className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs px-4 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Register New Organization
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Workspaces</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{tenants.length}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Registered Organizations</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
            <Building className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Accounts</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</h3>
            <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Full System Access</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Deactivated Accounts</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{deactivatedCount}</h3>
            <p className="text-[10px] text-rose-600 font-semibold mt-0.5">Login Blocked</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Broadcasts</p>
            <h3 className="text-2xl font-black text-teal-600 mt-1">{announcements.length}</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">System Messages</p>
          </div>
          <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
            <Bell className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Section: Organizations Directory & Control Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Table Filter Controls Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-5 h-5 text-teal-600" /> SaaS Organization Account Controls
            </h2>
            <p className="text-xs text-slate-500">Manage tenant accounts, activate or deactivate login permissions, and share access.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search org name, mobile, code..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
              {(['all', 'active', 'deactivated'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1 rounded-lg capitalize transition cursor-pointer ${
                    statusFilter === f
                      ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Organizations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/60 text-slate-500 text-[10px] uppercase font-extrabold tracking-wider border-b border-slate-200/80">
                <th className="p-4 whitespace-nowrap">Organization Name</th>
                <th className="p-4 whitespace-nowrap">Org Code</th>
                <th className="p-4 whitespace-nowrap">Owner Contact</th>
                <th className="p-4 whitespace-nowrap">Registered Date</th>
                <th className="p-4 whitespace-nowrap">Account Status</th>
                <th className="p-4 text-center whitespace-nowrap">Manage / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No matching organizations found.
                  </td>
                </tr>
              ) : (
                filteredTenants.map(org => {
                  const isMasterAdmin = org.id === 'org-admin' || org.code?.toUpperCase() === 'ADMIN-00' || org.ownerMobile?.includes('8149862034');
                  const isActive = isMasterAdmin ? true : org.status === 'active';

                  return (
                    <tr key={org.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-2xs ${
                            isMasterAdmin ? 'bg-slate-900 ring-2 ring-teal-500/50' : isActive ? 'bg-teal-600' : 'bg-slate-400'
                          }`}>
                            {org.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs flex items-center gap-1.5">
                              {org.name}
                              {isMasterAdmin && (
                                <span className="bg-teal-100 text-teal-800 font-extrabold text-[9px] px-2 py-0.5 rounded-full border border-teal-200">
                                  🛡️ Master System Admin
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400">Owner: {org.ownerName || 'Master System Admin'}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-800 font-bold px-2 py-1 rounded-lg border border-slate-200">
                          {org.code}
                        </span>
                      </td>

                      <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-800">
                        {org.ownerMobile}
                      </td>

                      <td className="p-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {org.createdAt || '2026-01-01'}
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        {isMasterAdmin ? (
                          <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-full font-bold text-[10px]">
                            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Protected (Master Admin)
                          </span>
                        ) : isActive ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active Access
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full font-bold text-[10px]">
                            <Lock className="w-3 h-3 text-rose-600" /> Account Deactivated
                          </span>
                        )}
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          
                          {/* Share Credentials */}
                          <button
                            type="button"
                            onClick={() => setSelectedShareOrg(org)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-slate-200"
                            title="View / Share Access Credentials"
                          >
                            <Share2 className="w-3.5 h-3.5 text-teal-600" /> Share Access
                          </button>

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(org)}
                            className="p-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-teal-200"
                            title="Edit Organization Details"
                          >
                            <Edit className="w-3.5 h-3.5 text-teal-600" /> Edit
                          </button>

                          {!isMasterAdmin && (
                            <>
                              {/* Toggle Active / Deactive */}
                              <button
                                type="button"
                                onClick={() => onToggleTenantStatus(org.id)}
                                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border shadow-2xs ${
                                  isActive
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                                }`}
                                title={isActive ? 'Deactivate Account' : 'Activate Account'}
                              >
                                <Power className="w-3.5 h-3.5" />
                                <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                              </button>

                              {/* Delete Org / Account */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to PERMANENTLY DELETE organization account "${org.name}"? This action cannot be undone.`)) {
                                    onDeleteTenant(org.id);
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition cursor-pointer border border-rose-200 flex items-center gap-1 text-[11px] font-bold"
                                title="Delete Organization Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Broadcast Announcement System */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Create Broadcast Message Form */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Send Broadcast Announcement</h3>
              <p className="text-[11px] text-slate-500">Messages will display in organization notification headers.</p>
            </div>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Target Audience</label>
              <select
                value={broadcastTarget}
                onChange={e => setBroadcastTarget(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">📢 All Registered Organizations ({tenants.length})</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>🏢 {t.name} ({t.ownerMobile})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Message Severity</label>
              <div className="grid grid-cols-3 gap-2">
                {(['info', 'warning', 'urgent'] as const).map(sev => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setBroadcastSeverity(sev)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer border ${
                      broadcastSeverity === sev
                        ? sev === 'urgent'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : sev === 'warning'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Announcement Subject Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Scheduled System Upgrade"
                value={broadcastTitle}
                onChange={e => setBroadcastTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Message Body / Reminder Text</label>
              <textarea
                required
                rows={3}
                placeholder="Type your message details or reminder here..."
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Send className="w-3.5 h-3.5 text-teal-400" /> Dispatch Announcement Broadcast
            </button>

            {broadcastSentSuccess && (
              <p className="text-xs text-emerald-600 font-bold text-center bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                ✓ Announcement broadcast sent successfully to organizations!
              </p>
            )}
          </form>
        </div>

        {/* Sent Announcements History List */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Active System Announcements</h3>
                <p className="text-[11px] text-slate-500">Live broadcasts currently visible in organization workspaces.</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              Count: {announcements.length}
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
            {announcements.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-xs font-medium">No active broadcasts. Create one on the left.</p>
              </div>
            ) : (
              announcements.map(ann => {
                const isAll = ann.targetTenantId === 'all';
                const targetOrg = tenants.find(t => t.id === ann.targetTenantId);
                return (
                  <div
                    key={ann.id}
                    className={`p-4 rounded-2xl border transition flex items-start justify-between gap-3 ${
                      ann.severity === 'urgent'
                        ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                        : ann.severity === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : 'bg-teal-50/70 border-teal-200 text-teal-950'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          ann.severity === 'urgent'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : ann.severity === 'warning'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-teal-600 text-white border-teal-600'
                        }`}>
                          {ann.severity}
                        </span>
                        
                        <span className="text-[10px] bg-white/80 border border-slate-200/80 font-bold text-slate-700 px-2 py-0.5 rounded-full">
                          Target: {isAll ? '📢 All Organizations' : `🏢 ${targetOrg?.name || ann.targetTenantId}`}
                        </span>

                        <span className="text-[10px] text-slate-500 font-mono">
                          {ann.createdAt}
                        </span>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 pt-0.5">{ann.title}</h4>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">{ann.message}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteAnnouncement(ann.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white/80 rounded-xl transition cursor-pointer shrink-0"
                      title="Remove Announcement Broadcast"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Register Organization Modal (Master Admin Only) */}
      {showRegisterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRegisterModal(false);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200 cursor-default space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold">Step {regStep}/2</span>
                <h3 className="font-bold text-slate-900 text-sm">
                  {regStep === 1 ? 'Register New SaaS Organization Workspace' : 'Setup Microsoft Authenticator 2FA'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {regStep === 1 ? (
              <form onSubmit={handleProceedTo2FASetup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Company / Organization Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Electronics Ltd"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Registered Owner Mobile Number</label>
                    <input
                      type="text"
                      required
                      placeholder="+91 9876543210"
                      value={regMobile}
                      onChange={e => setRegMobile(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Owner / Administrator Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={regOwner}
                      onChange={e => setRegOwner(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Set Master PIN Code</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="1234"
                      value={regPin}
                      onChange={e => setRegPin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 text-xs text-slate-600 font-bold hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <QrCode className="w-4 h-4" /> Next: Setup Microsoft Authenticator 2FA →
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <MicrosoftAuthQR
                  orgName={regName}
                  ownerMobile={regMobile}
                  secretKey={regSecretKey}
                  title="Scan QR Code with Microsoft Authenticator"
                  subtitle="Scan this QR code using Microsoft Authenticator app on mobile phone before handing access credentials to the client."
                />

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="px-3 py-1.5 text-xs text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    ← Back to Details
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalizeRegistration}
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Finalize Registration & View Share Credentials
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share Access Credentials Modal */}
      {selectedShareOrg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedShareOrg(null);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg p-6 overflow-hidden animate-in zoom-in-95 duration-200 cursor-default space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-100 text-teal-800 rounded-xl">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Organization Access Passcard</h3>
                  <p className="text-[11px] text-slate-500">Share these access details with organization administrator.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShareOrg(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-teal-400 uppercase text-[10px] tracking-wider">SaaS Workspace Credentials</span>
                <span className="bg-teal-500/20 text-teal-300 text-[10px] px-2 py-0.5 rounded-full">
                  {selectedShareOrg.code}
                </span>
              </div>

              <div className="space-y-1.5 text-slate-200">
                <p>🏢 Organization: <strong className="text-white font-sans">{selectedShareOrg.name}</strong></p>
                <p>📱 Owner Mobile: <strong className="text-teal-300">{selectedShareOrg.ownerMobile}</strong></p>
                <p>👤 Owner Name: <strong className="text-slate-100 font-sans">{selectedShareOrg.ownerName || 'Admin'}</strong></p>
                <div className="flex items-center justify-between bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <div className="space-y-0.5">
                    <p>🔑 Master PIN: <strong className="text-teal-300">{showSensitiveKeys ? selectedShareOrg.pin : '••••••••'}</strong></p>
                    <p>🔐 2FA Secret Key: <strong className="text-amber-300">{showSensitiveKeys ? (selectedShareOrg.secretKey || 'Standard TOTP') : '••••••••••••••••'}</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSensitiveKeys(!showSensitiveKeys)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition border border-slate-700"
                  >
                    {showSensitiveKeys ? '🔒 Hide Keys' : '👁️ Reveal Keys'}
                  </button>
                </div>
              </div>
            </div>

            {/* Microsoft QR preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <MicrosoftAuthQR
                orgName={selectedShareOrg.name}
                ownerMobile={selectedShareOrg.ownerMobile}
                secretKey={selectedShareOrg.secretKey}
                title="Microsoft Authenticator QR Code"
                subtitle="The owner can scan this code in Microsoft Authenticator app."
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleCopyAccessDetails(selectedShareOrg)}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                  copiedCreds
                    ? 'bg-emerald-600 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                }`}
              >
                {copiedCreds ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCreds ? 'Copied Access Passcard!' : 'Copy Access Credentials'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedShareOrg(null)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Organization Modal */}
      {editingOrg && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={() => setEditingOrg(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Building className="w-4 h-4 text-teal-400" /> Edit Organization Details
                </h3>
                <p className="text-[11px] text-slate-400">Update organization info, owner mobile, PIN & 2FA keys</p>
              </div>
              <button onClick={() => setEditingOrg(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOrg} className="p-5 text-xs space-y-3">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Org Code *</label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Access PIN *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Owner Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Owner Mobile *</label>
                  <input
                    type="text"
                    required
                    value={editOwnerMobile}
                    onChange={(e) => setEditOwnerMobile(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">2FA Secret Key (Authenticator)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editSecretKey}
                    onChange={(e) => setEditSecretKey(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setEditSecretKey(generateBase32Secret())}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    Regenerate 2FA
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'deactivated')}
                  disabled={editingOrg.id === 'org-admin'}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  <option value="active">Active Access</option>
                  <option value="deactivated">Account Deactivated</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer"
                >
                  Update Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
