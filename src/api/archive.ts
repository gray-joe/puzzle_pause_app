import { z } from 'zod';
import { me } from './auth';
import { apiRequest } from './client';
import {
    ArchiveListItemSchema,
    AttemptResponseSchema,
    HintResponseSchema,
    PuzzleSchema,
    type ArchiveListItem,
    type AttemptResponse,
    type HintResponse,
    type Puzzle,
} from './schemas';

export async function list(
    token: string | null,
    opts: { limit?: number; offset?: number; status?: 'all' | 'solved' | 'unsolved' } = {}
): Promise<ArchiveListItem[]> {
    const params = new URLSearchParams();
    if (opts.limit != null) params.set('limit', String(opts.limit));
    if (opts.offset != null) params.set('offset', String(opts.offset));
    if (opts.status != null) params.set('status', opts.status);
    const qs = params.size > 0 ? `?${params}` : '';
    return apiRequest(`/archive${qs}`, z.array(ArchiveListItemSchema), { token });
}

export async function detail(token: string | null, id: number): Promise<Puzzle> {
    return apiRequest(`/archive/${id}`, PuzzleSchema, { token });
}

export async function attempt(
    token: string | null,
    id: number,
    guess: string,
    openedAt: string | null,
    incorrectGuesses: number,
    hintsUsed: number
): Promise<AttemptResponse> {
    return apiRequest(`/archive/${id}/attempt`, AttemptResponseSchema, {
        method: 'POST',
        token,
        body: {
            puzzle_id: id,
            guess,
            opened_at: openedAt,
            incorrect_guesses: incorrectGuesses,
            hints_used: hintsUsed,
        },
    });
}

export async function hint(token: string | null, id: number): Promise<HintResponse> {
    return apiRequest(`/archive/${id}/hint`, HintResponseSchema, {
        method: 'POST',
        token,
    });
}

export async function giveUp(token: string | null, id: number): Promise<AttemptResponse> {
    if (token) await me(token);

    return apiRequest(`/archive/${id}/give-up`, AttemptResponseSchema, {
        method: 'POST',
        token,
    });
}
