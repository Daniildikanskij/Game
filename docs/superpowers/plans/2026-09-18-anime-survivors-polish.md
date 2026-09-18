# Anime Survivors UX and Gameplay Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Anime Survivors layout-independent, progression-correct, frame-rate-stable, persistent, and visually coherent.

**Architecture:** Keep the canvas loop in `src/App.tsx`, extract deterministic keyboard, XP, spawn-rate, and wave-queue rules into `src/gameLogic.ts`, and use `src/index.css` for the shared responsive visual system. Node's built-in test runner exercises the extracted rules; browser smoke testing exercises the assembled game.

**Tech Stack:** React 18, TypeScript, Vite, Node 24 built-in test runner, canvas 2D, existing Tailwind/Vite CSS pipeline.

**Spec:** `docs/superpowers/specs/2026-09-18-anime-survivors-polish-design.md`

## Global Constraints

- Keep the anime/neon game identity and Russian UI copy.
- Add no new dependencies; use the existing Node 24 test runner with TypeScript type stripping.
- Do not add a backend or change the save format beyond one localStorage best-time number.
- Preserve the existing 30-wave game loop and character roster.
- Run typecheck, tests, build, and a visible browser smoke test before pushing.

---

### Task 1: Add pure game-rule tests

**Files:**
- Create: `src/gameLogic.ts`
- Create: `src/gameLogic.test.ts`
- Modify: `package.json`

**Interfaces:**
- `getMovementKey(event: { code: string; key: string }): MovementKey | null`
- `addExperience(progress: ExperienceProgress, amount: number): ExperienceResult`
- `spawnProbability(ratePerSecond: number, dt: number): number`
- `buildWaveSpawnQueue(entries: WaveEnemy[], random?: () => number): WaveEnemy[]`

- [ ] **Step 1:** Add `"test": "node --test --experimental-strip-types src/gameLogic.test.ts"` to `package.json`.
- [ ] **Step 2: Write failing input tests.** Assert `KeyW`, `KeyA`, `KeyS`, `KeyD`, Cyrillic `ц/ф/ы/в`, and arrow keys map to canonical directions; unknown keys return `null`.
- [ ] **Step 3: Write failing progression and wave tests.** Assert a 500 XP pickup can advance through every threshold, progress remains below the next threshold, spawn probability is 0 for `dt=0` and frame-rate independent, and a queue preserves each declared enemy count.
- [ ] **Step 4:** Run `npm test` and confirm the new tests fail because the helpers do not exist yet.

### Task 2: Implement and integrate deterministic rules

**Files:**
- Modify: `src/gameLogic.ts`
- Modify: `src/App.tsx:1-448`

**Interfaces:**
- `App.tsx` consumes the four helpers from `gameLogic.ts` and stores canonical movement directions in `keysRef`.

- [ ] **Step 1: Implement the smallest helper bodies to make Task 1 pass.** Use `event.code` first and Cyrillic fallback second; use a loop for XP thresholds; use `1 - Math.exp(-rate * dt)` for probability; shuffle a flattened wave queue.
- [ ] **Step 2: Run `npm test` and confirm all helper tests pass.**
- [ ] **Step 3:** Replace `event.key` movement state with canonical directions, clear it on `blur`/`visibilitychange`, and reset joystick state on `touchend`/`pointercancel` at the window level.
- [ ] **Step 4:** Add separate wave `spawned`, `alive`, `total`, and queue refs. Spawn the next queued entry, decrement only alive count on death, and flush any unspawned entries when the timer expires so a wave cannot stall.
- [ ] **Step 5:** Use the delta-time spawn probability and update the React player snapshot immediately after XP/level changes. Clamp the rendered XP ratio.
- [ ] **Step 6:** Load and persist the high score through a named localStorage key and clear transient wave-intro timers on cleanup.
- [ ] **Step 7:** Run `npm test` and `npm run typecheck`.

### Task 3: Redesign the interface

**Files:**
- Modify: `src/App.tsx:641-832`
- Modify: `src/index.css`

**Interfaces:**
- The game state and simulation APIs remain unchanged; only overlay markup, labels, class names, and responsive styles change.

- [ ] **Step 1:** Replace the menu and character selection markup with consistent shell, panel, badge, card, and primary/secondary button classes.
- [ ] **Step 2:** Replace the game HUD with responsive HP/XP cards, wave card, stats strip, and readable mobile pause control.
- [ ] **Step 3:** Restyle level-up, pause, and game-over overlays using the same panel hierarchy and keyboard-focus styles.
- [ ] **Step 4:** Add CSS variables, safe-area padding, narrow-screen rules, reduced-motion support, and canvas pixel-ratio scaling styles without adding dependencies.
- [ ] **Step 5:** Run `npm run typecheck` and `npm run build`.

### Task 4: Verify and publish

**Files:**
- No additional source files.

- [ ] **Step 1:** Run `npm test` and inspect the complete output.
- [ ] **Step 2:** Run `npm run typecheck` and `npm run build`.
- [ ] **Step 3:** Refresh the visible `http://localhost:3000/` tab and smoke-test menu, character selection, Russian-layout movement mapping, pause, level-up panel, and responsive layout.
- [ ] **Step 4:** Inspect `git diff`, confirm only intended files changed, and commit the implementation.
- [ ] **Step 5:** Push `main` to `origin` and verify the remote SHA with `git ls-remote`.
