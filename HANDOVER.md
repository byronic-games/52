# 52! Handover (Ops Snapshot)

## Read Order
1. `RUNBOOK.md`
2. `KNOWN_ISSUES.md`
3. `NEXT_TASKS.md`
4. `DATA_CONTRACTS.md`
5. `STATE_MAP.md`
6. `AI_STARTER_PROMPT.md`

## Product Snapshot
- Mobile-first static web app.
- Main surfaces: `index.html`, `game.html`, `daily.html`, `shop.html` (Collection), `heroes.html`, `profile.html`, `settings.html`.
- Deck progression order: Blue -> Green -> Yellow -> Orange -> Black.
- Levels 1-4 are wired for Blue, Green, Yellow, and Orange. Black is a single final pure-score deck.
- Green Level 1 unlocks after Blue Level 1, Yellow Level 1 after Green Level 1, Orange Level 1 after Yellow Level 1, and Black after every level of Blue/Green/Yellow/Orange is cleared.
- Red remains legacy/internal in a few storage and stats paths, but the visible deck slot now routes to Orange.
- Yellow and Orange levels add 1-4 Joker hazards from the expanded Yellow pool: Tearless, RONG, Gridless, Nudgeless, Timeless, Cheatless, and Powerless.
- Jokers are safe/correct reveals for guess resolution and count toward the "every N correct reveals" Cheat cadence. If the cadence lands on a Joker, the Joker result appears first, then the Cheat picker opens.
- Settings include an Unlock Decks toggle for testing Level 1 of locked decks without changing clear history, plus guess-button and nudge-button order preferences.
- Daily and Heroes use Supabase when online; local fallback exists.
- Daily now has two variants:
  - Normal: classic/shared Daily, Blue Level 1 seed, player's card state applies.
  - Hard: unlocked after Normal is attempted for that date, different Blue Level 1 seed, torn cards are hidden and tears do not affect score.
- Daily variants use separate local attempt keys, seeds, and leaderboards. Supabase rows use `variant`; all leaderboard date/seed/fallback queries must filter by the active variant.
- Daily leaderboard loads retry-upload a completed local Daily attempt if the matching `date_key` + `variant` + `player_id` row is missing online.
- Daily has an enabled share button on the result panel. Share text is spoiler-light and variant-ambiguous: it shows cards found, optional suit totals for newly completed local attempts, and "You've one chance to tackle the same deck" with the matching Daily URL. Normal/Hard is preserved by the URL, not named in the visible copy.
- Main menu uses playing-card action buttons. The old Shop entry is now Collection; Heroes is hidden from the main menu for now.
- Collection owns card backs, deck reset/tear repair tools, and discovered Cheats/Powers/Jokers. Discovery cards are compact and use hold popovers for details.
- Latest Cheat batches added/fixed: Ladies Night, Blackjack, Roll the Dice, Club Sandwich, Diamond Geezer, Red Herring, Grave Digger, Assemble, Sell Your Soul, Coming soon, and Burn The Next One. Blackjack, Diamond Geezer, Find The Lady, Killer Queen, Next Card Parity, and other reveal-triggered effects should resolve when the card is revealed, not when the Cheat is played.
- Save Scum is a checkpoint restore: on game over it restores deck, grid, held Cheats, Powers, and run state to the moment it was played.
- Recent Power/nudge behavior:
  - Double Bubble and Erratic are Nudge-support Powers, not standalone Nudge coverage in Power offers.
  - Power offers containing Double Bubble or Erratic should also include a standard Nudge-starting Power: Balanced Nudges, Updraft, or Downforce.
  - Erratic rolls each spent Nudge charge as 0, 1, 2, or 3 movement with equal odds. Double Bubble and Nudge Nudge multipliers apply after that roll, and the message bar should show the exact result such as `Nudge -3` or `Nudge +0`.
  - Insurance is a broad one-shot save that fires only after more specific saves and the existing broad Cheat saves.
  - Lucky Charm gives three Cheat selections before the first guess.
- Android standalone/home-screen sizing was tightened using `visualViewport.height` plus short-screen CSS compression.
- The gameplay screen has a structured fixed-height vertical layout: `game.html` supplies spacer/gap rows, while `styles.css` uses container-query grid rows to fit the header, cards, message bar, cheat coins, controls, and memory grid into `--app-height`.
- The default `NEW` visual mode renders white card faces with image suit icons, circular rarity cheat coins, and shield-shaped power cards/header chip.
- Yellow and Orange runs display remaining Jokers in the compact `next-info` area; Joker effect copy uses the existing message bar to avoid crowding mobile.
- Orange combines Blue nudge rewards, Green Energy costs, and Yellow Jokers. Black hides Powers/Cheats/Nudges and submits a pure score instead of showing the normal victory prompt.
- Mobile cache behavior is now split:
  - HTML / manifest-style files revalidate via `.htaccess`
  - versioned JS / CSS assets remain aggressively cacheable
  - service-worker freshness depends on bumping both `CACHE_VERSION` and `GAME_ASSET_VERSION`
