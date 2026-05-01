# Puzzle Pause — Mobile App Spec (v1)

A native mobile app (iOS + Android) that complements the existing Puzzle Pause web app. Built in a separate repository, talks to the existing FastAPI backend at `puzzlepause.app`, shares the same SQLite database via that API.

This document is the working specification for building v1.

---

## 1. Goals & non-goals

### Goals
- Native iOS + Android apps shipped to the App Store and Google Play.
- Daily puzzle play for a useful subset of puzzle types (~54% daily coverage at launch — see §4).
- Full league participation (browse, create, join, leave, view standings).
- Account management (display name, sign out).
- Authentication via the existing OTAC (one-time auth code) email flow, no new auth surface.
- One mobile codebase (Expo / React Native).

### Non-goals (v1)
- Push notifications / daily reminders.
- Admin tooling (puzzle creation, user management).
- Offline play. The app requires a network connection.
- Bespoke puzzle types beyond Tier A + Tier B (see §4).
- A separate mobile-only daily puzzle stream — mobile uses the same daily rotation as web.

---

## 2. Architecture overview

```
┌──────────────────────┐        HTTPS / JSON        ┌─────────────────────────┐
│  Mobile (Expo / RN)  │ ─────────────────────────► │  FastAPI (this repo)    │
│   iOS + Android      │  Authorization: Bearer JWT  │   /api/* endpoints      │
└──────────────────────┘                             │   SQLite on fly.io      │
                                                     └─────────────────────────┘
```

- **Same backend, same DB.** No new service. The mobile app is a second client of the existing `/api/*` JSON API.
- **Authentication via Bearer JWT.** Already supported by `backend/app/auth.py:57`. Verified end-to-end during planning.
- **No CORS concerns** for mobile (no `Origin` header, no preflight).
- **API versioning deferred.** Add `/api/v1/` only when required by a backwards-incompatible change.

---

## 3. Stack & tooling

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Expo (React Native, TypeScript)** | One codebase, fast iteration, EAS removes Mac-in-CI requirement. |
| Routing | **Expo Router** | File-based, mirrors Next.js App Router used in `web/`. |
| Data fetching | **TanStack Query (`@tanstack/react-query`)** | Cache, retries, mutation lifecycle, request dedup. |
| Validation / types | **Zod**, hand-written schemas | Runtime validation + types via `z.infer`. Single source of truth. |
| Secure storage | **expo-secure-store** | Keychain on iOS, EncryptedSharedPreferences on Android. JWT only. |
| UI | **Hand-rolled** with RN primitives + small theme module | No UI kit dependency; matches existing web aesthetic; small screen count. |
| Forms | Plain `useState` / `useReducer` | Forms are tiny (email, OTAC, puzzle answer, league name). No form lib needed. |
| HTTP | **`fetch`** (built-in) | No need for axios. Thin wrapper for auth headers and error parsing. |
| Builds | **EAS Build** | Cloud builds for both platforms, no Mac required. |
| Distribution | **TestFlight + Play Internal Testing** for beta; App Store + Play Store for release. | Standard. |
| Dev accounts | Apple Developer ($99/yr) + Google Play ($25 one-time) | Required before TestFlight / Internal Testing. Sign up early. |

### Explicitly rejected

- **OpenAPI codegen.** User chose hand-written. Manual sync via Zod schemas.
- **UI kits (Tamagui / Gluestack / NativeWind).** User chose hand-rolled.
- **Redux / Zustand.** TanStack Query covers server state; React context covers session. No additional store.
- **WebView wrappers (Capacitor).** Goal is a native app, not a wrapped website.

---

## 4. v1 scope: puzzle types

The web app rotates across 16+ puzzle types. v1 mobile renders **Tier A + Tier B only** (~54% daily coverage based on the current archive). Other types degrade gracefully with a "play on web" message.

