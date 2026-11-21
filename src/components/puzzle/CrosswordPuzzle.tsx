import { useMemo, useRef, useState } from 'react';
import { Pressable, TextInput as RNTextInput, Text, View } from 'react-native';
import type { CrosswordPuzzle } from '../../api/schemas';
import { buildCrossword, wordCells, type Direction } from '../../lib/crossword';
import { useTheme } from '../../theme';
import { GridBoard, GridKeyInput, GridPuzzleFrame } from './grid';
import type { PuzzleInteractionProps } from './PuzzleRenderer';
import { useDraftState } from './PuzzleDraftProvider';

type Props = { puzzle: CrosswordPuzzle } & PuzzleInteractionProps;

export function CrosswordPuzzleView({ puzzle, onSubmit, ...rest }: Props) {
    const { layout, clues, prompt } = puzzle.question;
    const grid = useMemo(() => buildCrossword(layout), [layout]);
    const [letters, setLetters] = useDraftState<string[]>(
        'letters',
        () => grid.black.map(() => ''),
        (value) =>
            Array.isArray(value) &&
            value.length === grid.black.length &&
            value.every((l) => typeof l === 'string' && /^[A-Z]?$/.test(l))
                ? value.map((l: string, i: number) => (grid.black[i] ? '' : l))
                : undefined
    );
    const [selected, setSelected] = useState(() => grid.black.indexOf(false));
    const [direction, setDirection] = useState<Direction>('across');
    const inputRef = useRef<RNTextInput>(null);
    const { colors, spacing, typography } = useTheme();

    const other: Direction = direction === 'across' ? 'down' : 'across';
    const word = wordCells(grid, selected, direction);
    const clueNumber = word.length ? grid.numbers[word[0]!] : undefined;
    const currentClue = clueNumber != null ? clues[direction][String(clueNumber)] : undefined;

    const selectCell = (index: number) => {
        if (index === selected) {
            if (wordCells(grid, index, other).length) setDirection(other);
        } else {
            setSelected(index);
            if (!wordCells(grid, index, direction).length) setDirection(other);
        }
        inputRef.current?.focus();
    };

    const setLetter = (index: number, letter: string) =>
        setLetters((prev) => prev.map((value, i) => (i === index ? letter : value)));

    const onText = (text: string) => {
        const nextLetters = [...letters];
        let cursor = selected;
        for (const char of text.replace(/[^A-Z]/g, '')) {
            nextLetters[cursor] = char;
            const next = word[word.indexOf(cursor) + 1];
            if (next == null) break;
            cursor = next;
        }
        setLetters(nextLetters);
        setSelected(cursor);
    };

    const onBackspace = () => {
        if (letters[selected]) return setLetter(selected, '');
        const previous = word[word.indexOf(selected) - 1];
        if (previous != null) {
            setSelected(previous);
            setLetter(previous, '');
        }
    };

    const guess = letters.map((letter, i) => (grid.black[i] ? '#' : letter)).join('');
    const errors = rest.gridFeedback?.guess === guess ? rest.gridFeedback.cells : [];
    const canSubmit = grid.black.every((isBlack, i) => isBlack || !!letters[i]);
    const handleSubmit = () => {
        if (!canSubmit) return;
        inputRef.current?.blur();
        onSubmit(letters.map((letter, i) => (grid.black[i] ? '#' : letter)).join(''));
    };

    return (
        <GridPuzzleFrame
            puzzleNumber={puzzle.puzzle_number}
            puzzleName={puzzle.puzzle_name}
            prompt={prompt}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            {...rest}
            submitError={
                rest.gridFeedback && rest.gridFeedback.guess !== guess
                    ? undefined
                    : rest.submitError
            }
        >
            <Text
                style={[
                    typography.body,
                    {
                        color: colors.text,
                        padding: spacing.sm,
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                    },
                ]}
            >
                {currentClue
                    ? `${clueNumber} ${direction}: ${currentClue}`
                    : 'Tap a square to start'}
            </Text>

            <GridBoard
                cols={grid.cols}
                onPressCell={selectCell}
                cells={grid.black.map((black, i) => ({
                    black,
                    value: letters[i],
                    label: grid.numbers[i],
                    selected: i === selected,
                    highlighted: word.includes(i),
                    error: errors.includes(i),
                }))}
            />
            <GridKeyInput
                ref={inputRef}
                onText={onText}
                onBackspace={onBackspace}
                editable={!rest.isSubmitting}
            />

            {(['across', 'down'] as const).map((dir) => (
                <View key={dir} style={{ gap: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {dir === 'across' ? 'Across' : 'Down'}
                    </Text>
                    {Object.entries(clues[dir])
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([number, clue]) => (
                            <Pressable
                                key={number}
                                accessibilityRole="button"
                                accessibilityLabel={`${number} ${dir}: ${clue}`}
                                onPress={() => {
                                    const index = grid.numbers.indexOf(Number(number));
                                    if (index < 0) return;
                                    setSelected(index);
                                    setDirection(dir);
                                    inputRef.current?.focus();
                                }}
                            >
                                <Text style={[typography.caption, { color: colors.text }]}>
                                    {number}. {clue}
                                </Text>
                            </Pressable>
                        ))}
                </View>
            ))}
        </GridPuzzleFrame>
    );
}
