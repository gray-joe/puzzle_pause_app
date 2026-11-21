import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PuzzleSchema } from '../../api/schemas';
import { draftFingerprint, puzzleDraftRepository } from '../../lib/puzzleDrafts';
import {
    allText,
    changeText,
    findByHost,
    findPressableByText,
    press,
    render,
} from '../../test/render';
import { PuzzleRenderer, type PuzzleInteractionProps } from './PuzzleRenderer';

const props: PuzzleInteractionProps = {
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
        question: { prompt: 'Sudoku', grid: '0' + '1'.repeat(80) },
        field: 'digits',
        char: '2',
    },
    {
        type: 'crossword',
        question: {
            prompt: 'Crossword',
            layout: ['...', '.#.', '...'],
            clues: { across: { '1': 'Word' }, down: {} },
        },
        field: 'letters',
        char: 'A',
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
        field: 'letters',
        char: 'A',
    },
];
function puzzle(fixture: (typeof fixtures)[number]) {
    return PuzzleSchema.parse({
        id: 991,
        puzzle_type: fixture.type,
        puzzle_date: '2026-01-01',
        puzzle_number: 1,
        puzzle_name: 'Test',
        question: JSON.stringify(fixture.question),
        hint: null,
        has_hint: false,
        total_hints: 0,
    });
}
async function settle() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    const disk = new Map<string, string>();
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => disk.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
        disk.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
        disk.delete(key);
    });
});

describe('grid autosave', () => {
    for (const fixture of fixtures) {
        it(`restores ${fixture.type} after remount and saves erasures`, async () => {
            const p = puzzle(fixture);
            const mount = () => render(<PuzzleRenderer {...props} puzzle={p} draftOwner="guest" />);
            let view = mount();
            expect(allText(view)).not.toContain('Submit'); // hydration gate
            await settle();
            changeText(findByHost(view, 'TextInput'), fixture.char);
            await settle();
            const saved = await puzzleDraftRepository.load({ owner: 'guest', puzzleId: p.id });
            expect(JSON.stringify(saved?.fields)).toContain(fixture.char);
            act(() => view.unmount());
            view = mount();
            await settle();
            expect(allText(view)).toContain(fixture.char);
            act(() =>
                findByHost(view, 'TextInput').props.onKeyPress({
                    nativeEvent: { key: 'Backspace' },
                })
            );
            await settle();
            const erased = await puzzleDraftRepository.load({ owner: 'guest', puzzleId: p.id });
            expect(JSON.stringify(erased?.fields)).not.toContain(fixture.char);
            act(() => view.unmount());
        });
    }
    it('shows save failures without blocking play and retries on the next edit', async () => {
        const p = puzzle(fixtures[0]!);
        const view = render(<PuzzleRenderer {...props} puzzle={p} draftOwner="guest" />);
        await settle();
        vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
        changeText(findByHost(view, 'TextInput'), '2');
        await settle();
        expect(allText(view)).toContain('Progress could not be saved');
        changeText(findByHost(view, 'TextInput'), '3');
        await settle();
        expect(allText(view)).not.toContain('Progress could not be saved');
        expect(
            (await puzzleDraftRepository.load({ owner: 'guest', puzzleId: p.id }))?.fields.digits
        ).toEqual(['3', ...Array(80).fill('1')]);
        act(() => view.unmount());
    });

    it('does not overwrite storage while hydration is pending', async () => {
        const p = puzzle(fixtures[0]!);
        let release!: (value: string | null) => void;
        vi.mocked(AsyncStorage.getItem).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    release = resolve;
                })
        );
        const writesBefore = vi.mocked(AsyncStorage.setItem).mock.calls.length;
        const view = render(<PuzzleRenderer {...props} puzzle={p} draftOwner="guest" />);
        await settle();
        expect(vi.mocked(AsyncStorage.setItem).mock.calls.length).toBe(writesBefore);
        expect(allText(view)).not.toContain('Submit');
        release(null);
        await settle();
        expect(findPressableByText(view, 'Submit')).toBeDefined();
        act(() => view.unmount());
    });

    for (const fixture of fixtures) {
        it(`ignores invalid ${fixture.type} entries`, async () => {
            const p = puzzle(fixture);
            const fields =
                fixture.type === 'sudoku'
                    ? { digits: Array(81).fill('bad') }
                    : fixture.type === 'crossword'
                      ? { letters: Array(9).fill('bad') }
                      : { letters: { 1: 'B', 2: 'B' } }; // duplicate of a given
            await puzzleDraftRepository.save({
                owner: 'guest',
                puzzleId: p.id,
                version: 1,
                puzzleType: fixture.type,
                fingerprint: draftFingerprint(p),
                updatedAt: 'now',
                fields,
            });
            const view = render(<PuzzleRenderer {...props} puzzle={p} draftOwner="guest" />);
            await settle();
            expect(findPressableByText(view, 'Submit')?.props.disabled).toBe(true);
            act(() => view.unmount());
        });
    }

    it('ignores drafts for changed puzzle content and isolates accounts', async () => {
        const p = puzzle(fixtures[0]!);
        await puzzleDraftRepository.save({
            owner: 'guest',
            puzzleId: p.id,
            version: 1,
            puzzleType: 'sudoku',
            fingerprint: 'old grid',
            updatedAt: 'now',
            fields: { digits: ['9', ...Array(80).fill('1')] },
        });
        const view = render(<PuzzleRenderer {...props} puzzle={p} draftOwner="guest" />);
        await settle();
        expect(findPressableByText(view, 'Submit')?.props.disabled).toBe(true);
        act(() => view.update(<PuzzleRenderer {...props} puzzle={p} draftOwner="user:1" />));
        await settle();
        expect(findPressableByText(view, 'Submit')?.props.disabled).toBe(true);
        act(() => view.unmount());
    });
    it('rejects tampered givens and never submits progress automatically', async () => {
        const p = puzzle(fixtures[0]!);
        await puzzleDraftRepository.save({
            owner: 'guest',
            puzzleId: p.id,
            version: 1,
            puzzleType: 'sudoku',
            fingerprint: draftFingerprint(p),
            updatedAt: 'now',
            fields: { digits: Array(81).fill('2') },
        });
        const onSubmit = vi.fn();
        const view = render(
            <PuzzleRenderer {...props} onSubmit={onSubmit} puzzle={p} draftOwner="guest" />
        );
        await settle();
        expect(onSubmit).not.toHaveBeenCalled();
        expect(findPressableByText(view, 'Submit')?.props.disabled).toBe(true);
        changeText(findByHost(view, 'TextInput'), '2');
        press(findPressableByText(view, 'Submit')!);
        expect(onSubmit).toHaveBeenCalledWith('2' + '1'.repeat(80));
        act(() => view.unmount());
    });
});
