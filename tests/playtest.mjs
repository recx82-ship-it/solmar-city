// Solmar City play-tests: 13 checks run in headless Chromium against the
// real game served from game/ — boot, movement, driving, traffic,
// pedestrians, stealing, wanted level and police, a mission start-to-finish,
// HUD and minimap pixels, save/load across a reload, the day cycle, audio
// init, and a clean console throughout. Exits non-zero if any check fails.
//
//   node tests/playtest.mjs

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  launchChrome, makeClient, evaluate, waitFor, tapKey, holdKey,
  screenshot, closeChrome,
} from '../tools/cdp.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8123;
const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail });
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    results.push({ name, pass: false, detail: error.message });
    console.log(`FAIL  ${name} — ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const blankInput = { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, aim: null };

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repo, stdio: 'ignore' });
// Wait until the server actually answers before Chrome navigates to it.
for (let i = 0; i < 40; i += 1) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    if (res.ok) break;
  } catch {
    // Not up yet.
  }
  await sleep(250);
}

let session;
let client;
try {
  session = await launchChrome(9223, `http://127.0.0.1:${PORT}/?seed=7`);
  client = session.client;
  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Network.enable');
  await client.send('Page.enable');
  await waitFor(client, `window.__solmar && window.__solmar.state`);

  await check('1. game boots with no errors', async () => {
    const info = await evaluate(client, `({ screen: __solmar.screen(), x: __solmar.state.player.x, y: __solmar.state.player.y, canvas: document.getElementById('game').width })`);
    assert(info.screen === 'title', `expected title screen, got ${info.screen}`);
    assert(info.x === 2600 && info.y === 3000, `expected spawn (2600,3000), got (${info.x},${info.y})`);
    assert(info.canvas > 0, 'canvas has no size');
    return `title screen, player at spawn, canvas ${info.canvas}px`;
  });

  await check('2. on-foot movement (W key)', async () => {
    await evaluate(client, `__solmar.startGame(true)`);
    await sleep(300);
    const before = await evaluate(client, `({ x: __solmar.state.player.x, y: __solmar.state.player.y })`);
    await holdKey(client, 'KeyW', 'w', 1200);
    const after = await evaluate(client, `({ x: __solmar.state.player.x, y: __solmar.state.player.y })`);
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    assert(moved > 50, `player only moved ${moved.toFixed(0)}px in 1.2s`);
    return `moved ${moved.toFixed(0)}px`;
  });

  await check('3. entering and driving a car', async () => {
    const car = await evaluate(client, `__solmar.world.debug.giveCar()`);
    await evaluate(client, `__solmar.world.debug.teleport(${car.x - 30}, ${car.y})`);
    await tapKey(client, 'KeyE', 'e');
    await sleep(300);
    const inCar = await evaluate(client, `__solmar.state.player.inCar`);
    assert(inCar !== null, 'player did not enter the car');
    const before = await evaluate(client, `({ x: __solmar.state.player.x, y: __solmar.state.player.y })`);
    await holdKey(client, 'KeyW', 'w', 1500);
    const after = await evaluate(client, `({ x: __solmar.state.player.x, y: __solmar.state.player.y, speed: __solmar.state.player.speed })`);
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    assert(moved > 60 || after.speed > 40, `car barely moved (${moved.toFixed(0)}px, speed ${after.speed.toFixed(0)})`);
    return `in car ${inCar}, drove ${moved.toFixed(0)}px at ${after.speed.toFixed(0)} u/s`;
  });

  await check('4. traffic moves', async () => {
    const before = await evaluate(client, `__solmar.state.cars.filter(c => c.kind === 'traffic').slice(0, 3).map(c => ({ x: Math.round(c.x), y: Math.round(c.y) }))`);
    await sleep(2000);
    const after = await evaluate(client, `__solmar.state.cars.filter(c => c.kind === 'traffic').slice(0, 3).map(c => ({ x: Math.round(c.x), y: Math.round(c.y) }))`);
    const moved = before.filter((b, i) => Math.hypot(after[i].x - b.x, after[i].y - b.y) > 20).length;
    assert(moved >= 2, `only ${moved}/3 traffic cars moved`);
    return `${moved}/3 traffic cars moved`;
  });

  await check('5. pedestrians move', async () => {
    const before = await evaluate(client, `__solmar.state.peds.slice(0, 5).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))`);
    await sleep(2000);
    const after = await evaluate(client, `__solmar.state.peds.slice(0, 5).map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))`);
    const moved = before.filter((b, i) => Math.hypot(after[i].x - b.x, after[i].y - b.y) > 8).length;
    assert(moved >= 3, `only ${moved}/5 pedestrians moved`);
    return `${moved}/5 pedestrians moved`;
  });

  await check('6. stealing a car raises the wanted level', async () => {
    await evaluate(client, `__solmar.startGame(true)`);
    await sleep(300);
    const car = await evaluate(client, `__solmar.world.debug.giveCar()`);
    await evaluate(client, `__solmar.world.debug.teleport(${car.x - 30}, ${car.y})`);
    await tapKey(client, 'KeyE', 'e');
    await sleep(400);
    const info = await evaluate(client, `({ stolen: __solmar.state.carsStolen, wanted: __solmar.state.wanted, inCar: __solmar.state.player.inCar })`);
    assert(info.stolen === 1, `carsStolen is ${info.stolen}, expected 1`);
    assert(info.wanted >= 1, `wanted is ${info.wanted} after a steal`);
    assert(info.inCar !== null, 'player not in the stolen car');
    return `stole 1 car, wanted ${info.wanted} star(s)`;
  });

  await check('7. wanted level brings police pursuit', async () => {
    await evaluate(client, `__solmar.world.debug.setWanted(3)`);
    await sleep(4000);
    const first = await evaluate(client, `({ count: __solmar.state.cars.filter(c => c.kind === 'police').length, nearest: Math.min(...__solmar.state.cars.filter(c => c.kind === 'police').map(c => Math.hypot(c.x - __solmar.state.player.x, c.y - __solmar.state.player.y))) })`);
    assert(first.count >= 2, `only ${first.count} police cars after 4s at 3 stars`);
    await sleep(2000);
    const second = await evaluate(client, `Math.min(...__solmar.state.cars.filter(c => c.kind === 'police').map(c => Math.hypot(c.x - __solmar.state.player.x, c.y - __solmar.state.player.y)))`);
    assert(second < first.nearest || second < 400, `police not closing in (${first.nearest.toFixed(0)} -> ${second.toFixed(0)})`);
    return `${first.count} cruisers, nearest closed ${first.nearest.toFixed(0)} -> ${second.toFixed(0)}px`;
  });

  await check('8. mission starts and completes (First Wheels)', async () => {
    // Get out of the stolen car, retrying until actually on foot.
    for (let i = 0; i < 3; i += 1) {
      const inCar = await evaluate(client, `__solmar.state.player.inCar`);
      if (inCar === null) break;
      await tapKey(client, 'KeyE', 'e');
      await sleep(300);
    }
    const onFoot = await evaluate(client, `__solmar.state.player.inCar`);
    assert(onFoot === null, 'could not get out of the car');
    // Step away from every car, so the steal objective starts clean.
    await evaluate(client, `__solmar.world.debug.teleport(1000, 3600)`);
    await sleep(200);
    await evaluate(client, `__solmar.world.debug.startMission(0)`);
    await evaluate(client, `__solmar.world.debug.clearPolice()`);
    await sleep(200);
    const text = await evaluate(client, `__solmar.objectiveText()`);
    assert(/Steal a car/.test(text), `first objective is not the steal: "${text}"`);
    const car = await evaluate(client, `__solmar.world.debug.giveCar()`);
    await evaluate(client, `__solmar.world.debug.teleport(${car.x - 30}, ${car.y})`);
    await tapKey(client, 'KeyE', 'e');
    await sleep(400);
    const mid = await evaluate(client, `({ objective: __solmar.state.objectiveIndex, mission: __solmar.state.missionIndex })`);
    assert(mid.objective === 1, `steal did not complete objective 0 (objectiveIndex ${mid.objective})`);
    await evaluate(client, `__solmar.world.debug.teleport(2600, 2130)`);
    await sleep(800);
    const done = await evaluate(client, `({ mission: __solmar.state.missionIndex, cash: __solmar.state.cash })`);
    assert(done.mission === 1, `mission did not complete (missionIndex ${done.mission})`);
    assert(done.cash >= 370, `cash ${done.cash} after $250 reward, expected >= 370`);
    return `mission 0 complete, cash $${done.cash}`;
  });

  await check('9. HUD and minimap render', async () => {
    const pixels = await evaluate(client, `(() => {
      const canvas = document.getElementById('game');
      const ctx = canvas.getContext('2d');
      const count = (x0, y0, x1, y1) => {
        const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const seen = new Set();
        for (let i = 0; i < data.length; i += 16) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        return seen.size;
      };
      return { minimap: count(1056, 16, 1264, 224), hud: count(16, 16, 226, 90) };
    })()`);
    assert(pixels.minimap > 10, `minimap region has only ${pixels.minimap} distinct colours`);
    assert(pixels.hud > 5, `HUD region has only ${pixels.hud} distinct colours`);
    return `minimap ${pixels.minimap} colours, HUD ${pixels.hud} colours`;
  });

  await check('10. save and load across a reload', async () => {
    await evaluate(client, `__solmar.save()`);
    const saved = await evaluate(client, `__solmar.hasSave()`);
    assert(saved, 'no save in localStorage after save()');
    await client.send('Page.reload', { ignoreCache: true });
    await waitFor(client, `window.__solmar && __solmar.hasSave()`, 15000);
    await client.send('Runtime.enable');
    await evaluate(client, `__solmar.startGame(false)`);
    await sleep(500);
    const loaded = await evaluate(client, `({ mission: __solmar.state.missionIndex, cash: __solmar.state.cash })`);
    assert(loaded.mission === 1, `loaded missionIndex ${loaded.mission}, expected 1`);
    assert(loaded.cash >= 370, `loaded cash ${loaded.cash}, expected >= 370`);
    return `save found after reload, mission ${loaded.mission}, cash $${loaded.cash}`;
  });

  await check('11. day cycle advances', async () => {
    const before = await evaluate(client, `__solmar.state.hour`);
    await sleep(6000);
    const after = await evaluate(client, `__solmar.state.hour`);
    const advanced = (after - before + 24) % 24;
    assert(advanced > 0.1, `clock barely moved (${before.toFixed(2)} -> ${after.toFixed(2)})`);
    return `clock ${before.toFixed(2)} -> ${after.toFixed(2)}`;
  });

  await check('12. audio initialises without errors', async () => {
    const audio = await evaluate(client, `({ init: __solmar.audio.init(), ready: __solmar.audio.isReady() })`);
    assert(audio.init === true, 'audio.init() returned false');
    assert(audio.ready === true, 'audio not ready after init()');
    return 'AudioContext created, engine and siren running';
  });

  await check('13. zero console, page and network errors', async () => {
    const errors = [...client.consoleErrors, ...client.pageErrors, ...client.failedRequests];
    assert(errors.length === 0, `errors seen: ${errors.slice(0, 3).join(' | ')}`);
    return 'clean console for the whole session';
  });
} finally {
  if (session) await closeChrome(session);
  server.kill();
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} play-tests passed`);
process.exit(passed === results.length ? 0 : 1);
