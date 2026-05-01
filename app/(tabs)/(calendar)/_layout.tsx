import { Stack } from 'expo-router';

export default function CalendarStackLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="puzzle" />
        </Stack>
    );
}
