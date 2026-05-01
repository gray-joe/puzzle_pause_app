import { useState } from 'react';
import { Text, View } from 'react-native';
import type { WordsearchPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: WordsearchPuzzle } & PuzzleInteractionProps;

type ParsedWordsearch = {
    gridText: string;
    findLine: string;
    themeLine?: string;
    inputCount: number;
};

export function WordsearchPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const parsed = parseWordsearchQuestion(puzzle.question);
    const [words, setWords] = useState(() => Array.from({ length: parsed.inputCount }, () => ''));
    const { colors, spacing, typography } = useTheme();
    const isComplete = words.every((word) => word.trim());

    const updateWord = (index: number, value: string) => {
        const normalized = value.replace(/[^a-z]/gi, '').toUpperCase();
        setWords((prev) => prev.map((word, i) => (i === index ? normalized : word)));
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
                <Text
                    style={[typography.body, { color: colors.text, fontSize: 21, lineHeight: 30 }]}
                >
                    Wordsearch
                </Text>
            </View>

            <View
                style={{
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                <Text
                    style={[
                        typography.body,
                        {
                            color: colors.text,
                            fontFamily: 'Courier',
                            lineHeight: 28,
                            textAlign: 'center',
                        },
                    ]}
                >
                    {parsed.gridText}
                </Text>
            </View>

            <View style={{ gap: spacing.xs }}>
                {parsed.themeLine ? (
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {parsed.themeLine}
                    </Text>
                ) : null}
                {parsed.inputCount === 1 ? (
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {parsed.findLine}
                    </Text>
                ) : (
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        Find {parsed.inputCount} words
                    </Text>
                )}
            </View>

            <View style={{ gap: spacing.sm }}>
                {words.map((word, index) => (
                    <TextInput
                        key={index}
                        label={words.length === 1 ? 'Found word' : `Found word ${index + 1}`}
                        value={word}
                        onChangeText={(value) => updateWord(index, value)}
                        autoCorrect={false}
                        autoCapitalize="characters"
                        returnKeyType={index === words.length - 1 ? 'done' : 'next'}
                        onSubmitEditing={index === words.length - 1 ? handleSubmit : undefined}
                        editable={!isSubmitting}
                    />
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

function parseWordsearchQuestion(question: string): ParsedWordsearch {
    const lines = question.split(/\r?\n/).map((line) => line.trimEnd());
    const findLine = lines.find((line) => /^Find:/i.test(line)) ?? 'Find:';
    const themeLine = lines.find((line) => /^Theme:/i.test(line));
    const gridLines = lines.filter((line) => !/^Find:/i.test(line) && !/^Theme:/i.test(line));
    const findValue = findLine.replace(/^Find:\s*/i, '').trim();
    const parsedCount = Number(findValue);
    const inputCount = Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : 1;

    return {
        gridText: gridLines.join('\n'),
        findLine,
        themeLine,
        inputCount,
    };
}
