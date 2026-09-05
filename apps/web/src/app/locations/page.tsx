'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { fetchApi, ApiClientError } from '../../lib/api';
import type { LocationTreeItemDto } from '@home-inventory/shared';
import { LocationTree } from '../../components/locations/LocationTree';
import { LocationFormModal } from '../../components/locations/LocationFormModal';
import {
  MapPin,
  Plus,
  Loader2,
  AlertTriangle,
  Layers,
  Box,
  DoorClosed,
  RefreshCw,
  Search,
  Home,
  CheckCircle2,
} from 'lucide-react';

export default function LocationsPage() {
  const { activeHousehold, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [locations, setLocations] = useState<LocationTreeItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parentPreset, setParentPreset] = useState<{ id: string; name: string } | null>(null);

  const canEdit = activeHousehold?.role === 'owner' || activeHousehold?.role === 'editor';

  const loadLocations = useCallback(async () => {
    if (!activeHousehold) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchApi<LocationTreeItemDto[]>('/locations');
      setLocations(res.data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load physical locations.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeHousehold]);

  useEffect(() => {
    if (activeHousehold) {
      loadLocations();
    }
  }, [activeHousehold, loadLocations]);

  const handleAddTopLevel = () => {
    setParentPreset(null);
    setIsModalOpen(true);
  };

  const handleAddChild = (parentId: string, parentName: string) => {
    setParentPreset({ id: parentId, name: parentName });
    setIsModalOpen(true);
  };

  // Compute aggregate statistics
  const stats = useMemo(() => {
    let totalLocations = 0;
    let totalItems = 0;
    let totalContainers = 0;

    function countNodes(nodes: LocationTreeItemDto[]) {
      for (const n of nodes) {
        totalLocations += 1;
        totalItems += n.directItemCount;
        totalContainers += n.directContainerCount;
        if (n.children?.length) {
          countNodes(n.children);
        }
      }
    }

    countNodes(locations);

    return {
      topLevelAreas: locations.length,
      totalLocations,
      totalItems,
      totalContainers,
    };
  }, [locations]);

  // Filter locations tree by search query
  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return locations;
    const q = searchQuery.toLowerCase().trim();

    function filterNode(node: LocationTreeItemDto): LocationTreeItemDto | null {
      const matchesSelf =
        node.name.toLowerCase().includes(q) ||
        node.kind.toLowerCase().includes(q) ||
        (node.description && node.description.toLowerCase().includes(q));

      const filteredChildren: LocationTreeItemDto[] = [];
      if (node.children?.length) {
        for (const child of node.children) {
          const matchingChild = filterNode(child);
          if (matchingChild) {
            filteredChildren.push(matchingChild);
          }
        }
      }

      if (matchesSelf || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    }

    const result: LocationTreeItemDto[] = [];
    for (const node of locations) {
      const match = filterNode(node);
      if (match) result.push(match);
    }
    return result;
  }, [locations, searchQuery]);

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
          <DoorClosed className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Sign in to View Locations</h1>
        <p className="text-slate-600">
          Please sign in or select your household to view and manage physical inventory locations.
        </p>
        <div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Home className="w-4 h-4" />
            <span>{activeHousehold?.name || 'Household'}</span>
            <span>/</span>
            <span className="font-semibold text-slate-800">Physical Locations</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            Physical Hierarchy
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
              Live Real-Home Model
            </span>
          </h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Fixed architectural spaces, rooms, wardrobes, and shelves. Movable storage boxes & containers remain items placed inside these locations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLocations}
            title="Refresh"
            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {canEdit && (
            <button
              onClick={handleAddTopLevel}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Top-Level Location
            </button>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <DoorClosed className="w-4 h-4 text-blue-600" />
            Top-Level Areas
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.topLevelAreas}</div>
          <p className="text-xs text-slate-400 mt-1">Bedrooms, Hall, Kitchen, etc.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <Layers className="w-4 h-4 text-purple-600" />
            Total Locations
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalLocations}</div>
          <p className="text-xs text-slate-400 mt-1">Rooms, wardrobes, shelves, racks</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <Box className="w-4 h-4 text-emerald-600" />
            Direct Items Stored
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalItems}</div>
          <p className="text-xs text-slate-400 mt-1">Items placed in locations</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <Box className="w-4 h-4 text-amber-600" />
            Storage Boxes
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalContainers}</div>
          <p className="text-xs text-slate-400 mt-1">Containers holding other items</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadLocations}
            className="text-xs font-semibold text-rose-800 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hierarchy Explorer Box */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Physical Tree Explorer</h2>
            <p className="text-xs text-slate-500">
              Click any location to expand or explore its contents and sublocations.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter rooms, shelves..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading location tree...</p>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {searchQuery ? 'No matching locations found' : 'No locations yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? `No physical locations match "${searchQuery}". Try a different filter.`
                  : 'Start mapping your home by adding your main areas such as Small Bedroom, Big Bedroom, Hall, Kitchen, etc.'}
              </p>
              {canEdit && !searchQuery && (
                <button
                  onClick={handleAddTopLevel}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold text-xs rounded-xl hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add First Location
                </button>
              )}
            </div>
          ) : (
            <LocationTree
              nodes={filteredLocations}
              canEdit={canEdit}
              onAddChild={handleAddChild}
            />
          )}
        </div>
      </div>

      {/* Location Create Modal */}
      <LocationFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setParentPreset(null);
        }}
        onSuccess={loadLocations}
        parentPreset={parentPreset}
      />
    </div>
  );
}
