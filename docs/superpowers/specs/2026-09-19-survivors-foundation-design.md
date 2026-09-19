# Survivors Gameplay Foundation and Modularization Design

## Goal

Prepare Anime Survivors for reliable progression, reproducible runs, high-DPI rendering, and further content work without another large rewrite. The first implementation package will make upgrades deterministic and inspectable, introduce a seedable random source, scale the canvas correctly on Retina/4K displays, and split the 904-line `App.tsx` into focused modules. The remaining roadmap will then build on those boundaries for combat feel, wave balance, settings, mobile support, localization, and CI.

## Current context

- The project is a React 18 + TypeScript + Vite canvas game.
- `src/gameLogic.ts` already contains tested pure helpers for keyboard mapping, XP progression, progress clamping, spawn probability, and wave queue construction.
- `src/App.tsx` still owns entity types, character/enemy/chest/wave configuration, upgrade definitions, input listeners, the simulation loop, collision checks, canvas rendering, and all overlay markup.
- `getRandomUpgrades()` still uses `sort(() => Math.random() - 0.5)`, and gameplay/effect randomness is spread across `App.tsx`.
- The current test suite uses Node's built-in test runner and has five passing tests. Typecheck and production build require the dependencies from `package-lock.json`; they cannot run until dependencies are installed in a checkout.
- The existing 30-wave behavior and Russian copy remain the compatibility baseline for the first package.

## Scope

### First implementation package

1. Extract shared game types and immutable configuration from `App.tsx`.
2. Replace ad-hoc upgrade shuffling with a level-aware, duplicate-free choice system.
3. Route all run-time gameplay randomness through a seedable random source.
4. Resize the canvas using CSS viewport dimensions and an effective `devicePixelRatio` while preserving logical game coordinates.
5. Extract the simulation, renderer, input controller, and React overlay components behind explicit interfaces.
6. Add pure tests for the new contracts and preserve the existing browser behavior.

### Follow-up roadmap enabled by these boundaries

- Add a measured uniform spatial hash for projectile/enemy broad-phase queries.
- Improve combat feedback: hit flashes, damage numbers, screen shake, death particles, telegraphed dangerous attacks, and clearer wave/elite presentation.
- Replace the static wave table with a data-driven difficulty curve and explicit elite/boss milestones.
- Add volume, shake/particle toggles, control selection, best result/wave/kills, and selected-character persistence.
- Improve mobile input with pointer capture, scroll prevention, optional vibration, and a resilient virtual joystick.
- Consolidate Russian/English copy behind a small localization layer.
- Extend tests and add GitHub Actions for `test`, `typecheck`, and `build` on every push and pull request.

## Non-goals for the first package

- No new characters, enemy families, weapons, maps, or progression currencies.
- No backend, account system, or cloud save.
- No reroll or banish mechanic yet; the upgrade API must leave room for it without implementing it now.
- No full ECS rewrite and no speculative spatial partitioning before collision profiling identifies the need.
- No visual restyle beyond changes required to keep extracted UI components behaviorally identical and readable at the new canvas scale.

## Design decisions

### 1. Incremental modularization

Use extraction-by-contract rather than rewriting the engine. The first commits move data and pure rules out of `App.tsx`; the next commits move stateful simulation and rendering; the last extraction moves overlay markup. Each step must leave a runnable game and must not change balance or save keys unless the task explicitly calls for it.

The target module map is:

```text
src/
  game/
    types.ts          # Player, Enemy, Projectile, XpOrb, DamageNumber, Particle, Chest, snapshots
    config.ts         # characters, enemy/chest definitions, wave declarations, constants
    random.ts         # seeded RandomSource and run-stream construction
    upgrades.ts       # definitions, owned levels, choice generation, stat deltas
    waves.ts          # wave queue/state helpers and later difficulty-curve seam
    spatialHash.ts    # follow-up broad-phase implementation, not first-package work
    engine.ts         # mutable run session and update operations
    renderer.ts       # logical-coordinate canvas rendering
    input.ts          # keyboard, pointer/touch, joystick, pause input
  ui/
    GameHud.tsx
    MenuScreen.tsx
    CharacterSelect.tsx
    LevelUpModal.tsx
    PauseModal.tsx
    GameOverModal.tsx
  gameLogic.ts        # existing generic pure helpers kept compatible
  App.tsx             # React orchestration and screen routing
```

