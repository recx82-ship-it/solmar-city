// The moving things and how they move: the player on foot, cars (parked, traffic,
// police, the player's), and pedestrians. Car physics are arcade: accelerate, steer
// with speed, a little slide. Collisions are circles against buildings and each other.

import { CAR, PLAYER, WORLD } from './config.js';
import { resolveBuildings } from './city.js';

let nextCarId = 1;
let nextPedId = 1;

const PLAYER_MAG = 12;

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    health: PLAYER.health,
    money: 0,
    ammo: 60,
    mag: PLAYER_MAG,
    reloading: 0,
    punchCooldown: 0,
    fireCooldown: 0,
    invulnerable: 0,
    inCar: null,
    speed: 0,
  };
}

export function createCar(kind, x, y, angle, color, driver = null) {
  return {
    id: nextCarId,
    kind,
    x,
    y,
    angle,
    speed: 0,
    color,
    health: CAR.health,
    driver,
    radius: 30,
    dead: false,
    // Traffic AI state.
    road: null,
    roadVertical: true,
    roadDir: 1,
    lane: 0,
    cruise: 0,
    stuck: 0,
    sirenPhase: 0,
  };
}

export function createPed(x, y, color) {
  return {
    id: nextPedId,
    x,
    y,
    angle: Math.random() * Math.PI * 2,
    radius: 12,
    speed: 0,
    color,
    state: 'walk',
    targetX: x,
    targetY: y,
    fleeX: 0,
    fleeY: 0,
    pause: 0,
  };
}

/** Clamp a body inside the world (the beach is walkable; the ocean is not). */
export function clampWorld(body, margin) {
  body.x = Math.max(margin, Math.min(WORLD.width - margin, body.x));
  body.y = Math.max(margin, Math.min(WORLD.height - margin, body.y));
}

function moveCircle(body, dx, dy, city) {
  body.x += dx;
  body.y += dy;
  resolveBuildings(city, body);
  clampWorld(body, body.radius + 4);
}

/** Walk the player on foot from the steering vector; returns the speed reached. */
export function stepPlayerOnFoot(player, steer, dt, city) {
  const run = steer.run ? PLAYER.run : PLAYER.walk;
  const len = Math.hypot(steer.x, steer.y);
  let speed = 0;
  if (len > 0.01) {
    const nx = steer.x / len;
    const ny = steer.y / len;
    moveCircle(player, nx * run * dt, ny * run * dt, city);
    player.angle = Math.atan2(ny, nx);
    speed = run;
  }
  player.speed = speed;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      const need = PLAYER_MAG - player.mag;
      const take = Math.min(need, player.ammo);
      player.mag += take;
      player.ammo -= take;
      player.reloading = 0;
    }
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
  return speed;
}

/**
 * Drive a car from the steering vector: W/S throttle, A/D steer. Steering bites
 * harder the faster the car goes, and the back end slides a little at speed.
 */
export function stepDriveCar(car, steer, dt, city) {
  const throttle = -steer.y;
  const steerInput = steer.x;

  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 140 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(CAR.maxSpeed, car.speed));

  const turnAuthority = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steerInput * CAR.turnRate * turnAuthority * Math.sign(car.speed || 1) * dt;

  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  const ox = car.x;
  const oy = car.y;
  car.x += nx * car.speed * dt;
  car.y += ny * car.speed * dt;
  const hit = resolveBuildings(city, { x: car.x, y: car.y, radius: 26 });
  if (hit) {
    // A wall stops the car dead and costs speed, not the building.
    const hitSpeed = Math.abs(car.speed);
    car.x = ox;
    car.y = oy;
    car.speed *= -0.25;
    return hitSpeed;
  }
  clampWorld(car, 30);
  return 0;
}

/** Two circles of a car (nose and tail) against a point; used for ped and bullet hits. */
export function carCircles(car) {
  const nx = Math.cos(car.angle);
  const ny = Math.sin(car.angle);
  return [
    { x: car.x + nx * 15, y: car.y + ny * 15, r: 17 },
    { x: car.x - nx * 15, y: car.y - ny * 15, r: 17 },
  ];
}

/** Push two cars apart and trade speed; returns the impact speed, if any. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 44;
  if (d >= min || d === 0) return 0;
  const nx = dx / d;
  const ny = dy / d;
  const push = (min - d) / 2;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  // Velocity vectors along each car's heading, split into the part along the
  // line between the cars and the part across it. A faster car shoves the slower
  // one forward instead of both grinding to a halt.
  const avx = Math.cos(a.angle) * a.speed;
  const avy = Math.sin(a.angle) * a.speed;
  const bvx = Math.cos(b.angle) * b.speed;
  const bvy = Math.sin(b.angle) * b.speed;
  const van = avx * nx + avy * ny;
  const vbn = bvx * nx + bvy * ny;
  const closing = van - vbn;
  if (closing <= 0) return 0;
  const exchange = (closing * (1 + 0.35)) / 2;
  const avn2 = van - exchange;
  const bvn2 = vbn + exchange;
  const avx2 = avx - van * nx + avn2 * nx;
  const avy2 = avy - van * ny + avn2 * ny;
  const bvx2 = bvx - vbn * nx + bvn2 * nx;
  const bvy2 = bvy - vbn * ny + bvn2 * ny;
  a.speed = avx2 * Math.cos(a.angle) + avy2 * Math.sin(a.angle);
  b.speed = bvx2 * Math.cos(b.angle) + bvy2 * Math.sin(b.angle);
  return closing;
}

/** A point against a car's two circles. */
export function pointHitsCar(px, py, car) {
  for (const c of carCircles(car)) {
    const dx = px - c.x;
    const dy = py - c.y;
    if (dx * dx + dy * dy < c.r * c.r) return true;
  }
  return false;
}

/** A circle against a car's two circles. */
export function circleHitsCar(body, car) {
  for (const c of carCircles(car)) {
    const dx = body.x - c.x;
    const dy = body.y - c.y;
    const r = c.r + body.radius;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}
