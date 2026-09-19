import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasMetrics } from './canvas.ts';
import { renderGame } from './renderer.ts';

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
