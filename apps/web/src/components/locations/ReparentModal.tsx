'use client';

import React, { useState, useMemo } from 'react';
import { fetchApi, ApiClientError } from '../../lib/api';
import type { LocationDto, LocationTreeItemDto } from '@home-inventory/shared';
import { X, Loader2, Move, AlertTriangle } from 'lucide-react';

interface ReparentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentLocation: LocationDto;
  treeNodes: LocationTreeItemDto[];
}

interface FlatOption {
  id: string;
  name: string;
  depth: number;
  path: string;
  disabled: boolean;
  reason?: string;
}

export function ReparentModal({
  isOpen,
  onClose,
  onSuccess,
  currentLocation,
  treeNodes,
}: ReparentModalProps) {
  const [targetParentId, setTargetParentId] = useState<string>(
    currentLocation.parentId || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Flatten the tree into an indented list of eligible parent locations,
  // preventing cycles by disabling self and descendants.
  const flatOptions = useMemo(() => {
    const options: FlatOption[] = [];

    function traverse(nodes: LocationTreeItemDto[], depth: number) {
      for (const node of nodes) {
        const isSelf = node.id === currentLocation.id;
        const isDescendant = node.path.startsWith(currentLocation.path);
        const disabled = isSelf || isDescendant;

        let reason: string | undefined;
        if (isSelf) reason = 'Self';
        else if (isDescendant) reason = 'Descendant (would create cycle)';

        options.push({
          id: node.id,
          name: node.name,
          depth,
          path: node.path,
          disabled,
          reason,
        });

        if (node.children && node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      }
    }

    traverse(treeNodes, 0);
    return options;
  }, [treeNodes, currentLocation]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const newParentId = targetParentId.trim() === '' ? null : targetParentId;

    // Check if unchanged
    if (newParentId === (currentLocation.parentId || null)) {
      onClose();
      return;
    }

    try {
      await fetchApi(`/locations/${currentLocation.id}/reparent`, {
        method: 'POST',
        body: JSON.stringify({ newParentId }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to reparent location. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Move className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Move / Reparent Location</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Moving <strong className="text-slate-800">{currentLocation.name}</strong> and all its sublocations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Select New Parent Location
            </label>
            <select
              value={targetParentId}
              onChange={(e) => setTargetParentId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            >
              <option value="">🏠 Root Level (Top-level Location)</option>
              {flatOptions.map((opt) => (
                <option
                  key={opt.id}
                  value={opt.id}
                  disabled={opt.disabled}
                >
                  {'\u00A0\u00A0'.repeat(opt.depth + 1)}↳ {opt.name}
                  {opt.disabled ? ` (${opt.reason})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">
              Moving this location preserves all child sublocations, containers, and stored items.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-800 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              Materialized Path Guarantee
            </div>
            <p>
              The system atomically cascades path and depth updates through all nested sublocations and items to guarantee zero hierarchy corruption.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs flex items-center gap-2 transition disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save New Location
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
