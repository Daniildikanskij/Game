import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMagicEffects,
  createGameSession,
  finishSession,
  getAimedTargets,
  getEnemySpawnPosition,
  pauseSession,
  resumeSession,
  selectUpgrade,
  updateGame,
} from './engine.ts';
import { UPGRADE_DEFINITIONS } from './upgrades.ts';
import type { Enemy } from './types.ts';
import { MAP_BOUNDS } from './config.ts';

const neutralInput = { up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0 };
const viewport = { width: 800, height: 600 };

test('aim selects living nearest targets and does not spread shots away from a lone target', () => {
  const player = { x: 0, y: 0 };
  const nearEnemy = { x: 100, y: 0, hp: 10 } as Enemy;
  const farEnemy = { x: 200, y: 0, hp: 10 } as Enemy;
  const deadEnemy = { x: 10, y: 0, hp: 0 } as Enemy;

  assert.deepEqual(getAimedTargets(player, [farEnemy, deadEnemy, nearEnemy], 3), [nearEnemy, farEnemy, farEnemy]);
  assert.deepEqual(getAimedTargets(player, [nearEnemy], 3), [nearEnemy, nearEnemy, nearEnemy]);
});

test('enemy spawn positions stay outside the viewport and inside the map', () => {
  const position = getEnemySpawnPosition(0, 0, viewport, () => 0.5);

  assert.ok(Math.abs(position.x) > viewport.width / 2 + 100 || Math.abs(position.y) > viewport.height / 2 + 100);
  assert.ok(position.x >= MAP_BOUNDS.minX && position.x <= MAP_BOUNDS.maxX);
  assert.ok(position.y >= MAP_BOUNDS.minY && position.y <= MAP_BOUNDS.maxY);
});

test('camera stays inside the finite map when player reaches its edge', () => {
  const session = createGameSession({ character: 0, seed: 5 });
  session.player.x = MAP_BOUNDS.maxX;
  session.player.y = MAP_BOUNDS.minY;
  updateGame(session, 0, neutralInput, viewport);

  assert.equal(session.camera.x, 1600);
  assert.equal(session.camera.y, MAP_BOUNDS.minY);
});

test('one hit can stack multiple elemental statuses', () => {
  const enemy: Enemy = {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    speed: 2,
    damage: 5,
    type: 0,
    size: 20,
    xpValue: 1,
    knockbackX: 0,
    knockbackY: 0,
    burnTimer: 0,
    burnDamage: 0,
    slowTimer: 0,
    slowFactor: 1,
    shockTimer: 0,
    shadowTimer: 0,
    shadowDamageBonus: 1,
    shadowStacks: 0,
  };

  applyMagicEffects(enemy, ['fire', 'ice'], 10);

  assert.equal(enemy.burnTimer, 2.5);
  assert.equal(enemy.burnDamage, 4.5);
  assert.equal(enemy.slowTimer, 2.1);
  assert.equal(enemy.slowFactor, 0.65);
});

test('shadow magic builds a mark up to three stacks', () => {
  const enemy: Enemy = {
    x: 0, y: 0, hp: 100, maxHp: 100, speed: 2, damage: 5, type: 0, size: 20, xpValue: 1,
    knockbackX: 0, knockbackY: 0, burnTimer: 0, burnDamage: 0, slowTimer: 0, slowFactor: 1,
    shockTimer: 0, shadowTimer: 0, shadowDamageBonus: 1, shadowStacks: 0,
  };

  applyMagicEffects(enemy, ['shadow'], 10);
  applyMagicEffects(enemy, ['shadow'], 10);
  applyMagicEffects(enemy, ['shadow'], 10);

  assert.equal(enemy.shadowTimer, 3.5);
  assert.equal(enemy.shadowStacks, 3);
  assert.equal(enemy.shadowDamageBonus, 1.3);
});

test('same seed creates the same first wave and chest placement', () => {
  const first = createGameSession({ character: 0, seed: 1234 });
  const second = createGameSession({ character: 0, seed: 1234 });
  assert.deepEqual(first.wave.queue, second.wave.queue);
  assert.deepEqual(first.chests, second.chests);
});

test('item chest opens a three-card item choice', () => {
  const session = createGameSession({ character: 0, seed: 23 });
  const chest = session.chests[0];
  chest.x = session.player.x;
  chest.y = session.player.y;
  chest.type = 4;

  const events = updateGame(session, 0.016, neutralInput, viewport);

  assert.equal(session.state, 'level_up');
  assert.equal(events.itemChoices.length, 3);
  assert.equal(session.itemChoices.length, 3);
});

test('pause prevents simulation time from advancing and resume continues it', () => {
  const session = createGameSession({ character: 0, seed: 1 });
  pauseSession(session);
  updateGame(session, 1, neutralInput, viewport);
  assert.equal(session.elapsedSeconds, 0);
  resumeSession(session);
  updateGame(session, 1, neutralInput, viewport);
  assert.equal(session.elapsedSeconds, 1);
});

test('finishSession records a terminal result and does not reopen the run', () => {
  const session = createGameSession({ character: 0, seed: 2 });
  finishSession(session, 'defeat');
  assert.equal(session.state, 'game_over');
  assert.equal(updateGame(session, 1, neutralInput, viewport).gameOver, null);
});

test('maxed upgrades do not strand a run in an empty level-up state', () => {
  const session = createGameSession({ character: 0, seed: 3 });
  session.ownedUpgrades = Object.fromEntries(UPGRADE_DEFINITIONS.map(definition => [definition.id, definition.maxLevel]));
  session.xpOrbs.push({ x: 0, y: 0, value: 10, size: 6 });

  updateGame(session, 0.016, neutralInput, viewport);

  assert.equal(session.state, 'playing');
  assert.equal(session.pendingLevelUps, 0);
  assert.deepEqual(session.upgradeChoices, []);
});

test('multiple levels from one pickup are selected one upgrade at a time', () => {
  const session = createGameSession({ character: 0, seed: 4 });
  session.xpOrbs.push({ x: 0, y: 0, value: 25, size: 6 });

  updateGame(session, 0.016, neutralInput, viewport);

  assert.equal(session.state, 'level_up');
  assert.equal(session.player.level, 3);
  assert.equal(session.pendingLevelUps, 2);
  assert.equal(session.upgradeChoices.length, 3);

  const firstEvents = selectUpgrade(session, session.upgradeChoices[0].definition.id);
  assert.equal(firstEvents.stateChanged, 'level_up');
  assert.equal(session.pendingLevelUps, 1);
  assert.equal(session.upgradeChoices.length, 3);

  selectUpgrade(session, session.upgradeChoices[0].definition.id);
  assert.equal(session.pendingLevelUps, 0);
  assert.equal(session.state, 'playing');
});
