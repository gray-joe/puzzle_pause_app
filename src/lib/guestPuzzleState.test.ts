import { beforeEach, describe, expect, it } from 'vitest';
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
