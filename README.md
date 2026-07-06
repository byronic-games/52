# 52! (USETHIS)

Mobile-first browser card game (higher/lower) with deck progression, powers, cheats, Normal/Hard Daily modes, Collection/discovery, Profile stats, and a final pure-score Black Deck.

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
- `shop.html` - Collection: card backs, deck repairs, and discovered Cheats/Powers/Jokers

## Handover Docs
- `HANDOVER.md` (entry summary)
- `RUNBOOK.md` (smoke tests / ops checks)
- `KNOWN_ISSUES.md` (active risks)
- `NEXT_TASKS.md` (priority queue)
- `DATA_CONTRACTS.md` (Supabase expectations)
- `STATE_MAP.md` (storage keys)
- `AI_STARTER_PROMPT.md` (copy/paste takeover prompt)

## Developer Rules
- Keep unlock order: Blue -> Green -> Yellow -> Orange -> Black. Green unlocks from Blue L1, Yellow from Green L1, Orange from Yellow L1, and Black from clearing every level of Blue/Green/Yellow/Orange.
- Do not wipe local storage unless explicitly requested.
- Keep mobile UX stable first.
- After JS/CSS edits, bump asset query strings in HTML entry pages.
- HTML revalidation is now enforced in `.htaccess`, but JS/CSS still rely on versioned asset URLs. When mobile/PWA freshness matters, also bump `CACHE_VERSION` and `GAME_ASSET_VERSION` in `service-worker.js`.

## Visual Layout Notes
- `game.html` owns the gameplay layout skeleton. The main screen is an explicit vertical stack: top spacer, card area, lower spacer, message bar, cheat gap, cheat panel, controls, bottom spacer, memory grid.
- `styles.css` owns the sizing system for that stack. The late-file "Structured vertical layout system" uses container queries and fixed row variables (`--header-height`, `--info-height`, `--cheats-height`, `--buttons-height`) so mobile screens fit without scrolling.
- `js/fullscreen.js` updates `--app-height` from `visualViewport.height`; layout checks should include Android browser chrome and standalone/home-screen mode.
- The `NEW` visuals mode is the default in `game.html` settings. `js/render.js` emits different card markup for `body[data-visuals="new"]`, and `styles.css` maps suit icons from `images/Suits/`.
- Cheat inventory and cheat-choice items are styled as circular rarity coins. Nudge controls are permanent coins beside the cheat window. Power choice and the header power indicator use shield-shaped SVG styling.
- Yellow and Orange runs show remaining Jokers in the compact `next-info` area and use the main message bar for Joker effects.

## Current Priority
- Keep Daily Normal/Hard leaderboards and share links separated and stable across devices.
- Re-check the Android reveal animation after reveal/render changes; it has previously rotated without showing the face during the flip.
- Regression-test deck progression across Blue, Green, Yellow, Orange, and Black after animation/layout changes.

## Recent Ops Notes
- Yellow deck adds harmful Joker hazards from a level-gated pool: Tearless, RONG, Gridless, Nudgeless, Timeless, Cheatless, and Powerless. Jokers are safe/correct reveals and count toward Cheat cadence. Orange combines Blue nudge rewards, Green Energy costs, and Yellow Jokers. Black is the final pure run: no Powers, Cheats, or Nudges.
- Unlock Decks in settings opens Level 1 of every visible deck for testing.
- Players can choose Lower / Higher or Higher / Lower guess button order and Down / Up or Up / Down nudge order in Settings; the controls keep their existing styles.
- Daily has separate Normal and Hard variants. Hard unlocks after Normal is attempted for the date, uses a different seed, hides torn-card hints, and does not score tears.
- Daily result sharing is enabled on the Daily board. Shares are spoiler-light text snippets: cards found, suit totals for newly completed attempts, and "You've one chance to tackle the same deck" with the Daily URL. The share copy does not name Normal/Hard; the URL still targets the matching variant.
- Daily leaderboard loads retry-upload a completed local Daily attempt when that player's online row is missing for the matching `date_key` + `variant` + `player_id`.
- Supabase `daily_52` rows require `variant`; uniqueness must include variant so Normal and Hard attempts do not block or leak into each other.
- Tutorial highlighting uses a thin yellow focus treatment. Most tutorial copy sits over the grid; the grid step uses a measured focus box. Tutorial guesses are protected until the tutorial completes, including by moving a suitable next card into place when needed.
- Choice modals are intended to hide the gameplay `Higher / Lower` row while open.
- Power offers must include a standard Nudge-starting Power when offering Nudge-support Powers such as Double Bubble or Erratic. Double Bubble doubles Nudge movement; Erratic makes each spent Nudge charge randomly move 0, 1, 2, or 3 before other Nudge multipliers apply.
- Recent Power additions:
  - `Insurance`: one broad wrong-guess save, used only after card-specific and other specific saves have had priority.
  - `Lucky Charm`: offers three Cheat selections before the first guess.
- Recent Cheat additions/fixes:
  - `Assemble`: moves the remaining cards of the current, possibly nudged, value to the top of the deck.
  - `Sell Your Soul`: next reveal saves a wrong guess, but a right guess costs all held Cheats and Nudges.
  - `Coming soon`: reports whether the card after next is higher/lower than the current face-down card.
  - `Burn The Next One`: destroys the top face-down card without marking it on the grid and reduces the deck total.
  - `Save Scum`: restores the deck, grid, Cheats, Powers, and run state to its checkpoint on game over.
  - `Next Card Parity`, `Killer Queen`, and reveal-triggered Cheats/Powers should resolve against the revealed card, after any allowed deck manipulation.
