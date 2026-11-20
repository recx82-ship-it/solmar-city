// The scripted play-test, run with ?test=1 instead of the game loop. It drives the
// real world with scripted input — walk, steal a car, drive, shoot, earn heat,
// save and load — and writes the results into the page, so headless Chrome can
// read them back. It also records page errors and any network request.

import { STEP } from './config.js';
import { createWorld, markerFor, stepWorld } from './world.js';
import { addWanted } from './police.js';
import { applySave, loadSave, saveGame } from './save.js';
import { currentObjective } from './missions.js';
import { SCREEN_PLAY } from './render.js';

const errors = [];
window.addEventListener('error', (event) => errors.push(String(event.message || event.error)));

function step(state, input, seconds) {
  for (let i = 0; i < seconds / STEP; i += 1) stepWorld(state, input, STEP);
}

export function runTests(state, input, renderer, hud) {
  const results = {};
  const check = (name, ok, detail) => {
    results[name] = { ok: !!ok, detail: detail ?? '' };
  };

  try {
    // 1. The world boots with a city, cars and people.
    check('boot', state.city.buildings.length > 50 && state.cars.length > 40 && state.peds.length > 20,
      `${state.city.buildings.length} buildings, ${state.cars.length} cars, ${state.peds.length} peds`);

    // 2. Walking moves the player.
    const x0 = state.player.x;
    const y0 = state.player.y;
    input.state.up = true;
    step(state, input, 2);
    input.state.up = false;
    check('walk', Math.hypot(state.player.x - x0, state.player.y - y0) > 200,
      `moved ${Math.round(Math.hypot(state.player.x - x0, state.player.y - y0))} units in 2s`);

    // 3. Stealing a parked car puts the player in it.
    const parked = state.cars.find((c) => c.kind === 'parked' && !c.dead);
    state.player.x = parked.x + 30;
    state.player.y = parked.y;
    input.queueAction(2); // ACTION_ENTER
    step(state, input, 0.2);
    check('enterCar', !!state.player.inCar, state.player.inCar ? `in car ${state.player.inCar.id}` : 'not in a car');

    // 4. Driving builds speed and covers ground.
    const dx0 = state.player.inCar.x;
    const dy0 = state.player.inCar.y;
    input.state.up = true;
    step(state, input, 5);
    input.state.up = false;
    const car = state.player.inCar;
    check('drive', !!car && Math.abs(car.speed) > 100 && Math.hypot(car.x - dx0, car.y - dy0) > 500,
      car ? `speed ${Math.round(Math.abs(car.speed))}, travelled ${Math.round(Math.hypot(car.x - dx0, car.y - dy0))}` : 'no car');

    // 5. Mission 1: entering a car completes its first step.
    check('missionStep', state.missionState.index >= 0 && state.missionState.step >= 1,
      `mission ${state.missionState.index}, step ${state.missionState.step}`);

    // 6. The pistol fires and the magazine drops.
    input.queueAction(2); // get out of the car
    step(state, input, 0.2);
    const mag0 = state.player.mag;
    state.player.angle = 0;
    input.state.aimX = state.player.x + 200;
    input.state.aimY = state.player.y;
    input.state.fire = true;
    step(state, input, 0.15); // One trigger pull: the fire cooldown is 0.22 s.
    input.state.fire = false;
    check('shoot', state.player.mag === mag0 - 1 && state.stats.shotsFired >= 1,
      `mag ${mag0} -> ${state.player.mag}, shots ${state.stats.shotsFired}`);

    // 7. Heat brings the police.
    addWanted(state, 2);
    step(state, input, 3);
    const policeCars = state.cars.filter((c) => c.kind === 'police' && !c.dead).length;
    check('police', policeCars > 0 && state.wanted >= 2, `${policeCars} police cars, wanted ${state.wanted}`);

    // 8. The heat cools off when the player is unseen and quiet.
    state.wanted = 1;
    state.heatTimer = 0;
    state.recentCrime = 0;
    // Move the player far from every police unit and from the last seen spot.
    state.player.x = 200;
    state.player.y = 200;
    state.lastSeen = { x: 3000, y: 2200 };
    state.lastSeenTime = state.elapsed;
    for (const c of state.cars) {
      if (c.kind === 'police') {
        c.x = 3000;
        c.y = 2200;
      }
    }
    step(state, input, 30);
    check('heatDecay', state.wanted === 0, `wanted ${state.wanted} after 30s unseen`);

    // 9. Save and load round-trip.
    state.player.money = 777;
    saveGame(state);
    const loaded = loadSave();
    check('saveLoad', !!loaded && loaded.money === 777, loaded ? `loaded $${loaded.money}` : 'no save');

    // 10. A fresh save applies to a fresh world.
    const fresh = createWorld(7);
    applySave(fresh, loaded);
    check('applySave', fresh.player.money === 777 && fresh.player.x === state.player.x,
      `fresh world money $${fresh.player.money}`);

    // 11. The renderer paints a frame without throwing.
    let painted = false;
    try {
      renderer.draw(state, SCREEN_PLAY, markerFor(state));
      hud.update(state, markerFor(state), currentObjective(state.missions, state.missionState), 'E — test');
      painted = true;
    } catch (e) {
      errors.push(String(e));
    }
    check('render', painted, painted ? 'one frame painted' : 'draw threw');

    // 12. Nothing loads over the network.
    const resources = performance.getEntriesByType('resource').map((r) => r.name);
    const external = resources.filter((name) => !name.startsWith(window.location.origin) && !name.startsWith('data:'));
    check('noNetwork', external.length === 0, external.length ? external.join(', ') : `${resources.length} local resources`);
  } catch (e) {
    errors.push(String(e && e.stack ? e.stack : e));
  }

  check('noErrors', errors.length === 0, errors.join(' | ').slice(0, 500));
  const passed = Object.values(results).filter((r) => r.ok).length;
  const total = Object.keys(results).length;
  const out = { passed, total, results };
  const el = document.getElementById('test-results');
  if (el) el.textContent = JSON.stringify(out, null, 2);
  document.title = `TESTS ${passed}/${total}`;
  window.__testsDone = true;
  window.__testResults = out;
}
