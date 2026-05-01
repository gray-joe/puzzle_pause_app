import * as Sentry from '@sentry/react-native';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act } from 'react-test-renderer';
import { ApiError } from '../api/client';
import type { User } from '../api/schemas';
import { allText, findPressableByText, pressAsync, render } from '../test/render';
import { SessionProvider } from './SessionContext';
import { useSession } from './useSession';

const mocks = vi.hoisted(() => ({
    getItemAsync: vi.fn(),
    setItemAsync: vi.fn(),
    deleteItemAsync: vi.fn(),
    me: vi.fn(),
    logout: vi.fn(),
    queryClient: { clear: vi.fn() },
}));

vi.mock('expo-secure-store', () => ({
    getItemAsync: mocks.getItemAsync,
    setItemAsync: mocks.setItemAsync,
    deleteItemAsync: mocks.deleteItemAsync,
}));

vi.mock('../api/auth', () => ({
    me: mocks.me,
    logout: mocks.logout,
}));

vi.mock('../lib/queryClient', () => ({
    queryClient: mocks.queryClient,
}));

const user: User = { id: 7, email: 'user@example.com', display_name: 'Puzzle Friend' };

async function flushEffects() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

function Consumer() {
    const { session, isLoading, signIn, signOut } = useSession();
    return (
        <>
            <Text>{isLoading ? 'Loading' : `Ready: ${session?.user.email ?? 'none'}`}</Text>
            <Button title="Sign in" onPress={() => signIn('new-token', user)} />
            <Button title="Sign out" onPress={signOut} />
        </>
    );
}

function Text({ children }: { children: React.ReactNode }) {
    return React.createElement('Text', null, children);
}

function Button({ title, onPress }: { title: string; onPress: () => void | Promise<void> }) {
    return React.createElement('Pressable', { onPress }, React.createElement('Text', null, title));
}

describe('SessionProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getItemAsync.mockResolvedValue(null);
        mocks.setItemAsync.mockResolvedValue(undefined);
        mocks.deleteItemAsync.mockResolvedValue(undefined);
        mocks.logout.mockResolvedValue(undefined);
    });

    it('finishes bootstrap without a stored token', async () => {
        const renderer = render(
            <SessionProvider>
                <Consumer />
            </SessionProvider>
        );

        expect(allText(renderer)).toContain('Loading');

        await flushEffects();

        expect(mocks.getItemAsync).toHaveBeenCalledWith('pp_jwt');
        expect(mocks.me).not.toHaveBeenCalled();
        expect(allText(renderer)).toContain('Ready: none');
        expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    it('restores a stored token and sets the Sentry user', async () => {
        mocks.getItemAsync.mockResolvedValueOnce('stored-token');
        mocks.me.mockResolvedValueOnce(user);

        const renderer = render(
            <SessionProvider>
                <Consumer />
            </SessionProvider>
        );

        await flushEffects();

        expect(mocks.me).toHaveBeenCalledWith('stored-token');
        expect(allText(renderer)).toContain('Ready: user@example.com');
        expect(Sentry.setUser).toHaveBeenCalledWith({ id: '7' });
    });

    it('deletes stored tokens after unauthorized bootstrap failures', async () => {
        mocks.getItemAsync.mockResolvedValueOnce('expired-token');
        mocks.me.mockRejectedValueOnce(new ApiError(401, 'Unauthorized', null));

        const renderer = render(
            <SessionProvider>
                <Consumer />
            </SessionProvider>
        );

        await flushEffects();

        expect(mocks.deleteItemAsync).toHaveBeenCalledWith('pp_jwt');
        expect(allText(renderer)).toContain('Ready: none');
    });

    it('keeps stored tokens after non-authorization bootstrap failures', async () => {
        mocks.getItemAsync.mockResolvedValueOnce('stored-token');
        mocks.me.mockRejectedValueOnce(new ApiError(500, 'Server error', null));

        const renderer = render(
            <SessionProvider>
                <Consumer />
            </SessionProvider>
        );

        await flushEffects();

        expect(mocks.deleteItemAsync).not.toHaveBeenCalled();
        expect(allText(renderer)).toContain('Ready: none');
    });

    it('stores tokens and clears cached data on sign in', async () => {
        const renderer = render(
            <SessionProvider>
                <Consumer />
            </SessionProvider>
        );
        await flushEffects();

        await pressAsync(findPressableByText(renderer, 'Sign in')!);

        expect(mocks.setItemAsync).toHaveBeenCalledWith('pp_jwt', 'new-token');
        expect(mocks.queryClient.clear).toHaveBeenCalled();
        expect(allText(renderer)).toContain('Ready: user@example.com');
    });

    it('clears stored tokens, cached data, Sentry user, and logs out on sign out', async () => {
        mocks.getItemAsync.mockResolvedValueOnce('stored-token');
        mocks.me.mockResolvedValueOnce(user);
        const renderer = render(
            <SessionProvider>
                <Consumer />
            </SessionProvider>
        );
        await flushEffects();

        await pressAsync(findPressableByText(renderer, 'Sign out')!);
        await flushEffects();

        expect(mocks.deleteItemAsync).toHaveBeenCalledWith('pp_jwt');
        expect(mocks.queryClient.clear).toHaveBeenCalled();
        expect(mocks.logout).toHaveBeenCalledWith('stored-token');
        expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
        expect(allText(renderer)).toContain('Ready: none');
    });

    it('does not call logout when signing out without a token', async () => {
        const renderer = render(
            <SessionProvider>
                <Consumer />
            </SessionProvider>
        );
        await flushEffects();

        await pressAsync(findPressableByText(renderer, 'Sign out')!);

        expect(mocks.deleteItemAsync).toHaveBeenCalledWith('pp_jwt');
        expect(mocks.logout).not.toHaveBeenCalled();
    });
});

describe('useSession', () => {
    it('throws outside a SessionProvider', () => {
        function BrokenConsumer() {
            useSession();
            return null;
        }

        expect(() => render(<BrokenConsumer />)).toThrow(
            'useSession must be used within SessionProvider'
        );
    });
});
