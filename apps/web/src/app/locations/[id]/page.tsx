'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { fetchApi, ApiClientError } from '../../../lib/api';
import type {
  LocationDetailDto,
  LocationTreeItemDto,
  LocationKind,
} from '@home-inventory/shared';
import { LocationFormModal } from '../../../components/locations/LocationFormModal';
import { ReparentModal } from '../../../components/locations/ReparentModal';
import {
  ChevronRight,
  DoorClosed,
  Archive,
  Grid,
  Box,
  Folder,
  Plus,
  Edit2,
  Move,
  Trash2,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Package,
  Layers,
  Info,
  Calendar,
  Tag,
} from 'lucide-react';

function getLocationIcon(kind: LocationKind) {
  switch (kind) {
    case 'room':
      return <DoorClosed className="w-5 h-5 text-blue-600" />;
    case 'wardrobe':
    case 'cabinet':
      return <Archive className="w-5 h-5 text-purple-600" />;
    case 'shelf':
    case 'rack':
      return <Grid className="w-5 h-5 text-amber-600" />;
    case 'drawer':
    case 'bin':
    case 'storage_area':
      return <Box className="w-5 h-5 text-emerald-600" />;
    default:
      return <Folder className="w-5 h-5 text-slate-500" />;
  }
}

function getKindBadge(kind: LocationKind) {
  const styles: Record<string, string> = {
    room: 'bg-blue-50 text-blue-700 border-blue-200',
    wardrobe: 'bg-purple-50 text-purple-700 border-purple-200',
    cabinet: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    shelf: 'bg-amber-50 text-amber-700 border-amber-200',
    drawer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rack: 'bg-orange-50 text-orange-700 border-orange-200',
    storage_area: 'bg-slate-100 text-slate-700 border-slate-200',
    furniture: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bin: 'bg-teal-50 text-teal-700 border-teal-200',
    other: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold border uppercase tracking-wider ${
        styles[kind] || styles.other
      }`}
    >
      {kind.replace('_', ' ')}
    </span>
  );
}

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params?.id as string;
  const { activeHousehold, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [data, setData] = useState<LocationDetailDto | null>(null);
  const [treeNodes, setTreeNodes] = useState<LocationTreeItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [isReparentOpen, setIsReparentOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = activeHousehold?.role === 'owner' || activeHousehold?.role === 'editor';

  const loadData = useCallback(async () => {
    if (!locationId || !activeHousehold) return;
    try {
      setIsLoading(true);
      setError(null);
      const [detailRes, treeRes] = await Promise.all([
        fetchApi<LocationDetailDto>(`/locations/${locationId}`),
        fetchApi<LocationTreeItemDto[]>('/locations'),
      ]);
      setData(detailRes.data);
      setTreeNodes(treeRes.data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load location details.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [locationId, activeHousehold]);

  useEffect(() => {
    if (activeHousehold) {
      loadData();
    }
  }, [activeHousehold, loadData]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await fetchApi(`/locations/${locationId}`, {
        method: 'DELETE',
      });
      router.push('/locations');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete/archive location.');
      }
      setIsDeleting(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Location Not Found</h1>
        <p className="text-slate-600 text-sm">
          {error || "The location you are looking for does not exist or has been removed."}
        </p>
        <Link
          href="/locations"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-semibold text-xs rounded-xl hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Physical Locations
        </Link>
      </div>
    );
  }

  const { location, breadcrumbs, children, directItems, directContainers, summary } = data;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Physical Breadcrumb Trail */}
      <div className="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-xl">
        <Link
          href="/locations"
          className="hover:text-blue-600 flex items-center gap-1 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Locations
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          if (isLast) {
            return (
              <span key={crumb.id} className="font-bold text-slate-900 flex items-center gap-1">
                {crumb.name}
              </span>
            );
          }
          return (
            <React.Fragment key={crumb.id}>
              <Link
                href={`/locations/${crumb.id}`}
                className="hover:text-blue-600 transition hover:underline"
              >
                {crumb.name}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </React.Fragment>
          );
        })}
      </div>

      {/* Main Header & Actions */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl shrink-0">
            {getLocationIcon(location.kind)}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {location.name}
              </h1>
              {getKindBadge(location.kind)}
              {location.isArchived && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  ARCHIVED
                </span>
              )}
            </div>
            {location.description && (
              <p className="text-slate-600 text-sm max-w-2xl">{location.description}</p>
            )}
            {location.notes && (
              <p className="text-xs text-slate-400 italic">Notes: {location.notes}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Depth Level: {location.depth}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Created {new Date(location.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {canEdit && (
          <div className="flex items-center flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setIsAddSubOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Sublocation
            </button>
            <button
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={() => setIsReparentOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-xs transition"
            >
              <Move className="w-3.5 h-3.5" />
              Move
            </button>
            <button
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="p-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition"
              title="Delete or Archive Location"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Subtree Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Direct Items
          </div>
          <div className="text-2xl font-black text-slate-900">{summary.directItemCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Stored right here</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Subtree Items
          </div>
          <div className="text-2xl font-black text-purple-600">{summary.subtreeItemCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Includes all nested shelves & boxes</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Direct Storage Boxes
          </div>
          <div className="text-2xl font-black text-amber-600">{summary.directContainerCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Boxes placed here</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Subtree Boxes
          </div>
          <div className="text-2xl font-black text-emerald-600">{summary.subtreeContainerCount}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">All boxes in this branch</p>
        </div>
      </div>

      {/* Section 1: Child Sublocations */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Sublocations & Structural Areas ({children.length})
            </h2>
            <p className="text-xs text-slate-500">
              Wardrobes, cabinets, shelves, and nested storage spots inside {location.name}.
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setIsAddSubOpen(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Child
            </button>
          )}
        </div>

        {children.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 italic">No child locations nested inside.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/locations/${child.id}`}
                className="group p-3.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition flex items-center justify-between shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 group-hover:bg-blue-100 rounded-lg transition">
                    {getLocationIcon(child.kind)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition">
                      {child.name}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{child.kind}</span>
                      <span>•</span>
                      <span>{child.subtreeItemCount} items</span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Movable Storage Containers (Movable container Items placed here) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              Storage Boxes & Containers ({directContainers.length})
            </h2>
            <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium">
              Movable Storage Objects
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Boxes, crates, and pouches placed here. Containers can hold other items or nest inside other containers.
          </p>
        </div>

        {directContainers.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 italic">No storage boxes placed in this location.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {directContainers.map((container) => (
              <div
                key={container.id}
                className="p-3.5 rounded-xl border border-amber-200/70 bg-amber-50/20 shadow-2xs space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{container.name}</h4>
                      {container.displayName && (
                        <p className="text-xs text-slate-500">{container.displayName}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                    {container.containedItemCount} items inside
                  </span>
                </div>
                {container.notes && (
                  <p className="text-xs text-slate-500 italic">Notes: {container.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 3: Direct Stored Items */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              Direct Stored Items ({directItems.length})
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Items placed directly on this shelf/location (not inside a nested container box).
          </p>
        </div>

        {directItems.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 italic">No direct items stored here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Condition</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {directItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3 font-semibold text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div>{item.name}</div>
                        {item.displayName && (
                          <div className="text-[11px] text-slate-400 font-normal">{item.displayName}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">{item.categoryName || '—'}</td>
                    <td className="p-3 font-bold text-slate-800">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="p-3">
                      {item.condition ? (
                        <span className="capitalize px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                          {item.condition}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Location Modal */}
      <LocationFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={loadData}
        initialData={location}
      />

      {/* Add Sublocation Modal */}
      <LocationFormModal
        isOpen={isAddSubOpen}
        onClose={() => setIsAddSubOpen(false)}
        onSuccess={loadData}
        parentPreset={{ id: location.id, name: location.name }}
      />

      {/* Reparent / Move Modal */}
      <ReparentModal
        isOpen={isReparentOpen}
        onClose={() => setIsReparentOpen(false)}
        onSuccess={loadData}
        currentLocation={location}
        treeNodes={treeNodes}
      />

      {/* Delete/Archive Confirmation Dialog */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete / Archive Location</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to remove <strong className="text-slate-800">{location.name}</strong>?
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-800 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Safe Archive Protection
              </div>
              <p>
                If this location or its nested sublocations currently store inventory items, the system will safely archive the location instead of deleting it, preventing any data loss.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
