'use client';

import React, { useState } from 'react';
import { fetchApi, ApiClientError } from '../../lib/api';
import { LOCATION_KINDS, type LocationKind, type LocationDto } from '@home-inventory/shared';
import { X, Loader2 } from 'lucide-react';

interface LocationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: LocationDto | null;
  parentPreset?: { id: string; name: string } | null;
}

export function LocationFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  parentPreset,
}: LocationFormModalProps) {
  const isEditing = !!initialData;

  const [name, setName] = useState(initialData?.name || '');
  const [kind, setKind] = useState<LocationKind>((initialData?.kind as LocationKind) || 'room');
  const [description, setDescription] = useState(initialData?.description || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [color, setColor] = useState(initialData?.color || '#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing && initialData) {
        await fetchApi(`/locations/${initialData.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name,
            kind,
            description: description || undefined,
            notes: notes || undefined,
            color: color || undefined,
          }),
        });
      } else {
        await fetchApi('/locations', {
          method: 'POST',
          body: JSON.stringify({
            name,
            kind,
            parentId: parentPreset ? parentPreset.id : undefined,
            description: description || undefined,
            notes: notes || undefined,
            color: color || undefined,
          }),
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to save location. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isEditing ? 'Edit Location' : 'Add New Location'}
            </h2>
            {parentPreset && !isEditing && (
              <p className="text-xs text-slate-500 mt-0.5">
                Creating sublocation inside: <strong className="text-slate-800 font-semibold">{parentPreset.name}</strong>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Location Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Master Bedroom, Top Shelf, Tool Rack"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Physical Kind <span className="text-red-500">*</span>
              </label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as LocationKind)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                {LOCATION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                />
                <span className="text-xs font-mono text-slate-500 uppercase">{color}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. North wall wardrobe in master bedroom"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Holds winter wear and travel gear"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditing ? 'Save Changes' : 'Create Location'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
