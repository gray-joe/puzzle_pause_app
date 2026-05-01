import { useState } from 'react';
import { Text, View } from 'react-native';
import type { LadderPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { PuzzleHtml } from '../PuzzleHtml';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: LadderPuzzle } & PuzzleInteractionProps;

const LADDER_STEP_COUNT = 4;

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
    const [steps, setSteps] = useState(() => Array.from({ length: LADDER_STEP_COUNT }, () => ''));
    const { colors, spacing, typography } = useTheme();
    const isComplete = steps.every((step) => step.trim());

    const updateStep = (index: number, value: string) => {
        setSteps((prev) => prev.map((step, stepIndex) => (stepIndex === index ? value : step)));
    };

    const handleSubmit = () => {
        if (isComplete) onSubmit(steps.map((step) => step.trim()).join(','));
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
                    {hintsRevealed.map((hint, index) => (
                        <Text key={index} style={[typography.caption, { color: colors.textMuted }]}>
                            Hint: {hint}
                        </Text>
                    ))}
                </View>
            )}

            <View style={{ gap: spacing.sm }}>
                {steps.map((step, index) => (
                    <TextInput
                        key={index}
                        label={`Step ${index + 1}`}
                        value={step}
                        onChangeText={(value) => updateStep(index, value)}
                        editable={!isSubmitting}
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
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
