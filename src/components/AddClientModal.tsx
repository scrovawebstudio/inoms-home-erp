/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, UserPlus, Building, Phone, Mail, MapPin, DollarSign } from 'lucide-react';
import { Client, ClientType } from '../types';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Delhi',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal'
];

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClient: (client: Omit<Client, 'id' | 'ledger'>) => Client | void;
  editingClient?: Client | null;
  onEditClient?: (client: Client) => void;
}

export default function AddClientModal({
  isOpen,
  onClose,
  onAddClient,
  editingClient,
  onEditClient
}: AddClientModalProps) {
  const [clientType, setClientType] = useState<ClientType>('Walk-in');
  const [clientName, setClientName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [address, setAddress] = useState('');
  const [selectedState, setSelectedState] = useState('Maharashtra');
  const [balanceType, setBalanceType] = useState<'receivable' | 'payable'>('receivable');
  const [openingAmountInput, setOpeningAmountInput] = useState<number>(0);

  useEffect(() => {
    if (editingClient) {
      setClientType(editingClient.type || 'Walk-in');
      setClientName(editingClient.name || '');
      setContactPerson(editingClient.contactPerson || '');
      setMobileNumber(editingClient.mobile || '');
      setPhone(editingClient.phone || '');
      setEmailAddress(editingClient.email || '');
      setAddress(editingClient.address || '');
      setSelectedState(editingClient.state || 'Maharashtra');
      if (editingClient.outstandingBalance > 0) {
        setBalanceType('receivable');
        setOpeningAmountInput(editingClient.outstandingBalance);
      } else if (editingClient.outstandingBalance < 0) {
        setBalanceType('payable');
        setOpeningAmountInput(Math.abs(editingClient.outstandingBalance));
      } else {
        setBalanceType('receivable');
        setOpeningAmountInput(0);
      }
    } else {
      setClientType('Walk-in');
      setClientName('');
      setContactPerson('');
      setMobileNumber('');
      setPhone('');
      setEmailAddress('');
      setAddress('');
      setSelectedState('Maharashtra');
      setBalanceType('receivable');
      setOpeningAmountInput(0);
    }
  }, [editingClient, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !mobileNumber) {
      alert('Please fill in Client Name and Mobile Number.');
      return;
    }

    const calculatedBalance = balanceType === 'receivable'
      ? Math.abs(Number(openingAmountInput)) || 0
      : -(Math.abs(Number(openingAmountInput)) || 0);

    if (editingClient && onEditClient) {
      onEditClient({
        ...editingClient,
        type: clientType,
        name: clientName,
        contactPerson: contactPerson,
        mobile: mobileNumber,
        phone: phone,
        email: emailAddress,
        address: address,
        state: selectedState,
        outstandingBalance: calculatedBalance
      });
    } else {
      onAddClient({
        type: clientType,
        name: clientName,
        contactPerson: contactPerson,
        mobile: mobileNumber,
        phone: phone,
        email: emailAddress,
        address: address,
        state: selectedState,
        outstandingBalance: calculatedBalance
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full my-8 overflow-hidden animate-slide-up cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-sm">
                {editingClient ? 'Edit Client Record' : 'Add New Client'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Register client details & set opening ledger balance
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-3 text-xs max-h-[85vh] overflow-y-auto">
          {/* Client Type */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Client Category *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(['Walk-in', 'Dealer'] as ClientType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setClientType(type)}
                  className={`py-1.5 px-2 border rounded-xl font-bold transition text-center cursor-pointer text-xs ${
                    clientType === type
                      ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Client Name & Contact Person */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Client / Firm Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar / ABC Tech"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-semibold text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Contact Person</label>
              <input
                type="text"
                placeholder="Person to contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Mobile & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Primary Mobile *</label>
              <input
                type="tel"
                required
                placeholder="10-digit primary mobile"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-bold text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Alternate Phone</label>
              <input
                type="tel"
                placeholder="Landline / Alt mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Email Address & State */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Email Address</label>
              <input
                type="email"
                placeholder="client@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">State / Region</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-teal-500 font-semibold text-slate-700"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="block font-bold text-slate-500 uppercase tracking-wide text-[10px]">Address</label>
            <textarea
              placeholder="Street, Building, Locality details"
              rows={1}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Opening Ledger Balance Selection */}
          <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
            <label className="block font-bold text-slate-700 uppercase tracking-wide text-[10px]">
              Client Opening Ledger Balance (Pending / Advance)
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBalanceType('receivable')}
                className={`p-2 rounded-xl border text-left font-bold transition cursor-pointer flex flex-col justify-between ${
                  balanceType === 'receivable'
                    ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-400/30'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-[11px] font-extrabold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Client Owes Me (DR)
                </span>
                <span className="text-[9px] font-normal text-slate-500">
                  Pending money to collect
                </span>
              </button>

              <button
                type="button"
                onClick={() => setBalanceType('payable')}
                className={`p-2 rounded-xl border text-left font-bold transition cursor-pointer flex flex-col justify-between ${
                  balanceType === 'payable'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-400/30'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-[11px] font-extrabold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  I Owe Client (CR)
                </span>
                <span className="text-[9px] font-normal text-slate-500">
                  Advance amount held
                </span>
              </button>
            </div>

            <div className="space-y-1 pt-0.5">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                <span>Opening Amount (₹)</span>
                <span className={balanceType === 'receivable' ? 'text-rose-600' : 'text-emerald-600'}>
                  {balanceType === 'receivable' ? 'DR (Debit Balance)' : 'CR (Credit Balance)'}
                </span>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="0.00 (e.g. 500)"
                value={openingAmountInput === 0 ? '' : openingAmountInput}
                onChange={(e) => setOpeningAmountInput(e.target.value === '' ? 0 : Math.abs(Number(e.target.value)))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition shadow-sm cursor-pointer"
            >
              {editingClient ? 'Update Client' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
