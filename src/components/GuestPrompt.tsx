import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { login, verify } from '../api/auth';
import { ApiError } from '../api/client';
import { useSession } from '../auth/useSession';
import { Button } from './Button';
import { Screen } from './Screen';
import { TextInput } from './TextInput';
import { useTheme } from '../theme';

type Step = 'prompt' | 'email' | 'code';

type Props = {
    message: string;
};

export function GuestPrompt({ message }: Props) {
    const [step, setStep] = useState<Step>('prompt');
    const [email, setEmail] = useState('');
    const { colors, spacing, typography } = useTheme();

    if (step === 'code') {
        return <CodeForm email={email} />;
    }

    if (step === 'email') {
        return (
            <EmailForm
                onSuccess={(confirmed) => {
                    setEmail(confirmed);
                    setStep('code');
                }}
            />
        );
    }

    return (
        <Screen>
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: spacing.lg,
                    padding: spacing.xl,
                }}
            >
                <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
                    {message}
                </Text>
                <Button title="Sign in" onPress={() => setStep('email')} />
            </View>
        </Screen>
    );
}

function EmailForm({ onSuccess }: { onSuccess: (email: string) => void }) {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const { colors, spacing, typography } = useTheme();

    const mutation = useMutation({
        mutationFn: (trimmed: string) => login(trimmed),
        onSuccess: (_, trimmed) => onSuccess(trimmed),
        onError: (err) =>
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.'),
    });

    const handleSubmit = () => {
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
        mutation.mutate(trimmed);
    };

    return (
        <Screen scrollable padded>
            <View style={{ gap: spacing.lg }}>
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
                <Button title="Send code" onPress={handleSubmit} loading={mutation.isPending} />
            </View>
        </Screen>
    );
}

function CodeForm({ email }: { email: string }) {
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const { signIn } = useSession();
    const { colors, spacing, typography } = useTheme();

    const mutation = useMutation({
        mutationFn: (trimmed: string) => verify(email, trimmed),
        onSuccess: async (data) => {
            await signIn(data.token, data.user);
        },
        onError: (err) =>
            setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.'),
    });

    const handleSubmit = () => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) {
            setError('Code is required.');
            return;
        }
        if (trimmed.length !== 6) {
            setError('Code must be 6 characters.');
            return;
        }
        setError('');
        mutation.mutate(trimmed);
    };

    return (
        <Screen scrollable padded>
            <View style={{ gap: spacing.lg }}>
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.heading, { color: colors.text }]}>
                        Check your email
                    </Text>
                    <Text style={[typography.body, { color: colors.textMuted }]}>
                        Enter the 6-character code sent to {email}.
                    </Text>
                </View>
                <TextInput
                    label="Code"
                    value={code}
                    onChangeText={setCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoFocus
                    maxLength={6}
                    error={error}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="done"
                />
                <Button title="Sign in" onPress={handleSubmit} loading={mutation.isPending} />
            </View>
        </Screen>
    );
}
