// Web fallback. Metro resolves dailyReminder.native.ts on iOS and Android.
export type ReminderTime = { hour: number; minute: number };
export type ReminderState = ReminderTime & { enabled: boolean; blocked: boolean };
export const remindersSupported = false;
export const REMINDER_ID = 'puzzle-pause-daily-reminder';
export async function getDailyReminder(): Promise<ReminderState> {
    return { enabled: false, blocked: false, hour: 9, minute: 0 };
}
export async function setDailyReminder(_enabled: boolean, _time: ReminderTime): Promise<void> {
    throw new Error('Daily reminders are available in the iOS and Android app.');
}
