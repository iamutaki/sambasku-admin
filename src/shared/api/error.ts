import { isAxiosError } from 'axios';
import type { ApiErrorEnvelope, ApiFieldError } from './types';

/**
 * Normalisasi error menjadi satu bentuk yang dipakai UI.
 *
 * - 4xx/5xx dari backend → baca envelope `{ success, error_code, message, details }`
 * - 401 TOKEN_EXPIRED dari refresh gagal → `AuthExpiredError` (navigasi ke login)
 * - Selain itu → NETWORK_ERROR generik (tidak membocorkan detail teknis ke user).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details: ApiFieldError[] | null;

  constructor(status: number, errorCode: string, message: string, details: ApiFieldError[] | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }

  /** details → map field → pesan, untuk di-inject ke error inline Form antd. */
  fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

/** Sesi berakhir (refresh token invalid/expired) - wajib ke halaman login. */
export class AuthExpiredError extends Error {
  constructor() {
    super('Sesi berakhir, silakan masuk kembali');
    this.name = 'AuthExpiredError';
  }
}

/** True kalau error menandakan kredensial/refresh token ditolak backend (401). */
export function isAuthExpiredError(err: unknown): boolean {
  if (err instanceof AuthExpiredError) return true;
  const normalized = normalizeError(err);
  return normalized.status === 401;
}

export function normalizeError(err: unknown, fallbackMessage = 'Terjadi kesalahan pada server'): ApiError {
  if (err instanceof ApiError) return err;

  if (isAxiosError<ApiErrorEnvelope>(err)) {
    const envelope = err.response?.data;
    const status = err.response?.status ?? 0;
    if (status !== 0 && envelope && envelope.success === false) {
      return new ApiError(status, envelope.error_code, envelope.message, envelope.details);
    }
    return new ApiError(status, err.code === 'ECONNABORTED' ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR', fallbackMessage, null);
  }

  if (err instanceof Error && err.name === 'CanceledError') {
    return new ApiError(0, 'REQUEST_CANCELLED', err.message, null);
  }

  return new ApiError(0, 'UNKNOWN_ERROR', fallbackMessage, null);
}