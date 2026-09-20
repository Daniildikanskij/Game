import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasMetrics } from './canvas.ts';
import { getProjectilePresentation, renderGame } from './renderer.ts';

test('projectile presentation scales visibly with projectile size', () => {
  const base = getProjectilePresentation(8);
  const upgraded = getProjectilePresentation(12);

  assert.equal(base.coreRadius, 8);
  assert.ok(upgraded.coreRadius > base.coreRadius);
  assert.ok(upgraded.glowRadius > base.glowRadius);
  assert.ok(upgraded.trailRadius > base.trailRadius);
  assert.equal(getProjectilePresentation(0).coreRadius, 1);
});

test('renderer resets high-dpi transform and clears logical dimensions', () => {
  const calls: Array<[string, ...number[]]> = [];
  const context = {
    setTransform: (...args: number[]) => calls.push(['setTransform', ...args]),
    clearRect: (...args: number[]) => calls.push(['clearRect', ...args]),
    fillRect: (...args: number[]) => calls.push(['fillRect', ...args]),
  } as unknown as CanvasRenderingContext2D;
  const metrics = getCanvasMetrics(800, 600, 2);

  renderGame(context, null, metrics);

  assert.deepEqual(calls[0], ['setTransform', 2, 0, 0, 2, 0, 0]);
  assert.deepEqual(calls[1], ['clearRect', 0, 0, 800, 600]);
  assert.deepEqual(calls[2], ['fillRect', 0, 0, 800, 600]);
});
