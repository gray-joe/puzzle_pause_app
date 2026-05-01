import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '../src/auth/SessionContext';
import { useSession } from '../src/auth/useSession';
import { queryClient } from '../src/lib/queryClient';

const navigationIntegration = Sentry.reactNavigationIntegration();

Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
    integrations: [navigationIntegration],
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    sendDefaultPii: false,
});

function AuthGate() {
    const { session, isLoading } = useSession();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;
        const inAuthGroup = segments[0] === '(auth)';
        if (session && inAuthGroup) {
            router.replace('/');
        }
    }, [session, isLoading, segments]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
            </View>
        );
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}

function RootLayout() {
    const navigationRef = useNavigationContainerRef();

    useEffect(() => {
        if (navigationRef.current) {
            navigationIntegration.registerNavigationContainer(navigationRef);
        }
    }, [navigationRef]);

    return (
        <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
                <SessionProvider>
                    <AuthGate />
                </SessionProvider>
                <StatusBar style="auto" />
            </SafeAreaProvider>
        </QueryClientProvider>
    );
}

export default Sentry.wrap(RootLayout);