The exact extraction order may keep a small compatibility adapter in `App.tsx`, but consumers should depend on the exported types/functions above rather than reaching into implementation details.

### 2. Seedable random source and replay contract

Use a small dependency-free 32-bit PRNG behind an interface:

```ts
export interface RandomSource {
  next(): number;                 // [0, 1)
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export interface RunRandom {
  world: RandomSource;
  upgrades: RandomSource;
  effects: RandomSource;
}
```

`createRunRandom(seed: number)` derives independent streams from one unsigned 32-bit run seed. World placement/spawn decisions, upgrade choices, and cosmetic effects must not consume the same sequence; otherwise adding a particle can change later combat outcomes. The menu may use a separate non-game stream.

`initGame` creates or accepts a seed and stores it in the run session. A development-friendly seed override should be accepted through a query parameter such as `?seed=12345`; malformed values fall back to a generated seed. The seed should be available in the game-over/debug data so a failing run can be reported and replayed. The first package does not promise input recording: reproducibility means identical seed plus identical input/timing decisions produce the same gameplay decisions.

After migration, `Math.random()` must not appear in gameplay modules. Tests will inject a deterministic source and assert that the same seed produces the same wave queue, chest placements, spawn positions, and upgrade choices.

### 3. Upgrade model

Keep upgrade definitions data-driven and separate from mutable player state:

```ts
export interface UpgradeDefinition {
  id: string;
  name: string;
  icon: string;
  maxLevel: number;
  levels: readonly UpgradeLevel[];
}

export interface UpgradeLevel {
  description: string;
  apply(player: Player): void;
}

export interface UpgradeChoice {
  definition: UpgradeDefinition;
  currentLevel: number;
  nextLevel: number;
  description: string;
  delta: Readonly<Record<string, number>>;
}
```

`getUpgradeChoices(definitions, ownedLevels, count, random)` filters maxed upgrades, shuffles with the injected upgrade stream, and returns at most one choice for each id. Repeating an upgrade across different level-up screens is allowed until `maxLevel`; duplicating it within one screen is forbidden. The `delta` is calculated from the before/after stat snapshot rather than trusted solely from display text, so the UI can show exact changes such as `Урон 10 → 12 (+2)`.

The same `selectUpgrade(choice)` handler is used by pointer activation and hotkeys `1`, `2`, and `3`. Hotkeys only act while the level-up modal is active and map to the currently displayed choices. Reroll and banish will later consume the same choice-generation seam.

If fewer viable upgrades remain than the requested choice count, render only the viable cards. The current content has enough level capacity for normal runs, so an empty pool is treated as a tested terminal condition rather than silently selecting a maxed upgrade.

### 4. Logical canvas coordinates and Retina scaling

The canvas keeps CSS dimensions equal to the viewport and uses a larger backing buffer:

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = Math.round(viewportWidth * dpr);
canvas.height = Math.round(viewportHeight * dpr);
canvas.style.width = `${viewportWidth}px`;
canvas.style.height = `${viewportHeight}px`;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

All simulation and rendering coordinates remain in logical CSS pixels. Camera centering uses the logical viewport, not `canvas.width` after scaling. A pure `getCanvasMetrics(width, height, dpr)` helper will make the relationship testable. Resize handling must update the backing buffer, preserve the player/world coordinates, and respond to both window resize and a changed device-pixel ratio. The effective DPR is capped at 2 to avoid turning a 4K mobile/desktop buffer into an unnecessary memory and fill-rate spike.

### 5. Engine and renderer boundary

The simulation owns mutable entity collections and run counters; it never calls React setters. The intended boundary is:

```ts
export interface GameSession {
  seed: number;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  xpOrbs: XpOrb[];
  particles: Particle[];
  damageNumbers: DamageNumber[];
  chests: Chest[];
  wave: WaveRuntime;
  elapsedSeconds: number;
  kills: number;
  state: GameState;
  random: RunRandom;
}

export function createGameSession(options: CreateGameSessionOptions): GameSession;
export function updateGame(session: GameSession, dt: number, input: MovementInput, viewport: Viewport): GameEvents;
export function getRenderSnapshot(session: GameSession): RenderSnapshot;
```

The neighboring contracts are intentionally small and are defined in `game/types.ts` so the renderer and UI do not recreate them:

