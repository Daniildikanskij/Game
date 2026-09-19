import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom, createRunRandom } from './random.ts';

test('the same seed produces the same sequence and different seeds diverge', () => {
  const first = createRandom(12345);
  const second = createRandom(12345);
  const other = createRandom(54321);
  const a = Array.from({ length: 8 }, () => first.next());
  const b = Array.from({ length: 8 }, () => second.next());
  const c = Array.from({ length: 8 }, () => other.next());
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.every(value => value >= 0 && value < 1));
});

test('shuffle preserves composition and validates bounds', () => {
  const random = createRandom(7);
  const shuffled = random.shuffle(['a', 'b', 'c', 'd']);
  assert.deepEqual([...shuffled].sort(), ['a', 'b', 'c', 'd']);
  assert.equal(random.int(0), 0);
  assert.throws(() => random.int(-1), RangeError);
  assert.throws(() => random.pick([]), RangeError);
});

test('stream consumption is independent across gameplay domains', () => {
  const withEffects = createRunRandom(99);
  const withoutEffects = createRunRandom(99);
  Array.from({ length: 50 }, () => withEffects.effects.next());
  assert.deepEqual(
    Array.from({ length: 5 }, () => withEffects.world.next()),
    Array.from({ length: 5 }, () => withoutEffects.world.next()),
  );
  assert.deepEqual(
    Array.from({ length: 5 }, () => withEffects.upgrades.next()),
    Array.from({ length: 5 }, () => withoutEffects.upgrades.next()),
  );
});
