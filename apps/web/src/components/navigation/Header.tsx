'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import {
  Package,
  LogOut,
  LogIn,
  Home,
  Shield,
  User,
  MapPin,
  Box,
  Camera,
  Menu,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

export function Header() {
  const pathname = usePathname();
  const { user, activeHousehold, isAuthenticated, logout, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            Owner
          </span>
        );
      case 'editor':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            Editor
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Viewer
          </span>
        );
      default:
        return null;
    }
  };

  const navLinks = [
    { href: '/items', label: 'Items', icon: Package, color: 'text-emerald-600', description: 'Browse all items and photos' },
    { href: '/locations', label: 'Locations', icon: MapPin, color: 'text-blue-600', description: 'Hall, Bedrooms, Kitchen, Attic' },
    { href: '/containers', label: 'Containers', icon: Box, color: 'text-amber-600', description: 'Storage boxes and crates' },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-3 transition">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 text-white rounded-xl shadow-xs flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
                Home Inventory
              </div>
              <div className="text-[11px] font-medium text-slate-400 hidden sm:block truncate">
                {activeHousehold?.name || "Tandalwade's Residency"}
              </div>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1.5">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : item.color}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <Link
                href="/items/quick-capture"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition ml-1"
              >
                <Camera className="w-4 h-4" />
                <span>+ Quick Add</span>
              </Link>
            </nav>
          )}

          {/* User Profile / Mobile Menu Trigger */}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="text-xs text-slate-400">Loading...</div>
            ) : isAuthenticated && user ? (
              <>
                {/* Desktop User Pill */}
                <div className="hidden md:flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 p-1.5 px-3 rounded-2xl border border-slate-200/80 transition">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                    {user.fullName.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-800 leading-tight">
                      {user.fullName}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {getRoleBadge(activeHousehold?.role)}
                    </div>
                  </div>
                  <button
                    onClick={() => logout()}
                    title="Lock / Switch Profile"
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition ml-1 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile Quick Add Icon */}
                <Link
                  href="/items/quick-capture"
                  className="flex md:hidden items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 shadow-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>+ Add</span>
                </Link>

                {/* Mobile Menu Toggle Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl md:hidden transition cursor-pointer"
                  aria-label="Toggle navigation menu"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl shadow-xs"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu (Listed cleanly when expanded) */}
        {mobileMenuOpen && isAuthenticated && (
          <div className="md:hidden pt-4 pb-2 border-t border-slate-200/80 mt-3 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Household & Profile Card */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  {user?.fullName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 leading-snug">
                    {user?.fullName}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span>{activeHousehold?.name || "Tandalwade's Residency"}</span>
                    <span>•</span>
                    {getRoleBadge(activeHousehold?.role)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
            </div>

            {/* Navigation Options Listed Properly */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1 pb-0.5">
                Navigation
              </div>

              <Link
                href="/items/quick-capture"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-blue-950">📸 Quick Add Item</div>
                    <div className="text-xs text-blue-700">Take photo & catalogue into room</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-500" />
              </Link>

              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                      isActive
                        ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{item.label}</div>
                        <div className="text-xs text-slate-500">{item.description}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Persistent Mobile Bottom Navigation Bar */}
      {isAuthenticated && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg">
          <Link
            href="/"
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
              pathname === '/' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Home</span>
          </Link>

          <Link
            href="/locations"
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
              pathname.startsWith('/locations') ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Rooms</span>
          </Link>

          {/* Elevated Center Quick Add CTA */}
          <Link
            href="/items/quick-capture"
            className="flex flex-col items-center justify-center -mt-5 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 shadow-lg shadow-blue-500/30 transition transform active:scale-95"
            aria-label="Quick Add Item with Camera"
          >
            <Camera className="w-6 h-6" />
          </Link>

          <Link
            href="/items"
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
              pathname === '/items' ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Items</span>
          </Link>

          <Link
            href="/containers"
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition ${
              pathname.startsWith('/containers') ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Box className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Boxes</span>
          </Link>
        </nav>
      )}
    </>
  );
}
