import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert } from 'react-native';
import {
    clipboardSetStringAsyncMock,
    localSearchParamsMock,
    routerMock,
    segmentsMock,
} from './test/setup';
import {
    allText,
    changeText,
    findAllByHost,
    findByHost,
    findPressableByText,
    press,
    pressAsync,
    render,
    textContent,
    update,
} from './test/render';
import { ApiError } from './api/client';
import type { Puzzle, User } from './api/schemas';
import { clearGuestPuzzleStateForTest, setGuestPuzzleResult } from './lib/guestPuzzleState';

const mocks = vi.hoisted(() => {
    const queryData = new Map<string, unknown>();
    const queryDataKey = (key: unknown) => JSON.stringify(key);

    return {
        queryData,
        useQuery: vi.fn(),
        useInfiniteQuery: vi.fn(),
        useMutation: vi.fn(),
        queryClient: {
            invalidateQueries: vi.fn(),
            removeQueries: vi.fn(),
            clear: vi.fn(),
            getQueryData: vi.fn((key: unknown) => queryData.get(queryDataKey(key))),
            setQueryData: vi.fn((key: unknown, value: unknown) => {
                const cacheKey = queryDataKey(key);
                const current = queryData.get(cacheKey);
                const next = typeof value === 'function' ? value(current) : value;
                queryData.set(cacheKey, next);
                return next;
            }),
        },
        useSession: vi.fn(),
        login: vi.fn(),
        verify: vi.fn(),
        getAccount: vi.fn(),
        completedDates: vi.fn(),
        updateDisplayName: vi.fn(),
        deleteAccount: vi.fn(),
        archiveList: vi.fn(),
        archiveDetail: vi.fn(),
        archiveAttempt: vi.fn(),
        archiveHint: vi.fn(),
        archiveGiveUp: vi.fn(),
        leagueList: vi.fn(),
        leagueCreate: vi.fn(),
        leagueJoin: vi.fn(),
        leagueDetail: vi.fn(),
        leagueLeave: vi.fn(),
        leagueDelete: vi.fn(),
        puzzleToday: vi.fn(),
        puzzleAttempt: vi.fn(),
        puzzleHint: vi.fn(),
        puzzleGiveUp: vi.fn(),
        puzzleResult: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        refetch: vi.fn(),
        fetchNextPage: vi.fn(),
    };
});

vi.mock('@tanstack/react-query', () => ({
    QueryClient: vi.fn(function QueryClient() {
        return mocks.queryClient;
    }),
    QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
        React.createElement('QueryClientProvider', null, children),
    useQuery: mocks.useQuery,
    useInfiniteQuery: mocks.useInfiniteQuery,
    useMutation: mocks.useMutation,
    useQueryClient: () => mocks.queryClient,
}));

vi.mock('./auth/useSession', () => ({
    useSession: mocks.useSession,
}));

vi.mock('./api/auth', () => ({
    login: mocks.login,
    verify: mocks.verify,
}));

vi.mock('./api/account', () => ({
    getAccount: mocks.getAccount,
    completedDates: mocks.completedDates,
    updateDisplayName: mocks.updateDisplayName,
    delete: mocks.deleteAccount,
    deleteAccount: mocks.deleteAccount,
}));

vi.mock('./api/archive', () => ({
    list: mocks.archiveList,
    detail: mocks.archiveDetail,
    attempt: mocks.archiveAttempt,
    hint: mocks.archiveHint,
    giveUp: mocks.archiveGiveUp,
}));

vi.mock('./api/leagues', () => ({
    list: mocks.leagueList,
    create: mocks.leagueCreate,
    join: mocks.leagueJoin,
    detail: mocks.leagueDetail,
    leave: mocks.leagueLeave,
    deleteLeague: mocks.leagueDelete,
}));

vi.mock('./auth/SessionContext', () => ({
    SessionProvider: ({ children }: { children: React.ReactNode }) =>
        React.createElement('SessionProvider', null, children),
}));

vi.mock('./api/puzzle', () => ({
    today: mocks.puzzleToday,
    attempt: mocks.puzzleAttempt,
    hint: mocks.puzzleHint,
    giveUp: mocks.puzzleGiveUp,
    result: mocks.puzzleResult,
}));

const user: User = { id: 7, email: 'user@example.com', display_name: 'Puzzle Friend' };
const session = { token: 'jwt-token', user };

function setSession(value: typeof session | null = session) {
    mocks.useSession.mockReturnValue({
        session: value,
        isLoading: false,
        signIn: mocks.signIn,
        signOut: mocks.signOut,
    });
}

function setQuery(result: Record<string, unknown>) {
    mocks.useQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mocks.refetch,
        ...result,
    });
}

function setInfiniteQuery(result: Record<string, unknown>) {
    mocks.useInfiniteQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mocks.refetch,
        fetchNextPage: mocks.fetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        ...result,
    });
}

function installMutationMock() {
    mocks.useMutation.mockImplementation((options) => ({
        isPending: false,
        mutate: (arg: unknown) => {
            try {
                const result = options.mutationFn(arg);
                options.onSuccess?.(result, arg);
            } catch (err) {
                options.onError?.(err);
            }
        },
    }));
}

const wordPuzzle = {
    id: 11,
    puzzle_date: '2026-05-07',
    puzzle_name: 'Daily Word',
    puzzle_number: 42,
    puzzle_type: 'word',
    question: '<p>Guess it</p>',
    hint: null,
    has_hint: true,
    total_hints: 2,
    attempt: { solved: false, score: null, incorrect_guesses: 0, hint_used: 0, completed_at: null },
};

