import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { PuzzleProgress } from '../api/progress';
import { PuzzleSchema } from '../api/schemas';
import {
    draftFingerprint,
    type ProgressMetadata,
    type PuzzleDraft,
    type PuzzleDraftRepository,
} from './puzzleDrafts';
import { PuzzleProgressSession, type ProgressSnapshot } from './puzzleProgress';

const question = '{ "prompt": "Sudoku", "grid": "' + '0'.repeat(81) + '" }';
const puzzle = PuzzleSchema.parse({
    id: 7,
    puzzle_type: 'sudoku',
    puzzle_date: '2026-01-01',
    puzzle_number: 1,
    puzzle_name: 'Sudoku',
    question,
    hint: null,
    has_hint: true,
    total_hints: 1,
});
const metadata: ProgressMetadata = {
    opened_at: '2026-01-01T00:00:00Z',
    incorrect_guesses: 0,
    hint_used: 0,
    hints: [],
};
const entries = (char = '') => [char, ...Array<string>(80).fill('')];
function remote(overrides: Partial<PuzzleProgress> = {}): PuzzleProgress {
    return {
        version: 0,
        question,
        entries: null,
        completed: false,
        opened_at: '2026-01-01T00:00:00',
        incorrect_guesses: 0,
        hint_used: 0,
        hint: null,
        ...overrides,
    };
}
let disk: PuzzleDraft | null;
let repo: PuzzleDraftRepository;
let api: { get: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
let sessions: PuzzleProgressSession[];
beforeEach(() => {
    vi.useFakeTimers();
    disk = null;
    sessions = [];
    repo = {
        load: vi.fn(async () => disk),
        save: vi.fn(async (draft) => {
            disk = JSON.parse(JSON.stringify(draft));
        }),
        remove: vi.fn(async () => {
            disk = null;
        }),
    };
    api = { get: vi.fn(async () => remote()), save: vi.fn(async () => remote({ version: 1 })) };
});
afterEach(() => {
    sessions.forEach((s) => s.dispose());
    vi.useRealTimers();
});
function setup(token: string | null = 'token') {
    let snapshot: ProgressSnapshot;
    const onRestore = vi.fn();
    const session = new PuzzleProgressSession({
        puzzle,
        owner: token ? 'user:1' : 'guest',
        token,
        metadata,
        repository: repo,
        api: api as any,
        onRestore,
        onChange: (next) => {
            snapshot = next;
        },
    });
    sessions.push(session);
    return { session, onRestore, state: () => snapshot! };
}
function pendingDraft(overrides: Partial<PuzzleDraft> = {}): PuzzleDraft {
    return {
        owner: 'user:1',
        puzzleId: puzzle.id,
        version: 1,
        puzzleType: 'sudoku',
        fingerprint: draftFingerprint(puzzle),
        updatedAt: 'now',
        fields: { digits: entries('1') },
        metadata,
        sync: { serverVersion: 0, dirty: true, question },
        ...overrides,
    };
}

describe('hybrid progress session', () => {
    it('retains exact wire question and restores account entries and authoritative metadata before editing', async () => {
        expect(puzzle.raw_question).toBe(question);
        api.get.mockResolvedValue(
            remote({
                version: 5,
                entries: entries('3'),
                incorrect_guesses: 2,
                hint_used: 1,
                hint: 'A hint',
            })
        );
        const { session, state, onRestore } = setup();
        session.change('digits', entries('9'));
        expect(repo.save).not.toHaveBeenCalled();
        await session.load();
        expect(state().ready).toBe(true);
        expect(state().fields.digits).toEqual(entries('3'));
        expect(onRestore).toHaveBeenLastCalledWith({
            ...metadata,
            incorrect_guesses: 2,
            hint_used: 1,
            hints: ['A hint'],
        });
        expect(api.save).not.toHaveBeenCalled();
    });
    it('saves each edit locally immediately, debounces PUT and sends only version/question/entries', async () => {
        const { session } = setup();
        await session.load();
        session.change('digits', entries('1'));
        expect(disk?.fields.digits).toEqual(entries('1'));
        await vi.advanceTimersByTimeAsync(500);
        session.change('digits', entries('2'));
        await vi.advanceTimersByTimeAsync(599);
        expect(api.save).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(api.save).toHaveBeenCalledExactlyOnceWith('token', 7, 0, question, entries('2'));
        expect(disk?.sync).toEqual({ dirty: false, question, serverVersion: 1 });
    });
    it('sends edits made during an in-flight save in a subsequent version-checked save', async () => {
        const { session } = setup();
        await session.load();
        let finish!: (value: PuzzleProgress) => void;
        api.save.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        session.change('digits', entries('1'));
        const saving = session.sync();
        session.change('digits', entries('2'));
        finish(remote({ version: 1 }));
        await saving;
        expect(disk?.sync?.dirty).toBe(true);
        await vi.advanceTimersByTimeAsync(600);
        expect(api.save).toHaveBeenLastCalledWith('token', 7, 1, question, entries('2'));
        expect(disk?.sync?.dirty).toBe(false);
    });
    it('keeps guests local-only and persists timing, hints and penalties across reopen', async () => {
        const { session } = setup(null);
        await session.load();
        session.change('digits', entries('4'));
        session.updateMetadata({
            ...metadata,
            incorrect_guesses: 3,
            hint_used: 1,
            hints: ['hint'],
        });
        session.dispose();
        const reopened = setup(null);
        await reopened.session.load();
        expect(reopened.state().fields.digits).toEqual(entries('4'));
        expect(reopened.onRestore).toHaveBeenLastCalledWith({
            ...metadata,
            incorrect_guesses: 3,
            hint_used: 1,
            hints: ['hint'],
        });
        await reopened.session.retry();
        expect(api.get).not.toHaveBeenCalled();
        expect(api.save).not.toHaveBeenCalled();
    });
    it('migrates existing local-only drafts without losing entries', async () => {
        disk = pendingDraft({ sync: undefined, metadata: undefined });
        const { session } = setup();
        await session.load();
        await vi.advanceTimersByTimeAsync(600);
        expect(api.save).toHaveBeenCalledWith('token', 7, 0, question, entries('1'));
    });
    it('keeps failed saves dirty across reopening and reconciles before retrying', async () => {
        api.get.mockRejectedValue(new Error('offline'));
        const first = setup();
        await first.session.load();
        first.session.change('digits', entries('6'));
        await first.session.sync();
        first.session.dispose();
        expect(disk?.sync?.dirty).toBe(true);
        const second = setup();
        await second.session.load();
        expect(second.state().fields.digits).toEqual(entries('6'));
        api.get.mockResolvedValue(remote());
        await second.session.retry();
        expect(api.save).toHaveBeenCalledWith('token', 7, 0, question, entries('6'));
        expect(disk?.sync?.dirty).toBe(false);
    });
    it('refreshes clean drafts on resume without writing over account progress', async () => {
        const { session, state } = setup();
        await session.load();
        api.get.mockResolvedValue(remote({ version: 2, entries: entries('8') }));
        await session.retry();
        expect(state().fields.digits).toEqual(entries('8'));
        expect(api.save).not.toHaveBeenCalled();
    });
    for (const useServer of [true, false]) {
        it(`requires an explicit choice for stale pending edits (${useServer ? 'account' : 'device'})`, async () => {
            disk = pendingDraft();
            api.get.mockResolvedValue(remote({ version: 2, entries: entries('9') }));
            const { session, state } = setup();
            await session.load();
            expect(state().conflict?.version).toBe(2);
            await vi.advanceTimersByTimeAsync(1000);
            expect(api.save).not.toHaveBeenCalled();
            session.change('digits', entries('5')); // conflict blocks changes
            await session.resolveConflict(useServer);
            expect(state().conflict).toBeNull();
            if (useServer) {
                expect(state().fields.digits).toEqual(entries('9'));
                expect(api.save).not.toHaveBeenCalled();
            } else expect(api.save).toHaveBeenCalledWith('token', 7, 2, question, entries('1'));
        });
    }
    it('handles a PUT 409 and rechecks versions even after keeping the device copy', async () => {
        const { session, state } = setup();
        await session.load();
        api.save.mockRejectedValue(new ApiError(409, 'stale', null));
        api.get.mockResolvedValue(remote({ version: 3, entries: entries('3') }));
        session.change('digits', entries('1'));
        await session.sync();
        expect(state().conflict?.version).toBe(3);
        api.get.mockResolvedValue(remote({ version: 4, entries: entries('4') }));
        await session.resolveConflict(false);
        expect(api.save).toHaveBeenLastCalledWith('token', 7, 3, question, entries('1'));
        expect(state().conflict?.version).toBe(4);
    });
    for (const completed of [true, false]) {
        it(`blocks resurrection after ${completed ? 'remote completion' : 'question change'}`, async () => {
            disk = pendingDraft();
            api.get.mockResolvedValue(
                remote({ completed, question: completed ? question : question + ' ' })
            );
            const { session, state } = setup();
            await session.load();
            expect(state().blocked).toBe(true);
            session.change('digits', entries('9'));
            session.updateMetadata(metadata);
            await session.resolveConflict(false);
            await session.retry();
            expect(api.save).not.toHaveBeenCalled();
            if (completed) expect(disk).toBeNull();
        });
    }
    it('does not let a late PUT response recreate local progress after unmount/completion', async () => {
        const { session } = setup();
        await session.load();
        let finish!: (value: PuzzleProgress) => void;
        api.save.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                })
        );
        session.change('digits', entries('1'));
        const saving = session.sync();
        session.dispose();
        await repo.remove({ owner: 'user:1', puzzleId: 7 });
        finish(remote({ version: 1 }));
        await saving;
        expect(disk).toBeNull();
    });
    it('recovers through account persistence when local storage is blocked', async () => {
        vi.mocked(repo.save).mockRejectedValue(new Error('disk full'));
        const { session, state } = setup();
        await session.load();
        session.change('digits', entries('3'));
        await session.sync();
        expect(api.save).toHaveBeenCalled();
        expect(state().status).toBe('Progress saved to your account.');
    });
    it('never sends corrupted local entries to the backend', async () => {
        disk = pendingDraft({ fields: { digits: Array(81).fill('X') } });
        const { session, state } = setup();
        await session.load();
        await vi.advanceTimersByTimeAsync(1000);
        expect(state().fields).toEqual({});
        expect(api.save).not.toHaveBeenCalled();
    });
});
