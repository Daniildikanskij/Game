export type MovementKey = 'up' | 'down' | 'left' | 'right';

export interface KeyboardInput {
  code: string;
  key: string;
}

export interface ExperienceProgress {
  level: number;
  xp: number;
  xpToNext: number;
}

export interface ExperienceResult {
  progress: ExperienceProgress;
  levelsGained: number;
}

export interface WaveEnemy {
  type: number;
  count: number;
  isBoss?: boolean;
}

const MOVEMENT_BY_CODE: Record<string, MovementKey> = {
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right',
  ArrowUp: 'up',
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowRight: 'right',
};

const MOVEMENT_BY_KEY: Record<string, MovementKey> = {
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right',
  ц: 'up',
  ф: 'left',
  ы: 'down',
  в: 'right',
};

export function getMovementKey(event: KeyboardInput): MovementKey | null {
  return MOVEMENT_BY_CODE[event.code] ?? MOVEMENT_BY_KEY[event.key.toLowerCase()] ?? null;
}

export function addExperience(progress: ExperienceProgress, amount: number): ExperienceResult {
  const next = {
    level: progress.level,
    xp: progress.xp + Math.max(0, amount),
    xpToNext: progress.xpToNext,
  };
  let levelsGained = 0;

  while (next.xp >= next.xpToNext) {
    next.xp -= next.xpToNext;
    next.level += 1;
    next.xpToNext = Math.floor(next.xpToNext * 1.5);
    levelsGained += 1;
  }

  return { progress: next, levelsGained };
}

export function getProgressRatio(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, value / total));
}

export function spawnProbability(ratePerSecond: number, dt: number): number {
  if (ratePerSecond <= 0 || dt <= 0) return 0;
  return 1 - Math.exp(-ratePerSecond * dt);
}

export function buildWaveSpawnQueue(entries: WaveEnemy[], random: () => number = Math.random): WaveEnemy[] {
  const queue = entries.flatMap(entry => Array.from({ length: Math.max(0, entry.count) }, () => ({ ...entry, count: 1 })));

  for (let i = queue.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [queue[i], queue[randomIndex]] = [queue[randomIndex], queue[i]];
  }

  return queue;
}
