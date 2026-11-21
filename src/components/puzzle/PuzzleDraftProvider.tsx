import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type ReactNode,
    type SetStateAction,
} from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { Puzzle } from '../../api/schemas';
import type { ProgressMetadata } from '../../lib/puzzleDrafts';
import { PuzzleProgressSession, type ProgressSnapshot } from '../../lib/puzzleProgress';
import { Button } from '../Button';
import { useTheme } from '../../theme';

const DraftContext = createContext<{
    fields: Record<string, unknown>;
    save: (field: string, value: unknown) => void;
} | null>(null);

export type PuzzleProgressProps = {
    draftToken?: string | null;
    progressMetadata?: ProgressMetadata;
    onRestoreProgress?: (metadata: ProgressMetadata) => void;
    onReloadProgress?: () => void;
};

export function PuzzleDraftProvider({
    puzzle,
    owner,
    children,
    draftToken,
    progressMetadata,
    onRestoreProgress,
    onReloadProgress,
}: {
    puzzle: Puzzle;
    owner: string;
    children: ReactNode;
} & PuzzleProgressProps) {
    const { colors, typography } = useTheme();
    const latest = useRef({ progressMetadata, onRestoreProgress });
    latest.current = { progressMetadata, onRestoreProgress };
    const session = useRef<PuzzleProgressSession | null>(null);
    const [snapshot, setSnapshot] = useState<ProgressSnapshot>({
        ready: false,
        fields: {},
        generation: 0,
        status: '',
        conflict: null,
        blocked: false,
    });
    useEffect(() => {
        const controller = new PuzzleProgressSession({
            puzzle,
            owner,
            token: draftToken,
            metadata: latest.current.progressMetadata ?? {
                opened_at: puzzle.attempt?.opened_at ?? null,
                incorrect_guesses: puzzle.attempt?.incorrect_guesses ?? 0,
                hint_used: puzzle.attempt?.hint_used ?? 0,
                hints: puzzle.revealed_hint ? [puzzle.revealed_hint] : [],
            },
            onRestore: (metadata) => latest.current.onRestoreProgress?.(metadata),
            onChange: setSnapshot,
        });
        session.current = controller;
        void controller.load();
        const appState = AppState.addEventListener('change', (state) => {
            if (state === 'active') void controller.retry();
            else void controller.sync();
        });
        const unsubscribe = draftToken
            ? NetInfo.addEventListener((state) => {
                  if (state.isConnected && state.isInternetReachable !== false)
                      void controller.retry();
              })
            : () => {};
        return () => {
            controller.dispose();
            appState.remove();
            unsubscribe();
        };
    }, []); // Parent keys this boundary by owner/token/puzzle/question.
    useEffect(() => {
        if (progressMetadata && snapshot.ready) session.current?.updateMetadata(progressMetadata);
    }, [progressMetadata, snapshot.ready]);

    return (
        <View style={{ gap: 8 }}>
            {snapshot.status ? (
                <Text
                    accessibilityLiveRegion="polite"
                    style={[typography.caption, { color: colors.textMuted }]}
                >
                    {snapshot.status}
                </Text>
            ) : null}
            {snapshot.conflict && !snapshot.blocked && (
                <View style={{ gap: 8 }}>
                    <Button
                        title="Use account progress"
                        onPress={() => void session.current?.resolveConflict(true)}
                    />
                    <Button
                        title="Keep this device’s progress"
                        variant="secondary"
                        onPress={() => void session.current?.resolveConflict(false)}
                    />
                </View>
            )}
            {snapshot.blocked && onReloadProgress && (
                <Button title="Reload puzzle" onPress={onReloadProgress} />
            )}
            {draftToken && snapshot.ready && !snapshot.conflict && (
                <Button
                    title="Retry sync"
                    variant="secondary"
                    onPress={() => void session.current?.retry()}
                />
            )}
            {snapshot.ready ? (
                !snapshot.conflict && (
                    <View>
                        <DraftContext.Provider
                            key={snapshot.generation}
                            value={{
                                fields: snapshot.fields,
                                save: (field, value) => session.current?.change(field, value),
                            }}
                        >
                            {children}
                        </DraftContext.Provider>
                    </View>
                )
            ) : (
                <ActivityIndicator accessibilityLabel="Restoring puzzle progress" />
            )}
        </View>
    );
}

export function useDraftState<T>(
    field: string,
    initial: () => T,
    restore: (value: unknown) => T | undefined
): [T, (next: SetStateAction<T>) => void] {
    const context = useContext(DraftContext);
    const [value, setValue] = useState<T>(() => restore(context?.fields[field]) ?? initial());
    const current = useRef(value);
    const update = (next: SetStateAction<T>) => {
        const resolved =
            typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
        current.current = resolved;
        setValue(resolved);
        context?.save(field, resolved);
    };
    return [value, update];
}
