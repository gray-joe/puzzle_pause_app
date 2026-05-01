import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import * as leaguesApi from '../../../src/api/leagues';
import type { LeagueResponse } from '../../../src/api/schemas';
import { useSession } from '../../../src/auth/useSession';
import { Button } from '../../../src/components/Button';
import { GuestPrompt } from '../../../src/components/GuestPrompt';
import { QueryStateView } from '../../../src/components/QueryStateView';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme';

export default function LeaguesListScreen() {
    const { session } = useSession();
    const token = session?.token ?? null;
    const { colors, spacing, typography } = useTheme();
    const router = useRouter();

    const [refreshing, setRefreshing] = useState(false);
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['leagues', 'list', token ?? 'guest'],
        queryFn: () => leaguesApi.list(token!),
        enabled: !!token,
    });

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    if (!session) {
        return (
            <GuestPrompt message="Sign in to create and join leagues, track your standing, and compete with friends." />
        );
    }

    return (
        <Screen padded={false}>
            <View
                style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    padding: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Button
                        title="Join"
                        variant="secondary"
                        onPress={() => router.push('/leagues/join' as never)}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Button title="Create" onPress={() => router.push('/leagues/new' as never)} />
                </View>
            </View>

            <View style={{ flex: 1 }}>
                <QueryStateView
                    isLoading={isLoading}
                    error={error as Error | null}
                    isEmpty={data?.length === 0}
                    emptyMessage={
                        "You haven't joined any leagues yet.\nTap 'Join' to enter an invite code or 'Create' to start one."
                    }
                    onRetry={refetch}
                >
                    <FlatList
                        data={data}
                        keyExtractor={(item) => String(item.id)}
                        style={{ flex: 1 }}
                        renderItem={({ item }) => (
                            <LeagueListRow
                                item={item}
                                onPress={() => router.push(`/leagues/${item.id}` as never)}
                            />
                        )}
                        contentContainerStyle={{ paddingBottom: spacing.xl }}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                        }
                    />
                </QueryStateView>
            </View>
        </Screen>
    );
}

function LeagueListRow({ item, onPress }: { item: LeagueResponse; onPress: () => void }) {
    const { colors, spacing, typography } = useTheme();
    const memberLabel = `${item.member_count} member${item.member_count !== 1 ? 's' : ''}`;
    const rankLabel = item.user_rank != null ? ` · Rank #${item.user_rank}` : '';

    return (
        <Pressable
            onPress={onPress}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
            }}
            accessibilityRole="button"
        >
            <View style={{ flex: 1, gap: 2 }}>
                <Text style={[typography.body, { color: colors.text }]}>{item.name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {memberLabel}
                    {rankLabel}
                </Text>
            </View>
            {item.user_score > 0 && (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {item.user_score} pts
                </Text>
            )}
        </Pressable>
    );
}
