import React from 'react';
import {
  Lock,
  X,
  CheckCircle2,
  Sparkles,
  Zap,
  PhoneCall,
  ShieldAlert,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export type AddonType =
  | 'whatsapp'
  | 'barcode_qr'
  | 'outward_invoice'
  | 'technician_accounts'
  | 'homeserver_sync'
  | 'custom';

interface LockedAddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  addonType: AddonType;
  customTitle?: string;
  customDescription?: string;
  orgName?: string;
  orgCode?: string;
}

const ADDON_DETAILS: Record<
  AddonType,
  {
    title: string;
    icon: string;
    tagline: string;
    benefits: string[];
    priceHint: string;
    efficiencyGain: string;
  }
> = {
  whatsapp: {
    title: 'WhatsApp 1-Click Automated Messaging',
    icon: '💬',
    tagline: 'Instant customer communication & digital receipts directly on WhatsApp',
    benefits: [
      '1-Click Job intake confirmation & status update alerts',
      'Instant repair completion & pickup reminder notifications',
      'Direct PDF Invoice and delivery slip dispatch to client mobile',
      'Zero manual typing - auto-formats with job numbers and client details'
    ],
    priceHint: '₹499 / month',
    efficiencyGain: 'Saves 3+ hours daily in manual customer phone calls & status inquiries'
  },
  barcode_qr: {
    title: 'Barcode & QR Device Tag Sheet Printing',
    icon: '🏷️',
    tagline: 'High-speed device tracking tags and sticker sheet generation',
    benefits: [
      'Generate instant QR & Barcode tracking stickers for every laptop/mobile',
      'Print A4 sticker grid sheets with customer name, serial number & job ID',
      'Scan to instantly open diagnostic cards with barcode scanner guns or cameras',
      'Eliminates lost parts, mixed-up devices, and misidentified repair items'
    ],
    priceHint: '₹299 / month',
    efficiencyGain: '100% error-free device identification across workshop technicians'
  },
  outward_invoice: {
    title: 'Outward 1-Click Tax Invoice Generation',
    icon: '🧾',
    tagline: 'Directly convert completed repair jobs into full GST Tax Invoices',
    benefits: [
      'Convert Outward delivery jobs into official GST Tax Invoices in 1-click',
      'Auto-carries replacement parts, service charges, advance payments & balance',
      'Synchronizes directly with client ledgers and outstanding payment balances',
      'Custom invoice prefixes, terms & conditions, and authorized signature stamp'
    ],
    priceHint: '₹199 / month',
    efficiencyGain: 'Zero double entry - cuts billing turnaround time to under 10 seconds'
  },
  technician_accounts: {
    title: 'Multi-Technician & Staff Sub-Accounts',
    icon: '👥',
    tagline: 'Granular access control and individual engineer login profiles',
    benefits: [
      'Create unlimited technician & front-desk staff login profiles',
      'Granular permissions: Restrict accounts, edit rights, reports or setup',
      'Technician-specific job assignment, daily productivity tracking & audit logs',
      'Dedicated Staff & Technician login portal with individual PIN & credentials'
    ],
    priceHint: '₹399 / month',
    efficiencyGain: 'Secures your financial records while empowering engineers to work independently'
  },
  homeserver_sync: {
    title: 'Central Cloud & Home Server Database Sync',
    icon: '🔄',
    tagline: 'Real-time multi-branch and offline local server backup replication',
    benefits: [
      'Bi-directional synchronization between local shop server and cloud database',
      'Offline-first resilience: Continue logging repairs during internet downtime',
      'Automated nightly JSON & SQL database backups with instant restore point',
      'Centralized multi-workshop branch visibility for business owners'
    ],
    priceHint: '₹499 / month',
    efficiencyGain: 'Guarantees zero data loss and flawless continuity during network outages'
  },
  custom: {
    title: 'Premium ERP Feature Add-on',
    icon: '✨',
    tagline: 'Unlock enhanced workflow automation for your organization',
    benefits: [
      'Extended capabilities designed to supercharge repair turnaround',
      'Seamless integration with your existing workshop data',
      'Priority Master Admin customer support and onboarding'
    ],
    priceHint: 'Custom Plan',
    efficiencyGain: 'Maximize workshop efficiency and client satisfaction'
  }
};

export default function LockedAddonModal({
  isOpen,
  onClose,
  addonType,
  customTitle,
  customDescription,
  orgName = 'Your Organization',
  orgCode = 'ORG-01'
}: LockedAddonModalProps) {
  if (!isOpen) return null;

  const info = ADDON_DETAILS[addonType] || ADDON_DETAILS.custom;
  const displayTitle = customTitle || info.title;
  const displayTagline = customDescription || info.tagline;

  const masterAdminMobile = '8149862034';
  const whatsappRequestText = encodeURIComponent(
    `Hello Master Admin,\n\nI want to activate the *${displayTitle}* add-on for my organization:\n🏢 *${orgName}* (Code: ${orgCode})\n\nPlease share the activation steps, pricing, and subscription invoice.`
  );
  const whatsappUrl = `https://wa.me/91${masterAdminMobile}?text=${whatsappRequestText}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md cursor-pointer animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 cursor-default flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Lock className="w-3 h-3" /> Add-on Feature Locked
            </span>
            <span className="text-[10px] text-teal-300 font-mono font-bold bg-teal-500/20 px-2 py-0.5 rounded-full">
              {info.priceHint}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-3xl p-2.5 bg-white/10 rounded-2xl shrink-0 backdrop-blur-xs">
              {info.icon}
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white leading-tight">
                {displayTitle}
              </h2>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {displayTagline}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Efficiency Banner */}
          <div className="bg-teal-50/80 border border-teal-200/80 p-3.5 rounded-2xl flex items-center gap-3">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-xl shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-teal-950 text-xs">Work Efficiency Impact</p>
              <p className="text-[11px] text-teal-800 font-medium">{info.efficiencyGain}</p>
            </div>
          </div>

          {/* Key Capabilities / Benefits */}
          <div>
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
              What you get with this Add-on:
            </h4>
            <div className="space-y-2">
              {info.benefits.map((b, idx) => (
                <div key={idx} className="flex items-start gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{b}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Organization Activation Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-slate-600 font-bold border-b border-slate-200 pb-1">
              <span>Organization:</span>
              <span className="text-slate-900 font-sans">{orgName}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Workspace Code:</span>
              <span className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded font-bold">{orgCode}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Current Status:</span>
              <span className="text-amber-700 font-bold">Requires Plan Add-on Activation</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            Contact the Platform Master Admin to enable this add-on instantly for your workspace.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            Close
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Request Activation via WhatsApp</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      </div>
    </div>
  );
}
