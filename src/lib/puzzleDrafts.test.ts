import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    puzzleDraftRepository as repository,
    clearAccountPuzzleDrafts,
    type PuzzleDraft,
} from './puzzleDrafts';

const identity = { owner: 'user:42', puzzleId: 3 };
const draft: PuzzleDraft = {
    ...identity,
    version: 1,
    puzzleType: 'sudoku',
    fingerprint: 'grid',
    updatedAt: '2026-01-01',
    fields: { digits: ['1', ''] },
};
let disk: Map<string, string>;
beforeEach(() => {
    disk = new Map();
    vi.mocked(AsyncStorage.getAllKeys).mockImplementation(async () => [...disk.keys()]);
    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key) => disk.get(key) ?? null);
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
        disk.set(key, value);
    });
    vi.mocked(AsyncStorage.removeItem).mockImplementation(async (key) => {
        disk.delete(key);
    });
});

describe('puzzle draft repository', () => {
    it('persists a versioned draft and isolates accounts, guests and puzzles', async () => {
        await repository.save(draft);
        expect(await repository.load(identity)).toEqual(draft);
        expect(await repository.load({ ...identity, owner: 'guest' })).toBeNull();
        expect(await repository.load({ ...identity, owner: 'user:43' })).toBeNull();
        expect(await repository.load({ ...identity, puzzleId: 4 })).toBeNull();
    });
    it('deletes only the requested account’s drafts', async () => {
        await repository.save(draft);
        await repository.save({ ...draft, puzzleId: 4 });
        await repository.save({ ...draft, owner: 'user:420' });
        await repository.save({ ...draft, owner: 'guest' });
        disk.set('unrelated-preference', 'keep');
        await clearAccountPuzzleDrafts(42);
        expect(await repository.load(identity)).toBeNull();
        expect(await repository.load({ ...identity, puzzleId: 4 })).toBeNull();
        expect(await repository.load({ ...identity, owner: 'user:420' })).not.toBeNull();
        expect(await repository.load({ ...identity, owner: 'guest' })).not.toBeNull();
        expect(disk.get('unrelated-preference')).toBe('keep');
    });
    it('also deletes account drafts whose first write is still queued', async () => {
        let release!: () => void;
        vi.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
            await new Promise<void>((resolve) => {
                release = resolve;
            });
            disk.set(key, value);
        });
        const writing = repository.save(draft);
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        const deleting = clearAccountPuzzleDrafts(42);
        release();
        await Promise.all([writing, deleting]);
        expect(await repository.load(identity)).toBeNull();
    });
    it('discards corrupted and incompatible records', async () => {
        for (const value of [
            'invalid',
            'null',
            JSON.stringify({ ...draft, version: 2 }),
            JSON.stringify({ ...draft, fields: [] }),
        ]) {
            vi.mocked(AsyncStorage.getItem).mockResolvedValueOnce(value);
            expect(await repository.load(identity)).toBeNull();
        }
    });
    it('orders edits and terminal deletion even when a write is slow', async () => {
        let release!: () => void;
        vi.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
            await new Promise<void>((resolve) => {
                release = resolve;
            });
            disk.set(key, value);
        });
        const first = repository.save(draft);
        const second = repository.save({ ...draft, fields: { digits: ['2'] } });
        const removed = repository.remove(identity);
        await vi.waitFor(() => expect(release).toBeTypeOf('function'));
        release();
        await Promise.all([first, second, removed]);
        expect(await repository.load(identity)).toBeNull();
    });
    it('recovers after a storage failure', async () => {
        vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
        await expect(repository.save(draft)).rejects.toThrow('disk full');
        await repository.save(draft);
        expect(await repository.load(identity)).toEqual(draft);
    });
});
