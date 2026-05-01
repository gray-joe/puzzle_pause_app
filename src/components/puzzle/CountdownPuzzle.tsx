import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { CountdownPuzzle } from '../../api/schemas';
import {
    countdownTokenLabel,
    evaluateCountdownTokens,
    formatCountdownResult,
    type CountdownToken,
} from '../../lib/countdown';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: CountdownPuzzle } & PuzzleInteractionProps;

export function CountdownPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const [tokens, setTokens] = useState<CountdownToken[]>([]);
    const [showTotal, setShowTotal] = useState(false);
    const { colors, spacing, typography } = useTheme();
    const puzzleTextStyle = { fontSize: 21, lineHeight: 30 };
    const total = evaluateCountdownTokens(tokens);
    const expression = tokens.map(countdownTokenLabel).join(' ');
    const usedTileIndexes = new Set(
        tokens.filter((token) => token.type === 'number').map((token) => token.tileIndex)
    );

    const appendToken = (token: CountdownToken) => {
        setTokens((prev) => [...prev, token]);
        setShowTotal(false);
    };

    const handleBackspace = () => {
        setTokens((prev) => prev.slice(0, -1));
        setShowTotal(false);
    };

    const handleClear = () => {
        setTokens([]);
        setShowTotal(false);
    };

    const handleSubmit = () => {
        if (total != null) onSubmit(formatCountdownResult(total));
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

            <View
                style={{
                    alignItems: 'center',
                    padding: spacing.lg,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <Text style={[typography.caption, { color: colors.textMuted }]}>Target</Text>
                <Text style={[typography.heading, { color: colors.primary, fontSize: 40 }]}>
                    {puzzle.question.target}
                </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Numbers</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {puzzle.question.numbers.map((number, index) => (
                        <Tile
                            key={index}
                            label={String(number)}
                            disabled={usedTileIndexes.has(index)}
                            onPress={() =>
                                appendToken({ type: 'number', value: number, tileIndex: index })
                            }
                        />
                    ))}
                </View>
            </View>

            <View style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Operators</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {[...puzzle.question.operators, '(', ')'].map((operator) => (
                        <Tile
                            key={operator}
                            label={operator}
                            onPress={() =>
                                appendToken(
                                    operator === '(' || operator === ')'
                                        ? { type: 'paren', value: operator }
                                        : { type: 'operator', value: operator }
                                )
                            }
                        />
                    ))}
                </View>
            </View>

            <View
                style={{
                    minHeight: 58,
                    justifyContent: 'center',
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <Text style={[typography.body, puzzleTextStyle, { color: colors.text }]}>
                    {expression || 'Build your expression'}
                </Text>
            </View>

            {showTotal && total != null && (
                <Text style={[typography.body, { color: colors.text }]}>
                    Total: {formatCountdownResult(total)}
                </Text>
            )}

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
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                        <Button
                            title="Backspace"
                            variant="secondary"
                            onPress={handleBackspace}
                            disabled={tokens.length === 0}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Button
                            title="Clear"
                            variant="secondary"
                            onPress={handleClear}
                            disabled={tokens.length === 0}
                        />
                    </View>
                </View>
                {!showTotal && (
                    <Button
                        title="Show total (-10 pts)"
                        variant="secondary"
                        onPress={() => setShowTotal(true)}
                        disabled={total == null}
                    />
                )}
                <Button
                    title="Submit"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={total == null}
                />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}

function Tile({
    label,
    disabled = false,
    onPress,
}: {
    label: string;
    disabled?: boolean;
    onPress: () => void;
}) {
    const { colors, spacing, typography } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            style={({ pressed }) => ({
                minWidth: 48,
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: disabled ? 0.35 : pressed ? 0.75 : 1,
            })}
        >
            <Text style={[typography.title, { color: colors.text }]}>{label}</Text>
        </Pressable>
    );
}
