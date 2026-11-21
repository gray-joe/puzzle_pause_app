import React from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { PuzzleSchema, type Puzzle } from '../../api/schemas';
import {
    allText,
    changeText,
    findAllByHost,
    findByHost,
    findPressableByText,
    press,
    render,
    textContent,
} from '../../test/render';
import { GridBoard } from './grid';
import { PuzzleAnswer } from './PuzzleAnswer';
import { PuzzleRenderer, type PuzzleInteractionProps } from './PuzzleRenderer';

const interactionProps: PuzzleInteractionProps = {
    onSubmit: vi.fn(),
    onHint: vi.fn(),
    onGiveUp: vi.fn(),
    isSubmitting: false,
    isHinting: false,
    isGivingUp: false,
    submitError: undefined,
    hintsRevealed: [],
    canHint: false,
};

function puzzle(puzzle_type: string, question: unknown): Puzzle {
    return PuzzleSchema.parse({
        id: 1,
        puzzle_date: '2026-10-05',
        puzzle_name: 'Grid',
        puzzle_number: 7,
        puzzle_type,
        question: JSON.stringify(question),
        hint: null,
        has_hint: false,
        total_hints: 0,
    });
}

function renderPuzzle(p: Puzzle, feedback?: PuzzleInteractionProps['gridFeedback']) {
    const onSubmit = vi.fn();
    const renderer = render(
        <PuzzleRenderer
            {...interactionProps}
            gridFeedback={feedback}
            puzzle={p}
            onSubmit={onSubmit}
        />
    );
    const keys = () => findByHost(renderer, 'TextInput');
    const type = (text: string) => [...text].forEach((char) => changeText(keys(), char));
    const backspace = () =>
        act(() => keys().props.onKeyPress({ nativeEvent: { key: 'Backspace' } }));
    const cell = (r: number, c: number) =>
        findAllByHost(renderer, 'Pressable').find(
            (node: ReactTestInstance) => node.props.accessibilityLabel === `Row ${r} column ${c}`
        )!;
    const submit = () => findPressableByText(renderer, 'Submit')!;
    return { renderer, onSubmit, type, backspace, cell, submit };
}

describe('GridBoard accessibility', () => {
    it('announces values, clue/code numbers, givens, editability and selection', () => {
        const view = render(
            <GridBoard
                cols={2}
                onPressCell={vi.fn()}
                cells={[
                    { value: '5', given: true },
                    { value: '', label: 12, selected: true },
                ]}
            />
        );
        const cells = findAllByHost(view, 'Pressable');
        expect(cells[0]!.props.accessibilityValue.text).toBe('5, given, not editable');
        expect(cells[0]!.props.disabled).toBe(true);
        expect(cells[1]!.props.accessibilityLabel).toBe('Row 1 column 2');
        expect(cells[1]!.props.accessibilityValue.text).toBe('Empty, number 12, editable');
        expect(cells[1]!.props.accessibilityRole).toBe('button');
        expect(cells[1]!.props.accessibilityState).toEqual({ selected: true, disabled: false });
        act(() => view.unmount());
    });
});

