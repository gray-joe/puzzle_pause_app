import { useRef, useState } from 'react';
import { TextInput as RNTextInput, Text } from 'react-native';
import type { CodewordPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { GridBoard, GridKeyInput, GridPuzzleFrame } from './grid';
import type { PuzzleInteractionProps } from './PuzzleRenderer';
import { useDraftState } from './PuzzleDraftProvider';

type Props = { puzzle: CodewordPuzzle } & PuzzleInteractionProps;

export function CodewordPuzzleView({ puzzle, onSubmit, ...rest }: Props) {
    const { cells, givens, prompt } = puzzle.question;
    const cols = cells[0]!.length;
    const codes = cells.flat();
    const isGiven = (code: number) => String(code) in givens;
    // Letters are stored per code: filling one cell fills every cell with the same code.
    const initialLetters = () =>
        Object.fromEntries(
            Object.entries(givens).map(([code, l]) => [Number(code), l.toUpperCase()])
        );
    const [letters, setLetters] = useDraftState<Record<number, string>>(
        'letters',
        initialLetters,
        (value) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
            const restored = initialLetters();
            for (const [code, letter] of Object.entries(value)) {
                if (
                    !/^[1-9]\d*$/.test(code) ||
                    !codes.includes(Number(code)) ||
                    typeof letter !== 'string' ||
                    !/^[A-Z]$/.test(letter)
                )
                    return undefined;
                if (!isGiven(Number(code))) restored[Number(code)] = letter;
            }
            return new Set(Object.values(restored)).size === Object.keys(restored).length
                ? restored
                : undefined;
        }
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

    const onText = (text: string) => {
        const nextLetters = { ...letters };
        let cursor = selected;
        for (const char of text.replace(/[^A-Z]/g, '')) {
            const code = codes[cursor];
            if (!code || isGiven(code)) break;
            const owner = Object.entries(nextLetters).find(([, letter]) => letter === char)?.[0];
            if (owner && Number(owner) !== code) {
                setMessage(`${char} is already used for ${owner}`);
                continue;
            }
            setMessage('');
            nextLetters[code] = char;
            const next = codes.findIndex(
                (c, i) => i > cursor && c > 0 && !isGiven(c) && !nextLetters[c]
            );
            if (next < 0) break;
            cursor = next;
        }
        setLetters(nextLetters);
        setSelected(cursor);
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
                onText={onText}
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
