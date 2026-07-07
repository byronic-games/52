# Runbook (Fast Checks)

## Start Local
- Serve repo root with any static server.
- Open `index.html`.

## 5-Minute Smoke
1. Start Blue run.
2. Confirm `Cards Cleared` starts at 1 and `Cards Remaining` at 51.
3. Make one correct guess and one wrong guess path.
4. Confirm deck picker order is Blue, Green, Yellow, Orange, Black.
5. Confirm locked decks/levels are visibly greyed out.
6. Open `daily.html`, `heroes.html`, `profile.html` and confirm no load errors.

## Yellow Deck Check
1. Enable Settings -> Unlock Decks and confirm Yellow Level 1 can be selected without clearing Green L1.
2. Start Yellow Level 1 and confirm `Jokers left: 1` appears in the compact next-card info area.
3. Make enough guesses for the Joker to appear; either Higher or Lower should resolve the Joker and show a Yellow Joker message.
4. Confirm a Joker reveal counts toward the Cheat cadence. Example: if Cheats appear every 3 correct reveals and the third reveal is a Joker, the Cheat picker should appear after the Joker result.
5. Repeat Level 4 and confirm `Jokers left: 4` at run start.
6. Trigger each effect if possible: Tearless temporarily hides one unseen torn corner, RONG reverses Higher/Lower meanings, Gridless clears the visible found-card grid, Timeless shuffles recently revealed cards back into the deck, Nudgeless clears banked Nudges, Cheatless clears held Cheats, and Powerless clears persistent power effects.
7. Turn Unlock Decks off and confirm normal progression gates return.

## Orange / Black Deck Check
1. Enable Settings -> Unlock Decks and confirm Orange Level 1 and Black Deck can be selected for testing.
2. Start Orange Level 1 and confirm Energy is visible, nudge rewards still accrue on correct guesses, nudge use spends Energy, and `JOKERS: 1` appears.
3. Repeat Orange Level 4 and confirm it starts at 5 Energy with 4 Jokers.
4. Start Black Deck and confirm it skips power choice, hides power/cheat/nudge controls, uses the Black visual treatment, and records/submits pure score rather than opening the normal Heroes victory prompt.
5. Turn Unlock Decks off and confirm Orange requires Yellow Level 1 and Black requires all Blue/Green/Yellow/Orange levels.

## Settings Check
1. In both `game.html` Settings and `settings.html`, confirm Unlock Decks is visible and opens Level 1 for locked decks, including Black for pure-run testing.
2. Switch button order to Higher / Lower and confirm the green Higher button moves left while preserving its styling.
3. Switch back to Lower / Higher and confirm the pink Lower button returns to the left.

## Tutorial / Modal Check
1. Replay tutorial from Settings if needed.
2. Confirm the current-card tutorial highlight hugs the actual card element and throbs.
3. Confirm the next-card / face-down-card tutorial highlight hugs the actual card element and throbs.
4. Confirm power choice cards are tappable during tutorial.
5. Confirm cheat choice cards are tappable during tutorial.
6. Confirm `Higher / Lower` is hidden whenever power or cheat choice modals are open.

## Gameplay Layout Check
1. Test a normal mobile viewport and a short mobile viewport.
2. Confirm the header, card pair, message bar, cheat coin row, controls, and memory grid all fit inside the visible game screen.
3. Confirm the page itself does not scroll during gameplay; the fixed layout should fit within `--app-height`.
4. Confirm current-card, next-card, and reveal overlay remain exactly aligned during a guess.
5. Confirm cheat coins stay circular, rarity-colored, centered in the cheat row, and keep count badges readable.
6. Confirm NEW visuals show corner ranks and image-backed suits on cards and memory-grid cells.
7. On Android, repeat the check in browser and standalone/home-screen mode because `js/fullscreen.js` uses `visualViewport.height`.

## Animation Check (Current Priority)
1. On Android Chrome, make a guess.
2. Verify next-card flip reveals face during animation.
3. Verify promoted current card shows true value after move.
4. Re-test with next-card value modifier case (nudged/temporary value scenario).

## Daily Board Check
1. Open same date on two devices.
2. Normal leaderboard should show only Normal entries.
3. Hard unlocks after Normal is attempted for that date.
4. Hard leaderboard should show only Hard entries.
5. Entry count/order should match across devices for each variant.
6. Tied scores share rank.
7. Crowns should be per-player, not per-viewer.
8. For a completed local Daily attempt that failed to save online, opening that Daily board while connected should upload the missing row for the matching variant only.
9. Hard should ignore permanent card marks, including torn corners and enchantments, and should not score tears.
10. After completing a Normal Daily, share text should say `I scored xx/52 on today's 52! Daily.`, omit `variant=hard` from the URL, and include suit rows for newly completed attempts.
11. After completing a Hard Daily, share text should use the same variant-ambiguous wording, include `variant=hard` in the URL, and include suit rows for newly completed attempts.
12. Older completed attempts without stored suit totals should still share cleanly without misleading zero-count suit rows.

