import { Stack } from 'expo-router';
import { useTheme } from '../../../src/theme';

export default function ArchiveStackLayout() {
    const { colors } = useTheme();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.primary,
                headerTitleStyle: { color: colors.text },
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
            }}
        >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="[id]" dangerouslySingular={() => 'archive-detail'} />
        </Stack>
    );
}
