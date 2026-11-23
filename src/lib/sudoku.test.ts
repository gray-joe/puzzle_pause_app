import { describe, expect, it } from 'vitest';
import { sudokuConflicts } from './sudoku';

const blank = () => Array<string>(81).fill('');
const flagged = (digits: string[]) =>
    sudokuConflicts(digits).flatMap((message, i) => (message ? [i] : []));

describe('visible Sudoku conflicts', () => {
    it.each([
        [0, 5, 'row 1'],
        [0, 45, 'column 1'],
        [0, 10, 'box 1'],
        [70, 80, 'box 9'],
    ])('flags both duplicates at %i and %i in %s', (first, second, group) => {
        const digits = blank();
        digits[first] = digits[second] = '7';
        expect(flagged(digits)).toEqual([first, second]);
        expect(sudokuConflicts(digits)[first]).toBe(`Duplicate 7 in ${group}.`);
        expect(sudokuConflicts(digits)[second]).toBe(`Duplicate 7 in ${group}.`);
    });

    it('explains overlapping conflicts once per group, including every repeated digit', () => {
        const digits = blank();
        for (const i of [0, 1, 9, 10]) digits[i] = '7';
        expect(flagged(digits)).toEqual([0, 1, 9, 10]);
        expect(sudokuConflicts(digits)[0]).toBe(
            'Duplicate 7 in row 1. Duplicate 7 in column 1. Duplicate 7 in box 1.'
        );
    });

    it('recomputes correction/deletion while leaving independent conflicts flagged', () => {
        const digits = blank();
        digits[0] = digits[5] = '7';
        digits[40] = digits[41] = '9';
        digits[5] = '6';
        expect(flagged(digits)).toEqual([40, 41]);
        digits[41] = '';
        expect(flagged(digits)).toEqual([]);
    });

    it('ignores blanks, zeroes, malformed entries and repeated digits in unrelated units', () => {
        const digits = blank();
        digits[0] = digits[40] = '7';
        digits[1] = digits[2] = '0';
        digits[3] = digits[4] = '77';
        expect(flagged(digits)).toEqual([]);
        expect(flagged(['7'])).toEqual([]);
    });

    it('never identifies a non-conflicting digit as a wrong answer', () => {
        const digits = blank();
        digits[0] = '7';
        expect(flagged(digits)).toEqual([]);
        expect(
            flagged([
                ...'634915872915872634872634915349158726158726349726349158491587263587263491263491587',
            ])
        ).toEqual([]);
    });
});
