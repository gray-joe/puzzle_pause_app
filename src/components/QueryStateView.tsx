import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';

type Props = {
    isLoading: boolean;
    error?: Error | null;
    isEmpty?: boolean;
    emptyMessage?: string;
    onRetry?: () => void;
    children: ReactNode;
};

export function QueryStateView({
    isLoading,
    error,
    isEmpty,
    emptyMessage,
    onRetry,
    children,
}: Props) {
    const { colors, spacing, typography } = useTheme();

    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.md,
                    padding: spacing.lg,
                }}
            >
                <Text style={[typography.body, { color: colors.error, textAlign: 'center' }]}>
                    {error.message || 'Something went wrong.'}
                </Text>
                {onRetry ? (
                    <Button title="Try again" variant="secondary" onPress={onRetry} />
                ) : null}
            </View>
        );
    }

    if (isEmpty) {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: spacing.lg,
                }}
            >
                <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
                    {emptyMessage ?? 'Nothing here yet.'}
                </Text>
            </View>
        );
    }

    return <>{children}</>;
}
