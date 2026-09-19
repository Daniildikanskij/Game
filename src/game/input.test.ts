import test from 'node:test';
import assert from 'node:assert/strict';
import { clearMovement, getUpgradeHotkeyIndex, setMovement } from './input.ts';

test('upgrade hotkeys map only Digit1, Digit2, and Digit3', () => {
  assert.equal(getUpgradeHotkeyIndex({ code: 'Digit1', key: '1' }), 0);
  assert.equal(getUpgradeHotkeyIndex({ code: 'Digit2', key: '2' }), 1);
  assert.equal(getUpgradeHotkeyIndex({ code: 'Digit3', key: '3' }), 2);
  assert.equal(getUpgradeHotkeyIndex({ code: 'KeyW', key: 'ц' }), null);
});

test('clearing input removes keyboard and joystick movement', () => {
  const active = setMovement({ up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0 }, 'left', true);
  assert.deepEqual(clearMovement({ ...active, joystickX: 1, joystickY: -1 }), {
    up: false, down: false, left: false, right: false, joystickX: 0, joystickY: 0,
  });
});
