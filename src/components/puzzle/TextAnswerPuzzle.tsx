import { useState } from 'react';
import { Text, View } from 'react-native';
import type { TextPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { PuzzleHtml } from '../PuzzleHtml';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: TextPuzzle } & PuzzleInteractionProps;

export function TextAnswerPuzzle({
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

    const handleSubmit = () => {
        if (guess.trim()) onSubmit(guess.trim());
    };

    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
            </View>

            <PuzzleHtml html={puzzle.question} />

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
                <TextInput
                    label="Your answer"
                    value={guess}
                    onChangeText={setGuess}
                    editable={!isSubmitting}
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    error={submitError}
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