### Tier A — Pure text input (shared `TextAnswerPuzzle` component)
| Type | Notes |
|---|---|
| `word` | Flagship. `question` is HTML-with-`<br>` text; user submits free-text answer. |
| `math` | Same shape as `word`. |
| `ladder` | Same shape — `question` includes underscores for blanks; user submits the chain as **comma-separated free text** (decided for v1). |

### Tier B — Variants of text input
| Type | Component | Notes |
|---|---|---|
| `choice` | `ChoicePuzzle` | `question` is `prompt|optA|optB|optC|optD`. Render as 4 tappable buttons. |
| `image-word` | `ImageWordPuzzle` | `question` is JSON `{prompt, image_url}`. Image above text input. |
| `clue-reveal` | `ClueRevealPuzzle` | `question` is JSON `{prompt, clues[]}`. Display clues progressively as hints are used; submit text answer. |

### Deferred to v1.5 (Tier C — structured but contained)
`match`, `order`, `connections`, `numgrid`, `wordsearch` — each needs its own UI but is well-bounded.

### Deferred indefinitely (Tier D/E — game boards & image interaction)
`scrabble`, `word-wheel`, `countdown`, `image-tap`, `image-order` — significant custom UI; revisit only after v1 ships.

### Unsupported-type handling

When the daily puzzle is unsupported, the today screen displays:

