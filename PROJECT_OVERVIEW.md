# Project Overview (Concise)

## What It Is
- `52!` is a browser-based higher/lower card game with progression, powers, cheats, shared Daily mode, and a final pure-score Black Deck.
- Mobile-first UI; desktop is supported but not primary.
- HTML is now served as revalidating content via `.htaccess`; versioned JS/CSS assets are expected to be cache-busted when changed.

## Core Surfaces
- `index.html`: entry hub
- `game.html`: run gameplay for Blue/Green/Yellow/Orange/Black
- `daily.html`: daily challenge + leaderboard
- `heroes.html`: clear board
- `profile.html`: local player stats/crowns
- `settings.html`: config/reset tools
- `shop.html`: Collection flow (card backs, deck state repair/reset, and discovered Cheats/Powers/Jokers)
- Daily sharing is enabled from the completed-result panel in `daily.html`.

## Gameplay Layout Surface
- `game.html` now defines the gameplay screen as a deliberate vertical layout skeleton with spacer/gap rows around the card pair, message bar, cheat panel, controls, and memory grid.
- `styles.css` contains the late-file "Structured vertical layout system" that turns `#game` and `#main-layout` into fixed-height CSS grids. Key row variables are `--header-height`, `--info-height`, `--cheats-height`, `--buttons-height`, `--section-gap`, `--card-pair-gap`, and `--card-row-max-height`.
- Cards are sized through container queries on `.card-slot`, then `#current-card`, `#face-down-deck`, and `#reveal-overlay` fill the slot. This keeps the card pair stable while the available viewport height changes.
- `js/fullscreen.js` is part of layout ownership because it writes `--app-height` from `visualViewport.height`.
- Choice modals use body classes from `js/render.js`: `choice-modal-open`, `cheat-choice-open`, and `power-choice-open`.

## Current Visual Treatment
- `body[data-visuals="new"]` switches card faces to white playing-card markup with corner ranks and image-backed suit symbols. `js/render.js::renderCardFaceMarkup` emits this markup; `styles.css` maps the suit assets.
- The cheat bar and cheat-choice cards are circular rarity coins with count badges and small layout animations.
- Power choice cards and the header power chip are shield-shaped via `.power-shield-svg` / `.power-shield-fill`.
- The main menu uses compact playing-card action buttons and no visible Heroes button for now.
- Collection uses a compact discovery grid: undiscovered items stay vague, discovered Cheats/Powers/Jokers can be held to show their description popover.

## Deck/Progression Model
- Start: Blue Level 1 unlocked.
- Daily unlocks after first run started.
- Green L1 unlocks after Blue L1 clear.
- Yellow L1 unlocks after Green L1 clear.
- Orange L1 unlocks after Yellow L1 clear.
- Black unlocks after every level of Blue, Green, Yellow, and Orange has been cleared.
- Higher levels unlock by clearing previous level in same deck.
- Level cap currently 4 on Blue/Green/Yellow/Orange. Black is Level 1 only.
- Settings include an Unlock Decks toggle (`hl_prototype_unlock_decks`) for testing Level 1 of every deck without changing recorded wins. A separate `hl_prototype_unlock_all` helper still exists for full level bypasses.
- Settings also include `hl_prototype_guess_button_order`, which swaps the visual order of the existing Higher/Lower buttons without changing their styling.
- Red remains as legacy/internal storage and stats code, but the visible progression path now routes the old red deck picker slot to Orange.

