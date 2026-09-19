# Survivors Gameplay Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Anime Survivors' progression reproducible and inspectable, scale the canvas correctly on high-DPI screens, and reduce `App.tsx` to a thin orchestration layer while preserving the current 30-wave game behavior.

**Architecture:** Extract immutable game data and pure rules first, then move the mutable simulation behind a `GameSession` interface, and finally split the renderer, input controller, and React overlays. A dependency-free seeded PRNG provides independent world, upgrade, and effects streams. Follow-up tasks add measured collision broad-phase support, combat feedback, data-driven wave difficulty, persistence/settings, mobile controls, localization, and CI on top of those seams.

**Tech Stack:** React 18, TypeScript, Vite, canvas 2D, Node 24 built-in test runner with `--experimental-strip-types`, existing CSS/Tailwind pipeline, no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-19-survivors-foundation-design.md`

## Global Constraints

- Keep the current 30-wave baseline, character roster, Russian UI default, pause behavior, game-over behavior, and `anime-survivors-high-score` compatibility until a task explicitly changes them.
- Do not add runtime dependencies; use the existing Node test runner and browser APIs.
- After Task 2, gameplay modules under `src/game/` must not call `Math.random()` directly.
- Store and compare gameplay coordinates in logical CSS pixels; cap the effective device-pixel ratio at `2`.
- Use separate seeded random streams for world placement/spawns, upgrade choices, and cosmetic effects.
- Every task ends with its focused test command, `npm test`, and a small commit before the next task begins.
- Install dependencies with `npm ci` before running typecheck, build, or browser verification; the cloned checkout currently has no `node_modules` directory.
- Do not implement reroll/banish until the base upgrade-choice API is stable.
- Do not push to `origin` as part of this plan; local commits and verification are sufficient.

## Review Focus

- A cosmetic particle must not alter a later enemy spawn or upgrade choice; Task 2 adds independent-stream tests and Task 5 adds a same-seed session comparison.
- A level-up choice must not duplicate an id, offer a maxed upgrade, or lose queued level-ups; Task 3 tests choice generation and Task 5 tests the pending-level-up flow.
- Retina scaling must not make the camera use physical pixels and shift the player off-center; Task 4 tests metrics and Task 6 performs a high-DPI smoke check.
- Blur, visibility changes, pointer cancellation, pause, and game-over must clear movement and stop simulation updates; Task 7 tests input-state transitions and Task 15 runs the browser path.
- A saved result must survive malformed storage and migration from the existing high-score key; Task 12 tests both valid and invalid storage records.

## File Map

### First package

- Create `src/game/types.ts` for entity, session, input, viewport, snapshot, and event contracts.
- Create `src/game/config.ts` for characters, enemy types, chest types, game-state constants, wave declarations, storage keys, and numeric constants.
- Create `src/game/random.ts` and `src/game/random.test.ts` for the seeded PRNG and stream derivation.
- Create `src/game/upgrades.ts` and `src/game/upgrades.test.ts` for definitions, owned levels, preview deltas, and choice generation.
- Create `src/game/canvas.ts` and `src/game/canvas.test.ts` for logical viewport and backing-buffer metrics.
- Create `src/game/engine.ts` and `src/game/engine.test.ts` for `GameSession`, simulation updates, wave state, and run events.
- Create `src/game/input.ts` and `src/game/input.test.ts` for movement state, upgrade hotkeys, and browser listener lifecycle.
- Create `src/game/renderer.ts` and `src/game/renderer.test.ts` for logical-coordinate canvas rendering.
- Create `src/ui/GameHud.tsx`, `MenuScreen.tsx`, `CharacterSelect.tsx`, `LevelUpModal.tsx`, `PauseModal.tsx`, and `GameOverModal.tsx` for focused overlay components.
- Modify `src/App.tsx` to compose the modules and retain only React state, refs, and screen routing.
- Modify `src/gameLogic.ts` to re-export moved shared types while preserving its existing pure-helper API.
- Modify `src/gameLogic.test.ts`, `src/index.css`, and `package.json` as the extraction requires.

### Follow-up phases

- Create `src/game/spatialHash.ts` and `src/game/spatialHash.test.ts` for measured broad-phase collision queries.
- Create `src/game/feedback.ts` and `src/game/feedback.test.ts` for hit flashes, screen shake, particles, and danger indicators.
- Extend `src/game/waves.ts` and add `src/game/waves.test.ts` for the difficulty curve and elite/boss cadence.
- Create `src/game/settings.ts`, `src/game/persistence.ts`, and their tests for preferences, run records, selected character, and legacy migration.
- Create `src/i18n.ts` and `src/i18n.test.ts` for Russian/English message catalogs.
- Create `.github/workflows/ci.yml` for automated test, typecheck, and build verification.

---

### Task 1: Establish test discovery and extract shared contracts

**Files:**
- Create: `src/game/types.ts`
- Create: `src/game/config.ts`
- Create: `src/game/config.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/gameLogic.ts`
- Modify: `package.json`

**Interfaces:**
- `GameState = 'menu' | 'character_select' | 'playing' | 'level_up' | 'paused' | 'game_over' | 'wave_intro'`
- `WaveEnemy { type: number; count: number; isBoss?: boolean }`
- `WAVE_CONFIGS: readonly WaveConfig[]`
- `CHARACTERS`, `ENEMY_TYPES`, `CHEST_TYPES`, `GAME_STATE`, `MAX_WAVES`, `HIGH_SCORE_STORAGE_KEY`

- [ ] **Step 1: Install and record the baseline.**

Run:

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

Expected: the existing five Node tests pass; typecheck and build pass after dependencies are installed. Record the current `App.tsx` line count and the output of `git status --short` for the final comparison.

- [ ] **Step 2: Write the failing configuration contract test.**

Create `src/game/config.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, ENEMY_TYPES, MAX_WAVES, WAVE_CONFIGS } from './config.ts';

test('exports the current playable roster and 30-wave baseline', () => {
  assert.equal(CHARACTERS.length, 4);
  assert.equal(WAVE_CONFIGS.length, MAX_WAVES);
  assert.equal(MAX_WAVES, 30);
  assert.ok(WAVE_CONFIGS.every(wave => wave.duration > 0));
  assert.ok(WAVE_CONFIGS.every(wave => wave.enemies.every(enemy => enemy.count >= 0)));
});

