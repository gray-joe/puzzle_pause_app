# Phase 5 — League API: Request / Response Shapes

All endpoints are prefixed `/api/leagues` and require authentication (session cookie / JWT).

---

## GET /api/leagues

Returns every league the authenticated user belongs to.

**Request** — no body, no query params.

**Response 200** — array of `LeagueResponse`:

```json
[
  {
    "id": 1,
    "name": "My League",
    "invite_code": "ABC123",
    "creator_id": 7,
    "member_count": 4,
    "user_rank": 2,       // null if user has no scores yet
    "user_score": 150     // all-time score; 0 if none
  }
]
```

`user_rank` / `user_score` are computed from the all-time leaderboard SQL at list time.

---

## POST /api/leagues

Creates a new league. The invite code is **server-generated** (6-character uppercase alphanumeric); the client does not supply it.

Rate-limited: 5 requests / minute per user.

**Request body:**

```json
{
  "name": "My League"   // string, max 100 chars; required
}
```

**Response 201** — `LeagueResponse` for the newly created league:

```json
{
  "id": 1,
  "name": "My League",
  "invite_code": "XK9T2F",
  "creator_id": 7,
  "member_count": 1,
  "user_rank": null,
  "user_score": 0
}
```

The creator is automatically added as the first member. `user_rank` is `null` and `user_score` is `0` on creation because no puzzle scores exist yet.

---

## GET /api/leagues/{id}

Full league detail including leaderboards and special tags. Only members can view (403 otherwise).

**Request** — no body.

**Response 200** — `LeagueDetailResponse` (extends `LeagueResponse`):

```json
{
  "id": 1,
  "name": "My League",
  "invite_code": "XK9T2F",
  "creator_id": 7,
  "member_count": 4,
  "user_rank": null,
  "user_score": 0,

  "leaderboard_today": [
    { "user_id": 7, "display_name": "Alice", "score": 95, "rank": 1 }
  ],
  "leaderboard_weekly": [
    { "user_id": 7, "display_name": "Alice", "score": 480, "rank": 1 }
  ],
  "leaderboard_alltime": [
    { "user_id": 7, "display_name": "Alice", "score": 3200, "rank": 1 }
  ],

  "tags": {
    "guesser":     { "user_id": 3, "display_name": "Bob" },  // most guesses used
    "one_shotter": { "user_id": 7, "display_name": "Alice" }, // most 1-guess solves
    "early_riser": { "user_id": 5, "display_name": "Carol" }, // most early completions
    "hint_lover":  null                                        // null when no winner
  }
}
```

Each `LeaderboardEntry`: `{ user_id, display_name, score, rank }`.
Each `TagEntry` (or `null`): `{ user_id, display_name }`.

**Errors:** 404 if league not found; 403 if not a member.

---

## POST /api/leagues/join

Join a league by invite code. Idempotent — rejoining returns the same response without creating a duplicate membership. The invite code comparison is **case-insensitive** (uppercased server-side).

Rate-limited: 10 requests / minute per user.

**Request body:**

```json
{
  "invite_code": "xk9t2f"   // string, max 20 chars; uppercased server-side
}
```

**Response 200** — `LeagueResponse`:

```json
{
  "id": 1,
  "name": "My League",
  "invite_code": "XK9T2F",
  "creator_id": 7,
  "member_count": 5,
  "user_rank": null,
  "user_score": 0
}
```

**Errors:** 404 if the invite code does not match any league.

---

## POST /api/leagues/{id}/leave

Leave a league. Two special cases handled server-side:

- **Last member leaving** — league is deleted entirely, response message differs.
- **Creator leaving** — ownership transfers to the member who joined earliest before removing the creator.

**Request** — no body.

**Response 200:**

```json
{ "message": "Left league" }
```

or, when the user was the last member and the league was deleted:

```json
{ "message": "League deleted" }
```

**Errors:** 404 if league not found or user is not a member.

---

## DELETE /api/leagues/{id}

Hard-delete a league and all its memberships. Only the creator may do this.

**Request** — no body.

**Response 204** — no body.

**Errors:** 404 if league not found; 403 if caller is not the creator.

---

## Error summary

| Status | Meaning |
|--------|---------|
| 401 | Not authenticated |
| 403 | Authenticated but not allowed (not creator / not member) |
| 404 | League or membership not found |
| 429 | Rate limit hit (create: 5/min, join: 10/min) |
