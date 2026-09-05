'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchApi, ApiClientError } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import type {
  ContainerSummaryDto,
  ContainerContentItemDto,
} from '@home-inventory/shared';
import { BreadcrumbBadge } from '../../components/placements/BreadcrumbBadge';
import { PlacementModal } from '../../components/placements/PlacementModal';
import {
  Box,
  Package,
  Layers,
  Move,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Plus,
  RefreshCw,
} from 'lucide-react';

export default function ContainersPage() {
  const { activeHousehold, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [containers, setContainers] = useState<ContainerSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contents expansion state
  const [expandedContainerId, setExpandedContainerId] = useState<string | null>(null);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [containerContents, setContainerContents] = useState<ContainerContentItemDto[]>([]);

  // Move Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'place' | 'move';
    item: { id: string; name: string; isContainer?: boolean; unit?: string; maxQuantity?: number };
    currentPlacement?: {
      id: string;
      locationId: string | null;
      containerItemId: string | null;
      quantity: number;
      notes?: string | null;
    };
  }>({
    isOpen: false,
    mode: 'move',
    item: { id: '', name: '' },
  });

  const canEdit = activeHousehold?.role === 'owner' || activeHousehold?.role === 'editor';

  const loadContainers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApi<ContainerSummaryDto[]>('/containers');
      setContainers(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load containers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadContainers();
    }
  }, [isAuthenticated, loadContainers]);

  const toggleExpand = async (containerId: string) => {
    if (expandedContainerId === containerId) {
      setExpandedContainerId(null);
      setContainerContents([]);
      return;
    }

    setExpandedContainerId(containerId);
    setContentsLoading(true);
    try {
      const res = await fetchApi<ContainerContentItemDto[]>(
        `/containers/${containerId}/contents`
      );
      setContainerContents(res.data || []);
    } catch (err: any) {
      console.error('Failed to load container contents:', err);
    } finally {
      setContentsLoading(false);
    }
  };

  const handleOpenMoveContainer = (c: ContainerSummaryDto) => {
    if (!c.currentPlacement) {
      setModalState({
        isOpen: true,
        mode: 'place',
        item: { id: c.id, name: c.name, isContainer: true, unit: c.unit, maxQuantity: c.totalQuantity },
      });
    } else {
      setModalState({
        isOpen: true,
        mode: 'move',
        item: { id: c.id, name: c.name, isContainer: true, unit: c.unit, maxQuantity: c.totalQuantity },
        currentPlacement: {
          id: c.currentPlacement.id,
          locationId: c.currentPlacement.locationId,
          containerItemId: c.currentPlacement.containerItemId,
          quantity: c.currentPlacement.quantity,
          notes: c.currentPlacement.notes,
        },
      });
    }
  };

  const handleOpenMoveContentItem = (item: ContainerContentItemDto) => {
    setModalState({
      isOpen: true,
      mode: 'move',
      item: { id: item.id, name: item.name, isContainer: item.isContainer, unit: item.unit, maxQuantity: item.quantity },
      currentPlacement: {
        id: item.placementId,
        locationId: null,
        containerItemId: expandedContainerId,
        quantity: item.quantity,
        notes: item.notes,
      },
    });
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 font-medium">Loading storage containers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Storage Containers & Boxes
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Movable storage objects (boxes, bins, bags) that hold items or nest inside other containers.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadContainers}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition min-h-[44px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-sm text-rose-800">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Containers List */}
      {containers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <Box className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Containers Created Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Storage containers are items marked as containers (e.g. Large Blue Storage Box, Tool Box, Pill Organizer).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {containers.map((c) => {
            const isExpanded = expandedContainerId === c.id;

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-amber-300 transition-all overflow-hidden"
              >
                {/* Main Card Bar */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="p-2 bg-amber-50 text-amber-700 rounded-lg shrink-0">
                        <Box className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{c.name}</h3>
                        {c.displayName && (
                          <p className="text-xs text-slate-500 font-medium">{c.displayName}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-auto sm:ml-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full">
                          <Package className="w-3 h-3" />
                          <span>{c.containedItemCount} items</span>
                        </span>

                        {c.containedContainerCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full">
                            <Layers className="w-3 h-3" />
                            <span>{c.containedContainerCount} nested boxes</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Physical Breadcrumb Trail */}
                    <div className="pt-1">
                      <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                        Current Physical Location:
                      </span>
                      <BreadcrumbBadge
                        breadcrumbs={c.breadcrumbs}
                        breadcrumbString={c.breadcrumbString}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition min-h-[44px]"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          <span>Hide Contents</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          <span>View Contents ({c.containedItemCount})</span>
                        </>
                      )}
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => handleOpenMoveContainer(c)}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition min-h-[44px]"
                        title="Move this container to a new location or another container"
                      >
                        <Move className="w-3.5 h-3.5 text-blue-600" />
                        <span>Move Box</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Nested Contents Panel */}
                {isExpanded && (
                  <div className="bg-slate-50/70 border-t border-slate-200/80 p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Contents Inside &quot;{c.name}&quot;
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {containerContents.length} items & nested boxes
                      </span>
                    </div>

                    {contentsLoading ? (
                      <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                        <span className="text-xs">Loading contents...</span>
                      </div>
                    ) : containerContents.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3 italic">
                        This container is currently empty.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {containerContents.map((item) => (
                          <div
                            key={item.placementId}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-2xs ${
                              item.isContainer
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`p-2 rounded-lg shrink-0 ${
                                  item.isContainer
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {item.isContainer ? (
                                  <Box className="w-4 h-4" />
                                ) : (
                                  <Package className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {item.displayName || item.name}
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                  <span>
                                    Qty: {item.quantity} {item.unit}
                                  </span>
                                  {item.isContainer && (
                                    <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 font-semibold rounded text-[10px]">
                                      Nested Container
                                    </span>
                                  )}
                                  {item.notes && (
                                    <span className="italic truncate max-w-[120px]">
                                      ({item.notes})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {canEdit && (
                              <button
                                onClick={() => handleOpenMoveContentItem(item)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
                                title="Relocate this item"
                              >
                                <Move className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Placement / Move Modal */}
      <PlacementModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={() => {
          loadContainers();
          if (expandedContainerId) {
            fetchApi<ContainerContentItemDto[]>(
              `/containers/${expandedContainerId}/contents`
            ).then((res) => setContainerContents(res.data || []));
          }
        }}
        mode={modalState.mode}
        item={modalState.item}
        currentPlacement={modalState.currentPlacement}
      />
    </div>
  );
}