test('every configured enemy type has render and combat data', () => {
  assert.ok(ENEMY_TYPES.every(enemy => enemy.hp > 0 && enemy.speed >= 0 && enemy.size > 0));
  assert.ok(WAVE_CONFIGS.flatMap(wave => wave.enemies).every(enemy => enemy.type < ENEMY_TYPES.length));
});
```

- [ ] **Step 3: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/game/config.test.ts`

Expected: FAIL because `src/game/config.ts` does not exist.

- [ ] **Step 4: Move types and immutable data without changing values.**

Move the `Player`, `Enemy`, `Projectile`, `XpOrb`, `DamageNumber`, `Particle`, `MenuParticle`, `Chest`, `WaveConfig`, and `WaveEnemy` definitions into `src/game/types.ts`. Move `CHARACTERS`, `WAVES`, `ENEMY_TYPES`, `CHEST_TYPES`, `GAME_STATE`, `MAX_WAVES = 30`, and `HIGH_SCORE_STORAGE_KEY` into `src/game/config.ts` using the current values from `App.tsx`. Export `WAVE_CONFIGS` as the renamed `WAVES` value, and export `WaveEnemy` from `gameLogic.ts` as a compatibility re-export.

- [ ] **Step 5: Update imports and test discovery.**

Remove the duplicated declarations from `App.tsx`, import them from `src/game/config.ts` and `src/game/types.ts`, and change the package script to discover every test file:

```json
"test": "node --test --experimental-strip-types"
```

- [ ] **Step 6: Run the task test cycle.**

Run: `node --test --experimental-strip-types src/game/config.test.ts`, then `npm test`, `npm run typecheck`, and `npm run build`.

Expected: all existing and new tests pass, and the build output is unchanged except for module paths.

- [ ] **Step 7: Commit the extraction.**

```powershell
git add src/game/types.ts src/game/config.ts src/game/config.test.ts src/App.tsx src/gameLogic.ts package.json
git commit -m "refactor: extract game contracts and config"
```

### Task 2: Add deterministic random streams

**Files:**
- Create: `src/game/random.ts`
- Create: `src/game/random.test.ts`
- Modify: `src/gameLogic.ts`

**Interfaces:**
- `RandomSource { next(): number; int(maxExclusive: number): number; pick<T>(items: readonly T[]): T; shuffle<T>(items: readonly T[]): T[] }`
- `RunRandom { world: RandomSource; upgrades: RandomSource; effects: RandomSource }`
- `createRandom(seed: number): RandomSource`
- `createRunRandom(seed: number): RunRandom`
- `normalizeSeed(value: number): number`

- [ ] **Step 1: Write deterministic and error-path tests.**

Create `src/game/random.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom, createRunRandom } from './random.ts';

test('the same seed produces the same sequence and different seeds diverge', () => {
  const first = createRandom(12345);
  const second = createRandom(12345);
  const other = createRandom(54321);
  const a = Array.from({ length: 8 }, () => first.next());
  const b = Array.from({ length: 8 }, () => second.next());
  const c = Array.from({ length: 8 }, () => other.next());
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.every(value => value >= 0 && value < 1));
});

test('shuffle preserves composition and validates bounds', () => {
  const random = createRandom(7);
  const shuffled = random.shuffle(['a', 'b', 'c', 'd']);
  assert.deepEqual([...shuffled].sort(), ['a', 'b', 'c', 'd']);
  assert.equal(random.int(0), 0);
  assert.throws(() => random.pick([]), RangeError);
});

test('stream consumption is independent across gameplay domains', () => {
  const withEffects = createRunRandom(99);
  const withoutEffects = createRunRandom(99);
  Array.from({ length: 50 }, () => withEffects.effects.next());
  assert.deepEqual(
    Array.from({ length: 5 }, () => withEffects.world.next()),
    Array.from({ length: 5 }, () => withoutEffects.world.next()),
  );
  assert.deepEqual(
    Array.from({ length: 5 }, () => withEffects.upgrades.next()),
    Array.from({ length: 5 }, () => withoutEffects.upgrades.next()),
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/game/random.test.ts`

Expected: FAIL because the random module does not exist.

- [ ] **Step 3: Implement the dependency-free PRNG.**

Use a 32-bit `mulberry32` state transition and Fisher–Yates shuffle. `normalizeSeed` must coerce to an unsigned 32-bit integer and replace `0` with `1`. `int(0)` returns `0`; `int(maxExclusive < 0)` throws `RangeError`; `pick([])` throws `RangeError`. Derive the three run streams by mixing the normalized seed with three fixed hexadecimal constants before calling `createRandom`.

- [ ] **Step 4: Preserve the existing wave helper API.**

Change `buildWaveSpawnQueue(entries, random)` so it requires a plain `() => number` supplied by the caller. The function must not default to `Math.random`; pass `runRandom.world.next` from gameplay and `() => 0.5` from deterministic tests. Keep the existing `gameLogic.test.ts` assertions unchanged.

- [ ] **Step 5: Run the task test cycle.**

Run: `node --test --experimental-strip-types src/game/random.test.ts`, `npm test`, and `npm run typecheck`.

Expected: deterministic random tests and all existing tests pass.

- [ ] **Step 6: Commit the random source.**

```powershell
git add src/game/random.ts src/game/random.test.ts src/gameLogic.ts
git commit -m "feat: add seeded gameplay random streams"
```

### Task 3: Replace ad-hoc upgrades with level-aware choices

**Files:**
- Create: `src/game/upgrades.ts`
- Create: `src/game/upgrades.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `UpgradeDefinition { id; name; icon; maxLevel; levels }`
- `UpgradeLevel { description; apply(player: Player): void }`
- `OwnedUpgradeLevels = Readonly<Record<string, number>>`
- `UpgradeChoice { definition; currentLevel; nextLevel; description; delta }`
- `getUpgradeChoices(definitions, ownedLevels, player, count, random): UpgradeChoice[]`
- `applyUpgradeChoice(player, ownedLevels, choice): OwnedUpgradeLevels`

- [ ] **Step 1: Define the data model and failing choice tests.**

Add these tests to `src/game/upgrades.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from './random.ts';
import { getUpgradeChoices, applyUpgradeChoice } from './upgrades.ts';
import type { Player } from './types.ts';

const player: Player = {
  x: 0, y: 0, hp: 50, maxHp: 100, speed: 3, level: 1, xp: 0, xpToNext: 10,
  damage: 10, attackSpeed: 1, attackTimer: 0, projectileCount: 1,
  projectileSpeed: 7, projectileSize: 8, pickupRange: 80, armor: 0,
  invincibleTimer: 0, character: 0,
};

