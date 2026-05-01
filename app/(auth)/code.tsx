import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { verify } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { useSession } from '../../src/auth/useSession';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { useTheme } from '../../src/theme';

export default function CodeScreen() {
    const { email } = useLocalSearchParams<{ email: string }>();
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useSession();
    const { colors, spacing, typography } = useTheme();

    const handleSubmit = async () => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) {
            setError('Code is required.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const { token, user } = await verify(email, trimmed);
            await signIn(token, user);
            // AuthGate handles the redirect once session is set
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Invalid code. Try again.');
            setLoading(false);
        }
    };

    return (
        <Screen>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: '',
                    headerBackButtonDisplayMode: 'minimal',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.primary,
                    headerShadowVisible: false,
                }}
            />
            <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.heading, { color: colors.text }]}>Enter code</Text>
                    <Text style={[typography.body, { color: colors.textMuted }]}>
                        We sent a code to {email}.
                    </Text>
                </View>
                <TextInput
                    label="6-character code"
                    value={code}
                    onChangeText={(t) => setCode(t.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus
                    maxLength={6}
                    error={error}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="done"
                />
                <Button title="Verify" onPress={handleSubmit} loading={loading} />
            </View>
        </Screen>
    );
}
