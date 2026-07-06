# State Map (Storage Keys)

## High-Impact `localStorage`
- `hl_prototype_best_scores_by_mode`
- `hl_prototype_selected_deck`
- `hl_prototype_selected_level`
- `hl_prototype_deck_wins`
- `hl_prototype_deck_level_clears`
- `hl_prototype_profile_stats`
- `hl_prototype_unlock_decks`
- `hl_prototype_unlock_all`
- `hl_prototype_guess_button_order`
- `hl_prototype_nudge_button_order`
- `hl_prototype_daily_player_id`
- `hl_prototype_daily_attempts_local`
- `hl_prototype_hero_name`
- `hl_prototype_heroes_local`
- `hl_prototype_black_scores_local`
- `hl_prototype_discovered_cheats`
- `hl_prototype_discovered_powers`
- `hl_prototype_discovered_jokers`

## Supporting `localStorage`
- `hl_prototype_card_stats`
- `hl_prototype_card_back_status`
- `hl_prototype_cheat_unlocks`
- `hl_prototype_run_debug_log`
- `hl_prototype_last_seed`
- `hl_prototype_meta_progression`
- tutorial flags/state

## Deck Progression Shape
- Deck stats normalize `blue`, `green`, `red`, `orange`, `yellow`, and `black`; `red` remains for legacy/internal compatibility.
- Visible progression is Blue -> Green -> Yellow -> Orange -> Black.
- Green unlocks after a verified Blue Level 1 clear. Yellow unlocks after Green Level 1. Orange unlocks after Yellow Level 1. Black unlocks after every level of Blue/Green/Yellow/Orange is cleared.
- `hl_prototype_unlock_decks` unlocks Level 1 of every deck only; higher levels still require same-deck clears unless `hl_prototype_unlock_all` is enabled.
- Yellow/Orange Joker effects can mutate run state and persistent card-back status. Tearless hides one torn corner from a remaining card, RONG reverses guess meanings, Gridless clears the visible grid, Timeless rewinds revealed cards into the deck, Nudgeless clears nudge charges, Cheatless clears held Cheats, and Powerless clears persistent/armed effects.
- Jokers count as safe/correct reveals for Cheat cadence, even though they are not normal playing cards.
- Daily local attempts are variant-aware. Normal keeps the legacy date-only local key for compatibility; Hard uses a variant-prefixed key such as `hard|YYYY-MM-DD`.
- Completed local Daily attempts may include `suitCounts` keyed by suit symbol for spoiler-light share text. Older attempts may not have this field.
- Daily share text is variant-ambiguous in visible copy; the URL preserves whether the run was Normal or Hard.
- Collection discovery grids read the discovered Cheat/Power/Joker keys and reveal details only after an item has been found in play.
- Run-state-only fields include broad save counters such as `insuranceLives`, Cheat save counters such as `oneLifeLeftLives` / `killerQueenLives`, and full-checkpoint data in `saveScumSnapshot`.
- Lucky Charm uses the normal pending Cheat award queue before the first guess rather than a separate persistent storage key.

## `sessionStorage`
- `hl_prototype_game_state_snapshot`
- `hl_prototype_settings_return_url`
- `hl_prototype_red_deck_debug_unlock`

## Guardrails
- Never bulk-clear storage during normal bug fixes.
- Keep key names stable.
- Use `js/storage.js` helpers for migration-safe updates.
