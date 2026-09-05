'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { fetchApi, ApiClientError } from '../../../lib/api';
import { uploadImageToCloudinary } from '../../../lib/upload';
import { useAuth } from '../../../hooks/useAuth';
import type {
  LocationTreeItemDto,
  ContainerSummaryDto,
  CategoryDto,
  ConfirmImageUploadInput,
  ItemDetailDto,
} from '@home-inventory/shared';
import { BreadcrumbBadge } from '../../../components/placements/BreadcrumbBadge';
import {
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  RefreshCw,
  Plus,
  Minus,
  MapPin,
  Box,
  HelpCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';

export default function QuickCapturePage() {
  const router = useRouter();
  const { activeHousehold, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Camera file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Photo & Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<ConfirmImageUploadInput | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Item form fields
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('pcs');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [destinationType, setDestinationType] = useState<'location' | 'container' | 'unplaced'>('location');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');
  const [placementNotes, setPlacementNotes] = useState('');

  // Destination & Category data
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [locations, setLocations] = useState<LocationTreeItemDto[]>([]);
  const [containers, setContainers] = useState<ContainerSummaryDto[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Submission state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [createdItem, setCreatedItem] = useState<ItemDetailDto | null>(null);

  // Load categories, locations, and containers
  useEffect(() => {
    if (!isAuthenticated) return;

    setIsLoadingOptions(true);
    Promise.all([
      fetchApi<CategoryDto[]>('/categories'),
      fetchApi<LocationTreeItemDto[]>('/locations'),
      fetchApi<ContainerSummaryDto[]>('/containers'),
    ])
      .then(([catsRes, locsRes, contsRes]) => {
        const cats = catsRes.data || [];
        const locs = locsRes.data || [];
        const conts = contsRes.data || [];

        setCategories(cats);
        setLocations(locs);
        setContainers(conts);

        if (cats.length > 0 && !categoryId) {
          setCategoryId(cats[0].id);
        }
        if (locs.length > 0 && !selectedLocationId) {
          setSelectedLocationId(locs[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load initial options:', err);
      })
      .finally(() => {
        setIsLoadingOptions(false);
      });
  }, [isAuthenticated]);

  // Handle Photo selection from Camera or Gallery
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload to Cloudinary in background
    setIsUploadingPhoto(true);
    try {
      const result = await uploadImageToCloudinary(file);
      setUploadedImage(result);
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRetakePhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedImage(null);
    setPhotoError(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  // Reset form to add another item consecutively
  const handleAddAnother = () => {
    setCreatedItem(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadedImage(null);
    setPhotoError(null);
    setName('');
    setQuantity(1);
    setPrice('');
    setPlacementNotes('');
    setSaveError(null);

    // Auto-trigger camera immediately on mobile!
    setTimeout(() => {
      cameraInputRef.current?.click();
    }, 100);
  };

  // Handle Save
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError('Item name is required');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload: any = {
        name: name.trim(),
        totalQuantity: quantity,
        unit,
        categoryId: categoryId || undefined,
        placementNotes: placementNotes.trim() || undefined,
      };

      if (price.trim()) {
        const parsedPrice = parseFloat(price.trim());
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          payload.purchasePrice = parsedPrice;
          payload.currency = 'INR';
        }
      }

      if (uploadedImage) {
        payload.initialImage = uploadedImage;
      }

      if (destinationType === 'location' && selectedLocationId) {
        payload.initialLocationId = selectedLocationId;
      } else if (destinationType === 'container' && selectedContainerId) {
        payload.initialContainerItemId = selectedContainerId;
      }

      const res = await fetchApi<ItemDetailDto>('/items', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreatedItem(res.data);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-500 font-medium">Checking authorization...</p>
      </div>
    );
  }

  // --- Success Screen for Consecutive Cataloguing ---
  if (createdItem) {
    return (
      <div className="max-w-md mx-auto py-6 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-200 shadow-lg text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Successfully Catalogued
            </span>
            <h2 className="text-2xl font-black text-slate-900 truncate">
              {createdItem.name}
            </h2>
            <p className="text-xs text-slate-500">
              {createdItem.totalQuantity} {createdItem.unit} added to inventory
            </p>
            {createdItem.latestPrice && (
              <div className="pt-1">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ₹{(createdItem.latestPrice.amountMinor / 100).toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>

          {/* Photo Thumbnail if uploaded */}
          {createdItem.primaryImage && (
            <div className="relative w-36 h-36 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-200 shadow-md">
              <Image
                src={createdItem.primaryImage.secureUrl || createdItem.primaryImage.url}
                alt={createdItem.name}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          )}

          {/* Placement info */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Physical Location:
            </span>
            {createdItem.resolvedPlacements && createdItem.resolvedPlacements.length > 0 ? (
              <BreadcrumbBadge
                breadcrumbs={createdItem.resolvedPlacements[0].breadcrumbs}
                breadcrumbString={createdItem.resolvedPlacements[0].breadcrumbString}
                size="sm"
              />
            ) : (
              <span className="text-xs text-slate-500 italic">Unplaced (awaiting placement)</span>
            )}
          </div>

          {/* Rapid Consecutive Action: + Add Another */}
          <div className="pt-2 space-y-3">
            <button
              onClick={handleAddAnother}
              className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md hover:shadow-lg transition min-h-[52px]"
            >
              <Camera className="w-5 h-5" />
              <span>+ Add Another Item</span>
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link
                href={`/items/${createdItem.id}`}
                className="py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold text-center transition min-h-[44px] flex items-center justify-center"
              >
                View Item
              </Link>
              <Link
                href="/items"
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold text-center transition min-h-[44px] flex items-center justify-center"
              >
                Done (All Items)
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Quick Add Form ---
  return (
    <div className="max-w-md mx-auto pb-24 sm:pb-8">
      {/* Hidden file inputs for Camera and Gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      <form onSubmit={handleSaveItem} className="space-y-4">
        {/* Top Title Banner */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Camera className="w-6 h-6 text-blue-600" />
              <span>Quick Add Item</span>
            </h1>
            <p className="text-xs text-slate-500">
              Snap a photo, identify the item, place it, and save.
            </p>
          </div>
          <Link
            href="/items"
            className="text-xs text-slate-500 hover:text-slate-800 p-2"
          >
            Cancel
          </Link>
        </div>

        {saveError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Section 1: Camera Photo Trigger / Preview */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Step 1: Item Photo
          </label>

          {!previewUrl ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2.5 py-7 px-4 rounded-2xl bg-blue-50/80 hover:bg-blue-100 text-blue-700 border-2 border-dashed border-blue-300 transition active:scale-98 min-h-[110px]"
              >
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">Take Photo</span>
              </button>

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2.5 py-7 px-4 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 border-2 border-dashed border-slate-300 transition active:scale-98 min-h-[110px]"
              >
                <div className="w-12 h-12 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center shadow-inner">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold">From Gallery</span>
              </button>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group">
              <div className="relative w-full h-56 sm:h-64">
                <Image
                  src={previewUrl}
                  alt="Item capture preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>

              {/* Uploading progress indicator */}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                  <span className="text-xs font-semibold">Uploading to Cloudinary...</span>
                </div>
              )}

              {/* Retake Button Overlay */}
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={handleRetakePhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-white text-xs font-semibold rounded-full backdrop-blur-xs transition min-h-[36px]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>

              {uploadedImage && !isUploadingPhoto && (
                <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600/90 text-white text-[11px] font-bold rounded-full backdrop-blur-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Photo Ready</span>
                </div>
              )}
            </div>
          )}

          {photoError && (
            <p className="text-[11px] text-rose-600 italic">{photoError}</p>
          )}
        </div>

        {/* Section 2: Item Name & Identification */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <label
            htmlFor="item-name"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            Step 2: What is this item?
          </label>
          <input
            id="item-name"
            type="text"
            required
            placeholder="e.g. Coffee Mug, USB Mouse, Water Bottle"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-base font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[48px]"
          />

          {/* Stepper Quantity + Unit */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Quantity
              </label>
              <div className="flex items-center border border-slate-300 rounded-2xl bg-slate-50 overflow-hidden min-h-[44px]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-2.5 text-slate-600 hover:bg-slate-200 transition min-w-[44px] flex items-center justify-center"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center bg-transparent text-sm font-bold text-slate-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="p-2.5 text-slate-600 hover:bg-slate-200 transition min-w-[44px] flex items-center justify-center"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="pairs">Pairs</option>
                <option value="sets">Sets</option>
                <option value="boxes">Boxes</option>
                <option value="bottles">Bottles</option>
                <option value="packs">Packs</option>
              </select>
            </div>
          </div>

          {/* Optional Price Field */}
          <div className="pt-2">
            <label
              htmlFor="item-price"
              className="block text-[11px] font-semibold text-slate-600 mb-1"
            >
              Estimated / Purchase Price (₹ Optional)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-bold text-slate-400 select-none">
                ₹
              </span>
              <input
                id="item-price"
                type="number"
                step="any"
                min="0"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Category Pills */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-2.5">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Step 3: Category
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition min-h-[40px] flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4: Where is it? Location / Container */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Step 4: Where is it stored?
          </label>

          {/* Segmented Destination Toggle */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setDestinationType('location')}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition min-h-[40px] flex items-center justify-center gap-1 ${
                destinationType === 'location'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Location</span>
            </button>

            <button
              type="button"
              onClick={() => setDestinationType('container')}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition min-h-[40px] flex items-center justify-center gap-1 ${
                destinationType === 'container'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Box / Bin</span>
            </button>

            <button
              type="button"
              onClick={() => setDestinationType('unplaced')}
              className={`py-2 px-1 text-xs font-bold rounded-xl transition min-h-[40px] flex items-center justify-center gap-1 ${
                destinationType === 'unplaced'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Unplaced</span>
            </button>
          </div>

          {/* Dynamic selector based on destination type */}
          {destinationType === 'location' ? (
            <div>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2.5 bg-blue-50/40 border border-blue-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
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
            </div>
          ) : destinationType === 'container' ? (
            <div>
              {containers.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                  No storage boxes found. Create a container first or select a Location.
                </div>
              ) : (
                <select
                  value={selectedContainerId}
                  onChange={(e) => setSelectedContainerId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-amber-50/40 border border-amber-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 min-h-[44px]"
                >
                  <option value="" disabled>
                    -- Select Container / Storage Box --
                  </option>
                  {containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — [{c.breadcrumbString}]
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic p-2 bg-slate-50 rounded-xl">
              Item will be saved as unplaced stock in the household.
            </p>
          )}

          {/* Placement notes */}
          {destinationType !== 'unplaced' && (
            <input
              type="text"
              placeholder="Specific spot note (e.g. Left shelf, front corner)"
              value={placementNotes}
              onChange={(e) => setPlacementNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[40px]"
            />
          )}
        </div>

        {/* Sticky Mobile Bottom Bar */}
        <div className="fixed sm:static bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md sm:bg-transparent border-t sm:border-t-0 border-slate-200 z-40">
          <div className="max-w-md mx-auto">
            <button
              type="submit"
              disabled={isSaving || isUploadingPhoto}
              className="w-full py-4 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition disabled:opacity-50 min-h-[52px] flex items-center justify-center gap-2 active:scale-98"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving Item...</span>
                </>
              ) : isUploadingPhoto ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading Photo...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Save Item</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
