import { addExperience, buildWaveSpawnQueue, getWaveEnemyMultiplier, getWaveSpawnInterval } from '../gameLogic.ts';
import {
  CHARACTERS,
  CHEST_TYPES,
  ENEMY_TYPES,
  GAME_STATE,
  MAP_BOUNDS,
  PLAYER_BASE_SPEED,
  PROJECTILE_LIFETIME,
  MAX_WAVES,
  WAVE_CONFIGS,
} from './config.ts';
import { createRunRandom, normalizeSeed, type RunRandom } from './random.ts';
import {
  applyUpgradeChoice,
  getUpgradeChoices,
  UPGRADE_DEFINITIONS,
  type OwnedUpgradeLevels,
  type UpgradeChoice,
} from './upgrades.ts';
import {
  applyItemChoice,
  getItemChoices,
  ITEM_DEFINITIONS,
  type ItemChoice,
} from './items.ts';
import type {
  Chest,
  DamageNumber,
  Enemy,
  GameState,
  MagicType,
  MovementInput,
  Particle,
  Player,
  Projectile,
  Viewport,
  WaveRuntime,
  XpOrb,
} from './types';

export type RunResult = 'victory' | 'defeat';

export interface GameEvents {
  levelUps: number;
  waveStarted: number | null;
  gameOver: RunResult | null;
  stateChanged: GameState | null;
  scoreChanged: boolean;
  upgradeChoices: UpgradeChoice[];
  itemChoices: ItemChoice[];
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

export interface GameSession {
  seed: number;
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  xpOrbs: XpOrb[];
  particles: Particle[];
  damageNumbers: DamageNumber[];
  chests: Chest[];
  camera: { x: number; y: number };
  wave: WaveRuntime;
  elapsedSeconds: number;
  kills: number;
  state: GameState;
  result: RunResult | null;
  random: RunRandom;
  ownedUpgrades: Record<string, number>;
  ownedItems: Record<string, number>;
  pendingLevelUps: number;
  upgradeChoices: UpgradeChoice[];
  itemChoices: ItemChoice[];
}

function createEvents(): GameEvents {
  return {
    levelUps: 0,
    waveStarted: null,
    gameOver: null,
    stateChanged: null,
    scoreChanged: false,
    upgradeChoices: [],
    itemChoices: [],
  };
}

function generateSeed(): number {
  const cryptoSource = globalThis.crypto;
  if (cryptoSource) {
    const values = new Uint32Array(1);
    cryptoSource.getRandomValues(values);
    return normalizeSeed(values[0]);
  }
  return normalizeSeed(Date.now());
}

function getQuerySeed(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const rawSeed = new URLSearchParams(window.location.search).get('seed');
  if (rawSeed === null) return undefined;
  const seed = Number(rawSeed);
  return Number.isInteger(seed) && seed >= 0 && seed <= 0xFFFFFFFF ? seed : undefined;
}

function createPlayer(character: number): Player {
  const player: Player = {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    speed: PLAYER_BASE_SPEED,
    level: 1,
    xp: 0,
    xpToNext: 10,
    damage: 10,
    attackSpeed: 1,
    attackTimer: 0,
    projectileCount: 1,
    projectileSpeed: 7,
    projectileSize: 8,
    pickupRange: 80,
    armor: 0,
    invincibleTimer: 0,
    character,
    magicType: 'arcane',
    activeMagicTypes: ['arcane'],
  };

  switch (character) {
    case 0:
      player.attackSpeed = 1.3;
      break;
    case 1:
      player.projectileSpeed = 6;
      player.damage = 12;
      break;
    case 2:
      player.damage = 18;
      player.attackSpeed = 0.7;
      break;
    case 3:
      player.projectileCount = 3;
      player.damage = 6;
      break;
  }

  return player;
}

function spawnChest(session: GameSession): void {
  const chestCount = session.random.world.int(2) + 1;
  for (let index = 0; index < chestCount; index += 1) {
    const angle = session.random.world.next() * Math.PI * 2;
    const distance = 300 + session.random.world.next() * 400;
    session.chests.push({
      x: session.player.x + Math.cos(angle) * distance,
      y: session.player.y + Math.sin(angle) * distance,
      type: session.random.world.int(CHEST_TYPES.length),
      collected: false,
    });
  }
}

function startWave(session: GameSession, waveNumber: number): boolean {
  const wave = WAVE_CONFIGS[waveNumber - 1];
  if (!wave) return false;

  const enemyMultiplier = getWaveEnemyMultiplier(waveNumber);
  const scaledEntries = wave.enemies.map(entry => ({
    ...entry,
    count: entry.isBoss ? entry.count : entry.count * enemyMultiplier,
  }));
  const queue = buildWaveSpawnQueue(scaledEntries, session.random.world.next);
  session.wave = {
    number: waveNumber,
    remainingSeconds: wave.duration,
    spawnInterval: getWaveSpawnInterval(queue.length, wave.duration),
    spawnAccumulator: 0,
    spawned: 0,
    alive: 0,
    total: queue.length,
    queue,
  };
  spawnChest(session);
  return true;
}

export function createGameSession(options: { character: number; seed?: number }): GameSession {
  const seed = normalizeSeed(options.seed ?? getQuerySeed() ?? generateSeed());
  const session: GameSession = {
    seed,
    player: createPlayer(options.character),
    enemies: [],
    projectiles: [],
    xpOrbs: [],
    particles: [],
    damageNumbers: [],
    chests: [],
    camera: { x: 0, y: 0 },
      wave: { number: 1, remainingSeconds: 0, spawnInterval: Number.POSITIVE_INFINITY, spawnAccumulator: 0, spawned: 0, alive: 0, total: 0, queue: [] },
    elapsedSeconds: 0,
    kills: 0,
    state: GAME_STATE.PLAYING,
    result: null,
    random: createRunRandom(seed),
    ownedUpgrades: {},
    ownedItems: {},
    pendingLevelUps: 0,
    upgradeChoices: [],
    itemChoices: [],
  };

  startWave(session, 1);
  return session;
}

export function getEnemySpawnPosition(
  playerX: number,
  playerY: number,
  viewport: Viewport,
  random: () => number,
): { x: number; y: number } {
  const margin = 100;
  const halfWidth = viewport.width / 2 + margin;
  const halfHeight = viewport.height / 2 + margin;
  const distance = Math.max(halfWidth, halfHeight) + 80 + random() * 160;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const angle = random() * Math.PI * 2;
    const x = playerX + Math.cos(angle) * distance;
    const y = playerY + Math.sin(angle) * distance;
    const outsideViewport = Math.abs(x - playerX) > halfWidth || Math.abs(y - playerY) > halfHeight;
    if (outsideViewport && x >= MAP_BOUNDS.minX && x <= MAP_BOUNDS.maxX && y >= MAP_BOUNDS.minY && y <= MAP_BOUNDS.maxY) {
      return { x, y };
    }
  }

