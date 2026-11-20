// The world: everything in Solmar City in one state, advanced one fixed step at a
// time. The player walks or drives, traffic and pedestrians live their lives, the
// police answer the wanted level, missions advance, and the clock turns. step()
// returns the events the frame caused, so the caller can play sounds and toasts
// without the world knowing about audio or the DOM.

import { CAR, CLOCK_RATE, MONEY, PISTOL, PLAYER, STEP, WANTED, WORLD } from './config.js';
import { createCity, hitsBuilding } from './city.js';
import { createRandom, randomPick, randomRange } from './random.js';
import {
  circleHitsCar,
  collideCars,
  createCar,
  createPed,
  createPlayer,
  pointHitsCar,
  stepDriveCar,
  stepPlayerOnFoot,
} from './entities.js';
import { nearestCar, spawnPeds, spawnTraffic, stepTraffic } from './traffic.js';
import { addWanted, nearestPoliceDistance, stepPolice } from './police.js';
import { createMissionList, createMissionState, currentMarker, stepEnemies, updateMissions } from './missions.js';

const EVENT = {
  GUNSHOT: 'gunshot',
  PUNCH: 'punch',
  CRASH: 'crash',
  PICKUP: 'pickup',
  CASH: 'cash',
  KILL: 'kill',
  DAMAGE: 'damage',
  STEAL: 'steal',
  ENTER: 'enter',
  EXIT: 'exit',
  RELOAD: 'reload',
  SPRAY: 'spray',
  HEAL: 'heal',
  AMMO: 'ammo',
  BUSTED: 'busted',
  WASTED: 'wasted',
};

const PED_COLORS = ['#e8e8e8', '#d94f3d', '#3d7dd9', '#e8c832', '#7ac74f', '#d97ab8', '#8a5fd9', '#e8821e', '#4db8a8'];

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(random);
  const player = createPlayer(city.places.start.x, city.places.start.y);
  player.money = MONEY.start;

  const cars = [];
  // Parked cars from the city's kerb spots.
  for (const spot of city.parkingSpots) {
    cars.push(createCar('parked', spot.x, spot.y, spot.angle, spot.color, null));
  }
  // The shipment truck waits at the warehouse for the last job.
  const truck = createCar('truck', city.places.warehouse.x + 90, city.places.warehouse.y + 40, 0, '#e8821e', null);
  cars.push(truck);
  // A couple of cars right by the start, so the first job is quick.
  cars.push(createCar('parked', city.places.start.x + 120, city.places.start.y, 0, '#d94f3d', null));
  cars.push(createCar('parked', city.places.start.x - 120, city.places.start.y + 60, Math.PI / 2, '#3d7dd9', null));
  for (const car of spawnTraffic(city, random, 26)) cars.push(car);

  const peds = spawnPeds(city, random, 34, player.x, player.y);

  // Cash pickups scattered around the city, plus health and ammo at their shops.
  const pickups = [];
  for (let i = 0; i < 12; i += 1) {
    pickups.push({
      kind: 'cash',
      x: randomRange(random, 200, WORLD.width - 200),
      y: randomRange(random, 200, WORLD.height - 300),
      amount: randomPick(random, [50, 75, 100, 150]),
      taken: false,
      respawn: 0,
    });
  }
  pickups.push({ kind: 'health', x: city.places.hospital.x + 60, y: city.places.hospital.y, amount: 50, taken: false, respawn: 0 });
  pickups.push({ kind: 'ammo', x: city.places.ammoShop.x + 60, y: city.places.ammoShop.y, amount: 36, taken: false, respawn: 0 });

  const state = {
    seed,
    random,
    city,
    player,
    cars,
    peds,
    pickups,
    particles: [],
    missions: createMissionList(city.places),
    missionState: createMissionState(),
    wanted: 0,
    heatTimer: 0,
    recentCrime: 0,
    lastSeen: { x: city.places.start.x, y: city.places.start.y },
    lastSeenTime: 0,
    clock: 16.0,
    elapsed: 0,
    timeSinceDamage: 99,
    shopCooldown: 0,
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0 },
  };
  state.playerPos = () => {
    const p = state.player;
    return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
  };
  return state;
}

