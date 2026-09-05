import { ERROR_CODES, type ErrorCode, type ApiErrorDetail } from '@home-inventory/shared';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ApiErrorDetail[];

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: ApiErrorDetail[]): AppError {
    return new AppError(400, ERROR_CODES.BAD_REQUEST, message, details);
  }

  static validation(message: string, details?: ApiErrorDetail[]): AppError {
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(401, ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(403, ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message: string, code: ErrorCode = ERROR_CODES.CONFLICT): AppError {
    return new AppError(409, code, message);
  }

  static staleWrite(message = 'Resource has been modified by another process'): AppError {
    return new AppError(409, ERROR_CODES.STALE_WRITE, message);
  }

  static internal(message = 'Internal server error'): AppError {
    return new AppError(500, ERROR_CODES.INTERNAL_SERVER_ERROR, message);
  }
}
