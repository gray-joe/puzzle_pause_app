# Puzzle Pause — Puzzle Type Reference

This document is the contract between this app (mobile client), the web app, and the backend for **puzzle data only**. It exists so that whenever a puzzle type is added or changed on web/backend, this repo has exactly what it needs to support it — nothing else about the app is tracked here.

When a new puzzle type ships on web/backend, fill in §1 and add a row to the table in §5. Backend contracts and current mobile implementation limits are distinguished explicitly; documenting a backend capability does not mean it has been implemented on mobile.

Recent updates covered here: the five newer types (`sudoku`, `codeword`, `word-square`, `number-square`, `canvas`), crossword/codeword grids up to 25 × 25, alternative-fill checking, and the data-contract implications of improved web authoring. This remains a puzzle-data reference, not a specification for mobile admin tooling or daily reminders.

---

## 1. New puzzle type template

Copy this checklist and fill it in for each new type before (or while) it's implemented here.

- **`puzzle_type` value**: exact string literal returned by the API, e.g. `"crossword"`
- **`question` field shape**: is it a raw string, or a JSON-encoded string? If JSON, give the exact keys/types (e.g. `{ prompt: string; items: string[] }`)
- **Guess format** — what should the mobile client send as `guess` in `POST /puzzle/attempt`? (free text, comma-separated list, pipe-delimited, letter code, coordinate string, etc. — give a concrete example)
- **Hint behavior**: standard (`hint` string, `total_hints` count, revealed via `POST /puzzle/hint`) or custom per-type semantics (like `clue-reveal`, §5)?
- **Answer/explanation display**: does the revealed `answer` need custom formatting to be readable, or is plain text fine?
- **Any other quirks**: nullable fields, validation constraints, special UI interaction needed, etc.

---

## 2. Shared puzzle contract

A typical puzzle-detail response has the following shape. Some fields are optional or endpoint-dependent; do not require every field on every response:

```json
{
  "id": 14,
  "puzzle_date": "2026-04-30",
  "puzzle_name": "Quick Maths",
  "puzzle_number": 24,
  "puzzle_type": "math",
  "question": "1+1=?",
  "hint": "Count on your fingers",
  "has_hint": true,
  "total_hints": 1,
  "attempt": {
    "solved": false,
    "gave_up": false,
    "score": null,
    "incorrect_guesses": 0,
    "hint_used": 0,
    "completed_at": null,
    "opened_at": "2026-04-30T20:28:25.826532"
  },
  "answer": null,
  "explanation": null,
  "completion_stats": {
    "completion_percentage": 0,
    "completed_users": 0,
    "average_seconds": null,
    "average_score": null
  }
}
```

- `question` is **always a string** on the wire. For structured types it's a JSON-encoded string, parsed client-side based on `puzzle_type`.
- `hint` may be `null`. `total_hints` can be `> 1` (hints revealed sequentially via `POST /puzzle/hint`).
- `attempt` is the authenticated user's persisted state when present. It may be absent/null for a guest; a recognized guest give-up session can return terminal attempt state. A zero counter alone does not distinguish a new attempt from an opened but unfinished one. Normalize `hint_used` from either a boolean or a numeric counter for endpoint compatibility.
- `answer` is omitted or null until solved/given up; `explanation` is nullable and is revealed with the solution. Treat these as optional fields, not values always present on an unsolved response.
- `completion_stats` can be returned on an unsolved daily puzzle too; it is not gated by solving. Its averages may be null. `revealed_hint`, when present, contains previously revealed hints joined with `|`.
- Public responses omit unrevealed Connections categories and reduce Clue Reveal's `clues` to its first clue. Revealing a hint does not require downloading an answer-bearing puzzle object.
- Any `puzzle_type` not recognized by the client falls back to an "unsupported, play on web" state — new types must be added explicitly, they don't work automatically.

---

## 3. Endpoints

