// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, paused,
// wasted, busted and story complete. ?seed=N fixes the city; ?shot=cover|drive|
// foot|title stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot; ?test=1 runs the scripted play-test.

import { STEP } from './config.js';
import { createWorld, markerFor, nearestPolice, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { currentObjective } from './missions.js';
import { applySave, hasSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';
import { nearestCar } from './traffic.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const testMode = params.get('test') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261120;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const hud = createHud();
const audio = createAudio();
state.hasSave = params.get('shot') ? false : hasSave();
// A debug handle: the finalist review and scripted tests read the live state.
window.__solmar = state;

function announce(message) {
  status.textContent = message;
}

function handleEvent(event) {
  switch (event.type) {
    case 'gunshot':
      audio.gunshot();
      break;
    case 'punch':
      audio.punch();
      break;
    case 'crash':
      audio.crash();
      break;
    case 'cash':
      audio.cash();
      hud.showToast(`+$${event.amount}`, 'good');
      break;
    case 'pickup':
      audio.pickup();
      break;
    case 'steal':
      hud.showToast('Car stolen — the cops noticed', 'bad');
      break;
    case 'spray':
      audio.pickup();
      hud.showToast('Fresh paint — the heat is off', 'good');
      break;
    case 'heal':
      audio.pickup();
      hud.showToast('Patched up — feeling like new', 'good');
      break;
    case 'ammo':
      audio.pickup();
      hud.showToast('Ammo restocked', 'good');
      break;
    case 'step':
      hud.showToast('Objective complete', 'good');
      break;
    case 'phone':
      audio.phone();
      hud.showToast(`New job from Mara Voss: ${event.mission.title}`, 'gold');
      announce(`New job: ${event.mission.title}. ${event.mission.brief}`);
      break;
    case 'mission':
      audio.missionDone();
      hud.showToast(`Job done: ${event.mission.title} — +$${event.mission.reward}`, 'gold');
      announce(`Job done: ${event.mission.title}. Earned $${event.mission.reward}.`);
      saveGame(state);
      break;
    case 'story':
      audio.missionDone();
      break;
    case 'heatdown':
      hud.showToast('The heat is off', 'good');
      break;
    case 'busted':
      audio.busted();
      break;
    case 'wasted':
      audio.busted();
      break;
    default:
      break;
  }
}

/** The context line under the crosshair: what E does right here, right now. */
function promptFor(state) {
  const player = state.player;
  const places = state.city.places;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  if (player.inCar) {
    if (Math.hypot(px - places.sprayShop.x, py - places.sprayShop.y) < 80 && state.wanted > 0) {
      return player.money >= 200 ? 'E — Spray shop: clear the heat ($200)' : 'Spray shop: clear the heat ($200) — not enough cash';
    }
    return 'E — Get out of the car';
  }
  const car = nearestCar(state.cars, player.x, player.y, 78);
  if (car) return car.driver === 'traffic' ? 'E — Steal the car' : 'E — Get in the car';
  if (Math.hypot(px - places.hospital.x, py - places.hospital.y) < 80 && player.health < 100) {
    return player.money >= 80 ? 'E — Hospital: heal up ($80)' : 'Hospital: heal up ($80) — not enough cash';
  }
  if (Math.hypot(px - places.ammoShop.x, py - places.ammoShop.y) < 80) {
    return player.money >= 60 ? 'E — Lock & Load: buy ammo ($60)' : 'Lock & Load: buy ammo ($60) — not enough cash';
  }
  return '';
}

function runShot(name) {
  const scene = stageShot(name, state, input);
  renderer.snap(state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, markerFor(state));
    hud.update(state, markerFor(state), currentObjective(state.missions, state.missionState), '');
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  const dpr = window.devicePixelRatio || 1;

  function startGame() {
    audio.unlock();
    screen = SCREEN_PLAY;
    announce('Playing. Follow the yellow marker.');
    hud.showToast('Mara Voss has a job for you — follow the yellow marker', 'gold');
  }

  function continueGame() {
    const data = loadSave();
    if (!data) return;
    applySave(state, data);
    audio.unlock();
    screen = SCREEN_PLAY;
    hud.showToast('Welcome back to Solmar', 'good');
    announce('Continued your saved game.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      hud.showToast(muted ? 'Sound off' : 'Sound on');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED || screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused. Game saved.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    // The mouse aims in world coordinates, through the camera.
    const aim = renderer.worldFromScreen(input.state.aimScreenX * dpr, input.state.aimScreenY * dpr);
    input.state.aimX = aim.x;
    input.state.aimY = aim.y;
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = stepWorld(state, input, STEP);
        for (const event of events) {
          handleEvent(event);
          if (event.type === 'wasted') screen = SCREEN_OVER;
          else if (event.type === 'busted') screen = SCREEN_BUSTED;
          else if (event.type === 'story') screen = SCREEN_STORY;
        }
        accumulator -= STEP;
      }
      // Sound follows the drive and the chase.
      const player = state.player;
      audio.engine(player.inCar ? Math.abs(player.inCar.speed) / 430 : 0);
      const policeNear = state.wanted > 0 ? nearestPolice(state) : Infinity;
      audio.siren(policeNear === Infinity ? 0 : Math.max(0, 1 - policeNear / 900));
    } else {
      accumulator = 0;
      audio.engine(0);
      audio.siren(0);
    }
    const marker = markerFor(state);
    renderer.draw(state, screen, marker);
    if (screen === SCREEN_PLAY) {
      hud.update(state, marker, currentObjective(state.missions, state.missionState), promptFor(state));
    }
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });
  // C on the title screen continues a saved game.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyC' && hasSave()) continueGame();
  });

  announce('Solmar City. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (testMode) {
  import('./test.js').then((module) => module.runTests(state, input, renderer, hud));
} else {
  runGame();
}
