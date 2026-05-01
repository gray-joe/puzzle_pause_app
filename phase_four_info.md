# Phase Four API Reference

## GET /puzzle/result

**Auth:** Required (session cookie).  
**Query params:** None.

Returns the solved result for today's puzzle. 404s if no puzzle exists today or the user hasn't solved it yet.

**Response 200**
```json
{
  "puzzle": {
    "id": <int>,
    "puzzle_date": <date>,
    "puzzle_type": <string>,
    "puzzle_name": <string>,
    "question": <string>,
    "hint": <string | null>,
    "has_hint": <bool>,
    "total_hints": <int>,
    "puzzle_number": <int>
  },
  "attempt": {
    "solved": true,
    "score": <int>,
    "incorrect_guesses": <int>,
    "hint_used": <bool>,
    "completed_at": <ISO 8601 string | null>,
    "opened_at": <ISO 8601 string | null>
  }
}
```

Notes:
- `question` has sensitive fields stripped (e.g. `target` for `image-tap`, `categories` for `connections`, extra clues beyond the first for `clue-reveal`).
- `answer` is **not** included.
- `opened_at` is present on the attempt here but is absent from the archive result (see below).

**Errors**

| Status | Detail |
|--------|--------|
| 401 | Not authenticated |
| 404 | `"No puzzle today"` |
| 404 | `"Not solved yet"` |

---

## GET /archive

**Auth:** Optional (session cookie). Unauthenticated users get `solved: null` on every item.  
**Query params:** `limit` (int, 1–100, default 50), `offset` (int ≥ 0, default 0).

Returns a paginated list of past puzzles (excludes today).

**Response 200** — array of:
```json
{
  "id": <int>,
  "puzzle_date": <date>,
  "puzzle_type": <string>,
  "puzzle_name": <string>,
  "hint": <string | null>,
  "has_hint": <bool>,
  "puzzle_number": <int>,
  "solved": <bool | null>
}
```

Notes:
- `solved` is `true`/`false` for authenticated users, `null` for guests.
- List is ordered newest-first.
- Does **not** include `question` or `answer`.

---

## GET /archive/{id}

**Auth:** Optional (session cookie).  
**Path param:** `id` — puzzle id.

Returns full puzzle data plus attempt state if the user has one. Unauthenticated users get puzzle data only.

**Response 200**
```json
{
  "id": <int>,
  "puzzle_date": <date>,
  "puzzle_type": <string>,
  "puzzle_name": <string>,
  "question": <string>,
  "hint": <string | null>,
  "has_hint": <bool>,
  "total_hints": <int>,
  "puzzle_number": <int>,

  // only present for authenticated users with an existing attempt:
  "solved": <bool>,
  "attempt": {
    "solved": <bool>,
    "score": <int | null>,
    "incorrect_guesses": <int>,
    "hint_used": <bool>,
    "completed_at": <ISO 8601 string | null>
  },

  // only present when the attempt is solved:
  "answer": <string>
  // also: "question" is replaced with the full unstripped version when solved
}
```

Notes:
- For unauthenticated users the response is puzzle fields only (no `solved`, `attempt`, or `answer`).
- `question` is stripped of sensitive fields unless the attempt is solved, in which case the full raw `question` and `answer` are returned.

**Errors**

| Status | Detail |
|--------|--------|
| 404 | `"Puzzle not found"` (id doesn't exist or is today/future) |

---

## POST /archive/{id}/attempt

**Auth:** Optional.  
**Path param:** `id` — puzzle id.

Same shape as `POST /puzzle/attempt` except the puzzle is looked up by path id rather than `puzzle_id` in the body.

**Request body**
```json
{
  "puzzle_id": <int>,
  "guess": <string, max 1000 chars>,
  "opened_at": <ISO 8601 string | null>
}
```

Note: `puzzle_id` in the body is present because the schema is shared with the today endpoint, but the archive route resolves the puzzle from the path `{id}` — the body field is effectively ignored for routing.

**Response 200**
```json
{
  "correct": <bool>,
  "score": <int | null>,
  "incorrect_guesses": <int>,
  "solved": <bool>,
  "answer": <string | null>,   // present only on correct
  "question": <string | null>, // present only on correct (full unstripped)
  "streak": <int | null>,      // NOT present (archive never returns streak)
  "opened_at": <datetime | null>
}
```

Differences from `POST /puzzle/attempt`:
- Archive scores are always `0` (no time-based scoring).
- `streak` is never populated.

**Errors**

| Status | Detail |
|--------|--------|
| 404 | `"Puzzle not found"` |

---

## POST /archive/{id}/hint

**Auth:** Optional.  
**Path param:** `id` — puzzle id.  
**Request body:** None (no body required).

Returns the puzzle's hint. For authenticated users, marks the hint as used on the attempt (idempotent). For guests, just returns the hint without persisting anything.

Unlike `POST /puzzle/hint` (which takes a `HintRequest` body with `puzzle_id`), the archive hint endpoint takes **no request body** — the puzzle is identified entirely by the path.

**Response 200**
```json
{
  "hint": <string>,
  "total_hints": 1
}
```

Note: Archive hints always return `total_hints: 1` — multi-hint logic (connections categories, clue-reveal clues) is only implemented on today's puzzle endpoint.

**Errors**

| Status | Detail |
|--------|--------|
| 404 | `"No hint available"` (puzzle not found or has no hint) |
