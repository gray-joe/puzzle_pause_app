import { describe, expect, it } from 'vitest';
import { PuzzleSchema, AttemptResponseSchema, HintResponseSchema } from './schemas';

const base = {
    id: 1,
    puzzle_date: '2026-10-05',
    puzzle_name: 'Grid',
    puzzle_number: 1,
    hint: null,
    has_hint: false,
    total_hints: 0,
};

function gridPayload(type: string, rows: number, cols: number) {
    return {
        ...base,
        puzzle_type: type,
        question: JSON.stringify(
            type === 'crossword'
                ? {
                      prompt: '',
                      layout: Array(rows).fill('.'.repeat(cols)),
                      clues: { across: {}, down: {} },
                  }
                : {
                      prompt: '',
                      cells: Array.from({ length: rows }, () => Array(cols).fill(1)),
                      givens: {},
                  }
        ),
    };
}

describe.each(['crossword', 'codeword'])('%s provider grid bounds', (type) => {
    it.each([
        [3, 3],
        [15, 15],
        [16, 16],
        [25, 25],
        [3, 25],
        [25, 3],
    ])('accepts %i by %i grids', (rows, cols) => {
        expect(PuzzleSchema.safeParse(gridPayload(type, rows, cols)).success).toBe(true);
    });
    it.each([
        [2, 3],
        [3, 2],
        [26, 3],
        [3, 26],
    ])('rejects %i by %i grids', (rows, cols) => {
        expect(PuzzleSchema.safeParse(gridPayload(type, rows, cols)).success).toBe(false);
    });
    it('rejects ragged grids', () => {
        const payload = gridPayload(type, 3, 3);
        const question = JSON.parse(payload.question);
        if (type === 'crossword') question.layout[1] = '....';
        else question.cells[1].push(1);
        expect(
            PuzzleSchema.safeParse({ ...payload, question: JSON.stringify(question) }).success
        ).toBe(false);
    });
});

describe('Countdown provider contract', () => {
    it.each([undefined, 'Running total enabled'])(
        'accepts a total-only hint and restored purchase %s',
        (revealed_hint) => {
            const puzzle = PuzzleSchema.parse({
                ...base,
                puzzle_type: 'countdown',
                question: JSON.stringify({
                    prompt: 'Reach the target',
                    target: 306,
                    numbers: [75, 50, 6, 3, 2, 1],
                    operators: ['+', '-', '×', '÷'],
                }),
                hint: null,
                has_hint: true,
                total_hints: 1,
                revealed_hint,
            });
            expect(puzzle.total_hints).toBe(1);
            expect(puzzle.revealed_hint).toBe(revealed_hint);
            expect(
                HintResponseSchema.parse({ hint: 'Running total enabled', total_hints: 1 }).hint
            ).toBe('Running total enabled');
        }
    );
});

describe('provider response compatibility', () => {
    it.each([undefined, null])(
        'accepts guest attempt %s and omitted solution fields',
        (attempt) => {
            const parsed = PuzzleSchema.parse({
                ...base,
                puzzle_type: 'word',
                question: 'Question',
                attempt,
                revealed_hint: 'First|Second',
                completion_stats: {
                    completion_percentage: 25,
                    completed_users: 5,
                    average_seconds: null,
                    average_score: null,
                },
            });
            expect(parsed.revealed_hint).toBe('First|Second');
            expect(parsed.answer).toBeUndefined();
        }
    );
    it.each(['image-tap', 'image-order'])('preserves %s for the unsupported flow', (type) => {
        const parsed = PuzzleSchema.parse({
            ...base,
            puzzle_type: type,
            question: '{"prompt":"Play on web"}',
        });
        expect(typeof parsed.question).toBe('string');
    });
    it.each([[0, 3, 6], [], undefined])(
        'retains optional submission cell feedback %j',
        (error_cells) => {
            const parsed = AttemptResponseSchema.parse({
                correct: false,
                solved: false,
                score: null,
                incorrect_guesses: 1,
                error_cells,
            });
            expect(parsed.error_cells).toEqual(error_cells);
            expect(parsed.answer).toBeUndefined();
        }
    );
    it.each([null, [-1], [1.5], ['0']])('rejects invalid submission feedback %j', (error_cells) => {
        expect(
            AttemptResponseSchema.safeParse({
                correct: false,
                solved: false,
                score: null,
                incorrect_guesses: 1,
                error_cells,
            }).success
        ).toBe(false);
    });
    it('retains length penalty metadata', () => {
        expect(
            AttemptResponseSchema.parse({
                correct: true,
                solved: true,
                score: 90,
                incorrect_guesses: 0,
                length_penalty_applied: true,
            }).length_penalty_applied
        ).toBe(true);
    });
});
