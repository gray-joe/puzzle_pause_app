import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ConnectionsPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: ConnectionsPuzzle } & PuzzleInteractionProps;

export function ConnectionsPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const groupCount = getGroupCount(puzzle);
    const [selectedGroup, setSelectedGroup] = useState(0);
    const [assignments, setAssignments] = useState<Array<number | null>>(() =>
        puzzle.question.items.map(() => null)
    );

    useEffect(() => {
        setSelectedGroup((prev) => Math.min(prev, Math.max(groupCount - 1, 0)));
    }, [groupCount]);
    const { colors, spacing, typography } = useTheme();
    const isComplete = assignments.every((group) => group != null);

    const groupLabels = Array.from({ length: groupCount }, (_, index) =>
        getGroupLabel(puzzle, hintsRevealed, index)
    );

    const assignItem = (itemIndex: number) => {
        setAssignments((prev) =>
            prev.map((group, index) => (index === itemIndex ? selectedGroup : group))
        );
    };

    const handleSubmit = () => {
        if (!isComplete) return;
        const groups = Array.from({ length: groupCount }, (_, groupIndex) =>
            assignments
                .map((group, itemIndex) => (group === groupIndex ? itemIndex : null))
                .filter((itemIndex): itemIndex is number => itemIndex != null)
                .sort((a, b) => a - b)
                .join(',')
        );
        onSubmit(groups.join('|'));
    };

    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <Text
                    style={[typography.body, { color: colors.text, fontSize: 21, lineHeight: 30 }]}
                >
                    {puzzle.question.prompt}
                </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>Groups</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {groupLabels.map((label, index) => (
                        <GroupButton
                            key={index}
                            label={label}
                            count={assignments.filter((group) => group === index).length}
                            selected={selectedGroup === index}
                            disabled={isSubmitting}
                            onPress={() => setSelectedGroup(index)}
                        />
                    ))}
                </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {puzzle.question.items.map((item, index) => {
                    const assignedGroup = assignments[index];
                    return (
                        <ItemButton
                            key={index}
                            label={item}
                            assignedLabel={
                                assignedGroup == null ? undefined : groupLabels[assignedGroup]
                            }
                            selected={assignedGroup === selectedGroup}
                            disabled={isSubmitting}
                            onPress={() => assignItem(index)}
                        />
                    );
                })}
            </View>

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

            {!!submitError && (
                <Text style={[typography.caption, { color: colors.error }]}>{submitError}</Text>
            )}

            <View style={{ gap: spacing.sm }}>
                <Button
                    title="Submit"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={!isComplete}
                />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}

function getGroupCount(puzzle: ConnectionsPuzzle): number {
    const categoryCount = puzzle.question.categories?.length;
    if (categoryCount) return categoryCount;
    if (puzzle.total_hints >= 2 && puzzle.question.items.length % puzzle.total_hints === 0) {
        return puzzle.total_hints;
    }
    const promptCategoryCount = puzzle.question.prompt.match(/\b(\d+)\s+categor(?:y|ies)\b/i);
    if (promptCategoryCount?.[1]) {
        const parsedCount = Number(promptCategoryCount[1]);
        if (parsedCount >= 2 && puzzle.question.items.length % parsedCount === 0)
            return parsedCount;
    }
    return 3;
}

function getGroupLabel(puzzle: ConnectionsPuzzle, hintsRevealed: string[], index: number): string {
    return hintsRevealed[index] ?? puzzle.question.categories?.[index] ?? `Group ${index + 1}`;
}

function GroupButton({
    label,
    count,
    selected,
    disabled,
    onPress,
}: {
    label: string;
    count: number;
    selected: boolean;
    disabled: boolean;
    onPress: () => void;
}) {
    const { colors, spacing, typography } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => ({
                minWidth: '30%',
                flexGrow: 1,
                gap: spacing.xs,
                padding: spacing.sm,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary : colors.surface,
                opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            })}
        >
            <Text style={[typography.body, { color: selected ? colors.primaryText : colors.text }]}>
                {label}
            </Text>
            <Text
                style={[
                    typography.caption,
                    { color: selected ? colors.primaryText : colors.textMuted },
                ]}
            >
                {count} selected
            </Text>
        </Pressable>
    );
}

function ItemButton({
    label,
    assignedLabel,
    selected,
    disabled,
    onPress,
}: {
    label: string;
    assignedLabel?: string;
    selected: boolean;
    disabled: boolean;
    onPress: () => void;
}) {
    const { colors, spacing, typography } = useTheme();

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => ({
                width: '30%',
                flexGrow: 1,
                minHeight: 70,
                justifyContent: 'center',
                gap: spacing.xs,
                padding: spacing.sm,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: colors.surface,
                opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
            })}
        >
            <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>
                {label}
            </Text>
            {assignedLabel ? (
                <Text
                    style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}
                >
                    {assignedLabel}
                </Text>
            ) : null}
        </Pressable>
    );
}
