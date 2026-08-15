import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Printer,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  Building,
  Calendar,
  DollarSign,
  Download,
  X,
  FileText,
  CreditCard,
  QrCode,
  Sparkles,
  Check,
  Search,
  Tag
} from 'lucide-react';
import { TenantOrg, getTenantFeatures } from './AuthModal';
import { AddonPricingConfig, MasterAdminInvoice, MasterAdminInvoiceItem } from '../types';

const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface MasterAdminBillingProps {
  tenants: TenantOrg[];
  pricingConfig: AddonPricingConfig;
  invoices: MasterAdminInvoice[];
  onAddInvoice: (inv: MasterAdminInvoice) => void;
  onUpdateInvoice: (inv: MasterAdminInvoice) => void;
  onDeleteInvoice: (id: string) => void;
  preSelectedTenantId?: string | null;
  onClearPreSelectedTenant?: () => void;
}

export default function MasterAdminBilling({
  tenants,
  pricingConfig,
  invoices,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  preSelectedTenantId,
  onClearPreSelectedTenant
}: MasterAdminBillingProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Paid' | 'Unpaid'>('all');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    preSelectedTenantId || (tenants.length > 0 ? tenants[0].id : '')
  );

  // Bill Generation Form State
  const [billingPeriod, setBillingPeriod] = useState<'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Annual' | 'One-Time'>('Monthly');
  const [invoiceDate, setInvoiceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [gstPercent, setGstPercent] = useState<number>(18);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid' | 'Partial'>('Unpaid');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('Thank you for subscribing to INOMS Enterprise SaaS. Contact +91 8149862034 for billing support.');

  // Form line items
  const [lineItems, setLineItems] = useState<{
    id: string;
    description: string;
    addonKey?: string;
    qty: number;
    rate: number;
    enabled: boolean;
  }[]>([]);

  // Preview Invoice State
  const [previewInvoice, setPreviewInvoice] = useState<MasterAdminInvoice | null>(null);

  // Auto-fill Line Items whenever Selected Tenant or Billing Period changes
  const populateLineItemsForTenant = (tenantId: string, period: typeof billingPeriod) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const features = getTenantFeatures(tenant);
    const months = period === 'Monthly' ? 1 : period === 'Quarterly' ? 3 : period === 'Half-Yearly' ? 6 : period === 'Annual' ? 12 : 1;

    const items: typeof lineItems = [];

    // 1. Base Platform Subscription Item
    const baseRate = period === 'Annual' 
      ? pricingConfig.basePlatformAnnual 
      : pricingConfig.basePlatformMonthly * (period === 'One-Time' ? 1 : months);

    items.push({
      id: 'item-base',
      description: `Core Enterprise ERP Platform License (${period})`,
      addonKey: 'basePlatform',
      qty: 1,
      rate: baseRate,
      enabled: true
    });

    // 2. WhatsApp Automated Messaging Add-on
    if (features.allowWhatsAppMessaging) {
      items.push({
        id: 'item-whatsapp',
        description: `WhatsApp Automated Cloud Messaging Integration (${months} Mo)`,
        addonKey: 'whatsAppMessaging',
        qty: months,
        rate: pricingConfig.whatsAppMessaging,
        enabled: true
      });
    }

    // 3. Barcode & QR Code Tagging Add-on
    if (features.allowBarcodeQrTags) {
      items.push({
        id: 'item-barcode-qr',
        description: `Thermal Barcode & QR Code Tag Generation (${months} Mo)`,
        addonKey: 'barcodeQrTags',
        qty: months,
        rate: pricingConfig.barcodeQrTags,
        enabled: true
      });
    }

    // 4. Home Server & LAN Sync Add-on
    if (features.allowHomeServerSync) {
      items.push({
        id: 'item-server-sync',
        description: `Real-time Home Server & LAN Sync Bridge (${months} Mo)`,
        addonKey: 'homeServerSync',
        qty: months,
        rate: pricingConfig.homeServerSync,
        enabled: true
      });
    }

    // 5. Multi-Technician & Staff User Logins Add-on
    if (features.allowTechnicianAccounts) {
      items.push({
        id: 'item-technician-logins',
        description: `Multi-Technician & Staff Sub-Account Permissions (${months} Mo)`,
        addonKey: 'technicianAccounts',
        qty: months,
        rate: pricingConfig.technicianAccounts,
        enabled: true
      });
    }

    // 6. Direct Outward Tax Invoice Generator
    if (features.allowOutwardTaxInvoiceButton) {
      items.push({
        id: 'item-outward-invoice',
        description: `Direct Outward Slip GST Tax Invoice Generator (${months} Mo)`,
        addonKey: 'outwardTaxInvoice',
        qty: months,
        rate: pricingConfig.outwardTaxInvoice,
        enabled: true
      });
    }

    setLineItems(items);
  };

  useEffect(() => {
    if (preSelectedTenantId) {
      setSelectedTenantId(preSelectedTenantId);
      populateLineItemsForTenant(preSelectedTenantId, billingPeriod);
      onClearPreSelectedTenant?.();
    } else if (selectedTenantId) {
      populateLineItemsForTenant(selectedTenantId, billingPeriod);
    }
  }, [preSelectedTenantId, selectedTenantId, billingPeriod, pricingConfig]);

  const handleToggleItem = (id: string) => {
    setLineItems(items => items.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
  };

  const handleUpdateItemRate = (id: string, rate: number) => {
    setLineItems(items => items.map(item => item.id === id ? { ...item, rate } : item));
  };

  const handleUpdateItemQty = (id: string, qty: number) => {
    setLineItems(items => items.map(item => item.id === id ? { ...item, qty } : item));
  };

  const handleUpdateItemDesc = (id: string, description: string) => {
    setLineItems(items => items.map(item => item.id === id ? { ...item, description } : item));
  };

  const handleAddCustomLine = () => {
    const newItem = {
      id: `item-custom-${Date.now()}`,
      description: 'Custom Service / Cloud Backup / Setup Fee',
      qty: 1,
      rate: 299,
      enabled: true
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleDeleteLineItem = (id: string) => {
    setLineItems(items => items.filter(item => item.id !== id));
  };

  // Calculations
  const activeItems = lineItems.filter(i => i.enabled);
  const subtotal = activeItems.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = Math.round((taxableAmount * gstPercent) / 100);
  const grandTotal = taxableAmount + gstAmount;

  const currentTenant = tenants.find(t => t.id === selectedTenantId) || tenants[0];

  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) {
      alert('Please select an organization.');
      return;
    }
    if (activeItems.length === 0) {
      alert('Please include at least one billable line item.');
      return;
    }

    const newInvoice: MasterAdminInvoice = {
      id: `SAAS-${Math.floor(1000 + Math.random() * 9000)}`,
      tenantId: currentTenant.id,
      tenantName: currentTenant.name,
      tenantCode: currentTenant.code,
      ownerMobile: currentTenant.ownerMobile,
      ownerName: currentTenant.ownerName || 'Org Admin',
      date: invoiceDate,
      dueDate: dueDate,
      billingPeriod: billingPeriod,
      items: activeItems.map(item => ({
        id: item.id,
        description: item.description,
        addonKey: item.addonKey,
        qty: item.qty,
        rate: item.rate,
        amount: item.qty * item.rate
      })),
      subtotal,
      discount: discountAmount,
      gstPercent,
      gstAmount,
      grandTotal,
      paymentStatus,
      paymentMode,
      notes: invoiceNotes,
      createdAt: new Date().toISOString()
    };

    onAddInvoice(newInvoice);
    setPreviewInvoice(newInvoice);
  };

  const handleSendWhatsApp = (inv: MasterAdminInvoice) => {
    const cleanMobile = inv.ownerMobile ? inv.ownerMobile.replace(/[^0-9]/g, '') : '';
    const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;

    let msg = `*INOMS Enterprise SaaS - Subscription Tax Invoice*\n\n`;
    msg += `Dear *${inv.ownerName}* (*${inv.tenantName}*),\n`;
    msg += `Please find your SaaS Platform Subscription & Add-on Invoice details:\n\n`;
    msg += `🧾 *Invoice No:* ${inv.id}\n`;
    msg += `📅 *Billing Date:* ${inv.date} (Due: ${inv.dueDate})\n`;
    msg += `⏳ *Period:* ${inv.billingPeriod}\n\n`;
    msg += `*Included Access Points & Add-ons:*\n`;
    inv.items.forEach((item, idx) => {
      msg += `${idx + 1}. ${item.description} - ₹${item.amount.toLocaleString('en-IN')}\n`;
    });
    if (inv.discount > 0) {
      msg += `🏷️ *Discount:* -₹${inv.discount.toLocaleString('en-IN')}\n`;
    }
    if (inv.gstAmount > 0) {
      msg += `🏛️ *GST (${inv.gstPercent}%):* ₹${inv.gstAmount.toLocaleString('en-IN')}\n`;
    }
    msg += `\n💰 *Grand Total Payable:* ₹${inv.grandTotal.toLocaleString('en-IN')}.00\n`;
    msg += `💳 *Payment Status:* ${inv.paymentStatus.toUpperCase()} (${inv.paymentMode || 'UPI'})\n\n`;
    msg += `📲 *Pay via UPI:* 8149862034@upi\n`;
    msg += `Thank you for partnering with INOMS Cloud Services!\n`;
    msg += `📞 Support: +91 8149862034`;

    const encoded = encodeURIComponent(msg);
    if (formattedMobile) {
      window.open(`https://wa.me/${formattedMobile}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  // Filtered Invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch =
      inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.tenantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.ownerMobile.includes(searchTerm) ||
      inv.tenantCode.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'Paid') return matchesSearch && inv.paymentStatus === 'Paid';
    if (statusFilter === 'Unpaid') return matchesSearch && inv.paymentStatus !== 'Paid';
    return matchesSearch;
  });

  return (
    <div className="space-y-8">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-4 sm:p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
              <Receipt className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">SaaS Bill Generation & Add-on Invoicing</h1>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Generate customized GST-compliant SaaS subscription bills based on each organization's enabled access points & configured add-on rates.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3">
          <div className="bg-white/10 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl border border-white/10 text-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 uppercase block">Total SaaS Revenue</span>
            <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
              ₹{invoices.reduce((s, i) => s + (i.paymentStatus === 'Paid' ? i.grandTotal : 0), 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-3 sm:px-4 py-2 rounded-2xl border border-white/10 text-center">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 uppercase block">Generated Bills</span>
            <span className="text-base sm:text-lg font-black text-teal-300 font-mono">{invoices.length}</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Bill Generator Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600 shrink-0" />
              Interactive SaaS Bill Builder
            </h2>
            <p className="text-xs text-slate-500">Select an organization to auto-populate all its active access points and add-on rates.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddCustomLine}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 transition cursor-pointer border border-teal-200"
            >
              <Plus className="w-3.5 h-3.5" /> Add Custom Line Item
            </button>
          </div>
        </div>

        <form onSubmit={handleGenerateInvoice} className="space-y-6">
          
          {/* Top Controls: Organization & Period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/70">
            
            {/* Org Selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Target Organization</label>
              <select
                value={selectedTenantId}
                onChange={e => setSelectedTenantId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>
                    🏢 {t.name} ({t.code}) - {t.ownerMobile}
                  </option>
                ))}
              </select>
            </div>

            {/* Billing Period */}
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Billing Cycle</label>
              <select
                value={billingPeriod}
                onChange={e => setBillingPeriod(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="Monthly">Monthly Cycle (1 Mo)</option>
                <option value="Quarterly">Quarterly Cycle (3 Mo)</option>
                <option value="Half-Yearly">Half-Yearly Cycle (6 Mo)</option>
                <option value="Annual">Annual Cycle (12 Mo - Discounted)</option>
                <option value="One-Time">One-Time License / Setup</option>
              </select>
            </div>

            {/* Invoice Date */}
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Billing Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Payment Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

          </div>

          {/* Line Items Container */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100/80 p-3 sm:px-4 sm:py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                Access Points & Billable Line Items ({lineItems.filter(i => i.enabled).length} Active)
              </span>
              <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 w-fit">
                Auto-checked from {currentTenant?.name}'s permissions
              </span>
            </div>

            {/* Mobile Line Items View (Phones) */}
            <div className="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
              {lineItems.map(item => {
                const amount = item.qty * item.rate;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition space-y-2.5 ${
                      item.enabled ? 'bg-white border-slate-200' : 'bg-slate-50/60 border-slate-100 opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={() => handleToggleItem(item.id)}
                          className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => handleUpdateItemDesc(item.id, e.target.value)}
                          className="w-full bg-transparent border-b border-slate-200 focus:border-teal-500 font-semibold text-slate-900 outline-none text-xs"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDeleteLineItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                        title="Remove line item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={e => handleUpdateItemQty(item.id, Number(e.target.value) || 1)}
                          className="w-14 text-center bg-white border border-slate-300 rounded-lg px-1.5 py-1 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Rate:</span>
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1 text-[10px] font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={item.rate}
                            onChange={e => handleUpdateItemRate(item.id, Number(e.target.value) || 0)}
                            className="w-full text-right bg-white border border-slate-300 rounded-lg pl-4 pr-1.5 py-1 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                          />
                        </div>
                      </div>

                      <div className="text-right font-mono font-bold text-teal-700 text-xs">
                        ₹{amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Line Items Table */}
            <div className="hidden sm:block divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                    <th className="p-3 w-12 text-center">Include</th>
                    <th className="p-3">Feature / Access Point Description</th>
                    <th className="p-3 w-24 text-center">Qty</th>
                    <th className="p-3 w-36 text-right">Rate (₹)</th>
                    <th className="p-3 w-36 text-right">Amount (₹)</th>
                    <th className="p-3 w-12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map(item => {
                    const amount = item.qty * item.rate;
                    return (
                      <tr key={item.id} className={`hover:bg-slate-50 transition ${!item.enabled ? 'opacity-40 bg-slate-50/50' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={() => handleToggleItem(item.id)}
                            className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={e => handleUpdateItemDesc(item.id, e.target.value)}
                            className="w-full bg-transparent border-b border-transparent focus:border-teal-500 font-semibold text-slate-900 outline-none text-xs"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => handleUpdateItemQty(item.id, Number(e.target.value) || 1)}
                            className="w-16 text-center bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <div className="relative inline-block w-28">
                            <span className="absolute left-2 top-1 text-[10px] font-bold text-slate-400">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={item.rate}
                              onChange={e => handleUpdateItemRate(item.id, Number(e.target.value) || 0)}
                              className="w-full text-right bg-white border border-slate-300 rounded-lg pl-5 pr-2 py-1 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900 text-xs">
                          ₹{amount.toLocaleString('en-IN')}.00
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteLineItem(item.id)}
                            className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Billing Settings & Live Calculation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            
            {/* Left: Notes, Payment Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Unpaid">⏳ Unpaid / Pending Invoice</option>
                    <option value="Paid">✓ Fully Paid</option>
                    <option value="Partial">⚠️ Partial Payment</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="UPI">UPI / QR Scan (Instant)</option>
                    <option value="Bank Transfer">NEFT / RTGS / IMPS Bank Transfer</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Invoice Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={invoiceNotes}
                  onChange={e => setInvoiceNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Additional terms, bank details, or support instructions..."
                />
              </div>
            </div>

            {/* Right: Calculation Matrix */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono font-bold text-slate-800">₹{subtotal.toLocaleString('en-IN')}.00</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  Special Discount:
                </span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1 text-[10px] font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                    className="w-full text-right bg-white border border-slate-300 rounded-lg pl-5 pr-2 py-1 text-xs font-bold text-rose-600 outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  GST Tax Rate:
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={gstPercent}
                    onChange={e => setGstPercent(Number(e.target.value) || 0)}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value={18}>18% GST (CGST 9% + SGST 9%)</option>
                    <option value={12}>12% GST</option>
                    <option value={5}>5% GST</option>
                    <option value={0}>0% (Tax Exempt / Non-GST)</option>
                  </select>
                  <span className="font-mono font-bold text-slate-800 w-20 text-right">
                    ₹{gstAmount.toLocaleString('en-IN')}.00
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-extrabold text-slate-900 block">Grand Total Payable</span>
                  <span className="text-[10px] text-slate-400 font-medium">All applicable platform taxes included</span>
                </div>
                <span className="text-xl font-black text-emerald-600 font-mono">
                  ₹{grandTotal.toLocaleString('en-IN')}.00
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs py-3 rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2 mt-3"
              >
                <Receipt className="w-4 h-4" /> Generate Official SaaS Bill & Invoice
              </button>
            </div>

          </div>

        </form>
      </div>

      {/* Generated Invoices Ledger Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Table Header Filter */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-600" />
              Generated Master Admin SaaS Invoices Ledger
              <span className="text-xs font-semibold bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full border border-teal-200">
                {filteredInvoices.length} Bills
              </span>
            </h2>
            <p className="text-xs text-slate-500">History of all generated platform subscription invoices and payment tracking.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search invoice no, org, mobile..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
              {(['all', 'Paid', 'Unpaid'] as const).map(f => (
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

        {/* Mobile Invoices Card List (Phones & Small Tablets) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              No SaaS invoices found. Generate a new bill using the builder above.
            </div>
          ) : (
            filteredInvoices.map(inv => {
              const isPaid = inv.paymentStatus === 'Paid';
              return (
                <div key={inv.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition">
                  {/* Top: Invoice No, Period, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-slate-900 text-xs">{inv.id}</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[9.5px]">
                          {inv.billingPeriod}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Date: {inv.date} (Due: {inv.dueDate})
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextStatus = isPaid ? 'Unpaid' : 'Paid';
                        onUpdateInvoice({ ...inv, paymentStatus: nextStatus });
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] transition cursor-pointer border ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                      }`}
                      title="Click to toggle Payment Status"
                    >
                      {isPaid ? <Check className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-amber-600" />}
                      <span>{inv.paymentStatus}</span>
                    </button>
                  </div>

                  {/* Organization info & Total */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-slate-900 block">{inv.tenantName}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">Code: {inv.tenantCode} | {inv.ownerMobile}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Grand Total</span>
                      <span className="font-mono font-black text-emerald-600 text-xs sm:text-sm">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}.00
                      </span>
                    </div>
                  </div>

                  {/* Included Add-ons */}
                  <div className="flex flex-wrap gap-1">
                    {inv.items.map((item, idx) => (
                      <span key={idx} className="bg-teal-50 text-teal-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-teal-100">
                        {item.addonKey || item.description}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(inv)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 border border-emerald-200"
                        title="Send on WhatsApp"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 border border-blue-200"
                        title="View / Print Tax Invoice"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>View Slip</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete SaaS invoice ${inv.id}?`)) {
                          onDeleteInvoice(inv.id);
                        }
                      }}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer border border-rose-200 text-xs"
                      title="Delete Invoice"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Invoices Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/60 text-slate-500 text-[10px] uppercase font-extrabold tracking-wider border-b border-slate-200/80">
                <th className="p-4 whitespace-nowrap">Actions</th>
                <th className="p-4 whitespace-nowrap">Invoice No</th>
                <th className="p-4 whitespace-nowrap">Date / Due</th>
                <th className="p-4 whitespace-nowrap">Organization</th>
                <th className="p-4 whitespace-nowrap">Period</th>
                <th className="p-4 whitespace-nowrap">Included Access Points</th>
                <th className="p-4 whitespace-nowrap">Total Amount</th>
                <th className="p-4 whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No SaaS invoices found. Generate a new bill using the builder above.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const isPaid = inv.paymentStatus === 'Paid';
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(inv)}
                            title="Send SaaS Bill on WhatsApp"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition cursor-pointer"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewInvoice(inv)}
                            title="View / Print Tax Invoice"
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete SaaS invoice ${inv.id}?`)) {
                                onDeleteInvoice(inv.id);
                              }
                            }}
                            title="Delete Invoice"
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-900">
                        {inv.id}
                      </td>

                      <td className="p-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        <div>{inv.date}</div>
                        <div className="text-[10px] text-slate-400">Due: {inv.dueDate}</div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{inv.tenantName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Code: {inv.tenantCode} | {inv.ownerMobile}</div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px]">
                          {inv.billingPeriod}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {inv.items.map((item, idx) => (
                            <span key={idx} className="bg-teal-50 text-teal-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-teal-100 whitespace-nowrap">
                              {item.addonKey || 'Custom'}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap font-mono font-bold text-emerald-600 text-xs">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}.00
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus = isPaid ? 'Unpaid' : 'Paid';
                            onUpdateInvoice({ ...inv, paymentStatus: nextStatus });
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[10px] transition cursor-pointer border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                          title="Click to toggle Payment Status"
                        >
                          {isPaid ? <Check className="w-3 h-3 text-emerald-600" /> : <Clock className="w-3 h-3 text-amber-600" />}
                          <span>{inv.paymentStatus}</span>
                        </button>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Printable Master Admin SaaS Invoice Modal */}
      {previewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Control Bar */}
            <div className="bg-slate-900 text-white p-3 sm:px-6 sm:py-4 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1.5 bg-teal-500/20 text-teal-400 rounded-lg shrink-0">
                  <Receipt className="w-4 h-4" />
                </span>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-400 truncate">
                  Tax Invoice #{previewInvoice.id}
                </span>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(previewInvoice)}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer transition"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" /> <span className="hidden xs:inline">WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg cursor-pointer transition"
                >
                  <Printer className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(null)}
                  className="text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Printable Body */}
            <div className="p-2 sm:p-6 bg-slate-100 overflow-y-auto flex-1">
              <div id="saas-invoice-print-area" className="printable-area bg-white p-4 sm:p-8 max-w-2xl mx-auto rounded-xl shadow-xs border border-slate-200 text-[11px] text-slate-700 space-y-4 sm:space-y-5">
                
                {/* Header info */}
                <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-4 gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">INOMS CLOUD PLATFORM</h2>
                    <p className="text-[10px] text-slate-500">NextGen Enterprise SaaS & Multi-Tenant Solutions</p>
                    <p className="text-[10px] text-slate-500">Phone: +91 8149862034 | Email: billing@inoms.cloud</p>
                    <p className="text-[10px] text-slate-500 font-bold">GSTIN: <span className="font-mono">21ABCDE1234F1Z5</span></p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="bg-teal-600 text-white text-[9px] px-3 py-1 rounded font-black tracking-widest block uppercase w-fit sm:w-auto">
                      SaaS Tax Invoice
                    </span>
                    <p className="text-[10px] text-slate-600 mt-1.5 font-mono font-bold">Invoice No: {previewInvoice.id}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Date: {previewInvoice.date}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Due Date: {previewInvoice.dueDate}</p>
                  </div>
                </div>

                {/* Bill To Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Subscriber Organization</h4>
                    <p className="font-black text-slate-900 text-xs">{previewInvoice.tenantName}</p>
                    <p className="text-[10px] text-slate-600 font-mono">Workspace Code: {previewInvoice.tenantCode}</p>
                    <p className="text-[10px] text-slate-600">Owner: {previewInvoice.ownerName}</p>
                    <p className="text-[10px] text-slate-600 font-mono">Contact: {previewInvoice.ownerMobile}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billing Cycle</h4>
                    <span className="bg-teal-50 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded border border-teal-200 inline-block mb-1">
                      {previewInvoice.billingPeriod} Plan
                    </span>
                    <p className="text-[10px] text-slate-500">Payment Mode: <span className="font-bold text-slate-700">{previewInvoice.paymentMode || 'UPI'}</span></p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">Status: {previewInvoice.paymentStatus}</p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase">
                        <th className="py-2 text-left w-8">#</th>
                        <th className="py-2 text-left">Access Point / Feature Description</th>
                        <th className="py-2 text-center w-12">Qty</th>
                        <th className="py-2 text-right w-20 sm:w-24">Rate (₹)</th>
                        <th className="py-2 text-right w-20 sm:w-24">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewInvoice.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2 font-semibold text-slate-800">{item.description}</td>
                          <td className="py-2 text-center font-mono">{item.qty}</td>
                          <td className="py-2 text-right font-mono">₹{item.rate.toLocaleString('en-IN')}</td>
                          <td className="py-2 text-right font-mono font-bold text-slate-900">₹{item.amount.toLocaleString('en-IN')}.00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary */}
                <div className="flex justify-end pt-2 border-t border-slate-200">
                  <div className="w-full sm:w-60 space-y-1.5 text-[10px]">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal:</span>
                      <span className="font-mono">₹{previewInvoice.subtotal.toLocaleString('en-IN')}.00</span>
                    </div>
                    {previewInvoice.discount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount:</span>
                        <span className="font-mono">- ₹{previewInvoice.discount.toLocaleString('en-IN')}.00</span>
                      </div>
                    )}
                    {previewInvoice.gstAmount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>GST ({previewInvoice.gstPercent}%):</span>
                        <span className="font-mono">₹{previewInvoice.gstAmount.toLocaleString('en-IN')}.00</span>
                      </div>
                    )}
                    <div className="border-t border-slate-300 pt-1.5 flex justify-between text-slate-900 font-black text-xs">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-600">₹{previewInvoice.grandTotal.toLocaleString('en-IN')}.00</span>
                    </div>
                  </div>
                </div>

                {/* Payment QR & Signatures */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                    <div className="w-14 h-14 bg-white rounded-lg border border-emerald-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=8149862034@upi&pn=INOMS%20Cloud%20Platform&am=${previewInvoice.grandTotal}&cu=INR`)}`}
                        alt="UPI Payment QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <h5 className="font-bold text-slate-800 uppercase text-[8.5px] tracking-wide">Scan & Pay via UPI</h5>
                      <p className="text-[9.5px] text-emerald-700 font-bold font-mono">UPI ID: 8149862034@upi</p>
                      <p className="text-[8px] text-slate-500 font-mono">Bank: HDFC Bank | A/C: 50200087654321</p>
                      <p className="text-[8px] text-slate-400">Instant activation upon payment verification.</p>
                    </div>
                  </div>

                  <div className="flex justify-end items-end text-center">
                    <div className="w-full sm:w-36 text-center">
                      <div className="h-6 sm:h-8"></div>
                      <div className="w-full border-b border-slate-300 mx-auto"></div>
                      <span className="text-[8.5px] font-bold text-slate-700 mt-0.5 block uppercase">Authorized Signature</span>
                      <span className="text-[8px] text-slate-400 block font-semibold">INOMS Cloud Systems</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