Paths below are relative to the API base URL, which includes `/api` (for example, `https://puzzlepause.app/api`). The same type-specific guess encoding is used for daily and archive attempts.

| Method | Path | Purpose |
|---|---|---|
| GET | `/puzzle/today` | Today's puzzle + the user's attempt state. |
| POST | `/puzzle/attempt` | Submit an answer. |
| POST | `/puzzle/hint` | Reveal next hint. |
| POST | `/puzzle/give-up` | Give up and reveal the reference solution for 0 points. |
| GET | `/puzzle/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD` | Released puzzle IDs/dates in a range. |
| GET | `/puzzle/result` | Final result for today. |
| GET | `/puzzle/{id}/progress` | Authenticated account draft + authoritative gameplay metadata; shared by daily/archive. |
| PUT | `/puzzle/{id}/progress` | Version-checked autosave for Sudoku, Crossword and Codeword. |
| GET | `/archive` | List of past puzzles with `solved` status. |
| GET | `/archive/{id}` | Past puzzle by id. |
| POST | `/archive/{id}/attempt` | Submit answer for an archived puzzle. |
| POST | `/archive/{id}/hint` | Reveal hint for an archived puzzle. |
| POST | `/archive/{id}/give-up` | Give up on an archive puzzle. |
| GET | `/archive/{id}/result` | Result for an archived puzzle. |

Behavioral notes:
- Grid progress is local-first, with 600 ms debounced account saves for signed-in players. PUT accepts `{version, question, entries}`; `question` is the exact source string retained as `raw_question` alongside the parsed mobile question. GET returns `{version, question, entries, completed, opened_at, incorrect_guesses, hint_used, hint}`. HTTP 409 requires fetching current progress and explicit conflict resolution (or reload for completion/changed questions). Guests remain local-only; drafts are isolated by stable owner/puzzle ID. See `docs/puzzle-drafts.md`.
- Attempts and hints support authenticated and guest users. Authenticated hint counts are persisted on the attempt; guests must send `hints_revealed` to advance through sequential hints, and send their local counters with attempts for scoring.
- Daily attempt/hint routes validate that `puzzle_id` matches today's puzzle date; archive routes address an earlier puzzle by path ID. Today is selected by **Europe/London** local date, not a fixed 09:00 UTC release.
- `/attempt` is rate-limited to 10/min; `/hint` to 5/min.
- Failed Crossword, Sudoku and Codeword submissions include `error_cells`: zero-based row-major cell indices. Crossword/Sudoku identify incorrect cells; Codeword identifies inconsistent mappings/givens and all cells of rejected dictionary words, never differences from the reference answer. Other/terminal responses return an empty array. Older servers may omit the field; clients must tolerate omission. Feedback contains no replacement letters and is not included in puzzle-detail responses. Deploy the compatible backend before clients to enable highlights.
- Scores use time from opening the puzzle, not time since release. Solved daily scores range from 10–100 before any archive adjustment; archive scores deduct a further 10 (still minimum 10). Give-up is a terminal unsolved state with score 0 and a revealed reference answer.
- Mobile daily/archive hint wrappers forward the local `hints_revealed` counter for guests; authenticated requests rely on the persisted server count. Mobile restores `revealed_hint` text when supplied.

---

## 4. Request/response shapes

**`POST /puzzle/attempt`**
```json
// Request
{
  "puzzle_id": 123,
  "guess": "some answer",
  "opened_at": "2026-05-03T10:00:00Z",  // optional
  "incorrect_guesses": 0,             // optional, default 0; guest-local counter
  "hints_used": 0                     // optional, default 0; guest-local counter
}

// Response
{
  "correct": true,
  "score": 100,
  "incorrect_guesses": 0,
  "solved": true,
  "gave_up": false,
  "answer": "...",       // correct / already solved / terminal give-up
  "question": "...",     // decoded separately according to puzzle_type
  "explanation": "...",
  "streak": 5,           // nullable; authenticated daily success
  "opened_at": null,
  "length_penalty_applied": false
}
```

