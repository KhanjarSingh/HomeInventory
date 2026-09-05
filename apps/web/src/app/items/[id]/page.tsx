'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { fetchApi, ApiClientError } from '../../../lib/api';
import { uploadImageToCloudinary } from '../../../lib/upload';
import { useAuth } from '../../../hooks/useAuth';
import type { ItemDetailDto, ItemImageDto } from '@home-inventory/shared';
import { BreadcrumbBadge } from '../../../components/placements/BreadcrumbBadge';
import { PlacementModal } from '../../../components/placements/PlacementModal';
import { EditItemModal } from '../../../components/items/EditItemModal';
import {
  Package,
  Camera,
  MapPin,
  Box,
  Move,
  Trash2,
  Edit2,
  ArrowLeft,
  CheckCircle2,
  Star,
  Loader2,
  AlertTriangle,
  Maximize2,
  X,
  Plus,
  Info,
} from 'lucide-react';

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params?.id as string;
  const { activeHousehold, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [item, setItem] = useState<ItemDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox / Zoom state
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Add Photo state
  const addPhotoInputRef = useRef<HTMLInputElement>(null);
  const cameraPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoActionError, setPhotoActionError] = useState<string | null>(null);

  // Placement Modal state
  const [isMoveOpen, setIsMoveOpen] = useState(false);

  // Edit Item Modal state
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Delete Item state
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const canEdit = activeHousehold?.role === 'owner' || activeHousehold?.role === 'editor';

  const loadItem = useCallback(async () => {
    if (!itemId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApi<ItemDetailDto>(`/items/${itemId}`);
      setItem(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load item details');
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    if (isAuthenticated) {
      loadItem();
    }
  }, [isAuthenticated, loadItem]);

  // Add new photo
  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !item) return;

    setPhotoActionError(null);
    setIsUploadingPhoto(true);
    try {
      const uploaded = await uploadImageToCloudinary(file);
      await fetchApi(`/items/${item.id}/images`, {
        method: 'POST',
        body: JSON.stringify(uploaded),
      });
      await loadItem();
    } catch (err: any) {
      setPhotoActionError(err.message || 'Failed to add photo');
    } finally {
      setIsUploadingPhoto(false);
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
      if (cameraPhotoInputRef.current) cameraPhotoInputRef.current.value = '';
    }
  };

  // Set primary cover photo
  const handleSetPrimary = async (imageId: string) => {
    if (!item) return;
    try {
      await fetchApi(`/items/${item.id}/images/${imageId}/primary`, {
        method: 'PATCH',
      });
      await loadItem();
    } catch (err: any) {
      setPhotoActionError(err.message || 'Failed to update cover photo');
    }
  };

  // Delete photo
  const handleDeletePhoto = async (imageId: string) => {
    if (!item) return;
    try {
      await fetchApi(`/items/${item.id}/images/${imageId}`, {
        method: 'DELETE',
      });
      await loadItem();
    } catch (err: any) {
      setPhotoActionError(err.message || 'Failed to delete photo');
    }
  };

  // Delete entire item
  const handleDeleteItem = async () => {
    if (!item) return;
    setIsDeleting(true);
    try {
      await fetchApi(`/items/${item.id}`, {
        method: 'DELETE',
      });
      router.push('/items');
    } catch (err: any) {
      setError(err.message || 'Failed to delete item');
      setIsDeleting(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 font-medium">Loading item details...</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Item Not Found</h2>
        <p className="text-xs text-slate-500">{error || 'This item may have been removed.'}</p>
        <Link
          href="/items"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Items</span>
        </Link>
      </div>
    );
  }

  const allImages = item.images || [];
  const activeImage = allImages[activeImageIndex] || item.primaryImage || null;
  const primaryPlacement = item.resolvedPlacements && item.resolvedPlacements.length > 0 ? item.resolvedPlacements[0] : null;

  return (
    <div className="max-w-xl mx-auto space-y-5 pb-24 sm:pb-8">
      {/* Hidden photo inputs */}
      <input
        ref={cameraPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleAddPhoto}
        className="hidden"
      />
      <input
        ref={addPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleAddPhoto}
        className="hidden"
      />

      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/items"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 p-2 -ml-2 rounded-xl transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Items</span>
        </Link>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl shadow-2xs transition min-h-[40px]"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Delete item"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {photoActionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{photoActionError}</span>
        </div>
      )}

      {/* Hero Photo & Gallery Reel */}
      <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs space-y-3 p-3">
        {/* Main Cover Image Display */}
        <div className="relative w-full h-72 sm:h-84 rounded-2xl overflow-hidden bg-slate-900 group">
          {activeImage ? (
            <Image
              src={activeImage.secureUrl || activeImage.url}
              alt={item.name}
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-100">
              <Package className="w-12 h-12 text-slate-400" />
              <span className="text-xs font-medium">No photo available</span>
            </div>
          )}

          {activeImage && (
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-xs transition"
              title="View full screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {activeImage?.isPrimary && (
            <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-md backdrop-blur-xs">
              <Star className="w-3 h-3 fill-white" />
              <span>Cover Photo</span>
            </span>
          )}

          {isUploadingPhoto && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
              <span className="text-xs font-semibold">Uploading photo...</span>
            </div>
          )}
        </div>

        {/* Horizontal Photo Reel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => cameraPhotoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 flex flex-col items-center justify-center gap-1 shrink-0 transition min-w-[64px]"
                title="Take a photo"
              >
                <Camera className="w-5 h-5" />
                <span className="text-[10px] font-bold">Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => addPhotoInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 flex flex-col items-center justify-center gap-1 shrink-0 transition min-w-[64px]"
                title="Add photo from gallery"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold">+ Photo</span>
              </button>
            </>
          )}

          {allImages.map((img, idx) => {
            const isSelected = activeImageIndex === idx;
            return (
              <div key={img.id} className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-600/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Image
                    src={img.secureUrl || img.url}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </button>

                {/* Quick actions for image */}
                {canEdit && isSelected && (
                  <div className="absolute -top-1.5 -right-1.5 flex items-center gap-1">
                    {!img.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(img.id)}
                        className="p-1 bg-amber-500 text-white rounded-full shadow-xs hover:bg-amber-600"
                        title="Set as cover photo"
                      >
                        <Star className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(img.id)}
                      className="p-1 bg-rose-600 text-white rounded-full shadow-xs hover:bg-rose-700"
                      title="Delete photo"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Header Info Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.categoryName && (
              <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg uppercase tracking-wider">
                {item.categoryName}
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md capitalize">
              {item.condition}
            </span>
            {item.isContainer && (
              <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg flex items-center gap-1">
                <Box className="w-3.5 h-3.5" />
                <span>Storage Box / Container</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 pt-1">
            {item.displayName || item.name}
          </h1>
          {item.displayName && (
            <p className="text-xs text-slate-500 font-medium">Full Name: {item.name}</p>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl">
            {item.description}
          </p>
        )}

        {/* Quantity & Price Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-2xl text-center">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold block uppercase">Total</span>
            <span className="text-base sm:text-lg font-black text-slate-900">
              {item.totalQuantity} <span className="text-xs font-normal">{item.unit}</span>
            </span>
          </div>
          <div className="border-l border-slate-200">
            <span className="text-[11px] text-emerald-600 font-semibold block uppercase">Placed</span>
            <span className="text-base sm:text-lg font-black text-emerald-700">
              {item.placedQuantity} <span className="text-xs font-normal">{item.unit}</span>
            </span>
          </div>
          <div className="border-l border-slate-200">
            <span className="text-[11px] text-amber-600 font-semibold block uppercase">Unplaced</span>
            <span className="text-base sm:text-lg font-black text-amber-700">
              {item.unplacedQuantity} <span className="text-xs font-normal">{item.unit}</span>
            </span>
          </div>
          <div className="border-l border-slate-200">
            <span className="text-[11px] text-indigo-600 font-semibold block uppercase">Price</span>
            <span className="text-base sm:text-lg font-black text-indigo-700">
              {item.latestPrice != null
                ? `₹${(item.latestPrice.amountMinor / 100).toLocaleString('en-IN')}`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Physical Location Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Physical Location</h2>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setIsMoveOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition min-h-[38px]"
            >
              <Move className="w-3.5 h-3.5" />
              <span>{item.placedQuantity > 0 ? 'Move' : 'Place Item'}</span>
            </button>
          )}
        </div>

        {item.resolvedPlacements && item.resolvedPlacements.length > 0 ? (
          <div className="space-y-3">
            {item.resolvedPlacements.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    {p.quantity} {p.unit}
                  </span>
                  {p.notes && (
                    <span className="text-[11px] text-slate-500 italic">
                      Note: {p.notes}
                    </span>
                  )}
                </div>
                <BreadcrumbBadge
                  breadcrumbs={p.breadcrumbs}
                  breadcrumbString={p.breadcrumbString}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-center space-y-1">
            <p className="text-xs font-semibold text-amber-800">This item is currently unplaced</p>
            <p className="text-[11px] text-amber-600">
              Tap &quot;Place Item&quot; above to put it in a room, wardrobe, shelf, or storage box.
            </p>
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {isLightboxOpen && activeImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-3 text-white/80 hover:text-white bg-white/10 rounded-full backdrop-blur-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative w-full max-w-2xl h-[80vh]">
            <Image
              src={activeImage.secureUrl || activeImage.url}
              alt={item.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      <EditItemModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={loadItem}
        item={item}
      />

      {/* Move Placement Modal */}
      <PlacementModal
        isOpen={isMoveOpen}
        onClose={() => setIsMoveOpen(false)}
        onSuccess={loadItem}
        mode={item.placedQuantity > 0 ? 'move' : 'place'}
        item={{
          id: item.id,
          name: item.name,
          isContainer: item.isContainer,
          unit: item.unit,
          maxQuantity: item.placedQuantity > 0 ? item.placedQuantity : item.totalQuantity,
        }}
        currentPlacement={
          primaryPlacement
            ? {
                id: primaryPlacement.id,
                locationId: primaryPlacement.locationId,
                containerItemId: primaryPlacement.containerItemId,
                quantity: primaryPlacement.quantity,
                notes: primaryPlacement.notes,
              }
            : undefined
        }
      />

      {/* Delete Item Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Item</h3>
                <p className="text-xs text-slate-500">Remove this item from inventory?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
              Are you sure you want to remove <strong className="text-slate-900">{item.name}</strong>? This action can be undone by an owner.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl min-h-[40px] flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
