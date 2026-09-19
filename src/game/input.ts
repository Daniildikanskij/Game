import { getMovementKey } from '../gameLogic.ts';
import type { GameState, MovementInput } from './types.ts';

export type MovementDirection = 'up' | 'down' | 'left' | 'right';

const EMPTY_MOVEMENT: MovementInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  joystickX: 0,
  joystickY: 0,
};

export function setMovement(input: MovementInput, direction: MovementDirection, active: boolean): MovementInput {
  return { ...input, [direction]: active };
}

export function clearMovement(_input: MovementInput): MovementInput {
  return { ...EMPTY_MOVEMENT };
}

export function getUpgradeHotkeyIndex(event: { code: string; key: string }): number | null {
  if (event.code === 'Digit1') return 0;
  if (event.code === 'Digit2') return 1;
  if (event.code === 'Digit3') return 2;
  return null;
}

export interface InputControllerOptions {
  canvas: HTMLElement;
  getGameState: () => GameState;
  onPauseToggle: () => void;
  onUpgradeHotkey: (index: number) => void;
  browserWindow?: Window;
  browserDocument?: Document;
}

export interface InputController {
  getMovement(): MovementInput;
  getJoystick(): JoystickState;
  reset(): void;
  dispose(): void;
}

export interface JoystickState {
  active: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

const EMPTY_JOYSTICK: JoystickState = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };

export function createInputController(options: InputControllerOptions): InputController {
  const browserWindow = options.browserWindow ?? window;
  const browserDocument = options.browserDocument ?? browserWindow.document;
  const movement: MovementInput = { ...EMPTY_MOVEMENT };
  let joystick: JoystickState = { ...EMPTY_JOYSTICK };

  const isPlaying = () => options.getGameState() === 'playing';
  const clearJoystick = () => { joystick = { ...EMPTY_JOYSTICK }; };
  const reset = () => {
    Object.assign(movement, EMPTY_MOVEMENT);
    clearJoystick();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const state = options.getGameState();
    if (state === 'level_up') {
      const upgradeIndex = getUpgradeHotkeyIndex(event);
      if (upgradeIndex !== null) {
        event.preventDefault();
        options.onUpgradeHotkey(upgradeIndex);
      }
      return;
    }

    if (event.code === 'Escape' || event.key === 'Escape') {
      if (state === 'playing' || state === 'paused') {
        event.preventDefault();
        options.onPauseToggle();
      }
      return;
    }

    const direction = getMovementKey(event);
    if (direction && isPlaying()) {
      event.preventDefault();
      Object.assign(movement, setMovement(movement, direction, true));
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    const direction = getMovementKey(event);
    if (direction) Object.assign(movement, setMovement(movement, direction, false));
  };

  const handleBlur = () => {
    reset();
    if (options.getGameState() === 'playing') options.onPauseToggle();
  };

  const handleVisibilityChange = () => {
    if (browserDocument.hidden) handleBlur();
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (!isPlaying()) return;
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();
    joystick = { active: true, startX: touch.clientX, startY: touch.clientY, dx: 0, dy: 0 };
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!isPlaying() || !joystick.active) return;
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();
    joystick.dx = (touch.clientX - joystick.startX) / 50;
    joystick.dy = (touch.clientY - joystick.startY) / 50;
    const length = Math.sqrt(joystick.dx ** 2 + joystick.dy ** 2);
    if (length > 1) {
      joystick.dx /= length;
      joystick.dy /= length;
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!isPlaying()) return;
    event.preventDefault();
    clearJoystick();
  };

  browserWindow.addEventListener('keydown', handleKeyDown);
  browserWindow.addEventListener('keyup', handleKeyUp);
  browserWindow.addEventListener('blur', handleBlur);
  browserDocument.addEventListener('visibilitychange', handleVisibilityChange);
  options.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  options.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  options.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  browserWindow.addEventListener('touchend', clearJoystick);
  browserWindow.addEventListener('touchcancel', clearJoystick);
  browserWindow.addEventListener('pointerup', clearJoystick);
  browserWindow.addEventListener('pointercancel', clearJoystick);

  return {
    getMovement: () => ({
      ...movement,
      joystickX: joystick.active ? joystick.dx : 0,
      joystickY: joystick.active ? joystick.dy : 0,
    }),
    getJoystick: () => ({ ...joystick }),
    reset,
    dispose: () => {
      browserWindow.removeEventListener('keydown', handleKeyDown);
      browserWindow.removeEventListener('keyup', handleKeyUp);
      browserWindow.removeEventListener('blur', handleBlur);
      browserDocument.removeEventListener('visibilitychange', handleVisibilityChange);
      options.canvas.removeEventListener('touchstart', handleTouchStart);
      options.canvas.removeEventListener('touchmove', handleTouchMove);
      options.canvas.removeEventListener('touchend', handleTouchEnd);
      browserWindow.removeEventListener('touchend', clearJoystick);
      browserWindow.removeEventListener('touchcancel', clearJoystick);
      browserWindow.removeEventListener('pointerup', clearJoystick);
      browserWindow.removeEventListener('pointercancel', clearJoystick);
      reset();
    },
  };
}
