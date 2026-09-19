import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanvasMetrics, getCanvasViewport } from './canvas.ts';

test('uses the layout container dimensions for the canvas viewport', () => {
  assert.deepEqual(getCanvasViewport(1023.33, 898, 300, 150), {
    width: 1023.33,
    height: 898,
  });
  assert.deepEqual(getCanvasViewport(0, 0, 1023, 898), {
    width: 1023,
    height: 898,
  });
});

test('keeps logical dimensions and scales the backing buffer', () => {
  assert.deepEqual(getCanvasMetrics(800, 600, 1), {
    width: 800, height: 600, dpr: 1, bufferWidth: 800, bufferHeight: 600,
  });
  assert.deepEqual(getCanvasMetrics(800, 600, 1.5), {
    width: 800, height: 600, dpr: 1.5, bufferWidth: 1200, bufferHeight: 900,
  });
});

test('caps invalid and excessive DPR values at two', () => {
  assert.equal(getCanvasMetrics(801, 601, 3).dpr, 2);
  assert.equal(getCanvasMetrics(801, 601, 0).dpr, 1);
  assert.equal(getCanvasMetrics(801, 601, 3).bufferWidth, 1602);
  assert.equal(getCanvasMetrics(801, 601, 3).bufferHeight, 1202);
});
