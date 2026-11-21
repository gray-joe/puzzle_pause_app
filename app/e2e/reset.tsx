import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useSession } from '../../src/auth/useSession';
import { clearGuestPuzzleStateForTest } from '../../src/lib/guestPuzzleState';
import { queryClient } from '../../src/lib/queryClient';

// This route is inert in normal builds. It deliberately does not reset backend data.
export default function E2EResetScreen() {
    if (process.env.EXPO_PUBLIC_APP_ENV !== 'e2e') return <Redirect href="/" />;
    return <Reset />;
}

function Reset() {
    const { signOut } = useSession();
    const router = useRouter();
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        async function reset() {
            await signOut();
            await SecureStore.deleteItemAsync('pp_guest_puzzle_states_v1');
            const draftKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
                key.startsWith('pp_draft_v1:')
            );
            if (draftKeys.length) await AsyncStorage.multiRemove(draftKeys);
            clearGuestPuzzleStateForTest();
            queryClient.clear();
            if (active) router.replace('/');
        }
        reset().catch((err: unknown) => {
            if (active) setError(String(err));
        });
        return () => {
            active = false;
        };
    }, [signOut, router]);

    return <Text>{error || 'Resetting E2E state…'}</Text>;
}
