import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

type Props = {
    children: ReactNode;
    scrollable?: boolean;
    padded?: boolean;
    style?: ViewStyle;
    refreshing?: boolean;
    onRefresh?: () => void;
};

export function Screen({
    children,
    scrollable = false,
    padded = true,
    style,
    refreshing = false,
    onRefresh,
}: Props) {
    const { colors, spacing } = useTheme();
    const innerStyle: ViewStyle = {
        flex: 1,
        padding: padded ? spacing.md : 0,
        ...style,
    };

    if (scrollable) {
        return (
            <SafeAreaView
                style={{ flex: 1, backgroundColor: colors.background }}
                edges={['top', 'left', 'right']}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, padding: padded ? spacing.md : 0 }}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        onRefresh ? (
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                tintColor={colors.primary}
                            />
                        ) : undefined
                    }
                >
                    <View style={{ flex: 1, ...style }}>{children}</View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView
            style={{ flex: 1, backgroundColor: colors.background }}
            edges={['top', 'left', 'right']}
        >
            <View style={innerStyle}>{children}</View>
        </SafeAreaView>
    );
}
