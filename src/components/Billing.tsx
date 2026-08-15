/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Printer,
  FileText,
  X,
  CreditCard,
  Trash2,
  Bookmark,
  Calendar,
  Check,
  Percent,
  Download,
  MessageSquare,
  QrCode,
  Pencil,
  AlertTriangle,
  Receipt,
  Building,
  Tag,
  Sparkles
} from 'lucide-react';
import {
  Invoice,
  Client,
  RepairJob,
  Product,
  InvoiceItem,
  CompanyConfig,
  SystemUser,
  sortJobsByLatest,
  AddonPricingConfig,
  MasterAdminInvoice,
  DEFAULT_ADDON_PRICING
} from '../types';
import { TenantOrg, TenantFeatures, getTenantFeatures } from './AuthModal';
import { SHOP_TERMS } from '../data';
import AddClientModal from './AddClientModal';
import LockedAddonModal, { AddonType } from './LockedAddonModal';
import MasterAdminBilling from './MasterAdminBilling';
import MasterAdminPricing from './MasterAdminPricing';
import { generateInvoicePdfBlob, blobToBase64, sanitizeFolderName } from '../lib/invoicePdfService';

const WhatsAppIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.67-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.11 1.519 5.84L0 24l6.344-1.491C8.016 23.482 9.96 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.802 0-3.551-.486-5.087-1.397l-.365-.217-3.777.889.905-3.682-.238-.379A9.957 9.957 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/>
  </svg>
);

interface BillingProps {
  invoices: Invoice[];
  clients: Client[];
  jobs: RepairJob[];
  products: Product[];
  companyConfig: CompanyConfig;
  tenants?: TenantOrg[];
  tenantFeatures?: TenantFeatures;
  isAdmin?: boolean;
  currentUser?: SystemUser | null;
  activeTenantId?: string;
  initialJobForInvoice?: RepairJob | null;
  onClearInitialJobForInvoice?: () => void;
  initialInvoiceIdToView?: string | null;
  onClearInitialInvoiceIdToView?: () => void;
  onAddInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onAddClient?: (client: Omit<Client, 'id'>) => Client;
  // SaaS Master Admin Billing & Pricing Integration Props
  pricingConfig?: AddonPricingConfig;
  onSavePricing?: (newConfig: AddonPricingConfig) => void;
  saasInvoices?: MasterAdminInvoice[];
  onAddSaasInvoice?: (inv: MasterAdminInvoice) => void;
  onUpdateSaasInvoice?: (inv: MasterAdminInvoice) => void;
  onDeleteSaasInvoice?: (id: string) => void;
  initialSaasBillingTenantId?: string | null;
  onClearInitialSaasBillingTenantId?: () => void;
}

