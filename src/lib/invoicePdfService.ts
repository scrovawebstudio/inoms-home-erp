import html2pdf from 'html2pdf.js';
import { CompanyConfig, Invoice } from '../types';

/**
 * Clean string for safe file/folder names
 */
export function sanitizeFolderName(name: string): string {
  return (name || 'default')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Creates the exact HTML element representing the official Tax Invoice
 */
export function createInvoiceHtmlElement(invoice: Invoice, company: CompanyConfig): HTMLElement {
  const container = document.createElement('div');
  container.style.width = '750px';
  container.style.padding = '30px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.fontSize = '12px';
  container.style.lineHeight = '1.4';
  container.style.boxSizing = 'border-box';

  const subtotal = invoice.subtotal || invoice.items.reduce((acc, it) => acc + it.total, 0);
  const taxAmount = invoice.taxAmount || 0;
  const discount = invoice.discount || 0;
  const deliveryCharges = invoice.deliveryCharges || 0;
  const grandTotal = invoice.grandTotal || (subtotal - discount + taxAmount + deliveryCharges);

  const itemsRows = invoice.items.map((it, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
      <td style="padding: 10px 8px; font-family: monospace; color: #64748b; font-size: 11px;">${idx + 1}</td>
      <td style="padding: 10px 8px;">
        <div style="font-weight: 700; color: #0f172a; font-size: 12px;">${it.productName}</div>
        ${it.serialNo ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">Ref/SN: ${it.serialNo}</div>` : ''}
      </td>
      <td style="padding: 10px 8px; text-align: center; font-family: monospace; font-size: 11px;">${it.qty}</td>
      <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-size: 11px;">₹${it.rate.toFixed(2)}</td>
      <td style="padding: 10px 8px; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a; font-size: 11px;">₹${it.total.toFixed(2)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div style="border: 1px solid #cbd5e1; border-radius: 12px; padding: 24px; background: #ffffff;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 16px;">
        <div style="max-width: 440px;">
          <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900; color: #0f766e; text-transform: uppercase; letter-spacing: -0.5px;">
            ${company.name || 'Service Enterprise'}
          </h1>
          <p style="margin: 0 0 4px 0; color: #475569; font-size: 11px;">${company.address || 'Service & Repair Center'}</p>
          <p style="margin: 0 0 4px 0; color: #475569; font-size: 11px;">
            ${company.phone ? `Phone: <strong>${company.phone}</strong>` : ''} 
            ${company.email ? ` | Email: <strong>${company.email}</strong>` : ''}
          </p>
          ${company.gstin ? `<p style="margin: 0; color: #0f766e; font-size: 11px; font-weight: 700;">GSTIN: <span style="font-family: monospace;">${company.gstin}</span></p>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background: #0f766e; color: #ffffff; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
            Tax Invoice
          </div>
          <div style="font-family: monospace; font-size: 12px; font-weight: 700; color: #1e293b;">#${invoice.id}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Date: ${invoice.date}</div>
        </div>
      </div>

      <!-- Bill To & Payment Info -->
      <div style="display: flex; justify-content: space-between; background: #f1f5f9; padding: 14px 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
        <div>
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Billed To:</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${invoice.clientName}</div>
          ${invoice.clientMobile ? `<div style="font-size: 11px; font-family: monospace; color: #334155; margin-top: 2px;">Phone: ${invoice.clientMobile}</div>` : ''}
          ${invoice.linkedJobId ? `<div style="font-size: 11px; color: #0f766e; font-weight: 700; margin-top: 3px;">Linked Job ID: ${invoice.linkedJobId}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px;">Payment Summary:</div>
          <div style="font-size: 13px; font-weight: 800; color: ${invoice.isPaid ? '#059669' : '#d97706'}; text-transform: uppercase;">
            ${invoice.isPaid ? 'Paid' : 'Due / Pending'}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">Mode: <strong>${invoice.paymentMode || 'Cash'}</strong></div>
        </div>
      </div>

      <!-- Items Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 0.5px;">
            <th style="padding: 8px; text-align: left; width: 35px;">#</th>
            <th style="padding: 8px; text-align: left;">Item & Description</th>
            <th style="padding: 8px; text-align: center; width: 60px;">Qty</th>
            <th style="padding: 8px; text-align: right; width: 90px;">Rate</th>
            <th style="padding: 8px; text-align: right; width: 110px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Totals & Terms -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; border-top: 1px solid #cbd5e1; padding-top: 14px;">
        <div style="flex: 1; font-size: 10px; color: #64748b; line-height: 1.5;">
          <div style="font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 4px;">Terms & Conditions:</div>
          <div>1. Goods / serviced items once sold or accepted are non-refundable.</div>
          <div>2. Warranty is applicable as per manufacturer / repair terms.</div>
          <div>3. Computer generated tax invoice valid without signature.</div>
          ${company.upiId ? `<div style="margin-top: 6px; color: #0f766e; font-weight: 700;">UPI ID for payments: ${company.upiId}</div>` : ''}
        </div>

        <div style="width: 250px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 11px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
            <span>Subtotal:</span>
            <span style="font-family: monospace; font-weight: 600;">₹${subtotal.toFixed(2)}</span>
          </div>
          ${discount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #dc2626;">
            <span>Discount:</span>
            <span style="font-family: monospace; font-weight: 600;">-₹${discount.toFixed(2)}</span>
          </div>` : ''}
          ${taxAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
            <span>GST / Tax (${invoice.taxPercent || 0}%):</span>
            <span style="font-family: monospace; font-weight: 600;">₹${taxAmount.toFixed(2)}</span>
          </div>` : ''}
          ${deliveryCharges > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #475569;">
            <span>Delivery:</span>
            <span style="font-family: monospace; font-weight: 600;">₹${deliveryCharges.toFixed(2)}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between; border-top: 2px solid #0f766e; padding-top: 8px; margin-top: 8px; font-size: 13px; font-weight: 900; color: #0f766e;">
            <span>Grand Total:</span>
            <span style="font-family: monospace;">₹${grandTotal.toFixed(2)}</span>
          </div>
          ${invoice.paidAmount !== undefined ? `
          <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: #059669;">
            <span>Paid Amount:</span>
            <span style="font-family: monospace; font-weight: 600;">₹${invoice.paidAmount.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 2px; font-size: 10px; color: ${invoice.balanceAmount > 0 ? '#d97706' : '#64748b'};">
            <span>Balance Due:</span>
            <span style="font-family: monospace; font-weight: 700;">₹${(invoice.balanceAmount || 0).toFixed(2)}</span>
          </div>` : ''}
        </div>
      </div>

      <!-- Footer Note -->
      <div style="margin-top: 18px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 10px; color: #94a3b8;">
        Thank you for your business with <strong>${company.name || 'us'}</strong>!
      </div>
    </div>
  `;

  return container;
}

/**
 * Generate PDF Blob from an invoice
 */
export async function generateInvoicePdfBlob(invoice: Invoice, company: CompanyConfig): Promise<Blob> {
  const element = createInvoiceHtmlElement(invoice, company);
  
  // Temporarily mount to offscreen DOM
  element.style.position = 'fixed';
  element.style.top = '-9999px';
  element.style.left = '-9999px';
  document.body.appendChild(element);

  try {
    const opt = {
      margin: 10,
      filename: `${invoice.id}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    const pdfBlob: Blob = await html2pdf().set(opt).from(element).outputPdf('blob');
    return pdfBlob;
  } finally {
    if (document.body.contains(element)) {
      document.body.removeChild(element);
    }
  }
}

/**
 * Convert Blob to Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
