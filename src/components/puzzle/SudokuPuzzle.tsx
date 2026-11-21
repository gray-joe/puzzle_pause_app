import { useRef, useState } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import type { SudokuPuzzle } from '../../api/schemas';
import { GridBoard, GridKeyInput, GridPuzzleFrame } from './grid';
import type { PuzzleInteractionProps } from './PuzzleRenderer';
import { useDraftState } from './PuzzleDraftProvider';

type Props = { puzzle: SudokuPuzzle } & PuzzleInteractionProps;

export function SudokuPuzzleView({ puzzle, onSubmit, ...rest }: Props) {
    const givens = puzzle.question.grid.split('');
    const [digits, setDigits] = useDraftState(
        'digits',
        () => givens.map((d) => (d === '0' ? '' : d)),
        (value) =>
            Array.isArray(value) &&
            value.length === givens.length &&
            value.every((d) => typeof d === 'string' && /^[1-9]?$/.test(d))
                ? value.map((d: string, i: number) => (givens[i] === '0' ? d : givens[i]!))
                : undefined
    );
    const [selected, setSelected] = useState(() => givens.indexOf('0'));
    const inputRef = useRef<RNTextInput>(null);
    const isGiven = (index: number) => givens[index] !== '0';

    const setDigit = (digit: string) => {
        if (selected < 0 || isGiven(selected)) return;
        setDigits((prev) => prev.map((value, i) => (i === selected ? digit : value)));
    };

    const selectCell = (index: number) => {
        if (isGiven(index)) return;
        setSelected(index);
        inputRef.current?.focus();
    };

    const canSubmit = digits.every(Boolean);
    const handleSubmit = () => {
        if (!canSubmit) return;
        inputRef.current?.blur();
        onSubmit(digits.join(''));
    };

    return (
        <GridPuzzleFrame
            puzzleNumber={puzzle.puzzle_number}
            puzzleName={puzzle.puzzle_name}
            prompt={puzzle.question.prompt}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            {...rest}
        >
            <GridBoard
                cols={9}
                groupSize={3}
                onPressCell={selectCell}
                cells={digits.map((value, i) => ({
                    value,
                    given: isGiven(i),
                    selected: i === selected,
                }))}
            />
            <GridKeyInput
                ref={inputRef}
                numeric
                onChar={(char) => /^[1-9]$/.test(char) && setDigit(char)}
                onBackspace={() => setDigit('')}
                editable={!rest.isSubmitting}
            />
        </GridPuzzleFrame>
    );
}
