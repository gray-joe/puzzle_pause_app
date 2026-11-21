import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttemptResponse, CountdownPuzzle, Puzzle } from '../api/schemas';
import { allText, findPressableByText, press, render, update } from '../test/render';
import { CountdownPuzzleView } from '../components/puzzle/CountdownPuzzle';
import { usePuzzleSession } from './usePuzzleSession';
import { clearPuzzleDraft } from './puzzleDrafts';

const api = vi.hoisted(() => ({
    today: { attempt: vi.fn(), hint: vi.fn(), giveUp: vi.fn() },
    archive: { attempt: vi.fn(), hint: vi.fn(), giveUp: vi.fn() },
}));
vi.mock('../api/puzzle', () => api.today);
vi.mock('../api/archive', () => api.archive);
vi.mock('./puzzleDrafts', () => ({ clearPuzzleDraft: vi.fn(async () => {}) }));
vi.mock('./guestPuzzleState', () => ({
    getGuestPuzzleResult: () => null,
    getGuestPuzzleResultAsync: async () => null,
    setGuestPuzzleResult: vi.fn(),
}));
const puzzle = {
    id: 11,
    puzzle_date: '2026-05-07',
    puzzle_name: 'Word',
    puzzle_number: 42,
    puzzle_type: 'word',
    question: 'Guess it',
    total_hints: 3,
} as Puzzle;
const opened = '2026-05-07T10:00:00Z';
const response: AttemptResponse = {
    correct: false,
    solved: false,
    score: null,
    incorrect_guesses: 3,
    opened_at: opened,
};
const cleanups: (() => void)[] = [];
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
});
async function step(action: () => void) {
    await act(async () => {
        action();
        await new Promise((resolve) => setTimeout(resolve, 10));
    });
}
function mount(scope: 'today' | 'archive', renderCountdown = false) {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    let game!: ReturnType<typeof usePuzzleSession>;
    type Input = Parameters<typeof usePuzzleSession>[0];
    function Capture(props: Input) {
        game = usePuzzleSession(props);
        return renderCountdown && props.puzzle?.puzzle_type === 'countdown' ? (
            <CountdownPuzzleView
                puzzle={props.puzzle as CountdownPuzzle}
                {...game.interactionProps}
            />
        ) : null;
    }
    const props: Input = { puzzle, token: 'token', owner: 'user:42', scope };
    const element = (input: Input) => (
        <QueryClientProvider client={client}>
            <Capture {...input} />
        </QueryClientProvider>
    );
    const view = render(element(props));
    cleanups.push(() => {
        act(() => view.unmount());
        client.clear();
    });
    return {
        game: () => game,
        renderer: view,
        invalidate,
        change: (next: Partial<Input>) => update(view, element({ ...props, ...next })),
    };
}