const definitions = [
  { id: 'damage', name: 'Сила+', icon: '⚔️', maxLevel: 2, levels: [
    { description: '+20% к урону', apply: (p: Player) => { p.damage *= 1.2; } },
    { description: '+20% к урону', apply: (p: Player) => { p.damage *= 1.2; } },
  ] },
  { id: 'armor', name: 'Броня+', icon: '🛡️', maxLevel: 1, levels: [
    { description: '+2 к броне', apply: (p: Player) => { p.armor += 2; } },
  ] },
  { id: 'heal', name: 'Лечение', icon: '💖', maxLevel: 1, levels: [
    { description: '+50% HP', apply: (p: Player) => { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5); } },
  ] },
] as const;

test('choices are unique, skip maxed upgrades, and expose the exact delta', () => {
  const choices = getUpgradeChoices(definitions, { armor: 1 }, player, 3, createRandom(1));
  const ids = choices.map(choice => choice.definition.id);
  assert.ok(ids.includes('damage'));
  assert.ok(ids.includes('heal'));
  const damageChoice = choices.find(choice => choice.definition.id === 'damage');
  const healChoice = choices.find(choice => choice.definition.id === 'heal');
  assert.equal(damageChoice?.currentLevel, 0);
  assert.equal(damageChoice?.nextLevel, 1);
  assert.equal(damageChoice?.delta.damage, 2);
  assert.equal(healChoice?.delta.hp, 50);
  assert.equal(new Set(choices.map(choice => choice.definition.id)).size, choices.length);
});

test('a selected upgrade increments its level and a later level can repeat it', () => {
  const damageOnly = definitions.filter(definition => definition.id === 'damage');
  const choice = getUpgradeChoices(damageOnly, {}, player, 1, createRandom(2))[0];
  const owned = applyUpgradeChoice(player, {}, choice);
  assert.equal(owned.damage, 1);
  const next = getUpgradeChoices(damageOnly, owned, player, 1, createRandom(3));
  assert.equal(next[0].currentLevel, 1);
  assert.equal(next[0].nextLevel, 2);
});

