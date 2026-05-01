import { useState } from 'react';
import { Text, View } from 'react-native';
import type { OrderPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: OrderPuzzle } & PuzzleInteractionProps;

type OrderedItem = {
    label: string;
    originalIndex: number;
};

export function OrderPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const [items, setItems] = useState<OrderedItem[]>(() =>
        puzzle.question.items.map((label, originalIndex) => ({ label, originalIndex }))
    );
    const { colors, spacing, typography } = useTheme();
    const puzzleTextStyle = { fontSize: 21, lineHeight: 30 };

    const moveItem = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= items.length) return;
        setItems((prev) => {
            const next = [...prev];
            const [item] = next.splice(fromIndex, 1);
            if (!item) return prev;
            next.splice(toIndex, 0, item);
            return next;
        });
    };

    const handleSubmit = () => {
        onSubmit(items.map((item) => item.originalIndex).join(','));
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
                {items.map((item, index) => (
                    <View
                        key={item.originalIndex}
                        style={{
                            gap: spacing.sm,
                            padding: spacing.md,
                            backgroundColor: colors.surface,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    >
                        <View
                            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                        >
                            <Text style={[typography.caption, { color: colors.textMuted }]}>
                                {index + 1}
                            </Text>
                            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>
                                {item.label}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Up"
                                    variant="secondary"
                                    onPress={() => moveItem(index, index - 1)}
                                    disabled={index === 0 || isSubmitting}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Down"
                                    variant="secondary"
                                    onPress={() => moveItem(index, index + 1)}
                                    disabled={index === items.length - 1 || isSubmitting}
                                />
                            </View>
                        </View>
                    </View>
                ))}
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
                <Button title="Submit" onPress={handleSubmit} loading={isSubmitting} />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}
