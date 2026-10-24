import { forwardRef, type ReactNode } from 'react';
import { Pressable, TextInput as RNTextInput, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../Button';

export type GridCell = {
    black?: boolean;
    value?: string;
    label?: string | number;
    given?: boolean;
    selected?: boolean;
    highlighted?: boolean;
};

const MAX_CELL = 44;
const CELL_GAP = 2;

/** Square grid of cells, shrunk to fit the screen width. `groupSize` adds a wider gap between blocks (sudoku boxes). */
export function GridBoard({
    cols,
    cells,
    onPressCell,
    groupSize,
}: {
    cols: number;
    cells: GridCell[];
    onPressCell?: (index: number) => void;
    groupSize?: number;
}) {
    const { colors, spacing, scheme } = useTheme();
    const { width } = useWindowDimensions();
    const groupGap = groupSize ? spacing.xs : 0;
    const groups = groupSize ? cols / groupSize - 1 : 0;
    const available = width - spacing.md * 2 - groups * groupGap;
    const size = Math.min(MAX_CELL, Math.floor(available / cols) - CELL_GAP);
    const rows: GridCell[][] = [];
    for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));

    return (
        <View style={{ alignSelf: 'center' }}>
            {rows.map((row, r) => (
                <View
                    key={r}
                    style={{
                        flexDirection: 'row',
                        marginBottom: groupSize && (r + 1) % groupSize === 0 ? groupGap : 0,
                    }}
                >
                    {row.map((cell, c) => {
                        const index = r * cols + c;
                        const background = cell.black
                            ? scheme === 'dark'
                                ? '#000000'
                                : colors.text
                            : cell.highlighted
                              ? `${colors.primary}33`
                              : colors.surface;
                        return (
                            <Pressable
                                key={c}
                                accessibilityLabel={
                                    cell.black ? 'Black square' : `Row ${r + 1} column ${c + 1}`
                                }
                                disabled={!onPressCell || cell.black}
                                onPress={() => onPressCell?.(index)}
                                style={{
                                    width: size,
                                    height: size,
                                    margin: CELL_GAP / 2,
                                    marginRight:
                                        CELL_GAP / 2 +
                                        (groupSize && (c + 1) % groupSize === 0 && c + 1 < cols
                                            ? groupGap
                                            : 0),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 3,
                                    borderWidth: cell.selected ? 2 : cell.black ? 0 : 1,
                                    borderColor: cell.selected ? colors.primary : colors.border,
                                    backgroundColor: background,
                                }}
                            >
                                {cell.label != null && !cell.black && (
                                    <Text
                                        style={{
                                            position: 'absolute',
                                            top: 1,
                                            left: 2,
                                            fontSize: Math.max(7, size * 0.26),
                                            color: colors.textMuted,
                                        }}
                                    >
                                        {cell.label}
                                    </Text>
                                )}
                                {!cell.black && (
                                    <Text
                                        style={{
                                            fontSize: size * 0.55,
                                            fontWeight: cell.given ? '700' : '400',
                                            color: cell.given ? colors.text : colors.primary,
                                        }}
                                    >
                                        {cell.value ?? ''}
                                    </Text>
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

/**
 * Invisible input that drives a grid from the native keyboard. It stays empty: typed characters
 * arrive via onChar, and Backspace (which fires even on an empty field) via onBackspace.
 */
export const GridKeyInput = forwardRef<
    RNTextInput,
    {
        onChar: (char: string) => void;
        onBackspace: () => void;
        numeric?: boolean;
        editable?: boolean;
    }
>(function GridKeyInput({ onChar, onBackspace, numeric, editable }, ref) {
    return (
        <RNTextInput
            ref={ref}
            value=""
            onChangeText={(text) => [...text].forEach((char) => onChar(char.toUpperCase()))}
            onKeyPress={(event) => {
                if (event.nativeEvent.key === 'Backspace') onBackspace();
            }}
            keyboardType={numeric ? 'number-pad' : 'default'}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="done"
            editable={editable}
            caretHidden
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />
    );
});

/** Header, prompt, hints, error and Submit/Hint buttons shared by the grid puzzle types. */
export function GridPuzzleFrame({
    puzzleNumber,
    puzzleName,
    prompt,
    children,
    hintsRevealed,
    submitError,
    canSubmit,
    onSubmit,
    isSubmitting,
    canHint,
    onHint,
    isHinting,
}: {
    puzzleNumber: number;
    puzzleName: string;
    prompt: string;
    children: ReactNode;
    hintsRevealed: string[];
    submitError?: string;
    canSubmit: boolean;
    onSubmit: () => void;
    isSubmitting: boolean;
    canHint: boolean;
    onHint: () => void;
    isHinting: boolean;
}) {
    const { colors, spacing, typography } = useTheme();
    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzleNumber} · {puzzleName}
                </Text>
                {!!prompt && (
                    <Text style={[typography.body, { color: colors.text, lineHeight: 22 }]}>
                        {prompt}
                    </Text>
                )}
            </View>

            {children}

            {hintsRevealed.length > 0 && (
                <View
                    style={{
                        gap: spacing.xs,
                        padding: spacing.sm,
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                    }}
                >
                    {hintsRevealed.map((hint, index) => (
                        <Text key={index} style={[typography.caption, { color: colors.textMuted }]}>
                            Hint: {hint}
                        </Text>
                    ))}
                </View>
            )}

            <View style={{ gap: spacing.sm }}>
                {!!submitError && (
                    <Text style={[typography.caption, { color: colors.error }]}>{submitError}</Text>
                )}
                <Button
                    title="Submit"
                    onPress={onSubmit}
                    loading={isSubmitting}
                    disabled={!canSubmit}
                />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}