const choicePuzzle = {
    ...wordPuzzle,
    id: 12,
    puzzle_name: 'Daily Choice',
    puzzle_type: 'choice',
    question: { prompt: 'Pick one', options: ['Alpha', 'Beta', 'Gamma'] },
};

beforeEach(() => {
    vi.clearAllMocks();
    clearGuestPuzzleStateForTest();
    mocks.queryData.clear();
    routerMock.push.mockReset();
    routerMock.replace.mockReset();
    routerMock.back.mockReset();
    routerMock.refresh.mockReset();
    localSearchParamsMock.mockReset();
    localSearchParamsMock.mockReturnValue({});
    segmentsMock.mockReset();
    segmentsMock.mockReturnValue([]);
    setSession();
    setQuery({});
    setInfiniteQuery({});
    installMutationMock();
});

describe('route layouts', () => {
    it('shows the root loading gate and redirects signed-in auth routes', async () => {
        mocks.useSession.mockReturnValueOnce({ session: null, isLoading: true });
        const { default: RootLayout } = await import('../app/_layout');
        const loadingRenderer = render(<RootLayout />);

        expect(findAllByHost(loadingRenderer, 'ActivityIndicator')).toHaveLength(1);

        mocks.useSession.mockReturnValue({ session, isLoading: false });
        segmentsMock.mockReturnValue(['(auth)']);

        render(<RootLayout />);

        expect(routerMock.replace).toHaveBeenCalledWith('/');
    });

    it('renders the auth slot', async () => {
        const { default: AuthLayout } = await import('../app/(auth)/_layout');

        const renderer = render(<AuthLayout />);

        expect(findAllByHost(renderer, 'Slot')).toHaveLength(1);
    });

    it('renders tabs with configured icons', async () => {
        const { default: TabsLayout } = await import('../app/(tabs)/_layout');

        const renderer = render(<TabsLayout />);
        const screens = findAllByHost(renderer, 'Tabs.Screen');

        expect(screens.map((screen) => screen.props.name)).toEqual([
            '(calendar)',
            'archive',
            'leagues',
            'account',
        ]);
        const archiveTabPress = screens[1]?.props.listeners.tabPress;
        const preventDefault = vi.fn();
        archiveTabPress({ preventDefault });

        expect(preventDefault).toHaveBeenCalled();
        expect(routerMock.replace).toHaveBeenCalledWith('/archive');
        expect(
            screens[0]?.props.options.tabBarIcon({ color: 'red', focused: true }).props.name
        ).toBe('today');
        expect(
            screens[0]?.props.options.tabBarIcon({ color: 'red', focused: false }).props.name
        ).toBe('today-outline');
    });

    it('renders calendar, archive and league stack screens', async () => {
        const { default: CalendarStackLayout } = await import('../app/(tabs)/(calendar)/_layout');
        const { default: ArchiveStackLayout } = await import('../app/(tabs)/archive/_layout');
        const { default: LeaguesStackLayout } = await import('../app/(tabs)/leagues/_layout');

        const calendarRenderer = render(<CalendarStackLayout />);
        const archiveRenderer = render(<ArchiveStackLayout />);
        const leaguesRenderer = render(<LeaguesStackLayout />);

        expect(
            findAllByHost(calendarRenderer, 'Stack.Screen').map((screen) => screen.props.name)
        ).toEqual(['index', 'puzzle']);
        const archiveScreens = findAllByHost(archiveRenderer, 'Stack.Screen');
        expect(archiveScreens.map((screen) => screen.props.name)).toEqual(['index', '[id]']);
        expect(archiveScreens[1]?.props.dangerouslySingular('[id]', { id: '1' })).toBe(
            archiveScreens[1]?.props.dangerouslySingular('[id]', { id: '2' })
        );
        expect(
            findAllByHost(leaguesRenderer, 'Stack.Screen').map((screen) => screen.props.name)
        ).toEqual(['index', 'new', 'join', '[id]']);
    });
});

describe('auth routes', () => {
    it('validates email before requesting a sign-in code', async () => {
        const { default: EmailScreen } = await import('../app/(auth)/email');
        const renderer = render(<EmailScreen />);

        await pressAsync(findPressableByText(renderer, 'Send code')!);

        expect(allText(renderer)).toContain('Email is required.');
        expect(mocks.login).not.toHaveBeenCalled();

        changeText(findByHost(renderer, 'TextInput'), 'not-an-email');
        await pressAsync(findPressableByText(renderer, 'Send code')!);

        expect(allText(renderer)).toContain('Please enter a valid email address.');
    });

    it('submits normalized email and navigates to code entry', async () => {
        mocks.login.mockResolvedValueOnce({ message: 'sent' });
        const { default: EmailScreen } = await import('../app/(auth)/email');
        const renderer = render(<EmailScreen />);

        changeText(findByHost(renderer, 'TextInput'), ' USER@Example.COM ');
        await pressAsync(findPressableByText(renderer, 'Send code')!);

        expect(mocks.login).toHaveBeenCalledWith('user@example.com');
        expect(routerMock.push).toHaveBeenCalledWith({
            pathname: '/(auth)/code',
            params: { email: 'user@example.com' },
        });
    });

    it('validates and submits verification codes', async () => {
        mocks.verify.mockResolvedValueOnce({ token: 'new-token', user });
        localSearchParamsMock.mockReturnValue({ email: 'user@example.com' });
        const { default: CodeScreen } = await import('../app/(auth)/code');
        const renderer = render(<CodeScreen />);

        await pressAsync(findPressableByText(renderer, 'Verify')!);
        expect(allText(renderer)).toContain('Code is required.');

        changeText(findByHost(renderer, 'TextInput'), 'ab12cd');
        await pressAsync(findPressableByText(renderer, 'Verify')!);

        expect(mocks.verify).toHaveBeenCalledWith('user@example.com', 'AB12CD');
        expect(mocks.signIn).toHaveBeenCalledWith('new-token', user);
    });
});

