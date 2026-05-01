import { apiRequest } from './client';
import { me } from './auth';
import {
    AttemptResponseSchema,
    HintResponseSchema,
    PuzzleCalendarEntrySchema,
    PuzzleResultSchema,
    PuzzleSchema,
    type AttemptResponse,
    type HintResponse,
    type Puzzle,
    type PuzzleCalendarEntry,
    type PuzzleResult,
} from './schemas';
import { z } from 'zod';

export async function today(token: string | null): Promise<Puzzle> {
    return apiRequest('/puzzle/today', PuzzleSchema, { token });
}

export async function attempt(
    token: string | null,
    puzzleId: number,
    guess: string,
    openedAt: string | null,
    incorrectGuesses: number,
    hintsUsed: number
): Promise<AttemptResponse> {
    return apiRequest('/puzzle/attempt', AttemptResponseSchema, {
        method: 'POST',
        token,
        body: {
            puzzle_id: puzzleId,
            guess,
            opened_at: openedAt,
            incorrect_guesses: incorrectGuesses,
            hints_used: hintsUsed,
        },
    });
}

export async function hint(token: string | null, puzzleId: number): Promise<HintResponse> {
    return apiRequest('/puzzle/hint', HintResponseSchema, {
        method: 'POST',
        token,
        body: { puzzle_id: puzzleId },
    });
}

export async function giveUp(token: string | null, puzzleId: number): Promise<AttemptResponse> {
    if (token) await me(token);

    return apiRequest('/puzzle/give-up', AttemptResponseSchema, {
        method: 'POST',
        token,
        body: { puzzle_id: puzzleId },
    });
}

export async function result(token: string | null): Promise<PuzzleResult> {
    return apiRequest('/puzzle/result', PuzzleResultSchema, { token });
}

export async function calendar(
    token: string | null,
    start: string,
    end: string
): Promise<PuzzleCalendarEntry[]> {
    const params = new URLSearchParams({ start, end });
    return apiRequest(`/puzzle/calendar?${params}`, z.array(PuzzleCalendarEntrySchema), { token });
}