function addParticles(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.8);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1, color, size: 2 + Math.random() * 3 });
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

function damagePlayer(state, amount, events) {
  const player = state.player;
  if (player.invulnerable > 0 || player.health <= 0) return;
  player.health -= amount;
  player.invulnerable = 0.4;
  state.timeSinceDamage = 0;
  events.push({ type: EVENT.DAMAGE, amount });
  addParticles(state, player.x, player.y, '#ff5a4e', 8, 120);
  if (player.health <= 0) {
    player.health = 0;
    events.push({ type: EVENT.WASTED });
    respawnAfterTrouble(state, 'hospital');
  }
}

function respawnAfterTrouble(state, where) {
  const player = state.player;
  const fine = where === 'hospital' ? MONEY.wastedFine : MONEY.bustedFine;
  player.money = Math.max(0, player.money - fine);
  player.health = PLAYER.health;
  player.ammo = Math.max(player.ammo, 24);
  player.mag = 12;
  if (player.inCar) {
    player.inCar.driver = null;
    if (player.inCar.kind !== 'truck') player.inCar.kind = 'parked';
    player.inCar.speed = 0;
    player.inCar = null;
  }
  state.wanted = 0;
  state.heatTimer = 0;
  state.lastSeen = { x: state.city.places.start.x, y: state.city.places.start.y };
  state.lastSeenTime = state.elapsed;
  const place = where === 'hospital' ? state.city.places.hospital : state.city.places.policeStation;
  player.x = place.x;
  player.y = place.y + 80;
  player.invulnerable = 2;
  for (const car of state.cars) {
    if (car.kind === 'police' && !car.dead) car.dead = true;
  }
  for (const ped of state.peds) {
    if (ped.state === 'officer' && !ped.dead) ped.dead = true;
  }
}

/** The player steals or enters the nearest car. */
function tryEnterCar(state, events) {
  const player = state.player;
  if (player.inCar) {
    const car = player.inCar;
    player.inCar = null;
    car.driver = null;
    if (car.kind !== 'truck') car.kind = 'parked';
    car.speed = 0;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    player.angle = car.angle;
    events.push({ type: EVENT.EXIT });
    return;
  }
  const car = nearestCar(state.cars, player.x, player.y, 78);
  if (!car) return;
  if (car.driver === 'traffic') {
    // The driver bails and runs; taking an occupied car is a crime.
    const driver = createPed(car.x, car.y, randomPick(state.random, PED_COLORS));
    driver.state = 'flee';
    driver.fleeX = player.x;
    driver.fleeY = player.y;
    state.peds.push(driver);
    car.driver = null;
    addWanted(state, WANTED.stealCar);
    state.recentCrime = 3;
    state.stats.carsStolen += 1;
    events.push({ type: EVENT.STEAL });
  } else if (car.kind === 'police') {
    addWanted(state, WANTED.stealCar);
    state.recentCrime = 3;
    events.push({ type: EVENT.STEAL });
  }
  player.inCar = car;
  car.driver = 'player';
  car.kind = car.kind === 'truck' ? 'truck' : 'player';
  events.push({ type: EVENT.ENTER });
}

