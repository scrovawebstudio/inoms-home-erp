/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  X,
  TrendingDown,
  Percent,
  CheckCircle,
  FileText
} from 'lucide-react';
import { Expense } from '../types';

interface ExpensesProps {
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
}

export default function Expenses({
  expenses,
  onAddExpense,
  onDeleteExpense
}: ExpensesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Form states
  const [expenseCat, setExpenseCat] = useState('STAFF PAYMENT');
  const [expenseAmt, setExpenseAmt] = useState<number>(0);
  const [expenseRemarks, setExpenseRemarks] = useState('');

  // Computations
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Group by category percentages
  const catTotals = expenses.reduce((acc, curr) => {
    const cat = curr.category.toUpperCase();
    acc[cat] = (acc[cat] || 0) + curr.amount;
    return acc;
  }, {} as { [key: string]: number });

  const catPercentages = Object.entries(catTotals).map(([cat, amt]) => ({
    category: cat,
    amount: amt,
    percent: totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0
  })).sort((a, b) => b.amount - a.amount);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (expenseAmt <= 0) {
      alert('Expense amount must be greater than zero.');
      return;
    }
    onAddExpense({
      date: new Date().toISOString().split('T')[0],
      category: expenseCat,
      amount: expenseAmt,
      remarks: expenseRemarks
    });
    setShowAddExpense(false);
  };

  const filteredExpenses = expenses.filter(e =>
    e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.remarks && e.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Expense Management <span className="text-xs font-semibold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">₹{totalExpenses.toLocaleString('en-IN')} Total Outlays</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Audit operational outlays, staff advances, and track itemized category percentages.</p>
        </div>
        <div>
          <button
            onClick={() => setShowAddExpense(true)}
            id="record-expense-btn"
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shadow-sm hover:shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>
      </div>

      {/* Main Grid: List and Category Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: List of logs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/40">
            <div className="relative">
              <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search expenses by category or remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-6">Action</th>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Category</th>
                  <th className="py-3 px-6">Remarks</th>
                  <th className="py-3 px-6 text-right">Amount Outlayed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredExpenses.length > 0 ? (
                  filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-6">
                        <button
                          onClick={() => {
                            if (confirm('Delete this expense entry?')) {
                              onDeleteExpense(exp.id);
                            }
                          }}
                          className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      <td className="py-2.5 px-6 font-mono text-slate-500">{exp.date}</td>
                      <td className="py-2.5 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {exp.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-6 text-slate-500">{exp.remarks || '—'}</td>
                      <td className="py-2.5 px-6 text-right font-mono font-bold text-rose-600">
                        ₹{exp.amount.toLocaleString('en-IN')}.00
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-slate-400 italic">
                      No expense records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Category Percentage Breakdown Progress bars */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-5">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
              <Percent className="w-4 h-4 text-rose-500" />
              Category Breakdown
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">Operational budget allocation percentages.</p>
          </div>

          <div className="space-y-4">
            {catPercentages.length > 0 ? (
              catPercentages.map((item, i) => (
                <div key={i} className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-slate-600 font-semibold">
                    <span className="capitalize">{item.category.toLowerCase()}</span>
                    <span className="font-mono font-bold">
                      ₹{item.amount.toLocaleString('en-IN')} ({item.percent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        i === 0
                          ? 'bg-rose-500'
                          : i === 1
                          ? 'bg-amber-500'
                          : i === 2
                          ? 'bg-teal-500'
                          : 'bg-slate-400'
                      }`}
                      style={{ width: `${item.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 italic">
                No expense data logged to display percentages.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Record Expense Modal */}
      {showAddExpense && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddExpense(false);
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-slide-up cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xs font-bold text-slate-800">Record Shop Expense</h2>
              <button onClick={() => setShowAddExpense(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-2.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Expense Category</label>
                  <select
                    value={expenseCat}
                    onChange={(e) => setExpenseCat(e.target.value)}
                    className="w-full border border-slate-200 bg-white rounded-xl px-3 py-1.5 font-bold text-slate-700"
                  >
                    <option value="STAFF PAYMENT">Staff Salary Payment</option>
                    <option value="BEER">Beverages / Beer</option>
                    <option value="CIGARETTE">Cigarettes</option>
                    <option value="RENT">Shop Rent</option>
                    <option value="UTILITIES">Electricity & Internet</option>
                    <option value="OTHERS">Others / Misc</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-500 uppercase text-[10px]">Amount Outlayed (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={expenseAmt === 0 ? '' : expenseAmt}
                    onChange={(e) => setExpenseAmt(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-1.5 font-mono text-sm font-bold text-rose-600 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-500 uppercase text-[10px]">Remarks / Details</label>
                <input
                  type="text"
                  placeholder="e.g. Paid cash advance to assistant"
                  value={expenseRemarks}
                  onChange={(e) => setExpenseRemarks(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition cursor-pointer text-xs"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
