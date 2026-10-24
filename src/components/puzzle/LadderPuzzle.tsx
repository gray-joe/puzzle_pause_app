import { useState } from 'react';
import { Text, View } from 'react-native';
import type { LadderPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: LadderPuzzle } & PuzzleInteractionProps;

const BLANK = '____';

function parseSteps(question: string): string[] {
    return question.split(',').map((step) => step.trim());
}

export function LadderPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const steps = parseSteps(puzzle.question);
    const blankIndexes = steps.flatMap((step, index) => (step === BLANK ? [index] : []));
    const [guesses, setGuesses] = useState<Record<number, string>>({});
    const { colors, spacing, typography } = useTheme();
    const isComplete = blankIndexes.every((index) => guesses[index]?.trim());

    const updateGuess = (index: number, value: string) => {
        setGuesses((prev) => ({ ...prev, [index]: value }));
    };

    const handleSubmit = () => {
        if (!isComplete) return;
        onSubmit(blankIndexes.map((index) => guesses[index]!.trim()).join(', '));
    };

    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {steps.map((step, index) =>
                        step === BLANK ? (
                            <Text
                                key={index}
                                style={[
                                    typography.body,
                                    {
                                        fontSize: 21,
                                        lineHeight: 30,
                                        minWidth: 60,
                                        textAlign: 'center',
                                        color: colors.primary,
                                        borderBottomWidth: 2,
                                        borderBottomColor: colors.primary,
                                    },
                                ]}
                            >
                                {guesses[index]?.trim() || BLANK}
                            </Text>
                        ) : (
                            <Text
                                key={index}
                                style={[
                                    typography.body,
                                    { fontSize: 21, lineHeight: 30, color: colors.text },
                                ]}
                            >
                                {step}
                                {index < steps.length - 1 ? ',' : ''}
                            </Text>
                        )
                    )}
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
                {blankIndexes.map((stepIndex, blankNumber) => (
                    <TextInput
                        key={stepIndex}
                        label={`Blank ${blankNumber + 1}`}
                        value={guesses[stepIndex] ?? ''}
                        onChangeText={(value) => updateGuess(stepIndex, value)}
                        editable={!isSubmitting}
                        autoCorrect={false}
                        returnKeyType={blankNumber === blankIndexes.length - 1 ? 'done' : 'next'}
                        onSubmitEditing={
                            blankNumber === blankIndexes.length - 1 ? handleSubmit : undefined
                        }
                    />
                ))}

                {!!submitError && (
                    <Text style={[typography.caption, { color: colors.error }]}>{submitError}</Text>
                )}

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