**`POST /puzzle/hint`**
```json
// Request
{ "puzzle_id": 123, "hints_revealed": 0 } // counter optional, defaults to 0; used for guests

// Response
{ "hint": "revealed hint text", "total_hints": 1 }
```

---

## 5. Known puzzle types

`question` shapes and guess formats for the supported mobile types below are implemented in `src/api/schemas.ts` and `src/components/puzzle/`. Backend-only types are marked explicitly. The grid types share `grid.tsx` (board, hidden keyboard input, frame), and their revealed answers render as read-only grids via `PuzzleAnswer.tsx`. See §7 for known mobile/backend differences.

| `puzzle_type` | `question` shape | Guess sent to `/attempt` |
|---|---|---|
| `word` | string (HTML with `<br>`) | free text |
| `math` | string | free text |
| `ladder` | comma-separated string mixing known words and `"____"` blanks, e.g. `"cat, ____, ____, dog"` | comma-separated guesses for the blank positions only, in order, e.g. `"cot, cog"` (known words are not resubmitted) |
| `word-ladder-v2` | raw string, exactly two comma-separated words (start, end), always equal length, e.g. `"cold, warm"` | comma-separated *intermediate* words only, in path order, e.g. `"cord, card, ward"` — see quirk below |
| `choice` | `"prompt\|optA\|optB\|optC\|optD"` (pipe-delimited) | letter code: `"A"`/`"B"`/`"C"`/`"D"` |
| `image-word` | JSON `{ prompt, image_url }` | free text |
| `clue-reveal` | JSON `{ prompt, clues: string[] }` | free text (see hint quirk below) |
| `countdown` | JSON `{ prompt, target, numbers: number[], operators: string[] }` | JSON-encoded array of selected tile strings, e.g. `'["6","×","(","50","+","1",")"]'`; never just the calculated total |
| `order` | JSON `{ prompt, items: string[] }` | comma-separated original indices reflecting user's reorder, e.g. `"2,0,1,3"` |
| `word-wheel` | JSON `{ prompt, wheels: { letters: (string\|null)[] }[] }` | space-separated found words |
| `scrabble` | JSON `{ prompt, board: (string\|null)[], modifiers: (string\|null)[], rack: string[] }` | trimmed `"word score"` string, e.g. `"mask 10"` |
| `numgrid` | JSON `{ prompt, grid: (number\|null)[] }` (exactly one `null` cell) | trimmed numeric string |
| `wordsearch` | letter-grid rows with `Find: N` (word count) or legacy `Find: WORD` (one field), optional `Theme:` line | space-separated found words |
| `match` | JSON `{ prompt, left: string[], right: string[] }` (equal length) | comma-separated index mapping, one entry per `left` item |
| `connections` | JSON `{ prompt, items: string[], categories?: string[] }` | pipe-delimited group assignment (see `ConnectionsPuzzle.tsx`) |
| `chess` | JSON `{ fen: string }` | lowercase UCI move string, e.g. `"e2e4"`, with promotion suffix when applicable (e.g. `"e7e8q"`) |
| `crossword` | JSON `{ prompt, layout: string[], clues: { across: Record<string,string>, down: Record<string,string> } }` — `layout` rows use `"."` (letter) and `"#"` (black), **3–25 rows × 3–25 columns**, all rows equal length; wide mobile boards scroll horizontally (§7) | the whole grid row-major, one character per cell, letters `A–Z` and `"#"` for black squares, e.g. `"CATA#OBOW"` — exact match, see quirks below |
| `sudoku` | JSON `{ prompt, grid: string }` — `grid` is 81 characters, `"1"–"9"` for givens and `"0"` for blanks, row-major | all 81 digits row-major, e.g. `"634915872…"` (no separators) |
| `codeword` | JSON `{ prompt, cells: number[][], givens: Record<string,string> }` — `cells` is a rectangular grid (**3–25 per side**, including rectangular grids; wide mobile boards scroll horizontally (§7)) of `0` (black) or `1–26` (a letter code); `givens` maps a code (as a string key) to its revealed letter | the whole grid row-major, one character per cell, letters `A–Z` and `"#"` for black squares, e.g. `"CATA#OBOW"` — any valid fill is accepted, see quirks below |
| `word-square` | JSON `{ prompt, size: number, clues: string[] }` — `size` is 3–6 and `clues` has exactly `size` entries (clue N is for row N and column N) | all `size × size` letters row-major with no separators, e.g. `"THATHEREAREATEAM"` — any valid square is accepted, see quirks below |
| `number-square` | JSON `{ prompt, cells: (number\|null)[], row_ops: Op[][], col_ops: Op[][], row_results: number[], col_results: number[] }` — `cells` has 9 entries (row-major, `null` = blank, otherwise a given); `Op` is `"+"`, `"-"`, `"*"` or `"/"`; `row_ops`/`col_ops` are 3 pairs; results are 3 integers | the 9 numbers row-major, comma-separated, e.g. `"2,3,4,5,1,6,3,2,2"` — any fill that satisfies every equation is accepted, see quirks below |
| `canvas` | JSON `{ prompt, background?: string, alt?: string, shapes: Shape[] }` — a drawing in a fixed 800 × 600 coordinate space, see quirks below | free text |
| `image-tap` (backend/web only) | JSON `{ prompt, image_url }` | normalized coordinate string `"x,y"`, e.g. `"0.52,0.38"`; not implemented on mobile |
| `image-order` (backend/web only) | JSON `{ prompt, images: string[] }` | comma-separated original image indices in the chosen order, e.g. `"2,0,1"`; not implemented on mobile |

