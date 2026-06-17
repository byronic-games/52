# Next Tasks (Priority Order)

## P0 - Fix Reveal Animation On Android
- Make face reliably appear during reveal flip on Android Chrome.
- Keep existing sequence intent:
  - flip reveal
  - short pause
  - promote to current card
  - then correct/incorrect flash
- Re-test with nudged/temporary next-card values.

## P0 - Regression Pass After Animation Fix
- Verify deck unlock path: Blue L1 -> Green L1 -> Yellow L1 -> Orange L1, and Black only after all Blue/Green/Yellow/Orange levels are cleared.
- Verify Orange combines nudge awards, Energy spend, and Joker insertion without cross-deck state leaks.
- Verify Black starts directly without a power choice and hides Powers, Cheats, and Nudges.
- Verify tutorial flow still works, including throbbing current-card and face-down-card highlights.
- Verify tutorial step progression reaches cheat choice cleanly and power choice remains tappable.
- Verify `Higher / Lower` stays hidden whenever power or cheat choice modals are open.
- Verify game-over and deck-clear flows still animate correctly.
- Verify Cursed Shield overlay badge behavior unaffected.

## P1 - Identity Hardening
- Move crown enrichment to ID-first joins where possible.
- Keep name fallback only for historical rows.

## P1 - SQL Scripts In Repo
- Add repeatable preview/apply scripts for crown/daily backfills in `tools/sql/`.

## P2 - Optional Visual Polish
- Add reveal effect hooks per outcome/card type (already partially scaffolded).
- Tune timings for low-end Android performance.
- If tutorial UI changes continue, keep target-element highlighting, preserve focus classes across render-owned elements, and avoid reintroducing floating overlay-box positioning.
