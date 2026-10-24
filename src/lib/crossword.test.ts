import { describe, expect, it } from 'vitest';
import { buildCrossword, wordCells } from './crossword';

describe('buildCrossword', () => {
    it('numbers cells that start an across or down word of 2+ letters', () => {
        // ...#
        // .#..
        // ....
        const grid = buildCrossword(['...#', '.#..', '....']);

        // prettier-ignore
        expect(grid.numbers).toEqual([
            1, undefined, 2, undefined,
            undefined, undefined, 3, 4,
            5, undefined, undefined, undefined,
        ]);
    });

    it('finds the word through a cell in each direction', () => {
        const grid = buildCrossword(['...#', '.#..', '....']);

        expect(wordCells(grid, 1, 'across')).toEqual([0, 1, 2]);
        expect(wordCells(grid, 4, 'down')).toEqual([0, 4, 8]);
        // Column 1 has a black square in the middle, so there's no down word through (0,1).
        expect(wordCells(grid, 1, 'down')).toEqual([]);
        // Across words don't wrap onto the next row.
        expect(wordCells(grid, 7, 'across')).toEqual([6, 7]);
    });
});
