import type { ApiErrorResponse, ApiSuccessResponse } from '@home-inventory/shared';

export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;

  const rawBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const baseWithoutV1 = rawBase.endsWith('/api/v1') ? rawBase.slice(0, -'/api/v1'.length) : rawBase;

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const pathWithoutV1 = cleanEndpoint.startsWith('/api/v1')
    ? cleanEndpoint.slice('/api/v1'.length)
    : cleanEndpoint;

  return `${baseWithoutV1}/api/v1${pathWithoutV1}`;
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
