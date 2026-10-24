# Puzzle Pause — Puzzle Type Reference

This document is the contract between this app (mobile client), the web app, and the backend for **puzzle data only**. It exists so that whenever a puzzle type is added or changed on web/backend, this repo has exactly what it needs to support it — nothing else about the app is tracked here.

When a new puzzle type ships on web/backend, fill in §1 and add a row to the table in §5.

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

Every puzzle response — regardless of type — includes these fields:

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
- `attempt` is the current user's state; `null`/zero-valued fields mean "not attempted yet." Present for guests too (not persisted server-side without an account).
- `answer`, `explanation`, `completion_stats` are populated once solved / given up (or always, depending on endpoint — verify per-endpoint if behavior looks inconsistent).
- Any `puzzle_type` not recognized by the client falls back to an "unsupported, play on web" state — new types must be added explicitly, they don't work automatically.

---

## 3. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/puzzle/today` | Today's puzzle + the user's attempt state. |
| POST | `/puzzle/attempt` | Submit an answer. |
| POST | `/puzzle/hint` | Reveal next hint. |
| GET | `/puzzle/result` | Final result for today. |
| GET | `/archive` | List of past puzzles with `solved` status. |
| GET | `/archive/{id}` | Past puzzle by id. |
| POST | `/archive/{id}/attempt` | Submit answer for an archived puzzle. |
| POST | `/archive/{id}/hint` | Reveal hint for an archived puzzle. |
| GET | `/archive/{id}/result` | Result for an archived puzzle. |

Behavioral notes:
- `/attempt` works for unauthenticated/guest users (no streak, no persisted attempt); `/hint` requires auth (it tracks `hint_used` on the attempt row).
- Both routes validate that `puzzle_id` matches today's puzzle date — a 404 is returned for any other date (not applicable to the `/archive/{id}/*` variants).
- `/attempt` is rate-limited to 10/min; `/hint` to 5/min.

---

## 4. Request/response shapes

**`POST /puzzle/attempt`**
```json
// Request
{
  "puzzle_id": 123,
  "guess": "some answer",
  "opened_at": "2026-05-03T10:00:00Z"   // optional
}

// Response
{
  "correct": true,
  "score": 950,
  "incorrect_guesses": 0,
  "solved": true,
  "gave_up": false,
  "answer": "...",       // only on correct / already solved
  "question": "...",     // only on correct / already solved
  "explanation": "...",
  "streak": 5,           // only for authenticated users on correct
  "opened_at": null,
  "completed_at": "..."
}
```

**`POST /puzzle/hint`**
```json
// Request
{ "puzzle_id": 123 }

// Response
{ "hint": "revealed hint text", "total_hints": 1 }
```

---

## 5. Known puzzle types

`question` shapes and guess formats for every type the backend can serve, all implemented in `src/api/schemas.ts` and `src/components/puzzle/`. The grid types share `grid.tsx` (board, hidden keyboard input, frame), and their revealed answers render as read-only grids via `PuzzleAnswer.tsx`.