/** A punch at whatever is in front of the player. */
function tryPunch(state, events) {
  const player = state.player;
  if (player.punchCooldown > 0 || player.inCar) return;
  player.punchCooldown = PLAYER.punchCooldown;
  const reach = PLAYER.punchRange + 14;
  const tx = player.x + Math.cos(player.angle) * reach;
  const ty = player.y + Math.sin(player.angle) * reach;
  let hit = false;
  for (const enemy of state.missionState.enemies) {
    if (enemy.dead) continue;
    if (Math.hypot(enemy.x - tx, enemy.y - ty) < 30) {
      enemy.hp -= PLAYER.punchDamage;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        events.push({ type: EVENT.KILL, who: 'enemy' });
      }
      hit = true;
      break;
    }
  }
  if (!hit) {
    for (const ped of state.peds) {
      if (ped.dead || ped.state === 'officer' || ped.state === 'enemy') continue;
      if (Math.hypot(ped.x - tx, ped.y - ty) < 28) {
        ped.dead = true;
        addParticles(state, ped.x, ped.y, '#c0392b', 10, 140);
        addWanted(state, WANTED.killPed);
        state.recentCrime = 3;
        events.push({ type: EVENT.KILL, who: 'ped' });
        hit = true;
        break;
      }
    }
  }
  events.push({ type: EVENT.PUNCH, hit });
}

/** Hitscan shot from the player toward the aim point. */
function tryShoot(state, events) {
  const player = state.player;
  if (player.inCar || player.fireCooldown > 0 || player.reloading > 0) return;
  if (player.mag <= 0) {
    if (player.ammo > 0) {
      player.reloading = PISTOL.reloadTime;
      events.push({ type: EVENT.RELOAD });
    }
    return;
  }
  player.mag -= 1;
  player.fireCooldown = PISTOL.fireCooldown;
  state.stats.shotsFired += 1;
  events.push({ type: EVENT.GUNSHOT });
  addParticles(state, player.x + Math.cos(player.angle) * 22, player.y + Math.sin(player.angle) * 22, '#ffd23e', 3, 90);

  const ox = player.x;
  const oy = player.y;
  const dx = Math.cos(player.angle);
  const dy = Math.sin(player.angle);
  let best = null;
  let bestAlong = PISTOL.range;
  const consider = (x, y, radius, target) => {
    const rx = x - ox;
    const ry = y - oy;
    const along = rx * dx + ry * dy;
    if (along < 10 || along > PISTOL.range) return;
    const perp = Math.abs(rx * dy - ry * dx);
    if (perp < radius + 14 && along < bestAlong) {
      bestAlong = along;
      best = target;
    }
  };
  for (const enemy of state.missionState.enemies) {
    if (!enemy.dead) consider(enemy.x, enemy.y, 14, { kind: 'enemy', ref: enemy });
  }
  for (const ped of state.peds) {
    if (!ped.dead) consider(ped.x, ped.y, 12, { kind: 'ped', ref: ped });
  }
  for (const car of state.cars) {
    if (car.dead) continue;
    consider(car.x, car.y, 26, { kind: 'car', ref: car });
  }
  if (!best) return;
  if (best.kind === 'enemy') {
    best.ref.hp -= PISTOL.damage;
    addParticles(state, best.ref.x, best.ref.y, '#c0392b', 8, 120);
    if (best.ref.hp <= 0) {
      best.ref.dead = true;
      events.push({ type: EVENT.KILL, who: 'enemy' });
    }
  } else if (best.kind === 'ped') {
    const ped = best.ref;
    ped.dead = true;
    addParticles(state, ped.x, ped.y, '#c0392b', 10, 140);
    if (ped.state === 'officer') addWanted(state, WANTED.killCop);
    else addWanted(state, WANTED.killPed);
    state.recentCrime = 3;
    events.push({ type: EVENT.KILL, who: ped.state === 'officer' ? 'cop' : 'ped' });
  } else {
    const car = best.ref;
    car.health -= PISTOL.damage;
    addParticles(state, car.x, car.y, '#ffb347', 8, 130);
    events.push({ type: EVENT.CRASH, soft: true });
    if (car.health <= 0) wreckCar(state, car, events);
    if (car.kind === 'police') {
      addWanted(state, WANTED.shootNearPolice);
      state.recentCrime = 3;
    }
  }
}

