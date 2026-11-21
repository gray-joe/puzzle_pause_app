import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as puzzleApi from '../api/puzzle';
import type { AttemptResponse, Puzzle } from '../api/schemas';
import { useSession } from '../auth/useSession';
import { PuzzleCompletionStats } from '../components/PuzzleCompletionStats';
import { PuzzleRenderer } from '../components/puzzle/PuzzleRenderer';
import { QueryStateView } from '../components/QueryStateView';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { formatCompletionStats } from '../lib/puzzleAnswer';
import { PuzzleAnswer } from '../components/puzzle/PuzzleAnswer';
import { buildShareText, shareResult } from '../lib/shareResult';
import { usePuzzleSession } from '../lib/usePuzzleSession';
import { useTheme } from '../theme';

export function TodayPuzzleScreen() {
    const { session } = useSession();
    const token = session?.token ?? null;
    const { colors } = useTheme();
    const {
        data: puzzle,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['puzzle', 'today', token ?? 'guest'],
        queryFn: () => puzzleApi.today(token),
    });
    const game = usePuzzleSession({
        puzzle,
        token,
        owner: session ? `user:${session.user.id}` : 'guest',
        scope: 'today',
    });
    const [refreshing, setRefreshing] = useState(false);
    const alreadySolved = puzzle?.attempt?.solved === true;
    const alreadyGaveUp = puzzle?.attempt?.gave_up === true;
    const {
        data: serverResult,
        isError: isResultError,
        refetch: refetchResult,
    } = useQuery({
        queryKey: ['puzzle', 'result', token ?? 'guest', puzzle?.id],
        queryFn: () => puzzleApi.result(token),
        enabled: alreadySolved && !game.localResult && !!token,
        select: (data): AttemptResponse => ({
            correct: true,
            solved: true,
            score: data.attempt.score,
            incorrect_guesses: data.attempt.incorrect_guesses,
            answer: data.puzzle.answer ?? puzzle?.answer,
            question: data.puzzle.question,
            explanation: data.puzzle.explanation,
            opened_at: data.attempt.opened_at,
            completed_at: data.attempt.completed_at,
        }),
    });
    // Never reopen an already completed puzzle because its result fetch failed.
    const fallbackResult: AttemptResponse | null =
        ((alreadySolved && isResultError) || alreadyGaveUp) && puzzle?.attempt
            ? {
                  correct: alreadySolved,
                  solved: alreadySolved,
                  gave_up: alreadyGaveUp,
                  score: alreadyGaveUp ? 0 : puzzle.attempt.score,
                  incorrect_guesses: puzzle.attempt.incorrect_guesses,
                  answer: puzzle.answer,
                  explanation: puzzle.explanation,
                  opened_at: puzzle.attempt.opened_at,
                  completed_at: puzzle.attempt.completed_at,
              }
            : null;
    const displayResult =
        game.localResult ??
        (alreadyGaveUp ? fallbackResult : null) ??
        (alreadySolved ? serverResult : null) ??
        fallbackResult ??
        game.guestResult;
    const isPageLoading = isLoading || (alreadySolved && !displayResult);
    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await refetch();
            if (alreadySolved && token) await refetchResult();
        } finally {
            setRefreshing(false);
        }
    };
    return (
        <>
            <Stack.Screen
                options={{
                    title: puzzle?.puzzle_name ?? 'Puzzle',
                    headerShown: !!displayResult,
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.primary,
                    headerTitleStyle: { color: colors.text },
                    headerShadowVisible: false,
                    headerBackButtonDisplayMode: 'minimal',
                }}
            />
            <Screen scrollable padded refreshing={refreshing} onRefresh={handleRefresh}>
                <QueryStateView
                    isLoading={isPageLoading}
                    hasData={!!puzzle}
                    error={error as Error | null}
                    onRetry={refetch}
                >
                    {puzzle &&
                        (displayResult ? (
                            <ResultView puzzle={puzzle} result={displayResult} />
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

type ResultViewProps = { puzzle: Puzzle; result: AttemptResponse };

function ResultView({ puzzle, result }: ResultViewProps) {
    const { session } = useSession();
    const router = useRouter();
    const { colors, spacing, typography } = useTheme();
    const [didCopy, setDidCopy] = useState(false);
    const completionStats = formatCompletionStats(puzzle.completion_stats);
    useEffect(() => {
        if (!didCopy) return;
        const timeout = setTimeout(() => setDidCopy(false), 2000);
        return () => clearTimeout(timeout);
    }, [didCopy]);
    const handleShare = () => {
        shareResult(buildShareText(puzzle, result, 'today'));
        setDidCopy(true);
    };
    return (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <Text
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
            {!result.gave_up && result.streak != null && result.streak > 0 && (
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>Streak</Text>
                    <Text style={[typography.title, { color: colors.text }]}>
                        {result.streak} day{result.streak !== 1 ? 's' : ''}
                    </Text>
                </View>
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
