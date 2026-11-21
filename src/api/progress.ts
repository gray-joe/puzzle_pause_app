import { z } from 'zod';
import { apiRequest } from './client';

export const ProgressEntriesSchema = z.union([
    z.array(z.string()),
    z.record(z.string(), z.string()),
]);
export type ProgressEntries = z.infer<typeof ProgressEntriesSchema>;
export const PuzzleProgressSchema = z.object({
    version: z.number().int().nonnegative(),
    question: z.string(),
    entries: ProgressEntriesSchema.nullable(),
    completed: z.boolean(),
    opened_at: z.string().nullable(),
    incorrect_guesses: z.number().int().nonnegative(),
    hint_used: z.union([z.boolean(), z.number().int().nonnegative()]).transform((v) => Number(v)),
    hint: z.string().nullable(),
});
export type PuzzleProgress = z.infer<typeof PuzzleProgressSchema>;

async function request(token: string, id: number, body?: unknown) {
    return apiRequest(`/puzzle/${id}/progress`, PuzzleProgressSchema, {
        method: body === undefined ? 'GET' : 'PUT',
        token,
        body,
    });
}

// Authenticated only. Never use attempt endpoints for partial grid saves.
export function getProgress(token: string, id: number) {
    return request(token, id);
}
export function saveProgress(
    token: string,
    id: number,
    version: number,
    question: string,
    entries: ProgressEntries
) {
    return request(token, id, { version, question, entries });
}
