import { Text, View, type ViewStyle } from 'react-native';
import type { CompletionStatsFormatted } from '../lib/puzzleAnswer';
import { useTheme } from '../theme';

type Props = {
    stats: CompletionStatsFormatted | null | undefined;
    style?: ViewStyle;
};

export function PuzzleCompletionStats({ stats, style }: Props) {
    const { colors, spacing, typography } = useTheme();

    if (!stats) return null;

    return (
        <View style={[{ gap: spacing.xs }, style]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
                Solved by: {stats.solvedBy}
            </Text>
            {stats.averageScore != null && (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Average score: {stats.averageScore}
                </Text>
            )}
            {stats.averageTime != null && (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Average time taken: {stats.averageTime}
                </Text>
            )}
        </View>
    );
}
