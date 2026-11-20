// The wanted system and the Solmar PD. Crimes raise the star level; the police
// answer with cars that chase and ram, and officers on foot who chase and try to
// arrest the player. Out of sight and out of trouble, the heat cools off. A trip
// to the spray shop clears it for a price.

import { POLICE, WANTED, WORLD } from './config.js';
import { createCar, createPed } from './entities.js';
import { resolveBuildings } from './city.js';
import { randomPick, randomRange } from './random.js';

const OFFICER_SHIRTS = ['#2b4a8a', '#243a6e', '#35579e'];

/** Raise the wanted level, capped at five stars. Returns the new level. */
export function addWanted(state, amount) {
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.heatTimer = 0;
  return state.wanted > before ? state.wanted : -1;
}

/** How many police cars and officers the current heat calls for. */
export function wantedStrength(wanted) {
  return {
    cars: wanted === 0 ? 0 : Math.min(POLICE.maxCars, 1 + Math.floor(wanted / 2) + (wanted >= 4 ? 1 : 0)),
    officers: wanted >= 2 ? Math.min(POLICE.maxOfficers, wanted - 1) : 0,
  };
}

function spawnPoliceCar(state, random) {
  const player = state.playerPos();
  const angle = random() * Math.PI * 2;
  const dist = POLICE.spawnDistance + randomRange(random, 0, 260);
  const x = Math.max(120, Math.min(WORLD.width - 120, player.x + Math.cos(angle) * dist));
  const y = Math.max(120, Math.min(WORLD.height - 120, player.y + Math.sin(angle) * dist));
  const car = createCar('police', x, y, Math.atan2(player.y - y, player.x - x), '#f2f2f2', 'police');
  car.speed = 200;
  car.cruise = POLICE.carSpeed;
  state.cars.push(car);
  return car;
}

function spawnOfficer(state, random) {
  const player = state.playerPos();
  const angle = random() * Math.PI * 2;
  const dist = POLICE.spawnDistance * 0.7 + randomRange(random, 0, 200);
  const x = Math.max(120, Math.min(WORLD.width - 120, player.x + Math.cos(angle) * dist));
  const y = Math.max(120, Math.min(WORLD.height - 120, player.y + Math.sin(angle) * dist));
  const officer = createPed(x, y, randomPick(random, OFFICER_SHIRTS));
  officer.state = 'officer';
  officer.arrest = 0;
  state.peds.push(officer);
  return officer;
}

function countPolice(state) {
  let cars = 0;
  let officers = 0;
  for (const car of state.cars) if (car.kind === 'police' && !car.dead) cars += 1;
  for (const ped of state.peds) if (ped.state === 'officer' && !ped.dead) officers += 1;
  return { cars, officers };
}

/**
 * Keep the police presence matched to the heat, and move the pursuit. The police
 * chase the player's last seen position, not the player himself: break line of
 * sight (520 units) and stay quiet, and the heat cools one star at a time. When
 * they reach the last seen spot without finding him, they search around it.
 * Returns events: 'busted' when an officer holds the player long enough on foot.
 */
export function stepPolice(state, dt, random) {
  const player = state.playerPos();
  const events = [];

  // Seen if any police unit is close, or the player is committing a crime right now.
  let seen = state.recentCrime > 0;
  if (!seen) {
    for (const car of state.cars) {
      if (car.kind === 'police' && !car.dead && Math.hypot(car.x - player.x, car.y - player.y) < 520) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      for (const ped of state.peds) {
        if (ped.state === 'officer' && !ped.dead && Math.hypot(ped.x - player.x, ped.y - player.y) < 420) {
          seen = true;
          break;
        }
      }
    }
  }
  if (seen) {
    state.lastSeen = { x: player.x, y: player.y };
    state.lastSeenTime = state.elapsed;
  }

  if (state.wanted > 0) {
    state.heatTimer += dt;
    if (!seen && state.elapsed - state.lastSeenTime > POLICE.decaySeconds) {
      state.wanted -= 1;
      state.lastSeenTime = state.elapsed;
      events.push('heatdown');
    }
    const want = wantedStrength(state.wanted);
    const have = countPolice(state);
    if (have.cars < want.cars) spawnPoliceCar(state, random);
    if (have.officers < want.officers) spawnOfficer(state, random);
  } else {
    // No heat: the force stands down and drives off (never the player's own ride).
    for (const car of state.cars) {
      if (car.kind === 'police' && !car.dead && car.driver !== 'player') {
        car.dead = true;
        car.gone = true;
      }
    }
    for (const ped of state.peds) {
      if (ped.state === 'officer' && !ped.dead) {
        ped.dead = true;
        ped.gone = true;
      }
    }
  }

  // Police cars chase the last seen position and ram what they find there.
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.dead) continue;
    let tx = state.lastSeen.x;
    let ty = state.lastSeen.y;
    if (Math.hypot(tx - car.x, ty - car.y) < 90 && !seen) {
      // Lost him here: search a random point nearby.
      if (!car.searchX || Math.hypot(car.searchX - car.x, car.searchY - car.y) < 60) {
        car.searchX = tx + randomRange(random, -380, 380);
        car.searchY = ty + randomRange(random, -380, 380);
      }
      tx = car.searchX;
      ty = car.searchY;
    }
    const dx = tx - car.x;
    const dy = ty - car.y;
    const d = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.9 * dt, Math.min(2.9 * dt, diff));
    const targetSpeed = d > 260 ? POLICE.carSpeed : POLICE.carSpeed * 0.8;
    car.speed += Math.max(-320 * dt, Math.min(320 * dt, targetSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.sirenPhase += dt;
    // Pursuit cars still have to go around buildings, like everyone else.
    resolveBuildings(state.city, car);
    car.x = Math.max(60, Math.min(WORLD.width - 60, car.x));
    car.y = Math.max(60, Math.min(WORLD.height - 60, car.y));
  }

  // Officers on foot chase; hold the player close and he is busted.
  for (const ped of state.peds) {
    if (ped.state !== 'officer' || ped.dead) continue;
    const dx = player.x - ped.x;
    const dy = player.y - ped.y;
    const d = Math.hypot(dx, dy) || 1;
    const onFoot = !state.player.inCar;
    if (onFoot && d < POLICE.arrestRange) {
      ped.arrest = (ped.arrest || 0) + dt;
      if (ped.arrest >= POLICE.arrestTime) {
        events.push('busted');
        ped.arrest = 0;
        return events;
      }
    } else {
      ped.arrest = 0;
    }
    const speed = POLICE.officerSpeed * (d > 200 ? 1 : 0.9);
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
  }
  return events;
}

/** The closest police unit to the player, for the siren volume. */
export function nearestPoliceDistance(state) {
  const player = state.playerPos();
  let best = Infinity;
  for (const car of state.cars) {
    if (car.kind === 'police' && !car.dead) best = Math.min(best, Math.hypot(car.x - player.x, car.y - player.y));
  }
  for (const ped of state.peds) {
    if (ped.state === 'officer' && !ped.dead) best = Math.min(best, Math.hypot(ped.x - player.x, ped.y - player.y));
  }
  return best;
}
