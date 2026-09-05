'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { fetchApi, ApiClientError } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type { ItemSummaryDto, CategoryDto } from '@home-inventory/shared';
import { BreadcrumbBadge } from '../../components/placements/BreadcrumbBadge';
import {
  Package,
  Camera,
  Search,
  Plus,
  Box,
  Tag,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Filter,
  X,
} from 'lucide-react';

export default function ItemsListPage() {
  const { activeHousehold, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [items, setItems] = useState<ItemSummaryDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedCategory) params.set('categoryId', selectedCategory);

      const queryString = params.toString() ? `?${params.toString()}` : '';

      const [itemsRes, catsRes] = await Promise.all([
        fetchApi<ItemSummaryDto[]>(`/items${queryString}`),
        fetchApi<CategoryDto[]>('/categories'),
      ]);

      setItems(itemsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load inventory items');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 font-medium">Checking authorization...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 sm:pb-8">
      {/* Top Banner & Quick Add Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Package className="w-7 h-7 text-blue-600" />
            <span>Household Inventory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Catalogue of all items, tools, and objects in {activeHousehold?.name || "your home"}.
          </p>
        </div>

        <Link
          href="/items/quick-capture"
          className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition min-h-[48px] active:scale-98"
        >
          <Camera className="w-5 h-5" />
          <span>Quick Add Item</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-2xl text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px] shadow-2xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category horizontal scrolling pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition min-h-[36px] ${
              selectedCategory === ''
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition min-h-[36px] ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Item List / Cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-medium">Loading items...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">No Items Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {search || selectedCategory
                ? 'Try adjusting your search or category filter.'
                : 'Start cataloguing your home inventory with the camera.'}
            </p>
          </div>
          <Link
            href="/items/quick-capture"
            className="inline-flex items-center gap-2 py-3 px-5 rounded-2xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition"
          >
            <Camera className="w-4 h-4" />
            <span>Take First Photo</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/items/${item.id}`}
              className="group bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-blue-300 hover:shadow-md transition-all overflow-hidden flex flex-col"
            >
              <div className="flex items-start p-3.5 gap-3">
                {/* Thumbnail */}
                <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  {item.primaryImage ? (
                    <Image
                      src={item.primaryImage.secureUrl || item.primaryImage.url}
                      alt={item.name}
                      fill
                      className="object-cover group-hover:scale-105 transition duration-200"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                  {item.isContainer && (
                    <span className="absolute top-1 left-1 p-1 bg-amber-500 text-white rounded-md shadow-xs">
                      <Box className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1.5">
                    {item.categoryName ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md uppercase tracking-wider truncate">
                        {item.categoryName}
                      </span>
                    ) : (
                      <span />
                    )}
                    {item.priceMinor != null && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0">
                        ₹{(item.priceMinor / 100).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                    {item.name}
                  </h3>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span>
                      {item.totalQuantity} {item.unit}
                    </span>
                    {item.unplacedQuantity > 0 && (
                      <span className="text-[11px] text-amber-600 font-normal">
                        ({item.unplacedQuantity} unplaced)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Physical Breadcrumbs Footer */}
              <div className="mt-auto px-3.5 py-2 bg-slate-50/70 border-t border-slate-100 text-[11px]">
                <BreadcrumbBadge
                  breadcrumbs={item.breadcrumbs}
                  breadcrumbString={item.breadcrumbString}
                  size="sm"
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Floating Action Button (FAB) for Mobile Quick Add */}
      <div className="fixed bottom-5 right-5 sm:hidden z-30">
        <Link
          href="/items/quick-capture"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 transition active:scale-95"
          aria-label="Quick Add Item"
        >
          <Camera className="w-7 h-7" />
        </Link>
      </div>
    </div>
  );
}
