import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ClueRevealPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: ClueRevealPuzzle } & PuzzleInteractionProps;

export function ClueRevealPuzzleView({
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
    // clues[0] is always shown; hintsRevealed contains clues[1], [2], … revealed via hint calls
    const visibleClues = [puzzle.question.clues[0], ...hintsRevealed].filter(Boolean);

    const handleSubmit = () => {
        if (guess.trim()) onSubmit(guess.trim());
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
                {visibleClues.map((clue, i) => (
                    <View
                        key={i}
                        style={{
                            padding: spacing.sm,
                            backgroundColor: colors.surface,
                            borderRadius: 8,
                            borderLeftWidth: 3,
                            borderLeftColor: i === 0 ? colors.primary : colors.textMuted,
                        }}
                    >
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                            Clue {i + 1}
                        </Text>
                        <Text style={[typography.body, puzzleTextStyle, { color: colors.text }]}>
                            {clue}
                        </Text>
                    </View>
                ))}
            </View>

            {canHint && (
                <Button
                    title="Next clue"
                    variant="secondary"
                    onPress={onHint}
                    loading={isHinting}
                />
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
            </View>
        </View>
    );
}
