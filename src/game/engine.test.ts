import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameSession,
  finishSession,
  pauseSession,
  resumeSession,
  selectUpgrade,
  updateGame,
} from './engine.ts';
import { UPGRADE_DEFINITIONS } from './upgrades.ts';

const neutralInput = { up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0 };
const viewport = { width: 800, height: 600 };

test('same seed creates the same first wave and chest placement', () => {
  const first = createGameSession({ character: 0, seed: 1234 });
  const second = createGameSession({ character: 0, seed: 1234 });
  assert.deepEqual(first.wave.queue, second.wave.queue);
  assert.deepEqual(first.chests, second.chests);
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
