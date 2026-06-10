# 52! (USETHIS)

Mobile-first browser card game (higher/lower) with deck progression, powers, cheats, Daily mode, Heroes board, and Profile stats.

## Start
- Serve repo root with a static server.
- Open `index.html`.

## Core Pages
- `index.html` - menu/hub
- `game.html` - gameplay
- `daily.html` - daily run + board
- `heroes.html` - heroes board
- `profile.html` - profile/crowns
- `settings.html` - settings/reset

## Handover Docs
- `HANDOVER.md` (entry summary)
- `RUNBOOK.md` (smoke tests / ops checks)
- `KNOWN_ISSUES.md` (active risks)
- `NEXT_TASKS.md` (priority queue)
- `DATA_CONTRACTS.md` (Supabase expectations)
- `STATE_MAP.md` (storage keys)
- `AI_STARTER_PROMPT.md` (copy/paste takeover prompt)

## Developer Rules
- Keep unlock order: Blue -> Green -> Red -> Yellow. Yellow Level 1 unlocks from Blue Level 3.
- Do not wipe local storage unless explicitly requested.
- Keep mobile UX stable first.
- After JS/CSS edits, bump asset query strings in HTML entry pages.
- HTML revalidation is now enforced in `.htaccess`, but JS/CSS still rely on versioned asset URLs.

## Visual Layout Notes
- `game.html` owns the gameplay layout skeleton. The main screen is an explicit vertical stack: top spacer, card area, lower spacer, message bar, cheat gap, cheat panel, controls, bottom spacer, memory grid.
- `styles.css` owns the sizing system for that stack. The late-file "Structured vertical layout system" uses container queries and fixed row variables (`--header-height`, `--info-height`, `--cheats-height`, `--buttons-height`) so mobile screens fit without scrolling.
- `js/fullscreen.js` updates `--app-height` from `visualViewport.height`; layout checks should include Android browser chrome and standalone/home-screen mode.
- The `NEW` visuals mode is the default in `game.html` settings. `js/render.js` emits different card markup for `body[data-visuals="new"]`, and `styles.css` maps suit icons from `images/Suits/`.
- Cheat inventory and cheat-choice items are styled as circular rarity coins. Nudge controls are permanent coins beside the cheat window. Power choice and the header power indicator use shield-shaped SVG styling.
- Yellow runs show remaining Jokers in the compact `next-info` area and use the main message bar for Joker effects.

## Current Priority
- Verify Yellow deck hazard behavior across all four levels and re-check Android reveal animation where card rotates but face does not appear during flip.

## Recent Ops Notes
- Yellow deck adds level-gated Joker hazards: Tearless, Nudgeless, Cheatless, and Powerless. Orange deck combines Blue nudge rewards, Green energy costs, and Yellow Jokers. Unlock Decks in settings opens Level 1 of every visible deck for testing.
- Players can choose Lower / Higher or Higher / Lower guess button order and Down / Up or Up / Down nudge order in Settings; the controls keep their existing styles.
- Daily leaderboard loads retry-upload a completed local Daily attempt when that player's online row is missing.
- Tutorial highlighting now styles the actual target element instead of a separate floating highlight box. Rendered card elements preserve the focus class across redraws, and focused tutorial targets throb again.
- Choice modals are intended to hide the gameplay `Higher / Lower` row while open.
