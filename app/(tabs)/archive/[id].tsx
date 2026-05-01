import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as archiveApi from '../../../src/api/archive';
import { ApiError } from '../../../src/api/client';
import type { AttemptResponse, Puzzle } from '../../../src/api/schemas';
import { useSession } from '../../../src/auth/useSession';
import { PuzzleRenderer } from '../../../src/components/puzzle/PuzzleRenderer';
import { QueryStateView } from '../../../src/components/QueryStateView';
import { Screen } from '../../../src/components/Screen';
import { Button } from '../../../src/components/Button';
import {
    getPuzzleHintSession,
    setPuzzleHintSessionHints,
} from '../../../src/lib/puzzleHintSession';
import {
    getGuestPuzzleResult,
    getGuestPuzzleResultAsync,
    setGuestPuzzleResult,
} from '../../../src/lib/guestPuzzleState';
import { formatPuzzleAnswer } from '../../../src/lib/puzzleAnswer';
import { buildShareText, shareResult } from '../../../src/lib/shareResult';
import { useTheme } from '../../../src/theme';

export default function ArchiveDetailScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = Number(idParam);
    const { session } = useSession();
    const token = session?.token ?? null;
    const userKey = token ?? 'guest';
    const queryClient = useQueryClient();
    const { colors, spacing, typography } = useTheme();

    const {
        data: puzzle,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['archive', 'detail', id, token ?? 'guest'],
        queryFn: () => archiveApi.detail(token, id),
    });

    const [localResult, setLocalResult] = useState<AttemptResponse | null>(null);
    const [guestResult, setGuestResult] = useState<AttemptResponse | null>(null);
    const [sessionHints, setSessionHints] = useState<string[]>([]);
    const [sessionHintBaseline, setSessionHintBaseline] = useState(0);
    const [sessionIncorrectGuesses, setSessionIncorrectGuesses] = useState<number | null>(null);
    const [submitError, setSubmitError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const giveUpPendingRef = useRef(false);

    const currentIncorrectGuesses =
        sessionIncorrectGuesses ?? puzzle?.attempt?.incorrect_guesses ?? 0;

    const handleTerminalResult = (data: AttemptResponse) => {
        setLocalResult(data);
        if (!token && puzzle) {
            setGuestPuzzleResult(puzzle, data);
            setGuestResult(data);
        }
        setSubmitError('');
        queryClient.invalidateQueries({
            queryKey: ['archive', 'detail', id, token ?? 'guest'],
        });
        queryClient.invalidateQueries({
            queryKey: ['calendar', 'completed', token ?? 'guest'],
        });

        if (data.solved || data.correct) {
            queryClient.invalidateQueries({
                queryKey: ['archive', 'list', token ?? 'guest'],
            });
            if (token) queryClient.invalidateQueries({ queryKey: ['account', token] });
        }
    };

    const attemptMutation = useMutation({
        mutationFn: (guess: string) =>
            archiveApi.attempt(token, id, guess, null, currentIncorrectGuesses, totalHintsUsed),
        onSuccess: (data) => {
            setSessionIncorrectGuesses(data.incorrect_guesses);
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
        mutationFn: () => archiveApi.hint(token, id),
        onSuccess: (data) =>
            setSessionHints((prev) => {
                const next = [...prev, data.hint];
                setPuzzleHintSessionHints(queryClient, 'archive', userKey, id, next);
                return next;
            }),
    });

    const giveUpMutation = useMutation({
        mutationFn: () => archiveApi.giveUp(token, id),
        onSuccess: (data) => {
            giveUpPendingRef.current = false;
            setSessionIncorrectGuesses(data.incorrect_guesses);
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

    const alreadySolved = puzzle?.solved === true || puzzle?.attempt?.solved === true;
    const alreadyGaveUp = puzzle?.attempt?.gave_up === true;
    const initialResult: AttemptResponse | null =
        (alreadySolved || alreadyGaveUp) && puzzle.attempt
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

    const displayResult = localResult ?? initialResult ?? guestResult;

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
                'archive',
                userKey,
                id,
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
        setSubmitError('');
    }, [
        queryClient,
        token,
        userKey,
        id,
        puzzle?.attempt?.hint_used,
        puzzle?.attempt?.solved,
        puzzle?.attempt?.gave_up,
        puzzle?.id,
    ]);

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

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: puzzle?.puzzle_name ?? 'Archive',
                    headerShown: true,
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
                    error={error as Error | null}
                    onRetry={refetch}
                >
                    {puzzle &&
                        (displayResult ? (
                            <ArchiveResultView puzzle={puzzle} result={displayResult} />
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

type ArchiveResultViewProps = {
    puzzle: Puzzle;
    result: AttemptResponse;
};

function ArchiveResultView({ puzzle, result }: ArchiveResultViewProps) {
    const { session } = useSession();
    const router = useRouter();
    const { colors, spacing, typography } = useTheme();
    const [didCopy, setDidCopy] = useState(false);

    useEffect(() => {
        if (!didCopy) return;
        const timeout = setTimeout(() => setDidCopy(false), 2000);
        return () => clearTimeout(timeout);
    }, [didCopy]);

    const handleShare = () => {
        shareResult(buildShareText(puzzle, result, 'archive'));
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
