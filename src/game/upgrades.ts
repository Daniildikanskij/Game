import type { MagicType, Player } from './types';
import type { RandomSource } from './random';

export interface UpgradeLevel {
  description: string;
  apply(player: Player): void;
}

export interface UpgradeDefinition {
  id: string;
  name: string;
  icon: string;
  maxLevel: number;
  magicType?: MagicType;
  levels: readonly UpgradeLevel[];
}

export type OwnedUpgradeLevels = Readonly<Record<string, number>>;

export interface UpgradeChoice {
  definition: UpgradeDefinition;
  currentLevel: number;
  nextLevel: number;
  description: string;
  delta: Readonly<Record<string, number>>;
}

const PREVIEW_STATS = [
  'hp',
  'maxHp',
  'speed',
  'damage',
  'attackSpeed',
  'projectileCount',
  'projectileSpeed',
  'projectileSize',
  'pickupRange',
  'armor',
] as const;

function createLevels(description: string, apply: (player: Player) => void, maxLevel: number): UpgradeLevel[] {
  return Array.from({ length: maxLevel }, () => ({ description, apply }));
}

export const UPGRADE_DEFINITIONS: readonly UpgradeDefinition[] = [
  { id: 'damage_up', name: 'Сила+', icon: '⚔️', maxLevel: 5, levels: createLevels('+20% к урону', player => { player.damage *= 1.2; }, 5) },
  { id: 'speed_up', name: 'Скорость+', icon: '💨', maxLevel: 5, levels: createLevels('+15% к скорости', player => { player.speed *= 1.15; }, 5) },
  { id: 'attack_speed', name: 'Атака+', icon: '⚡', maxLevel: 5, levels: createLevels('+20% скорость атаки', player => { player.attackSpeed *= 1.2; }, 5) },
  { id: 'fire_technique', name: 'Огненная техника', icon: '🔥', maxLevel: 4, magicType: 'fire', levels: createLevels('+25% к урону и +1 снаряд', player => { player.damage *= 1.25; player.projectileCount += 1; player.magicType = 'fire'; }, 4) },
  { id: 'ice_magic', name: 'Ледяная магия', icon: '❄️', maxLevel: 4, magicType: 'ice', levels: createLevels('+18% к скорости снарядов и +2 броне', player => { player.projectileSpeed *= 1.18; player.armor += 2; player.magicType = 'ice'; }, 4) },
  { id: 'lightning_attack', name: 'Молниеносная атака', icon: '⚡', maxLevel: 4, magicType: 'lightning', levels: createLevels('+20% скорость атаки и +15% к урону', player => { player.attackSpeed *= 1.2; player.damage *= 1.15; player.magicType = 'lightning'; }, 4) },
  { id: 'shadow_magic', name: 'Магия теней', icon: '🌑', maxLevel: 4, magicType: 'shadow', levels: createLevels('Метка Мрака: до 3 стаков и теневой взрыв', player => { player.speed *= 1.15; player.pickupRange *= 1.2; player.magicType = 'shadow'; }, 4) },
  { id: 'arcane_burst', name: 'Арканный всплеск', icon: '✨', maxLevel: 3, magicType: 'arcane', levels: createLevels('+1 снаряд и +25% размер снарядов', player => { player.projectileCount += 1; player.projectileSize *= 1.25; player.magicType = 'arcane'; }, 3) },
  { id: 'hp_up', name: 'Здоровье+', icon: '❤️', maxLevel: 5, levels: createLevels('+30 макс. HP', player => { player.maxHp += 30; player.hp += 30; }, 5) },
  { id: 'projectile_count', name: 'Снаряды+', icon: '🎯', maxLevel: 5, levels: createLevels('+1 снаряд', player => { player.projectileCount += 1; }, 5) },
  { id: 'projectile_speed', name: 'Скорость снарядов+', icon: '🚀', maxLevel: 5, levels: createLevels('+25% скорость снарядов', player => { player.projectileSpeed *= 1.25; }, 5) },
  { id: 'pickup_range', name: 'Притяжение+', icon: '🧲', maxLevel: 5, levels: createLevels('+30% радиус сбора', player => { player.pickupRange *= 1.3; }, 5) },
  { id: 'armor', name: 'Броня+', icon: '🛡️', maxLevel: 5, levels: createLevels('+2 к броне', player => { player.armor += 2; }, 5) },
  { id: 'projectile_size', name: 'Размер+', icon: '💫', maxLevel: 5, levels: createLevels('+30% размер снарядов', player => { player.projectileSize *= 1.3; }, 5) },
  { id: 'heal', name: 'Лечение', icon: '💖', maxLevel: 1, levels: createLevels('Восстановить 50% HP', player => { player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.5); }, 1) },
];

function getPreviewDelta(before: Player, after: Player): Readonly<Record<string, number>> {
  const delta: Record<string, number> = {};
  for (const stat of PREVIEW_STATS) {
    const change = after[stat] - before[stat];
    const roundedChange = Math.round((change + Number.EPSILON) * 1_000_000) / 1_000_000;
    if (roundedChange !== 0) delta[stat] = roundedChange;
  }
  return delta;
}

export function getUpgradeChoices(
  definitions: readonly UpgradeDefinition[],
  ownedLevels: OwnedUpgradeLevels,
  player: Player,
  count: number,
  random: RandomSource,
): UpgradeChoice[] {
  const viable = definitions.flatMap(definition => {
    const currentLevel = Math.max(0, ownedLevels[definition.id] ?? 0);
    const nextLevel = currentLevel + 1;
    const level = definition.levels[nextLevel - 1];
    if (nextLevel > definition.maxLevel || !level) return [];

    const before = { ...player };
    const after = { ...player };
    level.apply(after);
    return [{
      definition,
      currentLevel,
      nextLevel,
      description: level.description,
      delta: getPreviewDelta(before, after),
    }];
  });

  return random.shuffle(viable).slice(0, Math.max(0, count));
}

export function applyUpgradeChoice(player: Player, ownedLevels: OwnedUpgradeLevels, choice: UpgradeChoice): Record<string, number> {
  const level = choice.definition.levels[choice.nextLevel - 1];
  if (!level) throw new RangeError(`upgrade ${choice.definition.id} has no level ${choice.nextLevel}`);
  level.apply(player);
  if (choice.definition.magicType) {
    player.magicType = choice.definition.magicType;
    player.activeMagicTypes = Array.from(new Set([...(player.activeMagicTypes ?? []), choice.definition.magicType]));
  }
  return { ...ownedLevels, [choice.definition.id]: choice.nextLevel };
}
