export type MagicType = 'arcane' | 'fire' | 'ice' | 'lightning' | 'shadow';

export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  level: number;
  xp: number;
  xpToNext: number;
  damage: number;
  attackSpeed: number;
  attackTimer: number;
  projectileCount: number;
  projectileSpeed: number;
  projectileSize: number;
  pickupRange: number;
  armor: number;
  invincibleTimer: number;
  character: number;
  magicType: MagicType;
  activeMagicTypes?: readonly MagicType[];
}

export interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  type: number;
  size: number;
  xpValue: number;
  knockbackX: number;
  knockbackY: number;
  isBoss?: boolean;
  burnTimer: number;
  burnDamage: number;
  slowTimer: number;
  slowFactor: number;
  shockTimer: number;
  shadowTimer: number;
  shadowDamageBonus: number;
  shadowStacks: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  size: number;
  piercing: number;
  lifetime: number;
  type: number;
  magicType?: MagicType;
  magicTypes?: readonly MagicType[];
}

export interface XpOrb {
  x: number;
  y: number;
  value: number;
  size: number;
}

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  lifetime: number;
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifetime: number;
  maxLifetime: number;
  color: string;
  size: number;
}

export interface MenuParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  emoji: string;
}

export interface Chest {
  x: number;
  y: number;
  type: number;
  collected: boolean;
}

export interface WaveEnemy {
  type: number;
  count: number;
  isBoss?: boolean;
}

export interface WaveConfig {
  enemies: WaveEnemy[];
  duration: number;
}

export interface EnemyTypeDefinition {
  hp: number;
  speed: number;
  damage: number;
  size: number;
  xpValue: number;
  color: string;
  emoji: string;
}

export type ChestReward = 'heal' | 'damage' | 'speed' | 'upgrade';

export interface ChestTypeDefinition {
  emoji: string;
  color: string;
  reward: ChestReward;
}

export type GameState = 'menu' | 'character_select' | 'playing' | 'level_up' | 'game_over' | 'paused' | 'wave_intro';

export interface WaveRuntime {
  number: number;
  remainingSeconds: number;
  spawnInterval: number;
  spawnAccumulator: number;
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

export interface PlayerSnapshot {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  damage: number;
  speed: number;
  attackSpeed: number;
  projectileCount: number;
  armor: number;
  magicType: MagicType;
  activeMagicTypes: readonly MagicType[];
  ownedUpgrades: Readonly<Record<string, number>>;
}