describe.each(['today', 'archive'] as const)('%s shared gameplay lifecycle', (scope) => {
    it.each([false, true])(
        'forwards submission feedback for guest=%s and resets across identities',
        async (guest) => {
            const view = mount(scope);
            const grid = {
                ...puzzle,
                puzzle_type: 'sudoku',
                question: { prompt: '', grid: '0'.repeat(81) },
            } as Puzzle;
            view.change({
                puzzle: grid,
                token: guest ? null : 'token',
                owner: guest ? 'guest' : 'user:42',
            });
            api[scope].attempt.mockResolvedValueOnce({ ...response, error_cells: [0, 8] });
            await step(() => view.game().interactionProps.onSubmit('1'.repeat(81)));
            expect(view.game().interactionProps.gridFeedback).toEqual({
                guess: '1'.repeat(81),
                cells: [0, 8],
            });
            expect(view.game().interactionProps.submitError).toContain('Highlighted squares');
            view.change({ puzzle: { ...grid, id: 12 } });
            expect(view.game().interactionProps.gridFeedback).toBeUndefined();
        }
    );

    it.each([false, true])(
        'charges Countdown total once and submits expression tiles for guest=%s',
        async (guest) => {
            const calls = api[scope];
            const view = mount(scope, true);
            view.change({
                puzzle: {
                    ...puzzle,
                    puzzle_type: 'countdown',
                    question: {
                        prompt: 'Reach the target',
                        target: 306,
                        numbers: [75, 50, 6, 3, 2, 1],
                        operators: ['+', '-', '×', '÷'],
                    },
                    total_hints: 1,
                } as Puzzle,
                token: guest ? null : 'token',
                owner: guest ? 'guest' : 'user:42',
            });
            for (const tile of ['6', '×', '(', '50', '+', '1', ')'])
                press(findPressableByText(view.renderer, tile)!);
            expect(allText(view.renderer)).not.toContain('Total:');
            calls.hint.mockRejectedValueOnce(new Error('Offline'));
            await step(() => press(findPressableByText(view.renderer, 'Show total (-10 pts)')!));
            expect(allText(view.renderer)).not.toContain('Total:');
            expect(view.game().interactionProps.hintError).toContain('Could not reveal');
            expect(view.game().progressProps.progressMetadata?.hint_used).toBe(0);

            calls.hint.mockResolvedValueOnce({ hint: 'Running total enabled', total_hints: 1 });
            await step(() => {
                press(findPressableByText(view.renderer, 'Show total (-10 pts)')!);
                view.game().interactionProps.onHint();
            });
            expect(calls.hint).toHaveBeenCalledTimes(2);
            expect(calls.hint).toHaveBeenLastCalledWith(guest ? null : 'token', 11, 0);
            expect(allText(view.renderer)).toContain('Total: 306');
            expect(view.game().interactionProps.hintError).toBe('');
            expect(view.game().interactionProps.canHint).toBe(false);
            expect(findPressableByText(view.renderer, 'Show total (-10 pts)')).toBeUndefined();
            calls.attempt.mockResolvedValueOnce({
                ...response,
                correct: true,
                solved: true,
                score: scope === 'archive' ? 80 : 90,
            });
            await step(() => press(findPressableByText(view.renderer, 'Submit')!));
            expect(calls.attempt).toHaveBeenCalledWith(
                guest ? null : 'token',
                11,
                JSON.stringify(['6', '×', '(', '50', '+', '1', ')']),
                null,
                0,
                1
            );
            expect(view.game().localResult?.solved).toBe(true);
        }
    );

    it('restores progress, counts hints and mistakes, and keeps give-up timing', async () => {
        const calls = api[scope];
        calls.hint.mockResolvedValueOnce({ hint: 'Second hint' });
        calls.attempt.mockResolvedValueOnce(response);
        calls.giveUp.mockResolvedValueOnce({ ...response, gave_up: true, score: 0 });
        const view = mount(scope);
        act(() =>
            view.game().progressProps.onRestoreProgress!({
                opened_at: opened,
                incorrect_guesses: 2,
                hint_used: 1,
                hints: ['First hint'],
            })
        );
        await step(() => view.game().interactionProps.onHint!());
        expect(calls.hint).toHaveBeenCalledWith('token', 11, 1);
        expect(view.game().interactionProps.hintsRevealed).toEqual(['First hint', 'Second hint']);
        await step(() => view.game().interactionProps.onSubmit!('wrong'));
        expect(calls.attempt).toHaveBeenCalledWith('token', 11, 'wrong', opened, 2, 2);
        expect(view.game().interactionProps.submitError).toContain('Not quite');
        await step(() => view.game().interactionProps.onGiveUp!());
        expect(view.game().localResult?.gave_up).toBe(true);
        expect(view.game().progressProps.progressMetadata).toMatchObject({
            opened_at: opened,
            incorrect_guesses: 3,
            hint_used: 2,
        });
        expect(clearPuzzleDraft).toHaveBeenCalledWith('user:42', 11);
        expect(view.invalidate).toHaveBeenCalledWith({
            queryKey:
                scope === 'today'
                    ? ['puzzle', 'today', 'token']
                    : ['archive', 'detail', 11, 'token'],
        });
        expect(view.invalidate).toHaveBeenCalledWith({
            queryKey: ['calendar', 'completed', 'token'],
        });
    });

    it('uses opened_at returned by give-up even if it was not previously known', async () => {
        api[scope].giveUp.mockResolvedValueOnce({ ...response, gave_up: true, score: 0 });
        const view = mount(scope);
        expect(view.game().progressProps.progressMetadata?.opened_at).toBeNull();
        await step(() => view.game().interactionProps.onGiveUp!());
        expect(view.game().progressProps.progressMetadata?.opened_at).toBe(opened);
    });

    it('blocks duplicate requests and discards results for a previous account and puzzle', async () => {
        let resolve!: (value: AttemptResponse) => void;
        api[scope].giveUp.mockReturnValueOnce(
            new Promise<AttemptResponse>((done) => {
                resolve = done;
            })
        );
        const view = mount(scope);
        await step(() => {
            view.game().interactionProps.onGiveUp!();
            view.game().interactionProps.onGiveUp!();
        });
        expect(api[scope].giveUp).toHaveBeenCalledTimes(1);
        view.change({ puzzle: { ...puzzle, id: 12 }, token: 'new-token', owner: 'user:43' });
        await step(() => resolve({ ...response, gave_up: true, score: 0 }));
        expect(view.game().localResult).toBeNull();
        expect(clearPuzzleDraft).not.toHaveBeenCalled();
        expect(view.invalidate).not.toHaveBeenCalled();
        expect(view.game().progressProps.progressMetadata?.opened_at).toBeNull();
        api[scope].hint.mockResolvedValueOnce({ hint: 'New puzzle hint' });
        await step(() => view.game().interactionProps.onHint!());
        expect(api[scope].hint).toHaveBeenLastCalledWith('new-token', 12, 0);
        expect(view.game().interactionProps.hintsRevealed).toEqual(['New puzzle hint']);
    });
});
