# Data Contracts (Operational)

## Supabase Tables

### `public.daily_52`
Used by:
- `js/daily.js`
- `js/daily-page.js`

Expected fields in use:
- `date_key`, `seed`, `player_name`, `player_id`, `score`, `game_version`
- crown/clear fields used by UI enrichment (`blue_cleared`, `green_cleared`, `red_cleared`, `daily_clears`, `crown_summary`)
- `created_at`

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
