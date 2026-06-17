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

## Current Priority
- Fix Android reveal animation where card rotates but face does not appear.

## First Actions
1. Run smoke checks from `RUNBOOK.md`.
2. Reproduce reveal issue on Android profile.
3. Check the gameplay layout on a short mobile viewport before and after UI/CSS changes.
4. Patch and re-test Daily/Heroes/Profile regressions.
