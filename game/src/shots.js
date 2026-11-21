// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a small scripted driver, so the frame is what a short
// game really looks like — and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

/** Hold W and steer gently to stay on the road the car is already on. */
function driveInput(world, seconds) {
  const player = world.state.player;
  const car = world.state.cars.find((c) => c.id === player.inCar);
  if (!car) return { up: true, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, aim: null };
  // Steer back toward the nearest road centre line.
  const vertical = Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
  const road = vertical ? nearestRoad(car.x, 'x') : nearestRoad(car.y, 'y');
  const off = vertical ? car.x - road : car.y - road;
  const turningLeft = car.angle > 0;
  void turningLeft;
  const steerLeft = vertical ? off > 0 : off < 0;
  return {
    up: true,
    down: false,
    left: steerLeft,
    right: !steerLeft,
    run: false,
    enter: false,
    punch: false,
    shoot: false,
    aim: null,
  };
}

function nearestRoad(value, axis) {
  void axis;
  const lines = [];
  for (let at = 200; at <= 5000; at += 400) lines.push(at);
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

function stepFor(world, seconds, inputFn) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    world.step(SAMPLE, inputFn ? inputFn(i * SAMPLE) : { up: false, down: false, left: false, right: false, run: false, enter: false, punch: false, shoot: false, aim: null });
  }
}

/** Put the player in a car on a long straight road, facing south. */
function putInCar(world, x, y) {
  const car = world.debug.giveCar();
  car.x = x;
  car.y = y;
  car.angle = Math.PI / 2;
  car.kind = 'parked';
  world.debug.teleport(x - 30, y);
  world.step(STEP, { up: false, down: false, left: false, right: false, run: false, enter: true, punch: false, shoot: false, aim: null });
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any unknown name is the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'drive') {
    putInCar(world, 2600, 1000);
    stepFor(world, 7, () => driveInput(world));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    putInCar(world, 2600, 1400);
    stepFor(world, 2, () => driveInput(world));
    world.debug.setWanted(3);
    stepFor(world, 6, () => driveInput(world));
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    world.debug.startMission(3);
    const harbor = { x: 1000, y: 4900 };
    world.debug.teleport(harbor.x + 150, harbor.y - 130);
    world.debug.placeRivalsAt(harbor.x - 40, harbor.y - 110);
    stepFor(world, 3, (t) => {
      const rival = world.state.rivals.find((r) => r.alive);
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        run: false,
        enter: false,
        punch: false,
        shoot: t > 2.0 && !!rival,
        aim: rival ? { x: rival.x, y: rival.y } : null,
      };
    });
    return { screen: SCREEN_PLAY };
  }
  // Title: let the city live for a few seconds behind the menu.
  stepFor(world, 5, null);
  return { screen: SCREEN_TITLE };
}