## Gameplay Notes
- Aces are low.
- Equal-value comparisons continue the run.
- Cards-cleared model is now "start at 1" (starting face-up card counts).
- Nudges use separate + / - charge pools.
- Nudge-support Powers are not standalone offer coverage: Double Bubble, Erratic, and Double Your Luck may appear in a Power offer only when a standard Nudge-starting Power is also present, unless no support Power is selected.
- Double Bubble doubles each Nudge charge. Erratic makes each spent Nudge charge roll 0, 1, 2, or 3 movement with equal odds; Double Bubble and Nudge Nudge multipliers apply after that roll. Double Your Luck gives each Nudge charge a 50% chance not to be consumed, while Green Energy is still spent. Erratic nudge messages intentionally show only the rolled result, e.g. `Nudge -3` or `Nudge +0`, with `kept` added when Double Your Luck saves the charge.
- Insurance is a broad one-shot wrong-guess save. It is intentionally lower priority than specific saves such as suit saves, Killer Queen, Margin For Error, and other reveal/card-specific protections. Cursed Shield and One Life Left also resolve before Insurance.
- Lucky Charm queues three standard Cheat selections before the first guess, using the same seeded/variant-aware offer flow as other Cheat picks.
- Yellow and Orange runs insert 1-4 Joker hazard cards after the first four deck positions, so they can only appear after three correct guesses. A Joker consumes the next-card reveal without caring whether the player guessed Higher or Lower, applies its negative effect, counts as a safe/correct reveal for Cheat cadence, and leaves the current normal card in play.
- Yellow Joker pool: Tearless hides one torn corner from an unseen card, RONG reverses Higher/Lower meanings for the rest of the run, Gridless clears the visible found-card grid, Nudgeless clears banked Nudges, Timeless shuffles recently revealed playing cards back into the deck, Cheatless clears held Cheats, and Powerless clears persistent/armed effects. Higher levels add more Jokers from this pool.
- Orange combines Blue nudge rewards, Green Energy costs, and Yellow Joker hazards. Energy starts at 10/8/6/5 for Levels 1-4.
- Black is the final pure run: no Powers, Cheats, or Nudges, with high-score submission handled separately from normal Heroes victory prompts.
- Daily has two variants with separate seeds and leaderboards:
  - Normal: Blue Level 1 daily seed using the player's current deck/card state.
  - Hard: unlocks after Normal is attempted for that date, uses a different Blue Level 1 seed, hides torn-card hints, and does not score tears.
- Daily/Heroes support Supabase + local fallback behavior. Daily fallback and repair queries must preserve `variant` filtering so Normal and Hard do not leak into each other.
- Daily sharing uses a spoiler-light text payload: `I scored xx/52 on today's 52! Daily.`, optional suit-total rows, and `You've one chance to tackle the same deck:` plus the Daily URL. The visible text does not name Normal/Hard; the URL still preserves the selected Daily variant. New local Daily attempts store suit totals for sharing; remote rows and older local attempts may not have those totals and should still share without the suit rows.
- Recent Cheat additions:
  - `Ladies Night`, `Roll the Dice`, `Club Sandwich`, `Red Herring`, and `Grave Digger` resolve immediately.
  - `Blackjack` and `Diamond Geezer` arm and resolve on the next reveal; Daily final-card scoring credits their unpicked rewards.
  - `Assemble` pulls remaining cards of the current effective value to the top of the deck, including nudged values.
  - `Sell Your Soul` saves the next wrong guess but punishes a right guess by clearing held Cheats and Nudges.
  - `Coming soon` compares the card after next to the current face-down card and should log that relationship clearly.
  - `Burn The Next One` removes the top face-down card from the deck entirely without marking it on the grid, reducing the run denominator.
  - `Save Scum` is a one-off checkpoint restore, not a simple continue.
  - Reveal-triggered Cheats/Powers, including `Find The Lady`, `Killer Queen`, and `Next Card Parity`, should resolve on reveal so deck manipulation after play is respected.

## Main Code Ownership
- `js/logic.js`: game rules and state transitions
- `js/render.js`: DOM rendering, visual-theme markup, choice modal body classes, and animation hooks
- `js/input.js`: controls/input gating + tutorial flow
- `js/storage.js`: persistence/migrations
- `js/daily.js` + `js/daily-page.js`: Daily data flow/UI
- `js/leaderboard.js` + `js/heroes.js`: Heroes/crowns rendering and Black Deck leader display
- `js/profile-page.js`: profile stats/crowns
- `js/fullscreen.js`: viewport-height handling, including Android standalone/home-screen mode
- `styles.css`: gameplay vertical layout grid, responsive card sizing, NEW visual theme, cheat coin styling, power shield styling, and Black Deck starfield/pure-run treatment

## Current Critical Risk
- Daily variant filtering, local-to-remote repair, and share links are active production paths. Re-test Normal and Hard boards/share text on two devices after Daily changes.
- Reveal animation on some Android browsers has previously failed to show face mid-flip; re-check on device after reveal/render changes.

## Current Sensitive Area
- Tutorial / choice-modal behavior on mobile was recently adjusted:
  - most tutorial dialogs sit over the grid to avoid covering the face-up card
  - focus styling is a thin yellow guide; the grid step uses a measured focus box
  - tutorial guess resolution is protected in `js/logic.js`, with a defensive overlay close if game-over still occurs
  - while the rules are being taught, tutorial guesses should always resolve as safe by moving a suitable next card to the top where possible
  - gameplay guess buttons should hide while power / cheat choice modals are open
  - top message-bar text is aggressively shortened via `getMessageBarText()` in `js/render.js`
