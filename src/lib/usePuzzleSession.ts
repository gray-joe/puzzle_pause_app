import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import * as archiveApi from '../api/archive';
import * as puzzleApi from '../api/puzzle';
import { ApiError } from '../api/client';
import type { AttemptResponse, Puzzle } from '../api/schemas';
import type { PuzzleInteractionProps } from '../components/puzzle/PuzzleRenderer';
import type { PuzzleProgressProps } from '../components/puzzle/PuzzleDraftProvider';
import {
    getGuestPuzzleResult,
    getGuestPuzzleResultAsync,
    setGuestPuzzleResult,
} from './guestPuzzleState';
import { clearPuzzleDraft } from './puzzleDrafts';
import { getPuzzleHintSession, setPuzzleHintSessionHints } from './puzzleHintSession';

type Request = {
    identity: string;
    puzzle: Puzzle;
    token: string | null;
    guess?: string;
    opened_at: string | null;
    incorrect_guesses: number;
    hints_used: number;
};

export function usePuzzleSession({
    puzzle,
    token,
    owner,
    scope,
}: {
    puzzle: Puzzle | undefined;
    token: string | null;
    owner: string;
    scope: 'today' | 'archive';
}) {
    const queryClient = useQueryClient();
    const api = scope === 'today' ? puzzleApi : archiveApi;
    const userKey = token ?? 'guest';
    const identity = JSON.stringify([scope, owner, token, puzzle?.id]);
    const currentIdentity = useRef(identity);
    currentIdentity.current = identity;
    const pending = useRef(false);
    const [localResult, setLocalResult] = useState<AttemptResponse | null>(null);
    const [guestResult, setGuestResult] = useState<AttemptResponse | null>(null);
    const [hints, setHints] = useState<string[]>([]);
    const [hintBaseline, setHintBaseline] = useState(0);
    const [incorrectGuesses, setIncorrectGuesses] = useState<number | null>(null);
    const [openedAt, setOpenedAt] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState('');
    const [hintError, setHintError] = useState('');
    const completed = !!(puzzle?.solved || puzzle?.attempt?.solved || puzzle?.attempt?.gave_up);
    const currentIncorrectGuesses = incorrectGuesses ?? puzzle?.attempt?.incorrect_guesses ?? 0;
    const currentOpenedAt = openedAt ?? puzzle?.attempt?.opened_at ?? null;
    const totalHintsUsed = Math.max(puzzle?.attempt?.hint_used ?? 0, hintBaseline + hints.length);

    useEffect(() => {
        if (puzzle && completed) void clearPuzzleDraft(owner, puzzle.id).catch(() => {});
    }, [owner, puzzle?.id, completed]);

    useEffect(() => {
        let active = true;
        pending.current = false;
        if (puzzle) {
            const stored = token || completed ? null : getGuestPuzzleResult(puzzle.id);
            setGuestResult(stored);
            if (stored) void clearPuzzleDraft('guest', puzzle.id).catch(() => {});
            if (!token && !completed && !stored) {
                void getGuestPuzzleResultAsync(puzzle.id).then((result) => {
                    if (active && result) {
                        void clearPuzzleDraft('guest', puzzle.id).catch(() => {});
                        setGuestResult((current) => current ?? result);
                    }
                });
            }
            const session = getPuzzleHintSession(
                queryClient,
                scope,
                userKey,
                puzzle.id,
                puzzle.attempt?.hint_used ?? 0,
                puzzle.revealed_hint
            );
            setHints(session.hints);
            setHintBaseline(session.baseline);
        } else {
            setGuestResult(null);
            setHints([]);
            setHintBaseline(0);
        }
        setLocalResult(null);
        setIncorrectGuesses(null);
        setOpenedAt(null);
        setSubmitError('');
        setHintError('');
        return () => {
            active = false;
        };
    }, [queryClient, identity, puzzle?.attempt?.hint_used, puzzle?.revealed_hint, completed]);

    const isCurrent = (request: Request) => request.identity === currentIdentity.current;
    const terminalResult = (data: AttemptResponse, request: Request) => {
        setLocalResult(data);
        void clearPuzzleDraft(owner, request.puzzle.id).catch(() => {});
        if (!request.token) {
            setGuestPuzzleResult(request.puzzle, data);
            setGuestResult(data);
        }
        setSubmitError('');
        queryClient.invalidateQueries({
            queryKey:
                scope === 'today'
                    ? ['puzzle', 'today', userKey]
                    : ['archive', 'detail', request.puzzle.id, userKey],
        });
        queryClient.invalidateQueries({ queryKey: ['calendar', 'completed', userKey] });
        if (data.solved || data.correct) {
            if (scope === 'archive' || !request.token)
                queryClient.invalidateQueries({ queryKey: ['archive', 'list', userKey] });
            if (request.token)
                queryClient.invalidateQueries({ queryKey: ['account', request.token] });
        }
    };
    const recordAttempt = (data: AttemptResponse) => {
        setIncorrectGuesses(data.incorrect_guesses);
        if (data.opened_at != null) setOpenedAt(data.opened_at);
    };
    const attemptMutation = useMutation({
        mutationFn: (request: Request) =>
            api.attempt(
                request.token,
                request.puzzle.id,
                request.guess!,
                request.opened_at,
                request.incorrect_guesses,
                request.hints_used
            ),
        onSuccess: (data, request) => {
            if (!isCurrent(request)) return;
            pending.current = false;
            recordAttempt(data);
            if (data.gave_up || data.solved || data.correct) terminalResult(data, request);
            else setSubmitError('Not quite — try again!');
        },
        onError: (error, request) => {
            if (!isCurrent(request)) return;
            pending.current = false;
            setSubmitError(
                error instanceof ApiError ? error.message : 'Something went wrong. Try again.'
            );
        },
    });
    const hintMutation = useMutation({
        mutationFn: (request: Request) =>
            api.hint(request.token, request.puzzle.id, request.hints_used),
        onSuccess: (data, request) => {
            if (!isCurrent(request)) return;
            pending.current = false;
            setHintError('');
            setHints((previous) => {
                const next = [...previous, data.hint];
                setPuzzleHintSessionHints(queryClient, scope, userKey, request.puzzle.id, next);
                return next;
            });
        },
        onError: (error, request) => {
            if (!isCurrent(request)) return;
            pending.current = false;
            setHintError(
                error instanceof ApiError
                    ? error.message
                    : 'Could not reveal the next hint. Try again.'
            );
        },
    });
    const giveUpMutation = useMutation({
        mutationFn: (request: Request) => api.giveUp(request.token, request.puzzle.id),
        onSuccess: (data, request) => {
            if (!isCurrent(request)) return;
            pending.current = false;
            recordAttempt(data);
            if (data.gave_up || data.solved || data.correct) terminalResult(data, request);
            else setSubmitError('Something went wrong. Try again.');
        },
        onError: (error, request) => {
            if (!isCurrent(request)) return;
            pending.current = false;
            setSubmitError(
                error instanceof ApiError ? error.message : 'Something went wrong. Try again.'
            );
        },
    });
    const isPuzzleRequestPending =
        attemptMutation.isPending || hintMutation.isPending || giveUpMutation.isPending;
    const startRequest = (guess?: string): Request | null => {
        if (
            !puzzle ||
            completed ||
            localResult ||
            guestResult ||
            isPuzzleRequestPending ||
            pending.current
        )
            return null;
        pending.current = true;
        return {
            identity,
            puzzle,
            token,
            guess,
            opened_at: currentOpenedAt,
            incorrect_guesses: currentIncorrectGuesses,
            hints_used: totalHintsUsed,
        };
    };
    const interactionProps: PuzzleInteractionProps = {
        onSubmit: (guess) => {
            const request = startRequest(guess);
            if (request) attemptMutation.mutate(request);
        },
        onHint: () => {
            const request = startRequest();
            if (request) hintMutation.mutate(request);
        },
        onGiveUp: () => {
            const request = startRequest();
            if (request) {
                setSubmitError('');
                giveUpMutation.mutate(request);
            }
        },
        isSubmitting: isPuzzleRequestPending,
        isHinting: isPuzzleRequestPending,
        isGivingUp: giveUpMutation.isPending,
        submitError,
        hintError,
        hintsRevealed: hints,
        canHint: !!puzzle && totalHintsUsed < puzzle.total_hints,
    };
    const progressProps: PuzzleProgressProps & { draftOwner: string } = {
        draftOwner: owner,
        draftToken: token,
        progressMetadata: {
            opened_at: currentOpenedAt,
            incorrect_guesses: currentIncorrectGuesses,
            hint_used: totalHintsUsed,
            hints,
        },
        onRestoreProgress: (saved) => {
            setOpenedAt(saved.opened_at);
            setIncorrectGuesses(saved.incorrect_guesses);
            setHints(saved.hints);
            setHintBaseline(Math.max(0, saved.hint_used - saved.hints.length));
        },
    };
    return { localResult, guestResult, interactionProps, progressProps };
}
