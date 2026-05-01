import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as accountApi from '../../src/api/account';
import { ApiError } from '../../src/api/client';
import type { AccountStats } from '../../src/api/schemas';
import { useSession } from '../../src/auth/useSession';
import { Button } from '../../src/components/Button';
import { GuestPrompt } from '../../src/components/GuestPrompt';
import { QueryStateView } from '../../src/components/QueryStateView';
import { Screen } from '../../src/components/Screen';
import { TextInput } from '../../src/components/TextInput';
import { useTheme } from '../../src/theme';

export default function AccountScreen() {
    const { session, signOut } = useSession();
    const router = useRouter();
    const token = session?.token ?? null;
    const { colors, spacing, typography } = useTheme();
    const [refreshing, setRefreshing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['account', token ?? 'guest'],
        queryFn: () => accountApi.getAccount(token!),
        enabled: !!token,
    });

    const deleteMutation = useMutation({
        mutationFn: () => accountApi.delete(token!),
        onSuccess: () => {
            setDeleteError('');
            setConfirmDelete(false);
            void signOut();
            router.replace('/(auth)/email');
            (router as typeof router & { refresh?: () => void }).refresh?.();
        },
        onError: (err) => {
            setConfirmDelete(false);
            setDeleteError(
                err instanceof ApiError ? err.message : 'Could not delete your account. Try again.'
            );
        },
    });

    if (!session) {
        return <GuestPrompt message="Sign in to manage your account and view your stats." />;
    }

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    return (
        <Screen scrollable padded refreshing={refreshing} onRefresh={handleRefresh}>
            <View style={{ gap: spacing.xl }}>
                <View style={{ gap: spacing.xs }}>
                    <Text style={[typography.heading, { color: colors.text }]}>Account</Text>
                    <Text style={[typography.body, { color: colors.textMuted }]}>
                        {session.user.email}
                    </Text>
                </View>

                <QueryStateView
                    isLoading={isLoading}
                    error={error as Error | null}
                    onRetry={refetch}
                >
                    {data && (
                        <>
                            <StatsSection stats={data.stats} />
                            <DisplayNameForm initialName={data.display_name} token={token!} />
                        </>
                    )}
                </QueryStateView>

                <Button title="Sign out" variant="secondary" onPress={signOut} />

                {deleteError ? (
                    <Text style={[typography.body, { color: colors.error, textAlign: 'center' }]}>
                        {deleteError}
                    </Text>
                ) : null}

                {confirmDelete ? (
                    <View
                        style={{
                            backgroundColor: colors.surface,
                            borderColor: colors.error,
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: spacing.md,
                            gap: spacing.md,
                        }}
                    >
                        <View style={{ gap: spacing.xs }}>
                            <Text style={[typography.title, { color: colors.text }]}>
                                Delete your account?
                            </Text>
                            <Text style={[typography.body, { color: colors.textMuted }]}>
                                This permanently deletes your account, sessions, puzzle history,
                                completion events, auth tokens, and league memberships. This cannot
                                be undone.
                            </Text>
                        </View>
                        <Button
                            title="Yes, delete my account"
                            onPress={() => deleteMutation.mutate()}
                            loading={deleteMutation.isPending}
                            style={{ backgroundColor: colors.error, borderColor: colors.error }}
                        />
                        <Button
                            title="Cancel"
                            variant="secondary"
                            onPress={() => setConfirmDelete(false)}
                            disabled={deleteMutation.isPending}
                        />
                    </View>
                ) : null}

                {!confirmDelete ? (
                    <Pressable
                        onPress={() => {
                            setDeleteError('');
                            setConfirmDelete(true);
                        }}
                    >
                        <Text
                            style={[
                                typography.body,
                                { color: colors.textMuted, textAlign: 'center' },
                            ]}
                        >
                            Delete account
                        </Text>
                    </Pressable>
                ) : null}
            </View>
        </Screen>
    );
}

function StatsSection({ stats }: { stats: AccountStats }) {
    const { colors, spacing, typography } = useTheme();
    const topPercentile = Math.max(1, Math.round(stats.percentile));

    const items: { label: string; value: string }[] = [
        { label: 'Streak', value: `${stats.streak} day${stats.streak !== 1 ? 's' : ''}` },
        { label: 'Today', value: stats.today_score != null ? String(stats.today_score) : '—' },
        { label: 'This week', value: String(stats.weekly_total) },
        { label: 'All-time', value: String(stats.alltime_total) },
        { label: 'Solved', value: String(stats.puzzles_solved) },
        { label: 'Avg score', value: String(Math.round(stats.average_score)) },
        { label: 'Percentile', value: `Top ${topPercentile}%` },
    ];

    return (
        <View style={{ gap: spacing.sm }}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Stats</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {items.map(({ label, value }) => (
                    <View
                        key={label}
                        style={{
                            width: '47%',
                            backgroundColor: colors.surface,
                            borderRadius: 8,
                            padding: spacing.md,
                            gap: spacing.xs / 2,
                        }}
                    >
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                            {label}
                        </Text>
                        <Text style={[typography.title, { color: colors.text }]}>{value}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

function DisplayNameForm({ initialName, token }: { initialName: string | null; token: string }) {
    const { colors, spacing } = useTheme();
    const queryClient = useQueryClient();
    const [value, setValue] = useState(initialName ?? '');
    const [saveError, setSaveError] = useState('');
    const [saved, setSaved] = useState(false);

    const hasChanged = value !== (initialName ?? '');

    const mutation = useMutation({
        mutationFn: () => accountApi.updateDisplayName(token, value.trim()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['account', token] });
            setSaveError('');
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        },
        onError: (err) => {
            setSaveError(
                err instanceof ApiError ? err.message : 'Something went wrong. Try again.'
            );
        },
    });

    const handleSave = () => {
        const trimmed = value.trim();
        if (!trimmed) {
            setSaveError('Display name cannot be empty.');
            return;
        }
        if (trimmed.length > 40) {
            setSaveError('Display name must be 40 characters or fewer.');
            return;
        }
        setSaveError('');
        mutation.mutate();
    };

    return (
        <View style={{ gap: spacing.sm }}>
            <TextInput
                label="Display name"
                value={value}
                onChangeText={(t) => {
                    setValue(t);
                    setSaved(false);
                }}
                autoCapitalize="words"
                autoCorrect={false}
                error={saveError}
                onSubmitEditing={handleSave}
                returnKeyType="done"
            />
            {(hasChanged || mutation.isPending) && (
                <Button
                    title={saved ? 'Saved' : 'Save'}
                    onPress={handleSave}
                    loading={mutation.isPending}
                />
            )}
        </View>
    );
}
