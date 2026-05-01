import { Text, View } from 'react-native';
import type { ChoicePuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: ChoicePuzzle } & PuzzleInteractionProps;

export function ChoicePuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const { colors, spacing, typography } = useTheme();
    const puzzleTextStyle = { fontSize: 21, lineHeight: 30 };

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

            {hintsRevealed.length > 0 && (
                <View
                    style={{
                        gap: spacing.xs,
                        padding: spacing.sm,
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                    }}
                >
                    {hintsRevealed.map((h, i) => (
                        <Text key={i} style={[typography.caption, { color: colors.textMuted }]}>
                            Hint: {h}
                        </Text>
                    ))}
                </View>
            )}

            <View style={{ gap: spacing.sm }}>
                {puzzle.question.options.map((option, i) => (
                    <Button
                        key={i}
                        title={option.trim()}
                        variant="secondary"
                        onPress={() => onSubmit(String.fromCharCode(65 + i))}
                        disabled={isSubmitting}
                    />
                ))}
            </View>

            {!!submitError && (
                <Text style={[typography.caption, { color: colors.error }]}>{submitError}</Text>
            )}

            {canHint && (
                <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
            )}
        </View>
    );
}
