import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import {
    getDailyReminder,
    remindersSupported,
    setDailyReminder,
    type ReminderState,
} from '../lib/dailyReminder';
import { useTheme } from '../theme';
import { Button } from './Button';
import { TextInput } from './TextInput';

export function DailyReminderSettings() {
    const { colors, spacing, typography } = useTheme();
    const [state, setState] = useState<ReminderState | null>(null);
    const [time, setTime] = useState('09:00');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        const next = await getDailyReminder();
        setState(next);
        setTime(`${String(next.hour).padStart(2, '0')}:${String(next.minute).padStart(2, '0')}`);
    }, []);

    useEffect(() => {
        if (!remindersSupported) return;
        void load().catch(() => setError('Could not load reminder settings. Please try again.'));
        const subscription = AppState.addEventListener('change', (status) => {
            if (status === 'active') {
                void load().catch(() =>
                    setError('Could not load reminder settings. Please try again.')
                );
            }
        });
        return () => subscription.remove();
    }, [load]);

    if (!remindersSupported) return null;

    const update = async (enabled: boolean) => {
        const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
        const hour = match ? Number(match[1]) : -1;
        const minute = match ? Number(match[2]) : -1;
        if (enabled && (hour < 0 || hour > 23 || minute < 0 || minute > 59)) {
            setError('Enter a time in 24-hour format, for example 09:00 or 18:30.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await setDailyReminder(enabled, enabled ? { hour, minute } : state!);
            await load();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Could not update your reminder. Try again.'
            );
            // Permission may have changed after the system prompt. Keep the entered time.
            try {
                setState(await getDailyReminder());
            } catch {
                /* Retain the last known state. */
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={{ gap: spacing.sm }}>
            <Text style={[typography.title, { color: colors.text }]}>Daily puzzle reminder</Text>
            <Text style={[typography.body, { color: colors.textMuted }]}>
                Optional, once a day on this device, even if you have already played. No account
                needed. Your phone may delay or silence reminders.
            </Text>
            {state ? (
                <>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {state.blocked
                            ? 'Notifications blocked in system settings.'
                            : state.enabled
                              ? 'Reminder on'
                              : 'Reminder off'}
                    </Text>
                    <TextInput
                        label="Reminder time (24-hour, local time)"
                        value={time}
                        onChangeText={setTime}
                        placeholder="09:00"
                        maxLength={5}
                        autoCorrect={false}
                        editable={!busy}
                        accessibilityLabel="Daily reminder time"
                    />
                    <Button
                        title={state.enabled ? 'Save reminder time' : 'Enable daily reminder'}
                        onPress={() => void update(true)}
                        loading={busy}
                    />
                    {state.enabled && (
                        <Button
                            title="Turn off reminder"
                            variant="secondary"
                            disabled={busy}
                            onPress={() => void update(false)}
                        />
                    )}
                    {state.blocked && (
                        <Button
                            title="Open notification settings"
                            variant="secondary"
                            disabled={busy}
                            onPress={() => {
                                void Linking.openSettings().catch(() =>
                                    setError(
                                        'Could not open settings. Open your phone settings manually.'
                                    )
                                );
                            }}
                        />
                    )}
                </>
            ) : (
                <Button
                    title="Load reminder settings"
                    variant="secondary"
                    onPress={() => {
                        setError('');
                        void load().catch(() =>
                            setError('Could not load reminder settings. Please try again.')
                        );
                    }}
                />
            )}
            {error ? (
                <Text accessibilityRole="alert" style={[typography.body, { color: colors.error }]}>
                    {error}
                </Text>
            ) : null}
        </View>
    );
}
