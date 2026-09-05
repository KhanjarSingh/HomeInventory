'use client';

import React, { useState, useEffect } from 'react';
import { fetchApi, ApiClientError } from '../../lib/api';
import type {
  LocationTreeItemDto,
  ContainerSummaryDto,
} from '@home-inventory/shared';
import {
  X,
  MapPin,
  Box,
  Check,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

interface PlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: 'place' | 'move';
  item: {
    id: string;
    name: string;
    isContainer?: boolean;
    unit?: string;
    maxQuantity?: number;
  };
  currentPlacement?: {
    id: string;
    locationId: string | null;
    containerItemId: string | null;
    quantity: number;
    notes?: string | null;
  };
}

export function PlacementModal({
  isOpen,
  onClose,
  onSuccess,
  mode,
  item,
  currentPlacement,
}: PlacementModalProps) {
  const [destinationType, setDestinationType] = useState<'location' | 'container'>('location');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  const [locations, setLocations] = useState<LocationTreeItemDto[]>([]);
  const [containers, setContainers] = useState<ContainerSummaryDto[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state when opened
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (mode === 'move' && currentPlacement) {
      setQuantity(currentPlacement.quantity);
      setNotes(currentPlacement.notes || '');
      if (currentPlacement.locationId) {
        setDestinationType('location');
        setSelectedLocationId(currentPlacement.locationId);
      } else if (currentPlacement.containerItemId) {
        setDestinationType('container');
        setSelectedContainerId(currentPlacement.containerItemId);
      }
    } else {
      setQuantity(item.maxQuantity && item.maxQuantity > 0 ? item.maxQuantity : 1);
      setNotes('');
      setSelectedLocationId('');
      setSelectedContainerId('');
    }

    // Load available locations and containers
    setIsLoadingOptions(true);
    Promise.all([
      fetchApi<LocationTreeItemDto[]>('/api/v1/locations'),
      fetchApi<ContainerSummaryDto[]>('/api/v1/containers'),
    ])
      .then(([locsRes, contsRes]) => {
        const locs = locsRes.data || [];
        const conts = contsRes.data || [];
        setLocations(locs);
        // Do not allow placing a container inside itself
        setContainers(conts.filter((c) => c.id !== item.id));
        if (locs.length > 0 && !selectedLocationId) {
          setSelectedLocationId(locs[0].id);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load destinations');
      })
      .finally(() => {
        setIsLoadingOptions(false);
      });
  }, [isOpen, mode, item.id, item.maxQuantity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const destinationId =
      destinationType === 'location' ? selectedLocationId : selectedContainerId;

    if (!destinationId) {
      setError(`Please select a destination ${destinationType}`);
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'place') {
        await fetchApi('/api/v1/placements', {
          method: 'POST',
          body: JSON.stringify({
            itemId: item.id,
            locationId: destinationType === 'location' ? destinationId : null,
            containerItemId: destinationType === 'container' ? destinationId : null,
            quantity,
            notes: notes.trim() || undefined,
          }),
        });
      } else if (mode === 'move' && currentPlacement) {
        await fetchApi(`/api/v1/placements/${currentPlacement.id}/move`, {
          method: 'POST',
          body: JSON.stringify({
            destinationType,
            destinationId,
            quantity,
            notes: notes.trim() || undefined,
          }),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError(err.message || 'Placement failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {item.isContainer ? (
                <Box className="w-5 h-5 text-amber-600" />
              ) : (
                <MapPin className="w-5 h-5 text-blue-600" />
              )}
              {mode === 'place' ? 'Place Item' : 'Move Item'}
            </h3>
            <p className="text-xs text-slate-500 truncate max-w-[280px]">
              {item.name} {item.unit ? `(${item.unit})` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Destination Type Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Destination Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setDestinationType('location')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition min-h-[44px] ${
                  destinationType === 'location'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Fixed Location</span>
              </button>
              <button
                type="button"
                onClick={() => setDestinationType('container')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition min-h-[44px] ${
                  destinationType === 'container'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Box className="w-4 h-4 text-amber-600" />
                <span>Storage Container</span>
              </button>
            </div>
          </div>

          {/* Destination Selector */}
          {isLoadingOptions ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Loading destinations...</span>
            </div>
          ) : destinationType === 'location' ? (
            <div>
              <label
                htmlFor="location-select"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Select Physical Location
              </label>
              <select
                id="location-select"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                required
              >
                <option value="" disabled>
                  -- Select a Room, Wardrobe, or Shelf --
                </option>
                {locations.map((loc) => {
                  const indent = '— '.repeat(loc.depth);
                  return (
                    <option key={loc.id} value={loc.id}>
                      {indent}
                      {loc.name} ({loc.kind})
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Fixed structures in your home (rooms, furniture, shelves).
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="container-select"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Select Storage Container / Box
              </label>
              {containers.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  No other containers found in household.
                </div>
              ) : (
                <select
                  id="container-select"
                  value={selectedContainerId}
                  onChange={(e) => setSelectedContainerId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/40 border border-amber-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                  required
                >
                  <option value="" disabled>
                    -- Select a Storage Box or Pouch --
                  </option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.displayName ? `(${c.displayName})` : ''} — [
                      {c.breadcrumbString}] ({c.containedItemCount} items)
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Movable storage objects (boxes, bins, bags). Moving a container moves all its contents automatically.
              </p>
            </div>
          )}

          {/* Quantity Field */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="quantity-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Quantity to {mode === 'place' ? 'Place' : 'Move'}
              </label>
              <div className="relative">
                <input
                  id="quantity-input"
                  type="number"
                  step="any"
                  min="0.01"
                  max={item.maxQuantity}
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  required
                />
              </div>
              {item.maxQuantity !== undefined && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Max available: {item.maxQuantity} {item.unit || 'units'}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="notes-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Placement Notes (Optional)
              </label>
              <input
                id="notes-input"
                type="text"
                placeholder="e.g. Top drawer, front"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md transition disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Confirm {mode === 'place' ? 'Placement' : 'Move'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