function wreckCar(state, car, events) {
  car.dead = true;
  car.speed = 0;
  addParticles(state, car.x, car.y, '#555', 24, 160);
  addParticles(state, car.x, car.y, '#ff8c1a', 14, 200);
  if (car.driver === 'traffic') {
    const driver = createPed(car.x, car.y, randomPick(state.random, PED_COLORS));
    driver.state = 'flee';
    state.peds.push(driver);
    car.driver = null;
  }
  if (state.player.inCar === car) {
    state.player.inCar = null;
    state.player.x = car.x + 50;
    state.player.y = car.y + 50;
    damagePlayer(state, 12, events);
  }
}

/** Shops: spray clears the heat, the hospital heals, the ammo shop sells bullets. */
function tryShop(state, events) {
  const player = state.player;
  if (state.shopCooldown > 0) return;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const places = state.city.places;
  if (player.inCar && Math.hypot(px - places.sprayShop.x, py - places.sprayShop.y) < 80) {
    if (state.wanted > 0 && player.money >= MONEY.sprayCost) {
      player.money -= MONEY.sprayCost;
      state.wanted = 0;
      state.heatTimer = 0;
      player.inCar.color = randomPick(state.random, ['#d94f3d', '#3d7dd9', '#e8c832', '#7ac74f', '#8a5fd9']);
      state.shopCooldown = 2;
      events.push({ type: EVENT.SPRAY });
    }
    return;
  }
  if (!player.inCar && Math.hypot(px - places.hospital.x, py - places.hospital.y) < 80) {
    if (player.health < PLAYER.health && player.money >= MONEY.healCost) {
      player.money -= MONEY.healCost;
      player.health = PLAYER.health;
      state.shopCooldown = 2;
      events.push({ type: EVENT.HEAL });
    }
    return;
  }
  if (!player.inCar && Math.hypot(px - places.ammoShop.x, py - places.ammoShop.y) < 80) {
    if (player.money >= MONEY.ammoCost) {
      player.money -= MONEY.ammoCost;
      player.ammo += MONEY.ammoPack;
      state.shopCooldown = 2;
      events.push({ type: EVENT.AMMO });
    }
  }
}

