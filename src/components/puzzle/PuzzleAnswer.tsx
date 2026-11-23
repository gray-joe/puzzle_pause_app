import { Text } from 'react-native';
import type { Puzzle } from '../../api/schemas';
import { buildCrossword } from '../../lib/crossword';
import { formatPuzzleAnswer } from '../../lib/puzzleAnswer';
import { useTheme } from '../../theme';
import { GridBoard, type GridCell } from './grid';
import { NumberSquareBoard } from './NumberSquarePuzzle';
import { WordsearchSolution } from './WordsearchPuzzle';

function answerGrid(puzzle: Puzzle, answer: string): { cols: number; cells: GridCell[] } | null {
    if (typeof puzzle.question === 'string') return null;
    const chars = answer.trim().toUpperCase().split('');

    switch (puzzle.puzzle_type) {
        case 'crossword': {
            const grid = buildCrossword(puzzle.question.layout);
            if (chars.length !== grid.black.length) return null;
            return {
                cols: grid.cols,
                cells: chars.map((char, i) => ({
                    black: char === '#',
                    value: char,
                    label: grid.numbers[i],
                })),
            };
        }
        case 'sudoku': {
            const givens = puzzle.question.grid;
            if (chars.length !== 81) return null;
            return {
                cols: 9,
                cells: chars.map((char, i) => ({ value: char, given: givens[i] !== '0' })),
            };
        }
        case 'codeword': {
            const codes = puzzle.question.cells.flat();
            if (chars.length !== codes.length) return null;
            return {
                cols: puzzle.question.cells[0]!.length,
                cells: chars.map((char, i) => ({
                    black: char === '#',
                    value: char,
                    label: codes[i],
                })),
            };
        }
        case 'word-square':
            if (chars.length !== puzzle.question.size ** 2) return null;
            return { cols: puzzle.question.size, cells: chars.map((char) => ({ value: char })) };
        default:
            return null;
    }
}

/** Revealed answer on the result screen: a read-only grid for grid puzzles, otherwise text. */
export function PuzzleAnswer({
    puzzle,
    answer,
    answerQuestion,
}: {
    puzzle: Puzzle;
    answer: string;
    answerQuestion?: string | null;
}) {
    const { colors, typography } = useTheme();

    if (puzzle.puzzle_type === 'wordsearch') {
        return <WordsearchSolution question={answerQuestion ?? puzzle.question} answer={answer} />;
    }

    if (typeof puzzle.question !== 'string' && puzzle.puzzle_type === 'number-square') {
        const values = answer.split(',').map((value) => value.trim());
        if (values.length === 9) {
            return <NumberSquareBoard question={puzzle.question} values={values} />;
        }
    }

    const grid = answerGrid(puzzle, answer);
    if (grid) {
        return (
            <GridBoard
                cols={grid.cols}
                cells={grid.cells}
                groupSize={puzzle.puzzle_type === 'sudoku' ? 3 : undefined}
            />
        );
    }

    return (
        <Text style={[typography.body, { color: colors.text }]}>
            {formatPuzzleAnswer(puzzle, answer, answerQuestion)}
        </Text>
    );
}
