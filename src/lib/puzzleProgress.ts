import { ApiError } from '../api/client';
import {
    getProgress,
    saveProgress,
    type ProgressEntries,
    type PuzzleProgress,
} from '../api/progress';
import type { CodewordPuzzle, CrosswordPuzzle, Puzzle, SudokuPuzzle } from '../api/schemas';
import {
    draftFingerprint,
    draftIdentity,
    puzzleDraftRepository,
    type ProgressMetadata,
    type PuzzleDraft,
    type PuzzleDraftRepository,
} from './puzzleDrafts';

export function validProgressEntries(puzzle: Puzzle, entries: unknown): entries is ProgressEntries {
    if (puzzle.puzzle_type === 'sudoku') {
        const grid = (puzzle as SudokuPuzzle).question.grid;
        return (
            Array.isArray(entries) &&
            entries.length === 81 &&
            entries.every(
                (ch, i) =>
                    typeof ch === 'string' &&
                    (grid[i] === '0' ? /^[1-9]?$/.test(ch) : ch === grid[i])
            )
        );
    }
    if (puzzle.puzzle_type === 'crossword') {
        const layout = (puzzle as CrosswordPuzzle).question.layout.join('');
        return (
            Array.isArray(entries) &&
            entries.length === layout.length &&
            entries.every(
                (ch, i) =>
                    typeof ch === 'string' && (layout[i] === '#' ? ch === '' : /^[A-Z]?$/.test(ch))
            )
        );
    }
    if (
        puzzle.puzzle_type !== 'codeword' ||
        !entries ||
        typeof entries !== 'object' ||
        Array.isArray(entries)
    )
        return false;
    const { cells, givens } = (puzzle as CodewordPuzzle).question;
    const codes = new Set(cells.flat().filter(Boolean).map(String));
    const record = entries as Record<string, unknown>;
    const values = Object.values(record);
    return (
        Object.entries(record).every(
            ([code, ch]) => codes.has(code) && typeof ch === 'string' && /^[A-Z]$/.test(ch)
        ) &&
        new Set(values).size === values.length &&
        Object.entries(givens).every(([code, ch]) => record[code] === ch.toUpperCase())
    );
}

function validMetadata(value: ProgressMetadata | undefined): value is ProgressMetadata {
    return (
        !!value &&
        (value.opened_at === null ||
            (typeof value.opened_at === 'string' &&
                Number.isFinite(Date.parse(value.opened_at)))) &&
        Number.isInteger(value.incorrect_guesses) &&
        value.incorrect_guesses >= 0 &&
        Number.isInteger(value.hint_used) &&
        value.hint_used >= 0 &&
        Array.isArray(value.hints) &&
        value.hints.every((hint) => typeof hint === 'string')
    );
}

export type ProgressSnapshot = {
    ready: boolean;
    fields: Record<string, unknown>;
    generation: number;
    status: string;
    conflict: PuzzleProgress | null;
    blocked: boolean;
};
type Options = {
    puzzle: Puzzle;
    owner: string;
    token?: string | null;
    metadata: ProgressMetadata;
    onRestore?: (metadata: ProgressMetadata) => void;
    onChange: (snapshot: ProgressSnapshot) => void;
    repository?: PuzzleDraftRepository;
    api?: { get: typeof getProgress; save: typeof saveProgress };
};

/** Local-first outbox for one mounted puzzle/owner. Server versions are CAS tokens,
 * not timestamps. No automatic conflict overwrite, and no scoring writes here. */
export class PuzzleProgressSession {
    private draft: PuzzleDraft;
    private repository: PuzzleDraftRepository;
    private api: { get: typeof getProgress; save: typeof saveProgress };
    private alive = true;
    private busy = false;
    private needsRefresh = true;
    private timer?: ReturnType<typeof setTimeout>;
    private snapshot: ProgressSnapshot = {
        ready: false,
        fields: {},
        generation: 0,
        status: '',
        conflict: null,
        blocked: false,
    };

