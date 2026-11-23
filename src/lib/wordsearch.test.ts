import { describe, expect, it } from 'vitest';
import {
    findWordInGrid,
    parseWordsearchQuestion,
    wordLocation,
    wordsearchAnswers,
} from './wordsearch';

describe('wordsearch format and locations', () => {
    it('parses eight-word count, theme, CRLF and compact/spaced grids', () => {
        const parsed = parseWordsearchQuestion(' a b c\r\nDEF\r\nfind: 8\r\nTheme: Letters\r\n');
        expect(parsed.grid).toEqual([
            ['A', 'B', 'C'],
            ['D', 'E', 'F'],
        ]);
        expect(parsed.inputCount).toBe(8);
        expect(parsed.themeLine).toBe('Theme: Letters');
        expect(parsed.isCountFormat).toBe(true);
    });

    it('keeps legacy named-word puzzles at one field', () => {
        const parsed = parseWordsearchQuestion('C A T\nFind: CAT');
        expect(parsed.inputCount).toBe(1);
        expect(parsed.findLine).toBe('Find: CAT');
        expect(parsed.isCountFormat).toBe(false);
    });

    it.each(['Find: CAT', 'A B\nC\nFind: 2', 'A ?\nFind: 1'])(
        'falls back for malformed grid %s',
        (question) => {
            expect(parseWordsearchQuestion(question).grid).toBeNull();
        }
    );

    it.each([
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
    ])('finds a word in direction %i,%i', (dr, dc) => {
        const grid = Array.from({ length: 5 }, () => Array<string>(5).fill('X'));
        const cells = [...'CAT'].map((letter, i) => {
            const cell = { r: 2 + dr * i, c: 2 + dc * i };
            grid[cell.r][cell.c] = letter;
            return cell;
        });
        expect(findWordInGrid(grid, 'cat')).toEqual(cells);
    });

    it('uses the first occurrence and never wraps rows or invents a missing path', () => {
        const grid = [
            ['C', 'A', 'T'],
            ['C', 'A', 'T'],
        ];
        expect(findWordInGrid(grid, 'CAT')).toEqual([
            { r: 0, c: 0 },
            { r: 0, c: 1 },
            { r: 0, c: 2 },
        ]);
        expect(findWordInGrid(grid, 'TC')).toBeNull();
        expect(findWordInGrid(grid, 'DOG')).toBeNull();
        expect(findWordInGrid(grid, '')).toBeNull();
    });

    it('handles unordered words, alternatives and accessible coordinates', () => {
        expect(wordsearchAnswers('~cat dog | CAT')).toEqual(['CAT', 'DOG']);
        expect(
            wordLocation([
                { r: 0, c: 2 },
                { r: 1, c: 1 },
            ])
        ).toBe('Row 1 column 3 to row 2 column 2');
        expect(wordLocation(null)).toBe('Location unavailable');
    });
});
