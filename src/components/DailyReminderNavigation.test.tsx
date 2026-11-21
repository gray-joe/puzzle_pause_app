import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, update } from '../test/render';

const mocks = vi.hoisted(() => ({
    response: null as any,
    navigation: { key: 'ready' } as { key?: string },
    replace: vi.fn(),
    clear: vi.fn(() => Promise.resolve()),
    setHandler: vi.fn(),
}));
vi.mock('expo-notifications', () => ({
    setNotificationHandler: mocks.setHandler,
    useLastNotificationResponse: () => mocks.response,
    clearLastNotificationResponseAsync: mocks.clear,
    DEFAULT_ACTION_IDENTIFIER: 'default',
}));
vi.mock('expo-router', () => ({
    useRouter: () => ({ replace: mocks.replace }),
    useRootNavigationState: () => mocks.navigation,
}));
import { DailyReminderNavigation } from './DailyReminderNavigation.native';

let renderer: ReactTestRenderer;
const response = (identifier = 'puzzle-pause-daily-reminder', actionIdentifier = 'default') => ({
    actionIdentifier,
    notification: {
        request: { identifier, content: { data: { url: 'https://untrusted.example' } } },
    },
});

describe('daily reminder notification taps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.response = null;
        mocks.navigation = { key: 'ready' };
    });
    afterEach(() => {
        act(() => renderer?.unmount());
    });

    it('opens today on a cold-start response and clears the consumed response', async () => {
        mocks.response = response();
        renderer = render(<DailyReminderNavigation />);
        await act(async () => {});
        expect(mocks.replace).toHaveBeenCalledWith('/');
        expect(mocks.clear).toHaveBeenCalledOnce();
        update(renderer, <DailyReminderNavigation />);
        expect(mocks.replace).toHaveBeenCalledOnce();
    });

    it('waits for navigation readiness', () => {
        mocks.response = response();
        mocks.navigation = {};
        renderer = render(<DailyReminderNavigation />);
        expect(mocks.replace).not.toHaveBeenCalled();
        mocks.navigation = { key: 'ready' };
        update(renderer, <DailyReminderNavigation />);
        expect(mocks.replace).toHaveBeenCalledWith('/');
    });

    it('handles taps received while running', () => {
        renderer = render(<DailyReminderNavigation />);
        expect(mocks.replace).not.toHaveBeenCalled();
        mocks.response = response();
        update(renderer, <DailyReminderNavigation />);
        expect(mocks.replace).toHaveBeenCalledWith('/');
    });

    it.each([
        ['other-notification', 'default'],
        ['puzzle-pause-daily-reminder', 'dismiss'],
    ])('ignores unrelated notifications and non-tap actions', (identifier, action) => {
        mocks.response = response(identifier, action);
        renderer = render(<DailyReminderNavigation />);
        expect(mocks.replace).not.toHaveBeenCalled();
        expect(mocks.clear).not.toHaveBeenCalled();
    });
});