## Power / Nudge Check
1. Start multiple Power offers and confirm Double Bubble never appears without one of Balanced Nudges, Updraft, or Downforce.
2. Confirm Erratic and Double Your Luck follow the same support-Power rule as Double Bubble.
3. With Erratic active, spend several Nudge charges and confirm the message bar shows the exact rolled result: `Nudge +0`, `Nudge +1`, `Nudge +2`, `Nudge +3`, or the matching negative form.
4. With Erratic plus Double Bubble and/or Nudge Nudge, confirm the rolled amount is multiplied after the 0-3 roll.
5. Confirm a roll of 0 spends one Nudge charge and does not move the card.
6. With Insurance active, make a wrong guess that is not covered by a specific save and confirm Insurance saves the run and is consumed.
7. With Insurance plus a specific save armed, confirm the specific save fires before Insurance.
8. With Lucky Charm selected as the starting Power, confirm three Cheat choices are offered before the first guess.
9. With Double Your Luck active, spend Nudges and confirm some charges are kept; on Green, Energy should still be spent whether or not the charge is kept.

## Recent Cheat Regression Check
1. Play Assemble on a nudged card and confirm it pulls remaining cards of the current effective value, not just the printed card value.
2. Play Sell Your Soul and confirm the next wrong guess survives, while the next naturally correct guess clears held Cheats and Nudges.
3. Play Coming soon and confirm the short/log copy states the result relative to the current face-down card.
4. Play Burn The Next One and confirm the top face-down card is removed, not shown on the grid, and the run total drops below 52.
5. Play Save Scum, then lose, and confirm deck, grid, held Cheats, Powers, and run state restore to the checkpoint.
6. Arm Killer Queen and confirm it saves Lower on Queen into King at reveal time.
7. Use Next Card Parity with Cheaters Prosper and confirm the parity result is shown clearly without being swallowed by the Prosper nudge text.
8. Play Enchant, make a wrong guess that only an enchanted unseen card can save, and confirm it jumps to the top, reveals with the enchanted visual, then loses its enchantment. Also confirm Collection can clear an unused enchantment.
9. In Hard Daily, confirm existing enchanted cards do not trigger or show, and playing Enchant reports no effect without adding a permanent mark.

## Collection Check
1. Open Collection from the main menu.
2. Confirm card-back preview keeps a stable playing-card aspect ratio and controls do not jump as different card backs are selected.
3. Confirm deck reset and torn-card repair controls still work.
4. Confirm discovered Cheats/Powers/Jokers show as compact items.
5. Hold a discovered item and confirm the detail popover appears above the pressed item and text is not accidentally selected.

## Deploy Hygiene
- After JS/CSS edits, bump query strings in:
  - `index.html`
  - `game.html`
  - `daily.html`
  - `heroes.html`
  - `profile.html`
  - `settings.html`
- `.htaccess` now forces HTML-like files to revalidate, but do not rely on that alone for JS/CSS changes.
- For mobile/PWA freshness, also bump `CACHE_VERSION` and `GAME_ASSET_VERSION` in `service-worker.js`.
- When Daily sharing or Daily completion data changes, bump both `daily.html` script query strings and the `daily.js` query string in `game.html`.
- When `daily-page.js` changes, bump its query string in `daily.html`; otherwise mobile can keep old share text.

## Cheat Catalog Import
- Balance tweaks in `cheat-catalog.csv` are not applied automatically at runtime. Reimport them into `js/cheat-balance-overrides.js`.
- From the repo root, use:
  - `powershell -ExecutionPolicy Bypass -File .\tools\import-cheats.ps1 -CsvPath .\cheat-catalog.csv -OutputPath .\js\cheat-balance-overrides.js`
- From inside `tools`, use:
  - `powershell -ExecutionPolicy Bypass -File .\import-cheats.ps1 -CsvPath ..\cheat-catalog.csv -OutputPath ..\js\cheat-balance-overrides.js`
- After importing, bump the relevant asset query strings and service-worker versions for mobile/PWA freshness.

## Supabase Quick Health
- `daily_52`: anon `SELECT` + `INSERT`.
- `daily_52.variant`: required. Normal/Hard leaderboards depend on it.
- `daily_52` unique attempt index must include `variant`, e.g. `(date_key, variant, player_id)`.
- Drop legacy date/player-only unique indexes such as `daily_52_date_player_uidx`.
- `heroes_52`: anon `SELECT`.
- If Daily hangs on "Loading Daily Board":
  1. check browser network response
  2. check RLS/API permissions
  3. check client-side JS errors