export function stepWorld(state, input, dt) {
  const events = [];
  const player = state.player;
  state.elapsed += dt;
  state.clock = (state.clock + (dt * CLOCK_RATE) / 60) % 24;
  if (state.recentCrime > 0) state.recentCrime -= dt;
  if (state.shopCooldown > 0) state.shopCooldown -= dt;
  state.timeSinceDamage += dt;
  if (player.health < PLAYER.health && state.timeSinceDamage > 8) {
    player.health = Math.min(PLAYER.health, player.health + 2 * dt);
  }

  const actions = input.takeActions();
  if (actions & 2) tryEnterCar(state, events); // ACTION_ENTER
  if (actions & 4) tryPunch(state, events); // ACTION_PUNCH
  if (actions & 8 && player.mag < 12 && player.ammo > 0 && player.reloading <= 0) {
    player.reloading = PISTOL.reloadTime;
    events.push({ type: EVENT.RELOAD });
  }
  if (actions & 2) tryShop(state, events);

  // Aim follows the mouse (world coordinates, set by the loop from the camera).
  const aimDx = input.state.aimX - player.x;
  const aimDy = input.state.aimY - player.y;
  if (!player.inCar && (Math.abs(aimDx) > 4 || Math.abs(aimDy) > 4)) {
    player.angle = Math.atan2(aimDy, aimDx);
  }
  if (input.state.fire) tryShoot(state, events);

  const steer = input.steer();
  if (player.inCar) {
    const car = player.inCar;
    const hitSpeed = stepDriveCar(car, { x: steer.x, y: steer.y }, dt, state.city);
    if (hitSpeed > 120) {
      events.push({ type: EVENT.CRASH });
      addParticles(state, car.x, car.y, '#ffb347', 10, 150);
      car.health -= Math.min(30, hitSpeed / 12);
      if (car.health <= 0) wreckCar(state, car, events);
    }
    // Running over pedestrians.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (circleHitsCar(ped, car)) {
        ped.dead = true;
        state.stats.pedsHit += 1;
        addParticles(state, ped.x, ped.y, '#c0392b', 12, 160);
        events.push({ type: EVENT.CRASH });
        if (ped.state === 'officer') addWanted(state, WANTED.killCop);
        else if (ped.state === 'enemy') events.push({ type: EVENT.KILL, who: 'enemy' });
        else addWanted(state, WANTED.hitPed);
        state.recentCrime = 3;
        car.speed *= 0.7;
      }
    }
  } else {
    stepPlayerOnFoot(player, { x: steer.x, y: steer.y, run: input.state.run }, dt, state.city);
  }

  // Car-on-car collisions.
  for (let i = 0; i < state.cars.length; i += 1) {
    const a = state.cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const b = state.cars[j];
      if (b.dead) continue;
      const impact = collideCars(a, b);
      if (impact > 160) {
        events.push({ type: EVENT.CRASH });
        addParticles(state, (a.x + b.x) / 2, (a.y + b.y) / 2, '#ffb347', 8, 140);
      }
    }
  }

  // Traffic cars and pedestrians, with the player as the thing they flee from.
  const danger = state.recentCrime > 0 || input.state.fire ? { x: player.x, y: player.y } : null;
  stepTraffic(state, dt, state.random, danger);

  // A traffic car that hits the player on foot hurts.
  if (!player.inCar) {
    for (const car of state.cars) {
      if (car.dead || car.speed < 40) continue;
      if (pointHitsCar(player.x, player.y, car)) {
        damagePlayer(state, 12, events);
        player.x += Math.cos(car.angle) * 30;
        player.y += Math.sin(car.angle) * 30;
        events.push({ type: EVENT.CRASH });
        break;
      }
    }
  }

  // Police, missions, and mission enemies.
  const policeEvents = stepPolice(state, dt, state.random);
  for (const e of policeEvents) {
    if (e === 'busted') {
      events.push({ type: EVENT.BUSTED });
      respawnAfterTrouble(state, 'police');
    } else if (e === 'heatdown') {
      events.push({ type: 'heatdown' });
    }
  }
  stepEnemies(state, dt, state.random);
  for (const enemy of state.missionState.enemies) {
    if (enemy.dead || !enemy.shot) continue;
    const target = player.inCar ? player.inCar : player;
    if (Math.hypot(enemy.shot.x - target.x, enemy.shot.y - target.y) < 34) {
      if (player.inCar) {
        player.inCar.health -= 8;
        if (player.inCar.health <= 0) wreckCar(state, player.inCar, events);
      } else {
        damagePlayer(state, 8, events);
      }
    }
    enemy.shot = null;
  }
  const missionEvents = updateMissions(state, dt, state.random);
  for (const e of missionEvents) {
    if (e.type === 'mission') {
      state.stats.missionsDone += 1;
      events.push({ type: 'mission', mission: e.mission });
    } else if (e.type === 'step') {
      events.push({ type: 'step', mission: e.mission });
    } else {
      events.push(e);
    }
  }

  // Pickups.
  for (const pickup of state.pickups) {
    if (pickup.taken) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) pickup.taken = false;
      continue;
    }
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (Math.hypot(px - pickup.x, py - pickup.y) < 36) {
      pickup.taken = true;
      pickup.respawn = 45;
      if (pickup.kind === 'cash') {
        player.money += pickup.amount;
        events.push({ type: EVENT.CASH, amount: pickup.amount });
      } else if (pickup.kind === 'health') {
        player.health = Math.min(PLAYER.health, player.health + pickup.amount);
        events.push({ type: EVENT.PICKUP });
      } else {
        player.ammo += pickup.amount;
        events.push({ type: EVENT.PICKUP });
      }
    }
  }

  // Particles.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  // Prune the dead that are gone for good.
  state.cars = state.cars.filter((c) => !c.gone);
  state.peds = state.peds.filter((p) => !p.gone);
  return events;
}

export function markerFor(state) {
  return currentMarker(state.missions, state.missionState);
}

export function nearestPolice(state) {
  return nearestPoliceDistance(state);
}