| `puzzle_type` | `question` shape | Guess sent to `/attempt` |
|---|---|---|
| `word` | string (HTML with `<br>`) | free text |
| `math` | string | free text |
| `ladder` | comma-separated string mixing known words and `"____"` blanks, e.g. `"cat, ____, ____, dog"` | comma-separated guesses for the blank positions only, in order, e.g. `"cot, cog"` (known words are not resubmitted) |
| `word-ladder-v2` | raw string, exactly two comma-separated words (start, end), always equal length, e.g. `"cold, warm"` | comma-separated *intermediate* words only, in path order, e.g. `"cord, card, ward"` — see quirk below |
| `choice` | `"prompt\|optA\|optB\|optC\|optD"` (pipe-delimited) | letter code: `"A"`/`"B"`/`"C"`/`"D"` |
| `image-word` | JSON `{ prompt, image_url }` | free text |
| `clue-reveal` | JSON `{ prompt, clues: string[] }` | free text (see hint quirk below) |
| `countdown` | JSON `{ prompt, target, numbers: number[], operators: string[] }` | formatted result expression, see `formatCountdownResult` |
| `order` | JSON `{ prompt, items: string[] }` | comma-separated original indices reflecting user's reorder, e.g. `"2,0,1,3"` |
| `word-wheel` | JSON `{ prompt, wheels: { letters: (string\|null)[] }[] }` | space-separated found words |
| `scrabble` | JSON `{ prompt, board: (string\|null)[], modifiers: (string\|null)[], rack: string[] }` | trimmed word string |
| `numgrid` | JSON `{ prompt, grid: (number\|null)[] }` (exactly one `null` cell) | trimmed numeric string |
| `wordsearch` | string containing a `Find:` section | space-separated found words |
| `match` | JSON `{ prompt, left: string[], right: string[] }` (equal length) | comma-separated index mapping, one entry per `left` item |
| `connections` | JSON `{ prompt, items: string[], categories?: string[] }` | pipe-delimited group assignment (see `ConnectionsPuzzle.tsx`) |
| `chess` | JSON `{ fen: string }` | lowercase UCI move string, e.g. `"e2e4"`, with promotion suffix when applicable (e.g. `"e7e8q"`) |
| `crossword` | JSON `{ prompt, layout: string[], clues: { across: Record<string,string>, down: Record<string,string> } }` — `layout` rows use `"."` (letter) and `"#"` (black), 3–15 rows × 3–15 columns, all rows equal length | the whole grid row-major, one character per cell, letters `A–Z` and `"#"` for black squares, e.g. `"CATA#OBOW"` — exact match, see quirks below |
| `sudoku` | JSON `{ prompt, grid: string }` — `grid` is 81 characters, `"1"–"9"` for givens and `"0"` for blanks, row-major | all 81 digits row-major, e.g. `"634915872…"` (no separators) |
| `codeword` | JSON `{ prompt, cells: number[][], givens: Record<string,string> }` — `cells` is a rectangular grid (3–15 per side) of `0` (black) or `1–26` (a letter code); `givens` maps a code (as a string key) to its revealed letter | the whole grid row-major, one character per cell, letters `A–Z` and `"#"` for black squares, e.g. `"CATA#OBOW"` — any valid fill is accepted, see quirks below |
| `word-square` | JSON `{ prompt, size: number, clues: string[] }` — `size` is 3–6 and `clues` has exactly `size` entries (clue N is for row N and column N) | all `size × size` letters row-major with no separators, e.g. `"THATHEREAREATEAM"` — any valid square is accepted, see quirks below |
| `number-square` | JSON `{ prompt, cells: (number\|null)[], row_ops: Op[][], col_ops: Op[][], row_results: number[], col_results: number[] }` — `cells` has 9 entries (row-major, `null` = blank, otherwise a given); `Op` is `"+"`, `"-"`, `"*"` or `"/"`; `row_ops`/`col_ops` are 3 pairs; results are 3 integers | the 9 numbers row-major, comma-separated, e.g. `"2,3,4,5,1,6,3,2,2"` — any fill that satisfies every equation is accepted, see quirks below |
| `canvas` | JSON `{ prompt, background?: string, alt?: string, shapes: Shape[] }` — a drawing in a fixed 800 × 600 coordinate space, see quirks below | free text |

### Ladder blank count

The number of `"____"` blanks in a `ladder` question is **not fixed** — puzzles are generated with anywhere from 2 up to `steps - 2` blanks (see the puzzle generator in the main app repo). The client must parse `question` to find the blank positions rather than assuming a fixed step count, and must submit only the blank words (comma-separated, in position order) — not the full chain and not the words already given in the question.

### Word-ladder-v2 quirks

