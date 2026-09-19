export interface RandomSource {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
}

export interface RunRandom {
  world: RandomSource;
  upgrades: RandomSource;
  effects: RandomSource;
}

export function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const seed = Math.trunc(value) >>> 0;
  return seed === 0 ? 1 : seed;
}

function mixSeed(seed: number, salt: number): number {
  return normalizeSeed((Math.imul(normalizeSeed(seed), 1664525) + salt) >>> 0);
}

export function createRandom(seed: number): RandomSource {
  let state = normalizeSeed(seed);

  const next = (): number => {
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(maxExclusive: number): number {
      if (!Number.isFinite(maxExclusive) || maxExclusive < 0) throw new RangeError('maxExclusive must be non-negative');
      if (maxExclusive === 0) return 0;
      return Math.floor(next() * Math.floor(maxExclusive));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('cannot pick from an empty collection');
      return items[Math.min(items.length - 1, Math.floor(next() * items.length))];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let index = result.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(next() * (index + 1));
        [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
      }
      return result;
    },
  };
}

export function createRunRandom(seed: number): RunRandom {
  const normalized = normalizeSeed(seed);
  return {
    world: createRandom(mixSeed(normalized, 0x13579BDF)),
    upgrades: createRandom(mixSeed(normalized, 0x2468ACE0)),
    effects: createRandom(mixSeed(normalized, 0x0F1E2D3C)),
  };
}