  const directions = [
    { x: playerX - halfWidth - 20, y: playerY },
    { x: playerX + halfWidth + 20, y: playerY },
    { x: playerX, y: playerY - halfHeight - 20 },
    { x: playerX, y: playerY + halfHeight + 20 },
  ];
  const fallback = directions.find(position => position.x >= MAP_BOUNDS.minX && position.x <= MAP_BOUNDS.maxX && position.y >= MAP_BOUNDS.minY && position.y <= MAP_BOUNDS.maxY);
  if (fallback) return fallback;

  return {
    x: Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, playerX)),
    y: Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, playerY)),
  };
}

function clampCameraAxis(playerPosition: number, viewportSize: number, min: number, max: number): number {
  const maxCamera = Math.max(min, max - viewportSize);
  return Math.max(min, Math.min(maxCamera, playerPosition - viewportSize / 2));
}

export function getAimedTargets(player: Pick<Player, 'x' | 'y'>, enemies: readonly Enemy[], projectileCount: number): Enemy[] {
  const sorted = enemies
    .filter(enemy => enemy.hp > 0)
    .sort((first, second) => ((first.x - player.x) ** 2 + (first.y - player.y) ** 2) - ((second.x - player.x) ** 2 + (second.y - player.y) ** 2));
  if (sorted.length === 0 || projectileCount <= 0) return [];

  return Array.from({ length: projectileCount }, (_, index) => sorted[Math.min(index, sorted.length - 1)]);
}

