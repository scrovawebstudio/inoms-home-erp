import React, { useState } from 'react';
import MicrosoftAuthQR, { generateBase32Secret } from './MicrosoftAuthQR';
import { TenantOrg, SystemAnnouncement, getTenantFeatures, TenantFeatures } from './AuthModal';
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
  Edit,
  Receipt,
  Tag,
  Sparkles,
  Layers,
  Clock,
  AlertCircle
} from 'lucide-react';
import { AddonPricingConfig, MasterAdminInvoice, DEFAULT_ADDON_PRICING } from '../types';
import MasterAdminPricing from './MasterAdminPricing';
import MasterAdminBilling from './MasterAdminBilling';

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
  onNavigateToSaasBilling?: (tenantId?: string) => void;
  onNavigateToPricing?: () => void;
  pricingConfig?: AddonPricingConfig;
  onSavePricing?: (config: AddonPricingConfig) => void;
  saasInvoices?: MasterAdminInvoice[];
  onAddSaasInvoice?: (inv: MasterAdminInvoice) => void;
  onUpdateSaasInvoice?: (inv: MasterAdminInvoice) => void;
  onDeleteSaasInvoice?: (id: string) => void;
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
  revenueByTenant = {},
  onNavigateToSaasBilling,
  onNavigateToPricing,
  pricingConfig: propPricingConfig,
  onSavePricing: propOnSavePricing,
  saasInvoices: propSaasInvoices,
  onAddSaasInvoice: propOnAddSaasInvoice,
  onUpdateSaasInvoice: propOnUpdateSaasInvoice,
  onDeleteSaasInvoice: propOnDeleteSaasInvoice
}: MasterAdminDashboardProps) {
  // Navigation Tabs: Accounts / Price Set / SaaS Billing
  const [masterTab, setMasterTab] = useState<'accounts' | 'pricing' | 'billing'>('accounts');
  const [preSelectedBillingTenantId, setPreSelectedBillingTenantId] = useState<string | null>(null);

  // Add-on Pricing Configuration State
  const [localPricingConfig, setLocalPricingConfig] = useState<AddonPricingConfig>(() => {
    try {
      const saved = localStorage.getItem('master_admin_addon_pricing_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ADDON_PRICING;
  });

  const pricingConfig = propPricingConfig || localPricingConfig;

  const handleSavePricing = (newConfig: AddonPricingConfig) => {
    if (propOnSavePricing) {
      propOnSavePricing(newConfig);
    } else {
      setLocalPricingConfig(newConfig);
      try {
        localStorage.setItem('master_admin_addon_pricing_v1', JSON.stringify(newConfig));
      } catch {}
    }
  };

  // Master Admin Generated SaaS Invoices State
  const [localSaasInvoices, setLocalSaasInvoices] = useState<MasterAdminInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('master_admin_saas_invoices_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'SAAS-1001',
        tenantId: 'org-1',
        tenantName: 'Dev Infotech',
        tenantCode: 'DEV-10',
        ownerMobile: '+91 9876543210',
        ownerName: 'Devendra Patel',
        date: '2026-07-01',
        dueDate: '2026-07-08',
        billingPeriod: 'Monthly',
        items: [
          { id: 'it-1', description: 'Core Enterprise ERP Platform License (Monthly)', addonKey: 'basePlatform', qty: 1, rate: 999, amount: 999 },
          { id: 'it-2', description: 'WhatsApp Automated Cloud Messaging Integration (1 Mo)', addonKey: 'whatsAppMessaging', qty: 1, rate: 499, amount: 499 },
          { id: 'it-3', description: 'Thermal Barcode & QR Code Tag Generation (1 Mo)', addonKey: 'barcodeQrTags', qty: 1, rate: 299, amount: 299 }
        ],
        subtotal: 1797,
        discount: 0,
        gstPercent: 18,
        gstAmount: 323,
        grandTotal: 2120,
        paymentStatus: 'Paid',
        paymentMode: 'UPI',
        notes: 'Monthly SaaS subscription active.',
        createdAt: '2026-07-01T10:00:00.000Z'
      }
    ];
  });

  const saasInvoices = propSaasInvoices || localSaasInvoices;

  const handleAddSaasInvoice = (inv: MasterAdminInvoice) => {
    if (propOnAddSaasInvoice) {
      propOnAddSaasInvoice(inv);
    } else {
      const next = [inv, ...localSaasInvoices];
      setLocalSaasInvoices(next);
      try {
        localStorage.setItem('master_admin_saas_invoices_v1', JSON.stringify(next));
      } catch {}
    }
  };

  const handleUpdateSaasInvoice = (inv: MasterAdminInvoice) => {
    if (propOnUpdateSaasInvoice) {
      propOnUpdateSaasInvoice(inv);
    } else {
      const next = localSaasInvoices.map(i => i.id === inv.id ? inv : i);
      setLocalSaasInvoices(next);
      try {
        localStorage.setItem('master_admin_saas_invoices_v1', JSON.stringify(next));
      } catch {}
    }
  };

  const handleDeleteSaasInvoice = (id: string) => {
    if (propOnDeleteSaasInvoice) {
      propOnDeleteSaasInvoice(id);
    } else {
      const next = localSaasInvoices.filter(i => i.id !== id);
      setLocalSaasInvoices(next);
      try {
        localStorage.setItem('master_admin_saas_invoices_v1', JSON.stringify(next));
      } catch {}
    }
  };

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
  const [regSubscriptionType, setRegSubscriptionType] = useState<'trial_7d' | 'monthly' | 'annual' | 'lifetime'>('trial_7d');

  // Edit Org Modal state
  const [editingOrg, setEditingOrg] = useState<TenantOrg | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [editOwnerName, setEditOwnerName] = useState<string>('');
  const [editOwnerMobile, setEditOwnerMobile] = useState<string>('');
  const [editPin, setEditPin] = useState<string>('1234');
  const [editSecretKey, setEditSecretKey] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'deactivated'>('active');
  const [editSubPlan, setEditSubPlan] = useState<'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime'>('monthly');
  const [editSubEndDate, setEditSubEndDate] = useState<string>('');

  // Modular Feature Add-ons State for Master Admin Control
  const [editAllowLiveQueue, setEditAllowLiveQueue] = useState<boolean>(true);
  const [editAllowHomeServerSync, setEditAllowHomeServerSync] = useState<boolean>(true);
  const [editAllowBarcodeQrTags, setEditAllowBarcodeQrTags] = useState<boolean>(true);
  const [editAllowTechnicianAccounts, setEditAllowTechnicianAccounts] = useState<boolean>(true);
  const [editAllowOutwardTaxInvoiceButton, setEditAllowOutwardTaxInvoiceButton] = useState<boolean>(true);
  const [editAllowedModules, setEditAllowedModules] = useState<string[]>([
    'dashboard', 'live_queue', 'inwards', 'outwards', 'billing', 'payments', 'inventory', 'expenses', 'reports', 'settings'
  ]);

  const handleOpenEditModal = (org: TenantOrg) => {
    setEditingOrg(org);
    setEditName(org.name);
    setEditCode(org.code);
    setEditOwnerName(org.ownerName || '');
    setEditOwnerMobile(org.ownerMobile);
    setEditPin(org.pin);
    setEditSecretKey(org.secretKey || '');
    setEditStatus(org.status);
    setEditSubPlan(org.subscriptionPlan || (org.isTrial ? 'trial' : 'monthly'));
    
    // Default or existing subscription end date
    if (org.subscriptionEndDate) {
      setEditSubEndDate(org.subscriptionEndDate.split('T')[0]);
    } else {
      const d = new Date();
      d.setDate(d.getDate() + (org.isTrial ? 7 : 30));
      setEditSubEndDate(d.toISOString().split('T')[0]);
    }

    const f = getTenantFeatures(org);
    setEditAllowLiveQueue(f.allowLiveQueue);
    setEditAllowHomeServerSync(f.allowHomeServerSync);
    setEditAllowBarcodeQrTags(f.allowBarcodeQrTags);
    setEditAllowTechnicianAccounts(f.allowTechnicianAccounts);
    setEditAllowOutwardTaxInvoiceButton(f.allowOutwardTaxInvoiceButton);
    setEditAllowedModules(f.allowedModules);
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
      status: editStatus,
      subscriptionPlan: editSubPlan,
      subscriptionEndDate: editSubEndDate,
      isTrial: editSubPlan === 'trial',
      features: {
        allowLiveQueue: editAllowLiveQueue,
        allowHomeServerSync: editAllowHomeServerSync,
        allowBarcodeQrTags: editAllowBarcodeQrTags,
        allowWhatsAppMessaging: true, // Always allowed for all organizations
        allowTechnicianAccounts: editAllowTechnicianAccounts,
        allowOutwardTaxInvoiceButton: editAllowOutwardTaxInvoiceButton,
        allowedModules: editAllowedModules
      }
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
    
    // Calculate subscription dates based on selected trial/plan
    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now);
    
    let trialDays = 0;
    let isTrial = false;
    let subscriptionPlan: 'trial' | 'monthly' | 'quarterly' | 'annual' | 'lifetime' = 'monthly';

    if (regSubscriptionType === 'trial_7d') {
      trialDays = 7;
      isTrial = true;
      subscriptionPlan = 'trial';
      endDate.setDate(endDate.getDate() + 7);
    } else if (regSubscriptionType === 'annual') {
      subscriptionPlan = 'annual';
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else if (regSubscriptionType === 'lifetime') {
      subscriptionPlan = 'lifetime';
      endDate.setFullYear(endDate.getFullYear() + 10);
    } else {
      subscriptionPlan = 'monthly';
      endDate.setDate(endDate.getDate() + 30);
    }

    const newOrg: TenantOrg = {
      id: `org-${Date.now()}`,
      name: regName,
      code: `${regName.substring(0, 4).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`,
      pin: regPin || '1234',
      ownerMobile: regMobile,
      ownerName: regOwner || 'Org Administrator',
      status: 'active',
      createdAt: startDate,
      secretKey: regSecretKey,
      subscriptionPlan,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate.toISOString().split('T')[0],
      trialDays,
      isTrial,
      features: {
        allowLiveQueue: true,
        allowHomeServerSync: true,
        allowBarcodeQrTags: true,
        allowWhatsAppMessaging: true,
        allowTechnicianAccounts: true,
        allowOutwardTaxInvoiceButton: true,
        allowedModules: [
          'dashboard', 'live_queue', 'inwards', 'outwards', 'billing', 'payments', 'inventory', 'expenses', 'reports', 'settings'
        ]
      }
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
🔑 PIN: ${org.pin}
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

      {/* Top Sub-Navigation Tabs */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl gap-2 text-xs font-bold w-fit shadow-inner">
        <button
          type="button"
          onClick={() => setMasterTab('accounts')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition cursor-pointer ${
            masterTab === 'accounts'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4 text-teal-600" />
          <span>Organizations & Workspaces</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full border border-slate-200">
            {tenants.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMasterTab('pricing')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition cursor-pointer ${
            masterTab === 'pricing'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tag className="w-4 h-4 text-teal-600" />
          <span>Add-on Price Set</span>
          <span className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded-full border border-teal-200">
            Rates Matrix
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMasterTab('billing')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition cursor-pointer ${
            masterTab === 'billing'
              ? 'bg-white text-slate-900 shadow-sm font-extrabold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4 text-teal-600" />
          <span>SaaS Bill Generation & Invoices</span>
          <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
            {saasInvoices.length} Bills
          </span>
        </button>
      </div>

      {/* Tab 1: Organizations & Workspaces */}
      {masterTab === 'accounts' && (
        <>
          {/* Overview Stat Cards with Subscription Health */}
          {(() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const expiringSoonOrExpired = tenants.filter(t => {
              if (t.id === 'org-admin' || t.code?.toUpperCase() === 'ADMIN-00' || t.ownerMobile?.includes('8149862034')) return false;
              if (!t.subscriptionEndDate) return false;
              const end = new Date(t.subscriptionEndDate);
              end.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return diffDays <= 7; // Expired or expiring within 7 days
            });

            const expiredCount = expiringSoonOrExpired.filter(t => {
              const end = new Date(t.subscriptionEndDate!);
              end.setHours(0, 0, 0, 0);
              return end.getTime() < today.getTime();
            }).length;

            const trialsCount = tenants.filter(t => t.isTrial || t.subscriptionPlan === 'trial').length;

            return (
              <div className="space-y-4">
                {/* Expiring / Expired Subscription Alert Bar if any */}
                {expiringSoonOrExpired.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-rose-600 p-4 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                        <AlertCircle className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm flex items-center gap-2">
                          <span>Subscription Expiry Alert</span>
                          <span className="bg-white/30 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                            {expiringSoonOrExpired.length} {expiringSoonOrExpired.length === 1 ? 'Org' : 'Orgs'} Requiring Attention
                          </span>
                        </h4>
                        <p className="text-xs text-white/90">
                          {expiredCount > 0 
                            ? `${expiredCount} organization subscription(s) have expired! Review access or renew their plans.` 
                            : `${expiringSoonOrExpired.length} organization subscription(s) / 7-day trials are expiring within 7 days.`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {expiringSoonOrExpired.slice(0, 3).map(org => {
                        const end = new Date(org.subscriptionEndDate!);
                        end.setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        const isExpired = diffDays < 0;

                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => handleOpenEditModal(org)}
                            className="bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-xl text-white font-bold flex items-center gap-1.5 transition cursor-pointer border border-white/30"
                          >
                            <span>{org.name}:</span>
                            <span className={isExpired ? 'underline decoration-rose-300 font-extrabold' : 'font-extrabold'}>
                              {isExpired ? `Expired (${Math.abs(diffDays)}d ago)` : diffDays === 0 ? 'Expires Today' : `${diffDays}d left`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">7-Day Free Trials</p>
                      <h3 className="text-2xl font-black text-teal-600 mt-1">{trialsCount}</h3>
                      <p className="text-[10px] text-teal-600 font-semibold mt-0.5">Active Trial Evaluation</p>
                    </div>
                    <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl">
                      <Sparkles className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Expiring / Expired</p>
                      <h3 className={`text-2xl font-black mt-1 ${expiringSoonOrExpired.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {expiringSoonOrExpired.length}
                      </h3>
                      <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                        {expiredCount > 0 ? `${expiredCount} Expired` : 'Expiring within 7d'}
                      </p>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

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
                <th className="p-4 whitespace-nowrap">Plan & Expiry</th>
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

                  // Subscription calculation
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  let subBadge = null;

                  if (isMasterAdmin) {
                    subBadge = (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200">
                        ♾️ Lifetime System
                      </span>
                    );
                  } else if (org.subscriptionEndDate) {
                    const end = new Date(org.subscriptionEndDate);
                    end.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = diffDays < 0;
                    const isTrial = org.isTrial || org.subscriptionPlan === 'trial';

                    if (isExpired) {
                      subBadge = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-600" /> Expired ({Math.abs(diffDays)}d ago)
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">{org.subscriptionEndDate.split('T')[0]}</span>
                        </div>
                      );
                    } else if (diffDays <= 7) {
                      subBadge = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-700" /> {diffDays === 0 ? 'Expires Today' : `${diffDays} days left`} {isTrial ? '(Trial)' : ''}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">{org.subscriptionEndDate.split('T')[0]}</span>
                        </div>
                      );
                    } else {
                      subBadge = (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-200">
                            {isTrial ? '🎁 7-Day Trial' : org.subscriptionPlan ? `⭐ ${org.subscriptionPlan.toUpperCase()}` : 'Active Plan'} ({diffDays}d)
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">Until {org.subscriptionEndDate.split('T')[0]}</span>
                        </div>
                      );
                    }
                  } else {
                    subBadge = (
                      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-200">
                        {org.createdAt || 'Standard'}
                      </span>
                    );
                  }

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

                      <td className="p-4 whitespace-nowrap">
                        {subBadge}
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
                          
                          {/* Generate SaaS Bill */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToSaasBilling) {
                                onNavigateToSaasBilling(org.id);
                              } else {
                                setPreSelectedBillingTenantId(org.id);
                                setMasterTab('billing');
                              }
                            }}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 border border-emerald-200"
                            title="Generate SaaS Bill with Auto-filled Access Points"
                          >
                            <Receipt className="w-3.5 h-3.5 text-emerald-600" /> Bill
                          </button>

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
    </>
  )}

  {/* Tab 2: Add-on Price Set Matrix */}
  {masterTab === 'pricing' && (
    <MasterAdminPricing
      pricingConfig={pricingConfig}
      onSavePricing={handleSavePricing}
    />
  )}

  {/* Tab 3: SaaS Bill Generation & Invoices */}
  {masterTab === 'billing' && (
    <MasterAdminBilling
      tenants={tenants}
      pricingConfig={pricingConfig}
      invoices={saasInvoices}
      onAddInvoice={handleAddSaasInvoice}
      onUpdateInvoice={handleUpdateSaasInvoice}
      onDeleteInvoice={handleDeleteSaasInvoice}
      preSelectedTenantId={preSelectedBillingTenantId}
      onClearPreSelectedTenant={() => setPreSelectedBillingTenantId(null)}
    />
  )}

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
                    <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Organization Login PIN *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="e.g. 1234"
                      value={regPin}
                      onChange={e => setRegPin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Specific login PIN for this organization</p>
                  </div>
                </div>

                {/* Subscription & 7-Day Free Trial Choice */}
                <div className="bg-teal-50/60 border border-teal-200/80 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-teal-900 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" /> Subscription Plan / Free Trial Setup
                    </span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                      7-Day Trial Default
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-semibold">
                    <label className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                      regSubscriptionType === 'trial_7d' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="regSubType"
                        value="trial_7d"
                        checked={regSubscriptionType === 'trial_7d'}
                        onChange={() => setRegSubscriptionType('trial_7d')}
                        className="hidden"
                      />
                      <span className="font-extrabold text-[11px]">🎁 7-Day Trial</span>
                      <span className="text-[9px] opacity-80">Free Evaluation</span>
                    </label>

                    <label className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                      regSubscriptionType === 'monthly' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="regSubType"
                        value="monthly"
                        checked={regSubscriptionType === 'monthly'}
                        onChange={() => setRegSubscriptionType('monthly')}
                        className="hidden"
                      />
                      <span className="font-extrabold text-[11px]">📅 1 Month</span>
                      <span className="text-[9px] opacity-80">30 Days Access</span>
                    </label>

                    <label className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                      regSubscriptionType === 'annual' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="regSubType"
                        value="annual"
                        checked={regSubscriptionType === 'annual'}
                        onChange={() => setRegSubscriptionType('annual')}
                        className="hidden"
                      />
                      <span className="font-extrabold text-[11px]">⭐ 1 Year</span>
                      <span className="text-[9px] opacity-80">365 Days Access</span>
                    </label>

                    <label className={`p-2.5 rounded-xl border cursor-pointer transition flex flex-col items-center text-center gap-1 ${
                      regSubscriptionType === 'lifetime' ? 'bg-teal-600 text-white border-teal-700 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}>
                      <input
                        type="radio"
                        name="regSubType"
                        value="lifetime"
                        checked={regSubscriptionType === 'lifetime'}
                        onChange={() => setRegSubscriptionType('lifetime')}
                        className="hidden"
                      />
                      <span className="font-extrabold text-[11px]">♾️ Lifetime</span>
                      <span className="text-[9px] opacity-80">Permanent Plan</span>
                    </label>
                  </div>
                  <p className="text-[10px] text-teal-800/80 font-medium">
                    {regSubscriptionType === 'trial_7d' ? 'Organization will get full access for 7 days. Master Admin dashboard will alert when trial is expiring or expired.' : 'Subscription will be monitored on the Master Admin dashboard.'}
                  </p>
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
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto animate-slide-up cursor-default"
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

              {/* Subscription Plan & Duration Management */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-200">
                  <h4 className="font-extrabold text-xs text-teal-900 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <Clock className="w-4 h-4 text-teal-700" /> Subscription Plan & Expiry Monitoring
                  </h4>
                  <p className="text-[11px] text-teal-700">
                    Configure client subscription cycle, free trial status, and expiry date.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Plan Type</label>
                    <select
                      value={editSubPlan}
                      onChange={(e) => {
                        const nextPlan = e.target.value as any;
                        setEditSubPlan(nextPlan);
                        const d = new Date();
                        if (nextPlan === 'trial') d.setDate(d.getDate() + 7);
                        else if (nextPlan === 'monthly') d.setDate(d.getDate() + 30);
                        else if (nextPlan === 'quarterly') d.setDate(d.getDate() + 90);
                        else if (nextPlan === 'annual') d.setFullYear(d.getFullYear() + 1);
                        else if (nextPlan === 'lifetime') d.setFullYear(d.getFullYear() + 10);
                        setEditSubEndDate(d.toISOString().split('T')[0]);
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      <option value="trial">🎁 7-Day Free Trial</option>
                      <option value="monthly">📅 Monthly (30 Days)</option>
                      <option value="quarterly">📊 Quarterly (90 Days)</option>
                      <option value="annual">⭐ Annual (365 Days)</option>
                      <option value="lifetime">♾️ Lifetime License</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Subscription Expiry Date</label>
                    <input
                      type="date"
                      value={editSubEndDate}
                      onChange={(e) => setEditSubEndDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Master Admin Feature Access & Add-ons Control Section */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-teal-600" /> Organization Plan Feature Add-ons
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Master Admin controls for activating or disabling paid add-on features and services for this client organization.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Live Queue & Workbench Add-on Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">⚡ Live Repair Queue & Visual Workbench</span>
                      <span className="text-[10px] text-slate-500 block">Kanban board live repair status sync and technician ticket workflows</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowLiveQueue}
                      onChange={(e) => setEditAllowLiveQueue(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Home Server Sync Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">🌐 Home Server DB Data Sync</span>
                      <span className="text-[10px] text-slate-500 block">Sync job cards, invoices, and ledgers with central Home Server DB</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowHomeServerSync}
                      onChange={(e) => setEditAllowHomeServerSync(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Barcode & QR Tags Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">🏷️ Barcode & QR Tag Sheet Printing</span>
                      <span className="text-[10px] text-slate-500 block">Enable printing job card sticker tag sheets with barcodes & QR codes</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowBarcodeQrTags}
                      onChange={(e) => setEditAllowBarcodeQrTags(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Technician Accounts Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">👥 Technician / Staff Sub-accounts</span>
                      <span className="text-[10px] text-slate-500 block">Allow organization to add and manage technician logins</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowTechnicianAccounts}
                      onChange={(e) => setEditAllowTechnicianAccounts(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>

                  {/* Outward Tax Invoice Button Toggle */}
                  <label className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer">
                    <div className="pr-2">
                      <span className="font-bold text-slate-800 block">🧾 Outward Tax Invoice Generation ($ Button)</span>
                      <span className="text-[10px] text-slate-500 block">Show green Tax Invoice button on Outward job cards</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={editAllowOutwardTaxInvoiceButton}
                      onChange={(e) => setEditAllowOutwardTaxInvoiceButton(e.target.checked)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Enabled Navigation Modules Section */}
                <div className="pt-2">
                  <label className="block font-extrabold text-slate-700 uppercase text-[11px] mb-1">
                    Enabled Navigation Modules for Organization
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">Uncheck modules that are not included in this organization's subscription plan.</p>
                  
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                    {[
                      { id: 'dashboard', label: '📊 Dashboard' },
                      { id: 'live_queue', label: '⚡ Live Queue & Bench' },
                      { id: 'inwards', label: '📥 Inward Jobs' },
                      { id: 'outwards', label: '📤 Outward Jobs' },
                      { id: 'billing', label: '📄 Billing & Invoices' },
                      { id: 'payments', label: '💳 Payments & Cashbook' },
                      { id: 'inventory', label: '📦 Inventory & Stock' },
                      { id: 'expenses', label: '💸 Expenses' },
                      { id: 'reports', label: '📈 Reports & Analytics' },
                      { id: 'settings', label: '⚙️ System Settings' },
                    ].map((mod) => {
                      const isChecked = editAllowedModules.includes(mod.id);
                      return (
                        <label key={mod.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditAllowedModules([...editAllowedModules, mod.id]);
                              } else {
                                setEditAllowedModules(editAllowedModules.filter((m) => m !== mod.id));
                              }
                            }}
                            className="w-3.5 h-3.5 text-teal-600 rounded cursor-pointer"
                          />
                          <span>{mod.label}</span>
                        </label>
                      );
                    })}
                  </div>
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
