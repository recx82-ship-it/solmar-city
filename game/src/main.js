// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), sound
// follows the game, and the renderer paints what is there. The game moves
// between title, play, paused, wasted, won and help screens, and saves to
// localStorage whenever a mission is completed.
//
// ?seed=N fixes the city's deal. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_MISSION, EVENT_PUNCH, EVENT_SHOT, EVENT_STAR, EVENT_STEAL, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_HELP, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_HELP, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED, SCREEN_WON } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(createRandom(seed));
const world = createWorld(createRandom(seed ^ 0x51ab), city);
const renderer = createRenderer(canvas, city);
const audio = createAudio();

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best cash then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { best: 0, saveExists: false, muted: false, objectiveText: world.objectiveText() };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { ...ui, objectiveText: world.objectiveText() });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let saveExists = !!readSave();
  let accumulator = 0;
  let last = performance.now();
  let muted = false;

  function announce(message) {
    status.textContent = message;
  }

  function ui() {
    return { best, saveExists, muted, objectiveText: world.objectiveText() };
  }

  function startGame(fresh) {
    if (fresh) {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Nothing to clear.
      }
      world.reset();
      saveExists = false;
    } else {
      const save = readSave();
      if (save) {
        world.reset();
        world.loadData(save);
      } else {
        world.reset();
      }
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.init();
    audio.resume();
    audio.startMusic();
    announce(`Playing. ${world.currentMission() ? world.currentMission().title : 'Free roam'}.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WON : SCREEN_WASTED;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    announce(won ? 'You won. Solmar City is yours.' : 'Wasted. You woke up at Solmar General.');
  }

  // One-shot presses wait here until a simulation step consumes them: a
  // press that lands on a frame too short to step must not be dropped.
  let queuedActions = 0;

  function handleActions(actions) {
    let rest = actions;
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
      rest &= ~ACTION_MUTE;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        startGame(!saveExists);
        rest &= ~ACTION_CONFIRM;
      } else if (actions & ACTION_HELP) {
        screen = SCREEN_HELP;
        rest &= ~ACTION_HELP;
      }
      return rest;
    }
    if (screen === SCREEN_HELP) {
      if (actions & (ACTION_HELP | ACTION_CONFIRM | ACTION_PAUSE)) {
        screen = SCREEN_TITLE;
        rest &= ~(ACTION_HELP | ACTION_CONFIRM | ACTION_PAUSE);
      }
      return rest;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
        // A car key queued while pausing must not fire on resume.
        rest &= ~(ACTION_PAUSE | ACTION_ENTER | ACTION_PUNCH);
      } else if (actions & ACTION_HELP) {
        screen = SCREEN_HELP;
        rest &= ~ACTION_HELP;
      }
      return rest;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
        rest &= ~(ACTION_PAUSE | ACTION_CONFIRM);
      } else if (actions & ACTION_HELP) {
        screen = SCREEN_HELP;
        rest &= ~ACTION_HELP;
      }
      return rest;
    }
    if (screen === SCREEN_WASTED || screen === SCREEN_WON) {
      if (actions & ACTION_CONFIRM) {
        startGame(true);
        rest &= ~ACTION_CONFIRM;
      }
    }
    return rest;
  }

  function buildInput() {
    const move = input.move();
    const aim = input.mouse.inside
      ? renderer.screenToWorld(input.mouse.x, input.mouse.y)
      : null;
    return {
      up: move.up,
      down: move.down,
      left: move.left,
      right: move.right,
      run: move.run,
      shoot: move.shoot,
      enter: false,
      punch: false,
      aim,
    };
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, aim: null });
      return;
    }
    const frameInput = buildInput();
    // One-shot actions, taken once per frame by the loop and handed in here.
    frameInput.enter = !!(actions & ACTION_ENTER);
    frameInput.punch = !!(actions & ACTION_PUNCH);
    const events = world.step(STEP, frameInput);
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_STEAL) audio.steal();
    if (events & EVENT_STAR) audio.pickup();
    if (events & EVENT_MISSION) {
      audio.missionDone();
      writeSave();
      saveExists = true;
      if (world.state.gameWon) endGame(true);
    }
    if (events & EVENT_WASTED) {
      audio.wasted();
      world.wasted();
      writeSave();
      saveExists = true;
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    queuedActions |= input.takeActions();
    queuedActions = handleActions(queuedActions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot presses apply to the first sub-step only, never twice,
      // and stay queued until a step runs.
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(firstStep ? queuedActions : 0);
        if (firstStep) queuedActions &= ~(ACTION_ENTER | ACTION_PUNCH);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.update(STEP, world.state.player.speed, world.state.wanted);
    renderer.draw(world.state, screen, ui());
  }

  // Leaving the tab pauses a running game rather than letting the city run on.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // First gesture unlocks audio in the browser's autoplay rules.
  window.addEventListener('pointerdown', () => {
    audio.init();
    audio.resume();
  }, { once: true });
  window.addEventListener('keydown', () => {
    audio.init();
    audio.resume();
  }, { once: true });

  // A small debug surface the play-tests drive: state reads and the same
  // hooks the screenshot stager uses. It never changes how the game plays.
  window.__solmar = {
    state: world.state,
    world,
    city,
    audio,
    screen: () => screen,
    startGame,
    step: (dt, testInput) => world.step(dt, testInput || { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, aim: null }),
    save: writeSave,
    load: () => {
      const save = readSave();
      return save ? world.loadData(save) : false;
    },
    hasSave: () => !!readSave(),
    objectiveText: () => world.objectiveText(),
  };

  announce('Solmar City. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