- Tutorial highlights use a thin yellow focus treatment. Most tutorial text sits over the grid; the grid step uses a measured focus box. Tutorial guesses are protected in `js/logic.js`, and the message bar is aggressively shortened via `getMessageBarText()`.

## Non-Negotiables
- Do not wipe player storage unless explicitly asked.
- Keep unlock order and existing progress compatible.
- Keep mobile layout stable first; desktop is secondary.
- After JS/CSS edits, bump HTML query versions on pages that load them even though HTML now revalidates on the server.
- After mobile-facing JS/CSS edits, also bump `service-worker.js` cache versions so PWA installs pick up the change.
- Avoid broad refactors unless requested.

## Current Known Live Bug
- No single P0 bug is currently confirmed in this handover.
- Regression-sensitive areas: Daily Normal/Hard separation, Joker Cheat cadence, Collection discovery UI, and short mobile layouts.
- Card reveal flip animation has previously rotated without showing the face on some Android browsers. Treat reveal/render changes as requiring on-device Android re-check; see `KNOWN_ISSUES.md`.

## Recently Touched Areas
- Gameplay visual layout in `game.html` and `styles.css`:
  - `#main-layout` row order depends on `.layout-spacer-*` and `.layout-gap-info-cheats` elements in the HTML
  - `#game` exposes sizing variables for header/message/cheats/buttons and short-height compression
  - `.card-slot` owns card aspect-ratio sizing; `#current-card`, `#face-down-deck`, and `#reveal-overlay` fill that slot
  - `#game-shell` / `#game` now run edge-to-edge using `--app-height`
- Visual styling in `styles.css` and `js/render.js`:
  - `renderCardFaceMarkup` emits NEW-theme corner-rank + suit-image markup when `body[data-visuals="new"]`
  - cheat inventory and cheat choices use circular coin treatment with rarity CSS variables; nudge controls are permanent coins beside the cheat scroll window
  - power choice cards and header power chip share shield SVG styling
- Tutorial flow in `js/input.js`:
  - power choice has its own introductory steps before the run tutorial numbering continues
  - cheat explanation is delayed until the first Cheat choice appears
  - tutorial guesses are protected so learning cannot end the run
- Tutorial focus visuals in `js/input.js` and `styles.css`:
  - focus visuals are yellow and intentionally thin
  - the grid step uses a measured `.tutorial-focus-box`
- Choice modal visibility in `js/render.js` and `styles.css`:
  - `body.choice-modal-open` hides the gameplay guess row
- Daily local-to-remote repair in `js/daily.js`:
  - completed local attempts are checked against Supabase when fetching that date's variant board
  - missing online rows are posted before the board renders
  - fallback queries must keep `variant=eq.normal|hard`; otherwise Normal can show Hard rows
- Daily sharing in `js/daily-page.js`:
  - `DAILY_SHARE_ENABLED` is currently `true`
  - visible share text no longer names Normal/Hard
  - Normal share URLs omit `variant=hard`; Hard share URLs include it
  - newly completed local attempts include `suitCounts`; older attempts share without suit rows
- Daily Supabase schema:
  - `daily_52.variant` is required
  - uniqueness must include variant, e.g. `(date_key, variant, player_id)`
  - remove legacy date/player-only indexes such as `daily_52_date_player_uidx`
- Cache behavior:
  - `.htaccess` now sends `no-cache` headers for HTML-like files
  - `game.html` / `daily.html` asset query strings should be bumped alongside JS/CSS fixes
  - `service-worker.js` cache versions must be bumped for mobile/PWA freshness

## Crown/Leaderboard Rules (Current)
- Daily board should render crowns from row-backed enrichment only (not viewer-local state).
- Blue/Green/Red crowns from existing Supabase clear booleans. Yellow/Orange/Black clears are tracked locally, but the current Supabase crown schema has not been extended for those newer deck colors.
- Gold daily crown from durable daily clear signal and legacy fallback logic.

## Quick "Do First" For New AI
1. Run `RUNBOOK.md` smoke checks.
2. Check Normal and Hard Daily boards and share text on two devices after any Daily/Supabase/share change.
3. Re-test layout on a short mobile viewport before changing adjacent UI; confirm card pair, message bar, cheat coins, controls, and memory grid all remain visible without page scroll. Also check Black Deck, where the same layout hides power/cheat/nudge controls.
4. Re-test tutorial overlays and choice-modal behavior on mobile before changing adjacent UI; confirm yellow focus boxes are visible, not too thick, and not obscuring the discussed area.
5. Re-check Android reveal animation after any reveal/render/card-face work.
6. Patch minimally and verify Daily/Heroes/Profile/Collection did not regress.
7. If Daily sharing is being revisited, start in `js/daily-page.js`; keep it spoiler-light and preserve the variant in the URL without naming it in the share copy.
