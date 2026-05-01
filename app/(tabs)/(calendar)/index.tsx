import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import * as accountApi from '../../../src/api/account';
import { ApiError } from '../../../src/api/client';
import * as puzzleApi from '../../../src/api/puzzle';
import type { AccountStats, PuzzleCalendarEntry } from '../../../src/api/schemas';
import { useSession } from '../../../src/auth/useSession';
import { QueryStateView } from '../../../src/components/QueryStateView';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme';

type CalendarCell = {
    key: string;
    dateString: string;
    day: number;
    inMonth: boolean;
    isCurrentPuzzleDate: boolean;
    isFuture: boolean;
    completed: boolean;
    gaveUp: boolean;
    route: string | null;
};

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function TodayLandingScreen() {
    const { session } = useSession();
    const token = session?.token ?? null;
    const router = useRouter();
    const searchParams = useLocalSearchParams();
    const { colors, scheme, spacing, typography } = useTheme();

    const {
        data: puzzle,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['puzzle', 'today', token ?? 'guest'],
        queryFn: () => puzzleApi.today(token),
    });

    const currentPuzzleDateString = puzzle?.puzzle_date ?? formatDateString(new Date());
    const isTodayPuzzleMissing = error instanceof ApiError && error.status === 404;
    const todayPuzzleError = isTodayPuzzleMissing ? null : error;
    const selectedMonth = resolveSelectedMonth(searchParams.month, currentPuzzleDateString);
    const monthRange = getMonthRange(selectedMonth);

    const { data: completedDatesResponse, error: completedDatesError } = useQuery({
        queryKey: ['calendar', 'completed', token ?? 'guest', monthRange.start, monthRange.end],
        queryFn: () => accountApi.completedDates(token, monthRange.start, monthRange.end),
        enabled: !isLoading,
    });

    const { data: puzzleCalendarResponse, error: puzzleCalendarError } = useQuery({
        queryKey: ['calendar', 'puzzles', token ?? 'guest', monthRange.start, monthRange.end],
        queryFn: () => puzzleApi.calendar(token, monthRange.start, monthRange.end),
        enabled: !isLoading,
    });

    const {
        data: account,
        isLoading: isStatsLoading,
        error: statsError,
    } = useQuery({
        queryKey: ['account', token ?? 'guest'],
        queryFn: () => accountApi.getAccount(token!),
        enabled: !!token,
    });

    const calendar = buildCalendar(
        selectedMonth,
        currentPuzzleDateString,
        completedDatesError ? [] : (completedDatesResponse?.completed_dates ?? []),
        completedDatesError ? [] : (completedDatesResponse?.gave_up_dates ?? []),
        puzzleCalendarError ? [] : (puzzleCalendarResponse ?? []),
        puzzle?.id ?? null
    );
    const shadowColor = scheme === 'dark' ? '#000000' : colors.text;
    const currentMonthKey = toMonthKey(parseDate(currentPuzzleDateString));

    const navigateToMonth = (monthDate: Date) => {
        const monthKey = toMonthKey(monthDate);
        if (monthKey === currentMonthKey) {
            router.push('/' as never);
            return;
        }

        router.push({ pathname: '/', params: { month: monthKey } } as never);
    };

    return (
        <Screen scrollable padded>
            <QueryStateView
                isLoading={isLoading}
                error={todayPuzzleError as Error | null}
                onRetry={refetch}
            >
                <View style={{ flex: 1, justifyContent: 'space-between', gap: spacing.xl }}>
                    <View style={{ gap: spacing.xl }}>
                        <View style={{ alignItems: 'center', gap: spacing.xs }}>
                            <Text
                                style={[
                                    typography.heading,
                                    {
                                        color: colors.primary,
                                        fontSize: 28,
                                        letterSpacing: 2,
                                        textAlign: 'center',
                                        textTransform: 'uppercase',
                                    },
                                ]}
                            >
                                Puzzle Pause
                            </Text>
                            {puzzle ? (
                                <Text
                                    style={[
                                        typography.caption,
                                        { color: colors.textMuted, textAlign: 'center' },
                                    ]}
                                >
                                    Puzzle #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                                </Text>
                            ) : (
                                <Text
                                    style={[
                                        typography.caption,
                                        { color: colors.textMuted, textAlign: 'center' },
                                    ]}
                                >
                                    Today's puzzle is unavailable. Calendar links may be limited.
                                </Text>
                            )}
                        </View>

                        <CalendarCard
                            cells={calendar.cells}
                            monthLabel={calendar.monthLabel}
                            shadowColor={shadowColor}
                            onPrevious={() => navigateToMonth(addMonths(selectedMonth, -1))}
                            onNext={() => navigateToMonth(addMonths(selectedMonth, 1))}
                            onOpenRoute={(route) => router.push(route as never)}
                        />
                    </View>

                    <StatsPanel
                        stats={account?.stats}
                        isLoading={isStatsLoading}
                        error={statsError as Error | null}
                        isGuest={!token}
                        onSignIn={() => router.push('/(auth)/email' as never)}
                    />
                </View>
            </QueryStateView>
        </Screen>
    );
}

