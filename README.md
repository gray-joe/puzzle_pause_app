# Puzzle Pause — Mobile App

React Native / Expo app for [puzzlepause.app](https://puzzlepause.app). Requires the FastAPI backend running locally or pointed at the production API.

## Prerequisites

- [asdf](https://asdf-vm.com/) with the Node version in `.tool-versions` (22.22.2)
- [Expo Go](https://expo.dev/go) on your iOS or Android device, **or** Xcode (iOS simulator) / Android Studio (Android emulator)

```sh
asdf install
npm install
```

## Running the app

```sh
npm start          # Opens Expo dev tools — scan QR with Expo Go
npm run ios        # iOS simulator (requires Xcode)
npm run android    # Android emulator (requires Android Studio)
```

Press `i` / `a` in the terminal after `npm start` to open a simulator without the separate commands.

## Backend

By default the app talks to `http://localhost:8000/api`. Start the FastAPI backend from its own repo first, or point at production:

```sh
# Use production backend instead of local
EXPO_PUBLIC_API_BASE_URL=https://puzzlepause.app/api npm start
```

When running against a local backend, the OTAC (one-time auth code) is printed to the backend's stdout — no email required for dev sign-in.

## Browser preview

`npm run web` uses the backend's HttpOnly session cookie, not SecureStore or browser token storage. For local testing, use `localhost` for both services and include the Expo web origin (normally `http://localhost:8081`) in the backend's `CORS_ORIGINS`. Hosted browser builds need a same-site API and credentialed CORS when origins differ; a localhost preview cannot use production's cross-site session cookie.

## Sentry

Preview and production EAS builds read Sentry config from EAS environment variables:

- `EXPO_PUBLIC_SENTRY_DSN` enables runtime crash reporting. This must be plain text or sensitive, not secret, because it is bundled into the app.
- `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` enable source-map uploads during builds.

Keep `SENTRY_AUTH_TOKEN` as a secret EAS variable.

The app only attaches the numeric user id to Sentry events; it does not send email, display name, JWTs, puzzle answers, or guesses.

## Typecheck

```sh
npm run typecheck
```

## Tests

```sh
npm test
npm run test:watch
npm run test:coverage
```

## iOS E2E tests

With the local backend running and seeded, use Maestro to test a standalone iOS
Simulator build:

```sh
npm run e2e:ios:build  # Build/install once; rebuild after app changes
npm run e2e:ios        # Run the native smoke suite
```

See [docs/e2e-ios.md](docs/e2e-ios.md) for prerequisites, database paths and coverage.

## Daily reminders

Optional on-device daily reminders are available from **Account**, including for guests. They
use the device's local time, need no backend, and still fire if the day's puzzle is already
complete. A new native build is required for the notification module; an OTA update alone
is not sufficient. See [docs/daily_reminders.md](docs/daily_reminders.md) for behavior,
compliance notes, and the device-testing checklist.

## Store submission docs

- `docs/store/phase8_store_submission.md` - metadata copy, screenshot checklist, and runbook
- `docs/store/privacy_policy_draft.md` - draft privacy policy text for `https://puzzlepause.app/privacy`
