# AI Starter Prompt

You are taking over project `52!` in folder `USETHIS`.

## Read First
1. `HANDOVER.md`
2. `RUNBOOK.md`
3. `KNOWN_ISSUES.md`
4. `NEXT_TASKS.md`
5. `DATA_CONTRACTS.md`
6. `STATE_MAP.md`

## Hard Constraints
- Do not clear/reset storage unless explicitly requested.
- Preserve deck unlock order: Blue -> Green -> Yellow -> Orange -> Black.
- Keep mobile layout stable.
- Use minimal targeted patches (avoid broad refactors).
- Bump HTML query versions after JS/CSS edits.

## Layout Context
- Gameplay layout is split between `game.html` spacer/gap rows and late-file `styles.css` grid/container-query rules.
- `js/fullscreen.js` writes `--app-height` from `visualViewport.height`; Android browser/standalone sizing matters.
- `js/render.js` emits NEW-theme card markup and toggles choice modal body classes.
- Current deck model: Blue is base, Green adds Energy costs, Yellow adds Joker hazards, Orange combines Blue/Green/Yellow rules, and Black is a pure run with no Powers, Cheats, or Nudges.
- Red remains in some legacy/internal paths, but visible progression uses Orange in that slot.
- Main menu is card-button based. `Collection` replaces the old Shop entry and owns card backs, deck repair/reset tools, and discovered Cheats/Powers/Jokers.
- Daily has two variants: `normal` and `hard`. Hard unlocks after Normal is attempted for that date, uses a different seed, hides torn-card hints, does not score tears, and has its own leaderboard.
- Daily share text is spoiler-light and does not name Normal/Hard; the URL preserves the active variant.
- Jokers are safe/correct reveals and now count toward the Cheat-reveal cadence. If the threshold lands on a Joker, show the Joker result briefly, then offer the Cheat.
- Current sensitive rules: Double Bubble/Erratic/Double Your Luck need a standard Nudge-starting Power in their offers; Insurance should fire after more specific saves; Lucky Charm queues three opening Cheat choices; reveal-triggered Cheats/Powers should resolve on reveal after deck manipulation.

## Current Priority
- Keep Daily Normal/Hard leaderboards, Supabase variant filtering, and mobile layout stable while iterating on gameplay.
- Android reveal animation has been a recurring risk; re-check on device after touching reveal/render code.

## First Actions
1. Run smoke checks from `RUNBOOK.md`.
2. Re-check Android reveal behavior if touching reveal/render/card-face code.
3. Check the gameplay layout on a short mobile viewport before and after UI/CSS changes.
4. Re-test Daily Normal/Hard filtering and local-to-remote sync after Daily changes.
5. Patch and re-test Daily/Heroes/Profile/Collection regressions.
