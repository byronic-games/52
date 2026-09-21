# Design System Specification: High-Energy Psychedelic Rogue-like

## 1. Overview & Creative North Star
### Creative North Star: "The Digital Alchemist"
This design system rejects the sterile, "safe" corporate web in favor of a high-stakes, psychedelic rogue-like aesthetic. It is inspired by the tension of a high-limit card game played in a glitching dimension. We are moving away from traditional "clean" design toward an experience that feels alive, tactile, and slightly dangerous.

To break the "template" look, we utilize **Intentional Asymmetry**. Elements should never feel perfectly static; use the `Spacing Scale` (specifically `1.5`, `2.5`, and `3.5`) to create off-kilter layouts that suggest a deck being shuffled. High-contrast typography scales move abruptly from massive `display-lg` headlines to tiny, technical `label-sm` metadata, mimicking the information density of a retro arcade terminal.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, void-like purple (`#120b1a`) that serves as the canvas for hyper-vibrant neon collisions.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries are defined solely through background color shifts. To separate a sidebar, move from `surface` to `surface-container-low`. To highlight a card slot, use `surface-container-high`. If you feel the urge to draw a line, use a gap from the Spacing Scale instead.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers stacked within a CRT monitor.
- **Base Layer:** `surface` (#120b1a) - The deep background.
- **Floating Containers:** `surface-container` tiers. Use `surface-container-highest` (#2c2137) for active gameplay elements to make them feel closer to the "glass" of the screen.
- **The "Glass & Gradient" Rule:** Main CTAs or active "Joker" elements must use a gradient transition from `primary` (#ff7cf5) to `primary-container` (#ff5af9). This adds "soul" and prevents the neon from looking like a flat vector shape.

### Signature Textures
Apply a subtle `0.05` opacity scanline overlay across all `surface-container` elements. Use a `1px` offset chromatic aberration (red/blue fringe) on `display` typography to simulate a high-energy hardware glitch.

---

## 3. Typography
We pair the technical precision of **Inter** with the eccentric, wide proportions of **Space Grotesk**.

- **Display & Headlines (Space Grotesk):** These are your "shouting" layers. Use `display-lg` for big wins or game-over states. The aggressive geometry of Space Grotesk captures the retro-arcade soul.
- **Body & Titles (Inter):** For legibility during high-intensity moments. `body-md` is the workhorse for card descriptions.
- **The Information Gap:** Use `label-sm` in `tertiary` (#bcff5f) for technical stats. The massive jump between a `headline-lg` and a `label-sm` creates the "Editorial Brutalism" that defines this system.

---

## 4. Elevation & Depth
In a psychedelic rogue-like, depth is not about "realism"; it’s about **Tonal Vibrancy**.

- **The Layering Principle:** Stacking is king. A `surface-container-lowest` card sitting on a `surface-container-high` section creates a recessed "slot" effect.
- **Ambient Shadows:** Shadows are not grey. They are tinted. Use a `16px` to `24px` blur with `4%` opacity, using the `primary` (#ff7cf5) color value. This creates a "neon glow" rather than a shadow, making elements look like they are emitting light.
- **The "Ghost Border" Fallback:** If a container absolutely requires a boundary (e.g., an input field), use `outline-variant` at `15%` opacity. This is a "Ghost Border"—it suggests a limit without interrupting the visual flow of the background.
- **Glassmorphism:** Use `surface-bright` with a `20px` backdrop-blur for overlays. This allows the glitchy background textures to bleed through, maintaining the "Digital Alchemist" vibe.

---

## 5. Components

### Cards (The Core Primitive)
Cards must never use dividers.
- **Background:** `surface-container-highest`.
- **Corner Radius:** `md` (0.375rem) for a tactile, "poker card" feel.
- **Interaction:** On hover, shift background to `primary` and text to `on-primary`. Add a subtle `2deg` rotation to simulate hand-held cards.

### Buttons
- **Primary:** Background `primary` (#ff7cf5), text `on-primary` (#580058). Shape: `sm` (0.125rem) for a sharp, aggressive look.
- **Secondary:** Ghost style. No background, `outline` token for text. On hover, fill with `secondary-container`.
- **Tertiary:** `tertiary` (#bcff5f) text only, used for high-risk actions or "add-ons."

### Inputs & Selection
- **Text Inputs:** Use `surface-container-lowest`. Label should be `label-md` in `secondary`.
- **Chips:** `full` (9999px) roundedness. Use `secondary-container` for inactive and `secondary` for active states.
- **Lists:** No divider lines. Use `spacing-2` to separate items. Every third item should have a slightly different background (`surface-container-low` vs `surface-container`) to create a rhythmic, scanned feel.

### Specialized Components: "The Glitch HUD"
- **Status Bars:** Use `tertiary` for HP/Progress. Apply a horizontal jitter animation (0.5px) to indicate "instability."
- **Modals:** Must use the "Glassmorphism" rule. Full-screen blur behind the modal to isolate the player from the "chaos" of the background.

---

## 6. Do's and Don'ts

### Do:
- **Do** embrace intentional "errors." A slightly misaligned label (`spacing-0.5`) can feel more "rogue-like" than a perfectly centered one.
- **Do** use color to indicate stakes. `error` (#ff6e84) is not just for errors; it’s for high-risk gameplay decisions.
- **Do** use the `Roundedness Scale` consistently. `md` for cards, `sm` for buttons, `full` for status indicators.

### Don't:
- **Don't** use pure white (#FFFFFF). Always use `on-surface` (#eee1f7) to maintain the atmospheric purple tint.
- **Don't** use standard drop shadows. If it doesn't look like it's glowing, it doesn't belong in this system.
- **Don't** use 100% opaque borders. They kill the "infinite void" depth of the psychedelic aesthetic.
- **Don't** use transition timings faster than 150ms. High-energy doesn't mean "instant"—it means "visceral." Use "ease-out-expo" for card flips.