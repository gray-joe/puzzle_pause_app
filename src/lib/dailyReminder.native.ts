import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { ReminderState, ReminderTime } from './dailyReminder';

export type { ReminderState, ReminderTime } from './dailyReminder';
export const remindersSupported = true;
export const REMINDER_ID = 'puzzle-pause-daily-reminder';
const CHANNEL_ID = 'daily-puzzle';
const TIME_KEY = 'pp_daily_reminder_time_v1';

function validTime(time: unknown): time is ReminderTime {
    if (!time || typeof time !== 'object' || !('hour' in time) || !('minute' in time)) return false;
    return (
        typeof time.hour === 'number' &&
        Number.isInteger(time.hour) &&
        time.hour >= 0 &&
        time.hour <= 23 &&
        typeof time.minute === 'number' &&
        Number.isInteger(time.minute) &&
        time.minute >= 0 &&
        time.minute <= 59
    );
}

function allowed(permission: Notifications.NotificationPermissionsStatus): boolean {
    return (
        permission.granted ||
        permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
}

export async function getDailyReminder(): Promise<ReminderState> {
    let time: ReminderTime = { hour: 9, minute: 0 };
    const raw = await SecureStore.getItemAsync(TIME_KEY);
    try {
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && validTime(saved)) time = saved;
    } catch {
        // Ignore invalid preferences; the OS schedule remains the source of truth.
    }
    const [permission, schedules] = await Promise.all([
        Notifications.getPermissionsAsync(),
        Notifications.getAllScheduledNotificationsAsync(),
    ]);
    const schedule = schedules.find((item) => item.identifier === REMINDER_ID);
    const trigger = schedule?.trigger;
    const components = trigger && 'dateComponents' in trigger ? trigger.dateComponents : trigger;
    if (validTime(components)) time = { hour: components.hour, minute: components.minute };
    const channel =
        Platform.OS === 'android'
            ? await Notifications.getNotificationChannelAsync(CHANNEL_ID)
            : null;
    return {
        ...time,
        enabled: !!schedule,
        blocked:
            (!allowed(permission) && (!!schedule || !permission.canAskAgain)) ||
            channel?.importance === Notifications.AndroidImportance.NONE,
    };
}

// Called only from explicit user actions, never on launch.
export async function setDailyReminder(enabled: boolean, time: ReminderTime): Promise<void> {
    if (!validTime(time)) throw new Error('Enter a valid time using the 24-hour clock.');
    if (!enabled) {
        await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
        await Notifications.dismissNotificationAsync(REMINDER_ID);
        return;
    }
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Daily puzzle reminder',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: null,
            enableVibrate: false,
        });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (!allowed(permission) && permission.canAskAgain) {
        permission = await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowBadge: false, allowSound: false },
        });
    }
    if (!allowed(permission)) {
        throw new Error('Notifications are not allowed. You can enable them in system settings.');
    }
    // Save before scheduling so a storage failure cannot silently enable a reminder.
    await SecureStore.setItemAsync(TIME_KEY, JSON.stringify(time));
    // A stable identifier replaces the existing request instead of creating duplicates.
    await Notifications.scheduleNotificationAsync({
        identifier: REMINDER_ID,
        content: {
            title: 'Time for a Puzzle Pause',
            body: 'Take a moment for your daily puzzle.',
            data: { kind: 'daily-puzzle' },
            sound: false,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: time.hour,
            minute: time.minute,
            channelId: CHANNEL_ID,
        },
    });
}
