import type { Player } from './types';
import type { RandomSource } from './random';

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemDefinition {
  id: string;
  name: string;
  icon: string;
  rarity: ItemRarity;
  maxLevel: number;
  description: string;
  apply(player: Player): void;
}

export interface ItemChoice {
  definition: ItemDefinition;
  currentLevel: number;
  nextLevel: number;
}

export type OwnedItemLevels = Readonly<Record<string, number>>;

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  {
    id: 'ember_core',
    name: 'Ядро Жара',
    icon: '🔥',
    rarity: 'uncommon',
    maxLevel: 5,
    description: '+12% к урону и усиление огненных сборок',
    apply: player => { player.damage *= 1.12; },
  },
  {
    id: 'frost_lens',
    name: 'Морозная линза',
    icon: '❄️',
    rarity: 'rare',
    maxLevel: 5,
    description: '+10% к скорости снарядов и контролю',
    apply: player => { player.projectileSpeed *= 1.1; },
  },
  {
    id: 'storm_sigil',
    name: 'Печать бури',
    icon: '⚡',
    rarity: 'rare',
    maxLevel: 5,
    description: '+8% к скорости атаки и +5% к урону',
    apply: player => { player.attackSpeed *= 1.08; player.damage *= 1.05; },
  },
  {
    id: 'night_veil',
    name: 'Ночной покров',
    icon: '🌑',
    rarity: 'epic',
    maxLevel: 4,
    description: '+8% к скорости и +10% к радиусу сбора',
    apply: player => { player.speed *= 1.08; player.pickupRange *= 1.1; },
  },
  {
    id: 'arcane_prism',
    name: 'Арканный призматик',
    icon: '🔮',
    rarity: 'legendary',
    maxLevel: 3,
    description: '+12% к размеру снарядов и +1 снаряд',
    apply: player => { player.projectileSize *= 1.12; player.projectileCount += 1; },
  },
];

export function getItemChoices(
  definitions: readonly ItemDefinition[],
  ownedItems: OwnedItemLevels,
  count: number,
  random: RandomSource,
): ItemChoice[] {
  const available = definitions.flatMap(definition => {
    const currentLevel = Math.max(0, ownedItems[definition.id] ?? 0);
    if (currentLevel >= definition.maxLevel) return [];
    return [{ definition, currentLevel, nextLevel: currentLevel + 1 }];
  });

  return random.shuffle(available).slice(0, Math.max(0, count));
}

export function applyItemChoice(player: Player, ownedItems: OwnedItemLevels, choice: ItemChoice): Record<string, number> {
  choice.definition.apply(player);
  return { ...ownedItems, [choice.definition.id]: choice.nextLevel };
}
