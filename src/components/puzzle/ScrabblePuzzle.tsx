import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ScrabblePuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: ScrabblePuzzle } & PuzzleInteractionProps;

const MODIFIER_LABELS: Record<string, string> = {
    dl: 'Double Letter',
    tl: 'Triple Letter',
    dw: 'Double Word',
    tw: 'Triple Word',
};

const DEFAULT_BOARD_TILE_WIDTH = 58;
const DEFAULT_RACK_TILE_WIDTH = 42;

export function ScrabblePuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const [guess, setGuess] = useState('');
    const [boardRowWidth, setBoardRowWidth] = useState(0);
    const [rackRowWidth, setRackRowWidth] = useState(0);
    const { colors, spacing, typography } = useTheme();
    const puzzleTextStyle = { fontSize: 21, lineHeight: 30 };
    const tileGap = spacing.sm;
    const boardTileWidth = getFittingTileWidth(
        boardRowWidth,
        puzzle.question.board.length,
        DEFAULT_BOARD_TILE_WIDTH,
        tileGap
    );
    const rackTileWidth = getFittingTileWidth(
        rackRowWidth,
        puzzle.question.rack.length,
        DEFAULT_RACK_TILE_WIDTH,
        tileGap
    );

    const handleSubmit = () => {
        const trimmedGuess = guess.trim();
        if (!trimmedGuess) return;
        onSubmit(trimmedGuess);
        setGuess('');
    };

    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <Text style={[typography.body, puzzleTextStyle, { color: colors.text }]}>
                    {puzzle.question.prompt}
                </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Board</Text>
                <View
                    onLayout={(event) => setBoardRowWidth(event.nativeEvent.layout.width)}
                    style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: tileGap }}
                >
                    {puzzle.question.board.map((letter, index) => (
                        <BoardCell
                            key={index}
                            letter={letter}
                            modifier={puzzle.question.modifiers[index] ?? null}
                            width={boardTileWidth}
                        />
                    ))}
                </View>
            </View>

            <View style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Rack</Text>
                <View
                    onLayout={(event) => setRackRowWidth(event.nativeEvent.layout.width)}
                    style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: tileGap }}
                >
                    {puzzle.question.rack.map((letter, index) => (
                        <View
                            key={`${letter}-${index}`}
                            style={{
                                width: rackTileWidth,
                                alignItems: 'center',
                                paddingHorizontal: spacing.xs,
                                paddingVertical: spacing.sm,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: colors.surface,
                            }}
                        >
                            <Text style={[typography.title, { color: colors.text }]}>{letter}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {hintsRevealed.length > 0 && (
                <View
                    style={{
                        gap: spacing.xs,
                        padding: spacing.sm,
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                    }}
                >
                    {hintsRevealed.map((hint, index) => (
                        <Text key={index} style={[typography.caption, { color: colors.textMuted }]}>
                            Hint: {hint}
                        </Text>
                    ))}
                </View>
            )}

            <View style={{ gap: spacing.sm }}>
                <TextInput
                    label="Your answer"
                    placeholder="word score (e.g. mask 10)"
                    value={guess}
                    onChangeText={setGuess}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    error={submitError}
                    editable={!isSubmitting}
                />
                <Button
                    title="Submit"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={!guess.trim()}
                />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}

function getFittingTileWidth(
    rowWidth: number,
    tileCount: number,
    defaultWidth: number,
    gap: number
): number {
    if (rowWidth <= 0 || tileCount <= 0) return defaultWidth;

    const totalGap = gap * Math.max(tileCount - 1, 0);
    return Math.min(defaultWidth, Math.max(1, (rowWidth - totalGap) / tileCount));
}

function BoardCell({
    letter,
    modifier,
    width,
}: {
    letter: string | null;
    modifier: string | null;
    width: number;
}) {
    const { colors, spacing, typography } = useTheme();
    const normalizedModifier = modifier?.toLowerCase() ?? null;
    const modifierLabel = normalizedModifier ? MODIFIER_LABELS[normalizedModifier] : undefined;

    return (
        <View
            style={{
                width,
                minHeight: 72,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                padding: spacing.xs,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
            }}
        >
            <Text style={[typography.title, { color: colors.text }]}>{letter ?? '_'}</Text>
            {modifierLabel ? (
                <Text style={[typography.caption, { color: colors.primary, textAlign: 'center' }]}>
                    {modifierLabel}
                </Text>
            ) : null}
        </View>
    );
}