function CalendarCard({
    cells,
    monthLabel,
    shadowColor,
    onPrevious,
    onNext,
    onOpenRoute,
}: {
    cells: CalendarCell[];
    monthLabel: string;
    shadowColor: string;
    onPrevious: () => void;
    onNext: () => void;
    onOpenRoute: (route: string) => void;
}) {
    const { colors, scheme, spacing, typography } = useTheme();
    const rows = chunk(cells, 7);

    return (
        <View
            style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 18,
                overflow: 'hidden',
                shadowColor,
                shadowOpacity: scheme === 'dark' ? 0.35 : 0.12,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 3,
            }}
        >
            <View
                style={{
                    paddingVertical: spacing.lg,
                    paddingHorizontal: spacing.md,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                }}
            >
                <Pressable
                    onPress={onPrevious}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    style={({ pressed }) => ({
                        padding: spacing.sm,
                        borderRadius: 999,
                        opacity: pressed ? 0.7 : 1,
                    })}
                >
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </Pressable>
                <Text
                    style={[
                        typography.heading,
                        {
                            color: colors.text,
                            letterSpacing: 2,
                            textAlign: 'center',
                            textTransform: 'uppercase',
                        },
                    ]}
                >
                    {monthLabel}
                </Text>
                <Pressable
                    onPress={onNext}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    style={({ pressed }) => ({
                        padding: spacing.sm,
                        borderRadius: 999,
                        opacity: pressed ? 0.7 : 1,
                    })}
                >
                    <Ionicons name="chevron-forward" size={24} color={colors.text} />
                </Pressable>
            </View>

            <View
                style={{
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: colors.border,
                    flexDirection: 'row',
                }}
            >
                {WEEKDAYS.map((weekday, index) => (
                    <View
                        key={`${weekday}-${index}`}
                        style={{ flex: 1, paddingVertical: spacing.md }}
                    >
                        <Text
                            style={[
                                typography.title,
                                {
                                    color: colors.text,
                                    textAlign: 'center',
                                },
                            ]}
                        >
                            {weekday}
                        </Text>
                    </View>
                ))}
            </View>

            {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={{ flexDirection: 'row' }}>
                    {row.map((cell) => (
                        <CalendarDay key={cell.key} cell={cell} onOpenRoute={onOpenRoute} />
                    ))}
                </View>
            ))}
        </View>
    );
}

function CalendarDay({
    cell,
    onOpenRoute,
}: {
    cell: CalendarCell;
    onOpenRoute: (route: string) => void;
}) {
    const { colors, spacing, typography } = useTheme();
    const hasPuzzleState = cell.inMonth && !cell.isFuture;
    const textColor = cell.completed
        ? colors.primaryText
        : cell.gaveUp
          ? colors.gaveUpText
          : cell.inMonth && !cell.isFuture
            ? colors.text
            : colors.textMuted;
    const fillColor = cell.completed ? colors.success : cell.gaveUp ? colors.gaveUp : colors.border;
    const accessibilityLabel = cell.gaveUp ? `${cell.dateString}, gave up.` : undefined;
    const containerStyle = {
        flex: 1,
        aspectRatio: 1,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.border,
    };
    const inner = (
        <View
            style={{
                width: '72%',
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: hasPuzzleState ? fillColor : 'transparent',
                borderWidth: cell.isCurrentPuzzleDate ? 2 : 0,
                borderColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs / 2,
                opacity: cell.isFuture || !cell.inMonth ? 0.65 : 1,
            }}
        >
            {hasPuzzleState && (
                <Ionicons
                    name="extension-puzzle"
                    size={15}
                    color={
                        cell.completed
                            ? colors.primaryText
                            : cell.gaveUp
                              ? colors.gaveUpText
                              : colors.text
                    }
                />
            )}
            <Text style={[typography.title, { color: textColor }]}>{cell.day}</Text>
        </View>
    );

    if (!cell.route) {
        return (
            <View
                style={containerStyle}
                accessible={accessibilityLabel != null}
                accessibilityLabel={accessibilityLabel}
            >
                {inner}
            </View>
        );
    }

    return (
        <Pressable
            onPress={() => cell.route && onOpenRoute(cell.route)}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={{ selected: cell.isCurrentPuzzleDate }}
            style={({ pressed }) => ({ ...containerStyle, opacity: pressed ? 0.75 : 1 })}
        >
            {inner}
        </Pressable>
    );
}

