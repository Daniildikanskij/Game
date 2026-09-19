import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from './random.ts';
import { applyUpgradeChoice, getUpgradeChoices, UPGRADE_DEFINITIONS } from './upgrades.ts';
import type { Player } from './types.ts';

const player: Player = {
  x: 0, y: 0, hp: 50, maxHp: 100, speed: 3, level: 1, xp: 0, xpToNext: 10,
  damage: 10, attackSpeed: 1, attackTimer: 0, projectileCount: 1,
  projectileSpeed: 7, projectileSize: 8, pickupRange: 80, armor: 0,
  invincibleTimer: 0, character: 0, magicType: 'arcane',
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
  assert.equal(new Set(ids).size, choices.length);
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

test('rounds floating-point preview noise in exact stat deltas', () => {
  const hpUpgrade = [{ id: 'health', name: 'Здоровье+', icon: '❤️', maxLevel: 1, levels: [
    { description: '+30 макс. HP', apply: (p: Player) => { p.maxHp += 30; p.hp += 30; } },
  ] }] as const;
  const damagedPlayer = { ...player, hp: 6.0000000000000036 };
  const choice = getUpgradeChoices(hpUpgrade, {}, damagedPlayer, 1, createRandom(5))[0];
  assert.equal(choice.delta.hp, 30);
});

test('includes fire, ice, and lightning themed upgrades in the roster', () => {
  const ids = UPGRADE_DEFINITIONS.map(definition => definition.id);
  assert.ok(ids.includes('fire_technique'));
  assert.ok(ids.includes('ice_magic'));
  assert.ok(ids.includes('lightning_attack'));

  const fireChoice = getUpgradeChoices(
    UPGRADE_DEFINITIONS.filter(definition => definition.id === 'fire_technique'),
    {},
    player,
    1,
    createRandom(6),
  )[0];

  assert.equal(fireChoice.definition.name, 'Огненная техника');
  assert.ok(fireChoice.delta.damage > 0 || fireChoice.delta.projectileCount > 0);
});

test('elemental upgrades assign magic types that trigger status effects', () => {
  const firePlayer = { ...player, magicType: 'arcane' as const };
  const fireChoice = getUpgradeChoices(
    UPGRADE_DEFINITIONS.filter(definition => definition.id === 'fire_technique'),
    {},
    firePlayer,
    1,
    createRandom(7),
  )[0];
  applyUpgradeChoice(firePlayer, {}, fireChoice);
  assert.equal(firePlayer.magicType, 'fire');
  assert.deepEqual(firePlayer.activeMagicTypes, ['fire']);

  const icePlayer = { ...player, magicType: 'arcane' as const };
  const iceChoice = getUpgradeChoices(
    UPGRADE_DEFINITIONS.filter(definition => definition.id === 'ice_magic'),
    {},
    icePlayer,
    1,
    createRandom(8),
  )[0];
  applyUpgradeChoice(icePlayer, {}, iceChoice);
  assert.equal(icePlayer.magicType, 'ice');

  const stackedPlayer = { ...player, magicType: 'arcane' as const, activeMagicTypes: ['fire'] as const };
  applyUpgradeChoice(stackedPlayer, {}, iceChoice);
  assert.deepEqual(stackedPlayer.activeMagicTypes, ['fire', 'ice']);

  const lightningPlayer = { ...player, magicType: 'arcane' as const };
  const lightningChoice = getUpgradeChoices(
    UPGRADE_DEFINITIONS.filter(definition => definition.id === 'lightning_attack'),
    {},
    lightningPlayer,
    1,
    createRandom(9),
  )[0];
  applyUpgradeChoice(lightningPlayer, {}, lightningChoice);
  assert.equal(lightningPlayer.magicType, 'lightning');
});
