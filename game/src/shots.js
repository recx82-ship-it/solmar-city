// The screenshot scenes behind ?shot=cover|drive|foot|title. Each one sets the real
// world to a scene — a police chase, a drive through traffic, a walk to a job —
// then plays the real rules forward for a couple of seconds with scripted input,
// so the frame is what a short game really looks like and the same seed always
// gives the same frame.

import { STEP } from './config.js';
import { createCar } from './entities.js';
import { stepWorld } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function clearPolice(state) {
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.peds = state.peds.filter((p) => p.state !== 'officer');
}

function putPlayerInCar(state, car, x, y, angle, speed) {
  const player = state.player;
  player.inCar = car;
  car.driver = 'player';
  car.kind = car.kind === 'truck' ? 'truck' : 'player';
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  player.x = x;
  player.y = y;
}

function addPoliceCar(state, x, y, speed) {
  const car = createCar('police', x, y, 0, '#f2f2f2', 'police');
  car.speed = speed;
  state.cars.push(car);
  return car;
}

/** Drive forward for `seconds` with the throttle held, then stop. */
function driveForward(state, input, seconds) {
  input.state.up = true;
  input.state.down = false;
  input.state.left = false;
  input.state.right = false;
  input.state.fire = false;
  for (let i = 0; i < seconds / STEP; i += 1) stepWorld(state, input, STEP);
  input.state.up = false;
}

/** Clear the road ahead of the player so a staged chase reads as a chase, not a jam. */
function clearCorridor(state, x0, x1, y, halfWidth) {
  for (const car of state.cars) {
    if (car.dead || car.kind === 'police' || car === state.player.inCar) continue;
    if (car.x > x0 && car.x < x1 && Math.abs(car.y - y) < halfWidth) car.dead = true;
  }
}

export function stageShot(name, state, input) {
  const player = state.player;
  clearPolice(state);
  player.inCar = null;
  player.health = 100;
  state.wanted = 0;
  state.heatTimer = 0;
  state.missionState.enemies = [];

  if (name === 'cover') {
    // A three-star chase at golden hour: the getaway, cops behind, the safehouse ahead.
    state.clock = 17.6;
    state.missionState.index = 3;
    state.missionState.step = 0;
    const car = state.cars.find((c) => c.kind === 'parked' && !c.dead);
    car.color = '#e83a2e'; // The getaway car reads at a glance: bright red.
    putPlayerInCar(state, car, 1300, 1000, 0, 360);
    clearCorridor(state, 1200, 2400, 1000, 70);
    addPoliceCar(state, 1080, 976, 380);
    addPoliceCar(state, 1000, 1044, 370);
    state.wanted = 3;
    state.lastSeen = { x: 1300, y: 1000 };
    state.lastSeenTime = state.elapsed;
    driveForward(state, input, 1.6);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'drive') {
    // Cruising through downtown traffic as the sun drops.
    state.clock = 17.2;
    state.missionState.index = 0;
    state.missionState.step = 1;
    const car = state.cars.find((c) => c.kind === 'parked' && !c.dead);
    car.color = '#e83a2e'; // The player's car reads at a glance: bright red.
    putPlayerInCar(state, car, 900, 600, 0, 300);
    clearCorridor(state, 800, 2000, 600, 70);
    driveForward(state, input, 1.2);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'foot') {
    // On foot at the marina, the pickup job ahead, the city alive around him.
    state.clock = 16.0;
    state.missionState.index = 1;
    state.missionState.step = 0;
    player.x = state.city.places.pier.x - 120;
    player.y = state.city.places.pier.y - 60;
    player.angle = Math.PI / 4;
    for (let i = 0; i < 40; i += 1) stepWorld(state, input, STEP);
    return { screen: SCREEN_PLAY };
  }
  // Any other name is the title screen.
  state.clock = 17.8;
  player.x = state.city.places.start.x;
  player.y = state.city.places.start.y;
  for (let i = 0; i < 30; i += 1) stepWorld(state, input, STEP);
  return { screen: SCREEN_TITLE };
}