test('an empty viable pool returns no choices instead of a duplicate maxed card', () => {
  assert.deepEqual(getUpgradeChoices(definitions, { damage: 2, armor: 1, heal: 1 }, player, 3, createRandom(4)), []);
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/game/upgrades.test.ts`

Expected: FAIL because the upgrade module does not exist.

- [ ] **Step 3: Implement preview and choice generation.**

Create a numeric player-stat snapshot helper. To compute `delta`, clone the player, apply the selected level to the clone, and compare `hp`, `maxHp`, `damage`, `speed`, `attackSpeed`, `projectileCount`, `projectileSpeed`, `projectileSize`, `pickupRange`, and `armor`. Use the injected random source's Fisher–Yates shuffle, filter `currentLevel < maxLevel`, and stop at `count`; never return the same id twice.

- [ ] **Step 4: Move the current upgrade definitions without changing their first-level effects.**

Move `ALL_UPGRADES` into `src/game/upgrades.ts` as `UPGRADE_DEFINITIONS`. Encode the current first-level effects exactly: damage `×1.2`, speed `×1.15`, attack speed `×1.2`, max HP `+30` and current HP `+30`, projectile count `+1`, projectile speed `×1.25`, pickup range `×1.3`, armor `+2`, projectile size `×1.3`, and heal up to `50%` of max HP. Give stat upgrades five explicit levels with the same operation per level and give heal one level; the balance task may revise these caps after telemetry. Replace every `getRandomUpgrades()` call with `getUpgradeChoices()` and store owned levels in the run session rather than inside JSX.

- [ ] **Step 5: Run the task test cycle.**

Run: `node --test --experimental-strip-types src/game/upgrades.test.ts`, `npm test`, and `npm run typecheck`.

Expected: no duplicate choices, correct deltas, and no type errors from moving definitions.

- [ ] **Step 6: Commit the upgrade model.**

```powershell
git add src/game/upgrades.ts src/game/upgrades.test.ts src/game/types.ts src/App.tsx
git commit -m "feat: add leveled upgrade choices"
```

### Task 4: Add testable logical canvas metrics

**Files:**
- Create: `src/game/canvas.ts`
- Create: `src/game/canvas.test.ts`
- Modify: `src/game/types.ts`

**Interfaces:**
- `CanvasMetrics { width; height; dpr; bufferWidth; bufferHeight }`
- `getCanvasMetrics(width: number, height: number, devicePixelRatio: number, maxDpr?: number): CanvasMetrics`

- [ ] **Step 1: Write the failing metric tests.**

Create `src/game/canvas.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasMetrics } from './canvas.ts';

test('keeps logical dimensions and scales the backing buffer', () => {
  assert.deepEqual(getCanvasMetrics(800, 600, 1), {
    width: 800, height: 600, dpr: 1, bufferWidth: 800, bufferHeight: 600,
  });
  assert.deepEqual(getCanvasMetrics(800, 600, 1.5), {
    width: 800, height: 600, dpr: 1.5, bufferWidth: 1200, bufferHeight: 900,
  });
});

test('caps invalid and excessive DPR values at two', () => {
  assert.equal(getCanvasMetrics(801, 601, 3).dpr, 2);
  assert.equal(getCanvasMetrics(801, 601, 0).dpr, 1);
  assert.equal(getCanvasMetrics(801, 601, 3).bufferWidth, 1602);
  assert.equal(getCanvasMetrics(801, 601, 3).bufferHeight, 1202);
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/game/canvas.test.ts`

Expected: FAIL because the canvas helper does not exist.

- [ ] **Step 3: Implement the pure helper and canvas application function.**

Clamp `devicePixelRatio` to `[1, maxDpr]`, round buffer dimensions, and keep `width`/`height` as logical CSS pixels. Add `applyCanvasMetrics(canvas, ctx, metrics)` that sets the CSS size, backing size, and `ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)`.

- [ ] **Step 4: Run the task test cycle.**

Run: `node --test --experimental-strip-types src/game/canvas.test.ts`, `npm test`, and `npm run typecheck`.

Expected: metric tests pass and no DOM code is needed by the test runner.

- [ ] **Step 5: Commit the canvas contract.**

```powershell
git add src/game/canvas.ts src/game/canvas.test.ts src/game/types.ts
git commit -m "feat: add logical canvas metrics"
```

### Task 5: Extract the mutable game session and integrate the seed

**Files:**
- Create: `src/game/engine.ts`
- Create: `src/game/engine.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/gameLogic.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `GameSession { seed; player; enemies; projectiles; xpOrbs; particles; damageNumbers; chests; wave; elapsedSeconds; kills; state; random; ownedUpgrades; pendingLevelUps }`
- `createGameSession(options: { character: number; seed?: number }): GameSession`
- `updateGame(session, dt, input, viewport): GameEvents`
- `getRenderSnapshot(session): RenderSnapshot`
- `selectUpgrade(session, upgradeId): GameEvents`
- `pauseSession(session)`, `resumeSession(session)`, `finishSession(session, result)`

- [ ] **Step 1: Write session and reproducibility tests before moving the loop.**

Create `src/game/engine.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameSession,
  finishSession,
  pauseSession,
  resumeSession,
  updateGame,
} from './engine.ts';

const neutralInput = { up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0 };
const viewport = { width: 800, height: 600 };

test('same seed creates the same first wave and chest placement', () => {
  const first = createGameSession({ character: 0, seed: 1234 });
  const second = createGameSession({ character: 0, seed: 1234 });
  assert.deepEqual(first.wave.queue, second.wave.queue);
  assert.deepEqual(first.chests, second.chests);
});

test('pause prevents simulation time from advancing and resume continues it', () => {
  const session = createGameSession({ character: 0, seed: 1 });
  pauseSession(session);
  updateGame(session, 1, neutralInput, viewport);
  assert.equal(session.elapsedSeconds, 0);
  resumeSession(session);
  updateGame(session, 1, neutralInput, viewport);
  assert.equal(session.elapsedSeconds, 1);
});

test('finishSession records a terminal result and does not reopen the run', () => {
  const session = createGameSession({ character: 0, seed: 2 });
  finishSession(session, 'defeat');
  assert.equal(session.state, 'game_over');
  assert.equal(updateGame(session, 1, neutralInput, viewport).gameOver, null);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail.**

Run: `node --test --experimental-strip-types src/game/engine.test.ts`

Expected: FAIL because `engine.ts` does not exist.

- [ ] **Step 3: Define the session without React dependencies.**

Move the mutable refs currently created in `App.tsx` into `GameSession`. `createGameSession` must initialize the selected character, empty entity arrays, wave 1 queue, deterministic run streams, `state: 'playing'`, `pendingLevelUps: 0`, and `ownedUpgrades: {}`. Derive the seed from a valid `?seed=<uint32>` query value when the caller does not provide one; use `crypto.getRandomValues` with a timestamp fallback for a generated seed.

- [ ] **Step 4: Move `startWave`, `spawnEnemy`, and `updateGame` into the engine.**

Replace every gameplay `Math.random()` call with the appropriate stream: `world` for wave shuffle, chest count/type/placement, and enemy spawn position; `upgrades` for choices; `effects` for particle velocities. Initialize menu particles with a separate fixed menu-only `createRandom(0x4d454e55)` stream so cosmetic menu generation is deterministic and does not consume a run stream. Keep all current numeric combat values and delta-time behavior. The engine must emit events instead of calling `setUiState`, `setPlayerData`, `setGameTime`, or `setKillCount`.

- [ ] **Step 5: Preserve multi-level XP behavior.**

When one pickup crosses multiple thresholds, add all `levelsGained` to `pendingLevelUps`. Emit one level-up event at a time; `selectUpgrade` decrements the queue and generates the next choices until it reaches zero. The engine must not discard a queued level-up when the UI is already in `level_up` state.

- [ ] **Step 6: Replace the App refs with one session ref and a presentation snapshot.**

Keep `const sessionRef = useRef<GameSession | null>(null)`. `initGame` creates a session, `updateGame` delegates to the engine, and the existing throttled React updates read `getRenderSnapshot(sessionRef.current)` plus scalar counters. The high-score setter remains in `App.tsx` and consumes the engine's terminal event.

- [ ] **Step 7: Prove gameplay code no longer uses global randomness.**

Run:

```powershell
if (rg -n "Math\.random" src) { exit 1 }
```

Expected: no matches. Then run `node --test --experimental-strip-types src/game/engine.test.ts`, `npm test`, and `npm run typecheck`.

- [ ] **Step 8: Commit the engine extraction.**

```powershell
git add src/game/engine.ts src/game/engine.test.ts src/game/types.ts src/gameLogic.ts src/App.tsx
git commit -m "refactor: move simulation into game session"
```

### Task 6: Extract the renderer and apply Retina scaling

**Files:**
- Create: `src/game/renderer.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- `renderGame(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot, metrics: CanvasMetrics): void`
- `CanvasMetrics` from `src/game/canvas.ts`

- [ ] **Step 1: Write the renderer contract test using a recording context.**

Create `src/game/renderer.test.ts` with a minimal fake context that records `setTransform`, `clearRect`, `save`, and `restore`. Assert that `renderGame` calls `setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)` and clears using logical `metrics.width` and `metrics.height`, never the physical buffer dimensions.

- [ ] **Step 2: Run the focused test to verify the extracted renderer is absent.**

Run: `node --test --experimental-strip-types src/game/renderer.test.ts`

Expected: FAIL because `renderer.ts` does not exist.

- [ ] **Step 3: Move the current drawing code into `renderer.ts`.**

Move grid, chests, XP orbs, particles, enemies, projectiles, player, pickup radius, damage numbers, and joystick drawing from `App.tsx` into `renderGame`. Replace direct ref reads with `RenderSnapshot` fields. Remove the unused local `roundRect` helper after confirming it has no callers.

- [ ] **Step 4: Wire the canvas effect to logical metrics.**

On resize, read `canvas.getBoundingClientRect()`, call `getCanvasMetrics(rect.width, rect.height, window.devicePixelRatio)`, apply the metrics, and store the logical viewport in a ref. Reapply metrics when the DPR media query changes. Pass logical viewport dimensions to `updateGame` and `renderGame`; do not use `canvas.width` or `canvas.height` for camera centering after scaling.

- [ ] **Step 5: Preserve CSS layout and mobile touch behavior.**

Keep `.game-canvas` at `inset: 0; width: 100%; height: 100%` and add `image-rendering: auto`. Do not add CSS transforms to compensate for DPR; the backing buffer and context transform are the only scaling mechanism.

- [ ] **Step 6: Run the task test cycle.**

Run: `node --test --experimental-strip-types src/game/canvas.test.ts src/game/renderer.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`.

Expected: logical-coordinate tests pass and the production build succeeds.

- [ ] **Step 7: Commit the renderer and scaling work.**

```powershell
git add src/game/renderer.ts src/game/renderer.test.ts src/App.tsx src/index.css
git commit -m "feat: render canvas with logical high-dpi coordinates"
```

### Task 7: Extract input handling and add level-up hotkeys

**Files:**
- Create: `src/game/input.ts`
- Create: `src/game/input.test.ts`
- Modify: `src/gameLogic.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- `MovementInput { up; down; left; right; joystickX; joystickY }`
- `InputController { getMovement(): MovementInput; reset(): void; dispose(): void }`
- `getUpgradeHotkeyIndex(event: { code: string; key: string }): number | null`
- `createInputController(options): InputController`

- [ ] **Step 1: Write pure input-state and hotkey tests.**

Create `src/game/input.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearMovement, getUpgradeHotkeyIndex, setMovement } from './input.ts';

test('upgrade hotkeys map only Digit1, Digit2, and Digit3', () => {
  assert.equal(getUpgradeHotkeyIndex({ code: 'Digit1', key: '1' }), 0);
  assert.equal(getUpgradeHotkeyIndex({ code: 'Digit2', key: '2' }), 1);
  assert.equal(getUpgradeHotkeyIndex({ code: 'Digit3', key: '3' }), 2);
  assert.equal(getUpgradeHotkeyIndex({ code: 'KeyW', key: 'ц' }), null);
});

test('clearing input removes keyboard and joystick movement', () => {
  const active = setMovement({ up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0 }, 'left', true);
  assert.deepEqual(clearMovement({ ...active, joystickX: 1, joystickY: -1 }), {
    up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0,
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/game/input.test.ts`

Expected: FAIL because `input.ts` does not exist.

- [ ] **Step 3: Implement pure input helpers and the browser controller.**

Use `getMovementKey` from `gameLogic.ts` to maintain canonical `up/down/left/right` state. `createInputController` must register keydown/keyup, blur, visibilitychange, touchend, touchcancel, pointerup, and pointercancel listeners, and `dispose()` must remove every listener with matching options. Escape toggles pause only through the supplied callback; it must not mutate the session directly.

- [ ] **Step 4: Route level-up selection through one handler.**

Add a keydown callback that, only when the current UI state is `level_up`, maps `getUpgradeHotkeyIndex` to `upgrades[index]` and invokes the same `onUpgradeSelect(upgrade.id)` callback used by card clicks. Ignore `1/2/3` in menu, gameplay, pause, and game-over states.

- [ ] **Step 5: Integrate the controller and test cleanup behavior.**

Replace the event-listener block in `App.tsx` with one `inputControllerRef`. On blur or hidden document, clear movement and pause an active run. On touch/pointer cancellation, clear the joystick without requiring another frame. Keep `preventDefault()` limited to active game canvas input so menu buttons remain clickable.

- [ ] **Step 6: Run the task test cycle.**

Run: `node --test --experimental-strip-types src/game/input.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`.

Expected: hotkey tests pass, listener code typechecks, and no stale movement remains after cleanup.

- [ ] **Step 7: Commit input extraction.**

```powershell
git add src/game/input.ts src/game/input.test.ts src/gameLogic.ts src/App.tsx
git commit -m "feat: centralize input and upgrade hotkeys"
```

### Task 8: Split React overlays and finish the first package

**Files:**
- Create: `src/ui/GameHud.tsx`
- Create: `src/ui/MenuScreen.tsx`
- Create: `src/ui/CharacterSelect.tsx`
- Create: `src/ui/LevelUpModal.tsx`
- Create: `src/ui/PauseModal.tsx`
- Create: `src/ui/GameOverModal.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

**Interfaces:**
- `GameHudProps { player: PlayerSnapshot; character: CharacterDefinition; wave: WaveRuntime; elapsedSeconds: number; kills: number }`
- `MenuScreenProps { highScore: number; onStart: () => void }`
- `CharacterSelectProps { characters: readonly CharacterDefinition[]; onSelect: (character: number) => void; onBack: () => void }`
- `LevelUpModalProps { level: number; characterName: string; choices: readonly UpgradeChoice[]; onSelect: (id: string) => void }`
- `PauseModalProps { onResume: () => void; onMenu: () => void }`
- `GameOverModalProps { result: 'victory' | 'defeat'; wave; elapsedSeconds; level; kills; onRestart; onMenu }`

- [ ] **Step 1: Write the component prop contracts before moving markup.**

Add exported prop interfaces beside each component and make each component render a minimal accessible shell with a heading, buttons, and `aria-label`s. Typecheck should fail until the props are supplied from `App.tsx`.

- [ ] **Step 2: Extract the existing markup without changing copy or behavior.**

Move the HUD, menu, character select, level-up, pause, and game-over JSX from `App.tsx` into the six components. Keep the current Russian labels and existing classes first; pass callbacks from `App.tsx` rather than calling refs inside the components. Render each upgrade card's `currentLevel`, `nextLevel`, and `delta` from `UpgradeChoice`.

- [ ] **Step 3: Add accessible selection semantics.**

Use real `<button>` elements for every choice, expose the exact stat delta in visible text and an `aria-label`, and add `aria-live="polite"` to wave-intro and result summaries. The number shown on a card must match its hotkey index.

- [ ] **Step 4: Remove UI responsibilities from `App.tsx`.**

Leave `App.tsx` responsible for `uiState`, session creation, event consumption, presentation snapshots, and composing the components. It must no longer contain character cards, upgrade cards, modal layout markup, or game drawing code.

- [ ] **Step 5: Run first-package verification.**

Run:

```powershell
npm test
npm run typecheck
npm run build
rg -n "Math\.random" src
```

Expected: all tests, typecheck, and build pass; the final command produces no output. Start the dev server with `npm run dev -- --host 127.0.0.1`, then smoke-test menu → character select → run → pause → level-up → game-over at desktop width and a narrow mobile width. Repeat once with a URL seed such as `?seed=12345` and confirm the seed is visible in game-over/debug output.

- [ ] **Step 6: Commit the first package.**

```powershell
git add src/ui src/App.tsx src/index.css
git commit -m "refactor: split survivors app into game and ui modules"
```

---

### Task 9: Add a measured spatial hash for collision broad-phase queries

**Files:**
- Create: `src/game/spatialHash.ts`
- Create: `src/game/spatialHash.test.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/types.ts`

**Interfaces:**
- `SpatialHash<T extends { x: number; y: number }> { clear(); insert(item: T): void; queryCircle(x, y, radius): T[] }`
- `cellKey(x: number, y: number, cellSize: number): string`

- [ ] **Step 1: Capture the pre-optimization collision profile.**

Run a 30-wave browser session with the Performance panel open and record projectile/enemy collision time at waves 10, 20, and 30. The engine must expose a development-only counter for exact distance checks so the comparison is reproducible. Keep the optimization if it reduces candidate checks without changing the collision result.

- [ ] **Step 2: Write boundary and correctness tests.**

Create `src/game/spatialHash.test.ts` with tests for negative coordinates, an item exactly on a cell boundary, a query spanning multiple cells, and duplicate-free results:

```ts
test('queries neighboring cells without missing boundary objects', () => {
  const grid = new SpatialHash<{ id: string; x: number; y: number }>(100);
  grid.insert({ id: 'negative', x: -1, y: -1 });
  grid.insert({ id: 'boundary', x: 100, y: 0 });
  grid.insert({ id: 'far', x: 500, y: 500 });
  assert.deepEqual(
    grid.queryCircle(0, 0, 120).map(item => item.id).sort(),
    ['boundary', 'negative'],
  );
});
```

- [ ] **Step 3: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/game/spatialHash.test.ts`

Expected: FAIL because the spatial hash does not exist.

- [ ] **Step 4: Implement the uniform grid and preserve exact collision checks.**

Use `Math.floor(position / cellSize)` for cell coordinates, rebuild the grid once per update from `session.enemies`, query a circle around each projectile, and keep the existing squared-distance collision check on returned candidates. Use a `Set` while collecting query results so an item occupying multiple cells appears once.

- [ ] **Step 5: Compare the optimized and baseline results.**

Run the focused tests, then a deterministic same-seed simulation at waves 10, 20, and 30. Assert equal kills, remaining enemy HP, XP pickups, and game-over result between a temporary baseline collision path and the spatial-hash path. Re-run the Performance panel and keep the counter output in the task notes.

- [ ] **Step 6: Commit the measured optimization.**

```powershell
git add src/game/spatialHash.ts src/game/spatialHash.test.ts src/game/engine.ts src/game/types.ts
git commit -m "perf: add spatial hash collision broad phase"
```

### Task 10: Add combat feedback and danger communication

**Files:**
- Create: `src/game/feedback.ts`
- Create: `src/game/feedback.test.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/game/renderer.ts`
- Modify: `src/ui/GameHud.tsx`
- Modify: `src/index.css`

**Interfaces:**
- `HitFlash { x; y; lifetime; color }`
- `ScreenShake { amplitude; lifetime }`
- `DangerIndicator { x; y; radius; lifetime; color }`
- `FeedbackState { hitFlashes; screenShake; dangerIndicators }`
- `advanceFeedback(state, dt): FeedbackState`
- `addHitFlash`, `addScreenShake`, `addDangerIndicator`

- [ ] **Step 1: Write feedback lifetime tests.**

Create `src/game/feedback.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceFeedback } from './feedback.ts';

test('feedback effects decay and are removed at zero lifetime', () => {
  const next = advanceFeedback({
    hitFlashes: [{ x: 0, y: 0, lifetime: 0.1, color: '#fff' }],
    screenShake: { amplitude: 4, lifetime: 0.1 },
    dangerIndicators: [{ x: 0, y: 0, radius: 20, lifetime: 0.1, color: '#f00' }],
  }, 0.1);
  assert.equal(next.hitFlashes.length, 0);
  assert.equal(next.dangerIndicators.length, 0);
  assert.equal(next.screenShake.lifetime, 0);
  assert.ok(next.screenShake.amplitude >= 0);
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/game/feedback.test.ts`

Expected: FAIL because `feedback.ts` does not exist.

- [ ] **Step 3: Implement feedback as simulation data, not direct canvas calls.**

Emit a hit flash and a small shake on projectile impact, a stronger flash/particle burst on enemy death, and a red danger indicator for elite/boss attack telegraphs. Cap the total shake amplitude and the number of retained transient effects so a large wave cannot allocate unbounded arrays.

- [ ] **Step 4: Render feedback and respect reduced-motion CSS.**

Apply the shake offset around the logical camera transform, draw flashes before entities, draw danger indicators beneath enemies, and keep damage numbers visible. Preserve the existing `prefers-reduced-motion` rule and avoid animating UI-only elements when it is active.

- [ ] **Step 5: Run tests, build, and a combat smoke check.**

Run: `node --test --experimental-strip-types src/game/feedback.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`. In the browser, confirm hit flashes, damage numbers, death particles, and a boss/elite warning are visible without blocking movement.

- [ ] **Step 6: Commit combat feedback.**

```powershell
git add src/game/feedback.ts src/game/feedback.test.ts src/game/types.ts src/game/engine.ts src/game/renderer.ts src/ui/GameHud.tsx src/index.css
git commit -m "feat: improve combat feedback and danger cues"
```

### Task 11: Replace the static wave table with a difficulty curve

**Files:**
- Create: `src/game/waves.test.ts`
- Modify: `src/game/waves.ts`
- Modify: `src/game/config.ts`
- Modify: `src/game/engine.ts`
- Modify: `src/ui/GameHud.tsx`

**Interfaces:**
- `DifficultyProfile { enemyCountMultiplier; hpMultiplier; speedMultiplier; eliteCount; boss; durationSeconds }`
- `getDifficultyProfile(wave: number): DifficultyProfile`
- `buildWaveConfig(wave: number): WaveConfig`
- `isBossWave(wave: number): boolean`

- [ ] **Step 1: Lock the initial curve policy in tests.**

Use a 30-wave schedule with five-wave stages: regular waves last 20 seconds, waves 10, 20, and 30 are boss waves lasting 45 seconds, and elite count is `Math.floor(wave / 5)` on non-boss waves. Assert that enemy count, HP, and speed multipliers are non-decreasing across waves and that wave 30 has exactly one boss entry.

- [ ] **Step 2: Run the focused test to verify the new curve fails.**

Run: `node --test --experimental-strip-types src/game/waves.test.ts`

Expected: FAIL because the curve functions do not exist.

- [ ] **Step 3: Implement the first data-driven curve.**

Use these explicit initial coefficients so the balance change is reviewable:

```ts
const waveIndex = Math.max(0, Math.min(29, wave - 1));
const stage = Math.floor(waveIndex / 5);
const profile = {
  enemyCountMultiplier: 1 + waveIndex * 0.12,
  hpMultiplier: 1 + waveIndex * 0.08,
  speedMultiplier: 1 + stage * 0.03,
  eliteCount: wave % 10 === 0 ? 0 : Math.floor(wave / 5),
  boss: wave % 10 === 0,
  durationSeconds: wave % 10 === 0 ? 45 : 20,
};
```

Start from the current enemy type mix, scale normal/fast/tank counts with `Math.round`, add `eliteCount` type-3 entries with `isBoss: false`, and add one type-3 `isBoss: true` entry on boss waves. Preserve the queue's exact composition and expose `isBossWave` to the HUD and wave-intro copy.

- [ ] **Step 4: Add progress and elite presentation.**

Show spawned/alive/total progress in `GameHud`, announce elite waves in the intro, and keep the final-wave victory path intact. A wave may not complete until its queue is exhausted and all alive enemies are defeated.

- [ ] **Step 5: Run the task test cycle and tune only through explicit assertions.**

Run: `node --test --experimental-strip-types src/game/waves.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`. Browser-smoke waves 1, 5, 10, and 30 using a development seed. Any coefficient change must update the named wave tests and commit message.

- [ ] **Step 6: Commit the wave curve.**

```powershell
git add src/game/waves.ts src/game/waves.test.ts src/game/config.ts src/game/engine.ts src/ui/GameHud.tsx
git commit -m "feat: add staged wave difficulty curve"
```

### Task 12: Add settings, run records, and persistence migration

**Files:**
- Create: `src/game/settings.ts`
- Create: `src/game/settings.test.ts`
- Create: `src/game/persistence.ts`
- Create: `src/game/persistence.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/ui/MenuScreen.tsx`
- Modify: `src/ui/GameOverModal.tsx`
- Modify: `src/index.css`

**Interfaces:**
- `GameSettings { volume: number; screenShake: boolean; particles: boolean; controls: 'keyboard' | 'touch' | 'auto'; vibration: boolean; language: 'ru' | 'en' }`
- `RunRecord { bestTime: number; bestWave: number; bestKills: number; selectedCharacter: number }`
- `loadSettings(storage): GameSettings`
- `saveSettings(storage, settings): void`
- `loadRunRecord(storage): RunRecord`
- `saveRunRecord(storage, record): void`

- [ ] **Step 1: Write storage tests with an in-memory adapter.**

Define the test adapter and cover defaults, clamping volume to `[0, 1]`, malformed JSON fallback, selected-character bounds, monotonic best-time/wave/kills updates, and migration of `anime-survivors-high-score` into the new run record without deleting the legacy key:

```ts
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('malformed settings use validated defaults', () => {
  const storage = new MemoryStorage();
  storage.setItem('anime-survivors-settings-v1', '{broken');
  assert.deepEqual(loadSettings(storage), DEFAULT_SETTINGS);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail.**

Run: `node --test --experimental-strip-types src/game/settings.test.ts src/game/persistence.test.ts`

Expected: FAIL because the storage modules do not exist.

- [ ] **Step 3: Implement versioned local persistence.**

Use `anime-survivors-settings-v1` and `anime-survivors-record-v1` keys. Wrap every storage access in `try/catch`, validate each field, merge only known fields, and preserve the legacy high-score read path. Store settings and records as JSON with a `version: 1` field.

- [ ] **Step 4: Add a settings surface without changing the game loop.**

Add a menu settings panel or modal with volume, shake, particles, controls, vibration, and language controls. Persist changes immediately; pass the resulting settings into the engine/renderer/input controller. Save the best time, highest wave, kills, and selected character on game-over and character selection.

- [ ] **Step 5: Run tests and verify reload behavior.**

Run: `node --test --experimental-strip-types src/game/settings.test.ts src/game/persistence.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`. Reload the browser and confirm settings, selected character, and records remain available.

- [ ] **Step 6: Commit persistence and settings.**

```powershell
git add src/game/settings.ts src/game/settings.test.ts src/game/persistence.ts src/game/persistence.test.ts src/App.tsx src/ui/MenuScreen.tsx src/ui/GameOverModal.tsx src/index.css
git commit -m "feat: persist settings and run records"
```

### Task 13: Harden mobile controls and optional vibration

**Files:**
- Modify: `src/game/input.ts`
- Modify: `src/game/input.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `src/game/settings.ts`

**Interfaces:**
- `PointerJoystickState { pointerId: number | null; active: boolean; startX; startY; dx; dy }`
- `normalizeJoystickDelta(startX, startY, clientX, clientY, radius): { dx; dy }`
- `shouldVibrate(settings: GameSettings, navigatorLike): boolean`

- [ ] **Step 1: Add pure joystick and vibration tests.**

Add tests such as:

```ts
test('joystick deltas are clamped to a unit vector', () => {
  assert.deepEqual(normalizeJoystickDelta(0, 0, 100, 0, 50), { dx: 1, dy: 0 });
  const diagonal = normalizeJoystickDelta(0, 0, 30, 40, 50);
  assert.ok(Math.abs(Math.hypot(diagonal.dx, diagonal.dy) - 1) < 1e-12);
});

test('vibration requires both a setting and a supported API', () => {
  assert.equal(shouldVibrate({ ...DEFAULT_SETTINGS, vibration: true }, { vibrate: () => true }), true);
  assert.equal(shouldVibrate({ ...DEFAULT_SETTINGS, vibration: false }, { vibrate: () => true }), false);
  assert.equal(shouldVibrate({ ...DEFAULT_SETTINGS, vibration: true }, {}), false);
});
```

- [ ] **Step 2: Run the focused tests to verify the new behavior fails.**

Run: `node --test --experimental-strip-types src/game/input.test.ts`

Expected: FAIL for the new exports.

- [ ] **Step 3: Use pointer capture for the joystick.**

On `pointerdown` in the canvas, call `setPointerCapture(pointerId)`, store the pointer id, and update only events from that id. Release capture and reset on `pointerup`, `pointercancel`, blur, and visibility change. Keep `touch-action: none` on the canvas and prevent page scrolling only while the active pointer controls the run.

- [ ] **Step 4: Add optional vibration at meaningful events.**

Call `navigator.vibrate(10)` on a player hit and `navigator.vibrate([20, 30, 20])` on game-over only when the setting allows it. Treat unsupported or throwing vibration APIs as no-ops.

- [ ] **Step 5: Run the task test cycle and narrow-screen smoke test.**

Run: `node --test --experimental-strip-types src/game/input.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`. In a narrow browser viewport, verify the joystick remains inside the safe area, the page does not scroll, buttons remain tappable, and a canceled gesture does not leave movement active.

- [ ] **Step 6: Commit mobile controls.**

```powershell
git add src/game/input.ts src/game/input.test.ts src/App.tsx src/index.css src/game/settings.ts
git commit -m "feat: harden mobile controls and vibration"
```

### Task 14: Consolidate interface language behind a small catalog

**Files:**
- Create: `src/i18n.ts`
- Create: `src/i18n.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/ui/GameHud.tsx`
- Modify: `src/ui/MenuScreen.tsx`
- Modify: `src/ui/CharacterSelect.tsx`
- Modify: `src/ui/LevelUpModal.tsx`
- Modify: `src/ui/PauseModal.tsx`
- Modify: `src/ui/GameOverModal.tsx`
- Modify: `src/game/settings.ts`

**Interfaces:**
- `Language = 'ru' | 'en'`
- `MessageKey` inferred from the Russian catalog
- `messages: Record<Language, Record<MessageKey, string>>`
- `createTranslator(language): (key: MessageKey, values?: Record<string, string | number>) => string`

- [ ] **Step 1: Write catalog parity and fallback tests.**

Create `src/i18n.test.ts` with:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, messages } from './i18n.ts';

test('Russian and English catalogs have identical keys', () => {
  assert.deepEqual(Object.keys(messages.ru).sort(), Object.keys(messages.en).sort());
});

test('translator interpolates values and falls back to Russian', () => {
  const english = createTranslator('en');
  assert.ok(!english('waveLabel', { wave: 3 }).includes('{wave}'));
  assert.equal(createTranslator('xx' as never)('menuStart'), messages.ru.menuStart);
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `node --test --experimental-strip-types src/i18n.test.ts`

Expected: FAIL because the catalog does not exist.

- [ ] **Step 3: Define the catalog and default language.**

Include every visible label currently mixed into JSX, including `LOADOUT`, `RUN SUSPENDED`, `MISSION COMPLETE`, `SIGNAL LOST`, button labels, HUD labels, controls, and result summaries. Keep Russian as the default and load the persisted language setting at startup.

- [ ] **Step 4: Replace hard-coded UI strings.**

Pass a translator into each UI component or create it at the `App` boundary. Do not localize entity names or upgrade data in this task; those remain in configuration until content localization is explicitly requested.

- [ ] **Step 5: Run tests and browser language smoke test.**

Run: `node --test --experimental-strip-types src/i18n.test.ts`, `npm test`, `npm run typecheck`, and `npm run build`. Switch language in settings and verify menu, HUD, level-up, pause, and game-over use one consistent language after reload.

- [ ] **Step 6: Commit localization.**

```powershell
git add src/i18n.ts src/i18n.test.ts src/App.tsx src/ui src/game/settings.ts
git commit -m "feat: centralize interface localization"
```

### Task 15: Complete regression coverage and GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `src/game/engine.test.ts`
- Modify: `src/game/persistence.test.ts`
- Modify: `src/game/upgrades.test.ts`
- Modify: `src/game/input.test.ts`

**Interfaces:**
- CI command contract: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`

- [ ] **Step 1: Add the remaining regression scenarios.**

Add explicit tests for:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameSession, updateGame } from './engine.ts';
import { loadRunRecord, saveRunRecord } from './persistence.ts';

const neutralInput = { up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0 };
const viewport = { width: 800, height: 600 };

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('one XP pickup can queue several level-up selections', () => {
  const session = createGameSession({ character: 0, seed: 10 });
  session.xpOrbs.push({ x: 0, y: 0, value: 50, size: 10 });
  const event = updateGame(session, 1 / 60, neutralInput, viewport);
  assert.equal(event.levelUps, 3);
  assert.equal(session.pendingLevelUps, 3);
});

test('records never regress when a shorter run is saved', () => {
  const storage = new MemoryStorage();
  saveRunRecord(storage, { bestTime: 120, bestWave: 12, bestKills: 300, selectedCharacter: 2 });
  saveRunRecord(storage, { bestTime: 40, bestWave: 4, bestKills: 20, selectedCharacter: 1 });
  assert.deepEqual(loadRunRecord(storage), {
    bestTime: 120, bestWave: 12, bestKills: 300, selectedCharacter: 1,
  });
});
```

Also assert that pause, visibility reset, game-over, duplicate upgrades, and `1/2/3` selection are covered by named tests rather than only browser smoke checks.

- [ ] **Step 2: Make the test command portable.**

Keep the package script as:

```json
"test": "node --test --experimental-strip-types"
```

Run it from PowerShell and from a clean Node 24 environment so discovery includes every `*.test.ts` file under `src/`.

- [ ] **Step 3: Add the CI workflow.**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run typecheck
      - run: npm run build
```

- [ ] **Step 4: Run the complete local verification.**

Run:

```powershell
npm ci
npm test
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: all commands pass, `git diff --check` is clean, and only intended source, test, workflow, and documentation files are present.

- [ ] **Step 5: Perform the final browser smoke matrix.**

Verify desktop DPR 1, desktop DPR 2, and a narrow touch viewport through menu, character select, seeded run, movement, pause/resume, multiple level-ups, upgrade hotkeys, wave transition, game-over, victory, settings reload, language switch, and high-score persistence. Record any failure as a focused follow-up task rather than weakening an assertion.

- [ ] **Step 6: Commit the verification layer.**

```powershell
git add .github/workflows/ci.yml package.json src/game src/i18n.ts src/i18n.test.ts
git commit -m "ci: verify tests typecheck and production build"
```

## Self-Review Checklist

- Spec coverage: Tasks 1–8 cover the first implementation package; Tasks 9–14 cover spatial partitioning, combat feel, wave balance, settings/save, mobile behavior, and localization; Task 15 covers regression tests and GitHub Actions.
- Placeholder scan: the plan contains no unresolved markers or unspecified file/function placeholders; deferred product choices from the spec are either explicitly bounded or represented by a named follow-up task.
- Type consistency: `Player`, `WaveEnemy`, `GameState`, `GameSession`, `GameEvents`, `CanvasMetrics`, `UpgradeChoice`, `MovementInput`, and `RunRecord` are introduced before consumers use them.
- Review focus coverage: deterministic streams are tested in Tasks 2 and 5; upgrade edge cases in Tasks 3, 7, and 15; Retina behavior in Tasks 4 and 6; input/run-state failures in Tasks 5, 7, and 15; persistence migration in Task 12.
- Scope: the first package can ship independently after Task 8. Tasks 9–15 are ordered follow-up phases and each has its own focused tests and commit.