> Today's puzzle isn't supported in the app yet. Play it on web at puzzlepause.app, or browse the [Archive](#) for a puzzle you can play here.

Archive listings show all types but tapping an unsupported type opens the same fallback.

---

## 5. Repository

- **Repo**: `puzzle_pause_app` (this repository, separate from the backend repo).
- Public or private — user's choice. Spec assumes private.
- Single Expo app, no monorepo.

### Layout

```
puzzle_pause_app/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   ├── email.tsx             # Step 1: enter email
│   │   └── code.tsx              # Step 2: enter OTAC
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Bottom tabs: Today, Archive, Leagues, Account
│   │   ├── index.tsx             # Today's puzzle
│   │   ├── archive.tsx           # Archive list
│   │   ├── archive/[id].tsx      # Archive detail (plays a past puzzle)
│   │   ├── leagues.tsx           # Leagues list
│   │   ├── leagues/[id].tsx      # League detail / standings
│   │   ├── leagues/new.tsx       # Create league
│   │   └── account.tsx           # Account settings + sign out
│   └── _layout.tsx               # Root layout: auth gate, providers
├── src/
│   ├── api/
│   │   ├── client.ts             # fetch wrapper, Bearer injection, error parsing
│   │   ├── schemas.ts            # Zod schemas for all responses
│   │   ├── types.ts              # Re-exports z.infer types
│   │   ├── auth.ts               # login(), verify(), me(), logout()
│   │   ├── puzzle.ts             # today(), attempt(), hint(), result()
│   │   ├── archive.ts
│   │   ├── leagues.ts
│   │   └── account.ts
│   ├── components/
│   │   ├── puzzle/
│   │   │   ├── TextAnswerPuzzle.tsx
│   │   │   ├── ChoicePuzzle.tsx
│   │   │   ├── ImageWordPuzzle.tsx
│   │   │   ├── ClueRevealPuzzle.tsx
│   │   │   ├── UnsupportedPuzzle.tsx
│   │   │   └── PuzzleRenderer.tsx   # Discriminated dispatch
│   │   ├── PuzzleHtml.tsx           # Renders <br>-flavoured HTML safely
│   │   ├── Button.tsx
│   │   ├── TextInput.tsx
│   │   ├── Screen.tsx               # Common safe-area + padding wrapper
│   │   └── ...
│   ├── auth/
│   │   ├── SessionContext.tsx       # JWT in context + secure store
│   │   └── useSession.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   └── typography.ts
│   └── lib/
│       ├── queryClient.ts
│       └── time.ts
├── assets/                       # Icon, splash, fonts
├── app.json                      # Expo config
├── eas.json                      # EAS Build profiles
└── package.json
```

---

## 6. API contract

### Base URL
- Dev: `http://localhost:8000/api` (override via `EXPO_PUBLIC_API_BASE_URL`)
- Prod: `https://puzzlepause.app/api`

### Auth headers
Every authenticated request: `Authorization: Bearer <jwt>`. No cookies.

### Verified endpoints (all confirmed working with Bearer-only auth)

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | `{email}` → emails OTAC. Returns `{message: "Code sent"}`. Rate-limited 5/min/IP. |
| POST | `/auth/verify` | `{email, code}` → `{token, user}`. Rate-limited 10/min/IP. |
| POST | `/auth/logout` | Clears server session. |
| GET | `/auth/me` | Current user. |
| GET | `/account` | User + stats. |
| PATCH | `/account` | Update display name. |
| GET | `/puzzle/today` | Today's puzzle + the user's attempt state. |
| POST | `/puzzle/attempt` | Submit an answer. |
| POST | `/puzzle/hint` | Reveal next hint. |
| GET | `/puzzle/result` | Final result for today. |
| GET | `/archive` | List of past puzzles with `solved` status. |
| GET | `/archive/{id}` | Past puzzle by id. |
| POST | `/archive/{id}/attempt` | Submit answer for an archived puzzle. |
| POST | `/archive/{id}/hint` | Reveal hint for an archived puzzle. |
| GET | `/archive/{id}/result` | Result for an archived puzzle. |
| GET | `/leagues` | Leagues the user is in. |
| POST | `/leagues` | Create league. |
| GET | `/leagues/{id}` | League details + standings. |
| POST | `/leagues/join` | Join via invite code. |
| DELETE | `/leagues/{id}` | Delete (creator only). |
| POST | `/leagues/{id}/leave` | Leave a league. |

### Sample payloads (verified live)

**`POST /auth/verify` response:**
```json
{
  "token": "eyJhbG...",
  "user": { "id": 25, "email": "user@example.com", "display_name": null }
}
```

**`GET /puzzle/today` response (math example):**
```json
{
  "id": 14,
  "puzzle_date": "2026-04-30",
  "puzzle_type": "math",
  "puzzle_name": "Quick Maths",
  "question": "1+1=?",
  "hint": "Count on your fingers",
  "has_hint": true,
  "total_hints": 1,
  "puzzle_number": 24,
  "attempt": {
    "solved": false,
    "score": null,
    "incorrect_guesses": 0,
    "hint_used": false,
    "completed_at": null,
    "opened_at": "2026-04-30T20:28:25.826532"
  }
}
```

**`GET /account` response:**
```json
{
  "id": 25,
  "email": "user@example.com",
  "display_name": null,
  "stats": {
    "puzzles_solved": 0,
    "average_score": 0.0,
    "alltime_total": 0,
    "weekly_total": 0,
    "today_score": null,
    "percentile": 33,
    "streak": 0
  }
}
```

### Quirks worth knowing

- The `question` field is **always a string**. For Tier B+ types (`choice`, `image-word`, `clue-reveal`, plus all Tier C/D/E), the string is JSON-encoded and must be parsed client-side based on `puzzle_type`.
- `choice` uses `|` (pipe) delimiters, not JSON: `"prompt|opt1|opt2|opt3|opt4"`.
- `hint` may be `null` (e.g. `clue-reveal` puzzle id=25). UI should handle this.
- `total_hints` can be > 1 (e.g. `connections` has 3, `clue-reveal` has 2). Hints reveal sequentially via `POST /puzzle/hint` and `POST /archive/{id}/hint`.
- The `attempt` field on a puzzle response is the user's current state; `null` or zero-valued fields mean "not attempted yet."
- POST attempt/hint shapes are not yet captured in this spec — verify against backend during Phase 3.
- **Stats live on `/account` only.** Today's puzzle response does not include streak/score totals. v1 accepts the duplicate call: Today screen will hit both `/puzzle/today` and `/account` if it needs to show streak alongside the puzzle. Revisit only if it becomes a perceptible perf issue — at that point, either denormalise stats onto the puzzle response or share via TanStack Query cache.

---

## 7. Type system & client schemas

Single source of truth: Zod schemas in `src/api/schemas.ts`. Types derived via `z.infer<>`.

### Strategy

```ts
// Base — every puzzle has these fields
const PuzzleBase = z.object({
  id: z.number(),
  puzzle_date: z.string(),
  puzzle_name: z.string(),
  hint: z.string().nullable(),
  has_hint: z.boolean(),
  total_hints: z.number(),
  puzzle_number: z.number(),
  attempt: z.object({...}).nullable().optional(),
});

// Per-type discriminated union with parsed `question`
const WordPuzzle = PuzzleBase.extend({
  puzzle_type: z.literal("word"),
  question: z.string(),               // raw HTML-with-<br>
});

const ChoicePuzzle = PuzzleBase.extend({
  puzzle_type: z.literal("choice"),
  question: z.string().transform((s, ctx) => {
    const parts = s.split("|");
    if (parts.length !== 5) ctx.addIssue({...});
    return { prompt: parts[0], options: parts.slice(1) };
  }),
});

const ImageWordPuzzle = PuzzleBase.extend({
  puzzle_type: z.literal("image-word"),
  question: z.string().transform((s) => JSON.parse(s) as { prompt: string; image_url: string }),
});

const ClueRevealPuzzle = PuzzleBase.extend({
  puzzle_type: z.literal("clue-reveal"),
  question: z.string().transform((s) => JSON.parse(s) as { prompt: string; clues: string[] }),
});

// Unsupported — captures everything else without parsing
const UnsupportedPuzzle = PuzzleBase.extend({
  puzzle_type: z.string(),  // any other value
  question: z.string(),
});

// At the top level, try the supported variants in order, fall through to Unsupported
export const Puzzle = z.union([
  WordPuzzle, MathPuzzle, LadderPuzzle,
  ChoicePuzzle, ImageWordPuzzle, ClueRevealPuzzle,
  UnsupportedPuzzle,
]);
export type Puzzle = z.infer<typeof Puzzle>;
```

### Why Zod over plain interfaces

- Backend response shape is not under the mobile app's control. Catch drift at runtime.
- The `question` JSON-blob-as-string pattern means we *want* parsing built into the validator.
- One definition gives both type and validator.

### Maintenance discipline

- All API responses pass through `schema.parse()` in `src/api/client.ts`.
- When backend shape changes, update `src/api/schemas.ts` once.
- Keep schemas grouped by domain (`auth`, `puzzle`, `archive`, `leagues`, `account`).

---

## 8. Authentication flow

### Sign-in

1. **Email screen**: input email → `POST /auth/login`.
2. **Code screen**: 6-character input → `POST /auth/verify` → receive `{token, user}`.
3. **Persist** `token` in `expo-secure-store` under key `pp_jwt`.
4. **Hydrate** session context, navigate to the tab layout.

### Auth gate

- Root layout reads JWT from secure store on mount.
- If absent → render `(auth)` stack.
- If present → render `(tabs)` stack and call `GET /auth/me` to validate. If 401, clear token and bounce to login.

### Session expiry

- JWTs last 30 days (per backend). On any 401 from a protected endpoint, clear stored JWT and redirect to login.
- No refresh-token flow. User re-authenticates with a fresh OTAC.

### Sign-out

- Call `POST /auth/logout`, clear secure store, clear TanStack Query cache, navigate to login.

### Why no deep-linking

Backend uses a 6-character one-time auth code, not a magic link. User reads the code from email and types it into the app — no URL handling needed. This dramatically simplifies setup (no `expo-linking` config, no Universal Links / App Links domain verification).

---

## 9. Component architecture

### Puzzle rendering

Single dispatcher pattern:

```tsx
// src/components/puzzle/PuzzleRenderer.tsx
function PuzzleRenderer({ puzzle, onSubmit, onHint }: Props) {
  switch (puzzle.puzzle_type) {
    case "word":
    case "math":
    case "ladder":
      return <TextAnswerPuzzle puzzle={puzzle} onSubmit={onSubmit} onHint={onHint} />;
    case "choice":
      return <ChoicePuzzle puzzle={puzzle} onSubmit={onSubmit} onHint={onHint} />;
    case "image-word":
      return <ImageWordPuzzle puzzle={puzzle} onSubmit={onSubmit} onHint={onHint} />;
    case "clue-reveal":
      return <ClueRevealPuzzle puzzle={puzzle} onSubmit={onSubmit} onHint={onHint} />;
    default:
      return <UnsupportedPuzzle puzzle={puzzle} />;
  }
}
```

The `today` and `archive/[id]` screens both render `<PuzzleRenderer>` — no per-screen duplication.

### Shared building blocks

- `Screen` — safe-area, theme background, default padding.
- `Button` — primary/secondary variants, loading state.
- `TextInput` — themed wrapper with error display.
- `PuzzleHtml` — renders the `<br>`-style HTML used in `word` and `math` questions. Implemented with **`react-native-render-html`** configured with a strict tag allowlist (`<br>`, basic inline formatting only — no `<script>`, no `<iframe>`, no event handlers). Backend stores user-untouched author content but treat as untrusted.

### Theme

- One `colors.ts`, `spacing.ts`, `typography.ts` module.
- Match the web app's palette and font choices. Inspect `web/tailwind.config.ts` and `web/app/globals.css` (or equivalent) when implementing.
- Support light + dark mode via `useColorScheme` from React Native.

---

## 10. Phased implementation plan

Each phase is an independently mergeable chunk. Estimates assume one engineer working part-time.

### Phase 0 — Backend pre-flight (this repo) ✅ done during planning
- [x] Verified Bearer JWT auth works for all v1 endpoints with no cookie.
- [x] Verified `question` field shapes for all 16 puzzle types.
- [x] Confirmed CORS irrelevant for mobile (no `Origin` sent).
- [x] Confirmed rate limits (5/min login, 10/min verify) are sane for mobile.
- [ ] *(Optional, defer)* Introduce `/api/v1/` versioning. Skip until needed.

### Phase 1 — Mobile scaffold
1. Audit the existing skeleton in `puzzle_pause_app` (App.tsx, app.json, index.ts, assets, package.json) and reconcile against the layout in §5 — keep, move, or replace as appropriate before adding new files.
2. `npx create-expo-app -t expo-template-blank-typescript` if starting clean (skip if existing skeleton is reused).
3. Add: `expo-router`, `@tanstack/react-query`, `expo-secure-store`, `zod`, `react-native-render-html`.
4. Configure Expo Router (`app/` directory + `expo-router/entry`).
5. Set up `theme/` modules and primitives: `Screen`, `Button`, `TextInput`, plus shared loading/empty/error states (e.g. `<QueryStateView>`) so all screens from Phase 2 onward share consistent UX for TanStack Query lifecycles.
6. Wire `EXPO_PUBLIC_API_BASE_URL`. Default to `http://localhost:8000/api` for dev.
7. Implement `src/api/client.ts` (fetch wrapper, Bearer injection, error parsing).
8. CI: lint + typecheck on push (GitHub Actions).

### Phase 2 — Auth
1. Zod schemas for `auth/login`, `auth/verify`, `auth/me`.
2. `SessionContext` + `useSession` hook (reads/writes secure store).
3. `(auth)/email.tsx`, `(auth)/code.tsx`.
4. Auth gate in root layout.
5. Handle 401 → clear token + redirect.
6. Sign-out wired up (stub button somewhere visible until Account exists).

### Phase 3 — Today's puzzle (Tier A + B)
1. Zod schemas for puzzle responses, including the discriminated union.
2. `PuzzleRenderer` dispatcher.
3. `TextAnswerPuzzle` (covers word/math/ladder).
4. `ChoicePuzzle`.
5. `ImageWordPuzzle`.
6. `ClueRevealPuzzle`.
7. `UnsupportedPuzzle` ("play on web") fallback.
8. `(tabs)/index.tsx` — fetch `/puzzle/today`, render via `PuzzleRenderer`.
9. Wire submit (`POST /puzzle/attempt`), hint (`POST /puzzle/hint`), result (`GET /puzzle/result`).
10. Polished result screen: solved / not solved, score, streak update.

### Phase 4 — Archive
1. `(tabs)/archive.tsx` — list view with `solved` indicator and type label.
2. Filter: optional toggle to show only supported types.
3. `archive/[id].tsx` — reuses `PuzzleRenderer`. Submit/hint/result via the `/archive/{id}/*` endpoints.

### Phase 5 — Leagues
1. List screen — `/leagues`.
2. Create screen — `/leagues` POST (form: name, optional description).
3. Detail screen — `/leagues/{id}` showing standings table.
4. Join flow — paste invite code → `POST /leagues/join`.
5. Leave — `POST /leagues/{id}/leave`.
6. Delete (creator only) — `DELETE /leagues/{id}` with confirmation.
7. Confirm league response shape during build (not yet captured here — fetch and validate).

### Phase 6 — Account & polish
1. `(tabs)/account.tsx` — display name (PATCH `/account`), stats (from `GET /account`), sign out.
2. App icon + splash screen (Expo configures both via `app.json` + assets).
3. Light + dark mode via theme.
4. Loading skeletons / empty states / error states.
5. Pull-to-refresh on lists.

### Phase 7 — Beta distribution
1. Sign up Apple Developer ($99/yr) + Google Play ($25). **Do this in parallel with Phase 1–4 to avoid blocking the end of the project.**
2. Configure EAS (`eas.json` with `development`, `preview`, `production` profiles).
3. Wire up **Sentry** (`@sentry/react-native`) for crash reporting and basic performance tracing — needed before real-device testing so we have visibility into the first wave of bugs.
4. First TestFlight build + Play Internal Testing build.
5. Self-test on real devices (iOS + Android).
6. Optional: invite 3–5 beta users.

### Phase 8 — Store submission
1. Privacy policy URL — host at `puzzlepause.app/privacy`. Required by both stores.
2. App listings: name, subtitle, description, keywords, screenshots, support URL.
3. App Store: submit for review. Apple's published target is 24–48h, but **plan for 1–2 weeks end-to-end**: new puzzle apps frequently hit a 4.3 ("spam"/duplicate functionality) rejection on first submission and need a written appeal or differentiation tweak before approval. Build this buffer into any launch date commitments.
4. Play Store: submit. Google review is typically 1–7 days for new apps but can extend further for first-time publishers; treat 2 weeks as the worst case.

---

## 11. Build & distribution detail

### EAS profiles (sketch)

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Versioning

- `version` in `app.json` is the user-facing version (`1.0.0`).
- iOS `buildNumber` and Android `versionCode` auto-incremented by EAS.
- Bump `version` for any user-visible release.

### OTA updates

Expo supports OTA JS updates (no store review). Useful for bug fixes between native releases. Deferred — wire up only after first stable release.

---

## 12. Testing strategy

- **Unit tests**: Vitest or Jest, focused on Zod schemas (parse fixtures captured from real API responses) and pure utility functions. Avoid testing RN components themselves; the value-to-effort ratio is poor.
- **API contract tests**: a small fixture file (`tests/fixtures/`) with one captured response per endpoint per puzzle type. Whenever schemas update, fixtures parse cleanly. This is the v1 safety net against backend drift.
- **Manual QA**: device matrix of one iOS phone + one Android phone before each release.
- **No E2E tests in v1.** Detox/Maestro is out of scope for the initial build.

---

## 13. Open questions to resolve during build

These didn't need to be answered for the spec, but will need decisions during implementation:

1. **POST attempt/hint request shapes.** The shape of what mobile sends to `/puzzle/attempt`, `/puzzle/hint`, `/archive/{id}/attempt`, `/archive/{id}/hint` must be captured from the backend before Phase 3 work begins. Inspect `backend/app/routers/` and the existing web client to confirm field names and types, then add the schemas to `src/api/schemas.ts`. Allow ~30 minutes for this investigation.
2. **League response shape.** The detailed shape of `GET /leagues/{id}` — captured in Phase 5.
3. **`clue-reveal` hint behaviour.** Confirm whether hints reveal the next clue, or extra info beyond the clues. Inspect web behaviour.
4. **Branding assets.** App icon and splash screen design — pull from existing web brand or commission new assets.
5. **Privacy policy text.** Required for store submission; share with web (one document covering both clients).

---

## 14. Pre-flight checklist before starting build

- [ ] Apple Developer account purchased.
- [ ] Google Play Console account purchased.
- [ ] EAS account created (free tier sufficient initially).
- [ ] App name confirmed available on both stores ("Puzzle Pause").
- [ ] Bundle identifier reserved: `app.puzzlepause.mobile` (or similar).
- [ ] Privacy policy URL planned (`puzzlepause.app/privacy`).
- [ ] Brand assets ready or commissioned: app icon (1024×1024), splash screen.
- [ ] Mobile-specific dev backend access confirmed (already running locally).

---

## 15. References

- Backend code: `backend/app/` (FastAPI, SQLAlchemy, SQLite).
- Web client (reference for UI patterns): `web/` (Next.js, React, TypeScript).
- Backend auth: `backend/app/auth.py:57` (Bearer support), `backend/app/routers/auth.py` (login/verify endpoints).
- Backend dev DB: `data/puzzle.db` (set via `DATABASE_URL` env var on the running uvicorn process).
- Dev mode prints OTAC codes to stdout; codes also stored in `auth_tokens.short_code`.

## Notes:

### Attempt and Hint shapes

POST /puzzle/attempt

  Request (AttemptRequest):
  {
    "puzzle_id": 123,         // int, required
    "guess": "some answer",   // string, max 1000 chars, required
    "opened_at": "2026-05-03T10:00:00Z"  // datetime | null, optional
  }

  Response (AttemptResponse):
  {
    "correct": true,
    "score": 950,             // int | null
    "incorrect_guesses": 0,
    "solved": true,
    "answer": "...",          // only on correct / already solved
    "question": "...",        // only on correct / already solved
    "streak": 5,              // only for authenticated users on correct                                                                                             "opened_at": null         // datetime | null                                                                                                                   }
                                                                                                                                                                   ---
  POST /puzzle/hint

  Request (HintRequest):
  {
    "puzzle_id": 123          // int, required
  }

  Response (HintResponse):
  {
    "hint": "revealed hint text",
    "total_hints": 1          // int, defaults to 1
  }

  ---
  A few behavioral notes:
  - /attempt works for unauthenticated users (no streak, no persisted attempt), but /hint requires auth (it tracks hint_used on the attempt row).
  - Both routes validate that puzzle_id matches today's puzzle date — a 404 is returned for any other date.
  - /attempt is rate-limited to 10/min; /hint to 5/min.

### Clue reveal notes

The hint button for clue-reveal reveals the next clue from clues[] — but with a twist: the first clue is never hintable.

  Specifically, _hint_items returns json.loads(question).get("clues", [])[1:] — a slice starting at index 1. So clue index 0 is always shown upfront as part of
  the puzzle, and each hint call reveals the next successive clue from that sliced list.

  Each call to POST /puzzle/hint increments attempt.hint_used and returns items[idx] where idx is the pre-increment value, so successive hints walk through
  clues[1], clues[2], clues[3], etc. When hint_used >= total_hints it returns a 404 ("No more hints available").

  The separate hint field on the Puzzle model is ignored entirely for clue-reveal — it's only the fallback for other puzzle types that don't have structured hint
   data.