export default function Billing({
  invoices,
  clients,
  jobs,
  products,
  companyConfig,
  tenants = [],
  tenantFeatures,
  isAdmin = false,
  currentUser,
  activeTenantId = 'org-admin',
  initialJobForInvoice,
  onClearInitialJobForInvoice,
  initialInvoiceIdToView,
  onClearInitialInvoiceIdToView,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onAddClient,
  pricingConfig: propPricingConfig,
  onSavePricing: propOnSavePricing,
  saasInvoices: propSaasInvoices,
  onAddSaasInvoice: propOnAddSaasInvoice,
  onUpdateSaasInvoice: propOnUpdateSaasInvoice,
  onDeleteSaasInvoice: propOnDeleteSaasInvoice,
  initialSaasBillingTenantId,
  onClearInitialSaasBillingTenantId
}: BillingProps) {
  const isMasterAdminRole = isAdmin || activeTenantId === 'org-admin' || currentUser?.role === 'Admin';
  
  // Section Navigation: 'customer' | 'saas' | 'pricing'
  const [billingSection, setBillingSection] = useState<'customer' | 'saas' | 'pricing'>(() => {
    if (initialSaasBillingTenantId) return 'saas';
    if (activeTenantId === 'org-admin') return 'saas';
    return 'customer';
  });

  const [selectedSaasTenantId, setSelectedSaasTenantId] = useState<string | null>(initialSaasBillingTenantId || null);

  // Synchronize when initialSaasBillingTenantId changes from outside navigation
  React.useEffect(() => {
    if (initialSaasBillingTenantId) {
      setBillingSection('saas');
      setSelectedSaasTenantId(initialSaasBillingTenantId);
      onClearInitialSaasBillingTenantId?.();
    }
  }, [initialSaasBillingTenantId, onClearInitialSaasBillingTenantId]);

  // Local fallback state if not passed from top-level
  const [localPricingConfig, setLocalPricingConfig] = useState<AddonPricingConfig>(() => {
    try {
      const saved = localStorage.getItem('master_admin_addon_pricing_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ADDON_PRICING;
  });

  const activePricingConfig = propPricingConfig || localPricingConfig;
  const handleSavePricingConfig = (newConfig: AddonPricingConfig) => {
    if (propOnSavePricing) {
      propOnSavePricing(newConfig);
    } else {
      setLocalPricingConfig(newConfig);
      try {
        localStorage.setItem('master_admin_addon_pricing_v1', JSON.stringify(newConfig));
      } catch {}
    }
  };

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

  const activeSaasInvoices = propSaasInvoices || localSaasInvoices;

  const handleAddSaasInv = (inv: MasterAdminInvoice) => {
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

  const handleUpdateSaasInv = (inv: MasterAdminInvoice) => {
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

  const handleDeleteSaasInv = (id: string) => {
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

  const features = getTenantFeatures(tenantFeatures);
  const canCreateInvoice = isAdmin || currentUser?.permissions?.billingCreate !== false;
  const canEditInvoice = isAdmin || currentUser?.permissions?.billingEdit !== false;
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [lockedAddon, setLockedAddon] = useState<AddonType | null>(null);

  const handleTriggerWhatsAppInvoice = (inv: Invoice) => {
    if (!features.allowWhatsAppMessaging) {
      setLockedAddon('whatsapp');
      return;
    }
    handleSendWhatsAppInvoice(inv);
  };

  React.useEffect(() => {
    if (initialInvoiceIdToView) {
      const match = invoices.find(inv => inv.id === initialInvoiceIdToView || inv.id.includes(initialInvoiceIdToView));
      if (match) {
        setPreviewInvoice(match);
      }
      onClearInitialInvoiceIdToView?.();
    }
  }, [initialInvoiceIdToView, invoices, onClearInitialInvoiceIdToView]);

  // Quick Add Client Modal state
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientMobile, setQuickClientMobile] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientAddress, setQuickClientAddress] = useState('');
  const [quickClientOpeningBal, setQuickClientOpeningBal] = useState<number>(0);

  const handleSaveQuickClient = () => {
    if (!quickClientName || !quickClientMobile) {
      alert('Please enter Client Name and Mobile Number.');
      return;
    }
    if (onAddClient) {
      try {
        const created = onAddClient({
          name: quickClientName,
          type: 'Walk-in',
          mobile: quickClientMobile,
          email: quickClientEmail,
          address: quickClientAddress,
          state: 'Odisha',
          outstandingBalance: quickClientOpeningBal
        });
        if (created && created.id) {
          setSelectedClientId(created.id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    setQuickClientName('');
    setQuickClientMobile('');
    setQuickClientEmail('');
    setQuickClientAddress('');
    setQuickClientOpeningBal(0);
    setShowQuickAddClient(false);
  };

  // Combine clients with tenant organizations for billable profiles
  const allBillableClients: Client[] = React.useMemo(() => {
    if (isAdmin) {
      const tenantClients: Client[] = tenants.map(t => ({
        id: `tenant-client-${t.id}`,
        name: `${t.name} (Subscribed Org)`,
        type: 'Dealer',
        mobile: t.ownerMobile,
        email: `${t.code.toLowerCase()}@client-org.com`,
        address: `Tenant Org: ${t.code}`,
        state: 'Odisha',
        outstandingBalance: 0
      }));
      return tenantClients;
    }
    // Strictly isolate regular organizations to ONLY show clients added by that respective organization
    return clients;
  }, [clients, tenants, isAdmin]);

  // Form states for Create Invoice
  const [selectedClientId, setSelectedClientId] = useState('');
  const [linkedJobId, setLinkedJobId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceItems, setInvoiceItems] = useState<Omit<InvoiceItem, 'id' | 'total'>[]>([]);
  
  // Quick draft fields
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemRate, setCustomItemRate] = useState(0);
  const [customItemSku, setCustomItemSku] = useState('');

  // Tax/Charges states
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0); // Default GST (0%)
  const [deliveryCharges, setDeliveryCharges] = useState(0);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [isPaidInvoice, setIsPaidInvoice] = useState(true);
  const [deductInwardAdvance, setDeductInwardAdvance] = useState(true);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  // Auto-fill bill creation wizard when triggered from Outward Jobs
  React.useEffect(() => {
    if (initialJobForInvoice) {
      const existingInv = invoices.find(inv => inv.linkedJobId === initialJobForInvoice.id);
      if (existingInv) {
        handleOpenEditInvoice(existingInv);
        setDuplicateNotice(`Tax Invoice #${existingInv.id} was already generated for Job #${initialJobForInvoice.id} on ${existingInv.date || 'earlier date'}. You are editing this existing bill. Saving will update Invoice #${existingInv.id} directly without creating a duplicate invoice or payment.`);
      } else {
        setDuplicateNotice(null);
        setEditingInvoice(null);
        setSelectedClientId(initialJobForInvoice.clientId);
        setLinkedJobId(initialJobForInvoice.id);
        setInvoiceDate(new Date().toISOString().split('T')[0]);

        const subModel = [initialJobForInvoice.productName, initialJobForInvoice.productModel].filter(Boolean).join(' - ');
        const desc = `Repair / Service Charge - ${initialJobForInvoice.equipment || 'Device'}${subModel ? ` (${subModel})` : ''}`;

        setInvoiceItems([
          {
            productName: desc,
            serialNo: initialJobForInvoice.serialNo || initialJobForInvoice.id,
            qty: 1,
            rate: initialJobForInvoice.finalBillAmount || initialJobForInvoice.estimateAmount || 0
          }
        ]);

        setDiscountAmount(0);
        setTaxPercent(0);
        setDeliveryCharges(0);
        setPaymentMode(initialJobForInvoice.advancePaymentMode || 'UPI');
        setIsPaidInvoice(true);
        setDeductInwardAdvance(true);
        setShowCreateInvoice(true);
      }

      if (onClearInitialJobForInvoice) {
        onClearInitialJobForInvoice();
      }
    }
  }, [initialJobForInvoice, invoices, onClearInitialJobForInvoice]);

  // Filter invoices strictly by tenant context
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.linkedJobId && inv.linkedJobId.toLowerCase().includes(searchTerm.toLowerCase()));

    if (isAdmin || activeTenantId === 'org-admin') {
      // Admin account only sees SaaS subscription invoices issued to organizations or created by admin
      return matchesSearch && inv.tenantId === 'org-admin';
    }
    return matchesSearch && (inv.tenantId === activeTenantId || !inv.tenantId);
  });

  const handleOpenCreateInvoice = () => {
    setDuplicateNotice(null);
    setEditingInvoice(null);
    setSelectedClientId(allBillableClients[0]?.id || clients[0]?.id || '');
    setLinkedJobId('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    
    if (isAdmin) {
      setInvoiceItems([
        {
          productName: 'INOMS Software Subscription (1 Month License)',
          serialNo: 'SUB-MONTHLY',
          qty: 1,
          rate: 2999
        }
      ]);
    } else {
      setInvoiceItems([]);
    }

    setDiscountAmount(0);
    setTaxPercent(0);
    setDeliveryCharges(0);
    setPaymentMode('UPI');
    setIsPaidInvoice(true);
    setDeductInwardAdvance(true);
    setShowCreateInvoice(true);
  };

  const handleOpenEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setSelectedClientId(inv.clientId || '');
    setLinkedJobId(inv.linkedJobId || '');
    setInvoiceDate(inv.date || new Date().toISOString().split('T')[0]);
    setInvoiceItems(inv.items.map(item => ({
      productName: item.productName,
      serialNo: item.serialNo || 'N/A',
      qty: item.qty,
      rate: item.rate
    })));
    setDiscountAmount(inv.discount || 0);
    setTaxPercent(inv.taxPercent !== undefined ? inv.taxPercent : 0);
    setDeliveryCharges(inv.deliveryCharges || 0);
    setPaymentMode(inv.paymentMode || 'UPI');
    setIsPaidInvoice(inv.isPaid !== false);
    setDeductInwardAdvance(inv.deductedAdvance !== undefined ? inv.deductedAdvance > 0 : true);
    
    if (inv.linkedJobId) {
      setDuplicateNotice(`Tax Invoice #${inv.id} was generated for Job #${inv.linkedJobId} on ${inv.date || 'earlier date'}. Saving changes will update this invoice & sync client ledger.`);
    }
    setShowCreateInvoice(true);
  };

  const handleAddInvoiceItem = () => {
    if (!customItemName) {
      alert('Please enter a product or service name.');
      return;
    }
    setInvoiceItems([
      ...invoiceItems,
      {
        productName: customItemName,
        serialNo: customItemSku || 'N/A',
        qty: customItemQty,
        rate: customItemRate
      }
    ]);
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemRate(0);
    setCustomItemSku('');
  };

  const handleLinkJobData = (jobId: string) => {
    setLinkedJobId(jobId);
    if (!jobId) {
      setDuplicateNotice(null);
      return;
    }

    // Check if an invoice was already generated for this job card
    const existingInv = invoices.find(inv => inv.linkedJobId === jobId);
    if (existingInv) {
      handleOpenEditInvoice(existingInv);
      setDuplicateNotice(`Tax Invoice #${existingInv.id} was already generated for Job #${jobId} on ${existingInv.date || 'earlier date'}. You are editing this existing bill. Saving will update Invoice #${existingInv.id} directly without creating a duplicate invoice or extra payment.`);
      return;
    }

    setDuplicateNotice(null);
    const matchedJob = jobs.find(j => j.id === jobId);
    if (!matchedJob) return;

    // Link client and prepopulate job service rate
    setSelectedClientId(matchedJob.clientId);
    const subModel = [matchedJob.productName, matchedJob.productModel].filter(Boolean).join(' - ');
    const desc = `Repair / Service Charge - ${matchedJob.equipment || 'Device'}${subModel ? ` (${subModel})` : ''}`;

    setInvoiceItems([
      {
        productName: desc,
        serialNo: matchedJob.serialNo || matchedJob.id,
        qty: 1,
        rate: matchedJob.finalBillAmount || matchedJob.estimateAmount || 0
      }
    ]);
    if (matchedJob.advanceAmount && matchedJob.advanceAmount > 0) {
      setDeductInwardAdvance(true);
    }
  };

  // Computations
  const matchedLinkedJob = jobs.find(j => j.id === linkedJobId);
  const linkedJobAdvance = matchedLinkedJob?.advanceAmount || 0;
  const subtotal = invoiceItems.reduce((acc, item) => acc + (item.qty * item.rate), 0);
  const taxAmount = parseFloat(((subtotal - discountAmount) * (taxPercent / 100)).toFixed(2));
  const rawGrandTotal = parseFloat((subtotal - discountAmount + taxAmount + deliveryCharges).toFixed(2));
  const applicableAdvance = deductInwardAdvance && linkedJobAdvance > 0 ? linkedJobAdvance : 0;
  const grandTotal = Math.max(0, parseFloat((rawGrandTotal - applicableAdvance).toFixed(2)));

  const handleGenerateBill = () => {
    if (invoiceItems.length === 0) {
      alert('Please add at least one item to generate/save a tax invoice.');
      return;
    }
    const clientObj = clients.find(c => c.id === selectedClientId) ||
      allBillableClients.find(c => c.id === selectedClientId);

    const paidAmt = isPaidInvoice ? grandTotal : 0;
    const balAmt = isPaidInvoice ? 0 : grandTotal;
    
    if (editingInvoice) {
      const updatedInv: Invoice = {
        ...editingInvoice,
        date: invoiceDate,
        clientId: selectedClientId,
        clientName: clientObj?.name || editingInvoice.clientName,
        clientMobile: clientObj?.mobile || editingInvoice.clientMobile,
        linkedJobId: linkedJobId || undefined,
        items: invoiceItems.map((item, idx) => ({
          id: `it-${idx}`,
          ...item,
          total: item.qty * item.rate
        })),
        subtotal,
        discount: discountAmount,
        taxPercent,
        taxAmount,
        deliveryCharges,
        grandTotal,
        paidAmount: paidAmt,
        balanceAmount: balAmt,
        paymentMode,
        isPaid: isPaidInvoice,
        deductedAdvance: applicableAdvance
      };

      if (onUpdateInvoice) {
        onUpdateInvoice(updatedInv);
      } else {
        onAddInvoice(updatedInv);
      }
      setEditingInvoice(null);
    } else {
      // Add Invoice callback
      onAddInvoice({
        date: invoiceDate,
        clientId: selectedClientId,
        clientName: clientObj?.name || 'Unknown',
        clientMobile: clientObj?.mobile || '',
        linkedJobId: linkedJobId || undefined,
        items: invoiceItems.map((item, idx) => ({
          id: `it-${idx}`,
          ...item,
          total: item.qty * item.rate
        })),
        subtotal,
        discount: discountAmount,
        taxPercent,
        taxAmount,
        deliveryCharges,
        grandTotal,
        paidAmount: paidAmt,
        balanceAmount: balAmt,
        paymentMode,
        isPaid: isPaidInvoice,
        deductedAdvance: applicableAdvance
      });
    }

    setShowCreateInvoice(false);
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async (inv: Invoice) => {
    try {
      setIsGeneratingPdf(true);
      const pdfBlob = await generateInvoicePdfBlob(inv, companyConfig);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${inv.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download error:', err);
      setPreviewInvoice(inv);
      setTimeout(() => window.print(), 150);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendWhatsAppInvoice = async (inv: Invoice) => {
    const cleanMobile = inv.clientMobile ? inv.clientMobile.replace(/[^0-9]/g, '') : '';
    const formattedMobile = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;

    let publicPdfUrl = '';
    const currentTenant = tenants.find(t => t.id === activeTenantId);
    const tenantFolder = sanitizeFolderName(activeTenantId || currentTenant?.name || 'default_org');

    try {
      setIsGeneratingPdf(true);
      // 1. Generate crisp PDF blob
      const pdfBlob = await generateInvoicePdfBlob(inv, companyConfig);
      const base64Pdf = await blobToBase64(pdfBlob);

      // 2. Upload to isolated organization folder on Home Server
      const filename = `${inv.id}.pdf`;
      const response = await fetch('/api/docs/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenantFolder,
          subfolder: 'invoices',
          filename,
          base64Pdf
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.publicUrl) {
          const origin = window.location.origin;
          publicPdfUrl = `${origin}${data.publicUrl}`;
        }
      }
    } catch (err) {
      console.warn('Could not upload PDF to server storage, falling back to summary:', err);
    } finally {
      setIsGeneratingPdf(false);
    }

    let msg = `*${companyConfig.name} - Tax Invoice*\n\n`;
    msg += `Dear *${inv.clientName}*,\n`;
    msg += `Thank you for choosing ${companyConfig.name}. Please find your GST Tax Invoice details:\n\n`;
    msg += `🧾 *Invoice No:* ${inv.id}\n`;
    msg += `📅 *Date:* ${inv.date}\n`;
    msg += `💰 *Grand Total:* ₹${inv.grandTotal.toFixed(2)}\n`;
    msg += `💳 *Payment Mode:* ${inv.paymentMode}\n\n`;

    if (publicPdfUrl) {
      msg += `📄 *Download Official PDF Invoice:*\n${publicPdfUrl}\n\n`;
    }

    msg += `Thank you for your business!\n`;
    msg += `📞 Contact: ${companyConfig.phone}`;

    const encoded = encodeURIComponent(msg);
    if (formattedMobile) {
      window.open(`https://wa.me/${formattedMobile}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Sub-Navigation Tabs for Master / Organization Admins */}
      {isMasterAdminRole && (
        <div className="flex flex-wrap bg-slate-200/80 p-1.5 rounded-2xl gap-2 text-xs font-bold w-fit shadow-inner">
          <button
            type="button"
            onClick={() => setBillingSection('customer')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${
              billingSection === 'customer'
                ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 text-teal-600" />
            <span>Customer Repair & Retail Invoices</span>
            <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full border border-slate-200">
              {filteredInvoices.length} Bills
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBillingSection('saas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${
              billingSection === 'saas'
                ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-4 h-4 text-teal-600" />
            <span>SaaS Organization Subscriptions</span>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
              {activeSaasInvoices.length} SaaS Invoices
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBillingSection('pricing')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${
              billingSection === 'pricing'
                ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-4 h-4 text-teal-600" />
            <span>Add-on Price Set Matrix</span>
            <span className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded-full border border-teal-200">
              Rates Matrix
            </span>
          </button>
        </div>
      )}

      {/* 1. Customer Repair & Retail Invoices View */}
      {billingSection === 'customer' && (
        <>
          {/* Header action panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                Customer Invoices & Billing <span className="text-xs font-semibold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{filteredInvoices.length} Registered Bills</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">Generate official GST-compliant tax invoices for repair jobs and retail parts sales.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQuickAddClient(true)}
                className="flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Client
              </button>
              <button
                onClick={handleOpenCreateInvoice}
                id="create-bill-btn"
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create New Bill
              </button>
            </div>
          </div>

      {/* Main Billing Table */}
      {!showCreateInvoice ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-50 bg-slate-50/40 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Invoice No, Client Name or Linked Job..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">Actions</th>
                  <th className="py-3.5 px-6">Invoice No</th>
                  <th className="py-3.5 px-6">Billing Date</th>
                  <th className="py-3.5 px-6">Client</th>
                  <th className="py-3.5 px-6">Linked Job</th>
                  <th className="py-3.5 px-6">Payment Status</th>
                  <th className="py-3.5 px-6 text-right">Total Amount</th>
                  <th className="py-3.5 px-6 text-right">Paid Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredInvoices.length > 0 ? (
                  filteredInvoices.map((inv) => {
                    const isFullyPaid = inv.isPaid !== false || inv.balanceAmount <= 0;
                    return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-6 flex items-center gap-2">
                        <button
                          onClick={() => handleTriggerWhatsAppInvoice(inv)}
                          title={features.allowWhatsAppMessaging ? "Send Invoice on WhatsApp" : "WhatsApp Messaging (Add-on Locked)"}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            features.allowWhatsAppMessaging
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-600"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-400"
                          }`}
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPreviewInvoice(inv)}
                          title="Print / PDF Invoice Preview"
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditInvoice(inv)}
                          title="Edit Invoice"
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-lg transition cursor-pointer font-bold flex items-center gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete invoice ${inv.id}?`)) {
                              onDeleteInvoice(inv.id);
                            }
                          }}
                          title="Delete Invoice"
                          className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      <td className="py-3.5 px-6 font-mono font-bold text-slate-800">{inv.id}</td>
                      <td className="py-3.5 px-6 font-mono text-slate-500">{inv.date}</td>
                      <td className="py-3.5 px-6 font-semibold text-slate-700">{inv.clientName}</td>
                      <td className="py-3.5 px-6">
                        {inv.linkedJobId ? (
                          <span className="bg-teal-50 text-teal-600 font-mono font-bold px-2 py-0.5 rounded text-[10px] border border-teal-100">
                            {inv.linkedJobId}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Inventory Only</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        {isFullyPaid ? (
                          <div className="flex items-center gap-1.5">
                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full text-[10px] inline-flex items-center gap-1 border border-emerald-200">
                              ✓ PAID
                            </span>
                            <button
                              onClick={() => {
                                const updated: Invoice = {
                                  ...inv,
                                  isPaid: false,
                                  paidAmount: 0,
                                  balanceAmount: inv.grandTotal
                                };
                                if (onUpdateInvoice) {
                                  onUpdateInvoice(updated);
                                }
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-[10px] cursor-pointer shadow-2xs whitespace-nowrap"
                              title="Toggle to Unpaid status"
                            >
                              Mark Unpaid
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-full text-[10px] border border-rose-200 whitespace-nowrap">
                              UNPAID (Pending ₹{inv.balanceAmount.toFixed(2)})
                            </span>
                            <button
                              onClick={() => {
                                const updated: Invoice = {
                                  ...inv,
                                  isPaid: true,
                                  paidAmount: inv.grandTotal,
                                  balanceAmount: 0
                                };
                                if (onUpdateInvoice) {
                                  onUpdateInvoice(updated);
                                }
                              }}
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[10px] cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              Mark Paid
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-800">
                        ₹{inv.grandTotal.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono text-emerald-600 font-semibold">
                        ₹{inv.paidAmount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                      No invoices found matching query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Create / Edit Bill View */
        <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 space-y-3.5 text-xs" id="invoice-creation-form">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-teal-500" />
              {editingInvoice ? `Edit Tax Invoice (${editingInvoice.id})` : 'Tax Invoice Creation Wizard'}
            </h2>
            <button
              onClick={() => {
                setShowCreateInvoice(false);
                setEditingInvoice(null);
                setDuplicateNotice(null);
              }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {duplicateNotice && (
            <div className="bg-amber-50 border-l-4 border-amber-500 text-amber-900 p-2.5 rounded-r-xl flex items-start justify-between gap-2.5 shadow-2xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-amber-900 text-[10px] uppercase tracking-wider">Bill Already Generated</h4>
                  <p className="text-[11px] font-medium text-amber-800 mt-0.5">{duplicateNotice}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Link Inward Repair Job */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase text-[10px]">Link Inward Repair Job (Optional)</label>
              <select
                value={linkedJobId}
                onChange={(e) => handleLinkJobData(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1 font-bold text-teal-600 text-xs"
              >
                <option value="">-- Manual Inventory/Service (No Job Card) --</option>
                {sortJobsByLatest(jobs).map(j => (
                  <option key={j.id} value={j.id}>
                    #{j.id} - {j.clientName} ({j.equipment}) {j.advanceAmount ? `[Adv: ₹${j.advanceAmount}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Client */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Client Profile {isAdmin && '(Subscribed Org)'}</label>
                <button
                  type="button"
                  onClick={() => setShowQuickAddClient(true)}
                  className="flex items-center gap-1 text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 font-bold px-1.5 py-0.5 rounded-lg text-[9px] transition cursor-pointer shrink-0"
                >
                  <Plus className="w-2.5 h-2.5" /> Add Client
                </button>
              </div>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-xl px-2.5 py-1 font-semibold text-slate-800 text-xs"
              >
                {allBillableClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile})
                  </option>
                ))}
              </select>
            </div>

            {/* Invoice Date */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase text-[10px]">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-2.5 py-1 font-mono text-xs"
              />
            </div>
          </div>

          {/* Quick Line Items Block */}
          <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2.5">
            {/* Admin SaaS Service Subscription Package Presets */}
            {isAdmin && (
              <div className="bg-teal-50/80 border border-teal-200/80 rounded-xl p-2 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-900 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-teal-600" />
                    Select SaaS Service Plan Duration:
                  </span>
                  <span className="text-[9px] text-teal-700 font-semibold italic">
                    *Amounts editable anytime!
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { label: '1 Month Plan', duration: '1 Month', rate: 500 },
                    { label: '3 Months Plan', duration: '3 Months', rate: 1350 },
                    { label: '6 Months Plan', duration: '6 Months', rate: 2500 },
                    { label: '1 Year (12 Mo)', duration: '1 Year', rate: 5000 },
                  ].map((pkg) => (
                    <button
                      key={pkg.duration}
                      type="button"
                      onClick={() => {
                        setCustomItemName(`INOMS Software License (${pkg.duration} Service Plan)`);
                        setCustomItemSku(`SUB-${pkg.duration.replace(/\s+/g, '').toUpperCase()}`);
                        setCustomItemRate(pkg.rate);
                        setCustomItemQty(1);
                      }}
                      className="bg-white hover:bg-teal-600 hover:text-white text-teal-800 border border-teal-200/80 px-2 py-1 rounded-lg text-center font-bold text-xs transition cursor-pointer shadow-2xs flex flex-col items-center justify-center gap-0.5"
                    >
                      <span className="text-[10px]">{pkg.label}</span>
                      <span className="text-[9px] opacity-80">₹{pkg.rate.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Add Product or Repair Labor Charge Item</h3>
              {/* Quick Select from Inventory Stock */}
              {products && products.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-teal-600 uppercase">Or Pick Stock:</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const selectedProd = products.find(p => p.id === e.target.value);
                      if (selectedProd) {
                        setCustomItemName(selectedProd.name);
                        setCustomItemSku(selectedProd.hsnCode ? `HSN:${selectedProd.hsnCode}` : selectedProd.id);
                        setCustomItemRate(selectedProd.price);
                      }
                    }}
                    className="bg-white border border-teal-200 text-slate-700 text-xs rounded-lg px-2 py-0.5 font-medium focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">-- Choose Stock Product --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock} | ₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div className="space-y-0.5 sm:col-span-2">
                <label className="block text-[9px] font-bold text-slate-400">Description Particulars</label>
                <input
                  type="text"
                  placeholder="e.g. Dell KB216 Keyboard or Service Charge"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-xs"
                />
              </div>

              <div className="space-y-0.5">
                <label className="block text-[9px] font-bold text-slate-400">Serial No / SKU / Code</label>
                <input
                  type="text"
                  placeholder="e.g. SUB-1YEAR"
                  value={customItemSku}
                  onChange={(e) => setCustomItemSku(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="space-y-0.5">
                  <label className="block text-[9px] font-bold text-slate-400">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-center text-xs"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="block text-[9px] font-bold text-slate-400">Rate (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={customItemRate === 0 ? '' : customItemRate}
                    onChange={(e) => setCustomItemRate(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono text-right font-bold text-teal-700 text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddInvoiceItem}
                  className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1 rounded-lg transition cursor-pointer shadow-2xs text-xs"
                >
                  <Plus className="w-3 h-3" />
                  Add Line Item
                </button>
              </div>
            </div>

            {/* Added Items table with Inline Rate/Qty Edit capability */}
            {invoiceItems.length > 0 && (
              <div className="border border-slate-100 rounded-lg overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[9px] font-bold text-slate-500 uppercase border-b border-slate-100">
                    <tr>
                      <th className="p-2 whitespace-nowrap">S.No</th>
                      <th className="p-2 whitespace-nowrap">Particulars / Service Description</th>
                      <th className="p-2 font-mono whitespace-nowrap">Serial / SKU</th>
                      <th className="p-2 text-center whitespace-nowrap">Qty</th>
                      <th className="p-2 text-right whitespace-nowrap">Unit Rate (₹)</th>
                      <th className="p-2 text-right whitespace-nowrap">Total Amount</th>
                      <th className="p-2 text-center whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {invoiceItems.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition">
                        <td className="p-2 font-mono text-slate-400 whitespace-nowrap text-[11px]">{i + 1}</td>
                        <td className="p-2 font-semibold text-slate-800">
                          <input
                            type="text"
                            value={item.productName}
                            onChange={(e) => {
                              const updated = [...invoiceItems];
                              updated[i].productName = e.target.value;
                              setInvoiceItems(updated);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-teal-500 text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono text-slate-500 whitespace-nowrap text-[11px]">{item.serialNo}</td>
                        <td className="p-2 text-center font-mono whitespace-nowrap">
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) => {
                              const updated = [...invoiceItems];
                              updated[i].qty = Math.max(1, Number(e.target.value));
                              setInvoiceItems(updated);
                            }}
                            className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 font-mono text-center font-bold text-xs"
                          />
                        </td>
                        <td className="p-2 text-right font-mono whitespace-nowrap">
                          <input
                            type="number"
                            placeholder="0.00"
                            value={item.rate === 0 ? '' : item.rate}
                            onChange={(e) => {
                              const updated = [...invoiceItems];
                              updated[i].rate = e.target.value === '' ? 0 : Number(e.target.value);
                              setInvoiceItems(updated);
                            }}
                            className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 font-mono text-right font-bold text-teal-700 focus:bg-white focus:ring-1 focus:ring-teal-500 text-xs"
                          />
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                          ₹{(item.qty * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setInvoiceItems(invoiceItems.filter((_, idx) => idx !== i))}
                            className="p-1 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition cursor-pointer"
                            title="Remove Line Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tax computations & Discount footer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            {/* Taxes & Payment details */}
            <div className="space-y-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
              <h4 className="font-bold text-slate-700 text-[10px] uppercase tracking-wider">Taxes & Payment Details</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="block text-[9px] font-bold text-slate-400">Discount Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={discountAmount === 0 ? '' : discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-mono text-xs"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="block text-[9px] font-bold text-slate-400">GST Percent (%)</label>
                  <select
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-xs"
                  >
                    <option value={0}>0% (Tax Exempt)</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST (Standard)</option>
                    <option value={28}>28% GST</option>
                  </select>
                </div>

                <div className="space-y-0.5">
                  <label className="block text-[9px] font-bold text-slate-400">Delivery Charges (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={deliveryCharges === 0 ? '' : deliveryCharges}
                    onChange={(e) => setDeliveryCharges(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-mono text-xs"
                  />
                </div>

                <div className="space-y-0.5">
                  <label className="block text-[9px] font-bold text-slate-400">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 font-semibold text-xs"
                  >
                    <option value="UPI">UPI / QR Scan</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card Swipe</option>
                  </select>
                </div>
              </div>

              {/* Requirement 3: Is this invoice amount paid? Checkbox */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="isPaidInvoiceCheck"
                  checked={isPaidInvoice}
                  onChange={(e) => setIsPaidInvoice(e.target.checked)}
                  className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isPaidInvoiceCheck" className="text-xs font-bold text-slate-800 cursor-pointer flex-1">
                  Is this Invoice Amount Paid?
                  <p className="text-[10px] font-normal text-slate-500">
                    {isPaidInvoice
                      ? '✓ Marked as Paid. Auto-records payment in Payments tab & reduces client ledger balance.'
                      : '⚠️ Marked as Unpaid / Outstanding credit balance for client.'}
                  </p>
                </label>
              </div>

              {/* Requirement 4: Checkbox for inward payment advance accepted for linked job */}
              {matchedLinkedJob && matchedLinkedJob.advanceAmount && matchedLinkedJob.advanceAmount > 0 ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="deductInwardAdvanceCheck"
                    checked={deductInwardAdvance}
                    onChange={(e) => setDeductInwardAdvance(e.target.checked)}
                    className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="deductInwardAdvanceCheck" className="text-xs font-bold text-emerald-900 cursor-pointer flex-1">
                    Inward Payment Accepted: ₹{matchedLinkedJob.advanceAmount}
                    <p className="text-[10px] font-semibold text-emerald-700">
                      {deductInwardAdvance
                        ? `✓ Deducting ₹${matchedLinkedJob.advanceAmount} advance from invoice total.`
                        : `Do not deduct advance payment from invoice.`}
                    </p>
                  </label>
                </div>
              ) : null}
            </div>

            {/* Calculations summaries */}
            <div className="space-y-2 text-right flex flex-col justify-between">
              <div className="space-y-1 font-medium text-slate-600 text-xs">
                <div className="flex justify-between items-center">
                  <span>Subtotal:</span>
                  <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-rose-600">
                    <span>Discount Dues:</span>
                    <span className="font-mono">- ₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span>GST Tax ({taxPercent}%):</span>
                  <span className="font-mono">₹{taxAmount.toFixed(2)}</span>
                </div>
                {deliveryCharges > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Delivery Charges:</span>
                    <span className="font-mono">₹{deliveryCharges.toFixed(2)}</span>
                  </div>
                )}
                {applicableAdvance > 0 && (
                  <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                    <span>Less Inward Advance Received:</span>
                    <span className="font-mono">- ₹{applicableAdvance.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center text-xs font-bold text-slate-800">
                  <span>Grand Total Payable:</span>
                  <span className="font-mono text-teal-600 text-base">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateInvoice(false);
                    setEditingInvoice(null);
                  }}
                  className="px-4 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateBill}
                  className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs cursor-pointer text-xs"
                >
                  {editingInvoice ? 'Update & Save Invoice' : 'Generate Tax Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formal TAX INVOICE Printable PDF Viewer */}
      {previewInvoice && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setPreviewInvoice(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-3xl w-full my-8 overflow-hidden flex flex-col animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Action Bar */}
            <div className="no-print bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                GST Tax Invoice Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (previewInvoice) {
                      handleTriggerWhatsAppInvoice(previewInvoice);
                    }
                  }}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition shadow-xs"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5" /> WhatsApp Share (PDF)
                </button>
                <button
                  onClick={() => handleDownloadPdf(previewInvoice)}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Invoice
                </button>
                <button
                  onClick={() => setPreviewInvoice(null)}
                  className="text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document body */}
            <div className="p-4 bg-slate-100 overflow-y-auto flex-1">
              <div id="invoice-print-area" className="printable-area bg-white p-5 max-w-2xl mx-auto rounded-lg shadow-xs border border-slate-200 text-[11px] text-slate-700 space-y-4">
                
                {/* Header info */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">{companyConfig.name}</h2>
                    <p className="text-[10px] text-slate-400">{companyConfig.address}</p>
                    <p className="text-[10px] text-slate-400">Phone: {companyConfig.phone} | Email: {companyConfig.email}</p>
                    <p className="text-[10px] text-slate-400 font-bold">GSTIN: <span className="font-mono">{companyConfig.gstin}</span></p>
                  </div>
                  <div className="text-right">
                    <span className="bg-emerald-600 text-white text-[9px] px-2.5 py-0.5 rounded font-black tracking-widest block uppercase">Tax Invoice</span>
                    <p className="text-[10px] text-slate-500 mt-1.5 font-mono">Invoice No: {previewInvoice.id}</p>
                    <p className="text-[10px] text-slate-500 font-mono">Date: {previewInvoice.date}</p>
                  </div>
                </div>

                {/* Bill To Info */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div>
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Billing Client</h4>
                    <p className="font-bold text-slate-800 text-xs">{previewInvoice.clientName}</p>
                    <p className="font-mono text-slate-500 text-[10px]">Ph: {previewInvoice.clientMobile}</p>
                    {previewInvoice.linkedJobId && (
                      <p className="text-[10px] text-teal-600 font-bold mt-0.5">Diagnostic Job ID: {previewInvoice.linkedJobId}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Payment Mode</h4>
                    <p className="font-bold text-emerald-600 uppercase text-xs">{previewInvoice.paymentMode}</p>
                    <p className="text-slate-500 font-mono text-[10px]">Status: Fully Settled</p>
                  </div>
                </div>

                {/* Items table */}
                <div className="space-y-1">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider">
                        <th className="p-2">S.No</th>
                        <th className="p-2">Description Particulars</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 border-b border-slate-200">
                      {previewInvoice.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2 font-mono text-slate-400 text-[10px]">{idx + 1}</td>
                          <td className="p-2">
                            <span className="font-semibold text-slate-800">{item.productName}</span>
                            <span className="block text-[9px] text-slate-400 font-mono">SKU / Job Ref: {item.serialNo}</span>
                          </td>
                          <td className="p-2 text-center font-mono text-[10px]">{item.qty}</td>
                          <td className="p-2 text-right font-mono text-[10px]">₹{item.rate.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-800 text-[10px]">
                            ₹{item.total.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Computations totals row */}
                <div className="flex flex-col md:flex-row md:justify-between gap-3 pt-1">
                  {/* Shop Terms T&C */}
                  <div className="max-w-xs space-y-0.5 text-[8.5px] text-slate-400">
                    <h5 className="font-bold text-slate-500 uppercase text-[8.5px]">Terms & Conditions</h5>
                    <ol className="list-decimal pl-3 space-y-0.5">
                      {SHOP_TERMS.map((term, i) => (
                        <li key={i}>{term}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Calculations sum-up */}
                  <div className="w-56 text-right space-y-0.5 font-medium text-slate-500 text-[10px]">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-mono text-slate-700">₹{previewInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    {previewInvoice.discount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount:</span>
                        <span className="font-mono">- ₹{previewInvoice.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>GST Tax ({previewInvoice.taxPercent}%):</span>
                      <span className="font-mono text-slate-700">₹{previewInvoice.taxAmount.toFixed(2)}</span>
                    </div>
                    {previewInvoice.deliveryCharges > 0 && (
                      <div className="flex justify-between">
                        <span>Delivery Charges:</span>
                        <span className="font-mono text-slate-700">₹{previewInvoice.deliveryCharges.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-1 flex justify-between text-slate-800 font-bold text-xs">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-600">₹{previewInvoice.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* UPI QR Code Scan block & Signatures */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                    {/* Real Payment UPI QR Code */}
                    <div className="w-14 h-14 bg-white rounded-lg border border-emerald-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                      {companyConfig.upiQrUrl ? (
                        <img src={companyConfig.upiQrUrl} alt="UPI QR Code" className="w-full h-full object-contain" />
                      ) : companyConfig.upiId ? (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${companyConfig.upiId}&pn=${companyConfig.name}&cu=INR`)}`}
                          alt="Generated UPI QR Code"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-7 h-7 text-emerald-600" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <h5 className="font-bold text-slate-700 uppercase text-[8.5px] tracking-wide">Scan to Pay via UPI</h5>
                      {companyConfig.upiId ? (
                        <p className="text-[9.5px] text-emerald-700 font-bold font-mono">UPI ID: {companyConfig.upiId}</p>
                      ) : (
                        <p className="text-[8.5px] text-slate-400 italic">UPI ID not configured in Settings</p>
                      )}
                      {companyConfig.bankName && (
                        <p className="text-[8px] text-slate-500 font-mono">Bank: {companyConfig.bankName} | A/C: {companyConfig.bankAccountNo || ''}</p>
                      )}
                      <p className="text-[8px] text-slate-400">Accept digital scan payments instantly.</p>
                    </div>
                  </div>

                  {/* Authorized Signatory Only (Customer signature removed) */}
                  <div className="flex justify-end items-end text-center pt-1">
                    <div className="w-36 text-center">
                      {companyConfig.signatureUrl ? (
                        <img
                          src={companyConfig.signatureUrl}
                          alt="Authorized Signature"
                          className="max-h-10 max-w-[120px] mx-auto object-contain mb-1"
                        />
                      ) : (
                        <div className="h-8"></div>
                      )}
                      <div className="w-full border-b border-slate-300 mx-auto"></div>
                      <span className="text-[8.5px] font-bold text-slate-700 mt-0.5 block uppercase">Authorized Signature</span>
                      <span className="text-[8px] text-slate-400 block font-semibold">{companyConfig.name}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )}

  {/* 2. SaaS Organization Subscription Invoices View */}
  {billingSection === 'saas' && (
    <MasterAdminBilling
      tenants={tenants}
      pricingConfig={activePricingConfig}
      invoices={activeSaasInvoices}
      onAddInvoice={handleAddSaasInv}
      onUpdateInvoice={handleUpdateSaasInv}
      onDeleteInvoice={handleDeleteSaasInv}
      preSelectedTenantId={selectedSaasTenantId}
      onClearPreSelectedTenant={() => setSelectedSaasTenantId(null)}
    />
  )}

  {/* 3. Add-on Price Set Matrix View */}
  {billingSection === 'pricing' && (
    <MasterAdminPricing
      pricingConfig={activePricingConfig}
      onSavePricing={handleSavePricingConfig}
    />
  )}

      {/* Reusable Unified Add Client Modal */}
      <AddClientModal
        isOpen={showQuickAddClient}
        onClose={() => setShowQuickAddClient(false)}
        onAddClient={(clientData) => {
          if (onAddClient) {
            const created = onAddClient(clientData);
            if (created && created.id) {
              setSelectedClientId(created.id);
            }
            return created;
          }
        }}
      />

      {/* Locked Add-on Feature Modal */}
      <LockedAddonModal
        isOpen={!!lockedAddon}
        onClose={() => setLockedAddon(null)}
        addonType={lockedAddon || 'whatsapp'}
        orgName={companyConfig.name}
      />

    </div>
  );
}
