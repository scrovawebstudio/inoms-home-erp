/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Printer, Receipt, QrCode, FileText, CheckCircle2 } from 'lucide-react';
import { Invoice, CompanyConfig } from '../types';

export const SHOP_TERMS = [
  'All goods/services once delivered cannot be returned or refunded.',
  'Warranty covers manufacturing defects only as per company policy.',
  'Physical or liquid damage is strictly out of service warranty.',
  'Subject to local judicial jurisdiction only.'
];

interface InvoiceViewModalProps {
  invoice: Invoice | null;
  companyConfig: CompanyConfig;
  onClose: () => void;
}

export default function InvoiceViewModal({ invoice, companyConfig, onClose }: InvoiceViewModalProps) {
  if (!invoice) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-3xl w-full my-8 overflow-hidden animate-slide-up cursor-default flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with actions */}
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-white">Tax Invoice #{invoice.id}</h3>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                    invoice.isPaid
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {invoice.isPaid ? 'PAID' : 'UNPAID / PARTIAL'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">Date: {invoice.date}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print / PDF
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

        {/* Printable Tax Invoice Frame */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100">
          <div className="printable-area bg-white p-8 max-w-2xl mx-auto rounded-xl shadow-sm border border-slate-200 text-xs text-slate-700 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 pb-5">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{companyConfig.name}</h2>
                <p className="text-[10px] text-slate-500">{companyConfig.address}</p>
                <p className="text-[10px] text-slate-500">Ph: {companyConfig.phone} | Email: {companyConfig.email}</p>
                <p className="text-[10px] text-slate-600 font-bold mt-1">
                  GSTIN: <span className="font-mono font-bold text-slate-800">{companyConfig.gstin || '27AAAAA0000A1Z5'}</span>
                </p>
              </div>

              <div className="text-right space-y-1">
                <span className="bg-slate-900 text-white text-[10px] px-3 py-1 rounded font-black tracking-widest block uppercase">
                  TAX INVOICE
                </span>
                <p className="text-[11px] font-mono font-bold text-slate-800 pt-1">INV: #{invoice.id}</p>
                <p className="text-[10px] text-slate-500 font-mono">Date: {invoice.date}{invoice.time ? ` • ${invoice.time}` : ''}</p>
                {invoice.linkedJobId && (
                  <p className="text-[10px] text-teal-700 font-mono font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block">
                    Job Ref: #{invoice.linkedJobId}
                  </p>
                )}
              </div>
            </div>

            {/* Bill To */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-start">
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To (Client):</h4>
                <p className="font-bold text-sm text-slate-900">{invoice.clientName}</p>
                <p className="font-mono text-slate-600 text-[11px]">Mobile: {invoice.clientMobile}</p>
                {invoice.clientAddress && <p className="text-[11px] text-slate-500">{invoice.clientAddress}</p>}
                {invoice.clientGstin && (
                  <p className="text-[10px] text-slate-700 font-mono font-bold mt-1">GSTIN: {invoice.clientGstin}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold block uppercase">State / Region</span>
                <span className="font-bold text-slate-800 text-xs">{invoice.clientState || 'Maharashtra'}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white text-[9px] font-bold uppercase tracking-wider">
                    <th className="p-2.5">S.No</th>
                    <th className="p-2.5">Particulars</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Rate (₹)</th>
                    <th className="p-2.5 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2.5">
                        <span className="font-bold text-slate-800 block">{item.productName}</span>
                        {item.serialNo && <span className="text-[9px] text-slate-400 font-mono">S/N: {item.serialNo}</span>}
                      </td>
                      <td className="p-2.5 text-center font-mono font-bold">{item.qty}</td>
                      <td className="p-2.5 text-right font-mono">₹{item.rate.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                        ₹{item.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Sum-up */}
            <div className="flex flex-col sm:flex-row sm:justify-between gap-4 pt-2">
              <div className="max-w-xs space-y-1 text-[9px] text-slate-400">
                <h5 className="font-bold text-slate-500 uppercase">Terms & Conditions</h5>
                <ol className="list-decimal pl-3 space-y-0.5">
                  {SHOP_TERMS.map((term, i) => (
                    <li key={i}>{term}</li>
                  ))}
                </ol>
              </div>

              <div className="w-64 text-right space-y-1 font-medium text-slate-600 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-800">₹{invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Discount:</span>
                    <span className="font-mono">- ₹{invoice.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>GST Tax ({invoice.taxPercent}%):</span>
                  <span className="font-mono text-slate-800">₹{invoice.taxAmount.toFixed(2)}</span>
                </div>
                {invoice.deliveryCharges > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery Charges:</span>
                    <span className="font-mono text-slate-800">₹{invoice.deliveryCharges.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between text-slate-900 font-black text-sm">
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-600">₹{invoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* UPI QR & Signatures */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
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
                  <h5 className="font-bold text-slate-700 uppercase text-[9px] tracking-wide">Scan to Pay via UPI</h5>
                  {companyConfig.upiId ? (
                    <p className="text-[10px] text-emerald-700 font-bold font-mono">UPI ID: {companyConfig.upiId}</p>
                  ) : (
                    <p className="text-[9px] text-slate-400 italic">UPI ID not configured</p>
                  )}
                  {companyConfig.bankName && (
                    <p className="text-[8px] text-slate-500 font-mono">Bank: {companyConfig.bankName} | A/C: {companyConfig.bankAccountNo || ''}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end items-end text-center">
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
                  <span className="text-[9px] font-bold text-slate-700 mt-1 block uppercase">Authorized Signature</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
