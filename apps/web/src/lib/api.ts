import type { ApiErrorResponse, ApiSuccessResponse } from '@home-inventory/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

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
