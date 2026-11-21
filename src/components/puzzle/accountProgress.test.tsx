import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as progressApi from '../../api/progress';
import { ApiError } from '../../api/client';
import { PuzzleSchema } from '../../api/schemas';
import {
    allText,
    changeText,
    findByHost,
    findPressableByText,
    press,
    render,
} from '../../test/render';
import { PuzzleRenderer, type PuzzleInteractionProps } from './PuzzleRenderer';

vi.mock('../../api/progress', async (original) => ({
    ...(await original<typeof progressApi>()),
    getProgress: vi.fn(),
    saveProgress: vi.fn(),
}));
const interaction: PuzzleInteractionProps = {
    onSubmit: vi.fn(),
    onHint: vi.fn(),
    onGiveUp: vi.fn(),
    isSubmitting: false,
    isHinting: false,
    isGivingUp: false,
    hintsRevealed: [],
    canHint: false,
};
const fixtures = [
    {
        type: 'sudoku',
        question: { prompt: 'Sudoku', grid: '0'.repeat(81) },
        entries: ['3', ...Array<string>(80).fill('')],
        edit: '4',
    },
    {
        type: 'crossword',
        question: {
            prompt: 'Crossword',
            layout: ['...', '.#.', '...'],
            clues: { across: { '1': 'Word' }, down: {} },
        },
        entries: ['C', ...Array<string>(8).fill('')],
        edit: 'D',
    },
    {
        type: 'codeword',
        question: {
            prompt: 'Codeword',
            cells: [
                [1, 2, 1],
                [2, 0, 1],
                [1, 2, 1],
            ],
            givens: { '2': 'B' },
        },
        entries: { '1': 'C', '2': 'B' },
        edit: 'D',
    },
];
const p = (fixture = fixtures[0]!) =>
    PuzzleSchema.parse({
        id: 71,
        puzzle_type: fixture.type,
        puzzle_date: '2026-01-01',
        puzzle_number: 1,
        puzzle_name: 'Test',
        question: JSON.stringify(fixture.question),
        hint: null,
        has_hint: false,
        total_hints: 0,
    });
function remote(fixture = fixtures[0]!) {
    return {
        version: 3,
        question: JSON.stringify(fixture.question),
        entries: fixture.entries,
        completed: false,
        opened_at: '2026-01-01T00:00:00',
        incorrect_guesses: 2,
        hint_used: 1,
        hint: 'A hint',
    };
}
async function flush() {
    await act(async () => {});
}
beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(progressApi.getProgress).mockReset();
    vi.mocked(progressApi.saveProgress).mockReset();
    const disk = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => disk.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
        disk.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
        disk.delete(key);
    });
});
afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('account progress grid integration', () => {
    for (const fixture of fixtures) {
        it(`restores, edits and syncs ${fixture.type} with the shared API`, async () => {
            const restored = remote(fixture);
            vi.mocked(progressApi.getProgress).mockResolvedValue(restored);
            vi.mocked(progressApi.saveProgress).mockResolvedValue({ ...restored, version: 4 });
            const onRestore = vi.fn();
            const view = render(
                <PuzzleRenderer
                    {...interaction}
                    puzzle={p(fixture)}
                    draftOwner="user:4"
                    draftToken="jwt"
                    onRestoreProgress={onRestore}
                />
            );
            expect(allText(view)).not.toContain('Submit');
            await flush();
            expect(allText(view)).toContain(fixture.type === 'sudoku' ? '3' : 'C');
            expect(onRestore).toHaveBeenLastCalledWith({
                opened_at: '2026-01-01T00:00:00Z',
                incorrect_guesses: 2,
                hint_used: 1,
                hints: ['A hint'],
            });
            changeText(findByHost(view, 'TextInput'), fixture.edit);
            await act(async () => {
                await vi.advanceTimersByTimeAsync(600);
            });
            const saved = vi.mocked(progressApi.saveProgress).mock.calls[0]!;
            expect(saved.slice(0, 4)).toEqual(['jwt', 71, 3, p(fixture).raw_question]);
            expect(JSON.stringify(saved[4])).toContain(fixture.edit);
            expect(allText(view)).toContain('Progress saved to your account');
            act(() => view.unmount());
        });
    }
    it('shows both conflict choices and remounts the grid with chosen account progress', async () => {
        const restored = remote();
        vi.mocked(progressApi.getProgress)
            .mockResolvedValueOnce(restored)
            .mockResolvedValue({
                ...restored,
                version: 5,
                entries: ['9', ...Array<string>(80).fill('')],
            });
        vi.mocked(progressApi.saveProgress).mockRejectedValue(new ApiError(409, 'stale', null));
        const view = render(
            <PuzzleRenderer {...interaction} puzzle={p()} draftOwner="user:4" draftToken="jwt" />
        );
        await flush();
        changeText(findByHost(view, 'TextInput'), '4');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(600);
        });
        expect(findPressableByText(view, 'Keep this device’s progress')).toBeDefined();
        expect(allText(view)).not.toContain('Submit');
        press(findPressableByText(view, 'Use account progress')!);
        await flush();
        expect(allText(view)).toContain('9');
        expect(allText(view)).toContain('Submit');
        act(() => view.unmount());
    });
    it('blocks remotely completed puzzles and offers reload', async () => {
        vi.mocked(progressApi.getProgress).mockResolvedValue({
            ...remote(),
            completed: true,
            entries: null,
        });
        const reload = vi.fn();
        const view = render(
            <PuzzleRenderer
                {...interaction}
                puzzle={p()}
                draftOwner="user:4"
                draftToken="jwt"
                onReloadProgress={reload}
            />
        );
        await flush();
        expect(allText(view)).toContain('Puzzle completed on another device');
        expect(allText(view)).not.toContain('Submit');
        press(findPressableByText(view, 'Reload puzzle')!);
        expect(reload).toHaveBeenCalledOnce();
        act(() => view.unmount());
    });
    it('retries on network reconnection and app resume and removes subscriptions on unmount', async () => {
        let reconnect!: (state: any) => void;
        let appState!: (state: any) => void;
        const unsubscribe = vi.fn();
        const remove = vi.fn();
        vi.mocked(NetInfo.addEventListener).mockImplementationOnce((listener) => {
            reconnect = listener;
            return unsubscribe;
        });
        vi.mocked(AppState.addEventListener).mockImplementationOnce((_event, listener) => {
            appState = listener;
            return { remove };
        });
        vi.mocked(progressApi.getProgress).mockResolvedValue(remote());
        const view = render(
            <PuzzleRenderer {...interaction} puzzle={p()} draftOwner="user:4" draftToken="jwt" />
        );
        await flush();
        await act(async () => {
            reconnect({ isConnected: true, isInternetReachable: true });
        });
        expect(progressApi.getProgress).toHaveBeenCalledTimes(2);
        await act(async () => {
            appState('active');
        });
        expect(progressApi.getProgress).toHaveBeenCalledTimes(3);
        act(() => view.unmount());
        expect(unsubscribe).toHaveBeenCalledOnce();
        expect(remove).toHaveBeenCalledOnce();
    });
});
