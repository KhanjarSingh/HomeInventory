'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/navigation/Header';
import { useAuth } from '../hooks/useAuth';
import {
  MapPin,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Lock,
  Users,
  Home,
  ArrowRight,
} from 'lucide-react';
import type { HealthCheckDto } from '@home-inventory/shared';

async function getHealth(): Promise<HealthCheckDto> {
  const res = await fetch('http://localhost:4000/health');
  if (!res.ok) throw new Error('API server unreachable');
  const json = await res.json();
  return json.data;
}

export default function HomePage() {
  const { user, activeHousehold, households, isAuthenticated, switchHousehold } = useAuth();

  const { data: health, isLoading: healthLoading, error: healthError } = useQuery({
    queryKey: ['system-health'],
    queryFn: getHealth,
    refetchInterval: 10000,
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation Header with Auth Controls */}
        <Header />

        {/* System Health Status Indicator */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {health?.status === 'ok' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              )}
            </span>
            <span className="text-slate-600">
              API Cluster:{' '}
              <strong className="text-slate-800 font-semibold">
                {healthLoading ? 'Connecting...' : healthError ? 'Offline (Port 4000)' : 'Online & Healthy'}
              </strong>
            </span>
          </div>

          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            PostgreSQL: {health?.services.database ?? 'unknown'} | Cloudinary: {health?.services.cloudinary ?? 'ready'}
          </div>
        </div>

        {/* Authenticated User Session or Login Prompt */}
        {isAuthenticated && user ? (
          <section className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-6 md:p-8 shadow-lg space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Active Session Verified
                  </span>
                  <span className="text-xs text-blue-200 font-mono">ID: {user.id.slice(0, 8)}...</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Welcome back, {user.fullName}!</h2>
                <p className="text-sm text-blue-200">{user.email}</p>
              </div>

              {activeHousehold && (
                <div className="p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 space-y-1 min-w-[240px]">
                  <div className="text-xs text-blue-200 font-medium flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5" /> Active Household
                  </div>
                  <div className="text-lg font-bold text-white flex items-center justify-between">
                    <span>{activeHousehold.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/40 text-blue-100 uppercase tracking-wider font-semibold">
                      {activeHousehold.role}
                    </span>
                  </div>
                  <div className="text-xs text-blue-300/80 font-mono truncate">
                    Household ID: {activeHousehold.id}
                  </div>
                </div>
              )}
            </div>

            {/* Household Switcher if member of multiple */}
            {households.length > 1 && (
              <div className="pt-4 border-t border-white/10 space-y-2">
                <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
                  Switch Active Household:
                </div>
                <div className="flex flex-wrap gap-2">
                  {households.map((h) => {
                    const isCurrent = h.id === activeHousehold?.id;
                    return (
                      <button
                        key={h.id}
                        onClick={() => switchHousehold(h.id)}
                        disabled={isCurrent}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                          isCurrent
                            ? 'bg-white text-blue-900 font-bold cursor-default shadow-sm'
                            : 'bg-white/15 text-white hover:bg-white/25'
                        }`}
                      >
                        {h.name} ({h.role}) {isCurrent && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
                  <Lock className="w-4 h-4" />
                  <span>Phase 2: Authentication & RBAC Household Isolation Active</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                  Secure Household Sign-In
                </h2>
                <p className="text-sm text-slate-500">
                  Log in to access your household inventory with strict role-based permissions (Owner, Editor, Viewer).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 shadow-sm transition inline-flex items-center gap-2"
                >
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition"
                >
                  Register
                </Link>
              </div>
            </div>

            {/* Quick Demo Personas */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Pre-Seeded Test Personas (Password: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">Password123!</code>):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="font-semibold text-purple-700">👑 Household Owner</div>
                  <div className="text-slate-600 font-mono">owner@home.local</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">Full household admin & member management</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="font-semibold text-blue-700">✏️ Household Editor</div>
                  <div className="text-slate-600 font-mono">editor@home.local</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">Manage items, containers & locations</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                  <div className="font-semibold text-slate-700">👁️ Household Viewer</div>
                  <div className="text-slate-600 font-mono">viewer@home.local</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">Strict read-only inventory browsing</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Milestone Cards (Phase 0, Phase 1, Phase 2) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Phase 0 Verified
              </span>
            </div>
            <h3 className="font-semibold text-slate-900">Scaffold & Architecture</h3>
            <p className="text-sm text-slate-500">
              Node.js 24 runtime, Next.js 15 App Router, Express 5, strict TypeScript, Neon DB pooling, and signed Cloudinary storage.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                Phase 1 Verified
              </span>
            </div>
            <h3 className="font-semibold text-slate-900">Real Home Hierarchy</h3>
            <p className="text-sm text-slate-500">
              7 top-level areas (Small & Big Bedroom, Hall, Passage, Kitchen, Store Room, Attic), nested containers, and split quantities.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                Phase 2 Complete
              </span>
            </div>
            <h3 className="font-semibold text-slate-900">Auth & Household Isolation</h3>
            <p className="text-sm text-slate-500">
              Argon2id password hashing, JWT + rotating refresh tokens with reuse detection, RBAC middleware, and composite foreign keys.
            </p>
          </div>
        </section>

        {/* Live Diagnostics Card */}
        <section className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold text-slate-100">Live Health Diagnostics</h2>
            </div>
            <span className="text-xs text-slate-400">GET /health</span>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto border border-slate-800">
            {healthLoading
              ? 'Querying API health check at http://localhost:4000/health...'
              : healthError
              ? JSON.stringify({ error: (healthError as Error).message, note: 'Ensure API server is running on port 4000' }, null, 2)
              : JSON.stringify(health, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}

