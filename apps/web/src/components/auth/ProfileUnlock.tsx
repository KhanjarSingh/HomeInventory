'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchApi } from '../../lib/api';
import type { HouseholdProfilesResponseDto, FamilyProfileDto } from '@home-inventory/shared';
import { ArrowLeft, Delete, Lock, Loader2 } from 'lucide-react';

const DEFAULT_FAMILY_PROFILES: FamilyProfileDto[] = [
  {
    id: 'vithal',
    fullName: 'Vithal Tandalwade',
    email: 'vithal@tandalwade.local',
    role: 'owner',
    initials: 'VT',
  },
  {
    id: 'shailaja',
    fullName: 'Shailaja Tandalwade',
    email: 'shailaja@tandalwade.local',
    role: 'owner',
    initials: 'ST',
  },
  {
    id: 'rutuja',
    fullName: 'Rutuja Tandalwade',
    email: 'rutuja@tandalwade.local',
    role: 'editor',
    initials: 'RT',
  },
  {
    id: 'parth',
    fullName: 'Parth Tandalwade',
    email: 'parth@tandalwade.local',
    role: 'editor',
    initials: 'PT',
  },
];

const PROFILE_THEMES: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  'vithal': {
    bg: 'bg-purple-600',
    text: 'text-purple-600',
    ring: 'border-purple-200 hover:border-purple-400 hover:shadow-purple-100',
    dot: 'bg-purple-600',
  },
  'shailaja': {
    bg: 'bg-rose-500',
    text: 'text-rose-500',
    ring: 'border-rose-200 hover:border-rose-400 hover:shadow-rose-100',
    dot: 'bg-rose-500',
  },
  'rutuja': {
    bg: 'bg-blue-600',
    text: 'text-blue-600',
    ring: 'border-blue-200 hover:border-blue-400 hover:shadow-blue-100',
    dot: 'bg-blue-600',
  },
  'parth': {
    bg: 'bg-emerald-600',
    text: 'text-emerald-600',
    ring: 'border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-100',
    dot: 'bg-emerald-600',
  },
};

function getProfileTheme(name: string) {
  const first = name.toLowerCase().split(' ')[0] || '';
  return PROFILE_THEMES[first] || {
    bg: 'bg-indigo-600',
    text: 'text-indigo-600',
    ring: 'border-indigo-200 hover:border-indigo-400 hover:shadow-indigo-100',
    dot: 'bg-indigo-600',
  };
}

interface ProfileUnlockProps {
  onSuccess?: () => void;
}

