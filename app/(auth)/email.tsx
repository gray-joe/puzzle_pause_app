import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { login } from '../../src/api/auth';
import { ApiError } from '../../src/api/client';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { useTheme } from '../../src/theme';

export default function EmailScreen() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { colors, spacing, typography } = useTheme();

    const handleSubmit = async () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) {
            setError('Email is required.');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError('Please enter a valid email address.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            await login(trimmed);
            router.push({ pathname: '/(auth)/code', params: { email: trimmed } });
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
        } finally {
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
                    <Text style={[typography.heading, { color: colors.text }]}>Sign in</Text>
                    <Text style={[typography.body, { color: colors.textMuted }]}>
                        We'll email you a code to sign in.
                    </Text>
                </View>
                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    error={error}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="done"
                />
                <Button title="Send code" onPress={handleSubmit} loading={loading} />
            </View>
        </Screen>
    );
}
