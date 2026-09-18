# Anime Survivors UX and Gameplay Reliability Design

## Goal

Make the current Anime Survivors build comfortable to play in both English and Russian keyboard layouts, remove progression and frame-rate bugs, and replace the current fragmented overlays with a readable responsive anime-neon survival interface.

## Scope

- Normalize keyboard input by physical key code, while keeping Cyrillic-key fallback and arrow-key support.
- Clear movement state when the window loses focus or the document becomes hidden; release touch/pointer movement reliably.
- Move XP, input, spawn probability, and wave queue rules into small pure helpers that can be tested without a canvas.
- Process all XP thresholds reached by one pickup and keep the displayed progress clamped to the current level.
- Spawn the configured enemy composition exactly once per wave and use a delta-time-based spawn probability.
- Persist the best survival time locally.
- Restyle the menu, character selection, in-game HUD, level-up, pause, and game-over surfaces with one responsive visual system. Keep the existing anime/neon identity and runtime dependencies.

## Architecture

The canvas simulation remains in `src/App.tsx`, but deterministic rules move to `src/gameLogic.ts`. `App.tsx` owns mutable refs and React state, calls the pure helpers from the loop, and renders the overlays. `src/index.css` provides shared panel, button, HUD, responsive, and accessibility styles. Node's built-in test runner covers the pure helpers; the browser smoke pass covers the assembled game.

## UX direction

Use a dark indigo background with restrained pink/cyan/gold accents, translucent panels with clear borders, and larger readable labels. The in-game view keeps the playfield dominant while grouping HP/XP/level on the left, wave/timer/kills on the right, and compact stats along the bottom. Full-screen overlays use a consistent panel and button hierarchy rather than unrelated utility-class combinations.

## Acceptance criteria

1. Physical `W/A/S/D` works under both Latin and Cyrillic layouts; arrows continue to work.
2. Holding a movement key and switching windows cannot leave the player moving after focus is lost.
3. A large XP pickup can produce multiple levels without an overflowing XP bar or stale level-up title.
4. Wave enemy counts and types match the declared configuration, independent of monitor refresh rate.
5. The best time survives a page reload.
6. Menu, character selection, HUD, pause, level-up, and game-over are readable at desktop and narrow mobile widths.
7. Typecheck, tests, production build, and a browser smoke test succeed.