describe('today landing route', () => {
    it('renders the calendar landing page without a start puzzle button', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[0] === 'puzzle') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            if (options.queryKey[0] === 'account') {
                return {
                    data: {
                        id: 7,
                        email: 'user@example.com',
                        display_name: 'Puzzle Friend',
                        stats: {
                            puzzles_solved: 48,
                            average_score: 90,
                            alltime_total: 1200,
                            weekly_total: 320,
                            today_score: null,
                            percentile: 10,
                            streak: 12,
                        },
                    },
                    isLoading: false,
                    error: null,
                    refetch: mocks.refetch,
                };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        const { default: TodayLandingScreen } = await import('../app/(tabs)/(calendar)/index');
        const renderer = render(<TodayLandingScreen />);

        expect(allText(renderer)).toContain('Puzzle Pause');
        expect(allText(renderer)).toContain('May');
        expect(allText(renderer)).toContain('Day Streak');
        expect(allText(renderer)).toContain('Puzzles Solved');
        expect(findPressableByText(renderer, 'Start Puzzle')).toBeUndefined();
    });

    it('prompts guests to sign in for stats', async () => {
        setSession(null);
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[0] === 'puzzle') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        const { default: TodayLandingScreen } = await import('../app/(tabs)/(calendar)/index');
        const renderer = render(<TodayLandingScreen />);
        const statusQuery = mocks.useQuery.mock.calls.find(
            ([options]) => options.queryKey[0] === 'calendar' && options.queryKey[1] === 'completed'
        )![0];

        press(findPressableByText(renderer, 'Sign in for stats')!);
        await statusQuery.queryFn();

        expect(allText(renderer)).toContain('Sign in for stats');
        expect(routerMock.push).toHaveBeenCalledWith('/(auth)/email');
        expect(mocks.completedDates).toHaveBeenCalledWith(null, '2026-05-01', '2026-05-31');
    });

    it('shows a retry action when today puzzle loading fails', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[0] === 'puzzle') {
                return {
                    data: undefined,
                    isLoading: false,
                    error: new Error('Network down'),
                    refetch: mocks.refetch,
                };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        const { default: TodayLandingScreen } = await import('../app/(tabs)/(calendar)/index');
        const renderer = render(<TodayLandingScreen />);

        expect(allText(renderer)).toContain('Network down');
        press(findPressableByText(renderer, 'Try again')!);

        expect(mocks.refetch).toHaveBeenCalledTimes(1);
    });

    it('renders the calendar when today has no puzzle', async () => {
        localSearchParamsMock.mockReturnValue({ month: '2026-05' });
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[0] === 'puzzle') {
                return {
                    data: undefined,
                    isLoading: false,
                    error: new ApiError(404, 'No puzzle today', null),
                    refetch: mocks.refetch,
                };
            }
            if (options.queryKey[0] === 'calendar') {
                return { data: [], isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        const { default: TodayLandingScreen } = await import('../app/(tabs)/(calendar)/index');
        const renderer = render(<TodayLandingScreen />);

        expect(allText(renderer)).toContain('Puzzle Pause');
        expect(allText(renderer)).toContain('May');
        expect(allText(renderer)).toContain("Today's puzzle is unavailable");
        expect(findPressableByText(renderer, 'Try again')).toBeUndefined();
    });

    it('opens archived calendar puzzles within the calendar stack', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[0] === 'puzzle') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            if (options.queryKey[0] === 'calendar' && options.queryKey[1] === 'puzzles') {
                return {
                    data: [{ id: 2, puzzle_date: '2026-05-02' }],
                    isLoading: false,
                    error: null,
                    refetch: mocks.refetch,
                };
            }
            if (options.queryKey[0] === 'calendar') {
                return {
                    data: { completed_dates: [] },
                    isLoading: false,
                    error: null,
                    refetch: mocks.refetch,
                };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        const { default: TodayLandingScreen } = await import('../app/(tabs)/(calendar)/index');
        const renderer = render(<TodayLandingScreen />);
        const archivedDay = findAllByHost(renderer, 'Pressable').find(
            (node) => textContent(node) === '2'
        );

        press(archivedDay!);

        expect(routerMock.push).toHaveBeenCalledWith('/calendar/archive/2');
    });

    it('marks given-up dates amber and gives solved dates precedence', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[0] === 'puzzle') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            if (options.queryKey[0] === 'calendar' && options.queryKey[1] === 'puzzles') {
                return {
                    data: [
                        { id: 2, puzzle_date: '2026-05-03' },
                        { id: 3, puzzle_date: '2026-05-05' },
                    ],
                    isLoading: false,
                    error: null,
                    refetch: mocks.refetch,
                };
            }
            if (options.queryKey[0] === 'calendar') {
                return {
                    data: {
                        completed_dates: ['2026-05-03'],
                        gave_up_dates: ['2026-05-03', '2026-05-05'],
                    },
                    isLoading: false,
                    error: null,
                    refetch: mocks.refetch,
                };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        const { default: TodayLandingScreen } = await import('../app/(tabs)/(calendar)/index');
        const renderer = render(<TodayLandingScreen />);
        const gaveUpDay = findAllByHost(renderer, 'Pressable').find(
            (node) => node.props.accessibilityLabel === '2026-05-05, gave up.'
        );
        const amberCell = findAllByHost(renderer, 'View').find(
            (node) => textContent(node) === '5' && node.props.style?.backgroundColor === '#ff9f43'
        );
        const solvedCell = findAllByHost(renderer, 'View').find(
            (node) => textContent(node) === '3' && node.props.style?.backgroundColor === '#0d9e7d'
        );

        expect(gaveUpDay).toBeDefined();
        expect(amberCell).toBeDefined();
        expect(solvedCell).toBeDefined();
        expect(
            findAllByHost(renderer, 'Pressable').some(
                (node) => node.props.accessibilityLabel === '2026-05-03, gave up.'
            )
        ).toBe(false);
    });
});

