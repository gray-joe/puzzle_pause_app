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

## Store submission docs

- `docs/store/phase8_store_submission.md` - metadata copy, screenshot checklist, and runbook
- `docs/store/privacy_policy_draft.md` - draft privacy policy text for `https://puzzlepause.app/privacy`
