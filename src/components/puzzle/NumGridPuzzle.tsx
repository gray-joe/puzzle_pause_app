import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NumGridPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: NumGridPuzzle } & PuzzleInteractionProps;

const NUMERIC_INPUT_PATTERN = /^-?\d*\.?\d*$/;

export function NumGridPuzzleView({
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
    const { colors, spacing, typography } = useTheme();
    const puzzleTextStyle = { fontSize: 21, lineHeight: 30 };

    const updateGuess = (value: string) => {
        if (NUMERIC_INPUT_PATTERN.test(value)) setGuess(value);
    };

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

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {puzzle.question.grid.map((cell, index) => (
                    <View
                        key={index}
                        style={{
                            width: '22%',
                            minHeight: 54,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: cell == null ? colors.primary : colors.surface,
                        }}
                    >
                        <Text
                            style={[
                                typography.title,
                                { color: cell == null ? colors.primaryText : colors.text },
                            ]}
                        >
                            {cell ?? '?'}
                        </Text>
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

            <View style={{ gap: spacing.sm }}>
                <TextInput
                    label="Missing number"
                    placeholder="Missing number..."
                    value={guess}
                    onChangeText={updateGuess}
                    keyboardType="numeric"
                    inputMode="numeric"
                    autoCorrect={false}
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