### Countdown submissions and running total

Daily and archive play submit the expression as a JSON string array of number/operator/parenthesis tiles. The backend checks the supplied numbers (including duplicate counts), allowed operators and exact arithmetic; a bare target such as `"306"` is rejected. `formatCountdownResult` is for displaying totals only, not request encoding.

**Show total (-10 pts)** and **Hint** use the same hint endpoint and unlock the same running total. Totals remain hidden until a hint request succeeds; failed/offline requests do not unlock them. Once purchased, the total remains available through edits, backspace and Clear. Restored `revealed_hint` also restores the total without a second purchase. Countdown always exposes at least one hint (`"Running total enabled"` when no authored hint exists). Guest attempts carry the local `hints_used` penalty; authenticated attempts use the server's persisted hint count.

The mobile fix uses the existing backend/web contract; no new endpoint, response field or database migration is required. Older mobile builds submitting numeric totals remain incompatible and need a client update; do not relax backend expression validation to accommodate them.

### Wordsearch play and revealed locations

The mobile and web players use a compact two-column answer list, uniquely labelled
fields, an **X of N entered** counter beside Submit, and retain entries after wrong or
failed requests. The counter measures non-empty fields, not correctness; all fields
are required before submission. Mobile inputs retain at least 44-point height and
large result grids scroll horizontally. Wordsearch does not gain persistent drafts
from this change; only in-session retry behavior is covered.

Daily/archive results, including give-up, render the revealed grid and highlight words
in all eight straight-line directions. Select a word to isolate its path, and select it
again to show all paths. Each word also has visible start/end row and column coordinates
for non-colour and screen-reader use. The first valid occurrence is used if a word appears
more than once: the API does not carry authored coordinates. Invalid/ragged grids or
missing words keep the answer list with **Location unavailable** rather than failing
the result screen. This uses the existing revealed `answer`/`question`, not a new API field;
no schema, backend rollout or database change is needed. It does not add live answer
validation or reveal locations before completion.

### Ladder blank count

The number of `"____"` blanks in a `ladder` question is **not fixed** — puzzles are generated with anywhere from 2 up to `steps - 2` blanks (see the puzzle generator in the main app repo). The client must parse `question` to find the blank positions rather than assuming a fixed step count, and must submit only the blank words (comma-separated, in position order) — not the full chain and not the words already given in the question.

