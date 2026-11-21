# Fast iOS E2E smoke tests

Maestro drives the installed native app on one iOS Simulator. The dev API is
assumed to be running and seeded correctly; this runner does not start, seed or
reset the backend. No production API or email inbox is used.

## One-time setup

- Install Xcode and an iOS Simulator runtime.
- Install Maestro using its official instructions: https://docs.maestro.dev/getting-started/installing-maestro
- Have Python 3 available (standard library only).
- Boot one iPhone simulator.
- Ensure the API at `http://localhost:8000/api` uses the seeded database from
  `../daily_puzzle_app/backend/seed_dev.py`.

Build and install the standalone Release app once:

```sh
npm run e2e:ios:build
```

This uses bundle ID `app.puzzlepause.mobile.e2e` and URL scheme
`puzzlepause-e2e`, so it can coexist with the normal app. JavaScript is bundled;
Metro and Expo Go are not required. Rebuild whenever app code or configuration
changes. If generated native folders already exist from another build profile,
run `EXPO_PUBLIC_APP_ENV=e2e npx expo prebuild --platform ios --clean` first
(this replaces generated native files).

Alternatively, build with EAS profile `e2e-ios`, extract the simulator `.app`,
and pass its path to the runner:

```sh
E2E_APP_PATH=/path/to/PuzzlePause.app npm run e2e:ios
```

## Run

```sh
npm run e2e:ios
```

Optional settings:

| Variable | Default / purpose |
| --- | --- |
| `E2E_DEVICE` | UDID; otherwise exactly one simulator must be booted |
| `E2E_APP_PATH` | Optional `.app` to install once before running |
| `E2E_BACKEND_DIR` | `../daily_puzzle_app` |
| `E2E_DB_PATH` | `$E2E_BACKEND_DIR/data/puzzle.db`; must match the running API |
| `E2E_EMAIL` | `mobile-e2e@example.com`; dedicated dev-only user |
| `E2E_BRIDGE_PORT` | `8766`; loopback-only host login helper |
| `E2E_RESULTS_DIR` | `e2e-results`; JUnit results and Maestro debug artifacts |

To use another API address, set `EXPO_PUBLIC_API_BASE_URL` **at build time**:

```sh
EXPO_PUBLIC_API_BASE_URL=http://localhost:8001/api npm run e2e:ios:build
```

## Coverage and state

The smoke flow checks calendar/today navigation, archive navigation, an incorrect
answer followed by solving seeded archive puzzle 1 (`45`), guest completion after
relaunch, archive puzzle 2 (`Night`), full native email/code login, Account and
sign-out. Puzzle links deliberately avoid lengthy scrolling through the archive.
The five-minute warm-run budget is a target, not yet a measured guarantee.

At the start, an E2E-only reset route signs out and clears locally stored guest
completion and query state. In normal builds the route only redirects home.
It does **not** clear native cookies, notification permissions/preferences, or
backend records. Use a dedicated simulator and test account. If the backend
retains guest completion for these puzzles, restore its expected state before
running again. Do not run this suite concurrently with other tests mutating the
same data.

The host-side Python helper opens SQLite read-only and binds to `127.0.0.1`.
Maestro JavaScript records the latest token ID before requesting login, then reads
only a newer unused OTAC after the code screen appears. No email polling, browser
cookie injection, auth bypass endpoint, or extra npm dependency is needed.
The runner stops the helper on exit. Authentication codes may appear in Maestro
artifacts: treat those as sensitive, use only dev data and limit retention.

## CI later

Once local runs are reliable, use a macOS runner with pinned Xcode, simulator and
Maestro versions. Build/install once, run the same command against a prepared dev
API, and upload `e2e-results/` on failure. No CI workflow is added yet because the
backend is currently an external, already-running prerequisite.

## Physical iPhones

This suite is simulator-only. Before release, check notification allow/deny,
delivery and tap navigation, keyboard layout, backgrounding and offline launch
on an actual iPhone. See `docs/daily_reminders.md`. Automated physical-device
coverage would require a separate Appium/XCUITest setup.
