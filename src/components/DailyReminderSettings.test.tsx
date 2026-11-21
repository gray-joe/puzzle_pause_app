import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Linking } from 'react-native';
import {
    allText,
    changeText,
    findAllByHost,
    findPressableByText,
    pressAsync,
    render,
} from '../test/render';

const service = vi.hoisted(() => ({
    remindersSupported: true,
    getDailyReminder: vi.fn(),
    setDailyReminder: vi.fn(),
}));
vi.mock('../lib/dailyReminder', () => service);
import { DailyReminderSettings } from './DailyReminderSettings';

let renderer: ReactTestRenderer;
const off = { enabled: false, blocked: false, hour: 9, minute: 0 };
async function mount() {
    renderer = render(<DailyReminderSettings />);
    await act(async () => {});
}
async function press(label: string) {
    await pressAsync(findPressableByText(renderer, label)!);
}

describe('daily reminder settings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        service.getDailyReminder.mockResolvedValue(off);
        service.setDailyReminder.mockResolvedValue(undefined);
    });
    afterEach(() => {
        act(() => renderer?.unmount());
    });

    it('does not request or schedule anything on mount', async () => {
        await mount();
        expect(allText(renderer)).toContain('Reminder off');
        expect(service.setDailyReminder).not.toHaveBeenCalled();
    });

    it('enables only from an explicit action and saves a chosen time', async () => {
        await mount();
        changeText(findAllByHost(renderer, 'TextInput')[0], '18:30');
        service.getDailyReminder.mockResolvedValue({ ...off, hour: 18, minute: 30, enabled: true });
        await press('Enable daily reminder');
        expect(service.setDailyReminder).toHaveBeenCalledWith(true, { hour: 18, minute: 30 });
        expect(allText(renderer)).toContain('Reminder on');
    });

    it('rejects malformed and out-of-range times before touching the OS', async () => {
        await mount();
        for (const value of ['25:00', '9:99', 'nope', '']) {
            changeText(findAllByHost(renderer, 'TextInput')[0], value);
            await press('Enable daily reminder');
            expect(allText(renderer)).toContain('Enter a time in 24-hour format');
        }
        expect(service.setDailyReminder).not.toHaveBeenCalled();
    });

    it('lets users disable even if the edited time is invalid', async () => {
        service.getDailyReminder.mockResolvedValue({ ...off, enabled: true });
        await mount();
        changeText(findAllByHost(renderer, 'TextInput')[0], 'bad');
        service.getDailyReminder.mockResolvedValue(off);
        await press('Turn off reminder');
        expect(service.setDailyReminder).toHaveBeenCalledWith(
            false,
            expect.objectContaining({ hour: 9, minute: 0 })
        );
        expect(allText(renderer)).toContain('Reminder off');
    });

    it('offers system settings when blocked', async () => {
        service.getDailyReminder.mockResolvedValue({ ...off, blocked: true });
        await mount();
        await press('Open notification settings');
        expect(Linking.openSettings).toHaveBeenCalled();
    });

    it('shows permission errors instead of claiming the reminder is enabled', async () => {
        service.setDailyReminder.mockRejectedValueOnce(new Error('Notifications are not allowed.'));
        await mount();
        await press('Enable daily reminder');
        expect(allText(renderer)).toContain('Notifications are not allowed.');
        expect(allText(renderer)).toContain('Reminder off');
    });
});
