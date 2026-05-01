import * as Sentry from '@sentry/react-native';
import * as SecureStore from 'expo-secure-store';
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
        setSession(null);
        queryClient.clear();
        await SecureStore.deleteItemAsync(JWT_KEY);
        if (token) logout(token).catch(() => {});
    }, []);

    useEffect(() => {
        registerUnauthorizedHandler(signOut);
    }, [signOut]);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const token = await SecureStore.getItemAsync(JWT_KEY);
                if (!token) return;
                const user = await me(token);
                setSession({ token, user });
            } catch (err) {
                if (err instanceof ApiError && err.status !== 401) return;
                await SecureStore.deleteItemAsync(JWT_KEY);
            } finally {
                setIsLoading(false);
            }
        };
        bootstrap();
    }, []);

    const signIn = useCallback(async (token: string, user: User) => {
        await SecureStore.setItemAsync(JWT_KEY, token);
        queryClient.clear();
        setSession({ token, user });
    }, []);

    return (
        <SessionContext.Provider value={{ session, isLoading, signIn, signOut }}>
            {children}
        </SessionContext.Provider>
    );
}
