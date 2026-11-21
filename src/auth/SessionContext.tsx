import * as Sentry from '@sentry/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { logout, me } from '../api/auth';
import { ApiError, registerUnauthorizedHandler } from '../api/client';
import type { User } from '../api/schemas';
import { queryClient } from '../lib/queryClient';

const JWT_KEY = 'pp_jwt';

type Session = { token: string; user: User };

export type SessionContextValue = {
    session: Session | null;
    isLoading: boolean;
    signIn: (token: string, user: User) => Promise<void>;
    signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const tokenRef = useRef<string | null>(null);

    useEffect(() => {
        tokenRef.current = session?.token ?? null;
    }, [session]);

    useEffect(() => {
        Sentry.setUser(session ? { id: String(session.user.id) } : null);
    }, [session]);

    const signOut = useCallback(async () => {
        const token = tokenRef.current;
        // Only the server can clear the browser's HttpOnly session cookie.
        if (Platform.OS === 'web' && token) await logout(token);
        tokenRef.current = null;
        setSession(null);
        queryClient.clear();
        if (Platform.OS !== 'web') {
            await SecureStore.deleteItemAsync(JWT_KEY);
            if (token) logout(token).catch(() => {});
        }
    }, []);

    useEffect(() => {
        registerUnauthorizedHandler((failedToken) => {
            if (failedToken === tokenRef.current) void signOut().catch(() => {});
        });
        return () => registerUnauthorizedHandler(null);
    }, [signOut]);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                // Browser auth uses the backend cookie; no token is stored in JavaScript storage.
                const token =
                    Platform.OS === 'web'
                        ? 'cookie-session'
                        : await SecureStore.getItemAsync(JWT_KEY);
                if (!token) return;
                const user = await me(token);
                tokenRef.current = token;
                setSession({ token, user });
            } catch (err) {
                if (Platform.OS !== 'web' && err instanceof ApiError && err.status === 401) {
                    await SecureStore.deleteItemAsync(JWT_KEY);
                }
            } finally {
                setIsLoading(false);
            }
        };
        bootstrap();
    }, []);

    const signIn = useCallback(async (token: string, user: User) => {
        if (Platform.OS !== 'web') await SecureStore.setItemAsync(JWT_KEY, token);
        queryClient.clear();
        tokenRef.current = token;
        setSession({ token, user });
    }, []);

    return (
        <SessionContext.Provider value={{ session, isLoading, signIn, signOut }}>
            {children}
        </SessionContext.Provider>
    );
}
