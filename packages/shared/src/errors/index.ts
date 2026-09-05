export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  HOUSEHOLD_NOT_FOUND: 'HOUSEHOLD_NOT_FOUND',

  // Validation & Input
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  STALE_WRITE: 'STALE_WRITE',

  // Inventory Specific
  INSUFFICIENT_QUANTITY: 'INSUFFICIENT_QUANTITY',
  QUANTITY_MISMATCH: 'QUANTITY_MISMATCH',
  CIRCULAR_LOCATION_HIERARCHY: 'CIRCULAR_LOCATION_HIERARCHY',
  CIRCULAR_CONTAINER_NESTING: 'CIRCULAR_CONTAINER_NESTING',
  INVALID_PLACEMENT_TARGET: 'INVALID_PLACEMENT_TARGET',
  LOCATION_HAS_CONTENTS: 'LOCATION_HAS_CONTENTS',
  CONTAINER_HAS_CONTENTS: 'CONTAINER_HAS_CONTENTS',

  // Server
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiSuccessResponse<T> {
  data: T;
  meta: {
    requestId: string;
    nextCursor?: string | null;
    totalCount?: number;
    [key: string]: unknown;
  };
}
