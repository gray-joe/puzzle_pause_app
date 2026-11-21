import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { getProgress, saveProgress } from './progress';

const progress = {
    version: 2,
    question: '{ "grid": "000" }',
    entries: ['1', '', ''],
    completed: false,
    opened_at: '2026-01-01T00:00:00',
    incorrect_guesses: 2,
    hint_used: 1,
    hint: 'Hint',
};
function respond(status: number, body: unknown) {
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('progress API contract', () => {
    it('uses the shared authenticated endpoint and parses authoritative metadata', async () => {
        const fetchMock = vi.fn().mockResolvedValue(respond(200, progress));
        vi.stubGlobal('fetch', fetchMock);
        expect(await getProgress('jwt', 12)).toEqual(progress);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/puzzle/12/progress'),
            expect.objectContaining({
                method: 'GET',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' },
                credentials: 'omit',
                signal: expect.any(AbortSignal),
            })
        );
    });
    it('sends exact question, CAS version and entries with PUT, without scoring fields', async () => {
        const fetchMock = vi.fn().mockResolvedValue(respond(200, progress));
        vi.stubGlobal('fetch', fetchMock);
        await saveProgress('jwt', 12, 1, progress.question, progress.entries);
        const options = fetchMock.mock.calls[0]![1] as RequestInit;
        expect(options.method).toBe('PUT');
        expect(JSON.parse(options.body as string)).toEqual({
            version: 1,
            question: progress.question,
            entries: progress.entries,
        });
    });
    it('propagates optimistic concurrency errors', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockResolvedValue(respond(409, { detail: 'Progress changed on another device' }))
        );
        await expect(
            saveProgress('jwt', 12, 1, progress.question, progress.entries)
        ).rejects.toMatchObject({
            status: 409,
            message: 'Progress changed on another device',
        } satisfies Partial<ApiError>);
    });
    it('aborts a stalled native request without requiring AbortSignal.timeout', async () => {
        vi.useFakeTimers();
        vi.stubGlobal(
            'fetch',
            vi.fn(
                (_url: string, options: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        options.signal!.addEventListener('abort', () =>
                            reject(new Error('aborted'))
                        );
                    })
            )
        );
        const request = getProgress('jwt', 12);
        const rejected = expect(request).rejects.toThrow('aborted');
        await vi.advanceTimersByTimeAsync(10000);
        await rejected;
    });
});
