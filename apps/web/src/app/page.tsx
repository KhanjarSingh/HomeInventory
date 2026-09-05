'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '../components/navigation/Header';
import { useAuth } from '../hooks/useAuth';
import { ProfileUnlock } from '../components/auth/ProfileUnlock';
import {
  MapPin,
  Box,
  Layers,
  ArrowRight,
  Shield,
  LogOut,
  Loader2,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  const { user, activeHousehold, isAuthenticated, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
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

  // Authenticated experience: Clean, warm household inventory dashboard
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Header */}
        <Header />

        {/* Welcome Banner */}
        <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{activeHousehold?.name || "Tandalwade's Residency"}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Welcome home, {user.fullName}!
            </h2>
            <p className="text-sm text-slate-500 max-w-xl">
              Digital twin for your home. Find items and storage containers across your rooms, wardrobes, and shelves without opening boxes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/locations"
              className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-xs transition"
            >
              <MapPin className="w-4 h-4" />
              <span>Explore Locations</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={logout}
              title="Lock / Switch Profile"
              className="p-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-2xl transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Core Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Physical Hierarchy */}
          <Link
            href="/locations"
            className="group bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition duration-200 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                  Physical Hierarchy
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Browse the 7 real-home areas (Small Bedroom, Big Bedroom, Hall, Passage, Kitchen, Store Room, Attic) and nested furniture.
                </p>
              </div>
            </div>
            <div className="text-xs font-semibold text-blue-600 flex items-center gap-1">
              <span>View 7 Areas</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </Link>

          {/* Card 2: Movable Storage Containers */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Box className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Storage Boxes & Totes
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Track movable storage boxes, crates, and pouches placed inside your wardrobes and shelves with nested items.
                </p>
              </div>
            </div>
            <Link
              href="/locations"
              className="text-xs font-semibold text-amber-700 flex items-center gap-1 hover:underline"
            >
              <span>Explore in Locations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Card 3: Family Household Profiles */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Family Profiles
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Private household access for Vithal, Shailaja (Owners) and Rutuja, Parth (Editors).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-500 font-medium">Active: {user.fullName} ({activeHousehold?.role})</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