describe('today puzzle route', () => {
    it('renders today puzzle and handles incorrect attempts and hints', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt.mockReturnValueOnce({ correct: false });
        mocks.puzzleHint.mockReturnValueOnce({ hint: 'Try the obvious word', total_hints: 2 });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'wrong');
        press(findPressableByText(renderer, 'Submit')!);
        press(findPressableByText(renderer, 'Hint')!);

        expect(mocks.puzzleAttempt).toHaveBeenCalledWith('jwt-token', 11, 'wrong', null, 0, 0);
        expect(allText(renderer)).toContain('Not quite');
        expect(allText(renderer)).toContain('Hint: Try the obvious word');
    });

    it('shows today hints for guests', async () => {
        setSession(null);
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleHint.mockReturnValueOnce({ hint: 'Guest hint', total_hints: 2 });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        press(findPressableByText(renderer, 'Hint')!);

        expect(mocks.puzzleHint).toHaveBeenCalledWith(null, 11);
        expect(allText(renderer)).toContain('Hint: Guest hint');
    });

    it('gives up today, reveals the result, and uses non-score sharing', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleGiveUp.mockReturnValueOnce({
            correct: false,
            solved: false,
            gave_up: true,
            score: 0,
            incorrect_guesses: 2,
            answer: '~ANSWER|ALTERNATIVE',
            question: 'Guess it',
            explanation: 'This is why.',
            streak: 4,
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        press(findPressableByText(renderer, 'Give up (score 0)')!);
        press(findPressableByText(renderer, 'Share result')!);

        expect(mocks.puzzleGiveUp).toHaveBeenCalledWith('jwt-token', 11);
        expect(mocks.puzzleGiveUp).toHaveBeenCalledTimes(1);
        expect(allText(renderer)).toContain('Gave up');
        expect(allText(renderer)).toContain('ANSWER, ALTERNATIVE');
        expect(allText(renderer)).toContain('This is why.');
        expect(allText(renderer)).not.toContain('Score');
        expect(allText(renderer)).not.toContain('Streak');
        expect(findAllByHost(renderer, 'TextInput')).toHaveLength(0);
        expect(clipboardSetStringAsyncMock).toHaveBeenCalledWith(
            "I tried today's Puzzle Pause! https://puzzlepause.app"
        );
        expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['puzzle', 'today', 'jwt-token'],
        });
        expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['calendar', 'completed', 'jwt-token'],
        });
    });

    it('keeps today playable when give up fails', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleGiveUp.mockImplementationOnce(() => {
            throw new ApiError(429, 'Try again later', null);
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        press(findPressableByText(renderer, 'Give up (score 0)')!);

        expect(allText(renderer)).toContain('Try again later');
        expect(findAllByHost(renderer, 'TextInput')).toHaveLength(1);
        expect(findPressableByText(renderer, 'Give up (score 0)')).toBeDefined();
    });

    it('prevents duplicate today give-up requests while one is pending', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.useMutation.mockImplementation((options) => {
            return {
                isPending: false,
                mutate: (arg: unknown) => {
                    options.mutationFn(arg);
                },
            };
        });
        mocks.puzzleGiveUp.mockReturnValueOnce(new Promise(() => {}));
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);
        const giveUpButton = findPressableByText(renderer, 'Give up (score 0)')!;

        press(giveUpButton);
        press(giveUpButton);

        expect(mocks.puzzleGiveUp).toHaveBeenCalledTimes(1);
    });

    it('treats a stale answer response containing gave_up as terminal', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt.mockReturnValueOnce({
            correct: false,
            solved: false,
            gave_up: true,
            score: 0,
            incorrect_guesses: 0,
            answer: 'ANSWER',
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'stale answer');
        press(findPressableByText(renderer, 'Submit')!);

        expect(allText(renderer)).toContain('Gave up');
        expect(allText(renderer)).not.toContain('Not quite');
    });

    it('restores a hydrated today give-up without fetching the solved result endpoint', async () => {
        setSession(null);
        setGuestPuzzleResult(wordPuzzle as Puzzle, {
            correct: true,
            solved: true,
            score: 99,
            incorrect_guesses: 0,
            answer: 'OLD ANSWER',
        });
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return {
                    data: {
                        ...wordPuzzle,
                        answer: 'ANSWER',
                        explanation: 'Hydrated explanation.',
                        attempt: {
                            ...wordPuzzle.attempt,
                            gave_up: true,
                            score: 0,
                            completed_at: '2026-07-20T12:34:56Z',
                        },
                    },
                    isLoading: false,
                    error: null,
                    refetch: mocks.refetch,
                };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        expect(allText(renderer)).toContain('Gave up');
        expect(allText(renderer)).toContain('Hydrated explanation.');
        expect(allText(renderer)).not.toContain('OLD ANSWER');
        expect(findPressableByText(renderer, 'Give up (score 0)')).toBeUndefined();
    });

    it('keeps today guest hints after remount for scoring', async () => {
        setSession(null);
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleHint.mockReturnValueOnce({ hint: 'Remember this', total_hints: 2 });
        mocks.puzzleAttempt.mockReturnValueOnce({ correct: false, incorrect_guesses: 1 });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const firstRenderer = render(<TodayScreen />);

        press(findPressableByText(firstRenderer, 'Hint')!);
        update(firstRenderer, <></>);
        const secondRenderer = render(<TodayScreen />);
        changeText(findByHost(secondRenderer, 'TextInput'), 'answer');
        press(findPressableByText(secondRenderer, 'Submit')!);

        expect(allText(secondRenderer)).toContain('Hint: Remember this');
        expect(mocks.puzzleAttempt).toHaveBeenCalledWith(null, 11, 'answer', null, 0, 1);
    });

    it('shows today scores for guests', async () => {
        setSession(null);
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt.mockReturnValueOnce({
            correct: true,
            solved: true,
            score: 90,
            incorrect_guesses: 0,
            answer: 'ANSWER',
            opened_at: '2026-05-07T10:00:00Z',
            completed_at: '2026-05-07T10:00:42Z',
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'answer');
        press(findPressableByText(renderer, 'Submit')!);
        press(findPressableByText(renderer, 'Share result')!);

        expect(allText(renderer)).toContain('Score');
        expect(allText(renderer)).toContain('90');
        expect(allText(renderer)).toContain('Copied!');
        expect(clipboardSetStringAsyncMock).toHaveBeenCalledWith(
            "I scored 90 on today's Puzzle Pause in 42s! https://puzzlepause.app"
        );
    });

    it('keeps today guest scores after leaving and returning', async () => {
        setSession(null);
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt.mockReturnValueOnce({
            correct: true,
            solved: true,
            score: 90,
            incorrect_guesses: 0,
            answer: 'ANSWER',
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const firstRenderer = render(<TodayScreen />);

        changeText(findByHost(firstRenderer, 'TextInput'), 'answer');
        press(findPressableByText(firstRenderer, 'Submit')!);
        update(firstRenderer, <></>);
        const secondRenderer = render(<TodayScreen />);

        expect(allText(secondRenderer)).toContain('Score');
        expect(allText(secondRenderer)).toContain('90');
        expect(findAllByHost(secondRenderer, 'TextInput')).toHaveLength(0);
    });

    it('shows the back header after solving today puzzle', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt.mockReturnValueOnce({
            correct: true,
            solved: true,
            score: 90,
            incorrect_guesses: 0,
            answer: 'ANSWER',
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'answer');
        press(findPressableByText(renderer, 'Submit')!);

        expect(findByHost(renderer, 'Stack.Screen').props.options).toEqual(
            expect.objectContaining({
                headerShown: true,
                headerBackButtonDisplayMode: 'minimal',
            })
        );
    });

    it('reveals explanations only after a correct today attempt', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt.mockReturnValueOnce({
            correct: true,
            solved: true,
            score: 90,
            incorrect_guesses: 0,
            answer: 'ANSWER',
            question: 'Guess it',
            explanation: 'The clue points to the answer.',
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'answer');
        press(findPressableByText(renderer, 'Submit')!);

        expect(allText(renderer)).toContain('How it works');
        expect(allText(renderer)).toContain('The clue points to the answer.');
        expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['calendar', 'completed', 'jwt-token'],
        });
        expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['account', 'jwt-token'],
        });
    });

    it('does not render blank today explanations', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return { data: wordPuzzle, isLoading: false, error: null, refetch: mocks.refetch };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt.mockReturnValueOnce({
            correct: true,
            solved: true,
            score: 90,
            incorrect_guesses: 0,
            answer: 'ANSWER',
            explanation: '',
        });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'answer');
        press(findPressableByText(renderer, 'Submit')!);

        expect(allText(renderer)).not.toContain('How it works');
    });

    it('uses updated attempt state after incorrect choice guesses', async () => {
        mocks.useQuery.mockImplementation((options) => {
            if (options.queryKey[1] === 'today') {
                return {
                    data: choicePuzzle,
                    isLoading: false,
                    error: null,
                    refetch: mocks.refetch,
                };
            }
            return { data: undefined, isLoading: false, error: null, refetch: mocks.refetch };
        });
        mocks.puzzleAttempt
            .mockReturnValueOnce({
                correct: false,
                solved: false,
                score: null,
                incorrect_guesses: 1,
                opened_at: '2026-05-07T10:00:00Z',
            })
            .mockReturnValueOnce({
                correct: false,
                solved: false,
                score: null,
                incorrect_guesses: 2,
                opened_at: '2026-05-07T10:00:00Z',
            });
        const { default: TodayScreen } = await import('../app/(tabs)/(calendar)/puzzle');
        const renderer = render(<TodayScreen />);

        press(findPressableByText(renderer, 'Alpha')!);
        press(findPressableByText(renderer, 'Beta')!);

        expect(mocks.puzzleAttempt).toHaveBeenNthCalledWith(1, 'jwt-token', 12, 'A', null, 0, 0);
        expect(mocks.puzzleAttempt).toHaveBeenNthCalledWith(
            2,
            'jwt-token',
            12,
            'B',
            '2026-05-07T10:00:00Z',
            1,
            0
        );
    });
});

