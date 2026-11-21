import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as archiveApi from '../../../src/api/archive';
import type { AttemptResponse, Puzzle } from '../../../src/api/schemas';
import { useSession } from '../../../src/auth/useSession';
import { Button } from '../../../src/components/Button';
import { PuzzleCompletionStats } from '../../../src/components/PuzzleCompletionStats';
import { PuzzleRenderer } from '../../../src/components/puzzle/PuzzleRenderer';
import { QueryStateView } from '../../../src/components/QueryStateView';
import { Screen } from '../../../src/components/Screen';
import { formatCompletionStats } from '../../../src/lib/puzzleAnswer';
import { PuzzleAnswer } from '../../../src/components/puzzle/PuzzleAnswer';
import { buildShareText, shareResult } from '../../../src/lib/shareResult';
import { usePuzzleSession } from '../../../src/lib/usePuzzleSession';
import { useTheme } from '../../../src/theme';

export default function ArchiveDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { session } = useSession();
    const token = session?.token ?? null;
    const { colors } = useTheme();
    const numericId = Number(id);
    const {
        data: puzzle,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['archive', 'detail', numericId, token ?? 'guest'],
        queryFn: () => archiveApi.detail(token, numericId),
        enabled: Number.isFinite(numericId),
    });
    const game = usePuzzleSession({
        puzzle,
        token,
        owner: session ? `user:${session.user.id}` : 'guest',
        scope: 'archive',
    });
    const [refreshing, setRefreshing] = useState(false);
    const solved = puzzle?.attempt?.solved ?? puzzle?.solved;
    const gaveUp = puzzle?.attempt?.gave_up === true;
    const initialResult: AttemptResponse | null =
        puzzle && (solved || gaveUp)
            ? {
                  correct: !!solved,
                  solved: !!solved,
                  gave_up: gaveUp,
                  score: puzzle.attempt?.score ?? 0,
                  incorrect_guesses: puzzle.attempt?.incorrect_guesses ?? 0,
                  answer: puzzle.answer,
                  explanation: puzzle.explanation,
                  opened_at: puzzle.attempt?.opened_at,
                  completed_at: puzzle.attempt?.completed_at,
              }
            : null;
    const result = game.localResult ?? game.guestResult ?? initialResult;
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refetch();
        } finally {
            setRefreshing(false);
        }
    };
    return (
        <>
            <Stack.Screen
                options={{
                    title: puzzle?.puzzle_name ?? 'Puzzle',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.primary,
                    headerTitleStyle: { color: colors.text },
                    headerShadowVisible: false,
                    headerBackButtonDisplayMode: 'minimal',
                }}
            />
            <Screen scrollable padded refreshing={refreshing} onRefresh={handleRefresh}>
                <QueryStateView
                    isLoading={isLoading}
                    hasData={!!puzzle}
                    error={error as Error | null}
                    onRetry={refetch}
                >
                    {puzzle &&
                        (result ? (
                            <ArchiveResultView puzzle={puzzle} result={result} />
                        ) : (
                            <PuzzleRenderer
                                puzzle={puzzle}
                                {...game.interactionProps}
                                {...game.progressProps}
                                onReloadProgress={() => {
                                    void refetch();
                                }}
                            />
                        ))}
                </QueryStateView>
            </Screen>
        </>
    );
}

type ArchiveResultViewProps = { puzzle: Puzzle; result: AttemptResponse };

function ArchiveResultView({ puzzle, result }: ArchiveResultViewProps) {
    const { session } = useSession();
    const router = useRouter();
    const { colors, spacing, typography } = useTheme();
    const [didCopy, setDidCopy] = useState(false);
    const [isLoadingRandom, setIsLoadingRandom] = useState(false);
    const [noUnsolvedLeft, setNoUnsolvedLeft] = useState(false);
    const [randomError, setRandomError] = useState('');
    const token = session?.token ?? null;
    const completionStats = formatCompletionStats(puzzle.completion_stats);
    useEffect(() => {
        if (!didCopy) return;
        const timeout = setTimeout(() => setDidCopy(false), 2000);
        return () => clearTimeout(timeout);
    }, [didCopy]);
    const handleShare = () => {
        shareResult(buildShareText(puzzle, result, 'archive'));
        setDidCopy(true);
    };
    const handleRandomUnsolved = async () => {
        if (isLoadingRandom) return;
        setIsLoadingRandom(true);
        setNoUnsolvedLeft(false);
        setRandomError('');
        try {
            const unsolved = await archiveApi.list(token, { status: 'unsolved' });
            const candidates = unsolved.filter((p) => p.id !== puzzle.id);
            if (candidates.length === 0) {
                setNoUnsolvedLeft(true);
                return;
            }
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            router.push(`/archive/${pick.id}` as never);
        } catch {
            setRandomError(
                'Could not load another puzzle. Check your connection and tap Another? to retry.'
            );
        } finally {
            setIsLoadingRandom(false);
        }
    };
    return (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <Text
                    testID="puzzle-result"
                    style={[
                        typography.heading,
                        { color: result.gave_up ? colors.text : colors.success },
                    ]}
                >
                    {result.gave_up ? 'Gave up' : 'Solved!'}
                </Text>
            </View>
            {!result.gave_up && result.score != null && (
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Score</Text>
                    <Text style={[typography.title, { color: colors.text }]}>{result.score}</Text>
                </View>
            )}
            <Button
                title={didCopy ? 'Copied!' : 'Share result'}
                variant="secondary"
                onPress={handleShare}
            />
            <PuzzleCompletionStats stats={completionStats} />
            <Pressable
                onPress={handleRandomUnsolved}
                disabled={isLoadingRandom}
                accessibilityRole="button"
                accessibilityLabel="Jump to a random, unsolved puzzle"
                style={({ pressed }) => ({
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    paddingVertical: spacing.sm + 4,
                    paddingHorizontal: spacing.lg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    opacity: isLoadingRandom ? 0.5 : pressed ? 0.85 : 1,
                })}
            >
                <Text style={[typography.heading, { color: colors.primaryText }]}>Another?</Text>
                <Text style={[typography.caption, { color: colors.primaryText }]}>
                    Jump to a random, unsolved puzzle
                </Text>
            </Pressable>
            {randomError ? (
                <Text accessibilityRole="alert" style={[typography.body, { color: colors.error }]}>
                    {randomError}
                </Text>
            ) : null}
            {noUnsolvedLeft && (
                <Text
                    style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}
                >
                    No unsolved puzzles left — nice work!
                </Text>
            )}
            {result.answer != null && (
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Answer</Text>
                    <PuzzleAnswer
                        puzzle={puzzle}
                        answer={result.answer}
                        answerQuestion={result.question}
                    />
                </View>
            )}
            {result.explanation && (
                <View testID="result-explanation" style={{ gap: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        How it works
                    </Text>
                    <Text style={[typography.body, { color: colors.text }]}>
                        {result.explanation}
                    </Text>
                </View>
            )}
            {!result.gave_up && result.incorrect_guesses > 0 && (
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        Incorrect guesses
                    </Text>
                    <Text style={[typography.title, { color: colors.text }]}>
                        {result.incorrect_guesses}
                    </Text>
                </View>
            )}
            {!session && (
                <Pressable onPress={() => router.push('/(auth)/email' as never)}>
                    <Text style={[typography.body, { color: colors.primary }]}>
                        Sign in to save your progress →
                    </Text>
                </Pressable>
            )}
        </View>
    );
}