describe('CrosswordPuzzleView', () => {
    // CAT
    // O#A
    // WER
    const crossword = () =>
        puzzle('crossword', {
            prompt: 'Mini',
            layout: ['...', '.#.', '...'],
            clues: {
                across: { '1': 'Feline', '3': 'Plural of was' },
                down: { '1': 'Farm animal', '2': 'Black drink' },
            },
        });

    it('fills words along the current direction and submits the whole grid', () => {
        const { renderer, onSubmit, type, cell, submit } = renderPuzzle(crossword());

        expect(allText(renderer)).toContain('1 across: Feline');
        type('cat');
        press(cell(2, 1)); // no across word here, so it switches to down
        expect(allText(renderer)).toContain('1 down: Farm animal');
        type('ow');
        press(cell(2, 3));
        type('ar');
        press(cell(3, 2));
        type('e');
        expect(submit().props.disabled).toBe(false);
        press(submit());

        expect(onSubmit).toHaveBeenCalledWith('CATO#AWER');
    });

    it('toggles direction when the selected square is tapped again', () => {
        const { renderer, cell } = renderPuzzle(crossword());

        press(cell(1, 1));
        expect(allText(renderer)).toContain('1 down: Farm animal');
    });

    it('selects duplicate clues independently by number and direction', () => {
        const { renderer } = renderPuzzle(
            puzzle('crossword', {
                prompt: '',
                layout: ['...', '.#.', '...'],
                clues: {
                    across: { '1': 'Same clue', '3': 'Same clue' },
                    down: { '1': 'Other clue' },
                },
            })
        );
        const clue = findAllByHost(renderer, 'Pressable').find(
            (node) => node.props.accessibilityLabel === '3 across: Same clue'
        )!;
        press(clue);
        expect(allText(renderer)).toContain('3 across: Same clue');
    });

    it('backspace clears the square, then steps back through the word', () => {
        const { submit, type, backspace, cell } = renderPuzzle(crossword());

        type('ca');
        backspace();
        backspace();
        expect(textContent(cell(1, 1))).toBe('1'); // just the clue number
        expect(textContent(cell(1, 2))).toBe('');
        expect(submit().props.disabled).toBe(true);
    });
});

describe.each(['crossword', 'codeword'])('%s large boards', (type) => {
    it.each([
        [25, 25],
        [3, 25],
        [25, 3],
    ])('renders %i by %i with readable scrollable cells and answers', (rows, cols) => {
        const p = puzzle(
            type,
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
        );
        const { renderer, cell, type: enter, onSubmit, submit } = renderPuzzle(p);
        expect(findByHost(renderer, 'ScrollView').props.horizontal).toBe(true);
        expect(cell(rows, cols).props.style.width).toBeGreaterThanOrEqual(32);
        press(cell(rows, cols));
        enter('z');
        expect(textContent(cell(rows, cols))).toContain('Z');
        if (type === 'codeword') {
            press(submit());
            expect(onSubmit).toHaveBeenCalledWith('Z'.repeat(rows * cols));
        }
        const answer = render(<PuzzleAnswer puzzle={p} answer={'A'.repeat(rows * cols)} />);
        expect(findAllByHost(answer, 'Pressable')).toHaveLength(rows * cols);
        expect(findAllByHost(answer, 'Pressable').every((node) => node.props.disabled)).toBe(true);
    });
});

describe('multi-character grid input', () => {
    it('pastes a whole crossword word in a single input event', () => {
        const { renderer, cell } = renderPuzzle(
            puzzle('crossword', {
                prompt: '',
                layout: ['...', '.#.', '...'],
                clues: { across: { '1': 'Pet' }, down: {} },
            })
        );
        changeText(findByHost(renderer, 'TextInput'), 'cat');
        expect([1, 2, 3].map((col) => textContent(cell(1, col)).replace(/\d/g, ''))).toEqual([
            'C',
            'A',
            'T',
        ]);
    });

    it.each([
        [
            'sudoku',
            { prompt: '', grid: '0' + '1'.repeat(79) + '0' },
            '59',
            '5' + '1'.repeat(79) + '9',
        ],
        [
            'codeword',
            {
                prompt: '',
                cells: [
                    [1, 2, 3],
                    [2, 0, 1],
                    [3, 1, 2],
                ],
                givens: { '1': 'A' },
            },
            'bc',
            'ABCB#ACAB',
        ],
        ['word-square', { prompt: '', size: 3, clues: ['', '', ''] }, 'catren', 'CATARETEN'],
    ])(
        'pastes %s entries without losing characters or givens',
        (kind, question, input, expected) => {
            const { renderer, submit, onSubmit } = renderPuzzle(puzzle(kind as string, question));
            changeText(findByHost(renderer, 'TextInput'), input as string);
            press(submit());
            expect(onSubmit).toHaveBeenCalledWith(expected);
        }
    );
});

