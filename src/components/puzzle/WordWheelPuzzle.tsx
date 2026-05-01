import { useState } from 'react';
import { Text, View } from 'react-native';
import type { WordWheelPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: WordWheelPuzzle } & PuzzleInteractionProps;

export function WordWheelPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const [words, setWords] = useState(() => puzzle.question.wheels.map(() => ''));
    const { colors, spacing, typography } = useTheme();
    const puzzleTextStyle = { fontSize: 21, lineHeight: 30 };
    const isComplete = words.every((word) => word.trim());

    const updateWord = (index: number, value: string) => {
        setWords((prev) => prev.map((word, i) => (i === index ? value.toUpperCase() : word)));
    };

    const handleSubmit = () => {
        if (isComplete) onSubmit(words.map((word) => word.trim()).join(' '));
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

            <View style={{ gap: spacing.lg }}>
                {puzzle.question.wheels.map((wheel, index) => (
                    <View key={index} style={{ gap: spacing.md, alignItems: 'center' }}>
                        <LetterWheel letters={wheel.letters} />
                        <TextInput
                            label={`Wheel ${index + 1}`}
                            value={words[index] ?? ''}
                            onChangeText={(value) => updateWord(index, value)}
                            autoCorrect={false}
                            autoCapitalize="characters"
                            returnKeyType={
                                index === puzzle.question.wheels.length - 1 ? 'done' : 'next'
                            }
                            onSubmitEditing={
                                index === puzzle.question.wheels.length - 1
                                    ? handleSubmit
                                    : undefined
                            }
                            editable={!isSubmitting}
                            style={{ minWidth: 220, textAlign: 'center', letterSpacing: 2 }}
                        />
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

function LetterWheel({ letters }: { letters: Array<string | null> }) {
    const { colors, spacing, typography } = useTheme();
    const size = 190;
    const tileSize = 42;
    const radius = 66;
    const center = size / 2 - tileSize / 2;

    return (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
            }}
        >
            {letters.map((letter, index) => {
                const angle = (2 * Math.PI * index) / letters.length - Math.PI / 2;
                const left = center + radius * Math.cos(angle);
                const top = center + radius * Math.sin(angle);

                return (
                    <View
                        key={index}
                        style={{
                            position: 'absolute',
                            left,
                            top,
                            width: tileSize,
                            height: tileSize,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: tileSize / 2,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                            padding: spacing.xs,
                        }}
                    >
                        <Text style={[typography.title, { color: colors.text }]}>
                            {letter ?? '?'}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}
