import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import type { AttemptResponse, Puzzle } from '../api/schemas';
import {
    getGuestCompletedDatesAsync,
    getGuestCompletedDates,
    getGuestCompletedPuzzleIds,
    getGuestPuzzleResultAsync,
    getGuestPuzzleResult,
    isGuestPuzzleCompleted,
    clearGuestPuzzleStateForTest,
    setGuestPuzzleResult,
} from './guestPuzzleState';

class MemoryStorage {
    private values = new Map<string, string>();

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

const puzzle = {
    id: 11,
    puzzle_date: '2026-05-07',
    puzzle_name: 'Word One',
    puzzle_number: 42,
    puzzle_type: 'word',
    question: 'Guess it',
    hint: null,
    has_hint: false,
    total_hints: 0,
} as Puzzle;

const solvedResult: AttemptResponse = {
    correct: true,
    solved: true,
    score: 90,
    incorrect_guesses: 0,
    answer: 'ANSWER',
};

describe('guestPuzzleState', () => {
    beforeEach(() => {
        clearGuestPuzzleStateForTest();
        Object.defineProperty(globalThis, 'localStorage', {
            value: new MemoryStorage(),
            configurable: true,
        });
    });

    it('persists solved puzzle results by puzzle id', () => {
        setGuestPuzzleResult(puzzle, solvedResult);

        expect(isGuestPuzzleCompleted(11)).toBe(true);
        expect(getGuestPuzzleResult(11)).toEqual(solvedResult);
    });

    it('loads solved puzzle results from async device storage', async () => {
        setGuestPuzzleResult(puzzle, solvedResult);

        expect(await getGuestPuzzleResultAsync(11)).toEqual(solvedResult);
        expect(await getGuestCompletedDatesAsync('2026-05-01', '2026-05-31')).toEqual([
            '2026-05-07',
        ]);
        expect(await getGuestCompletedPuzzleIds()).toEqual(new Set([11]));
    });

    it('merges native history before writing completions made during a delayed read', async () => {
        delete (globalThis as { localStorage?: unknown }).localStorage;
        let finishRead!: (value: string) => void;
        vi.mocked(SecureStore.getItemAsync).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finishRead = resolve;
                })
        );
        vi.mocked(SecureStore.setItemAsync).mockClear();
        const loading = getGuestPuzzleResultAsync(10);
        setGuestPuzzleResult(puzzle, solvedResult);
        setGuestPuzzleResult({ ...puzzle, id: 12 }, solvedResult);
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
        finishRead(
            JSON.stringify({
                puzzles: { '10': { ...puzzle, id: 10, completed: true, result: solvedResult } },
            })
        );
        await loading;
        expect(await getGuestCompletedPuzzleIds()).toEqual(new Set([10, 11, 12]));
        await vi.waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2));
        const saved = JSON.parse(vi.mocked(SecureStore.setItemAsync).mock.calls.at(-1)![1]);
        expect(Object.keys(saved.puzzles)).toEqual(['10', '11', '12']);
        expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    });

    it.each([null, [], { bad: null, broken: { result: {} } }])(
        'ignores malformed native records without losing valid history: %j',
        async (invalid) => {
            delete (globalThis as { localStorage?: unknown }).localStorage;
            const valid = { ...puzzle, completed: true, result: solvedResult };
            vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(
                JSON.stringify({
                    puzzles:
                        invalid && !Array.isArray(invalid)
                            ? { ...invalid, [puzzle.id]: valid }
                            : invalid,
                })
            );
            const ids = await getGuestCompletedPuzzleIds();
            expect(ids).toEqual(
                invalid && !Array.isArray(invalid) ? new Set([puzzle.id]) : new Set()
            );
        }
    );

    it('does not persist incorrect attempts', () => {
        setGuestPuzzleResult(puzzle, { ...solvedResult, correct: false, solved: false });

        expect(isGuestPuzzleCompleted(11)).toBe(false);
    });

    it('leaves give-up persistence to the backend guest session', async () => {
        const gaveUpResult: AttemptResponse = {
            correct: false,
            solved: false,
            gave_up: true,
            score: 0,
            incorrect_guesses: 0,
            answer: 'ANSWER',
        };

        setGuestPuzzleResult(puzzle, gaveUpResult);

        expect(getGuestPuzzleResult(11)).toBeNull();
        expect(isGuestPuzzleCompleted(11)).toBe(false);
        expect(getGuestCompletedDates('2026-05-01', '2026-05-31')).toEqual([]);
        expect(await getGuestCompletedPuzzleIds()).toEqual(new Set());
    });

    it('returns completed dates inside the requested range', () => {
        setGuestPuzzleResult(puzzle, solvedResult);
        setGuestPuzzleResult(
            { ...puzzle, id: 12, puzzle_date: '2026-06-01' } as Puzzle,
            solvedResult
        );

        expect(getGuestCompletedDates('2026-05-01', '2026-05-31')).toEqual(['2026-05-07']);
    });
});
