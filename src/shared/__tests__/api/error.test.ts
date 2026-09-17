import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { ApiError, normalizeError, isAuthExpiredError, AuthExpiredError } from '@/shared/api/error';
import type { ApiErrorEnvelope } from '@/shared/api/types';

function makeAxiosError(status: number, data: Partial<ApiErrorEnvelope>): AxiosError<ApiErrorEnvelope> {
  return new AxiosError<ApiErrorEnvelope>(
    'Request failed',
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    {
      status,
      statusText: 'error',
      headers: {},
      data: data as ApiErrorEnvelope,
      config: { headers: new AxiosHeaders() },
    },
  );
}

describe('normalizeError', () => {
  it('meneruskan ApiError apa adanya', () => {
    const err = new ApiError(400, 'VALIDATION_ERROR', 'pesan', null);
    expect(normalizeError(err)).toBe(err);
  });

  it('membaca envelope 4xx dari backend (error_code + message + details)', () => {
    const err = makeAxiosError(400, {
      success: false,
      error_code: 'VALIDATION_ERROR',
      message: 'Data yang dikirim tidak valid',
      details: [{ field: 'lemma', message: 'Kata tidak boleh kosong' }],
    });
    const normalized = normalizeError(err);
    expect(normalized).toBeInstanceOf(ApiError);
    expect(normalized.status).toBe(400);
    expect(normalized.errorCode).toBe('VALIDATION_ERROR');
    expect(normalized.fieldErrors()).toEqual({ lemma: 'Kata tidak boleh kosong' });
  });

  it('mengubah error jaringan/tanpa envelope menjadi ApiError generik', () => {
    const err = new AxiosError<ApiErrorEnvelope>('Network Error', AxiosError.ERR_NETWORK);
    const normalized = normalizeError(err);
    expect(normalized.errorCode).toBe('NETWORK_ERROR');
    expect(normalized.status).toBe(0);
  });

  it('mengubah timeout menjadi TIMEOUT_ERROR', () => {
    const err = new AxiosError<ApiErrorEnvelope>('timeout', AxiosError.ECONNABORTED);
    expect(normalizeError(err).errorCode).toBe('TIMEOUT_ERROR');
  });

  it('mengubah error tak dikenal menjadi UNKNOWN_ERROR', () => {
    expect(normalizeError(new Error('bebas')).errorCode).toBe('UNKNOWN_ERROR');
  });
});

describe('isAuthExpiredError', () => {
  it('true untuk AuthExpiredError eksplisit', () => {
    expect(isAuthExpiredError(new AuthExpiredError())).toBe(true);
  });

  it('true untuk envelope 401 dari backend', () => {
    const err = makeAxiosError(401, { success: false, error_code: 'TOKEN_EXPIRED', message: 'expired', details: null });
    expect(isAuthExpiredError(err)).toBe(true);
  });

  it('false untuk error non-401', () => {
    const err = makeAxiosError(500, { success: false, error_code: 'INTERNAL_ERROR', message: 'server', details: null });
    expect(isAuthExpiredError(err)).toBe(false);
  });
});