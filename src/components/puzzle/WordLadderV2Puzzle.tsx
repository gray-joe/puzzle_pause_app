import { useRef, useState } from 'react';
import { Pressable, TextInput as RNTextInput, Text, View } from 'react-native';
import type { WordLadderV2Puzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: WordLadderV2Puzzle } & PuzzleInteractionProps;

type LetterState = 'correct' | 'present' | 'absent' | 'empty';

function parseStartEnd(question: string): { start: string; end: string } {
    const [start, end] = question.split(',').map((word) => word.trim());
    return { start: start ?? '', end: end ?? '' };
}

function differsByOneLetter(a: string, b: string): boolean {
    return a.length === b.length && [...a].filter((ch, i) => ch !== b[i]).length === 1;
}

// Wordle-style feedback comparing a guessed word directly against the target end word.
function letterStates(word: string, target: string): LetterState[] {
    const remaining: Record<string, number> = {};
    for (let i = 0; i < target.length; i++) {
        if (word[i] !== target[i]) {
            const letter = target[i]!;
            remaining[letter] = (remaining[letter] ?? 0) + 1;
        }
    }

    return word.split('').map((letter, i) => {
        if (letter === target[i]) return 'correct';
        if (remaining[letter] > 0) {
            remaining[letter]! -= 1;
            return 'present';
        }
        return 'absent';
    });
}

export function WordLadderV2PuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const { start, end } = parseStartEnd(puzzle.question);
    const wordLength = start.length;
    const [words, setWords] = useState<string[]>([]);
    const [current, setCurrent] = useState('');
    const { colors, spacing, typography } = useTheme();
    const inputRef = useRef<RNTextInput>(null);

    const lastWord = (words[words.length - 1] ?? start).toUpperCase();
    const target = end.toUpperCase();
    const trimmedCurrent = current.trim().toUpperCase();
    const canAdd =
        trimmedCurrent.length === wordLength && differsByOneLetter(trimmedCurrent, lastWord);

    const addWord = () => {
        if (!canAdd) return;
        setWords((prev) => [...prev, trimmedCurrent]);
        setCurrent('');
    };

    // Last word must reach the end word; a trailing copy of the end word is fine (dropped server-side).
    const canSubmit =
        lastWord === target
            ? words.length > 1
            : words.length > 0 && differsByOneLetter(lastWord, target);

    const removeLastWord = () => setWords((prev) => prev.slice(0, -1));

    const handleSubmit = () => {
        if (!canSubmit) return;
        inputRef.current?.blur();
        onSubmit(words.join(', '));
    };

    const activeLetters = Array.from({ length: wordLength }, (_, i) => trimmedCurrent[i] ?? '');
    const showMismatch = trimmedCurrent.length === wordLength && !canAdd;

    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <Text style={[typography.title, { color: colors.text }]}>
                    {start.toUpperCase()} → {target}
                </Text>
            </View>

            <Pressable
                accessibilityLabel="Word ladder grid, tap to type"
                onPress={() => inputRef.current?.focus()}
                style={{ gap: spacing.xs, alignItems: 'center' }}
            >
                <LetterRow
                    letters={start.toUpperCase().split('')}
                    states={letterStates(start.toUpperCase(), target)}
                />
                {words.map((word, rowIndex) => (
                    <LetterRow
                        key={rowIndex}
                        letters={word.split('')}
                        states={letterStates(word, target)}
                    />
                ))}
                <LetterRow
                    letters={activeLetters}
                    states={activeLetters.map(() => 'empty')}
                    highlight={showMismatch ? colors.error : colors.primary}
                />
                <LetterRow
                    letters={target.split('')}
                    states={target.split('').map(() => 'correct')}
                />
            </Pressable>

            {/* ponytail: hidden native input drives the grid; swap for an on-screen keyboard if the native one feels off */}
            <RNTextInput
                ref={inputRef}
                value={current}
                onChangeText={(value) => setCurrent(value.replace(/[^a-z]/gi, '').toUpperCase())}
                autoCorrect={false}
                autoCapitalize="characters"
                maxLength={wordLength}
                returnKeyType="done"
                blurOnSubmit={false}
                // Return adds a valid word, otherwise closes the keyboard (iOS has no dismiss key).
                onSubmitEditing={canAdd ? addWord : () => inputRef.current?.blur()}
                editable={!isSubmitting}
                caretHidden
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />

            <Text
                style={[
                    typography.caption,
                    { color: showMismatch ? colors.error : colors.textMuted, textAlign: 'center' },
                ]}
            >
                {showMismatch
                    ? `Change exactly one letter from ${lastWord}`
                    : `Tap the grid and type a ${wordLength}-letter word`}
            </Text>

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
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button
                        title="Add word"
                        variant="secondary"
                        onPress={addWord}
                        disabled={!canAdd || isSubmitting}
                        style={{ flex: 1 }}
                    />
                    {words.length > 0 && (
                        <Button
                            title="Remove last"
                            variant="secondary"
                            onPress={removeLastWord}
                            disabled={isSubmitting}
                            style={{ flex: 1 }}
                        />
                    )}
                </View>

                {!!submitError && (
                    <Text style={[typography.caption, { color: colors.error }]}>{submitError}</Text>
                )}

                <Button
                    title="Submit"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={!canSubmit}
                />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}

function LetterRow({
    letters,
    states,
    highlight,
}: {
    letters: string[];
    states: LetterState[];
    highlight?: string;
}) {
    const { spacing } = useTheme();
    return (
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {letters.map((letter, i) => (
                <LetterCell key={i} letter={letter} state={states[i]!} borderColor={highlight} />
            ))}
        </View>
    );
}

function LetterCell({
    letter,
    state,
    borderColor,
}: {
    letter: string;
    state: LetterState;
    borderColor?: string;
}) {
    const { colors, typography } = useTheme();
    const background =
        state === 'correct'
            ? colors.success
            : state === 'present'
              ? colors.secondary
              : colors.surface;
    const textColor = state === 'correct' || state === 'present' ? colors.primaryText : colors.text;

    return (
        <View
            style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                borderWidth: borderColor ? 2 : 1,
                borderColor: borderColor ?? colors.border,
                backgroundColor: background,
            }}
        >
            <Text style={[typography.title, { color: textColor }]}>{letter}</Text>
        </View>
    );
}
