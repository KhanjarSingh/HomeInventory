'use client';

import { useQuery } from '@tanstack/react-query';
import { Package, MapPin, Box, ShieldCheck, Activity, CheckCircle2, ArrowRight } from 'lucide-react';
import type { HealthCheckDto } from '@home-inventory/shared';

async function getHealth(): Promise<HealthCheckDto> {
  const res = await fetch('http://localhost:4000/health');
  if (!res.ok) throw new Error('API server unreachable');
  const json = await res.json();
  return json.data;
}

export default function HomePage() {
  const { data: health, isLoading, error } = useQuery({
    queryKey: ['system-health'],
    queryFn: getHealth,
    refetchInterval: 10000,
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Home Inventory System
              </h1>
              <p className="text-sm text-slate-500">
                Single source of truth for all physical items in your home
              </p>
            </div>
          </div>

          {/* System Status Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border bg-white shadow-sm text-sm">
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
            <span className="font-medium text-slate-700">
              API Status: {isLoading ? 'Checking...' : error ? 'Offline' : health?.status?.toUpperCase()}
            </span>
          </div>
        </header>

        {/* Phase 0 Architecture Status Banner */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            <span>Phase 0: Architecture & Scaffold Initialized</span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            The monorepo scaffold is online with TypeScript strict mode, Express 5 REST API, Next.js 15 App Router,
            Neon PostgreSQL connection pooling, and shared validation models.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Backend API</div>
              <div className="text-lg font-bold text-slate-800">Node.js 20+ Express 5</div>
              <div className="text-xs text-slate-500">Port 4000 (REST & Health API)</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database</div>
              <div className="text-lg font-bold text-slate-800">Neon PostgreSQL</div>
              <div className="text-xs text-slate-500">Drizzle ORM & pg_trgm</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Frontend</div>
              <div className="text-lg font-bold text-slate-800">Next.js 15+</div>
              <div className="text-xs text-slate-500">Tailwind CSS v4 & shadcn/ui</div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Preview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl w-fit">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-900">Hierarchical Locations</h3>
            <p className="text-sm text-slate-500">
              Materialized path tree modeling fixed places from entire rooms down to individual shelves.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl w-fit">
              <Box className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-900">Smart Containers</h3>
            <p className="text-sm text-slate-500">
              Boxes and bins that house items and move atomically without unpacking their contents.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-slate-900">Strict Invariants</h3>
            <p className="text-sm text-slate-500">
              Transactional integrity guarantees total stock matches all distributed placements.
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
            <span className="text-xs text-slate-400">Endpoint: /health</span>
          </div>

          <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto border border-slate-800">
            {isLoading
              ? 'Querying API health check at http://localhost:4000/health...'
              : error
              ? JSON.stringify({ error: (error as Error).message, note: 'Ensure API server is running on port 4000' }, null, 2)
              : JSON.stringify(health, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