describe('SudokuPuzzleView', () => {
    const solution =
        '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

    it('fills the blank squares and submits all 81 digits', () => {
        const grid = '0' + solution.slice(1, 80) + '0';
        const { onSubmit, type, cell, submit, backspace } = renderPuzzle(
            puzzle('sudoku', { prompt: 'Fill it', grid })
        );

        expect(submit().props.disabled).toBe(true);
        type('5');
        press(cell(9, 9));
        type('0'); // zero is not a sudoku digit
        expect(submit().props.disabled).toBe(true);
        type('8');
        backspace();
        type('9');
        press(submit());

        expect(onSubmit).toHaveBeenCalledWith(solution);
    });
});

describe('CodewordPuzzleView', () => {
    it('fills every square with the same code and blocks reusing a letter', () => {
        const { renderer, onSubmit, type, submit } = renderPuzzle(
            puzzle('codeword', {
                prompt: 'Crack it',
                cells: [
                    [1, 2, 3],
                    [2, 0, 1],
                    [3, 1, 2],
                ],
                givens: { '1': 'a' },
            })
        );

        type('a');
        expect(allText(renderer)).toContain('A is already used for 1');
        expect(allText(renderer)).toContain('Unused letters: B C D');
        type('b'); // code 2, then jumps to code 3
        expect(allText(renderer)).toContain('Unused letters: C D');
        type('c');
        press(submit());

        expect(onSubmit).toHaveBeenCalledWith('ABCB#ACAB');
    });
});

describe('grid UX feedback', () => {
    it.each([
        ['sudoku', { prompt: '', grid: '0' + '1'.repeat(80) }, '2' + '1'.repeat(80), '2'],
        [
            'crossword',
            { prompt: '', layout: ['...', '.#.', '...'], clues: { across: {}, down: {} } },
            'AAAA#AAAA',
            'A',
        ],
        [
            'codeword',
            {
                prompt: '',
                cells: [
                    [1, 2, 3],
                    [2, 0, 1],
                    [3, 1, 2],
                ],
                givens: { 2: 'B', 3: 'C' },
            },
            'ABCB#ACAB',
            'A',
        ],
    ])(
        'shows %s server feedback and clears it when entries change',
        (kind, question, guess, entry) => {
            const p = puzzle(kind as string, question);
            const { renderer, cell, type, submit, onSubmit } = renderPuzzle(p);
            if (kind === 'crossword') {
                for (let row = 1; row <= 3; row++) {
                    for (let col = 1; col <= 3; col++) {
                        if (row === 2 && col === 2) continue;
                        press(cell(row, col));
                        type('A');
                    }
                }
            } else type(entry as string);
            press(submit());
            expect(onSubmit).toHaveBeenCalledWith(guess);
            act(() =>
                renderer.update(
                    <PuzzleRenderer
                        {...interactionProps}
                        puzzle={p}
                        onSubmit={onSubmit}
                        gridFeedback={{ guess: guess as string, cells: [0] }}
                    />
                )
            );
            expect(cell(1, 1).props.accessibilityValue.text).toContain('Submitted error');
            press(cell(1, 1));
            type(kind === 'sudoku' ? '3' : 'Z');
            expect(cell(1, 1).props.accessibilityValue.text).not.toContain('Submitted error');
        }
    );

    it('highlights the Sudoku selected row and column, not unrelated squares', () => {
        const { cell } = renderPuzzle(puzzle('sudoku', { prompt: '', grid: '0'.repeat(81) }));
        expect(cell(1, 1).props.style.backgroundColor).not.toBe(
            cell(1, 2).props.style.backgroundColor
        );
        expect(cell(1, 2).props.style.backgroundColor).toBe(cell(2, 1).props.style.backgroundColor);
        expect(cell(1, 2).props.style.backgroundColor).not.toBe(
            cell(2, 2).props.style.backgroundColor
        );
        press(cell(2, 2));
        expect(cell(2, 2).props.accessibilityState.selected).toBe(true);
        expect(cell(1, 1).props.style.backgroundColor).not.toBe(
            cell(1, 2).props.style.backgroundColor
        );
    });
});