function spawnEnemy(session: GameSession, type: number, viewport: Viewport, isBoss = false): void {
  const definition = ENEMY_TYPES[type];
  const waveMultiplier = 1 + (session.wave.number - 1) * 0.15;
  const player = session.player;
  const position = getEnemySpawnPosition(player.x, player.y, viewport, session.random.world.next);
  const hp = definition.hp * waveMultiplier * (isBoss ? 10 : 1);

  session.enemies.push({
    x: position.x,
    y: position.y,
    hp,
    maxHp: hp,
    speed: definition.speed * (isBoss ? 0.5 : 1),
    damage: definition.damage * waveMultiplier * (isBoss ? 2 : 1),
    type,
    size: definition.size * (isBoss ? 3 : 1),
    xpValue: definition.xpValue * (isBoss ? 50 : 1),
    knockbackX: 0,
    knockbackY: 0,
    isBoss,
    burnTimer: 0,
    burnDamage: 0,
    slowTimer: 0,
    slowFactor: 1,
    shockTimer: 0,
    shadowTimer: 0,
    shadowDamageBonus: 1,
    shadowStacks: 0,
  });
}

function addParticles(session: GameSession, x: number, y: number, count: number, color: string, speed: number, size: number, lifetime: number): void {
  for (let index = 0; index < count; index += 1) {
    session.particles.push({
      x,
      y,
      vx: (session.random.effects.next() - 0.5) * speed,
      vy: (session.random.effects.next() - 0.5) * speed,
      lifetime,
      maxLifetime: lifetime,
      color,
      size: size + session.random.effects.next() * size,
    });
  }
}

export function applyMagicEffect(enemy: Enemy, magicType: MagicType, power: number): void {
  switch (magicType) {
    case 'fire':
      enemy.burnTimer = Math.max(enemy.burnTimer, 2.5);
      enemy.burnDamage = Math.max(enemy.burnDamage, power * 0.45);
      break;
    case 'ice':
      enemy.slowTimer = Math.max(enemy.slowTimer, 2.1);
      enemy.slowFactor = Math.min(enemy.slowFactor, 0.65);
      break;
    case 'lightning':
      enemy.shockTimer = Math.max(enemy.shockTimer, 1.1);
      break;
    case 'shadow':
      enemy.shadowTimer = Math.max(enemy.shadowTimer, 3.5);
      enemy.shadowStacks = Math.min(3, enemy.shadowStacks + 1);
      enemy.shadowDamageBonus = 1 + enemy.shadowStacks * 0.1;
      break;
    default:
      break;
  }
}

export function applyMagicEffects(enemy: Enemy, magicTypes: readonly MagicType[], power: number): void {
  for (const magicType of magicTypes) applyMagicEffect(enemy, magicType, power);
}

function openUpgradeChoices(session: GameSession, count: number, events: GameEvents): void {
  session.itemChoices = [];
  session.upgradeChoices = getUpgradeChoices(
    UPGRADE_DEFINITIONS,
    session.ownedUpgrades,
    session.player,
    count,
    session.random.upgrades,
  );
  if (session.upgradeChoices.length === 0) {
    session.pendingLevelUps = Math.max(0, session.pendingLevelUps - 1);
    if (session.pendingLevelUps > 0) {
      openUpgradeChoices(session, count, events);
    } else {
      session.state = GAME_STATE.PLAYING;
      events.stateChanged = GAME_STATE.PLAYING;
    }
    return;
  }
  session.state = GAME_STATE.LEVEL_UP;
  events.stateChanged = GAME_STATE.LEVEL_UP;
  events.upgradeChoices = session.upgradeChoices;
}

function openItemChoices(session: GameSession, events: GameEvents): void {
  session.upgradeChoices = [];
  session.itemChoices = getItemChoices(ITEM_DEFINITIONS, session.ownedItems, 3, session.random.upgrades);
  if (session.itemChoices.length === 0) {
    session.state = GAME_STATE.PLAYING;
    events.stateChanged = GAME_STATE.PLAYING;
    return;
  }
  session.state = GAME_STATE.LEVEL_UP;
  events.stateChanged = GAME_STATE.LEVEL_UP;
  events.itemChoices = session.itemChoices;
}

