import { useRef, useState } from 'react';
import { TextInput as RNTextInput, Text, View } from 'react-native';
import type { WordSquarePuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { GridBoard, GridKeyInput, GridPuzzleFrame } from './grid';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: WordSquarePuzzle } & PuzzleInteractionProps;

export function WordSquarePuzzleView({ puzzle, onSubmit, ...rest }: Props) {
    const { size, clues, prompt } = puzzle.question;
    const [letters, setLetters] = useState<string[]>(() => Array(size * size).fill(''));
    const [selected, setSelected] = useState(0);
    const inputRef = useRef<RNTextInput>(null);
    const { colors, spacing, typography } = useTheme();
    const row = Math.floor(selected / size);
    const col = selected % size;

    // Row N and column N spell the same word, so every letter is mirrored across the diagonal.
    const setLetter = (letter: string) => {
        const mirror = col * size + row;
        setLetters((prev) =>
            prev.map((value, i) => (i === selected || i === mirror ? letter : value))
        );
    };

    const selectCell = (index: number) => {
        setSelected(index);
        inputRef.current?.focus();
    };

    const onChar = (char: string) => {
        if (!/^[A-Z]$/.test(char)) return;
        setLetter(char);
        // Advance through the upper triangle only; the rest is filled by mirroring.
        const next = letters.findIndex((_, i) => i > selected && i % size >= Math.floor(i / size));
        if (next >= 0) setSelected(next);
    };

    const canSubmit = letters.every(Boolean);
    const handleSubmit = () => {
        if (!canSubmit) return;
        inputRef.current?.blur();
        onSubmit(letters.join(''));
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
                cols={size}
                onPressCell={selectCell}
                cells={letters.map((value, i) => ({
                    value,
                    label: i % size === 0 ? Math.floor(i / size) + 1 : undefined,
                    selected: i === selected,
                    highlighted: Math.floor(i / size) === row,
                }))}
            />
            <GridKeyInput
                ref={inputRef}
                onChar={onChar}
                onBackspace={() => setLetter('')}
                editable={!rest.isSubmitting}
            />

            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Each clue is for that row and the matching column
                </Text>
                {clues.map((clue, index) => (
                    <Text
                        key={index}
                        style={[
                            typography.caption,
                            { color: index === row ? colors.primary : colors.text },
                        ]}
                    >
                        {index + 1}. {clue}
                    </Text>
                ))}
            </View>
        </GridPuzzleFrame>
    );
}
