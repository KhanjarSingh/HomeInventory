'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchApi, ApiClientError } from '../lib/api';
import type { UserDto, HouseholdDto, HouseholdRole } from '@home-inventory/shared';

interface AuthContextType {
  user: UserDto | null;
  activeHousehold: (HouseholdDto & { role: HouseholdRole }) | null;
  households: HouseholdDto[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, householdName?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchHousehold: (householdId: string) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [activeHousehold, setActiveHousehold] = useState<(HouseholdDto & { role: HouseholdRole }) | null>(null);
  const [households, setHouseholds] = useState<HouseholdDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = async () => {
    try {
      setIsLoading(true);
      const res = await fetchApi<{
        user: UserDto;
        activeHousehold: (HouseholdDto & { role: HouseholdRole }) | null;
        households: HouseholdDto[];
      }>('/auth/me');

      setUser(res.data.user);
      setActiveHousehold(res.data.activeHousehold);
      setHouseholds(res.data.households);
    } catch {
      setUser(null);
      setActiveHousehold(null);
      setHouseholds([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetchApi<{
      user: UserDto;
      household: HouseholdDto & { role: HouseholdRole };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setUser(res.data.user);
    setActiveHousehold(res.data.household);
    await refreshAuth();
  };

  const register = async (
    fullName: string,
    email: string,
    password: string,
    householdName?: string
  ) => {
    const res = await fetchApi<{
      user: UserDto;
      household: HouseholdDto & { role: HouseholdRole };
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password, householdName }),
    });

    setUser(res.data.user);
    setActiveHousehold(res.data.household);
    await refreshAuth();
  };

  const switchHousehold = async (householdId: string) => {
    const res = await fetchApi<{
      user: UserDto;
      household: HouseholdDto & { role: HouseholdRole };
    }>('/auth/switch-household', {
      method: 'POST',
      body: JSON.stringify({ householdId }),
    });

    setUser(res.data.user);
    setActiveHousehold(res.data.household);
    await refreshAuth();
  };

  const logout = async () => {
    try {
      await fetchApi('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setActiveHousehold(null);
      setHouseholds([]);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeHousehold,
        households,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        switchHousehold,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
