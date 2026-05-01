import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

type MockResponse = {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
};

function makeResponse(status: number, body: unknown): MockResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    };
}

function makeTextResponse(status: number, text: string): MockResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => text,
    };
}

beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('apiRequest', () => {
    it('uses the configured API base URL when present', async () => {
        process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test/v1';

        const { apiBaseUrl } = await import('./client');

        expect(apiBaseUrl).toBe('https://api.example.test/v1');
    });

    it('uses localhost in development when no API base URL is configured', async () => {
        (globalThis as { __DEV__?: boolean }).__DEV__ = true;

        const { apiBaseUrl } = await import('./client');

        expect(apiBaseUrl).toBe('http://localhost:8000/api');
    });

    it('uses the production API URL outside development', async () => {
        const { apiBaseUrl } = await import('./client');

        expect(apiBaseUrl).toBe('https://puzzlepause.app/api');
    });

    it('sends bearer token and parses successful JSON responses', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { value: 'ok' }));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');
        const result = await apiRequest('/health', z.object({ value: z.string() }), {
            token: 'abc123',
        });

        expect(result.value).toBe('ok');
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/health');
        expect(options.headers).toMatchObject({ Authorization: 'Bearer abc123' });
        expect(options.credentials).toBe('omit');
    });

    it('omits auth and request body when token and body are not provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { value: 'ok' }));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');
        await apiRequest('/health', z.object({ value: z.string() }));

        const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(options.method).toBe('GET');
        expect(options.body).toBeUndefined();
        expect(options.headers).not.toMatchObject({ Authorization: expect.any(String) });
        expect(options.credentials).toBe('include');
    });

    it('serializes request bodies and forwards abort signals', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { updated: true }));
        vi.stubGlobal('fetch', fetchMock);
        const controller = new AbortController();

        const { apiRequest } = await import('./client');
        await apiRequest('/profile', z.object({ updated: z.boolean() }), {
            method: 'PATCH',
            body: { display_name: 'Puzzle Friend' },
            signal: controller.signal,
        });

        const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(options.method).toBe('PATCH');
        expect(options.body).toBe(JSON.stringify({ display_name: 'Puzzle Friend' }));
        expect(options.signal).toBe(controller.signal);
    });

    it('parses empty successful responses as null', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeTextResponse(204, ''));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/empty', z.null())).resolves.toBeNull();
    });

    it('returns schema validation errors for invalid successful payloads', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { value: 123 }));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/invalid', z.object({ value: z.string() }))).rejects.toThrow();
    });

    it('surfaces string detail errors from API payloads', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(makeResponse(400, { detail: 'Bad request payload' }));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/fail', z.unknown())).rejects.toMatchObject({
            status: 400,
            message: 'Bad request payload',
        });
    });

    it('surfaces first validation msg when detail is an array', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            makeResponse(422, {
                detail: [{ msg: 'Field required' }],
            })
        );
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/fail', z.unknown())).rejects.toMatchObject({
            status: 422,
            message: 'Field required',
        });
    });

    it('surfaces string entries in detail arrays', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(makeResponse(422, { detail: ['Invalid value'] }));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/fail', z.unknown())).rejects.toMatchObject({
            status: 422,
            message: 'Invalid value',
        });
    });

    it('surfaces error fields from rate-limit responses', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(makeResponse(429, { error: 'Too many requests' }));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/fail', z.unknown())).rejects.toMatchObject({
            status: 429,
            message: 'Too many requests',
        });
    });

    it('falls back to a status message for plain-text errors', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeTextResponse(500, 'upstream failed'));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/fail', z.unknown())).rejects.toMatchObject({
            status: 500,
            message: 'Request failed with status 500',
            body: 'upstream failed',
        });
    });

    it('falls back to a status message when validation details are empty', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(422, { detail: [] }));
        vi.stubGlobal('fetch', fetchMock);

        const { apiRequest } = await import('./client');

        await expect(apiRequest('/fail', z.unknown())).rejects.toMatchObject({
            status: 422,
            message: 'Request failed with status 422',
        });
    });

    it('does not call unauthorized handler on non-401 errors', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(403, { detail: 'Forbidden' }));
        vi.stubGlobal('fetch', fetchMock);
        const onUnauthorized = vi.fn();

        const { apiRequest, registerUnauthorizedHandler } = await import('./client');
        registerUnauthorizedHandler(onUnauthorized);

        await expect(apiRequest('/forbidden', z.unknown())).rejects.toMatchObject({ status: 403 });
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('calls unauthorized handler on 401 responses', async () => {
        const fetchMock = vi.fn().mockResolvedValue(makeResponse(401, { detail: 'Unauthorized' }));
        vi.stubGlobal('fetch', fetchMock);

        const onUnauthorized = vi.fn();
        const { apiRequest, registerUnauthorizedHandler } = await import('./client');
        registerUnauthorizedHandler(onUnauthorized);

        await expect(apiRequest('/secure', z.unknown(), { token: 'bad' })).rejects.toBeInstanceOf(
            Error
        );
        expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('rejects expired JWTs before optional-auth requests can fall back to a guest', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        const onUnauthorized = vi.fn();
        const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }));
        const token = `header.${payload}.signature`;

        const { apiRequest, registerUnauthorizedHandler } = await import('./client');
        registerUnauthorizedHandler(onUnauthorized);

        await expect(apiRequest('/optional-auth', z.unknown(), { token })).rejects.toMatchObject({
            status: 401,
            message: 'Your session has expired. Please sign in again.',
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });
});
