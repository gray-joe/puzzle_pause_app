import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const notifications = vi.hoisted(() => ({
    getPermissionsAsync: vi.fn(),
    requestPermissionsAsync: vi.fn(),
    getAllScheduledNotificationsAsync: vi.fn(),
    setNotificationChannelAsync: vi.fn(),
    getNotificationChannelAsync: vi.fn(),
    scheduleNotificationAsync: vi.fn(),
    cancelScheduledNotificationAsync: vi.fn(),
    dismissNotificationAsync: vi.fn(),
    IosAuthorizationStatus: { PROVISIONAL: 3 },
    AndroidImportance: { DEFAULT: 3, NONE: 0 },
    SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
vi.mock('expo-notifications', () => notifications);
import { getDailyReminder, setDailyReminder, REMINDER_ID } from './dailyReminder.native';

const granted = { granted: true, canAskAgain: true };
const denied = { granted: false, canAskAgain: false };

describe('local daily reminders', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Platform.OS = 'ios';
        notifications.getPermissionsAsync.mockResolvedValue(granted);
        notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
        notifications.getNotificationChannelAsync.mockResolvedValue(null);
        notifications.scheduleNotificationAsync.mockResolvedValue(REMINDER_ID);
        vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
        vi.mocked(SecureStore.setItemAsync).mockResolvedValue();
    });

    it('defaults to off at 09:00 without requesting permission', async () => {
        expect(await getDailyReminder()).toEqual({
            hour: 9,
            minute: 0,
            enabled: false,
            blocked: false,
        });
        expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
        expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('schedules a quiet repeating local-time reminder with a stable identifier', async () => {
        await setDailyReminder(true, { hour: 18, minute: 30 });
        await setDailyReminder(true, { hour: 10, minute: 15 });
        expect(notifications.scheduleNotificationAsync).toHaveBeenLastCalledWith({
            identifier: REMINDER_ID,
            content: {
                title: 'Time for a Puzzle Pause',
                body: 'Take a moment for your daily puzzle.',
                data: { kind: 'daily-puzzle' },
                sound: false,
            },
            trigger: { type: 'daily', hour: 10, minute: 15, channelId: 'daily-puzzle' },
        });
        expect(
            notifications.scheduleNotificationAsync.mock.calls.map(
                ([request]) => request.identifier
            )
        ).toEqual([REMINDER_ID, REMINDER_ID]);
    });

    it('requests permission only when enabling, without sound or badge permission', async () => {
        notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
        notifications.requestPermissionsAsync.mockResolvedValue(granted);
        await setDailyReminder(true, { hour: 9, minute: 0 });
        expect(notifications.requestPermissionsAsync).toHaveBeenCalledWith({
            ios: { allowAlert: true, allowBadge: false, allowSound: false },
        });
    });

    it('does not schedule after permission is denied', async () => {
        notifications.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
        notifications.requestPermissionsAsync.mockResolvedValue(denied);
        await expect(setDailyReminder(true, { hour: 9, minute: 0 })).rejects.toThrow(
            'system settings'
        );
        expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('does not repeatedly prompt when permission is blocked', async () => {
        notifications.getPermissionsAsync.mockResolvedValue(denied);
        expect((await getDailyReminder()).blocked).toBe(true);
        await expect(setDailyReminder(true, { hour: 9, minute: 0 })).rejects.toThrow();
        expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('accepts provisional authorization', async () => {
        notifications.getPermissionsAsync.mockResolvedValue({ ...denied, ios: { status: 3 } });
        await setDailyReminder(true, { hour: 9, minute: 0 });
        expect(notifications.scheduleNotificationAsync).toHaveBeenCalledOnce();
    });

    it('cancels only our reminder and dismisses it without requesting permission', async () => {
        await setDailyReminder(false, { hour: 9, minute: 0 });
        expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
        expect(notifications.dismissNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
        expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
        expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('loads saved time and uses the actual scheduled time when enabled', async () => {
        vi.mocked(SecureStore.getItemAsync).mockResolvedValue('{"hour":16,"minute":20}');
        expect(await getDailyReminder()).toMatchObject({ hour: 16, minute: 20, enabled: false });
        notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
            { identifier: REMINDER_ID, trigger: { hour: 7, minute: 45 } },
        ]);
        expect(await getDailyReminder()).toMatchObject({ hour: 7, minute: 45, enabled: true });
    });

    it('reads iOS calendar date components as the authoritative time', async () => {
        notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
            {
                identifier: REMINDER_ID,
                trigger: { type: 'calendar', dateComponents: { hour: 20, minute: 10 } },
            },
        ]);
        expect(await getDailyReminder()).toMatchObject({ hour: 20, minute: 10, enabled: true });
    });

    it('reports a blocked Android channel', async () => {
        Platform.OS = 'android';
        notifications.getNotificationChannelAsync.mockResolvedValue({ importance: 0 });
        expect((await getDailyReminder()).blocked).toBe(true);
    });

    it('ignores corrupt saved preferences and unrelated schedules', async () => {
        vi.mocked(SecureStore.getItemAsync).mockResolvedValue('bad json');
        notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
            { identifier: 'other' },
        ]);
        expect(await getDailyReminder()).toMatchObject({ hour: 9, minute: 0, enabled: false });
    });

    it.each([
        { hour: -1, minute: 0 },
        { hour: 24, minute: 0 },
        { hour: 12, minute: 60 },
        { hour: 1.5, minute: 0 },
    ])('rejects invalid time %j', async (time) => {
        await expect(setDailyReminder(true, time)).rejects.toThrow('valid time');
        expect(notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('creates an Android channel before requesting permission', async () => {
        Platform.OS = 'android';
        await setDailyReminder(true, { hour: 9, minute: 0 });
        expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith('daily-puzzle', {
            name: 'Daily puzzle reminder',
            importance: 3,
            sound: null,
            enableVibrate: false,
        });
        expect(notifications.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
            notifications.getPermissionsAsync.mock.invocationCallOrder[0]
        );
    });

    it('propagates scheduling errors without deleting the previous reminder first', async () => {
        notifications.scheduleNotificationAsync.mockRejectedValueOnce(
            new Error('OS scheduling failed')
        );
        await expect(setDailyReminder(true, { hour: 9, minute: 0 })).rejects.toThrow(
            'OS scheduling failed'
        );
        expect(notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
});