describe('archive routes', () => {
    it('requests filtered archive pages and opens selected puzzles', async () => {
        setInfiniteQuery({
            data: {
                pages: [
                    [
                        {
                            id: 1,
                            puzzle_date: '2026-05-01',
                            puzzle_type: 'word',
                            puzzle_name: 'Solved Puzzle',
                            hint: null,
                            has_hint: false,
                            puzzle_number: 10,
                            solved: true,
                        },
                        {
                            id: 2,
                            puzzle_date: '2026-05-02',
                            puzzle_type: 'word',
                            puzzle_name: 'Open Puzzle',
                            hint: null,
                            has_hint: false,
                            puzzle_number: 11,
                            solved: false,
                        },
                    ],
                ],
                pageParams: [0],
            },
        });
        const { default: ArchiveListScreen } = await import('../app/(tabs)/archive/index');
        const renderer = render(<ArchiveListScreen />);

        expect(allText(renderer)).toContain('Solved Puzzle');
        expect(allText(renderer)).toContain('Open Puzzle');

        press(findPressableByText(renderer, 'unsolved')!);

        expect(mocks.useInfiniteQuery).toHaveBeenLastCalledWith(
            expect.objectContaining({
                queryKey: ['archive', 'list', 'jwt-token', 'unsolved'],
            })
        );

        press(findPressableByText(renderer, 'Open Puzzle')!);

        expect(routerMock.push).toHaveBeenCalledWith('/archive/2');
    });

    it('renders archive detail puzzles and handles attempts and hints', async () => {
        localSearchParamsMock.mockReturnValue({ id: '11' });
        setQuery({ data: wordPuzzle });
        mocks.archiveAttempt.mockReturnValueOnce({ correct: true, solved: true, score: 90 });
        mocks.archiveHint.mockReturnValueOnce({ hint: 'Archive hint', total_hints: 2 });
        const { default: ArchiveDetailScreen } = await import('../app/(tabs)/archive/[id]');
        const renderer = render(<ArchiveDetailScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'answer');
        press(findPressableByText(renderer, 'Hint')!);
        press(findPressableByText(renderer, 'Submit')!);

        expect(mocks.archiveHint).toHaveBeenCalledWith('jwt-token', 11);
        expect(mocks.archiveAttempt).toHaveBeenCalledWith('jwt-token', 11, 'answer', null, 0, 1);
        expect(allText(renderer)).toContain('Solved!');
        expect(allText(renderer)).toContain('Score');
        expect(allText(renderer)).toContain('90');
    });

    it('shows archive scores for guests', async () => {
        setSession(null);
        localSearchParamsMock.mockReturnValue({ id: '11' });
        setQuery({ data: wordPuzzle });
        mocks.archiveAttempt.mockReturnValueOnce({
            correct: true,
            solved: true,
            score: 85,
            opened_at: '2026-05-07T10:00:00Z',
            completed_at: '2026-05-07T10:08:10Z',
        });
        const { default: ArchiveDetailScreen } = await import('../app/(tabs)/archive/[id]');
        const renderer = render(<ArchiveDetailScreen />);

        changeText(findByHost(renderer, 'TextInput'), 'answer');
        press(findPressableByText(renderer, 'Submit')!);
        press(findPressableByText(renderer, 'Share result')!);

        expect(allText(renderer)).toContain('Score');
        expect(allText(renderer)).toContain('85');
        expect(allText(renderer)).toContain('Copied!');
        expect(clipboardSetStringAsyncMock).toHaveBeenCalledWith(
            'I scored 85 on Puzzle Pause #42 in 8m! https://puzzlepause.app/archive/11'
        );
    });

    it('shows archive hints for guests', async () => {
        setSession(null);
        localSearchParamsMock.mockReturnValue({ id: '11' });
        mocks.archiveHint.mockReturnValueOnce({ hint: 'Guest archive hint', total_hints: 2 });
        setQuery({ data: wordPuzzle });
        const { default: ArchiveDetailScreen } = await import('../app/(tabs)/archive/[id]');
        const renderer = render(<ArchiveDetailScreen />);

        press(findPressableByText(renderer, 'Hint')!);

        expect(mocks.archiveHint).toHaveBeenCalledWith(null, 11);
        expect(allText(renderer)).toContain('Hint: Guest archive hint');
    });

    it('gives up an archive puzzle and hides solved-only result details', async () => {
        localSearchParamsMock.mockReturnValue({ id: '11' });
        setQuery({ data: wordPuzzle });
        mocks.archiveGiveUp.mockReturnValueOnce({
            correct: false,
            solved: false,
            gave_up: true,
            score: 0,
            incorrect_guesses: 3,
            answer: 'ANSWER',
            explanation: 'Archive give-up explanation.',
        });
        const { default: ArchiveDetailScreen } = await import('../app/(tabs)/archive/[id]');
        const renderer = render(<ArchiveDetailScreen />);

        press(findPressableByText(renderer, 'Give up (score 0)')!);
        press(findPressableByText(renderer, 'Share result')!);

        expect(mocks.archiveGiveUp).toHaveBeenCalledWith('jwt-token', 11);
        expect(mocks.archiveGiveUp).toHaveBeenCalledTimes(1);
        expect(allText(renderer)).toContain('Gave up');
        expect(allText(renderer)).toContain('ANSWER');
        expect(allText(renderer)).toContain('Archive give-up explanation.');
        expect(allText(renderer)).not.toContain('Score');
        expect(allText(renderer)).not.toContain('Incorrect guesses');
        expect(clipboardSetStringAsyncMock).toHaveBeenCalledWith(
            'I tried Daily Word on Puzzle Pause! https://puzzlepause.app/archive/11'
        );
        expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['archive', 'detail', 11, 'jwt-token'],
        });
        expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['calendar', 'completed', 'jwt-token'],
        });
    });

    it('keeps archive guest hints after remount for scoring', async () => {
        setSession(null);
        localSearchParamsMock.mockReturnValue({ id: '11' });
        mocks.archiveHint.mockReturnValueOnce({ hint: 'Remember archive hint', total_hints: 2 });
        mocks.archiveAttempt.mockReturnValueOnce({ correct: false, incorrect_guesses: 1 });
        setQuery({ data: wordPuzzle });
        const { default: ArchiveDetailScreen } = await import('../app/(tabs)/archive/[id]');
        const firstRenderer = render(<ArchiveDetailScreen />);

        press(findPressableByText(firstRenderer, 'Hint')!);
        update(firstRenderer, <></>);
        const secondRenderer = render(<ArchiveDetailScreen />);
        changeText(findByHost(secondRenderer, 'TextInput'), 'answer');
        press(findPressableByText(secondRenderer, 'Submit')!);

        expect(allText(secondRenderer)).toContain('Hint: Remember archive hint');
        expect(mocks.archiveAttempt).toHaveBeenCalledWith(null, 11, 'answer', null, 0, 1);
    });

    it('prompts guests to sign in after viewing solved archive results', async () => {
        setSession(null);
        localSearchParamsMock.mockReturnValue({ id: '11' });
        setQuery({
            data: {
                ...wordPuzzle,
                solved: true,
                answer: 'ANSWER',
                explanation: 'Archive explanation.',
                attempt: {
                    solved: true,
                    score: 100,
                    incorrect_guesses: 1,
                    hint_used: 0,
                    completed_at: '2026-05-07T10:00:00Z',
                },
            },
        });
        const { default: ArchiveDetailScreen } = await import('../app/(tabs)/archive/[id]');
        const renderer = render(<ArchiveDetailScreen />);

        press(findPressableByText(renderer, 'Sign in to save your progress')!);

        expect(allText(renderer)).toContain('ANSWER');
        expect(allText(renderer)).toContain('How it works');
        expect(allText(renderer)).toContain('Archive explanation.');
        expect(allText(renderer)).toContain('Incorrect guesses');
        expect(routerMock.push).toHaveBeenCalledWith('/(auth)/email');
    });
});