    constructor(private options: Options) {
        this.repository = options.repository ?? puzzleDraftRepository;
        this.api = options.api ?? { get: getProgress, save: saveProgress };
        this.draft = {
            ...draftIdentity(options.owner, options.puzzle),
            version: 1,
            puzzleType: options.puzzle.puzzle_type,
            fingerprint: draftFingerprint(options.puzzle),
            updatedAt: new Date().toISOString(),
            fields: {},
            metadata: {
                ...options.metadata,
                opened_at: options.metadata.opened_at ?? new Date().toISOString(),
            },
            sync: {
                serverVersion: null,
                dirty: false,
                question: options.puzzle.raw_question ?? null,
            },
        };
    }
    private emit(change: Partial<ProgressSnapshot>) {
        if (!this.alive) return;
        this.snapshot = { ...this.snapshot, ...change };
        this.options.onChange(this.snapshot);
    }
    private entries() {
        return this.draft.fields[
            this.options.puzzle.puzzle_type === 'sudoku' ? 'digits' : 'letters'
        ];
    }
    private setEntries(entries: ProgressEntries | null) {
        this.draft = {
            ...this.draft,
            fields:
                entries === null
                    ? {}
                    : {
                          [this.options.puzzle.puzzle_type === 'sudoku' ? 'digits' : 'letters']:
                              entries,
                      },
        };
    }
    private async persist() {
        try {
            await this.repository.save(this.draft);
            return true;
        } catch {
            return false;
        }
    }
    private metadata(remote: PuzzleProgress): ProgressMetadata {
        const opened = remote.opened_at;
        return {
            opened_at: opened
                ? /Z$|[+-]\d\d:\d\d$/.test(opened)
                    ? opened
                    : `${opened}Z`
                : this.draft.metadata!.opened_at,
            incorrect_guesses: remote.incorrect_guesses,
            hint_used: remote.hint_used,
            hints:
                remote.hint_used === this.draft.metadata?.hint_used &&
                this.draft.metadata.hints.length
                    ? this.draft.metadata.hints
                    : remote.hint
                      ? [remote.hint]
                      : [],
        };
    }
    private restoreMetadata(metadata: ProgressMetadata) {
        this.draft = { ...this.draft, metadata };
        this.options.onRestore?.(metadata);
    }
    private compatible(remote: PuzzleProgress) {
        // Production puzzle responses retain the exact question string. Older fixtures
        // without it can still use local drafts but cannot sync an unknown question.
        return this.options.puzzle.raw_question === remote.question;
    }
    private async reconcile(remote: PuzzleProgress) {
        if (!this.alive) return false;
        if (remote.completed || !this.compatible(remote)) {
            this.emit({
                conflict: remote,
                blocked: true,
                status: remote.completed
                    ? 'Puzzle completed on another device. Reload to see the result.'
                    : 'Puzzle has changed. Reload before continuing.',
            });
            if (remote.completed) await this.repository.remove(this.draft).catch(() => {});
            return false;
        }
        if (remote.entries !== null && !validProgressEntries(this.options.puzzle, remote.entries))
            throw new Error('Invalid account progress');
        const sync = this.draft.sync!;
        if (
            sync.dirty &&
            sync.serverVersion !== remote.version &&
            (remote.entries !== null || sync.serverVersion !== null)
        ) {
            this.emit({
                conflict: remote,
                status: 'Progress changed on another device. Choose which copy to keep.',
            });
            return false;
        }
        // Initial load is gated. On later retries don't rewind penalties/hints
        // obtained on this device while the network request was in flight.
        const metadata = this.metadata(remote);
        if (this.snapshot.ready) {
            metadata.incorrect_guesses = Math.max(
                metadata.incorrect_guesses,
                this.draft.metadata!.incorrect_guesses
            );
            if (metadata.hint_used < this.draft.metadata!.hint_used) {
                metadata.hint_used = this.draft.metadata!.hint_used;
                metadata.hints = this.draft.metadata!.hints;
            }
        }
        this.restoreMetadata(metadata);
        this.draft = {
            ...this.draft,
            sync: { ...sync, serverVersion: remote.version, question: remote.question },
        };
        if (!sync.dirty) {
            this.setEntries(remote.entries);
            this.emit({ fields: this.draft.fields, generation: this.snapshot.generation + 1 });
        }
        return true;
    }
    async load() {
        let readFailed = false;
        try {
            const stored = await this.repository.load(this.draft);
            if (!this.alive) return;
            if (
                stored?.fingerprint === this.draft.fingerprint &&
                stored.puzzleType === this.draft.puzzleType
            ) {
                const field =
                    stored.fields[
                        this.options.puzzle.puzzle_type === 'sudoku' ? 'digits' : 'letters'
                    ];
                if (field === undefined || validProgressEntries(this.options.puzzle, field)) {
                    const sync = stored.sync;
                    const validSync =
                        sync &&
                        typeof sync.dirty === 'boolean' &&
                        (sync.serverVersion === null ||
                            (Number.isInteger(sync.serverVersion) && sync.serverVersion >= 0)) &&
                        (sync.question === null || typeof sync.question === 'string');
                    this.draft = {
                        ...this.draft,
                        fields: stored.fields,
                        metadata: validMetadata(stored.metadata)
                            ? stored.metadata
                            : this.draft.metadata,
                        // Legacy local-only drafts become pending uploads, not discarded.
                        sync: validSync
                            ? sync
                            : { ...this.draft.sync!, dirty: field !== undefined },
                    };
                }
            }
        } catch {
            readFailed = true;
        }
        if (!this.alive) return;
        let status = readFailed
            ? 'Progress could not be saved on this device. Keep the app open and retry.'
            : 'Progress saves automatically on this device.';
        if (this.options.token) {
            try {
                const remote = await this.api.get(this.options.token, this.options.puzzle.id);
                if (!this.alive) return;
                this.needsRefresh = false;
                if (await this.reconcile(remote)) status = 'Progress restored from your account.';
            } catch {
                this.needsRefresh = true;
                status = 'Account sync unavailable. Progress will be saved on this device.';
            }
        }
        if (!this.alive) return;
        if (!this.snapshot.blocked) {
            this.options.onRestore?.(this.draft.metadata!);
            const saved = await this.persist();
            if (!saved)
                status = 'Progress could not be saved on this device. Keep the app open and retry.';
        }
        this.emit({
            ready: true,
            fields: this.draft.fields,
            status: this.snapshot.conflict ? this.snapshot.status : status,
        });
        if (this.draft.sync!.dirty) this.schedule();
    }
    change(field: string, value: unknown) {
        if (!this.alive || !this.snapshot.ready || this.snapshot.blocked || this.snapshot.conflict)
            return;
        this.draft = {
            ...this.draft,
            updatedAt: new Date().toISOString(),
            fields: { ...this.draft.fields, [field]: value },
            sync: { ...this.draft.sync!, dirty: true },
        };
        void this.persist().then((saved) => {
            if (!this.snapshot.conflict)
                this.emit({
                    status: saved
                        ? this.options.token
                            ? 'Saved on this device. Syncing…'
                            : 'Progress saved on this device.'
                        : 'Progress could not be saved on this device. Keep the app open and retry.',
                });
        });
        this.schedule();
    }
    updateMetadata(metadata: ProgressMetadata) {
        if (
            !this.alive ||
            !this.snapshot.ready ||
            this.snapshot.blocked ||
            !validMetadata(metadata)
        )
            return;
        metadata = {
            ...metadata,
            opened_at: metadata.opened_at ?? this.draft.metadata!.opened_at,
            incorrect_guesses: Math.max(
                metadata.incorrect_guesses,
                this.draft.metadata!.incorrect_guesses
            ),
            ...(metadata.hint_used < this.draft.metadata!.hint_used
                ? {
                      hint_used: this.draft.metadata!.hint_used,
                      hints: this.draft.metadata!.hints,
                  }
                : {}),
        };
        if (JSON.stringify(metadata) === JSON.stringify(this.draft.metadata)) return;
        this.draft = { ...this.draft, metadata };
        void this.persist().then((saved) => {
            if (!saved && !this.snapshot.conflict)
                this.emit({
                    status: 'Progress could not be saved on this device. Keep the app open and retry.',
                });
        });
    }
    private schedule() {
        clearTimeout(this.timer);
        if (this.alive && this.options.token) this.timer = setTimeout(() => void this.sync(), 600);
    }
    async retry() {
        this.needsRefresh = true;
        await this.sync();
    }
    async sync() {
        if (
            !this.alive ||
            !this.snapshot.ready ||
            this.busy ||
            this.snapshot.conflict ||
            this.snapshot.blocked ||
            !this.options.token
        )
            return;
        if (!this.draft.sync!.dirty && !this.needsRefresh) return;
        this.busy = true;
        this.emit({ status: 'Saving…' });
        try {
            if (this.needsRefresh || this.draft.sync!.serverVersion === null) {
                const remote = await this.api.get(this.options.token, this.options.puzzle.id);
                if (!this.alive) return;
                this.needsRefresh = false;
                if (!(await this.reconcile(remote))) return;
            }
            const entries = this.entries();
            if (!this.draft.sync!.dirty || !validProgressEntries(this.options.puzzle, entries)) {
                await this.persist();
                this.emit({ status: 'Progress restored from your account.' });
                return;
            }
            const sent = JSON.stringify(entries);
            const remote = await this.api.save(
                this.options.token,
                this.options.puzzle.id,
                this.draft.sync!.serverVersion!,
                this.draft.sync!.question!,
                entries
            );
            if (!this.alive) return;
            this.draft = {
                ...this.draft,
                sync: {
                    ...this.draft.sync!,
                    serverVersion: remote.version,
                    dirty: JSON.stringify(this.entries()) !== sent,
                },
            };
            const saved = await this.persist();
            this.emit({
                status: this.draft.sync!.dirty
                    ? 'Saving…'
                    : saved
                      ? 'Progress saved to your account and this device.'
                      : 'Progress saved to your account.',
            });
            if (this.draft.sync!.dirty) this.schedule();
        } catch (error) {
            if (!this.alive) return;
            if (error instanceof ApiError && error.status === 409) {
                try {
                    const remote = await this.api.get(this.options.token, this.options.puzzle.id);
                    if (!this.alive) return;
                    this.emit({
                        conflict: remote,
                        blocked: remote.completed || !this.compatible(remote),
                        status: remote.completed
                            ? 'Puzzle completed on another device. Reload to see the result.'
                            : !this.compatible(remote)
                              ? 'Puzzle has changed. Reload before continuing.'
                              : 'Progress changed on another device. Choose which copy to keep.',
                    });
                    if (remote.completed) await this.repository.remove(this.draft).catch(() => {});
                } catch {
                    this.needsRefresh = true;
                    this.emit({
                        status: 'Unable to sync. Your local copy is kept; retry when connected.',
                    });
                }
            } else {
                // A timed-out PUT may have committed. Always re-fetch its version
                // before retrying; never blindly overwrite another device's draft.
                this.needsRefresh = true;
                const saved = await this.persist();
                this.emit({
                    status: saved
                        ? 'Saved on this device. Account sync unavailable; retry when connected.'
                        : 'Unable to save progress. Keep the app open and retry.',
                });
            }
        } finally {
            this.busy = false;
        }
    }
    async resolveConflict(useServer: boolean) {
        const remote = this.snapshot.conflict;
        if (!this.alive || !remote || this.snapshot.blocked) return;
        if (remote.entries !== null && !validProgressEntries(this.options.puzzle, remote.entries))
            return;
        if (useServer) this.setEntries(remote.entries);
        this.restoreMetadata(this.metadata(remote));
        this.draft = {
            ...this.draft,
            sync: { serverVersion: remote.version, question: remote.question, dirty: !useServer },
        };
        this.needsRefresh = false;
        this.emit({
            conflict: null,
            fields: this.draft.fields,
            generation: this.snapshot.generation + 1,
            status: useServer
                ? 'Progress restored from your account.'
                : 'Saving this device’s progress…',
        });
        await this.persist();
        if (!useServer) await this.sync();
    }
    dispose() {
        this.alive = false;
        clearTimeout(this.timer);
    }
}
