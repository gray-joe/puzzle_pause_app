# Local daily puzzle reminders

## Plan and scope

1. Add opt-in reminder settings to Account, including the guest view.
2. Use `expo-notifications` for one repeating daily notification at a chosen local time.
3. Support permission denial/revocation, changing time, cancellation, and notification-tap navigation.
4. Cover scheduling, settings, and navigation with automated tests, then validate delivery on devices.

No backend, push registration, push tokens, marketing notifications, analytics, or exact-alarm access.

## Behavior

- Off by default. Opening the app or Account does not request notification permission.
- Account → Daily puzzle reminder → enter a 24-hour local time → Enable daily reminder.
- A stable notification ID replaces the existing request when the time changes; there is no accumulating queue.
- One repeating calendar/daily trigger, not a 24-hour interval, is used for local wall-clock time.
- Disabling cancels the pending reminder and dismisses the delivered notification with that ID.
- The actual OS schedule is the source of truth for enabled state. The last chosen time is stored on-device in SecureStore; the default is 09:00.
- Settings reload when the app returns to the foreground. When OS permission or the Android channel is blocked, the UI offers system settings.
- Tapping a reminder opens today's puzzle, including from a terminated app. Navigation waits for the router to be ready, ignores unrelated actions/notifications, and consumes the response.
- No sound, vibration, or badge is requested. While the app is open, reminders may appear in Notification Center but do not interrupt play with a banner.
- Reminders are device-level, not account-level: signing out or deleting an account does not change them. Guests can manage them in Account. They still fire after completing a puzzle, including on another device.
- The web app does not expose native reminder controls or import the notification runtime.

## Build and compliance

A new native development/preview/production build is required after adding the dependency and Expo config plugin. An OTA update alone cannot add the native module. Test a real app build rather than relying solely on Expo Go.

- iOS: explicit user action precedes the OS permission prompt. Declining never restricts gameplay.
- Android: create the Daily puzzle reminder channel before requesting permission (Android 13+).
- `SCHEDULE_EXACT_ALARM` and `USE_EXACT_ALARM` are explicitly blocked in `app.json`. Expo SDK 54 uses inexact scheduling when exact alarm access is unavailable on modern Android.
- Delivery is best-effort: Focus/Do Not Disturb, OS battery controls, force-stop, clock/timezone changes, and user settings can delay or suppress notifications. Do not promise exact-minute delivery.
- This feature transmits no reminder settings or device tokens. Keep the privacy policy accurate about on-device preferences and assess the complete shipped app separately for store privacy disclosures.

## Automated validation

```sh
npm run typecheck
npm test
npx expo export --platform web --output-dir /tmp/puzzle-pause-reminders-web
npx expo export --platform ios --platform android --output-dir /tmp/puzzle-pause-reminders-native
```

Tests mock OS APIs; exports validate bundling, not actual delivery or native permission manifests.

## Device acceptance checklist (required before release)

Use iOS and Android 13+ physical devices, plus Android 12 if supported by the release test matrix. Set a reminder a few minutes ahead and allow for Android scheduling delays.

- Fresh install: no prompt on launch; reminders off for guests and signed-in users.
- Enable: permission is requested only after pressing Enable; allow, deny, and permanently deny. Gameplay remains available in all cases.
- Deny: no schedule is created; a useful error appears. System settings can be opened, and returning updates the status.
- Delivery: check foreground (no banner), background, terminated app, and offline behavior.
- Tap: from background/terminated app, land on today's puzzle, not an older archive or calendar month. A subsequent ordinary launch must not replay an old tap.
- Edit the time repeatedly: only one scheduled reminder remains, firing at the latest time.
- Disable: no later reminder; the delivered reminder is removed. Disable still works when notification permission is revoked or the edited time is invalid.
- Relaunch and reboot: schedule and time survive, subject to OS restrictions. Android force-stop may suspend notifications until reopening the app.
- Revoke notification permission / block the Android channel in Settings: Account reports the blocked state and still allows turning off the schedule.
- Check local-time behavior across timezone and daylight-saving changes. Timing during travel/clock changes remains subject to OS scheduling; reopen and re-save the desired local time if necessary.
- Sign out/delete account: reminder remains a device preference, and the guest Account view can disable it.
- Inspect the merged Android release manifest: no exact-alarm permission, no full-screen intent permission. Confirm ordinary notification permission is declared by the library.
- Check layout and input with large text, dark mode, VoiceOver/TalkBack, and small screens.
