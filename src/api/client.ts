import type { z } from 'zod';

const BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (__DEV__ ? 'http://localhost:8000/api' : 'https://puzzlepause.app/api');

export class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.body = body;
    }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type RequestOptions = {
    method?: Method;
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
};

let onUnauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(fn: () => void): void {
    onUnauthorizedHandler = fn;
}

function extractDetail(parsed: unknown): string | null {
    if (!parsed || typeof parsed !== 'object') return null;
    const { detail, error } = parsed as { detail?: unknown; error?: unknown };
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: unknown } | string;
        if (typeof first === 'string') return first;
        if (typeof first?.msg === 'string') return first.msg;
    }
    if (typeof error === 'string') return error;
    return null;
}

function isExpiredJwt(token: string): boolean {
    const payload = token.split('.')[1];
    if (!payload) return false;

    try {
        const unpadded = payload.replace(/-/g, '+').replace(/_/g, '/');
        const base64 = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, '=');
        const decoded = JSON.parse(atob(base64)) as { exp?: unknown };
        return typeof decoded.exp === 'number' && decoded.exp * 1000 <= Date.now();
    } catch {
        return false;
    }
}

export async function apiRequest<T>(
    path: string,
    schema: z.ZodType<T>,
    opts: RequestOptions = {}
): Promise<T> {
    const { method = 'GET', body, token, signal } = opts;
    if (token && isExpiredJwt(token)) {
        onUnauthorizedHandler?.();
        throw new ApiError(401, 'Your session has expired. Please sign in again.', null);
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        // Guests need the backend's persistent guest_session cookie. Authenticated
        // requests omit cookies so a stale web session cannot override the bearer token.
        credentials: token ? 'omit' : 'include',
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = text;
        }
    }

    if (!res.ok) {
        const detail = extractDetail(parsed);
        const error = new ApiError(
            res.status,
            detail ?? `Request failed with status ${res.status}`,
            parsed
        );
        if (res.status === 401) onUnauthorizedHandler?.();
        throw error;
    }

    return schema.parse(parsed);
}

export const apiBaseUrl = BASE_URL;
