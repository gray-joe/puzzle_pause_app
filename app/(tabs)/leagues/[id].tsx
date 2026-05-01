import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import * as leaguesApi from '../../../src/api/leagues';
import { ApiError } from '../../../src/api/client';
import type { LeaderboardEntry, TagEntry } from '../../../src/api/schemas';
import { useSession } from '../../../src/auth/useSession';
import { Button } from '../../../src/components/Button';
import { GuestPrompt } from '../../../src/components/GuestPrompt';
import { QueryStateView } from '../../../src/components/QueryStateView';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme';

type LeaderboardType = 'today' | 'weekly' | 'alltime';

const LEADERBOARD_LABELS: Record<LeaderboardType, string> = {
    today: 'Today',
    weekly: 'Weekly',
    alltime: 'All-time',
};

const TAG_LABELS: Record<string, string> = {
    guesser: 'Most Guesses',
    one_shotter: 'One Shotter',
    early_riser: 'Early Riser',
    hint_lover: 'Hint Lover',
};

export default function LeagueDetailScreen() {
    const { id: idParam } = useLocalSearchParams<{ id: string }>();
    const id = Number(idParam);
    const { session } = useSession();
    const token = session?.token ?? null;
    const currentUserId = session?.user.id ?? null;
    const { colors, spacing, typography } = useTheme();
    const router = useRouter();
    const queryClient = useQueryClient();

    const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('today');
    const [refreshing, setRefreshing] = useState(false);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['leagues', 'detail', id, token ?? 'guest'],
        queryFn: () => leaguesApi.detail(token!, id),
        enabled: !!token,
    });

    const leaveMutation = useMutation({
        mutationFn: () => leaguesApi.leave(token!, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leagues', 'list', token!] });
            queryClient.removeQueries({ queryKey: ['leagues', 'detail', id, token!] });
            router.back();
        },
        onError: (err) => {
            Alert.alert('Error', err instanceof ApiError ? err.message : 'Something went wrong.');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => leaguesApi.deleteLeague(token!, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leagues', 'list', token!] });
            queryClient.removeQueries({ queryKey: ['leagues', 'detail', id, token!] });
            router.back();
        },
        onError: (err) => {
            Alert.alert('Error', err instanceof ApiError ? err.message : 'Something went wrong.');
        },
    });

    const confirmLeave = () => {
        Alert.alert('Leave league?', 'You can rejoin later with the invite code.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
        ]);
    };

    const confirmDelete = () => {
        Alert.alert(
            'Delete league?',
            'This will remove the league for all members and cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
            ]
        );
    };

    const isCreator = data?.creator_id === currentUserId;

    const currentLeaderboard: LeaderboardEntry[] = data
        ? {
              today: data.leaderboard_today,
              weekly: data.leaderboard_weekly,
              alltime: data.leaderboard_alltime,
          }[leaderboardType]
        : [];

    const activeTags = data
        ? (Object.entries(data.tags) as [string, TagEntry][]).filter(([, entry]) => entry != null)
        : [];

    if (!session) {
        return (
            <GuestPrompt message="Sign in to view league standings, manage membership, and compete with friends." />
        );
    }

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    return (
        <>
            <Stack.Screen
                options={{
                    title: data?.name ?? 'League',
                    headerBackButtonDisplayMode: 'minimal',
                }}
            />
            <Screen scrollable padded refreshing={refreshing} onRefresh={handleRefresh}>
                <QueryStateView
                    isLoading={isLoading}
                    error={error as Error | null}
                    onRetry={refetch}
                >
                    {data && (
                        <View style={{ gap: spacing.xl }}>
                            {/* Invite code */}
                            <View style={{ gap: spacing.xs }}>
                                <Text style={[typography.caption, { color: colors.textMuted }]}>
                                    Invite code
                                </Text>
                                <Text
                                    style={[
                                        typography.title,
                                        { color: colors.primary, letterSpacing: 2 },
                                    ]}
                                >
                                    {data.invite_code}
                                </Text>
                                <Text style={[typography.caption, { color: colors.textMuted }]}>
                                    {data.member_count} member{data.member_count !== 1 ? 's' : ''}
                                    {data.user_rank != null
                                        ? ` · Your rank: #${data.user_rank}`
                                        : ''}
                                </Text>
                            </View>

                            {/* Leaderboard */}
                            <View style={{ gap: spacing.md }}>
                                {/* Type selector */}
                                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                    {(Object.keys(LEADERBOARD_LABELS) as LeaderboardType[]).map(
                                        (type) => (
                                            <Pressable
                                                key={type}
                                                onPress={() => setLeaderboardType(type)}
                                                style={{
                                                    paddingHorizontal: spacing.md,
                                                    paddingVertical: spacing.xs,
                                                    borderRadius: 16,
                                                    backgroundColor:
                                                        leaderboardType === type
                                                            ? colors.primary
                                                            : colors.surface,
                                                }}
                                                accessibilityRole="button"
                                                accessibilityState={{
                                                    selected: leaderboardType === type,
                                                }}
                                            >
                                                <Text
                                                    style={[
                                                        typography.caption,
                                                        {
                                                            color:
                                                                leaderboardType === type
                                                                    ? colors.primaryText
                                                                    : colors.text,
                                                        },
                                                    ]}
                                                >
                                                    {LEADERBOARD_LABELS[type]}
                                                </Text>
                                            </Pressable>
                                        )
                                    )}
                                </View>

                                {/* Leaderboard rows */}
                                {currentLeaderboard.length === 0 ? (
                                    <Text style={[typography.body, { color: colors.textMuted }]}>
                                        No scores yet.
                                    </Text>
                                ) : (
                                    <View
                                        style={{
                                            gap: 1,
                                            borderTopWidth: 1,
                                            borderTopColor: colors.border,
                                        }}
                                    >
                                        {currentLeaderboard.map((entry) => (
                                            <LeaderboardRow
                                                key={entry.user_id}
                                                entry={entry}
                                                isCurrentUser={entry.user_id === currentUserId}
                                            />
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Tags */}
                            {activeTags.length > 0 && (
                                <View style={{ gap: spacing.sm }}>
                                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                                        Highlights
                                    </Text>
                                    <View style={{ gap: spacing.xs }}>
                                        {activeTags.map(([key, entry]) => (
                                            <View
                                                key={key}
                                                style={{
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    paddingVertical: spacing.xs,
                                                    borderBottomWidth: 1,
                                                    borderBottomColor: colors.border,
                                                }}
                                            >
                                                <Text
                                                    style={[
                                                        typography.caption,
                                                        { color: colors.textMuted },
                                                    ]}
                                                >
                                                    {TAG_LABELS[key] ?? key}
                                                </Text>
                                                <Text
                                                    style={[
                                                        typography.caption,
                                                        { color: colors.text },
                                                    ]}
                                                >
                                                    {entry!.display_name ?? 'Anonymous'}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Actions */}
                            <View style={{ gap: spacing.sm, paddingTop: spacing.md }}>
                                {isCreator ? (
                                    <Button
                                        title="Delete league"
                                        variant="secondary"
                                        onPress={confirmDelete}
                                        loading={deleteMutation.isPending}
                                    />
                                ) : (
                                    <Button
                                        title="Leave league"
                                        variant="secondary"
                                        onPress={confirmLeave}
                                        loading={leaveMutation.isPending}
                                    />
                                )}
                            </View>
                        </View>
                    )}
                </QueryStateView>
            </Screen>
        </>
    );
}

function LeaderboardRow({
    entry,
    isCurrentUser,
}: {
    entry: LeaderboardEntry;
    isCurrentUser: boolean;
}) {
    const { colors, spacing, typography } = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: isCurrentUser ? colors.surface : 'transparent',
                paddingHorizontal: spacing.sm,
                borderRadius: 4,
            }}
        >
            <Text style={[typography.caption, { color: colors.textMuted, width: 28 }]}>
                #{entry.rank}
            </Text>
            <Text
                style={[
                    typography.body,
                    { flex: 1, color: isCurrentUser ? colors.primary : colors.text },
                ]}
            >
                {entry.display_name ?? 'Anonymous'}
            </Text>
            <Text style={[typography.body, { color: colors.text }]}>{entry.score ?? '—'}</Text>
        </View>
    );
}
