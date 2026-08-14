import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  Sparkles,
  QrCode,
  Wifi,
  Receipt,
  Users,
  Layers,
  Tag
} from 'lucide-react';
import { AddonPricingConfig, CustomAddonPricingItem, DEFAULT_ADDON_PRICING } from '../types';

const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface MasterAdminPricingProps {
  pricingConfig: AddonPricingConfig;
  onSavePricing: (config: AddonPricingConfig) => void;
}

export default function MasterAdminPricing({
  pricingConfig,
  onSavePricing
}: MasterAdminPricingProps) {
  const [pricing, setPricing] = useState<AddonPricingConfig>(pricingConfig);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Custom Addon Form State
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newAddonName, setNewAddonName] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState<number>(199);
  const [newAddonDesc, setNewAddonDesc] = useState('');
  const [newAddonCycle, setNewAddonCycle] = useState<'monthly' | 'annual' | 'one-time'>('monthly');

  useEffect(() => {
    setPricing(pricingConfig);
  }, [pricingConfig]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePricing(pricing);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all add-on prices to standard default rates?')) {
      setPricing(DEFAULT_ADDON_PRICING);
      onSavePricing(DEFAULT_ADDON_PRICING);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleAddCustomAddon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddonName.trim()) return;

    const newItem: CustomAddonPricingItem = {
      id: `custom-${Date.now()}`,
      name: newAddonName.trim(),
      price: Number(newAddonPrice) || 0,
      description: newAddonDesc.trim(),
      billingCycle: newAddonCycle
    };

    const updated = {
      ...pricing,
      customAddons: [...(pricing.customAddons || []), newItem]
    };

    setPricing(updated);
    onSavePricing(updated);
    setNewAddonName('');
    setNewAddonPrice(199);
    setNewAddonDesc('');
    setShowAddCustom(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleDeleteCustomAddon = (id: string) => {
    const updated = {
      ...pricing,
      customAddons: (pricing.customAddons || []).filter(item => item.id !== id)
    };
    setPricing(updated);
    onSavePricing(updated);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Info */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-teal-600" />
            Add-on Price Set & Subscription Rate Configuration
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Set and save the standard pricing for base platform licenses and granular feature access points. 
            When generating a bill for an organization, these prices will auto-fill based on their enabled access points.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer border border-slate-200"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md transition cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Pricing Config
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>✓ Add-on pricing updated and saved successfully! Future SaaS bill generations will use these rates automatically.</span>
        </div>
      )}

      {/* Pricing Form */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Section 1: Base Platform Subscription Pricing */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Base Core Platform License Fee</h3>
              <p className="text-[11px] text-slate-500">Core ERP workspace access (Dashboard, Inwards, Outwards, Inventory, Ledger, Reports).</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Monthly Core Subscription</label>
                <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  Per Month
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Default recurring charge for monthly billing cycle.</p>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.basePlatformMonthly}
                  onChange={e => setPricing({ ...pricing, basePlatformMonthly: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Annual Core Subscription (Discounted)</label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Per Year
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Discounted annual core license charge.</p>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.basePlatformAnnual}
                  onChange={e => setPricing({ ...pricing, basePlatformAnnual: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Modular Access Point / Add-on Rates */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Feature Access Points & Add-on Pricing (₹/Month)</h3>
              <p className="text-[11px] text-slate-500">
                These prices are loaded automatically into the bill generator whenever the corresponding access toggle is active for an organization.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* WhatsApp Messaging */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                      <WhatsAppIcon className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-slate-900">WhatsApp Messaging</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">/mo</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Direct client job receipt & tax invoice delivery via WhatsApp Web/API across Inwards, Outwards & Billing.
                </p>
              </div>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.whatsAppMessaging}
                  onChange={e => setPricing({ ...pricing, whatsAppMessaging: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Barcode & QR Code Tagging */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                      <QrCode className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-slate-900">Barcode & QR Tags</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">/mo</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Thermal barcode and 2D QR stickers for job tracking, shelf racks and physical device tagging.
                </p>
              </div>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.barcodeQrTags}
                  onChange={e => setPricing({ ...pricing, barcodeQrTags: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Home Server & LAN Sync */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                      <Wifi className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-slate-900">Home Server Sync</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">/mo</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  High-speed Local Network (LAN) & offline bridge syncing for zero-latency multi-counter operations.
                </p>
              </div>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.homeServerSync}
                  onChange={e => setPricing({ ...pricing, homeServerSync: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Multi-Technician Logins */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                      <Users className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-slate-900">Technician Logins</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">/mo</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Multi-seat staff & engineer sub-accounts with granular role permissions and audit activity logging.
                </p>
              </div>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.technicianAccounts}
                  onChange={e => setPricing({ ...pricing, technicianAccounts: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Outward Tax Invoice Generator */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-teal-100 text-teal-700 rounded-lg">
                      <Receipt className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-bold text-slate-900">Outward Tax Invoices</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500">/mo</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  1-Click GST tax invoice generation directly from the Outward job delivery slip.
                </p>
              </div>
              <div className="relative mt-2">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={pricing.outwardTaxInvoice}
                  onChange={e => setPricing({ ...pricing, outwardTaxInvoice: Number(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Section 3: Custom Add-on Items & Services */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Custom Add-on Services & Charges</h3>
                <p className="text-[11px] text-slate-500">Create additional custom billable items (e.g., Onsite Setup, Priority Support, Cloud Backup).</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustom(true)}
              className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer border border-indigo-200"
            >
              <Plus className="w-4 h-4" /> Add Custom Service
            </button>
          </div>

          {/* Custom Addons List */}
          {pricing.customAddons && pricing.customAddons.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pricing.customAddons.map(addon => (
                <div key={addon.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3">
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{addon.name}</span>
                    {addon.description && <span className="text-[10px] text-slate-500 block">{addon.description}</span>}
                    <span className="text-[10px] font-bold text-indigo-600 capitalize bg-indigo-50 px-2 py-0.5 rounded-md mt-1 inline-block">
                      {addon.billingCycle}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-slate-900 text-xs">₹{addon.price}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomAddon(addon.id)}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      title="Remove custom add-on"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-2xl">
              No custom add-on services configured yet. Click "Add Custom Service" above to create one.
            </p>
          )}

          {/* Modal / Inline form for Add Custom Addon */}
          {showAddCustom && (
            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200 space-y-3">
              <h4 className="font-bold text-indigo-900 text-xs">Add New Billable Add-on Service</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Service Name (e.g. 24x7 Priority Support)"
                  value={newAddonName}
                  onChange={e => setNewAddonName(e.target.value)}
                  className="bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Rate Amount"
                    value={newAddonPrice}
                    onChange={e => setNewAddonPrice(Number(e.target.value) || 0)}
                    className="w-full bg-white border border-indigo-200 rounded-xl pl-8 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={newAddonCycle}
                  onChange={e => setNewAddonCycle(e.target.value as any)}
                  className="bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="monthly">Monthly Recurring</option>
                  <option value="annual">Annual Recurring</option>
                  <option value="one-time">One-Time Setup Fee</option>
                </select>
              </div>
              <input
                type="text"
                placeholder="Optional description or coverage details"
                value={newAddonDesc}
                onChange={e => setNewAddonDesc(e.target.value)}
                className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustom(false)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomAddon}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
                >
                  Save Add-on
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save button banner */}
        <div className="flex items-center justify-between bg-slate-900 text-white p-5 rounded-3xl shadow-lg">
          <div>
            <h4 className="font-bold text-sm">Save Standard Add-on Price Matrix</h4>
            <p className="text-[11px] text-slate-400">All prices saved here will be pre-filled automatically in SaaS bill generation.</p>
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs px-6 py-3 rounded-2xl shadow-md transition cursor-pointer shrink-0"
          >
            <Save className="w-4 h-4" /> Save & Apply Pricing
          </button>
        </div>

      </form>
    </div>
  );
}
