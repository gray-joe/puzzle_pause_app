import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';

type Props = {
    isLoading: boolean;
    error?: Error | null;
    isEmpty?: boolean;
    hasData?: boolean;
    emptyMessage?: string;
    onRetry?: () => void;
    children: ReactNode;
};

export function QueryStateView({
    isLoading,
    error,
    isEmpty,
    hasData = false,
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

    if (error && !hasData) {
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

    return (
        <>
            {error && (
                <View style={{ gap: spacing.sm }}>
                    <Text
                        accessibilityRole="alert"
                        style={[typography.body, { color: colors.error }]}
                    >
                        {error.message ||
                            'Could not refresh. Your current puzzle is still available.'}
                    </Text>
                    {onRetry && (
                        <Button title="Retry refresh" variant="secondary" onPress={onRetry} />
                    )}
                </View>
            )}
            {children}
        </>
    );
}
