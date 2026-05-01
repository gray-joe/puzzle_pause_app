import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../api/schemas';
import { formatPuzzleAnswer } from './puzzleAnswer';

const basePuzzle = {
    id: 10,
    puzzle_date: '2026-05-07',
    puzzle_name: 'Answer Check',
    puzzle_number: 42,
    hint: null,
    has_hint: false,
    total_hints: 1,
};

describe('formatPuzzleAnswer', () => {
    it('converts order answer indices to labels', () => {
        const puzzle = {
            ...basePuzzle,
            puzzle_type: 'order',
            question: {
                prompt: 'Sort these words into alphabetical order:',
                items: ['Three', 'One', 'Two'],
            },
        } as Puzzle;

        expect(formatPuzzleAnswer(puzzle, '1,2,0')).toBe('1. One\n2. Two\n3. Three');
    });

    it('leaves non-order answers unchanged', () => {
        const puzzle = {
            ...basePuzzle,
            puzzle_type: 'word',
            question: '<p>Guess it</p>',
        } as Puzzle;

        expect(formatPuzzleAnswer(puzzle, 'ANSWER')).toBe('ANSWER');
    });

    it('formats accepted standard answers and removes the matching marker', () => {
        const puzzle = {
            ...basePuzzle,
            puzzle_type: 'word',
            question: '<p>Guess it</p>',
        } as Puzzle;

        expect(formatPuzzleAnswer(puzzle, '~FIRST|SECOND')).toBe('FIRST, SECOND');
    });

    it('converts choice answer letters to labels', () => {
        const puzzle = {
            ...basePuzzle,
            puzzle_type: 'choice',
            question: {
                prompt: 'Pick one',
                options: ['Alpha', ' Beta', 'Gamma'],
            },
        } as Puzzle;

        expect(formatPuzzleAnswer(puzzle, 'B')).toBe('Beta');
    });

    it('converts match answer indices to pairs', () => {
        const puzzle = {
            ...basePuzzle,
            puzzle_type: 'match',
            question: {
                prompt: 'Match each country to its capital city:',
                left: ['France', 'Japan', 'Brazil', 'Australia'],
                right: ['Canberra', 'Paris', 'Brasilia', 'Tokyo'],
            },
        } as Puzzle;

        expect(formatPuzzleAnswer(puzzle, '1,3,2,0')).toBe(
            'France -> Paris\nJapan -> Tokyo\nBrazil -> Brasilia\nAustralia -> Canberra'
        );
    });

    it('uses the revealed question to format order and match answers', () => {
        const orderPuzzle = {
            ...basePuzzle,
            puzzle_type: 'order',
            question: { prompt: 'Sort', items: ['Hidden'] },
        } as Puzzle;
        const matchPuzzle = {
            ...basePuzzle,
            puzzle_type: 'match',
            question: { prompt: 'Match', left: ['Hidden'], right: ['Hidden'] },
        } as Puzzle;

        expect(
            formatPuzzleAnswer(
                orderPuzzle,
                '1,0',
                JSON.stringify({ prompt: 'Sort', items: ['Second', 'First'] })
            )
        ).toBe('1. First\n2. Second');
        expect(
            formatPuzzleAnswer(
                matchPuzzle,
                '1,0',
                JSON.stringify({ left: ['A', 'B'], right: ['One', 'Two'] })
            )
        ).toBe('A -> Two\nB -> One');
    });

    it('converts connections answers to category groups from the solved question', () => {
        const puzzle = {
            ...basePuzzle,
            puzzle_type: 'connections',
            question: {
                prompt: 'Group these 9 words into 3 categories of 3:',
                items: [
                    'Apple',
                    'Banana',
                    'Cherry',
                    'Carrot',
                    'Broccoli',
                    'Spinach',
                    'Red',
                    'Blue',
                    'Green',
                ],
            },
        } as Puzzle;

        expect(
            formatPuzzleAnswer(
                puzzle,
                '0,1,2|3,4,5|6,7,8',
                JSON.stringify({
                    prompt: 'Group these 9 words into 3 categories of 3:',
                    items: [
                        'Apple',
                        'Banana',
                        'Cherry',
                        'Carrot',
                        'Broccoli',
                        'Spinach',
                        'Red',
                        'Blue',
                        'Green',
                    ],
                    categories: ['Fruits', 'Vegetables', 'Colors'],
                })
            )
        ).toBe(
            'Fruits: Apple, Banana, Cherry\nVegetables: Carrot, Broccoli, Spinach\nColors: Red, Blue, Green'
        );
    });
});
