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
- Main surfaces: `index.html`, `game.html`, `daily.html`, `heroes.html`, `profile.html`, `settings.html`.
- Deck progression order: Blue -> Green -> Yellow -> Orange -> Black.
- Levels 1-4 are wired for Blue, Green, Yellow, and Orange. Black is a single final pure-score deck.
- Green Level 1 unlocks after Blue Level 1, Yellow Level 1 after Green Level 1, Orange Level 1 after Yellow Level 1, and Black after every level of Blue/Green/Yellow/Orange is cleared.
- Red remains legacy/internal in a few storage and stats paths, but the visible deck slot now routes to Orange.
- Yellow and Orange levels add 1-4 Joker hazards from the expanded Yellow pool: Tearless, RONG, Gridless, Nudgeless, Timeless, Cheatless, and Powerless.
- Settings include an Unlock Decks toggle for testing Level 1 of locked decks without changing clear history, plus guess-button and nudge-button order preferences.
- Daily and Heroes use Supabase when online; local fallback exists.
- Daily leaderboard loads now retry-upload a completed local Daily attempt if the matching `date_key` + `player_id` row is missing online.
- Daily now has a share button on the result panel, but it is intentionally code-gated off for now with `DAILY_SHARE_ENABLED = false` in `js/daily-page.js`.
- Android standalone/home-screen sizing was tightened using `visualViewport.height` plus short-screen CSS compression.
- The gameplay screen has a structured fixed-height vertical layout: `game.html` supplies spacer/gap rows, while `styles.css` uses container-query grid rows to fit the header, cards, message bar, cheat coins, controls, and memory grid into `--app-height`.
- The default `NEW` visual mode renders white card faces with image suit icons, circular rarity cheat coins, and shield-shaped power cards/header chip.
- Yellow and Orange runs display remaining Jokers in the compact `next-info` area; Joker effect copy uses the existing message bar to avoid crowding mobile.
- Orange combines Blue nudge rewards, Green Energy costs, and Yellow Jokers. Black hides Powers/Cheats/Nudges and submits a pure score instead of showing the normal victory prompt.
- Mobile cache behavior is now split:
  - HTML / manifest-style files revalidate via `.htaccess`
  - versioned JS / CSS assets remain aggressively cacheable
- Tutorial highlighting now styles the actual target element instead of positioning a separate floating highlight box. Current-card and next-card focus classes are preserved through `js/render.js` redraws, and `.tutorial-focus-target` has a cyan throbbing ring in `styles.css`.

## Non-Negotiables
- Do not wipe player storage unless explicitly asked.
- Keep unlock order and existing progress compatible.
- Keep mobile layout stable first; desktop is secondary.
- After JS/CSS edits, bump HTML query versions on pages that load them even though HTML now revalidates on the server.
- Avoid broad refactors unless requested.

## Current Known Live Bug
- Card reveal flip animation can rotate without showing face on some Android browsers.
- Most recent work attempted both:
  - 3D two-sided 180 flip
  - midpoint swap (flip-out / flip-in)
- Status: still reported as broken on-device; see `KNOWN_ISSUES.md`.

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
  - power-pick blocking relaxed
  - cheat-choice progression split from streak-building
  - floating highlight plumbing removed
- Tutorial focus visuals in `js/render.js` and `styles.css`:
  - render-owned card elements preserve `tutorial-focus-target` after redraws
  - current-card / face-down-card highlights throb again
- Choice modal visibility in `js/render.js` and `styles.css`:
  - `body.choice-modal-open` hides the gameplay guess row
- Daily local-to-remote repair in `js/daily.js`:
  - completed local attempts are checked against Supabase when fetching that date's board
  - missing online rows are posted before the board renders
- Cache behavior:
  - `.htaccess` now sends `no-cache` headers for HTML-like files
  - `game.html` / `daily.html` asset query strings were bumped alongside JS/CSS fixes

## Crown/Leaderboard Rules (Current)
- Daily board should render crowns from row-backed enrichment only (not viewer-local state).
- Blue/Green/Red crowns from existing Supabase clear booleans. Yellow/Orange/Black clears are tracked locally, but the current Supabase crown schema has not been extended for those newer deck colors.
- Gold daily crown from durable daily clear signal and legacy fallback logic.

## Quick "Do First" For New AI
1. Run `RUNBOOK.md` smoke checks.
2. Reproduce current flip bug on Android profile.
3. Re-test layout on a short mobile viewport before changing adjacent UI; confirm card pair, message bar, cheat coins, controls, and memory grid all remain visible without page scroll. Also check Black Deck, where the same layout hides power/cheat/nudge controls.
4. Re-test tutorial overlays and choice-modal behavior on mobile before changing adjacent UI; confirm current-card and next-card highlights are visible and throbbing.
5. Patch minimally and verify Daily/Heroes/Profile did not regress.
6. If Daily sharing is being revisited, start in `js/daily-page.js` and keep the toggle code-only unless explicitly asked to expose it in the UI.
