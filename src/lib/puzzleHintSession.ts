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
    serverHintCount: number
): { hints: string[]; baseline: number } {
    const hints = queryClient.getQueryData<string[]>(hintsKey(scope, userKey, puzzleId)) ?? [];
    const storedBaseline = queryClient.getQueryData<number>(baselineKey(scope, userKey, puzzleId));
    const baseline = Math.max(storedBaseline ?? 0, serverHintCount - hints.length, 0);

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