Requirements the backend enforces on a guess: every word (guess words plus `question`'s start/end) must be the same length as the start/end word; `[start, ...guessWords, end]` must be a dictionary-valid ladder where each consecutive pair differs by exactly one letter; at least one intermediate word is required. Any valid ladder is accepted as correct — it doesn't need to match the `answer` path — though a valid ladder longer than the shortest route incurs a flat 10-point length penalty already baked into `score` (surfaced separately as `length_penalty_applied: boolean` on a correct/already-solved `/attempt` response; the web client shows a note when it's `true`, the mobile client currently ignores it). "Shortest route" is calculated server-side by searching through common words first (wordfreq zipf ≥ 3.5, then ≥ 3.0, then any dictionary word), so a player who finds a shorter route through rarer words is never penalised. A redundant trailing copy of the end word in the guess is tolerated (silently dropped server-side before validation).

Hint behavior is standard (single `hint` string via `POST /puzzle/hint`). The backend returns no per-letter feedback (the old `letter_feedback` field has been removed from `/attempt` responses); the client computes its own Wordle-style feedback by comparing each typed word directly against the target end word, with no backend round-trip (see `letterStates()` in `WordLadderV2Puzzle.tsx`).

Revealed `answer` is the server-calculated shortest route (not authored — admins only set the start/end words, and the answer is recomputed whenever the puzzle is saved), as intermediate words only (same shape as a guess), e.g. `"cord, word, ward"` for `"cold, warm"` — it does not include the start/end words; no custom formatting is applied in `puzzleAnswer.ts` (falls through to the standard text formatter, matching `ladder`).

### Grid puzzle quirks (`crossword`, `sudoku`, `codeword`, `word-square`, `number-square`)

Common to all five: a guess is a single string describing the *whole* grid (the client should only enable Submit once every editable cell is filled), guesses are case-insensitive, hints are standard (single `hint` string, `total_hints` of 1 when set), and the revealed `answer` is the authored solution in the same format as a guess. The raw answer string is unreadable on its own, so the result screen should render it as a grid (add a case in `puzzleAnswer.ts`, or a dedicated read-only grid component) rather than printing it.

**Exact-match types: `crossword`, `sudoku`.** The guess must equal the authored `answer` (case-insensitive). Sudoku puzzles are validated server-side to have exactly one solution, so exact match is fair. Crosswords are not checked for alternative fills, so only the authored grid is correct.

- **Crossword numbering** is derived client-side from `layout`; clue keys are the resulting numbers as strings. A white cell is numbered if it starts an across word and/or a down word of 2+ letters, counting left-to-right then top-to-bottom with one shared counter; `clues.across` and `clues.down` are keyed by those numbers (e.g. a cell numbered `3` that only starts an across word appears only under `across`). The backend rejects puzzles whose clue keys don't match this numbering, so the client can rely on it. Mirror `crossword_numbers` in the backend (`buildCrossword` in the web app's `crossword.ts`).
- **Sudoku givens** are the non-`"0"` characters of `grid` and are read-only; the guess includes them (all 81 cells).

**Rule-checked types: `codeword`, `word-square`, `number-square`.** The backend does *not* compare the guess with `answer`; it accepts **any** fill that satisfies the rules, so the client must never mark a guess wrong by comparing it with the authored answer, and the revealed `answer` may differ from what the player submitted.

- **`codeword`** — every cell shares a letter with all cells that have the same code. A guess is correct when: the guess length is `rows × cols`; black cells (`0`) are `"#"` and all others are `A–Z`; each code maps to exactly one letter and no two codes share a letter; every `givens` entry matches; and **every run of 2+ letters, across and down, is a dictionary word** (the backend uses `wordfreq`, `zipf_frequency > 0`, so it is permissive — e.g. some obscure strings pass). A wrong guess only returns `correct: false`, with no indication of which word failed. Clients should apply the one-letter-per-code and one-code-per-letter rules while typing (the web client does), and show given letters read-only.
- **`word-square`** — row N and column N must spell the same word, i.e. `grid[r][c] == grid[c][r]`; each of the `size` rows must be a dictionary word (same `wordfreq` check as above). Because of the symmetry, a client can let the player type only the upper triangle and mirror each letter to the cell across the diagonal (the web client does). `clues[n]` is the clue for word `n + 1`.
- **`number-square`** — a 3×3 grid of numbers where each row and column is an equation `a op b op c = result`. `row_ops[r]` are the two operators between the three numbers of row `r`; `col_ops[c]` are the two operators between the three numbers of column `c`, top to bottom; `row_results`/`col_results` are the totals at the end of each row and the bottom of each column. **`*` and `/` bind tighter than `+` and `-`** (so `2 + 3 * 4 = 14`), evaluated with exact fractions: a division that doesn't come out exactly, or a division by zero, makes the line fail. Display `*` as `×`, `/` as `÷`, `-` as `−`. Entered numbers are integers 0–99 and `null` cells are the only editable ones; the guess includes the given numbers too. The guess must contain exactly 9 comma-separated numbers or it is wrong.

### Canvas puzzle quirks

`canvas` is a picture puzzle: the player is shown a drawing and types free text, so guess handling is the same as `image-word` — except the image is data, not a URL. The client must render it itself (the web client draws inline SVG; React Native can use `react-native-svg`).

- **Coordinate space** is fixed at 800 wide × 600 high with the origin at the top-left; scale the whole scene to fit the screen (aspect ratio 4:3). `background` is a hex colour (`#rgb` or `#rrggbb`, default `#15191e`, the app background). `alt` is an optional description for screen readers.
- **Draw order** is array order (later shapes are on top). Every shape may carry optional `fill` and `stroke` (each a `#rgb`/`#rrggbb` hex string or `"none"`, defaulting to `"none"`) and `strokeWidth` (0–50, default 1). Shape types:
  - `{ type: "rect", x, y, w, h }`
  - `{ type: "ellipse", cx, cy, rx, ry }`
  - `{ type: "line", x1, y1, x2, y2, arrow? }` — when `arrow` is true, draw a filled triangular head at `(x2, y2)` in the stroke colour (the web client sizes it `10 + 3 × strokeWidth` px, ±π/7 either side of the line)
  - `{ type: "path", points: [x, y][] }` — an open polyline of 2–2000 points, stroked with round caps/joins and **never filled** (ignore `fill`)
  - `{ type: "text", x, y, text, size }` — `(x, y)` is the text *baseline* origin, `size` is the font size in scene units, sans-serif, drawn in `fill` (default `#e0e0e0`, not `none`)
- Numeric coordinates are within −1000…3000; there are at most 200 shapes (and the whole `question` is under 50 KB). Clients should skip any shape with an unknown `type` rather than failing, so new shape types can be added later.
- **Answer alternatives:** the authored `answer` can list alternatives separated by `|` (e.g. `"house|a house|home"`); a guess matching any one of them (case-insensitive, whitespace-normalised) is correct. When showing the revealed answer, show the first alternative or join them readably rather than printing the raw string.

### Clue-reveal hint quirk

The hint button reveals the *next* clue from `clues[]`, but the first clue is never hintable: the backend returns `json.loads(question).get("clues", [])[1:]`. Clue index `0` is always shown upfront as part of the puzzle; each `POST /puzzle/hint` call reveals the next successive clue from that sliced list. `hint_used` increments per call; once `hint_used >= total_hints`, hint returns a 404. The generic `hint` field on the puzzle object is ignored entirely for this type — it's only a fallback for types without structured hint data.

---

## 6. Where this lives in the mobile app

- Schemas: `src/api/schemas.ts` (per-type Zod schema, added to `KNOWN_PUZZLE_TYPES` and the `PuzzleSchema` union)
- Rendering: `src/components/puzzle/PuzzleRenderer.tsx` (switch dispatch) + one component per type in `src/components/puzzle/`
- Answer display formatting (only if the revealed answer needs custom rendering): `src/lib/puzzleAnswer.ts`
