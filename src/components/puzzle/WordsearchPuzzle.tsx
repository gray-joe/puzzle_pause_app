import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { WordsearchPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { TextInput } from '../TextInput';
import type { PuzzleInteractionProps } from './PuzzleRenderer';
import {
    findWordInGrid,
    parseWordsearchQuestion,
    wordLocation,
    wordsearchAnswers,
} from '../../lib/wordsearch';
import { GridBoard } from './grid';

type Props = { puzzle: WordsearchPuzzle } & PuzzleInteractionProps;

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
    const entered = words.filter((word) => word.trim()).length;
    const isComplete = entered === words.length;

    const updateWord = (index: number, value: string) => {
        const normalized = value.replace(/[^a-z]/gi, '').toUpperCase();
        setWords((prev) => prev.map((word, i) => (i === index ? normalized : word)));
    };

    const handleSubmit = () => {
        if (isComplete && !isSubmitting) onSubmit(words.map((word) => word.trim()).join(' '));
    };

    return (
        <View style={{ gap: spacing.sm }}>
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
                <ScrollView
                    horizontal
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
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
                </ScrollView>
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

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {words.map((word, index) => (
                    <View
                        key={index}
                        style={{ width: words.length === 1 ? '100%' : '47%', flexGrow: 1 }}
                    >
                        <TextInput
                            accessibilityLabel={`Found word ${index + 1}`}
                            placeholder={`Word ${index + 1}`}
                            value={word}
                            onChangeText={(value) => updateWord(index, value)}
                            autoCorrect={false}
                            autoCapitalize="characters"
                            returnKeyType="done"
                            onSubmitEditing={handleSubmit}
                            editable={!isSubmitting}
                            style={{ minHeight: 44, paddingHorizontal: spacing.sm }}
                        />
                    </View>
                ))}
            </View>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: spacing.sm,
                }}
            >
                <Text
                    accessibilityLiveRegion="polite"
                    style={[typography.caption, { color: colors.textMuted }]}
                >
                    {entered} of {words.length} entered
                </Text>
                <Button
                    title="Submit"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={!isComplete}
                />
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
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}

export function WordsearchSolution({ question, answer }: { question: string; answer: string }) {
    const { colors, spacing, typography } = useTheme();
    const { grid } = parseWordsearchQuestion(question);
    const [selected, setSelected] = useState<string | null>(null);
    const paths = wordsearchAnswers(answer).map((word) => ({
        word,
        cells: grid ? findWordInGrid(grid, word) : null,
    }));
    const highlighted = new Set(
        paths
            .filter(({ word }) => selected === null || word === selected)
            .flatMap(({ cells }) => cells?.map(({ r, c }) => `${r},${c}`) ?? [])
    );
    return (
        <View style={{ gap: spacing.sm }}>
            {grid && (
                <GridBoard
                    cols={grid[0].length}
                    cells={grid.flatMap((row, r) =>
                        row.map((value, c) => ({
                            value,
                            highlighted: highlighted.has(`${r},${c}`),
                            selected: selected !== null && highlighted.has(`${r},${c}`),
                        }))
                    )}
                />
            )}
            <Text style={[typography.caption, { color: colors.textMuted }]}>
                Select a word to isolate its path; select it again to show all words.
            </Text>
            {paths.map(({ word, cells }) => (
                <Pressable
                    key={word}
                    accessibilityRole="button"
                    accessibilityLabel={`${word}. ${wordLocation(cells)}`}
                    accessibilityState={{ selected: selected === word }}
                    onPress={() => setSelected(selected === word ? null : word)}
                    style={{
                        minHeight: 44,
                        padding: spacing.sm,
                        borderWidth: selected === word ? 2 : 1,
                        borderColor: selected === word ? colors.primary : colors.border,
                        borderRadius: 4,
                    }}
                >
                    <Text style={[typography.body, { color: colors.text, fontWeight: '700' }]}>
                        {word}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {wordLocation(cells)}
                    </Text>
                </Pressable>
            ))}
            <Text
                accessibilityLiveRegion="polite"
                style={[typography.caption, { color: colors.textMuted }]}
            >
                {selected
                    ? `${selected}: ${wordLocation(paths.find(({ word }) => word === selected)?.cells ?? null)}`
                    : 'Showing all word locations.'}
            </Text>
        </View>
    );
}
