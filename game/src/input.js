// Keyboard and mouse input. Held keys give a steering vector; one-shot presses
// (enter a car, punch, reload, pause, confirm) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost and never counted twice.
// The live `state` object is exposed so scripted tests can drive the game too.

export const ACTION_CONFIRM = 1;
export const ACTION_ENTER = 2;
export const ACTION_PUNCH = 4;
export const ACTION_RELOAD = 8;
export const ACTION_PAUSE = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const RELOAD = new Set(['KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const state = {
    up: false,
    down: false,
    left: false,
    right: false,
    run: false,
    fire: false,
    aimX: 0,
    aimY: 0,
    aimScreenX: 0,
    aimScreenY: 0,
  };
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) state.up = true;
    else if (DOWN.has(event.code)) state.down = true;
    else if (LEFT.has(event.code)) state.left = true;
    else if (RIGHT.has(event.code)) state.right = true;
    else if (RUN.has(event.code)) state.run = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (RELOAD.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RELOAD;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) state.up = false;
    else if (DOWN.has(event.code)) state.down = false;
    else if (LEFT.has(event.code)) state.left = false;
    else if (RIGHT.has(event.code)) state.right = false;
    else if (RUN.has(event.code)) state.run = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    state.up = state.down = state.left = state.right = state.run = state.fire = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.aimScreenX = event.clientX - rect.left;
    state.aimScreenY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) state.fire = true;
    const rect = canvas.getBoundingClientRect();
    state.aimScreenX = event.clientX - rect.left;
    state.aimScreenY = event.clientY - rect.top;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) state.fire = false;
  });

  return {
    state,
    /** The held-key steering vector, each component -1, 0 or 1. */
    steer() {
      return {
        x: (state.right ? 1 : 0) - (state.left ? 1 : 0),
        y: (state.down ? 1 : 0) - (state.up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    queueAction(flag) {
      actions |= flag;
    },
  };
}
