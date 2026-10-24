import { useState, type ReactNode } from 'react';
import { TextInput as RNTextInput, Text, View } from 'react-native';
import type { NumberSquarePuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { GridPuzzleFrame } from './grid';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: NumberSquarePuzzle } & PuzzleInteractionProps;
type Question = NumberSquarePuzzle['question'];

const OP_LABELS: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const CELL = 52;
const GAP = 28;

/** 3×3 equation grid. Editable when `onChange` is given; otherwise a read-only answer view. */
export function NumberSquareBoard({
    question,
    values,
    onChange,
    editable = true,
}: {
    question: Question;
    values: string[];
    onChange?: (index: number, value: string) => void;
    editable?: boolean;
}) {
    const { colors, typography } = useTheme();
    const symbol = (text: string | number) => (
        <Text
            style={[typography.title, { width: GAP, textAlign: 'center', color: colors.textMuted }]}
        >
            {text}
        </Text>
    );
    const box = {
        width: CELL,
        height: CELL,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        textAlign: 'center' as const,
        textAlignVertical: 'center' as const,
    };
    const spacerRow = (render: (c: number) => ReactNode) => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {[0, 1, 2].map((c) => (
                <View key={c} style={{ flexDirection: 'row' }}>
                    <View style={{ width: CELL, alignItems: 'center' }}>{render(c)}</View>
                    {c < 2 && <View style={{ width: GAP }} />}
                </View>
            ))}
        </View>
    );

    return (
        <View style={{ alignSelf: 'center' }}>
            {[0, 1, 2].map((r) => (
                <View key={r}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {[0, 1, 2].map((c) => {
                            const index = r * 3 + c;
                            const given = question.cells[index];
                            return (
                                <View
                                    key={c}
                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                >
                                    {given == null && onChange ? (
                                        <RNTextInput
                                            accessibilityLabel={`Row ${r + 1} column ${c + 1}`}
                                            value={values[index]}
                                            onChangeText={(text) =>
                                                onChange(index, text.replace(/\D/g, '').slice(0, 2))
                                            }
                                            keyboardType="number-pad"
                                            maxLength={2}
                                            editable={editable}
                                            style={[
                                                typography.title,
                                                box,
                                                {
                                                    color: colors.primary,
                                                    padding: 0,
                                                    includeFontPadding: false,
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <Text
                                            style={[
                                                typography.title,
                                                box,
                                                {
                                                    lineHeight: CELL - 2,
                                                    color:
                                                        given == null
                                                            ? colors.primary
                                                            : colors.text,
                                                    fontWeight: given == null ? '400' : '700',
                                                },
                                            ]}
                                        >
                                            {given ?? values[index]}
                                        </Text>
                                    )}
                                    {c < 2 && symbol(OP_LABELS[question.row_ops[r]![c]!]!)}
                                </View>
                            );
                        })}
                        {symbol('=')}
                        <Text style={[typography.title, { color: colors.text }]}>
                            {question.row_results[r]}
                        </Text>
                    </View>
                    {spacerRow((c) => symbol(r < 2 ? OP_LABELS[question.col_ops[c]![r]!]! : '='))}
                </View>
            ))}
            {spacerRow((c) => (
                <Text style={[typography.title, { color: colors.text }]}>
                    {question.col_results[c]}
                </Text>
            ))}
        </View>
    );
}

export function NumberSquarePuzzleView({ puzzle, onSubmit, ...rest }: Props) {
    const { question } = puzzle;
    const [values, setValues] = useState<string[]>(() =>
        question.cells.map((cell) => (cell == null ? '' : String(cell)))
    );

    const canSubmit = values.every(Boolean);
    const handleSubmit = () => {
        if (canSubmit) onSubmit(values.map(Number).join(','));
    };

    return (
        <GridPuzzleFrame
            puzzleNumber={puzzle.puzzle_number}
            puzzleName={puzzle.puzzle_name}
            prompt={question.prompt}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            {...rest}
        >
            <NumberSquareBoard
                question={question}
                values={values}
                editable={!rest.isSubmitting}
                onChange={(index, value) =>
                    setValues((prev) => prev.map((v, i) => (i === index ? value : v)))
                }
            />
        </GridPuzzleFrame>
    );
}
