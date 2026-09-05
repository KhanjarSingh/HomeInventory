'use client';

import React, { useState } from 'react';
import { fetchApi, ApiClientError } from '../../lib/api';
import type { ItemDetailDto } from '@home-inventory/shared';
import { X, Loader2 } from 'lucide-react';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: ItemDetailDto;
}

export function EditItemModal({ isOpen, onClose, onSuccess, item }: EditItemModalProps) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.totalQuantity);
  const [price, setPrice] = useState(
    item.latestPrice != null ? String(item.latestPrice.amountMinor / 100) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Item name is required');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: any = {
        name: name.trim(),
        totalQuantity: quantity,
        version: item.version,
      };

      if (price.trim()) {
        const parsedPrice = parseFloat(price.trim());
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          payload.purchasePrice = parsedPrice;
          payload.currency = item.latestPrice?.currency || 'INR';
        }
      }

      await fetchApi(`/items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to save changes. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900">Edit Item</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Quantity ({item.unit})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Price (₹)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-bold text-slate-400 select-none">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-7 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