describe('WordSquarePuzzleView', () => {
    it('mirrors each letter across the diagonal', () => {
        const { onSubmit, type, submit } = renderPuzzle(
            puzzle('word-square', { prompt: 'Square', size: 3, clues: ['Pet', 'Exist', 'Decade'] })
        );

        // Typing walks the upper triangle; the lower triangle fills itself.
        type('catren');
        press(submit());

        expect(onSubmit).toHaveBeenCalledWith('CATARETEN');
    });
});

describe('NumberSquarePuzzleView', () => {
    it('shows operators as symbols and submits all nine numbers', () => {
        const { renderer, onSubmit, submit } = renderPuzzle(
            puzzle('number-square', {
                prompt: 'Make the sums work',
                cells: [1, 2, null, 4, null, 6, 7, 8, 9],
                row_ops: [
                    ['+', '*'],
                    ['-', '/'],
                    ['+', '+'],
                ],
                col_ops: [
                    ['+', '+'],
                    ['*', '-'],
                    ['+', '/'],
                ],
                row_results: [7, 2, 24],
                col_results: [12, 2, 3],
            })
        );
        const inputs = findAllByHost(renderer, 'TextInput');

        expect(allText(renderer)).toContain('×');
        expect(allText(renderer)).toContain('÷');
        expect(allText(renderer)).toContain('−');
        expect(inputs).toHaveLength(2);
        for (const input of inputs) {
            const style = Object.assign({}, ...input.props.style);
            expect(style.textAlign).toBe('center');
            expect(style.textAlignVertical).toBe('center');
            expect(style.padding).toBe(0);
            expect(style.includeFontPadding).toBe(false);
            // A cell-height line box pushes native input text below the border.
            expect(style.lineHeight).toBeUndefined();
        }
        changeText(inputs[0]!, '3');
        changeText(inputs[1]!, '5x');
        press(submit());

        expect(onSubmit).toHaveBeenCalledWith('1,2,3,4,5,6,7,8,9');
    });
});

describe('CanvasPuzzleView', () => {
    it('draws known shapes, skips unknown ones and submits free text', () => {
        const p = puzzle('canvas', {
            prompt: 'What is this?',
            alt: 'A house',
            shapes: [
                { type: 'rect', x: 10, y: 10, w: 100, h: 100, fill: '#fff' },
                { type: 'line', x1: 0, y1: 0, x2: 50, y2: 50, stroke: '#f00', arrow: true },
                { type: 'star', points: 5 },
                { type: 'text', x: 5, y: 20, text: 'Hi', size: 12 },
            ],
        });
        const { renderer, onSubmit, submit } = renderPuzzle(p);

        expect(findAllByHost(renderer, 'Rect')).toHaveLength(2); // background + rect
        expect(findAllByHost(renderer, 'Polygon')).toHaveLength(1); // arrow head
        expect(findByHost(renderer, 'SvgText').props.fill).toBe('#e0e0e0');
        changeText(findByHost(renderer, 'TextInput'), ' house ');
        press(submit());

        expect(onSubmit).toHaveBeenCalledWith('house');
    });
});

describe('PuzzleAnswer', () => {
    it('shows a grid answer as a read-only grid', () => {
        const renderer = render(
            <PuzzleAnswer
                puzzle={puzzle('word-square', { prompt: '', size: 3, clues: ['a', 'b', 'c'] })}
                answer="CATARETEN"
            />
        );

        expect(findAllByHost(renderer, 'Pressable')).toHaveLength(9);
        expect(allText(renderer)).not.toContain('CATARETEN');
    });

    it('falls back to text when the answer does not fit the grid', () => {
        const renderer = render(
            <PuzzleAnswer
                puzzle={puzzle('word-square', { prompt: '', size: 3, clues: ['a', 'b', 'c'] })}
                answer="CAT"
            />
        );

        expect(allText(renderer)).toContain('CAT');
    });
});
