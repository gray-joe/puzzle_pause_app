import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MatchPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: MatchPuzzle } & PuzzleInteractionProps;

export function MatchPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
    const [mapping, setMapping] = useState<Array<number | null>>(() =>
        puzzle.question.left.map(() => null)
    );
    const { colors, spacing, typography } = useTheme();
    const isComplete = mapping.every((value) => value != null);

    const assignRight = (rightIndex: number) => {
        if (selectedLeft == null) return;
        setMapping((prev) =>
            prev.map((value, leftIndex) => {
                if (leftIndex === selectedLeft) return rightIndex;
                return value === rightIndex ? null : value;
            })
        );
    };

    const handleSubmit = () => {
        if (isComplete) onSubmit(mapping.map((value) => value ?? '').join(','));
    };

    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <Text
                    style={[typography.body, { color: colors.text, fontSize: 21, lineHeight: 30 }]}
                >
                    {puzzle.question.prompt}
                </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.sm }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Left</Text>
                    {puzzle.question.left.map((item, index) => (
                        <MatchButton
                            key={index}
                            title={item}
                            subtitle={
                                mapping[index] == null
                                    ? 'Unmatched'
                                    : puzzle.question.right[mapping[index]!]
                            }
                            selected={selectedLeft === index}
                            disabled={isSubmitting}
                            onPress={() => setSelectedLeft(index)}
                        />
                    ))}
                </View>

                <View style={{ flex: 1, gap: spacing.sm }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Right</Text>
                    {puzzle.question.right.map((item, index) => {
                        const assignedLeft = mapping.findIndex((value) => value === index);
                        return (
                            <MatchButton
                                key={index}
                                title={item}
                                subtitle={
                                    assignedLeft === -1
                                        ? undefined
                                        : `Matched to ${puzzle.question.left[assignedLeft]}`
                                }
                                selected={selectedLeft != null && mapping[selectedLeft] === index}
                                disabled={selectedLeft == null || isSubmitting}
                                onPress={() => assignRight(index)}
                            />
                        );
                    })}
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

            {!!submitError && (
                <Text style={[typography.caption, { color: colors.error }]}>{submitError}</Text>
            )}

            <View style={{ gap: spacing.sm }}>
                <Button
                    title="Submit"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={!isComplete}
                />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}

function MatchButton({
    title,
    subtitle,
    selected,
    disabled,
    onPress,
}: {
    title: string;
    subtitle?: string;
    selected: boolean;
    disabled: boolean;
    onPress: () => void;
}) {
    const { colors, spacing, typography } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => ({
                gap: spacing.xs,
                minHeight: 64,
                justifyContent: 'center',
                padding: spacing.sm,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary : colors.surface,
                opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            })}
        >
            <Text style={[typography.body, { color: selected ? colors.primaryText : colors.text }]}>
                {title}
            </Text>
            {subtitle ? (
                <Text
                    style={[
                        typography.caption,
                        { color: selected ? colors.primaryText : colors.textMuted },
                    ]}
                >
                    {subtitle}
                </Text>
            ) : null}
        </Pressable>
    );
}