function StatsPanel({
    stats,
    isLoading,
    error,
    isGuest,
    onSignIn,
}: {
    stats?: AccountStats;
    isLoading: boolean;
    error: Error | null;
    isGuest: boolean;
    onSignIn: () => void;
}) {
    const { colors, spacing, typography } = useTheme();

    if (isGuest) {
        return (
            <Pressable
                onPress={onSignIn}
                accessibilityRole="button"
                style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: spacing.lg,
                    alignItems: 'center',
                    opacity: pressed ? 0.8 : 1,
                })}
            >
                <Text style={[typography.title, { color: colors.primary }]}>Sign in for stats</Text>
                <Text
                    style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}
                >
                    Track your streak and solved puzzles.
                </Text>
            </Pressable>
        );
    }

    if (isLoading) {
        return (
            <View
                style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: spacing.lg,
                    alignItems: 'center',
                    gap: spacing.sm,
                }}
            >
                <ActivityIndicator color={colors.primary} />
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Loading stats...
                </Text>
            </View>
        );
    }

    if (error || !stats) {
        return (
            <View
                style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: spacing.lg,
                    alignItems: 'center',
                }}
            >
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    Stats unavailable
                </Text>
            </View>
        );
    }

    return (
        <View
            style={{
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                borderTopWidth: 1,
                borderRadius: 16,
                padding: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
            }}
        >
            <StatItem icon="flame" value={stats.streak} label="Day Streak" />
            <View style={{ width: 1, height: 56, backgroundColor: colors.border }} />
            <StatItem icon="trophy" value={stats.puzzles_solved} label="Puzzles Solved" />
        </View>
    );
}

function StatItem({ icon, value, label }: { icon: IoniconsName; value: number; label: string }) {
    const { colors, spacing, typography } = useTheme();
    return (
        <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name={icon} size={26} color={colors.primary} />
            <Text style={[typography.heading, { color: colors.primary, fontSize: 32 }]}>
                {value}
            </Text>
            <Text style={[typography.body, { color: colors.text, textAlign: 'center' }]}>
                {label}
            </Text>
        </View>
    );
}

function buildCalendar(
    monthDate: Date,
    currentPuzzleDateString: string,
    completedDates: string[],
    gaveUpDates: string[],
    puzzleEntries: PuzzleCalendarEntry[],
    todayPuzzleId: number | null
) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const completed = new Set(completedDates);
    const gaveUp = new Set(gaveUpDates);
    const puzzleIdByDate = new Map(puzzleEntries.map((entry) => [entry.puzzle_date, entry.id]));

    const cells: CalendarCell[] = Array.from({ length: 42 }, (_, index) => {
        let day: number;
        let cellDate: Date;
        let inMonth = true;

        if (index < firstDay) {
            day = daysInPreviousMonth - firstDay + index + 1;
            cellDate = new Date(year, month - 1, day);
            inMonth = false;
        } else {
            day = index - firstDay + 1;
            if (day > daysInMonth) {
                day -= daysInMonth;
                cellDate = new Date(year, month + 1, day);
                inMonth = false;
            } else {
                cellDate = new Date(year, month, day);
            }
        }

        const dateString = formatDateString(cellDate);
        const isFuture = inMonth && dateString > currentPuzzleDateString;
        const puzzleId = puzzleIdByDate.get(dateString);
        const isCurrentPuzzleDate = inMonth && dateString === currentPuzzleDateString;
        const route = getCalendarRoute({
            dateString,
            inMonth,
            isFuture,
            isCurrentPuzzleDate,
            puzzleId,
            todayPuzzleId,
        });

        const isCompleted = inMonth && !isFuture && completed.has(dateString);

        return {
            key: `${dateString}-${index}`,
            dateString,
            day,
            inMonth,
            isCurrentPuzzleDate,
            isFuture,
            completed: isCompleted,
            gaveUp: inMonth && !isFuture && !isCompleted && gaveUp.has(dateString),
            route,
        };
    });

    return {
        cells,
        monthLabel: monthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
}

function getCalendarRoute({
    dateString,
    inMonth,
    isFuture,
    isCurrentPuzzleDate,
    puzzleId,
    todayPuzzleId,
}: {
    dateString: string;
    inMonth: boolean;
    isFuture: boolean;
    isCurrentPuzzleDate: boolean;
    puzzleId?: number;
    todayPuzzleId: number | null;
}) {
    if (!inMonth || isFuture) return null;
    if (isCurrentPuzzleDate && todayPuzzleId != null) return '/puzzle';
    if (puzzleId == null) return null;
    return `/calendar/archive/${puzzleId}`;
}

function resolveSelectedMonth(monthParam: unknown, currentPuzzleDateString: string) {
    return parseMonthParam(monthParam) ?? startOfMonth(parseDate(currentPuzzleDateString));
}

function parseMonthParam(value: unknown) {
    const month = Array.isArray(value) ? value[0] : value;
    if (typeof month !== 'string') return null;

    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) return null;

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) return null;
    return new Date(year, monthIndex, 1);
}

function getMonthRange(monthDate: Date) {
    const start = startOfMonth(monthDate);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start: formatDateString(start), end: formatDateString(end) };
}

function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function parseDate(dateString: string) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function toMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function chunk<T>(items: T[], size: number) {
    const rows: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        rows.push(items.slice(index, index + size));
    }
    return rows;
}