function spawnNextWaveEnemy(session: GameSession, viewport: Viewport): void {
  const enemyConfig = session.wave.queue[session.wave.spawned];
  if (!enemyConfig) return;
  spawnEnemy(session, enemyConfig.type, viewport, enemyConfig.isBoss ?? false);
  session.wave.spawned += 1;
  session.wave.alive += 1;
}

export function pauseSession(session: GameSession): void {
  if (session.state === GAME_STATE.PLAYING) session.state = GAME_STATE.PAUSED;
}

export function resumeSession(session: GameSession): void {
  if (session.state === GAME_STATE.PAUSED) session.state = GAME_STATE.PLAYING;
}

export function finishSession(session: GameSession, result: RunResult): void {
  if (session.state === GAME_STATE.GAME_OVER) return;
  session.state = GAME_STATE.GAME_OVER;
  session.result = result;
}

export function selectUpgrade(session: GameSession, upgradeId: string): GameEvents {
  const events = createEvents();
  if (session.state !== GAME_STATE.LEVEL_UP) return events;
  const choice = session.upgradeChoices.find(item => item.definition.id === upgradeId);
  if (!choice) return events;

  session.ownedUpgrades = applyUpgradeChoice(session.player, session.ownedUpgrades, choice);
  session.pendingLevelUps = Math.max(0, session.pendingLevelUps - 1);
  if (session.pendingLevelUps > 0) {
    openUpgradeChoices(session, 3, events);
  } else {
    session.upgradeChoices = [];
    session.state = GAME_STATE.PLAYING;
    events.stateChanged = GAME_STATE.PLAYING;
  }
  return events;
}

export function selectItem(session: GameSession, itemId: string): GameEvents {
  const events = createEvents();
  if (session.state !== GAME_STATE.LEVEL_UP) return events;
  const choice = session.itemChoices.find(item => item.definition.id === itemId);
  if (!choice) return events;

  session.ownedItems = applyItemChoice(session.player, session.ownedItems, choice);
  session.itemChoices = [];
  session.state = GAME_STATE.PLAYING;
  events.stateChanged = GAME_STATE.PLAYING;
  return events;
}

