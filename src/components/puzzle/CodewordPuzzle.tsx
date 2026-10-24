import { useRef, useState } from 'react';
import { TextInput as RNTextInput, Text } from 'react-native';
import type { CodewordPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { GridBoard, GridKeyInput, GridPuzzleFrame } from './grid';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: CodewordPuzzle } & PuzzleInteractionProps;

export function CodewordPuzzleView({ puzzle, onSubmit, ...rest }: Props) {
    const { cells, givens, prompt } = puzzle.question;
    const cols = cells[0]!.length;
    const codes = cells.flat();
    const isGiven = (code: number) => String(code) in givens;
    // Letters are stored per code: filling one cell fills every cell with the same code.
    const [letters, setLetters] = useState<Record<number, string>>(() =>
        Object.fromEntries(
            Object.entries(givens).map(([code, l]) => [Number(code), l.toUpperCase()])
        )
    );
    const [selected, setSelected] = useState(() => codes.findIndex((c) => c > 0 && !isGiven(c)));
    const [message, setMessage] = useState('');
    const inputRef = useRef<RNTextInput>(null);
    const { colors, typography } = useTheme();
    const selectedCode = codes[selected] ?? 0;

    const selectCell = (index: number) => {
        if (isGiven(codes[index]!)) return;
        setSelected(index);
        setMessage('');
        inputRef.current?.focus();
    };

    const onChar = (char: string) => {
        if (!/^[A-Z]$/.test(char) || !selectedCode || isGiven(selectedCode)) return;
        const owner = Object.entries(letters).find(([, l]) => l === char)?.[0];
        if (owner && Number(owner) !== selectedCode) {
            setMessage(`${char} is already used for ${owner}`);
            return;
        }
        setMessage('');
        setLetters((prev) => ({ ...prev, [selectedCode]: char }));
        // Jump to the next cell whose code still needs a letter.
        const next = codes.findIndex(
            (c, i) => i > selected && c > 0 && c !== selectedCode && !isGiven(c) && !letters[c]
        );
        if (next >= 0) setSelected(next);
    };

    const onBackspace = () => {
        if (!selectedCode || isGiven(selectedCode)) return;
        setMessage('');
        setLetters(({ [selectedCode]: _removed, ...remaining }) => remaining);
    };

    const canSubmit = codes.every((code) => code === 0 || !!letters[code]);
    const handleSubmit = () => {
        if (!canSubmit) return;
        inputRef.current?.blur();
        onSubmit(codes.map((code) => (code === 0 ? '#' : letters[code])).join(''));
    };

    return (
        <GridPuzzleFrame
            puzzleNumber={puzzle.puzzle_number}
            puzzleName={puzzle.puzzle_name}
            prompt={prompt}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            {...rest}
        >
            <GridBoard
                cols={cols}
                onPressCell={selectCell}
                cells={codes.map((code, i) => ({
                    black: code === 0,
                    value: letters[code],
                    label: code,
                    given: isGiven(code),
                    selected: i === selected,
                    highlighted: code === selectedCode,
                }))}
            />
            <GridKeyInput
                ref={inputRef}
                onChar={onChar}
                onBackspace={onBackspace}
                editable={!rest.isSubmitting}
            />
            {!!message && (
                <Text style={[typography.caption, { color: colors.error, textAlign: 'center' }]}>
                    {message}
                </Text>
            )}
        </GridPuzzleFrame>
    );
}
