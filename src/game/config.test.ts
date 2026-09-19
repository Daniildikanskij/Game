import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, ENEMY_TYPES, MAX_WAVES, WAVE_CONFIGS } from './config.ts';

test('exports the current playable roster and 30-wave baseline', () => {
  assert.equal(CHARACTERS.length, 4);
  assert.equal(WAVE_CONFIGS.length, MAX_WAVES);
  assert.equal(MAX_WAVES, 30);
  assert.ok(WAVE_CONFIGS.every(wave => wave.duration > 0));
  assert.ok(WAVE_CONFIGS.every(wave => wave.enemies.every(enemy => enemy.count >= 0)));
});

test('every configured enemy type has render and combat data', () => {
  assert.ok(ENEMY_TYPES.every(enemy => enemy.hp > 0 && enemy.speed >= 0 && enemy.size > 0));
  assert.ok(WAVE_CONFIGS.flatMap(wave => wave.enemies).every(enemy => enemy.type < ENEMY_TYPES.length));
});
