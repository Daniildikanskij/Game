import type { ChestTypeDefinition, EnemyTypeDefinition, WaveConfig } from './types';

export const CHARACTERS = [
  { name: 'Сакура', emoji: '🌸', color: '#ff69b4', gradient: 'from-pink-500 to-rose-600', desc: 'Быстрая атака, средний урон', stats: '⚡ ATK SPD ↑' },
  { name: 'Юки', emoji: '❄️', color: '#87ceeb', gradient: 'from-cyan-400 to-blue-600', desc: 'Замораживающие снаряды', stats: '🎯 PRECISION ↑' },
  { name: 'Хина', emoji: '🔥', color: '#ff4500', gradient: 'from-orange-500 to-red-600', desc: 'Высокий урон, медленная атака', stats: '💥 DMG ↑' },
  { name: 'Мико', emoji: '⚡', color: '#ffd700', gradient: 'from-yellow-400 to-amber-600', desc: 'Много снарядов, низкий урон', stats: '🌟 MULTI ↑' },
] as const;

export const GAME_STATE = {
  MENU: 'menu',
  CHARACTER_SELECT: 'character_select',
  PLAYING: 'playing',
  LEVEL_UP: 'level_up',
  GAME_OVER: 'game_over',
  PAUSED: 'paused',
  WAVE_INTRO: 'wave_intro',
} as const;

export const WAVE_CONFIGS: WaveConfig[] = [
  { enemies: [{ type: 0, count: 5 }], duration: 20 },
  { enemies: [{ type: 0, count: 8 }, { type: 2, count: 3 }], duration: 20 },
  { enemies: [{ type: 0, count: 10 }, { type: 2, count: 5 }], duration: 20 },
  { enemies: [{ type: 1, count: 5 }, { type: 2, count: 8 }], duration: 20 },
  { enemies: [{ type: 0, count: 12 }, { type: 1, count: 8 }, { type: 2, count: 5 }], duration: 20 },
  { enemies: [{ type: 1, count: 10 }, { type: 2, count: 10 }], duration: 20 },
  { enemies: [{ type: 0, count: 15 }, { type: 1, count: 10 }, { type: 2, count: 8 }], duration: 20 },
  { enemies: [{ type: 1, count: 12 }, { type: 2, count: 12 }, { type: 3, count: 2 }], duration: 20 },
  { enemies: [{ type: 0, count: 18 }, { type: 1, count: 12 }, { type: 2, count: 10 }, { type: 3, count: 3 }], duration: 20 },
  { enemies: [{ type: 1, count: 15 }, { type: 2, count: 15 }, { type: 3, count: 5 }], duration: 20 },
  { enemies: [{ type: 0, count: 20 }, { type: 1, count: 15 }, { type: 2, count: 12 }, { type: 3, count: 5 }], duration: 20 },
  { enemies: [{ type: 1, count: 18 }, { type: 2, count: 18 }, { type: 3, count: 8 }], duration: 20 },
  { enemies: [{ type: 0, count: 25 }, { type: 1, count: 18 }, { type: 2, count: 15 }, { type: 3, count: 8 }], duration: 20 },
  { enemies: [{ type: 1, count: 20 }, { type: 2, count: 20 }, { type: 3, count: 10 }], duration: 20 },
  { enemies: [{ type: 0, count: 30 }, { type: 1, count: 20 }, { type: 2, count: 18 }, { type: 3, count: 10 }], duration: 20 },
  { enemies: [{ type: 1, count: 25 }, { type: 2, count: 22 }, { type: 3, count: 12 }], duration: 20 },
  { enemies: [{ type: 0, count: 35 }, { type: 1, count: 25 }, { type: 2, count: 20 }, { type: 3, count: 12 }], duration: 20 },
  { enemies: [{ type: 1, count: 28 }, { type: 2, count: 25 }, { type: 3, count: 15 }], duration: 20 },
  { enemies: [{ type: 0, count: 40 }, { type: 1, count: 28 }, { type: 2, count: 22 }, { type: 3, count: 15 }], duration: 20 },
  { enemies: [{ type: 1, count: 30 }, { type: 2, count: 28 }, { type: 3, count: 18 }], duration: 20 },
  { enemies: [{ type: 0, count: 45 }, { type: 1, count: 30 }, { type: 2, count: 25 }, { type: 3, count: 18 }], duration: 20 },
  { enemies: [{ type: 1, count: 32 }, { type: 2, count: 30 }, { type: 3, count: 20 }], duration: 20 },
  { enemies: [{ type: 0, count: 50 }, { type: 1, count: 32 }, { type: 2, count: 28 }, { type: 3, count: 20 }], duration: 20 },
  { enemies: [{ type: 1, count: 35 }, { type: 2, count: 32 }, { type: 3, count: 22 }], duration: 20 },
  { enemies: [{ type: 0, count: 55 }, { type: 1, count: 35 }, { type: 2, count: 30 }, { type: 3, count: 22 }], duration: 20 },
  { enemies: [{ type: 1, count: 38 }, { type: 2, count: 35 }, { type: 3, count: 25 }], duration: 20 },
  { enemies: [{ type: 0, count: 60 }, { type: 1, count: 38 }, { type: 2, count: 32 }, { type: 3, count: 25 }], duration: 20 },
  { enemies: [{ type: 1, count: 40 }, { type: 2, count: 38 }, { type: 3, count: 28 }], duration: 20 },
  { enemies: [{ type: 0, count: 65 }, { type: 1, count: 40 }, { type: 2, count: 35 }, { type: 3, count: 28 }], duration: 20 },
  { enemies: [{ type: 3, count: 1, isBoss: true }], duration: 60 },
];

export const MAX_WAVES = 30;

export const ENEMY_TYPES = [
  { hp: 20, speed: 1.5, damage: 8, size: 18, xpValue: 3, color: '#8b0000', emoji: '👹' },
  { hp: 40, speed: 1, damage: 12, size: 24, xpValue: 5, color: '#4a0080', emoji: '👻' },
  { hp: 15, speed: 2.5, damage: 5, size: 14, xpValue: 2, color: '#006400', emoji: '🐛' },
  { hp: 80, speed: 0.7, damage: 20, size: 32, xpValue: 10, color: '#8b4513', emoji: '👾' },
] as const satisfies readonly EnemyTypeDefinition[];

export const CHEST_TYPES = [
  { emoji: '📦', color: '#8b4513', reward: 'heal' },
  { emoji: '🎁', color: '#ff69b4', reward: 'damage' },
  { emoji: '💎', color: '#00ffff', reward: 'speed' },
  { emoji: '👑', color: '#ffd700', reward: 'upgrade' },
] as const satisfies readonly ChestTypeDefinition[];

export const HIGH_SCORE_STORAGE_KEY = 'anime-survivors-high-score';
