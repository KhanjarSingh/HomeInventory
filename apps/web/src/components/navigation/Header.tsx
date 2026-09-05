'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { Package, LogOut, LogIn, Home, Shield, User, MapPin } from 'lucide-react';

export function Header() {
  const { user, activeHousehold, isAuthenticated, logout, isLoading } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            Owner
          </span>
        );
      case 'editor':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Editor
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Viewer (Read-Only)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition">
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
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {isAuthenticated && (
          <nav className="flex items-center gap-2">
            <Link
              href="/locations"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition"
            >
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Locations</span>
            </Link>
          </nav>
        )}

        {isLoading ? (
          <div className="text-xs text-slate-400">Loading profile...</div>
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-3 bg-white p-2 px-3 rounded-xl border border-slate-200 shadow-sm">
            {activeHousehold && (
              <div className="flex items-center gap-2 border-r border-slate-200 pr-3">
                <Home className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-800">
                  {activeHousehold.name}
                </span>
                {getRoleBadge(activeHousehold.role)}
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-700">
                {user.fullName.charAt(0)}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                {user.fullName}
              </span>
            </div>

            <button
              onClick={() => logout()}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm transition"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
            >
              <User className="w-4 h-4" />
              <span>Register</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
