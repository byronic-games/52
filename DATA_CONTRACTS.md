# Data Contracts (Operational)

## Supabase Tables

### `public.daily_52`
Used by:
- `js/daily.js`
- `js/daily-page.js`

Expected fields in use:
- `date_key`, `variant`, `seed`, `player_name`, `player_id`, `score`, `game_version`
- Daily score fields (`cards_cleared`, `bonus_score`, `remaining_cheats`, `remaining_nudges`, `power_count`, `tear_count`, `cheat_bonus`, `nudge_bonus`, `power_bonus`, `tear_penalty`, `total_score`)
- crown/clear fields used by UI enrichment (`blue_cleared`, `green_cleared`, `red_cleared`, `daily_clears`, `crown_summary`)
- `created_at`

Variant notes:
- `normal` is the default/classic Daily.
- `hard` uses its own seed and leaderboard; it unlocks after Normal is attempted for the date, torn cards are hidden, and tears are not scored.
- Historical rows should be backfilled to `normal`.
- Any uniqueness rule for Daily attempts must include `variant`, e.g. `(date_key, variant, player_id)`.
- Remove legacy date/player-only unique indexes when enabling variants. Known old names include `daily_52_date_player_uidx`, `daily_52_date_player_id_uidx`, and `daily_52_date_key_player_id_idx`.
- Client leaderboard queries, including fallback/repair queries, must filter by `variant`. If a compatibility fallback drops the variant filter, Normal can display Hard rows.
- Local-to-remote repair checks identity by `date_key` + `variant` + `player_id`.

Required permissions:
- anon `SELECT`
- anon `INSERT`

### `public.heroes_52`
Used by:
- `js/leaderboard.js`
- `js/heroes.js`

Expected fields in use:
- `player_name`, `seed`, `game_version`, `deck`, `starting_power`
- `deck_level` (legacy rows may also have `level`)
- crown/clear fields (`blue_cleared`, `green_cleared`, `red_cleared`, `daily_clears`, `crown_summary`)
- `created_at`

Required permissions:
- anon `SELECT`

### `public.black_deck_scores_52`
Used by:
- `index.html`
- `js/leaderboard.js`

Expected fields in use:
- `player_name`, `score`, `seed`, `game_version`, `created_at`

Required permissions:
- anon `SELECT`
- anon `INSERT`

Expected behavior:
- Black Deck scores are submitted separately from normal Heroes deck-clear entries.
- The intro leader strip fetches the current Black Deck high score when online and falls back to `--/52...` when unavailable.

## Crown Rules (Current)
- Blue/Green/Red crowns derive from clear booleans.
- Yellow, Orange, and Black clears are local-only for now; do not send newer deck clear columns unless the Supabase schema is deliberately extended.
- Gold crown derives from daily clear signal + legacy fallback path.
- Daily board crown display should be based on row enrichment, not viewer-local profile state.

## Identity Caveat
- `daily_52` has `player_id`.
- Cross-table links can still require name fallback for historical rows.
