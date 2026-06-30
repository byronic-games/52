# Known Issues

## P1
- Daily Normal/Hard separation depends on both code and Supabase shape:
  - `daily_52.variant` must exist and be backfilled.
  - uniqueness must include `variant`.
  - all client fallback queries must preserve variant filters.
  - missing this can make Normal show Hard rows or make Hard save locally only.
- Joker reveals are meant to count toward Cheat cadence. Treat this as regression-sensitive because Joker resolution has its own branch in `js/logic.js`.
- Mobile browser caching still depends on version discipline for JS/CSS even though `.htaccess` now forces HTML revalidation.
- Mobile/PWA browser caching also depends on `service-worker.js` cache version bumps. If mobile still shows old behavior after HTML query-string bumps, check `CACHE_VERSION` and `GAME_ASSET_VERSION`.
- Daily/Heroes availability depends on Supabase policy/API state; misconfig can appear as "loading forever".
- Tutorial and choice-modal flow on mobile was recently patched and should be treated as regression-sensitive until re-confirmed on device. Current-card and face-down-card highlights now preserve focus through redraws and throb via CSS.
- Message-bar copy is intentionally shortened for mobile. New Cheat/Power result messages should be checked through `getMessageBarText()` so they do not overflow beside the Log button.
- Double Bubble and Erratic offer rules are regression-sensitive: they should not be the only Nudge-related Power in a two-Power offer.
- The fixed gameplay layout is sensitive to row-height changes in `styles.css` and spacer/gap changes in `game.html`. Re-test short mobile viewports after touching header, cards, message bar, cheat row, controls, memory grid, or modal CSS.
- Orange and Black are newer progression surfaces than the older handover docs were built around. Treat unlock gating, per-deck stat counters, and Black pure-run score submission as regression-sensitive.
- Android reveal animation has previously rotated without showing the face on some browsers. Re-test after reveal/render/card-face changes.

## P2
- Name-based identity fallback for crowns is still imperfect when names collide/rename.
- Small-screen density tweaks can regress quickly in overlays (tutorial, cheat picker, Daily table).

## Rules To Keep Synced When Changed
- Daily clear definition/scoring thresholds.
- Crown enrichment logic and SQL backfill scripts.
- Unlock and level progression rules in both code and docs.
- Joker pool/effect descriptions in code, hub copy, and docs.
- Daily variant behavior and Supabase indexes.
- Daily share text format and local `suitCounts` metadata.
