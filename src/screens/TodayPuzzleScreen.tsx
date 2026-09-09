import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import * as puzzleApi from '../api/puzzle';
import type { AttemptResponse, Puzzle } from '../api/schemas';
import { useSession } from '../auth/useSession';
import { PuzzleCompletionStats } from '../components/PuzzleCompletionStats';
import { PuzzleRenderer } from '../components/puzzle/PuzzleRenderer';
import { QueryStateView } from '../components/QueryStateView';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { getPuzzleHintSession, setPuzzleHintSessionHints } from '../lib/puzzleHintSession';
import {
    getGuestPuzzleResult,
    getGuestPuzzleResultAsync,
    setGuestPuzzleResult,
} from '../lib/guestPuzzleState';
import { formatCompletionStats, formatPuzzleAnswer } from '../lib/puzzleAnswer';
import { buildShareText, shareResult } from '../lib/shareResult';
import { useTheme } from '../theme';

export function TodayPuzzleScreen() {
    const { session } = useSession();
    const token = session?.token ?? null;
    const userKey = token ?? 'guest';
    const queryClient = useQueryClient();
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

    const [localResult, setLocalResult] = useState<AttemptResponse | null>(null);
    const [guestResult, setGuestResult] = useState<AttemptResponse | null>(null);
    const [sessionHints, setSessionHints] = useState<string[]>([]);
    const [sessionHintBaseline, setSessionHintBaseline] = useState(0);
    const [sessionIncorrectGuesses, setSessionIncorrectGuesses] = useState<number | null>(null);
    const [sessionOpenedAt, setSessionOpenedAt] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const giveUpPendingRef = useRef(false);

    const alreadySolved = puzzle?.attempt?.solved === true;
    const alreadyGaveUp = puzzle?.attempt?.gave_up === true;

    const {
        data: serverResult,
        isError: isResultError,
        refetch: refetchResult,
    } = useQuery({
        queryKey: ['puzzle', 'result', token ?? 'guest'],
        queryFn: () => puzzleApi.result(token),
        enabled: alreadySolved && !localResult && !!token,
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

    // If the result fetch fails, build a minimal result from the attempt data on the puzzle
    // so the user isn't shown the puzzle again after already solving it.
    const fallbackResult: AttemptResponse | null =
        alreadySolved && isResultError && puzzle?.attempt
            ? {
                  correct: true,
                  solved: true,
                  score: puzzle.attempt.score,
                  incorrect_guesses: puzzle.attempt.incorrect_guesses,
                  answer: puzzle.answer,
                  explanation: puzzle.explanation,
                  opened_at: puzzle.attempt.opened_at,
                  completed_at: puzzle.attempt.completed_at,
              }
            : null;

    const initialGiveUpResult: AttemptResponse | null =
        alreadyGaveUp && puzzle?.attempt
            ? {
                  correct: false,
                  solved: false,
                  gave_up: true,
                  score: 0,
                  incorrect_guesses: puzzle.attempt.incorrect_guesses,
                  answer: puzzle.answer,
                  explanation: puzzle.explanation,
                  opened_at: puzzle.attempt.opened_at,
                  completed_at: puzzle.attempt.completed_at,
              }
            : null;

    const displayResult: AttemptResponse | null =
        localResult ?? initialGiveUpResult ?? serverResult ?? fallbackResult ?? guestResult;
    const currentIncorrectGuesses =
        sessionIncorrectGuesses ?? puzzle?.attempt?.incorrect_guesses ?? 0;
    const currentOpenedAt = sessionOpenedAt ?? puzzle?.attempt?.opened_at ?? null;

    useEffect(() => {
        if (puzzle) {
            const hasServerCompletion = puzzle.attempt?.solved || puzzle.attempt?.gave_up;
            const storedGuestResult =
                token || hasServerCompletion ? null : getGuestPuzzleResult(puzzle.id);
            setGuestResult(storedGuestResult);
            if (!token && !hasServerCompletion && !storedGuestResult) {
                getGuestPuzzleResultAsync(puzzle.id).then((result) => {
                    if (result) setGuestResult((current) => current ?? result);
                });
            }
            const { hints, baseline } = getPuzzleHintSession(
                queryClient,
                'today',
                userKey,
                puzzle.id,
                puzzle.attempt?.hint_used ?? 0
            );
            setSessionHints(hints);
            setSessionHintBaseline(baseline);
        } else {
            setGuestResult(null);
            setSessionHints([]);
            setSessionHintBaseline(0);
        }

        setLocalResult(null);
        setSessionIncorrectGuesses(null);
        setSessionOpenedAt(null);
        setSubmitError('');
    }, [
        queryClient,
        token,
        userKey,
        puzzle?.id,
        puzzle?.attempt?.hint_used,
        puzzle?.attempt?.solved,
        puzzle?.attempt?.gave_up,
    ]);

    const handleTerminalResult = (data: AttemptResponse) => {
        setLocalResult(data);
        if (!token && puzzle) {
            setGuestPuzzleResult(puzzle, data);
            setGuestResult(data);
        }
        setSubmitError('');
        queryClient.invalidateQueries({
            queryKey: ['puzzle', 'today', token ?? 'guest'],
        });
        queryClient.invalidateQueries({
            queryKey: ['calendar', 'completed', token ?? 'guest'],
        });

        if (data.solved || data.correct) {
            if (!token) {
                queryClient.invalidateQueries({ queryKey: ['archive', 'list', 'guest'] });
            } else {
                queryClient.invalidateQueries({ queryKey: ['account', token] });
            }
        }
    };

    const attemptMutation = useMutation({
        mutationFn: (guess: string) =>
            puzzleApi.attempt(
                token,
                puzzle!.id,
                guess,
                currentOpenedAt,
                currentIncorrectGuesses,
                totalHintsUsed
            ),
        onSuccess: (data) => {
            setSessionIncorrectGuesses(data.incorrect_guesses);
            if (data.opened_at != null) setSessionOpenedAt(data.opened_at);
            if (data.gave_up || data.solved || data.correct) {
                handleTerminalResult(data);
            } else {
                setSubmitError('Not quite — try again!');
            }
        },
        onError: (err) => {
            setSubmitError(
                err instanceof ApiError ? err.message : 'Something went wrong. Try again.'
            );
        },
    });

    const hintMutation = useMutation({
        mutationFn: () => puzzleApi.hint(token, puzzle!.id),
        onSuccess: (data) =>
            setSessionHints((prev) => {
                const next = [...prev, data.hint];
                setPuzzleHintSessionHints(queryClient, 'today', userKey, puzzle!.id, next);
                return next;
            }),
    });

    const giveUpMutation = useMutation({
        mutationFn: () => puzzleApi.giveUp(token, puzzle!.id),
        onSuccess: (data) => {
            giveUpPendingRef.current = false;
            setSessionIncorrectGuesses(data.incorrect_guesses);
            if (data.opened_at != null) setSessionOpenedAt(data.opened_at);
            if (data.gave_up || data.solved || data.correct) {
                handleTerminalResult(data);
            } else {
                setSubmitError('Something went wrong. Try again.');
            }
        },
        onError: (err) => {
            giveUpPendingRef.current = false;
            setSubmitError(
                err instanceof ApiError ? err.message : 'Something went wrong. Try again.'
            );
        },
    });

    const totalHintsUsed = Math.max(
        puzzle?.attempt?.hint_used ?? 0,
        sessionHintBaseline + sessionHints.length
    );
    const canHint = !!puzzle && totalHintsUsed < puzzle.total_hints;
    const isPuzzleRequestPending =
        attemptMutation.isPending || hintMutation.isPending || giveUpMutation.isPending;

    const handleSubmit = (guess: string) => {
        if (displayResult || isPuzzleRequestPending) return;
        attemptMutation.mutate(guess);
    };

    const handleHint = () => {
        if (displayResult || isPuzzleRequestPending) return;
        hintMutation.mutate();
    };

    const handleGiveUp = () => {
        if (displayResult || isPuzzleRequestPending || giveUpPendingRef.current) return;
        giveUpPendingRef.current = true;
        setSubmitError('');
        giveUpMutation.mutate();
    };

    // Keep showing a spinner until we have something to display for a solved puzzle —
    // avoids the puzzle flashing through while GET /puzzle/result is in-flight.
    const isPageLoading = isLoading || (alreadySolved && !displayResult);

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        if (alreadySolved && token) {
            await refetchResult();
        }
        setRefreshing(false);
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
                    error={error as Error | null}
                    onRetry={refetch}
                >
                    {puzzle &&
                        (displayResult ? (
                            <ResultView puzzle={puzzle} result={displayResult} />
                        ) : (
                            <PuzzleRenderer
                                puzzle={puzzle}
                                onSubmit={handleSubmit}
                                onHint={handleHint}
                                onGiveUp={handleGiveUp}
                                isSubmitting={isPuzzleRequestPending}
                                isHinting={isPuzzleRequestPending}
                                isGivingUp={giveUpMutation.isPending}
                                submitError={submitError}
                                hintsRevealed={sessionHints}
                                canHint={canHint}
                            />
                        ))}
                </QueryStateView>
            </Screen>
        </>
    );
}

type ResultViewProps = {
    puzzle: Puzzle;
    result: AttemptResponse;
};

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
                    <Text style={[typography.body, { color: colors.text }]}>
                        {formatPuzzleAnswer(puzzle, result.answer, result.question)}
                    </Text>
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
