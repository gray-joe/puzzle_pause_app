import { Text, View } from 'react-native';
import { useTheme } from '../../theme';

export function UnsupportedPuzzle() {
    const { colors, spacing, typography } = useTheme();
    return (
        <View
            style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
            }}
        >
            <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>
                Today's puzzle isn't supported in the app yet. Play it on web at puzzlepause.app, or
                browse the Archive for a puzzle you can play here.
            </Text>
        </View>
    );
}
