import type { ApiErrorResponse, ApiSuccessResponse } from '@home-inventory/shared';

const TOKEN_STORAGE_KEY = 'home_inventory_access_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;

  const rawBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const baseWithoutV1 = rawBase.endsWith('/api/v1') ? rawBase.slice(0, -'/api/v1'.length) : rawBase;

  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  while (cleanEndpoint.startsWith('/api/v1')) {
    cleanEndpoint = cleanEndpoint.slice('/api/v1'.length) || '/';
  }

  const normalizedPath = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;

  return `${baseWithoutV1}/api/v1${normalizedPath}`;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly details?: unknown[];

  constructor(code: string, message: string, details?: unknown[]) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiSuccessResponse<T>> {
  const url = buildApiUrl(endpoint);

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getStoredToken();
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // send httpOnly cookies automatically
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const body = await response.json();

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse;
    throw new ApiClientError(
      errorBody.error?.code || 'API_ERROR',
      errorBody.error?.message || 'An error occurred while fetching from API',
      errorBody.error?.details
    );
  }

  return body as ApiSuccessResponse<T>;
}
