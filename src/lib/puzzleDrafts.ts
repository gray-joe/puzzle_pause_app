import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Puzzle } from '../api/schemas';

export type DraftIdentity = { owner: string; puzzleId: number };
export type ProgressMetadata = {
    opened_at: string | null;
    incorrect_guesses: number;
    hint_used: number;
    hints: string[];
};

export type PuzzleDraft = DraftIdentity & {
    version: 1;
    puzzleType: string;
    fingerprint: string;
    updatedAt: string;
    fields: Record<string, unknown>;
    metadata?: ProgressMetadata;
    sync?: { serverVersion: number | null; dirty: boolean; question: string | null };
};

// Keep the persisted envelope independent of React and API attempt/scoring state.
// A future sync layer can decorate this repository without changing puzzle views.
export interface PuzzleDraftRepository {
    load(identity: DraftIdentity): Promise<PuzzleDraft | null>;
    save(draft: PuzzleDraft): Promise<void>;
    remove(identity: DraftIdentity): Promise<void>;
}

export function draftIdentity(owner: string, puzzle: Puzzle): DraftIdentity {
    return { owner, puzzleId: puzzle.id };
}

export function draftFingerprint(puzzle: Puzzle): string {
    return JSON.stringify([puzzle.puzzle_type, puzzle.question]);
}

function key(identity: DraftIdentity) {
    return `pp_draft_v1:${encodeURIComponent(identity.owner)}:${identity.puzzleId}`;
}

// Serialize operations per puzzle: a slow write must not overwrite a newer edit
// or recreate a draft after completion. Reads also wait for outstanding writes.
const pending = new Map<string, Promise<unknown>>();
function enqueue<T>(storageKey: string, operation: () => Promise<T>): Promise<T> {
    const result = (pending.get(storageKey) ?? Promise.resolve()).catch(() => {}).then(operation);
    pending.set(storageKey, result);
    void result
        .finally(() => {
            if (pending.get(storageKey) === result) pending.delete(storageKey);
        })
        .catch(() => {});
    return result;
}

export const puzzleDraftRepository: PuzzleDraftRepository = {
    load(identity) {
        return enqueue(key(identity), async () => {
            const raw = await AsyncStorage.getItem(key(identity));
            if (!raw) return null;
            try {
                const value = JSON.parse(raw) as PuzzleDraft;
                if (
                    value?.version !== 1 ||
                    value.owner !== identity.owner ||
                    value.puzzleId !== identity.puzzleId ||
                    typeof value.puzzleType !== 'string' ||
                    typeof value.fingerprint !== 'string' ||
                    typeof value.updatedAt !== 'string' ||
                    !value.fields ||
                    typeof value.fields !== 'object' ||
                    Array.isArray(value.fields)
                )
                    return null;
                return value;
            } catch {
                return null;
            }
        });
    },
    save(draft) {
        return enqueue(key(draft), () => AsyncStorage.setItem(key(draft), JSON.stringify(draft)));
    },
    remove(identity) {
        return enqueue(key(identity), () => AsyncStorage.removeItem(key(identity)));
    },
};

export async function clearAccountPuzzleDrafts(userId: number) {
    const prefix = `pp_draft_v1:${encodeURIComponent(`user:${userId}`)}:`;
    const keys = new Set([...(await AsyncStorage.getAllKeys()), ...pending.keys()]);
    await Promise.all(
        [...keys]
            .filter((storageKey) => storageKey.startsWith(prefix))
            .map((storageKey) => enqueue(storageKey, () => AsyncStorage.removeItem(storageKey)))
    );
}

export function clearPuzzleDraft(owner: string, puzzleId: number) {
    return puzzleDraftRepository.remove({ owner, puzzleId });
}
