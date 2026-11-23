import { describe, expect, it, vi } from 'vitest';
import {
    allText,
    changeText,
    findAllByHost,
    findPressableByText,
    press,
    render,
    update,
} from '../../test/render';
import type { WordsearchPuzzle } from '../../api/schemas';
import { WordsearchPuzzleView } from './WordsearchPuzzle';
import { PuzzleAnswer } from './PuzzleAnswer';

const words = ['CAT', 'DOG', 'HEN', 'COW', 'PIG', 'FOX', 'OWL', 'ANT'];
const puzzle = {
    id: 123,
    puzzle_number: 123,
    puzzle_date: '2026-01-01',
    puzzle_type: 'wordsearch',
    puzzle_name: 'Animals',
    question: `${words.map((word) => word.padEnd(8, 'X').split('').join(' ')).join('\n')}\nFind: 8\nTheme: Animals`,
    hint: null,
    has_hint: false,
} as WordsearchPuzzle;
const interaction = {
    onSubmit: vi.fn(),
    onHint: vi.fn(),
    onGiveUp: vi.fn(),
    isSubmitting: false,
    isHinting: false,
    isGivingUp: false,
    hintsRevealed: [],
    canHint: false,
};

describe('compact wordsearch play', () => {
    it('counts entered fields, normalizes guesses and retains them after wrong/offline responses', () => {
        const onSubmit = vi.fn();
        const props = { ...interaction, puzzle, onSubmit };
        const renderer = render(<WordsearchPuzzleView {...props} />);
        expect(allText(renderer)).toContain('0 of 8 entered');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);
        const inputs = findAllByHost(renderer, 'TextInput');
        expect(inputs).toHaveLength(8);
        inputs.forEach((input, index) => {
            expect(input.props.accessibilityLabel).toBe(`Found word ${index + 1}`);
            changeText(input, words[index].toLowerCase() + '-123');
        });
        expect(allText(renderer)).toContain('8 of 8 entered');
        changeText(inputs[7], '');
        expect(allText(renderer)).toContain('7 of 8 entered');
        expect(findPressableByText(renderer, 'Submit')?.props.disabled).toBe(true);
        changeText(inputs[7], 'ant');
        press(findPressableByText(renderer, 'Submit')!);
        expect(onSubmit).toHaveBeenCalledWith(words.join(' '));
        for (const submitError of ['Wrong. 1 incorrect guess.', 'Offline']) {
            update(renderer, <WordsearchPuzzleView {...props} submitError={submitError} />);
            expect(allText(renderer)).toContain(submitError);
            expect(allText(renderer)).toContain('8 of 8 entered');
            expect(findAllByHost(renderer, 'TextInput').map((input) => input.props.value)).toEqual(
                words
            );
        }
        update(renderer, <WordsearchPuzzleView {...props} isSubmitting />);
        expect(findAllByHost(renderer, 'TextInput').every((input) => !input.props.editable)).toBe(
            true
        );
        expect(findPressableByText(renderer, 'Submit')).toBeUndefined(); // loading indicator replaces title
    });
});

describe('revealed wordsearch locations', () => {
    it('renders a read-only grid with overlapping highlights and selectable word paths', () => {
        const p = { ...puzzle, question: 'C A T\nO X X\nW X X\nFind: 2' };
        const renderer = render(<PuzzleAnswer puzzle={p} answer="~CAT COW" />);
        const gridCells = () =>
            findAllByHost(renderer, 'Pressable').filter(
                (node) => node.props.accessibilityRole === 'text'
            );
        expect(gridCells()).toHaveLength(9);
        expect(gridCells().every((node) => node.props.disabled)).toBe(true);
        expect(allText(renderer)).toContain('Row 1 column 1 to row 1 column 3');
        expect(allText(renderer)).toContain('Row 1 column 1 to row 3 column 1');
        press(findPressableByText(renderer, 'CAT')!);
        expect(findPressableByText(renderer, 'CAT')?.props.accessibilityState.selected).toBe(true);
        expect(gridCells().filter((node) => node.props.accessibilityState.selected)).toHaveLength(
            3
        );
        expect(allText(renderer)).toContain('CAT: Row 1 column 1 to row 1 column 3');
        press(findPressableByText(renderer, 'CAT')!);
        expect(allText(renderer)).toContain('Showing all word locations.');
    });

    it('uses revealed question content and keeps missing words readable', () => {
        const renderer = render(
            <PuzzleAnswer puzzle={puzzle} answer="~CAT DOG" answerQuestion={'C A T\nFind: 2'} />
        );
        expect(
            findAllByHost(renderer, 'Pressable').filter(
                (node) => node.props.accessibilityRole === 'text'
            )
        ).toHaveLength(3);
        expect(allText(renderer)).toContain('Location unavailable');
        expect(findPressableByText(renderer, 'DOG')).toBeDefined();
        update(
            renderer,
            <PuzzleAnswer puzzle={{ ...puzzle, question: 'not a grid!' }} answer="~CAT DOG" />
        );
        expect(
            findAllByHost(renderer, 'Pressable').filter(
                (node) => node.props.accessibilityRole === 'text'
            )
        ).toHaveLength(0);
        expect(findPressableByText(renderer, 'CAT')).toBeDefined();
        expect(findPressableByText(renderer, 'DOG')).toBeDefined();
    });
});
