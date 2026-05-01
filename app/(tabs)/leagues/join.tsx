import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import * as leaguesApi from '../../../src/api/leagues';
import { ApiError } from '../../../src/api/client';
import { useSession } from '../../../src/auth/useSession';
import { Button } from '../../../src/components/Button';
import { GuestPrompt } from '../../../src/components/GuestPrompt';
import { Screen } from '../../../src/components/Screen';
import { TextInput } from '../../../src/components/TextInput';
import { useTheme } from '../../../src/theme';

export default function JoinLeagueScreen() {
    const { session } = useSession();
    const token = session?.token ?? null;
    const { colors, spacing, typography } = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [code, setCode] = useState('');
    const [error, setError] = useState('');

    const mutation = useMutation({
        mutationFn: () => leaguesApi.join(token!, code.trim()),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['leagues', 'list', token!] });
            router.replace(`/leagues/${data.id}` as never);
        },
        onError: (err) => {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
        },
    });

    const handleSubmit = () => {
        const trimmed = code.trim();
        if (!trimmed) {
            setError('Invite code is required.');
            return;
        }
        setError('');
        mutation.mutate();
    };

    if (!session) {
        return <GuestPrompt message="Sign in to join leagues and compete with friends." />;
    }

    return (
        <Screen scrollable padded>
            <View style={{ gap: spacing.lg }}>
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.heading, { color: colors.text }]}>Join a league</Text>
                    <Text style={[typography.body, { color: colors.textMuted }]}>
                        Enter the invite code shared with you.
                    </Text>
                </View>
                <TextInput
                    label="Invite code"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus
                    error={error}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="done"
                />
                <Button title="Join league" onPress={handleSubmit} loading={mutation.isPending} />
            </View>
        </Screen>
    );
}
