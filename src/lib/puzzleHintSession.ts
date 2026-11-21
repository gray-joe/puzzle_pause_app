import type { QueryClient } from '@tanstack/react-query';

type PuzzleHintScope = 'today' | 'archive';

function hintsKey(scope: PuzzleHintScope, userKey: string, puzzleId: number) {
    return ['puzzle', scope, 'hints', userKey, puzzleId] as const;
}

function baselineKey(scope: PuzzleHintScope, userKey: string, puzzleId: number) {
    return ['puzzle', scope, 'hint-baseline', userKey, puzzleId] as const;
}

export function getPuzzleHintSession(
    queryClient: QueryClient,
    scope: PuzzleHintScope,
    userKey: string,
    puzzleId: number,
    serverHintCount: number,
    revealedHint?: string | null
): { hints: string[]; baseline: number } {
    const cachedHints =
        queryClient.getQueryData<string[]>(hintsKey(scope, userKey, puzzleId)) ?? [];
    const serverHints = revealedHint ? revealedHint.split('|') : [];
    const storedBaseline = queryClient.getQueryData<number>(baselineKey(scope, userKey, puzzleId));
    const cachedOffset = storedBaseline ?? 0;
    // Server text starts at hint zero; cached text may start after an earlier server-only count.
    // Merge overlapping sequential histories by position, not by text (hints may repeat).
    const canMerge = serverHints.length > 0 && serverHints.length >= cachedOffset;
    const hints = canMerge
        ? [...serverHints, ...cachedHints.slice(Math.max(0, serverHints.length - cachedOffset))]
        : cachedHints;
    queryClient.setQueryData(hintsKey(scope, userKey, puzzleId), hints);
    const baseline = canMerge
        ? Math.max(0, serverHintCount - hints.length)
        : Math.max(cachedOffset, serverHintCount - hints.length, 0);

    if (storedBaseline !== baseline) {
        queryClient.setQueryData(baselineKey(scope, userKey, puzzleId), baseline);
    }

    return { hints, baseline };
}

export function setPuzzleHintSessionHints(
    queryClient: QueryClient,
    scope: PuzzleHintScope,
    userKey: string,
    puzzleId: number,
    hints: string[]
): void {
    queryClient.setQueryData(hintsKey(scope, userKey, puzzleId), hints);
}
