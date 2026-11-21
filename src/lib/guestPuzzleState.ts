import * as SecureStore from 'expo-secure-store';
import type { AttemptResponse, Puzzle } from '../api/schemas';

const STORAGE_KEY = 'pp_guest_puzzle_states_v1';

type LocalStorageLike = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
};

type GuestPuzzleRecord = {
    id: number;
    puzzle_date: string;
    puzzle_name: string;
    puzzle_number: number;
    completed: true;
    result: AttemptResponse;
};

type GuestPuzzleState = {
    puzzles: Record<string, GuestPuzzleRecord>;
};

let memoryState: GuestPuzzleState = { puzzles: {} };
let deviceLoad: Promise<void> | null = null;
let pendingWrite = Promise.resolve();

function getStorage(): LocalStorageLike | null {
    const storage = (globalThis as { localStorage?: LocalStorageLike }).localStorage;
    if (
        !storage ||
        typeof storage.getItem !== 'function' ||
        typeof storage.setItem !== 'function'
    ) {
        return null;
    }
    return storage;
}

function parseState(raw: string | null): GuestPuzzleState {
    if (!raw) return { puzzles: {} };

    const parsed = JSON.parse(raw) as Partial<GuestPuzzleState>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.puzzles !== 'object') {
        return { puzzles: {} };
    }

    return { puzzles: parsed.puzzles ?? {} };
}

function readBrowserState(): GuestPuzzleState | null {
    const storage = getStorage();
    if (!storage) return null;

    try {
        return parseState(storage.getItem(STORAGE_KEY));
    } catch {
        return null;
    }
}

function readState(): GuestPuzzleState {
    const browserState = readBrowserState();
    if (browserState) {
        memoryState = browserState;
    }
    return memoryState;
}

async function readStateAsync(): Promise<GuestPuzzleState> {
    const browserState = readBrowserState();
    if (browserState) {
        memoryState = browserState;
        return browserState;
    }

    deviceLoad ??= SecureStore.getItemAsync(STORAGE_KEY)
        .then((raw) => {
            const deviceState = parseState(raw);
            // Completions made while loading are newer than the saved snapshot.
            memoryState = { puzzles: { ...deviceState.puzzles, ...memoryState.puzzles } };
        })
        .catch(() => {});
    await deviceLoad;
    return memoryState;
}

function writeBrowserState(state: GuestPuzzleState): void {
    const storage = getStorage();
    if (!storage) return;

    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Persistence is best-effort; gameplay should continue if storage is unavailable.
    }
}

function writeState(state: GuestPuzzleState): void {
    memoryState = state;
    writeBrowserState(state);
    if (!getStorage()) {
        pendingWrite = pendingWrite
            .catch(() => {})
            .then(async () => {
                await readStateAsync();
                await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(memoryState));
            })
            .catch(() => {});
    }
}

export function getGuestPuzzleResult(puzzleId: number): AttemptResponse | null {
    const record = readState().puzzles[String(puzzleId)];
    return record?.completed ? record.result : null;
}

export async function getGuestPuzzleResultAsync(puzzleId: number): Promise<AttemptResponse | null> {
    const record = (await readStateAsync()).puzzles[String(puzzleId)];
    return record?.completed ? record.result : null;
}

export function isGuestPuzzleCompleted(puzzleId: number): boolean {
    const result = getGuestPuzzleResult(puzzleId);
    return result?.correct === true || result?.solved === true;
}

export function setGuestPuzzleResult(puzzle: Puzzle, result: AttemptResponse): void {
    if (!result.correct && !result.solved) return;

    const state = readState();
    state.puzzles[String(puzzle.id)] = {
        id: puzzle.id,
        puzzle_date: puzzle.puzzle_date,
        puzzle_name: puzzle.puzzle_name,
        puzzle_number: puzzle.puzzle_number,
        completed: true,
        result: {
            ...result,
            answer: result.answer ?? puzzle.answer,
            explanation: result.explanation ?? puzzle.explanation,
        },
    };
    writeState(state);
}

export function getGuestCompletedDates(start: string, end: string): string[] {
    return Object.values(readState().puzzles)
        .filter((record) => record.result.correct || record.result.solved)
        .map((record) => record.puzzle_date)
        .filter((date) => date >= start && date <= end)
        .sort();
}

export async function getGuestCompletedDatesAsync(start: string, end: string): Promise<string[]> {
    return Object.values((await readStateAsync()).puzzles)
        .filter((record) => record.result.correct || record.result.solved)
        .map((record) => record.puzzle_date)
        .filter((date) => date >= start && date <= end)
        .sort();
}

export async function getGuestCompletedPuzzleIds(): Promise<Set<number>> {
    return new Set(
        Object.values((await readStateAsync()).puzzles)
            .filter((record) => record.result.correct || record.result.solved)
            .map((record) => record.id)
    );
}

export function clearGuestPuzzleStateForTest(): void {
    memoryState = { puzzles: {} };
    deviceLoad = null;
    pendingWrite = Promise.resolve();
}
