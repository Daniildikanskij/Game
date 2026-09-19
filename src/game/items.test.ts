import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from './random.ts';
import { applyItemChoice, getItemChoices, ITEM_DEFINITIONS } from './items.ts';
import type { Player } from './types.ts';

const player: Player = {
  x: 0, y: 0, hp: 100, maxHp: 100, speed: 3.3, level: 1, xp: 0, xpToNext: 10,
  damage: 10, attackSpeed: 1, attackTimer: 0, projectileCount: 1,
  projectileSpeed: 7, projectileSize: 8, pickupRange: 80, armor: 0,
  invincibleTimer: 0, character: 0, magicType: 'arcane',
};

test('item choices exclude maxed items and never duplicate definitions', () => {
  const choices = getItemChoices(ITEM_DEFINITIONS, { ember_core: 5 }, 3, createRandom(21));

  assert.equal(choices.length, 3);
  assert.ok(choices.every(choice => choice.definition.id !== 'ember_core'));
  assert.equal(new Set(choices.map(choice => choice.definition.id)).size, choices.length);
});

test('applying an item increases its inventory level and player stats', () => {
  const choice = getItemChoices(ITEM_DEFINITIONS, {}, 1, createRandom(22))[0];
  const beforeDamage = player.damage;
  const owned = applyItemChoice(player, {}, choice);

  assert.equal(owned[choice.definition.id], 1);
  assert.ok(player.damage !== beforeDamage || player.attackSpeed !== 1 || player.projectileSpeed !== 7 || player.speed !== 3.3 || player.projectileSize !== 8);
});