# Next Tasks (Priority Order)

## P0 - Current Regression Pass
- Verify Daily Normal and Hard stay separated on two devices:
  - Normal shows only `variant=normal` rows.
  - Hard shows only `variant=hard` rows.
  - completed local attempts retry-upload to the matching variant only.
- Verify Hard Daily unlocks after Normal is attempted for that date, uses the Hard seed, hides torn-card hints, and does not score tears.
- Verify Daily share text on mobile for both variants:
  - Normal says Normal and uses the Normal URL.
  - Hard says Hard and includes `variant=hard`.
  - new attempts include suit rows; old attempts without `suitCounts` do not show zero suit rows.
- Verify Joker reveals count toward Cheat cadence. If a Joker is the third/fourth/etc. counted reveal, show the Joker result first and then the Cheat picker.
- Verify final-card Daily bonus scoring still counts unpicked Cheat/Power awards, including a final Joker that completes the Cheat cadence.
- Verify Collection card backs, deck reset/tear repair, and discovered Cheats/Powers/Jokers still work on mobile.

## P0 - Core Gameplay Regression Pass
- Verify deck unlock path: Blue L1 -> Green L1 -> Yellow L1 -> Orange L1, and Black only after all Blue/Green/Yellow/Orange levels are cleared.
- Verify Orange combines nudge awards, Energy spend, and Joker insertion without cross-deck state leaks.
- Verify Black starts directly without a power choice and hides Powers, Cheats, and Nudges.
- Verify tutorial flow still works, including throbbing current-card and face-down-card highlights.
- Verify tutorial step progression reaches cheat choice cleanly and power choice remains tappable.
- Verify `Higher / Lower` stays hidden whenever power or cheat choice modals are open.
- Verify game-over and deck-clear flows still animate correctly.
- Verify Cursed Shield overlay badge behavior unaffected.
- Verify Power offers never show Double Bubble or Erratic without a standard Nudge-starting Power in the same offer.
- Verify Erratic nudge spend messages show exact rolled results (`Nudge +0`, `Nudge -3`, etc.) and do not overflow the message bar.
- On Android Chrome, re-check reveal animation after any reveal/render/card-face edit. It has previously rotated without showing the face.

## P1 - Identity Hardening
- Move crown enrichment to ID-first joins where possible.
- Keep name fallback only for historical rows.

## P1 - SQL Scripts In Repo
- Add repeatable preview/apply scripts for crown/daily backfills in `tools/sql/`.
- Include Daily variant setup/repair SQL:
  - add/backfill `daily_52.variant`
  - drop date/player-only unique indexes
  - create unique `(date_key, variant, player_id)` index
  - reload PostgREST schema if needed

## P2 - Optional Visual Polish
- Add reveal effect hooks per outcome/card type (already partially scaffolded).
- Tune timings for low-end Android performance.
- If tutorial UI changes continue, keep target-element highlighting, preserve focus classes across render-owned elements, and avoid reintroducing floating overlay-box positioning.