describe('account route', () => {
    it('renders stats, saves display names, and signs out', async () => {
        setQuery({
            data: {
                id: 7,
                email: 'user@example.com',
                display_name: 'Puzzle Friend',
                stats: {
                    puzzles_solved: 5,
                    average_score: 87.6,
                    alltime_total: 438,
                    weekly_total: 120,
                    today_score: null,
                    percentile: 0,
                    streak: 2,
                },
            },
        });
        mocks.updateDisplayName.mockReturnValueOnce({ ...user, display_name: 'New Name' });
        const { default: AccountScreen } = await import('../app/(tabs)/account');
        const renderer = render(<AccountScreen />);

        expect(allText(renderer)).toContain('Account');
        expect(allText(renderer)).toContain('2 days');
        expect(allText(renderer)).toContain('Top 1%');

        changeText(findByHost(renderer, 'TextInput'), ' New Name ');
        press(findPressableByText(renderer, 'Save')!);
        press(findPressableByText(renderer, 'Sign out')!);

        expect(mocks.updateDisplayName).toHaveBeenCalledWith('jwt-token', 'New Name');
        expect(mocks.queryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ['account', 'jwt-token'],
        });
        expect(mocks.signOut).toHaveBeenCalledTimes(1);
    });

    it('confirms and deletes the account', async () => {
        setQuery({
            data: {
                id: 7,
                email: 'user@example.com',
                display_name: 'Puzzle Friend',
                stats: {
                    puzzles_solved: 5,
                    average_score: 87.6,
                    alltime_total: 438,
                    weekly_total: 120,
                    today_score: null,
                    percentile: 0,
                    streak: 2,
                },
            },
        });
        mocks.deleteAccount.mockReturnValueOnce({ message: 'Account deleted successfully' });
        const { default: AccountScreen } = await import('../app/(tabs)/account');
        const renderer = render(<AccountScreen />);

        press(findPressableByText(renderer, 'Delete account')!);
        expect(allText(renderer)).toContain('This permanently deletes your account');

        press(findPressableByText(renderer, 'Yes, delete my account')!);

        expect(mocks.deleteAccount).toHaveBeenCalledWith('jwt-token');
        expect(mocks.signOut).toHaveBeenCalledTimes(1);
        expect(routerMock.replace).toHaveBeenCalledWith('/(auth)/email');
        expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    });

    it('dismisses confirmation and shows an error when deletion fails', async () => {
        setQuery({
            data: {
                id: 7,
                email: 'user@example.com',
                display_name: 'Puzzle Friend',
                stats: {
                    puzzles_solved: 5,
                    average_score: 87.6,
                    alltime_total: 438,
                    weekly_total: 120,
                    today_score: null,
                    percentile: 0,
                    streak: 2,
                },
            },
        });
        mocks.deleteAccount.mockImplementationOnce(() => {
            throw new ApiError(500, 'Delete failed', null);
        });
        const { default: AccountScreen } = await import('../app/(tabs)/account');
        const renderer = render(<AccountScreen />);

        press(findPressableByText(renderer, 'Delete account')!);
        press(findPressableByText(renderer, 'Yes, delete my account')!);

        expect(allText(renderer)).toContain('Delete failed');
        expect(allText(renderer)).not.toContain('Delete your account?');
        expect(routerMock.replace).not.toHaveBeenCalled();
    });
});