export function updateGame(session: GameSession, dt: number, input: MovementInput, viewport: Viewport): GameEvents {
  const events = createEvents();
  if (session.state !== GAME_STATE.PLAYING) return events;

  const player = session.player;
  session.elapsedSeconds += dt;

  let dx = 0;
  let dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.joystickX !== 0 || input.joystickY !== 0) {
    dx += input.joystickX;
    dy += input.joystickY;
  }
  if (dx !== 0 || dy !== 0) {
    const length = Math.sqrt(dx * dx + dy * dy);
    dx /= length;
    dy /= length;
    player.x += dx * player.speed * 60 * dt;
    player.y += dy * player.speed * 60 * dt;
    player.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, player.x));
    player.y = Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, player.y));
  }

  session.camera.x = clampCameraAxis(player.x, viewport.width, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
  session.camera.y = clampCameraAxis(player.y, viewport.height, MAP_BOUNDS.minY, MAP_BOUNDS.maxY);
  if (player.invincibleTimer > 0) player.invincibleTimer -= dt;

  player.attackTimer -= dt;
  if (player.attackTimer <= 0) {
    player.attackTimer = 1 / player.attackSpeed;
    const targets = getAimedTargets(player, session.enemies, player.projectileCount);
    for (let index = 0; index < player.projectileCount; index += 1) {
      const target = targets[index];
      if (!target) break;
      const angle = Math.atan2(target.y - player.y, target.x - player.x);
      session.projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * player.projectileSpeed,
        vy: Math.sin(angle) * player.projectileSpeed,
        damage: player.damage,
        size: player.projectileSize,
        piercing: 1,
        lifetime: PROJECTILE_LIFETIME,
        type: player.character,
        magicType: player.magicType,
        magicTypes: player.activeMagicTypes ?? [player.magicType],
      });
    }
  }

  session.projectiles = session.projectiles.filter(projectile => {
    projectile.x += projectile.vx * 60 * dt;
    projectile.y += projectile.vy * 60 * dt;
    projectile.lifetime -= dt;
    if (projectile.lifetime <= 0) return false;
    for (const enemy of session.enemies) {
      const distance = Math.sqrt((projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2);
      if (distance < projectile.size + enemy.size) {
        const magicTypes = projectile.magicTypes ?? [projectile.magicType ?? player.magicType];
        const shadowMarkedBeforeHit = enemy.shadowTimer > 0;
        const damage = projectile.damage * (enemy.shadowTimer > 0 ? enemy.shadowDamageBonus : 1);
        enemy.hp -= damage;
        enemy.knockbackX += projectile.vx * 0.3;
        enemy.knockbackY += projectile.vy * 0.3;
        applyMagicEffects(enemy, magicTypes, projectile.damage);
        if (magicTypes.includes('shadow') && shadowMarkedBeforeHit) {
          enemy.hp -= projectile.damage * 0.35 * enemy.shadowStacks;
          addParticles(session, enemy.x, enemy.y, 7, '#8b5cf6', 5, 4, 0.45);
        }
        session.damageNumbers.push({ x: enemy.x, y: enemy.y - enemy.size, value: Math.round(damage), lifetime: 0.8, color: CHARACTERS[player.character].color });
        addParticles(session, enemy.x, enemy.y, 3, CHARACTERS[player.character].color, 4, 3, 0.5);
        if (magicTypes.includes('lightning')) {
          const nearby = session.enemies.filter(other => other !== enemy && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 120);
          for (const chainTarget of nearby) {
            chainTarget.hp -= projectile.damage * 0.55;
            chainTarget.shockTimer = Math.max(chainTarget.shockTimer, 1.2);
            addParticles(session, chainTarget.x, chainTarget.y, 5, '#a78bfa', 5, 3, 0.5);
          }
        }
        projectile.piercing -= 1;
        if (projectile.piercing <= 0) return false;
      }
    }
    return true;
  });

  session.enemies = session.enemies.filter(enemy => {
    const slowMultiplier = enemy.slowTimer > 0 ? enemy.slowFactor : 1;
    const shockMultiplier = enemy.shockTimer > 0 ? 0.82 : 1;
    const moveSpeed = enemy.speed * slowMultiplier * shockMultiplier;
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * moveSpeed * 60 * dt + enemy.knockbackX;
    enemy.y += Math.sin(angle) * moveSpeed * 60 * dt + enemy.knockbackY;
    enemy.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, enemy.x));
    enemy.y = Math.max(MAP_BOUNDS.minY, Math.min(MAP_BOUNDS.maxY, enemy.y));
    enemy.knockbackX *= 0.9;
    enemy.knockbackY *= 0.9;
    if (enemy.burnTimer > 0) {
      enemy.hp -= enemy.burnDamage * dt;
      enemy.burnTimer -= dt;
      addParticles(session, enemy.x, enemy.y, 1, '#ff7a18', 2, 2.5, 0.35);
    }
    if (enemy.slowTimer > 0) enemy.slowTimer -= dt;
    if (enemy.shockTimer > 0) {
      enemy.shockTimer -= dt;
      enemy.hp -= 0.8 * dt;
      addParticles(session, enemy.x, enemy.y, 1, '#c4b5fd', 2, 2.5, 0.25);
    }
    if (enemy.shadowTimer > 0) {
      enemy.shadowTimer -= dt;
      if (enemy.shadowTimer <= 0) {
        enemy.shadowStacks = 0;
        enemy.shadowDamageBonus = 1;
      }
    }
    if (enemy.hp <= 0) {
      session.kills += 1;
      session.wave.alive = Math.max(0, session.wave.alive - 1);
      session.xpOrbs.push({ x: enemy.x, y: enemy.y, value: enemy.xpValue, size: 6 + enemy.xpValue });
      addParticles(session, enemy.x, enemy.y, 8, ENEMY_TYPES[enemy.type].color, 6, 4, 0.6);
      return false;
    }

    const distance = Math.sqrt((player.x - enemy.x) ** 2 + (player.y - enemy.y) ** 2);
    if (distance < enemy.size + 20 && player.invincibleTimer <= 0) {
      const damage = Math.max(1, enemy.damage - player.armor);
      player.hp -= damage;
      player.invincibleTimer = 0.5;
      session.damageNumbers.push({ x: player.x, y: player.y - 30, value: Math.round(damage), lifetime: 1, color: '#ff0000' });
      if (player.hp <= 0) {
        finishSession(session, 'defeat');
        events.gameOver = 'defeat';
        events.stateChanged = GAME_STATE.GAME_OVER;
        events.scoreChanged = true;
      }
    }
    return true;
  });

  session.chests = session.chests.filter(chest => {
    if (chest.collected) return false;
    const distance = Math.sqrt((player.x - chest.x) ** 2 + (player.y - chest.y) ** 2);
    if (distance >= 40) return true;

    chest.collected = true;
    const chestType = CHEST_TYPES[chest.type];
    switch (chestType.reward) {
      case 'heal':
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.3);
        break;
      case 'damage':
        player.damage *= 1.15;
        break;
      case 'speed':
        player.speed *= 1.1;
        break;
      case 'upgrade':
        session.pendingLevelUps += 1;
        openUpgradeChoices(session, 1, events);
        break;
      case 'item':
        openItemChoices(session, events);
        break;
    }
    addParticles(session, chest.x, chest.y, 12, chestType.color, 8, 5, 0.8);
    return false;
  });

  session.xpOrbs = session.xpOrbs.filter(orb => {
    const distance = Math.sqrt((player.x - orb.x) ** 2 + (player.y - orb.y) ** 2);
    if (distance < player.pickupRange) {
      const angle = Math.atan2(player.y - orb.y, player.x - orb.x);
      const pullSpeed = 8 * (1 - distance / player.pickupRange) + 3;
      orb.x += Math.cos(angle) * pullSpeed * 60 * dt;
      orb.y += Math.sin(angle) * pullSpeed * 60 * dt;
    }
    if (distance >= 25) return true;

    const experience = addExperience({ level: player.level, xp: player.xp, xpToNext: player.xpToNext }, orb.value);
    player.level = experience.progress.level;
    player.xp = experience.progress.xp;
    player.xpToNext = experience.progress.xpToNext;
    if (experience.levelsGained > 0) {
      session.pendingLevelUps += experience.levelsGained;
      events.levelUps += experience.levelsGained;
      if (session.state === GAME_STATE.PLAYING) openUpgradeChoices(session, 3, events);
    }
    return false;
  });

  session.damageNumbers = session.damageNumbers.filter(number => {
    number.y -= 40 * dt;
    number.lifetime -= dt;
    return number.lifetime > 0;
  });
  session.particles = session.particles.filter(particle => {
    particle.x += particle.vx * 60 * dt;
    particle.y += particle.vy * 60 * dt;
    particle.lifetime -= dt;
    return particle.lifetime > 0;
  });

  session.wave.remainingSeconds -= dt;
  if (session.wave.spawned < session.wave.total) {
    const interval = session.wave.spawnInterval;
    session.wave.spawnAccumulator += dt;
    const burstLimit = session.wave.remainingSeconds < interval * 3 ? 3 : 2;
    let spawnedThisFrame = 0;
    while (session.wave.spawnAccumulator >= interval && spawnedThisFrame < burstLimit && session.wave.spawned < session.wave.total) {
      session.wave.spawnAccumulator -= interval;
      spawnNextWaveEnemy(session, viewport);
      spawnedThisFrame += 1;
    }
    if (session.wave.remainingSeconds <= 0) {
      while (session.wave.spawned < session.wave.total && spawnedThisFrame < 3) {
        spawnNextWaveEnemy(session, viewport);
        spawnedThisFrame += 1;
      }
      session.wave.spawnAccumulator = 0;
    }
  } else if (session.wave.remainingSeconds <= 0 && session.wave.alive <= 0) {
    if (session.wave.number < MAX_WAVES) {
      const nextWave = session.wave.number + 1;
      startWave(session, nextWave);
      events.waveStarted = nextWave;
    } else {
      finishSession(session, 'victory');
      events.gameOver = 'victory';
      events.stateChanged = GAME_STATE.GAME_OVER;
      events.scoreChanged = true;
    }
  }

  return events;
}

export function getRenderSnapshot(session: GameSession): RenderSnapshot {
  return {
    player: session.player,
    enemies: session.enemies,
    projectiles: session.projectiles,
    xpOrbs: session.xpOrbs,
    particles: session.particles,
    damageNumbers: session.damageNumbers,
    chests: session.chests,
    camera: { ...session.camera },
  };
}

export function getOwnedUpgradeLevels(session: GameSession): OwnedUpgradeLevels {
  return session.ownedUpgrades;
}