```ts
export type GameState = 'menu' | 'character_select' | 'playing' | 'level_up' | 'paused' | 'game_over' | 'wave_intro';

export interface WaveRuntime {
  number: number;
  remainingSeconds: number;
  spawned: number;
  alive: number;
  total: number;
  queue: WaveEnemy[];
}

export interface MovementInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  joystickX: number;
  joystickY: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface CreateGameSessionOptions {
  character: number;
  seed?: number;
}

export interface GameEvents {
  levelUps: number;
  waveStarted: number | null;
  gameOver: 'victory' | 'defeat' | null;
  stateChanged: GameState | null;
  scoreChanged: boolean;
}

export interface RenderSnapshot {
  player: Player;
  enemies: readonly Enemy[];
  projectiles: readonly Projectile[];
  xpOrbs: readonly XpOrb[];
  particles: readonly Particle[];
  damageNumbers: readonly DamageNumber[];
  chests: readonly Chest[];
  camera: { x: number; y: number };
}
```

`GameEvents` reports level-up, pause, game-over, wave-start, and score updates to `App.tsx`. React state remains a throttled presentation snapshot, while the engine remains the source of truth during a frame. `renderer.ts` consumes `RenderSnapshot` and `CanvasMetrics`, which prevents DOM/UI concerns from leaking into collision code.

### 6. Spatial partitioning as a measured follow-up

After extraction, profile projectile/enemy checks with realistic enemy counts. If broad-phase work is justified, add a uniform spatial hash with a fixed cell size based on the largest collision radius. Rebuild the grid from the current enemy list each update, query neighboring cells for each projectile, then retain the exact distance test. The grid must never decide a collision by itself; it only reduces candidates. Tests will cover objects on cell boundaries, negative world coordinates, and no missed/duplicate candidates.

## Data flow

```text
keyboard/touch/pointer
          │
          ▼
      input.ts ───────► MovementInput
                              │
                              ▼
seed + config ───────► engine.updateGame(dt, input, viewport)
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
        GameEvents       GameSession      RenderSnapshot
             │                │                │
             ▼                ▼                ▼
          App.tsx       React HUD       renderer.ts → canvas
```

The upgrade modal consumes `UpgradeChoice[]` and sends a choice id back through the engine. It must not mutate the player directly from JSX.

## Testing strategy

- Keep Node's built-in test runner and add focused pure tests for seeded random sequences, shuffle composition, upgrade levels/deltas/duplicate filtering, XP and pending level-up queues, canvas metrics, wave completion, pause/game-over transitions, and persistence adapters.
- Add a test that runs the same seeded setup twice and compares gameplay-relevant snapshots while ignoring timestamps and cosmetic-only stream output.
- Preserve the existing tests for keyboard layouts, XP thresholds, spawn probability, progress clamping, and wave composition.
- Use a browser smoke pass for menu → character select → run → pause → level-up → game-over, with a narrow viewport and a high-DPI emulation check.
- Add `.github/workflows/ci.yml` after the modularization stabilizes. It will run `npm ci`, `npm test`, `npm run typecheck`, and `npm run build` on pushes and pull requests.

## Acceptance criteria

1. A level-up choice never contains the same upgrade id twice, and each card shows the exact next-level stat delta.
2. Pressing `1`, `2`, or `3` selects the corresponding visible upgrade only while the level-up screen is active; pointer selection remains equivalent.
3. A run started with the same seed produces the same gameplay-relevant random decisions under the same input sequence.
4. No gameplay module calls `Math.random()` directly.
5. The canvas remains sharp at `devicePixelRatio > 1`, while gameplay coordinates and camera behavior remain unchanged.
6. `App.tsx` is an orchestration component rather than the owner of configuration, simulation, renderer, input, and modal implementations.
7. The current 30-wave baseline, character roster, high-score key, Russian UI, pause behavior, and game-over behavior remain intact.
8. The new pure tests pass, and once dependencies are installed, typecheck, production build, and browser smoke checks pass.

## Deferred decisions

- Exact difficulty-curve coefficients and elite/boss cadence belong to the balance phase after telemetry is available.
- Reroll/banish economy and limits belong to the progression phase after the base upgrade model is stable.
- The final Russian/English copy strategy belongs to the localization phase; the first package keeps existing Russian labels and fixes only newly extracted strings.
- Whether to expose a seed input in the public menu or only through a debug query parameter should be decided after the first replay/debugging pass.
