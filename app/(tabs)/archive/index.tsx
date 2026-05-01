import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import * as archiveApi from '../../../src/api/archive';
import type { ArchiveListItem } from '../../../src/api/schemas';
import { useSession } from '../../../src/auth/useSession';
import { QueryStateView } from '../../../src/components/QueryStateView';
import { Screen } from '../../../src/components/Screen';
import {
    getGuestCompletedPuzzleIds,
    isGuestPuzzleCompleted,
} from '../../../src/lib/guestPuzzleState';
import { formatDate } from '../../../src/lib/time';
import { useTheme } from '../../../src/theme';

type Filter = 'all' | 'unsolved' | 'solved';

const FILTERS: Filter[] = ['all', 'solved', 'unsolved'];
const ARCHIVE_PAGE_SIZE = 25;

export default function ArchiveListScreen() {
    const { session } = useSession();
    const token = session?.token ?? null;
    const { colors, spacing, typography } = useTheme();
    const router = useRouter();
    const [filter, setFilter] = useState<Filter>('all');

    const [refreshing, setRefreshing] = useState(false);
    const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useInfiniteQuery({
            queryKey: ['archive', 'list', token ?? 'guest', filter],
            initialPageParam: 0,
            queryFn: async ({ pageParam }) => {
                const page = await archiveApi.list(token, {
                    limit: ARCHIVE_PAGE_SIZE,
                    offset: pageParam,
                    status: token ? filter : 'all',
                });

                if (token) return page;

                const completedIds = await getGuestCompletedPuzzleIds();
                return page.map((item) =>
                    completedIds.has(item.id) ? { ...item, solved: true } : item
                );
            },
            getNextPageParam: (lastPage, allPages) =>
                lastPage.length === ARCHIVE_PAGE_SIZE
                    ? allPages.length * ARCHIVE_PAGE_SIZE
                    : undefined,
        });

    const handleRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const items = (data?.pages.flat() ?? [])
        .map((item) =>
            token || !isGuestPuzzleCompleted(item.id) ? item : { ...item, solved: true }
        )
        .filter((item) => {
            if (token || filter === 'all') return true;
            return filter === 'solved' ? item.solved === true : item.solved !== true;
        });

    const handleEndReached = () => {
        if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage();
        }
    };

    return (
        <Screen padded={false}>
            <View
                style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                }}
            >
                {FILTERS.map((f) => (
                    <Pressable
                        key={f}
                        onPress={() => setFilter(f)}
                        style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.xs,
                            borderRadius: 16,
                            backgroundColor: filter === f ? colors.primary : colors.surface,
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filter === f }}
                    >
                        <Text
                            style={[
                                typography.caption,
                                {
                                    color: filter === f ? colors.primaryText : colors.text,
                                    textTransform: 'capitalize',
                                },
                            ]}
                        >
                            {f}
                        </Text>
                    </Pressable>
                ))}
            </View>

            <View style={{ flex: 1 }}>
                <QueryStateView
                    isLoading={isLoading}
                    error={error as Error | null}
                    isEmpty={items.length === 0}
                    emptyMessage={
                        filter === 'all' ? 'No past puzzles yet.' : `No ${filter} puzzles.`
                    }
                    onRetry={refetch}
                >
                    <FlatList
                        data={items}
                        keyExtractor={(item) => String(item.id)}
                        style={{ flex: 1 }}
                        renderItem={({ item }) => (
                            <ArchiveListRow
                                item={item}
                                onPress={() => router.push(`/archive/${item.id}` as never)}
                            />
                        )}
                        onEndReached={handleEndReached}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={
                            isFetchingNextPage ? (
                                <Text
                                    style={[
                                        typography.caption,
                                        {
                                            color: colors.textMuted,
                                            textAlign: 'center',
                                            paddingVertical: spacing.md,
                                        },
                                    ]}
                                >
                                    Loading more puzzles...
                                </Text>
                            ) : null
                        }
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

function ArchiveListRow({ item, onPress }: { item: ArchiveListItem; onPress: () => void }) {
    const { colors, spacing, typography } = useTheme();
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
                <Text style={[typography.body, { color: colors.text }]}>{item.puzzle_name}</Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{item.puzzle_number} · {formatDate(item.puzzle_date)}
                </Text>
            </View>
            {item.solved === true && (
                <Text style={[typography.caption, { color: colors.success }]}>Solved</Text>
            )}
        </Pressable>
    );
}
