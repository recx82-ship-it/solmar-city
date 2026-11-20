// Traffic and pedestrians. Traffic cars drive the road grid: each one follows a road
// centre line in a lane, turns at intersections now and then, and slows for the car
// ahead. Pedestrians walk the sidewalks between random waypoints and run from
// gunfire, speeding cars and the player when he is causing trouble.

import { LANE, PEDS, ROADS_X, ROADS_Y, TRAFFIC, WORLD } from './config.js';
import { createCar, createPed } from './entities.js';
import { nearestRoadPoint, resolveBuildings } from './city.js';
import { randomPick, randomRange } from './random.js';

const PED_SHIRTS = ['#e8e8e8', '#d94f3d', '#3d7dd9', '#e8c832', '#7ac74f', '#d97ab8', '#8a5fd9', '#e8821e', '#4db8a8'];

export function spawnTraffic(city, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = random() < 0.5;
    const road = vertical ? randomPick(random, ROADS_X) : randomPick(random, ROADS_Y);
    const dir = random() < 0.5 ? 1 : -1;
    const lane = (random() < 0.5 ? -1 : 1) * (LANE + 8);
    const x = vertical ? road + lane : randomRange(random, 120, WORLD.width - 120);
    const y = vertical ? randomRange(random, 120, WORLD.height - 120) : road + lane;
    const car = createCar('traffic', x, y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI, randomPick(random, city.carColors), 'traffic');
    car.road = road;
    car.roadVertical = vertical;
    car.roadDir = dir;
    car.cruise = TRAFFIC.speed + randomRange(random, -TRAFFIC.speedJitter, TRAFFIC.speedJitter);
    car.speed = car.cruise;
    cars.push(car);
  }
  return cars;
}

export function spawnPeds(city, random, count, playerX, playerY) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const road = nearestRoadPoint(randomRange(random, 100, WORLD.width - 100), randomRange(random, 100, WORLD.height - 100));
    const side = random() < 0.5 ? -1 : 1;
    const x = road.vertical ? road.x + side * (LANE + 34) : road.x;
    const y = road.vertical ? road.y : road.y + side * (LANE + 34);
    if (Math.hypot(x - playerX, y - playerY) < 260) continue;
    const ped = createPed(x, y, randomPick(random, PED_SHIRTS));
    pickPedTarget(ped, random);
    peds.push(ped);
  }
  return peds;
}

function pickPedTarget(ped, random) {
  const road = nearestRoadPoint(ped.x, ped.y);
  if (road.vertical) {
    ped.targetX = road.x + (random() < 0.5 ? -1 : 1) * (LANE + 34);
    ped.targetY = Math.max(120, Math.min(WORLD.height - 120, ped.y + randomRange(random, -500, 500)));
  } else {
    ped.targetX = Math.max(120, Math.min(WORLD.width - 120, ped.x + randomRange(random, -500, 500)));
    ped.targetY = road.y + (random() < 0.5 ? -1 : 1) * (LANE + 34);
  }
}

/** One traffic car: follow its road, maybe turn at an intersection, slow for traffic. */
function stepTrafficCar(car, cars, dt, random) {
  const ahead = car.roadVertical ? car.roadDir > 0 ? car.y + 70 : car.y - 70 : car.roadDir > 0 ? car.x + 70 : car.x - 70;
  let blocked = false;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    if (other.roadVertical !== car.roadVertical || other.road !== car.road) continue;
    if (Math.sign(other.roadDir) !== Math.sign(car.roadDir)) continue;
    const along = car.roadVertical ? other.y - car.y : other.x - car.x;
    const lateral = car.roadVertical ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
    if (along * car.roadDir > 0 && along * car.roadDir < 80 && lateral < 40) {
      blocked = true;
      break;
    }
  }
  const target = blocked ? 0 : car.cruise;
  car.speed += Math.max(-260 * dt, Math.min(160 * dt, target - car.speed));

  // At an intersection, sometimes turn onto the crossing road.
  const roads = car.roadVertical ? ROADS_Y : ROADS_X;
  const pos = car.roadVertical ? car.y : car.x;
  for (const cross of roads) {
    if (Math.abs(pos - cross) < 6 && random() < TRAFFIC.turnChance) {
      const turnDir = random() < 0.5 ? 1 : -1;
      const lane = (random() < 0.5 ? -1 : 1) * (LANE + 8);
      car.roadVertical = !car.roadVertical;
      car.road = cross;
      car.roadDir = turnDir;
      car.angle = car.roadVertical ? (turnDir > 0 ? Math.PI / 2 : -Math.PI / 2) : turnDir > 0 ? 0 : Math.PI;
      if (car.roadVertical) car.x = cross + lane;
      else car.y = cross + lane;
      break;
    }
  }

  const speed = car.speed;
  if (car.roadVertical) {
    car.y += speed * car.roadDir * dt;
    car.x += (car.road + (car.roadDir > 0 ? 1 : -1) * (LANE + 8) - car.x) * Math.min(1, dt * 2);
    if (car.y < 110 || car.y > WORLD.height - 110) car.roadDir *= -1;
  } else {
    car.x += speed * car.roadDir * dt;
    car.y += (car.road + (car.roadDir > 0 ? 1 : -1) * (LANE + 8) - car.y) * Math.min(1, dt * 2);
    if (car.x < 110 || car.x > WORLD.width - 110) car.roadDir *= -1;
  }
  car.angle = car.roadVertical ? (car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.roadDir > 0 ? 0 : Math.PI;
}

/** Pedestrians walk, pause, and run from a danger point when one is given. */
function stepPed(ped, dt, random, danger) {
  let speed = PEDS.walk;
  let tx = ped.targetX;
  let ty = ped.targetY;
  if (danger) {
    const d = Math.hypot(ped.x - danger.x, ped.y - danger.y);
    if (d < 320) {
      speed = PEDS.flee;
      const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
      tx = ped.x + Math.cos(away) * 200;
      ty = ped.y + Math.sin(away) * 200;
    }
  }
  const dx = tx - ped.x;
  const dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    ped.pause -= dt;
    if (ped.pause <= 0) {
      pickPedTarget(ped, random);
      ped.pause = randomRange(random, 0, 2.5);
    }
    ped.speed = 0;
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  ped.x += (dx / d) * speed * dt;
  ped.y += (dy / d) * speed * dt;
  ped.speed = speed;
  const hit = resolveBuildings({ buildings: ped.cityBuildings || [] }, ped);
  void hit;
}

export function stepTraffic(state, dt, random, danger) {
  for (const car of state.cars) {
    if (car.kind === 'traffic' && !car.dead) stepTrafficCar(car, state.cars, dt, random);
  }
  for (const ped of state.peds) {
    if (ped.dead) continue;
    ped.cityBuildings = state.city.buildings;
    stepPed(ped, dt, random, danger);
    if (ped.x < 60 || ped.x > WORLD.width - 60 || ped.y < 60 || ped.y > WORLD.height - 60) {
      // A pedestrian who walks off the map walks back in somewhere else.
      const road = nearestRoadPoint(randomRange(random, 200, WORLD.width - 200), randomRange(random, 200, WORLD.height - 200));
      ped.x = road.x;
      ped.y = road.y;
      pickPedTarget(ped, random);
    }
  }
}

/** The nearest drivable car to a point, within range, that is not wrecked. */
export function nearestCar(cars, x, y, range) {
  let best = null;
  let bestD = range;
  for (const car of cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