export function ProfileUnlock({ onSuccess }: ProfileUnlockProps) {
  const { login } = useAuth();
  const [householdName, setHouseholdName] = useState("Tandalwade's Residency");
  const [profiles, setProfiles] = useState<FamilyProfileDto[]>(DEFAULT_FAMILY_PROFILES);
  const [selectedProfile, setSelectedProfile] = useState<FamilyProfileDto | null>(null);
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  // Fetch live profiles from backend
  useEffect(() => {
    let isMounted = true;
    async function loadProfiles() {
      try {
        const res = await fetchApi<HouseholdProfilesResponseDto>('/auth/profiles');
        if (isMounted && res.data?.profiles?.length) {
          setProfiles(res.data.profiles);
          if (res.data.householdName) {
            setHouseholdName(res.data.householdName);
          }
        }
      } catch {
        // Fallback to DEFAULT_FAMILY_PROFILES if API is loading or offline
      }
    }
    loadProfiles();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectProfile = (profile: FamilyProfileDto) => {
    setSelectedProfile(profile);
    setPin('');
    setErrorMessage(null);
  };

  const handleBackToProfiles = () => {
    setSelectedProfile(null);
    setPin('');
    setErrorMessage(null);
  };

  const handleKeyPress = useCallback((digit: string) => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setPin((prev) => (prev.length < 4 ? prev + digit : prev));
  }, [isSubmitting]);

  const handleDeletePress = useCallback(() => {
    if (isSubmitting) return;
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  }, [isSubmitting]);

  // Physical keyboard support for desktop users
  useEffect(() => {
    if (!selectedProfile) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDeletePress();
      } else if (e.key === 'Escape') {
        handleBackToProfiles();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedProfile, handleKeyPress, handleDeletePress]);

  // Auto-attempt authentication as soon as 4 digits are entered
  useEffect(() => {
    if (!selectedProfile || pin.length !== 4) return;

    let isMounted = true;
    async function attemptUnlock() {
      setIsSubmitting(true);
      setErrorMessage(null);

      try {
        await login(selectedProfile!.email, pin);
        if (isMounted && onSuccess) {
          onSuccess();
        }
      } catch {
        if (isMounted) {
          setIsShaking(true);
          setErrorMessage('Incorrect PIN. Please try again.');
          setPin('');
          setTimeout(() => {
            if (isMounted) setIsShaking(false);
          }, 400);
        }
      } finally {
        if (isMounted) {
          setIsSubmitting(false);
        }
      }
    }

    attemptUnlock();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, selectedProfile]);

  const activeTheme = selectedProfile ? getProfileTheme(selectedProfile.fullName) : null;

  return (
    <div className="w-full max-w-md mx-auto">
      {!selectedProfile ? (
        /* SCREEN 1: Profile Selection */
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {householdName}
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Select your profile
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            {profiles.map((profile) => {
              const theme = getProfileTheme(profile.fullName);
              return (
                <button
                  key={profile.id}
                  onClick={() => handleSelectProfile(profile)}
                  className={`group relative flex flex-col items-center justify-center p-6 bg-white rounded-3xl border-2 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer ${theme.ring}`}
                >
                  <div
                    className={`w-18 h-18 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-md transition-transform duration-200 group-hover:scale-105 ${theme.bg}`}
                  >
                    {profile.initials}
                  </div>
                  <div className="mt-4 text-center">
                    <div className="font-bold text-slate-900 text-base leading-snug">
                      {profile.fullName}
                    </div>
                    <span className="inline-block mt-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {profile.role}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* SCREEN 2: Numeric Keypad PIN Unlock */
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Back button */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleBackToProfiles}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition py-1 px-2.5 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Change profile
            </button>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {householdName}
            </span>
          </div>

          {/* Profile Header */}
          <div className="text-center space-y-2">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-md mx-auto ${activeTheme?.bg}`}
            >
              {selectedProfile.initials}
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {selectedProfile.fullName}
            </h2>
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Enter your unlock PIN</span>
            </div>
          </div>

          {/* 4 PIN Indicators (○ ○ ○ ○ / ● ● ○ ○) */}
          <div
            className={`flex items-center justify-center gap-4 py-2 transition-transform duration-150 ${
              isShaking ? 'translate-x-1 duration-75' : ''
            }`}
          >
            {[0, 1, 2, 3].map((index) => {
              const isFilled = index < pin.length;
              return (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    isFilled
                      ? `${activeTheme?.dot} scale-110 shadow-xs`
                      : 'border-2 border-slate-300 bg-transparent'
                  }`}
                />
              );
            })}
          </div>

          {/* Error / Loading Feedback */}
          <div className="h-5 text-center flex items-center justify-center">
            {isSubmitting ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                Unlocking...
              </span>
            ) : errorMessage ? (
              <span className="text-xs font-semibold text-rose-600 animate-in fade-in">
                {errorMessage}
              </span>
            ) : null}
          </div>

          {/* On-Screen Numeric Keypad */}
          <div className="max-w-[280px] mx-auto grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(String(num))}
                disabled={isSubmitting}
                className="w-20 h-16 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 shadow-2xs text-2xl font-bold text-slate-800 transition flex items-center justify-center select-none active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {num}
              </button>
            ))}

            {/* Empty bottom-left placeholder */}
            <div className="w-20 h-16" />

            {/* 0 digit */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={isSubmitting}
              className="w-20 h-16 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 shadow-2xs text-2xl font-bold text-slate-800 transition flex items-center justify-center select-none active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              0
            </button>

            {/* ⌫ Backspace */}
            <button
              type="button"
              onClick={handleDeletePress}
              disabled={isSubmitting || pin.length === 0}
              className="w-20 h-16 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200 shadow-2xs text-slate-700 transition flex items-center justify-center select-none active:scale-95 disabled:opacity-30 cursor-pointer"
              aria-label="Backspace"
            >
              <Delete className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
