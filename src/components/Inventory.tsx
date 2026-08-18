/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  X,
  Database,
  Layers,
  MapPin,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Store,
  Tag,
  DollarSign,
  ShoppingBag
} from 'lucide-react';
import { Product, Category, LocationRack, SystemUser } from '../types';

interface InventoryProps {
  products: Product[];
  categories: Category[];
  racks: LocationRack[];
  isStaff?: boolean;
  currentUser?: SystemUser | null;
  userRole?: string;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onAddCategory: (name: string) => void;
  onDeleteCategory?: (id: string) => void;
  onAddRack: (name: string) => void;
  onDeleteRack?: (id: string) => void;
}

export default function Inventory({
  products,
  categories,
  racks,
  isStaff = false,
  currentUser,
  userRole,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onAddCategory,
  onDeleteCategory,
  onAddRack,
  onDeleteRack
}: InventoryProps) {
  const isAdmin = userRole === 'Admin' || currentUser?.role === 'Admin';
  const canEditInventory = isAdmin || currentUser?.permissions?.inventoryEditStock !== false || currentUser?.permissions?.inventoryEdit !== false;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedRackFilter, setSelectedRackFilter] = useState('All');

  // Modal triggers
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showRackModal, setShowRackModal] = useState(false);

  // Form states
  const [newCatName, setNewCatName] = useState('');
  const [newRackName, setNewRackName] = useState('');
  const catInputRef = useRef<HTMLInputElement>(null);
  const rackInputRef = useRef<HTMLInputElement>(null);

  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodLocation, setProdLocation] = useState('');
  const [prodHsn, setProdHsn] = useState('');
  const [prodPrice, setProdPrice] = useState<number>(0);
  const [prodPurchasePrice, setProdPurchasePrice] = useState<number>(0);
  const [prodVendorName, setProdVendorName] = useState('');
  const [prodVendorContact, setProdVendorContact] = useState('');
  const [prodStock, setProdStock] = useState<number>(0);
  const [prodMinQty, setProdMinQty] = useState<number>(2);
  const [prodDesc, setProdDesc] = useState('');

  // Computations
  const totalStockValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const totalPurchaseValue = products.reduce((acc, p) => acc + ((p.purchasePrice || 0) * p.stock), 0);
  const lowStockItemsCount = products.filter(p => p.stock <= p.minQtyAlert).length;

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdName('');
    setProdCategory(categories[0]?.name || 'ADAPTER');
    setProdLocation(racks[0]?.name || 'Rack 1');
    setProdHsn('');
    setProdPrice(0);
    setProdPurchasePrice(0);
    setProdVendorName('');
    setProdVendorContact('');
    setProdStock(0);
    setProdMinQty(2);
    setProdDesc('');
    setShowAddProduct(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdCategory(prod.category);
    setProdLocation(prod.location);
    setProdHsn(prod.hsnCode);
    setProdPrice(prod.price);
    setProdPurchasePrice(prod.purchasePrice || 0);
    setProdVendorName(prod.vendorName || '');
    setProdVendorContact(prod.vendorContact || '');
    setProdStock(prod.stock);
    setProdMinQty(prod.minQtyAlert);
    setProdDesc(prod.description || '');
    setShowAddProduct(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName) return;

    if (editingProduct) {
      onEditProduct({
        ...editingProduct,
        name: prodName,
        category: prodCategory,
        location: prodLocation,
        hsnCode: prodHsn,
        price: prodPrice,
        purchasePrice: prodPurchasePrice,
        vendorName: prodVendorName,
        vendorContact: prodVendorContact,
        stock: prodStock,
        minQtyAlert: prodMinQty,
        description: prodDesc
      });
    } else {
      onAddProduct({
        name: prodName,
        category: prodCategory,
        location: prodLocation,
        hsnCode: prodHsn,
        price: prodPrice,
        purchasePrice: prodPurchasePrice,
        vendorName: prodVendorName,
        vendorContact: prodVendorContact,
        stock: prodStock,
        minQtyAlert: prodMinQty,
        description: prodDesc
      });
    }
    setShowAddProduct(false);
  };

  const filteredProducts = products.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(searchLower) || 
      (p.hsnCode && p.hsnCode.toLowerCase().includes(searchLower)) ||
      (p.vendorName && p.vendorName.toLowerCase().includes(searchLower)) ||
      (p.vendorContact && p.vendorContact.toLowerCase().includes(searchLower)) ||
      (p.category && p.category.toLowerCase().includes(searchLower)) ||
      (p.location && p.location.toLowerCase().includes(searchLower));
    const matchesCategory = selectedCategoryFilter === 'All' || p.category === selectedCategoryFilter;
    const matchesRack = selectedRackFilter === 'All' || p.location === selectedRackFilter;
    return matchesSearch && matchesCategory && matchesRack;
  });

  return (
    <div className="space-y-6">
      {/* Header controls block */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Products & Stock Room <span className="text-xs font-semibold bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{products.length} Spares Listed</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Track parts levels, configure low-stock alerts, and manage warehouse location bins.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isStaff ? (
            <div className="text-xs font-bold text-teal-800 bg-teal-50 px-3.5 py-2 rounded-xl border border-teal-200 flex items-center gap-1.5">
              <span>👁️ Staff Access: Inventory Catalog View-Only</span>
            </div>
          ) : (
            <>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <Layers className="w-4 h-4" />
                Manage Categories
              </button>
              <button
                onClick={() => setShowRackModal(true)}
                className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
                Manage Locations
              </button>
              <button
                onClick={handleOpenAddProduct}
                id="add-product-btn"
                className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Product / Part
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stock metrics tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stock-metrics">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Listed Spares</span>
            <span className="text-xl font-extrabold text-slate-800 font-mono">{products.length} Items</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Low Stock Alert</span>
            <span className={`text-xl font-extrabold font-mono ${lowStockItemsCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {lowStockItemsCount} Alert{lowStockItemsCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {isStaff ? (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4 sm:col-span-2">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Configured Storage Bins</span>
              <span className="text-xl font-extrabold text-slate-800 font-mono">{racks.length} Locations</span>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Purchase Cost</span>
                <span className="text-xl font-extrabold text-blue-700 font-mono">₹{totalPurchaseValue.toLocaleString('en-IN')}.00</span>
                <span className="text-[9px] text-slate-400 block -mt-0.5">Org investment</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Selling Valuation</span>
                <span className="text-xl font-extrabold text-emerald-700 font-mono">₹{totalStockValue.toLocaleString('en-IN')}.00</span>
                <span className="text-[9px] text-slate-400 block -mt-0.5">Retail inventory</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Table view */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {/* Filter bars header */}
        <div className="p-4 border-b border-slate-50 bg-slate-50/40 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search spare name, vendor supplier, HSN code, or bin..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 font-semibold text-slate-600"
            >
              <option value="All">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={selectedRackFilter}
              onChange={(e) => setSelectedRackFilter(e.target.value)}
              className="border border-slate-200 bg-white rounded-xl px-3 py-2 font-semibold text-slate-600"
            >
              <option value="All">All Locations</option>
              {racks.map(r => (
                <option key={r.id} value={r.name}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stock List table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Action</th>
                <th className="py-3.5 px-5">Product Name</th>
                <th className="py-3.5 px-5">Category</th>
                <th className="py-3.5 px-5">Vendor / Supplier</th>
                <th className="py-3.5 px-5">HSN Code</th>
                <th className="py-3.5 px-5">Rack Bin</th>
                {!isStaff && (
                  <>
                    <th className="py-3.5 px-5 text-right">Purchase Cost</th>
                    <th className="py-3.5 px-5 text-right">Selling Price</th>
                  </>
                )}
                <th className="py-3.5 px-5 text-center">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((prod) => {
                  const isLow = prod.stock <= prod.minQtyAlert;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-5 flex items-center gap-1.5">
                        {isStaff ? (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">View Only</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenEditProduct(prod)}
                              title="Edit Stock details"
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete ${prod.name} from inventory catalog?`)) {
                                  onDeleteProduct(prod.id);
                                }
                              }}
                              title="Delete Product"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>

                      <td className="py-3 px-5">
                        <div>
                          <p className="font-semibold text-slate-800">{prod.name}</p>
                          {prod.description && <p className="text-[10px] text-slate-400 italic">{prod.description}</p>}
                        </div>
                      </td>

                      <td className="py-3 px-5 font-bold text-slate-600">{prod.category}</td>

                      <td className="py-3 px-5">
                        {prod.vendorName ? (
                          <div>
                            <p className="font-bold text-slate-700 flex items-center gap-1">
                              <Store className="w-3 h-3 text-teal-600 shrink-0" />
                              <span>{prod.vendorName}</span>
                            </p>
                            {prod.vendorContact && (
                              <p className="text-[10px] text-slate-400 font-mono">{prod.vendorContact}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-5 font-mono text-slate-500">{prod.hsnCode || '—'}</td>

                      <td className="py-3 px-5">
                        <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 font-bold border border-slate-100 px-2 py-0.5 rounded">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {prod.location}
                        </span>
                      </td>

                      {!isStaff && (
                        <>
                          <td className="py-3 px-5 text-right font-mono font-bold text-blue-700">
                            ₹{(prod.purchasePrice || 0).toLocaleString('en-IN')}.00
                          </td>
                          <td className="py-3 px-5 text-right font-mono font-bold text-emerald-700">
                            ₹{prod.price.toLocaleString('en-IN')}.00
                          </td>
                        </>
                      )}

                      <td className="py-3 px-5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 font-bold font-mono px-2.5 py-0.5 rounded-full text-xs ${
                            isLow ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                        >
                          {isLow && <AlertTriangle className="w-3 h-3" />}
                          {prod.stock}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isStaff ? 7 : 9} className="text-center py-8 text-slate-400 italic">
                    No products found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showAddProduct && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddProduct(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-slide-up cursor-default max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-teal-600" />
                {editingProduct ? 'Edit Product & Purchase Details' : 'Add New Product & Purchase Source'}
              </h2>
              <button onClick={() => setShowAddProduct(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 space-y-3 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Product / Part Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asus Vivobook Charger 65W"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Category</label>
                  <select
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Rack Location</label>
                  <select
                    value={prodLocation}
                    onChange={(e) => setProdLocation(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-semibold text-slate-700"
                  >
                    {racks.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>

                {/* Vendor Details Section */}
                <div className="sm:col-span-2 bg-slate-50/80 border border-slate-200/80 rounded-xl p-2.5 space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-slate-600 flex items-center gap-1">
                    <Store className="w-3.5 h-3.5 text-teal-600" />
                    Vendor / Supplier Information (Where product was purchased)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="block font-bold text-slate-500 uppercase text-[9px]">Vendor / Supplier Name</label>
                      <input
                        type="text"
                        placeholder="e.g. CompuWorld / Wholesale Spares"
                        value={prodVendorName}
                        onChange={(e) => setProdVendorName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="block font-bold text-slate-500 uppercase text-[9px]">Vendor Contact / Invoice Ref</label>
                      <input
                        type="text"
                        placeholder="e.g. 9811002233 / PO #2026-10"
                        value={prodVendorContact}
                        onChange={(e) => setProdVendorContact(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing Section: Purchase Cost vs Selling Price */}
                <div className="space-y-1">
                  <label className="block font-bold text-blue-700 uppercase text-[10px]">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={prodPurchasePrice === 0 ? '' : prodPurchasePrice}
                    onChange={(e) => setProdPurchasePrice(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full border border-blue-200 bg-blue-50/30 rounded-xl px-3 py-1.5 font-mono text-right font-bold text-blue-800"
                  />
                  <span className="text-[9px] text-slate-400 block">Organisation buy cost</span>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-emerald-700 uppercase text-[10px]">Selling Price (₹)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={prodPrice === 0 ? '' : prodPrice}
                    onChange={(e) => setProdPrice(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full border border-emerald-200 bg-emerald-50/30 rounded-xl px-3 py-1.5 font-mono text-right font-bold text-emerald-800"
                  />
                  <span className="text-[9px] text-slate-400 block">Customer bill rate</span>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 84713010"
                    value={prodHsn}
                    onChange={(e) => setProdHsn(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Starting Stock</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={prodStock === 0 ? '' : prodStock}
                    onChange={(e) => setProdStock(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-center font-bold"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Min Alert Stock Qty</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={prodMinQty === 0 ? '' : prodMinQty}
                    onChange={(e) => setProdMinQty(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-center"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Description / Notes</label>
                <textarea
                  placeholder="Additional specifications"
                  rows={1}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5"
                />
              </div>

              <div className="p-2 bg-amber-50 border border-amber-200/80 rounded-xl text-[10px] text-amber-900 font-medium">
                💡 <strong>Note:</strong> The purchase cost is exclusively for internal stock accounting and is never printed or displayed on customer invoice bills.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProduct(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition cursor-pointer text-xs"
                >
                  Save Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCategoryModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">Manage Stock Categories</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Category creation */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newCatName.trim()) {
                    onAddCategory(newCatName.trim());
                    setNewCatName('');
                    setTimeout(() => catInputRef.current?.focus(), 0);
                  }
                }}
                className="flex gap-2 items-center"
              >
                <input
                  ref={catInputRef}
                  type="text"
                  placeholder="New category name"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newCatName.trim()) {
                        onAddCategory(newCatName.trim());
                        setNewCatName('');
                        setTimeout(() => catInputRef.current?.focus(), 0);
                      }
                    }
                  }}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2"
                />
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Add
                </button>
              </form>

              {/* Category list */}
              <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {categories.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 capitalize">{c.name}</td>
                        <td className="p-3 text-right">
                          {onDeleteCategory && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete category "${c.name}"?`)) {
                                  onDeleteCategory(c.id);
                                }
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                              title="Delete Category"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Management Modal */}
      {showRackModal && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRackModal(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-sm w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">Manage Rack Locations</h2>
              <button onClick={() => setShowRackModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newRackName.trim()) {
                    onAddRack(newRackName.trim());
                    setNewRackName('');
                    setTimeout(() => rackInputRef.current?.focus(), 0);
                  }
                }}
                className="flex gap-2 items-center"
              >
                <input
                  ref={rackInputRef}
                  type="text"
                  placeholder="e.g. Rack 4"
                  value={newRackName}
                  onChange={(e) => setNewRackName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newRackName.trim()) {
                        onAddRack(newRackName.trim());
                        setNewRackName('');
                        setTimeout(() => rackInputRef.current?.focus(), 0);
                      }
                    }
                  }}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2"
                />
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  Add
                </button>
              </form>

              <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {racks.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">{r.name}</td>
                        <td className="p-3 text-right">
                          {onDeleteRack && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Delete rack location "${r.name}"?`)) {
                                  onDeleteRack(r.id);
                                }
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                              title="Delete Location Rack"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
