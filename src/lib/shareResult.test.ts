import { describe, expect, it, vi } from 'vitest';
import type { AttemptResponse, Puzzle } from '../api/schemas';
import { buildShareText } from './shareResult';

const setStringAsyncMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('expo-clipboard', () => ({
    setStringAsync: setStringAsyncMock,
}));

const puzzle: Puzzle = {
    id: 10,
    puzzle_date: '2026-05-07',
    puzzle_name: 'Quick Maths',
    puzzle_number: 20,
    puzzle_type: 'math',
    question: '1+1=?',
    hint: null,
    has_hint: true,
    total_hints: 2,
};

const solvedResult: AttemptResponse = {
    correct: true,
    solved: true,
    score: null,
    incorrect_guesses: 0,
};

describe('buildShareText', () => {
    it('builds today score share text with elapsed time', () => {
        expect(
            buildShareText(
                puzzle,
                {
                    ...solvedResult,
                    score: 90,
                    opened_at: '2026-05-07T10:00:00Z',
                    completed_at: '2026-05-07T10:00:42Z',
                },
                'today'
            )
        ).toBe("I scored 90 on today's Puzzle Pause in 42s! https://puzzlepause.app");
    });

    it('builds archive score share text with puzzle number and minutes', () => {
        expect(
            buildShareText(
                puzzle,
                {
                    ...solvedResult,
                    score: 90,
                    opened_at: '2026-05-07T10:00:00Z',
                    completed_at: '2026-05-07T10:08:10Z',
                },
                'archive'
            )
        ).toBe('I scored 90 on Puzzle Pause #20 in 8m! https://puzzlepause.app/archive/10');
    });

    it('builds today solved share text with puzzle name and hours', () => {
        expect(
            buildShareText(
                puzzle,
                {
                    ...solvedResult,
                    opened_at: '2026-05-07T10:00:00Z',
                    completed_at: '2026-05-07T11:15:30Z',
                },
                'today'
            )
        ).toBe('I solved Quick Maths on Puzzle Pause in 1h 15m! https://puzzlepause.app');
    });

    it('builds archive solved share text with puzzle name', () => {
        expect(buildShareText(puzzle, solvedResult, 'archive')).toBe(
            'I solved Quick Maths on Puzzle Pause! https://puzzlepause.app/archive/10'
        );
    });

    it('builds non-score give-up share text', () => {
        const gaveUpResult: AttemptResponse = {
            ...solvedResult,
            correct: false,
            solved: false,
            gave_up: true,
            score: 0,
        };

        expect(buildShareText(puzzle, gaveUpResult, 'today')).toBe(
            "I tried today's Puzzle Pause! https://puzzlepause.app"
        );
        expect(buildShareText(puzzle, gaveUpResult, 'archive')).toBe(
            'I tried Quick Maths on Puzzle Pause! https://puzzlepause.app/archive/10'
        );
    });

    it('copies share text to the native clipboard', async () => {
        const { shareResult } = await import('./shareResult');

        shareResult('share text');

        expect(setStringAsyncMock).toHaveBeenCalledWith('share text');
    });

    it('does not throw when native clipboard copying fails', async () => {
        const { shareResult } = await import('./shareResult');

        setStringAsyncMock.mockRejectedValueOnce(new Error('Clipboard unavailable'));

        expect(() => shareResult('share text')).not.toThrow();
    });
});
