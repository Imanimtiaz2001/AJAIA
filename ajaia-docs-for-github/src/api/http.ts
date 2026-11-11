import type { ApiErrorBody, ErrorCode } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: Method;
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

/**
 * The only place the client talks HTTP. Adds the CSRF header, sends the
 * session cookie, and turns every failure into a typed ApiError.
 */
export async function request<T>(
  path: string,
  { method = 'GET', json, form, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'ajaia-docs', Accept: 'application/json' };
  if (json !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'INTERNAL', 'You appear to be offline. Changes will retry automatically.');
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!response.ok) {
    const error = body?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? `Request failed (${response.status}).`,
      error?.details,
    );
  }
  return body as T;
}
