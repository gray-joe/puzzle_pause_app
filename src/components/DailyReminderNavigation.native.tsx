import * as Notifications from 'expo-notifications';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { REMINDER_ID } from '../lib/dailyReminder';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

export function DailyReminderNavigation() {
    const response = Notifications.useLastNotificationResponse();
    const navigation = useRootNavigationState();
    const router = useRouter();
    const handled = useRef<Notifications.NotificationResponse | null>(null);

    useEffect(() => {
        if (!navigation?.key || !response || handled.current === response) return;
        handled.current = response;
        if (response.notification.request.identifier !== REMINDER_ID) return;
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        // Fixed internal destination: never navigate to arbitrary payload URLs.
        router.replace('/');
        void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }, [response, navigation?.key, router]);

    return null;
}