describe('league routes', () => {
    it('shows a guest prompt when leagues require sign-in', async () => {
        setSession(null);
        const { default: LeaguesListScreen } = await import('../app/(tabs)/leagues/index');
        const renderer = render(<LeaguesListScreen />);

        expect(allText(renderer)).toContain('Sign in to create and join leagues');
    });

    it('shows guest prompts for direct league child routes', async () => {
        setSession(null);
        localSearchParamsMock.mockReturnValue({ id: '3' });
        const { default: LeagueDetailScreen } = await import('../app/(tabs)/leagues/[id]');
        const { default: JoinLeagueScreen } = await import('../app/(tabs)/leagues/join');
        const { default: NewLeagueScreen } = await import('../app/(tabs)/leagues/new');

        expect(allText(render(<LeagueDetailScreen />))).toContain(
            'Sign in to view league standings'
        );
        expect(allText(render(<JoinLeagueScreen />))).toContain('Sign in to join leagues');
        expect(allText(render(<NewLeagueScreen />))).toContain('Sign in to create leagues');
    });

    it('renders league rows and navigates to actions/details', async () => {
        setQuery({
            data: [
                {
                    id: 3,
                    name: 'Friends',
                    invite_code: 'ABC123',
                    creator_id: 7,
                    member_count: 2,
                    user_rank: 1,
                    user_score: 42,
                },
            ],
        });
        const { default: LeaguesListScreen } = await import('../app/(tabs)/leagues/index');
        const renderer = render(<LeaguesListScreen />);

        press(findPressableByText(renderer, 'Join')!);
        press(findPressableByText(renderer, 'Create')!);
        press(findPressableByText(renderer, 'Friends')!);

        expect(routerMock.push).toHaveBeenCalledWith('/leagues/join');
        expect(routerMock.push).toHaveBeenCalledWith('/leagues/new');
        expect(routerMock.push).toHaveBeenCalledWith('/leagues/3');
    });

    it('validates and creates a league', async () => {
        mocks.leagueCreate.mockReturnValueOnce({ id: 9 });
        const { default: NewLeagueScreen } = await import('../app/(tabs)/leagues/new');
        const renderer = render(<NewLeagueScreen />);

        press(findPressableByText(renderer, 'Create league')!);
        expect(allText(renderer)).toContain('League name is required.');

        changeText(findByHost(renderer, 'TextInput'), ' New League ');
        press(findPressableByText(renderer, 'Create league')!);

        expect(mocks.leagueCreate).toHaveBeenCalledWith('jwt-token', 'New League');
        expect(routerMock.replace).toHaveBeenCalledWith('/leagues/9');
    });

    it('validates and joins a league', async () => {
        mocks.leagueJoin.mockReturnValueOnce({ id: 12 });
        const { default: JoinLeagueScreen } = await import('../app/(tabs)/leagues/join');
        const renderer = render(<JoinLeagueScreen />);

        press(findPressableByText(renderer, 'Join league')!);
        expect(allText(renderer)).toContain('Invite code is required.');

        changeText(findByHost(renderer, 'TextInput'), ' ABC123 ');
        press(findPressableByText(renderer, 'Join league')!);

        expect(mocks.leagueJoin).toHaveBeenCalledWith('jwt-token', 'ABC123');
        expect(routerMock.replace).toHaveBeenCalledWith('/leagues/12');
    });

    it('renders league detail, switches leaderboards, and confirms deletion', async () => {
        localSearchParamsMock.mockReturnValue({ id: '3' });
        setQuery({
            data: {
                id: 3,
                name: 'Friends',
                invite_code: 'ABC123',
                creator_id: 7,
                member_count: 2,
                user_rank: 1,
                user_score: 42,
                leaderboard_today: [
                    { user_id: 7, display_name: 'Puzzle Friend', score: 42, rank: 1 },
                ],
                leaderboard_weekly: [],
                leaderboard_alltime: [{ user_id: 8, display_name: null, score: null, rank: 2 }],
                tags: {
                    guesser: { user_id: 7, display_name: 'Puzzle Friend' },
                    one_shotter: null,
                    early_riser: null,
                    hint_lover: null,
                },
            },
        });
        mocks.leagueDelete.mockReturnValueOnce(null);
        const { default: LeagueDetailScreen } = await import('../app/(tabs)/leagues/[id]');
        const renderer = render(<LeagueDetailScreen />);

        expect(allText(renderer)).toContain('ABC123');
        expect(allText(renderer)).toContain('Most Guesses');

        press(findPressableByText(renderer, 'Weekly')!);
        expect(allText(renderer)).toContain('No scores yet.');

        press(findPressableByText(renderer, 'Delete league')!);
        const [, , buttons] = vi.mocked(Alert.alert).mock.calls[0] as [
            string,
            string,
            { onPress?: () => void }[],
        ];
        buttons[1]!.onPress!();

        expect(mocks.leagueDelete).toHaveBeenCalledWith('jwt-token', 3);
        expect(mocks.queryClient.removeQueries).toHaveBeenCalledWith({
            queryKey: ['leagues', 'detail', 3, 'jwt-token'],
        });
        expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
});
