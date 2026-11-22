const RAW_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080/api/v1';

export const API_BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');
export const AUTH_TOKEN_STORAGE_KEY = 'fastix_auth_token_v1';

export interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, unknown> | null;
}

export interface ApiEnvelope<T, M = Record<string, unknown>> {
  success: boolean;
  data?: T;
  meta?: M;
  error?: ApiErrorBody;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown> | null;

  constructor(
    message: string,
    status: number,
    code = 'API_ERROR',
    details?: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage write errors
  }
}

export async function apiRequest<T, M = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta?: M }> {
  const url = path.startsWith('http')
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getAuthToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiClientError(
      'Tidak dapat terhubung ke server Fastix. Pastikan layanan API sedang berjalan.',
      0,
      'NETWORK_ERROR',
    );
  }

  let payload: ApiEnvelope<T, M> | null = null;
  try {
    payload = (await res.json()) as ApiEnvelope<T, M>;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload || !payload.success) {
    const errMsg =
      payload?.error?.message ||
      (res.status === 401
        ? 'Sesi Anda telah berakhir. Silakan masuk kembali.'
        : 'Terjadi kendala saat memproses permintaan.');
    const errCode = payload?.error?.code || `HTTP_${res.status}`;
    throw new ApiClientError(errMsg, res.status, errCode, payload?.error?.details);
  }

  return {
    data: payload.data as T,
    meta: payload.meta,
  };
}

export function apiGet<T, M = Record<string, unknown>>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta?: M }> {
  return apiRequest<T, M>(path, { ...options, method: 'GET' });
}

export function apiPost<T, M = Record<string, unknown>>(
  path: string,
  body?: unknown,
  options: RequestInit = {},
): Promise<{ data: T; meta?: M }> {
  return apiRequest<T, M>(path, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T, M = Record<string, unknown>>(
  path: string,
  body?: unknown,
  options: RequestInit = {},
): Promise<{ data: T; meta?: M }> {
  return apiRequest<T, M>(path, {
    ...options,
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
