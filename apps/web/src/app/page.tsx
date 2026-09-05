'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '../components/navigation/Header';
import { useAuth } from '../hooks/useAuth';
import { ProfileUnlock } from '../components/auth/ProfileUnlock';
import { fetchApi } from '../lib/api';
import type { LocationTreeItemDto, ItemSummaryDto } from '@home-inventory/shared';
import {
  MapPin,
  Box,
  Package,
  ArrowRight,
  Shield,
  LogOut,
  Loader2,
  Sparkles,
  Camera,
  Sofa,
  BedSingle,
  BedDouble,
  Footprints,
  Utensils,
  Warehouse,
  Search,
} from 'lucide-react';

function getRoomIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('hall')) return <Sofa className="w-5 h-5 text-emerald-600" />;
  if (lower.includes('small bedroom')) return <BedSingle className="w-5 h-5 text-blue-600" />;
  if (lower.includes('big bedroom')) return <BedDouble className="w-5 h-5 text-indigo-600" />;
  if (lower.includes('passage')) return <Footprints className="w-5 h-5 text-slate-600" />;
  if (lower.includes('kitchen')) return <Utensils className="w-5 h-5 text-amber-600" />;
  if (lower.includes('attic')) return <Warehouse className="w-5 h-5 text-purple-600" />;
  return <MapPin className="w-5 h-5 text-blue-600" />;
}

function getRoomBg(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('hall')) return 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-400';
  if (lower.includes('small bedroom')) return 'bg-blue-50/60 border-blue-200 hover:border-blue-400';
  if (lower.includes('big bedroom')) return 'bg-indigo-50/60 border-indigo-200 hover:border-indigo-400';
  if (lower.includes('passage')) return 'bg-slate-50/80 border-slate-200 hover:border-slate-400';
  if (lower.includes('kitchen')) return 'bg-amber-50/60 border-amber-200 hover:border-amber-400';
  if (lower.includes('attic')) return 'bg-purple-50/60 border-purple-200 hover:border-purple-400';
  return 'bg-white border-slate-200 hover:border-blue-300';
}

export default function HomePage() {
  const { user, activeHousehold, isAuthenticated, isLoading, logout } = useAuth();
  const [locations, setLocations] = useState<LocationTreeItemDto[]>([]);
  const [items, setItems] = useState<ItemSummaryDto[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;
    setIsLoadingData(true);

    Promise.all([
      fetchApi<LocationTreeItemDto[]>('/locations'),
      fetchApi<ItemSummaryDto[]>('/items'),
    ])
      .then(([locsRes, itemsRes]) => {
        if (isMounted) {
          setLocations(locsRes.data || []);
          setItems(itemsRes.data || []);
        }
      })
      .catch(() => {
        // Silently handle if offline
      })
      .finally(() => {
        if (isMounted) setIsLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Unauthenticated experience: Minimalist profile selection & PIN unlock
  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6">
        <ProfileUnlock />
      </main>
    );
  }

  const firstName = user.fullName.split(' ')[0] || user.fullName;

  // Authenticated experience: Mobile-first, touch-friendly home inventory
  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-6 md:p-8 pb-24 md:pb-12">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Navigation Header */}
        <Header />

        {/* Compact Mobile Welcome Bar */}
        <section className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-1">
              <Sparkles className="w-3 h-3 text-blue-600 shrink-0" />
              <span className="truncate">{activeHousehold?.name || "Tandalwade's Residency"}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
              Welcome, {firstName}!
            </h1>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              Select a room below or snap a photo to catalogue items.
            </p>
          </div>

          <Link
            href="/items/quick-capture"
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span className="hidden sm:inline">Add Item</span>
            <span className="sm:hidden">+ Add</span>
          </Link>
        </section>

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <Link
            href="/items"
            className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-emerald-300 transition text-center sm:text-left"
          >
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Total Items
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5">
              {items.length}
            </div>
          </Link>

          <Link
            href="/locations"
            className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-blue-300 transition text-center sm:text-left"
          >
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Rooms
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5">
              {locations.length > 0 ? locations.length : 6}
            </div>
          </Link>

          <Link
            href="/containers"
            className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-amber-300 transition text-center sm:text-left"
          >
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Boxes
            </div>
            <div className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5">
              0
            </div>
          </Link>
        </div>

        {/* Home Locations (Direct Access Touch Grid) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Home Locations
              </h2>
            </div>
            <Link
              href="/locations"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoadingData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
              {locations.map((loc) => {
                const icon = getRoomIcon(loc.name);
                const bgStyle = getRoomBg(loc.name);
                const itemCount = loc.directItemCount || 0;

                return (
                  <Link
                    key={loc.id}
                    href={`/locations/${loc.id}`}
                    className={`group p-3.5 sm:p-5 rounded-2xl border transition-all duration-150 active:scale-98 flex flex-col justify-between min-h-[96px] sm:min-h-[110px] ${bgStyle}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="p-2 rounded-xl bg-white shadow-2xs shrink-0">
                        {icon}
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition" />
                    </div>

                    <div className="mt-2">
                      <div className="font-bold text-sm sm:text-base text-slate-900 leading-snug truncate">
                        {loc.name}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Primary Mobile Action Banner: Camera-First Capture */}
        <section className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-xs">
              📸 Camera First
            </div>
            <h3 className="text-lg sm:text-xl font-black tracking-tight">
              Start Cataloguing Items
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 max-w-md">
              Walk around Tandalwade's Residency with your phone. Take a photo, enter quantity, and choose a room.
            </p>
          </div>

          <Link
            href="/items/quick-capture"
            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm rounded-2xl shadow-md transition active:scale-95 shrink-0"
          >
            <Camera className="w-5 h-5 text-blue-600" />
            <span>Open Camera & Add</span>
          </Link>
        </section>

        {/* Quick Search Shortcut */}
        <Link
          href="/items"
          className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition text-slate-400 text-xs sm:text-sm"
        >
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <span>Search items across Hall, Bedrooms, Kitchen...</span>
        </Link>
      </div>
    </main>
  );
}