### Word-ladder-v2 quirks

Requirements the backend enforces on a guess: every word (guess words plus `question`'s start/end) must be the same length as the start/end word; `[start, ...guessWords, end]` must be a dictionary-valid ladder where each consecutive pair differs by exactly one letter; at least one intermediate word is required. Any valid ladder is accepted as correct — it doesn't need to match the `answer` path — though a valid ladder longer than the shortest route incurs a flat 10-point length penalty already baked into `score` (surfaced separately as `length_penalty_applied: boolean` on a correct/already-solved `/attempt` response; the web client shows a note when it's `true`, the mobile client currently ignores it). "Shortest route" is calculated server-side by searching through common words first (wordfreq zipf ≥ 3.5, then ≥ 3.0, then any dictionary word), so a player who finds a shorter route through rarer words is never penalised. A redundant trailing copy of the end word in the guess is tolerated (silently dropped server-side before validation).

Hint behavior is standard (single `hint` string via `POST /puzzle/hint`). The backend returns no per-letter feedback (the old `letter_feedback` field has been removed from `/attempt` responses); the client computes its own Wordle-style feedback by comparing each typed word directly against the target end word, with no backend round-trip (see `letterStates()` in `WordLadderV2Puzzle.tsx`).

Revealed `answer` is the server-calculated shortest route (not authored — admins only set the start/end words, and the answer is recomputed whenever the puzzle is saved), as intermediate words only (same shape as a guess), e.g. `"cord, word, ward"` for `"cold, warm"` — it does not include the start/end words; no custom formatting is applied in `puzzleAnswer.ts` (falls through to the standard text formatter, matching `ladder`).

### Grid puzzle quirks (`crossword`, `sudoku`, `codeword`, `word-square`, `number-square`)

Common to all five: a guess is a single string describing the *whole* grid (the client should only enable Submit once every editable cell is filled), guesses are case-insensitive, hints are standard (single `hint` string, `total_hints` of 1 when set), and the revealed `answer` is the stored reference solution (authored or generated) in the same format as a guess. The raw answer string is unreadable on its own, so the result screen should render it as a grid (add a case in `puzzleAnswer.ts`, or a dedicated read-only grid component) rather than printing it.

**Exact-match types: `crossword`, `sudoku`.** The guess must equal the authored `answer` (case-insensitive). Sudoku puzzles are validated server-side to have exactly one solution, so exact match is fair. Crosswords are not checked for alternative fills, so only the authored grid is correct.

- **Crossword answers and clues:** saved answer letters are uppercase `A–Z`, with `#` exactly matching black cells. Every generated entry has a non-empty clue. Repeated answers, even in the same direction, can have different clues: key them by number/direction, never by answer text. Dictionary membership, two-letter entries, disconnected sections, and isolated cells are not backend save-blocking quality constraints; mobile must not reject a crossword solely because an answer is a name, abbreviation, or absent from a dictionary.
- **Crossword numbering** is derived client-side from `layout`; clue keys are the resulting numbers as strings. A white cell is numbered if it starts an across word and/or a down word of 2+ letters, counting left-to-right then top-to-bottom with one shared counter; `clues.across` and `clues.down` are keyed by those numbers (e.g. a cell numbered `3` that only starts an across word appears only under `across`). The backend rejects puzzles whose clue keys don't match this numbering, so the client can rely on it. Mirror `crossword_numbers` in the backend (`buildCrossword` in the web app's `crossword.ts`).
- **Sudoku givens** are the non-`"0"` characters of `grid` and are read-only; the guess includes them (all 81 cells). Save validation requires a complete matching solution with 1–9 exactly once per row, column, and 3×3 box, and exactly one solution to the starting grid. The web builder can generate puzzles targeting 44, 36, or 28 givens; those counts are not difficulty ratings or new wire fields, and uniqueness may require retaining more clues.

**Rule-checked types: `codeword`, `word-square`, `number-square`.** The backend does *not* compare the guess with `answer`; it accepts **any** fill that satisfies the rules, so the client must never mark a guess wrong by comparing it with the authored answer, and the revealed `answer` may differ from what the player submitted.

- **`codeword`** — every cell shares a letter with all cells that have the same code. A guess is correct when: the guess length is `rows × cols`; black cells (`0`) are `"#"` and all others are `A–Z`; each code maps to exactly one letter and no two codes share a letter; every `givens` entry matches; and **every run of 2+ letters, across and down, is a dictionary word** (the backend uses `wordfreq`, `zipf_frequency > 0`, so it is permissive — e.g. some obscure strings pass). A wrong guess returns `correct: false` and `error_cells` for rejected words or inconsistent assignments, without revealing correct letters. Clients should apply the one-letter-per-code and one-code-per-letter rules while typing (the web client does), and show given letters read-only.
- **`word-square`** — row N and column N must spell the same word, i.e. `grid[r][c] == grid[c][r]`; each of the `size` rows must be a dictionary word (same `wordfreq` check as above). Because of the symmetry, a client can let the player type only the upper triangle and mirror each letter to the cell across the diagonal (the web client does). `clues[n]` is the clue for word `n + 1`.
- **`number-square`** — a 3×3 grid of numbers where each row and column is an equation `a op b op c = result`. `row_ops[r]` are the two operators between the three numbers of row `r`; `col_ops[c]` are the two operators between the three numbers of column `c`, top to bottom; `row_results`/`col_results` are the totals at the end of each row and the bottom of each column. **`*` and `/` bind tighter than `+` and `-`** (so `2 + 3 * 4 = 14`), evaluated with exact fractions: the final line value must equal its integer target, and division by zero fails. An intermediate fraction is allowed if the final result matches (e.g. `3 / 2 * 2 = 3`); do not reject or round intermediate fractions. Display `*` as `×`, `/` as `÷`, `-` as `−`. Entered numbers are integers 0–99 and `null` cells are the only editable ones; the guess includes the given numbers too. The guess must contain exactly 9 comma-separated numbers or it is wrong.

### Canvas puzzle quirks

`canvas` is a picture puzzle: the player is shown a drawing and types free text, so guess handling is the same as `image-word` — except the image is data, not a URL. The client must render it itself (the web client draws inline SVG; React Native can use `react-native-svg`).

- **Coordinate space** is fixed at 800 wide × 600 high with the origin at the top-left; scale the whole scene to fit the screen (aspect ratio 4:3). `background` accepts `#rgb`, `#rrggbb`, or `"none"` (the shared renderer defaults to `#15191e`, the app background, when omitted; the backend validator also accepts omission). `alt` is an optional description for screen readers.
- **Draw order** is array order (later shapes are on top). Every shape may carry optional `fill` and `stroke` (each a `#rgb`/`#rrggbb` hex string or `"none"`, defaulting to `"none"`) and `strokeWidth` (0–50, default 1). Shape types:
  - `{ type: "rect", x, y, w, h }`
  - `{ type: "ellipse", cx, cy, rx, ry }`
  - `{ type: "line", x1, y1, x2, y2, arrow? }` — when `arrow` is true, draw a filled triangular head at `(x2, y2)` in the stroke colour (the web client sizes it `10 + 3 × strokeWidth` px, ±π/7 either side of the line)
  - `{ type: "path", points: [x, y][] }` — an open polyline of 2–2000 points, stroked with round caps/joins and **never filled** (ignore `fill`)
  - `{ type: "text", x, y, text, size }` — `(x, y)` is the text *baseline* origin, `size` is the font size in scene units, sans-serif, drawn in `fill` (default `#e0e0e0`, not `none`)
- Numeric coordinates/sizes are within −1000…3000; there must be 1–200 shapes, text strings must have 1–100 characters, and the serialized `question` is limited to 50,000 characters by the backend (not a byte-counted upload limit). Clients should skip any shape with an unknown `type` rather than failing, so new shape types can be added later.
- **Answer alternatives:** the authored `answer` can list alternatives separated by `|` (e.g. `"house|a house|home"`); a guess matching any one of them (case-insensitive, whitespace-normalised) is correct. When showing the revealed answer, show the first alternative or join them readably rather than printing the raw string.

### Clue-reveal hint quirk

The hint button reveals the *next* clue from `clues[]`, but the first clue is never hintable: the backend returns `json.loads(question).get("clues", [])[1:]`. Clue index `0` is always shown upfront as part of the puzzle; each `POST /puzzle/hint` call reveals the next successive clue from that sliced list. `hint_used` increments per call; once `hint_used >= total_hints`, hint returns a 404. The generic `hint` field on the puzzle object is ignored entirely for this type — it's only a fallback for types without structured hint data.

---

## 6. Where this lives in the mobile app

- Schemas: `src/api/schemas.ts` (per-type Zod schema, added to `KNOWN_PUZZLE_TYPES` and the `PuzzleSchema` union)
- Rendering: `src/components/puzzle/PuzzleRenderer.tsx` (switch dispatch) + one component per type in `src/components/puzzle/`
- Answer display formatting (only if the revealed answer needs custom rendering): `src/lib/puzzleAnswer.ts`

---

## 7. Recent backend/web changes and mobile follow-ups

### Larger crossword/codeword grids

The backend validators and web builders accept **3–25 rows and 3–25 columns**, independently (not only square grids). This supersedes the old 3–15 contract.

**Mobile implementation:** both schemas accept up to 25 in each dimension and retain equal-width/rectangular checks. Shared play/result boards keep cells at least 32 points wide and scroll horizontally instead of shrinking large boards to illegible sizes. Crossword clues can be tapped to select their entry by direction and number.

Automated coverage includes schema boundaries at 3, 15, 16, 25, rejection of 26 and ragged grids, plus wide/tall and 25 × 25 play/result rendering and clue selection. Physical-device checks for scrolling, keyboard interaction, and readability on small screens remain recommended.

### Web authoring improvements do not add mobile wire fields

Crossword and codeword now have live solution/player previews and inline grid validation. Codeword authoring also shows starter frequencies/coverage, highlights rejected words, and checks the same dictionary as save/play. Crossword authoring links clues to grid cells, tracks missing clues, and flags changed-answer clues for review while retaining confidently matched clues through edits. Repeated answers have independent clues. Crossword dictionary and quality warnings are **advisory**, unlike codeword dictionary membership.

These are admin-editor features, not new play API fields. In particular:
- Codeword starter counts, coverage percentages, and code-assignment order are editor details. Play uses the supplied `cells` and `givens`; never assume a code corresponds to alphabetical order or regenerate the saved codes client-side.
- Crossword completion counts, current selection, dictionary warnings, and “review clue” flags are editor-local; the saved contract remains `prompt`, `layout`, and numbered `clues`.
- The shared dictionary endpoint is `POST /api/admin/codeword/check-words` and requires admin authentication. Mobile players must not call it; submission feedback comes from `/attempt` via `error_cells`.
- Sudoku generation changes authoring only: there is no generation endpoint, difficulty field, or client requirement to generate a solution.
- Canvas drawing tools (selection, resize, layering, copy/paste, undo/redo) serialize the existing shape array. Mobile only needs to render the resulting scene, not implement the editor.

### Grid play feedback

Sudoku on both clients flags repeated visible digits as players type, delete, paste or
restore a draft. Every conflicting cell is marked, including givens, with descriptions
such as **Duplicate 7 in row 1** or **Duplicate 7 in box 1**. Multiple affected units are
reported separately. Web cells expose `aria-invalid` and associated conflict descriptions;
mobile cells expose conflict text in their accessible value, and the keyboard input
provides the selected cell's conflict hint. Changed summaries use an Android live region
and explicit iOS accessibility announcements, without repeating an unchanged warning.

This uses only entries/givens, never the solution. An isolated incorrect digit is not
flagged. Duplicates are allowed during editing and autosave, and do not disable a complete
board's Submit button or cause an attempt/hint request or penalty. Correction/deletion
recomputes warnings immediately. Live warnings are independent of submission errors and
are derived on restoration rather than stored in drafts. There is no new wire field,
backend rollout or database change.

Both web and mobile distinguish the selected square from the highlighted Crossword entry or Codeword code group. Sudoku highlights the selected row and column. Codeword lists A–Z letters not currently assigned, including starter letters as used; erasing an assignment restores its letter to the unused list. Failed submissions highlight server-reported cells and announce errors accessibly. Editing clears the old submitted-error highlights until the next submission; submitted feedback is session-only, not saved in drafts. Sudoku live duplicate warnings may remain after an edit if a visible conflict still exists. Dictionary feedback can identify a rejected word, not which individual letter is wrong. Normal wrong-guess penalties still apply.

### Other compatibility follow-ups

- Sequential guest hints are wired into daily/archive wrappers using the local `hints_revealed` count, including after an in-session remount. Authenticated clients use the server's persisted count.
- Keep `image-tap` and `image-order` in the unsupported/play-on-web flow until their mobile schemas and renderers are implemented. The backend currently has 24 types; this client explicitly recognizes 22.
- Preserve independent duplicate crossword clues in any client-side cache/lookup. Use `(direction, number)` as the entry identity within a saved puzzle, not its answer text.
- Keep rule-checked grid answers server-authoritative. Do not compare codeword, word-square, or number-square guesses against a previously revealed reference or apply crossword-only dictionary warnings as local save/submit restrictions.

## 8. Concrete grid payload examples

The following are decoded `question` objects. On the wire, serialize each object to a string. Guesses include all cells, including givens and `#` black cells where applicable. These examples use small boards; mobile also accepts crossword/codeword boards up to 25 × 25.

### Crossword

```json
{
  "prompt": "Fill in the grid",
  "layout": ["...", ".#.", "..."],
  "clues": {
    "across": {"1": "Feline pet", "3": "Ribbon knot"},
    "down": {"1": "Yellow taxi", "2": "Pull a broken-down car"}
  }
}
```

Reference answer/guess: `CATA#OBOW`.

### Sudoku

```json
{
  "prompt": "Fill every row, column and 3x3 box with 1-9.",
  "grid": "000010002005000600870000005340100026100000040000009008400000000087003090203400080"
}
```

Reference answer/guess: `634915872915872634872634915349158726158726349726349158491587263587263491263491587`.

### Codeword

```json
{
  "prompt": "Each number is a letter. Crack the code.",
  "cells": [[1, 2, 3], [2, 0, 4], [5, 4, 6]],
  "givens": {"2": "A", "4": "O"}
}
```

Reference answer/valid guess: `CATA#OBOW`. Another valid fill may be accepted; the server enforces the code, starter, and dictionary rules.

### Word Square

```json
{
  "prompt": "Each row reads the same as the column with its number.",
  "size": 4,
  "clues": ["Not this", "Not there", "A region", "Group playing together"]
}
```

Reference answer/valid guess: `THATHEREAREATEAM` (THAT / HERE / AREA / TEAM).

### Number Square

```json
{
  "prompt": "Fill the blanks so every row and column equals its total.",
  "cells": [2, null, 4, null, 1, null, 3, null, 2],
  "row_ops": [["+", "*"], ["-", "+"], ["*", "-"]],
  "col_ops": [["+", "*"], ["*", "+"], ["-", "/"]],
  "row_results": [14, 10, 4],
  "col_results": [17, 5, 1]
}
```

Reference answer/valid guess: `2,3,4,5,1,6,3,2,2`.
