import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addExperience,
  buildWaveSpawnQueue,
  getMovementKey,
  getProgressRatio,
  getWaveSpawnInterval,
  spawnProbability,
} from './gameLogic.ts';

test('maps physical movement keys and both keyboard layouts to canonical directions', () => {
  assert.equal(getMovementKey({ code: 'KeyW', key: 'ц' }), 'up');
  assert.equal(getMovementKey({ code: 'KeyA', key: 'ф' }), 'left');
  assert.equal(getMovementKey({ code: 'KeyS', key: 'ы' }), 'down');
  assert.equal(getMovementKey({ code: 'KeyD', key: 'в' }), 'right');
  assert.equal(getMovementKey({ code: '', key: 'ц' }), 'up');
  assert.equal(getMovementKey({ code: '', key: 'ф' }), 'left');
  assert.equal(getMovementKey({ code: 'ArrowUp', key: 'ArrowUp' }), 'up');
  assert.equal(getMovementKey({ code: 'Space', key: ' ' }), null);
});

test('applies enough experience for every level reached by one pickup', () => {
  const result = addExperience({ level: 1, xp: 0, xpToNext: 10 }, 500);

  assert.equal(result.levelsGained, 8);
  assert.deepEqual(result.progress, { level: 9, xp: 26, xpToNext: 244 });
  assert.ok(result.progress.xp < result.progress.xpToNext);
});

test('clamps progress ratios used by the XP bar', () => {
  assert.equal(getProgressRatio(5, 10), 0.5);
  assert.equal(getProgressRatio(500, 10), 1);
  assert.equal(getProgressRatio(-1, 10), 0);
});

test('uses delta time to make spawn probability independent of frame rate', () => {
  const oneSecondChance = spawnProbability(3, 1);
  let noSpawnChance = 1;
  for (let frame = 0; frame < 60; frame += 1) {
    noSpawnChance *= 1 - spawnProbability(3, 1 / 60);
  }

  assert.ok(Math.abs(oneSecondChance - (1 - noSpawnChance)) < 1e-12);
  assert.equal(spawnProbability(3, 0), 0);
});

test('paces a wave across most of its duration with a safe minimum interval', () => {
  assert.equal(getWaveSpawnInterval(10, 20), 1.64);
  assert.equal(getWaveSpawnInterval(1000, 20), 0.18);
  assert.equal(getWaveSpawnInterval(0, 20), Number.POSITIVE_INFINITY);
});

test('builds a wave queue with the exact configured enemy composition', () => {
  const queue = buildWaveSpawnQueue([
    { type: 0, count: 8 },
    { type: 2, count: 3 },
    { type: 3, count: 1, isBoss: true },
  ], () => 0.5);

  assert.equal(queue.length, 12);
  assert.equal(queue.filter(enemy => enemy.type === 0).length, 8);
  assert.equal(queue.filter(enemy => enemy.type === 2).length, 3);
  assert.equal(queue.filter(enemy => enemy.type === 3 && enemy.isBoss).length, 1);
});
