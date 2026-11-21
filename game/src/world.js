// Solmar City's rules and state, with no drawing and no browser in it: the
// player on foot and behind the wheel, traffic, pedestrians, the police and
// the wanted level, combat, the five story missions and the day cycle.
// step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sound, banners, saves) without the world knowing
// about screens. Nothing here allocates after createWorld returns.

import { CAR, DAY, ECONOMY, MISSIONS, PEDESTRIANS, PLAYER, POLICE, STEP, TRAFFIC, WANTED, WORLD } from './config.js';
import { intRange, pick, range } from './random.js';
import { nearestRoadCoord, onRoad, snapToRoad } from './city.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_STEAL = 4;
export const EVENT_STAR = 8;
export const EVENT_MISSION = 16;
export const EVENT_WASTED = 32;
export const EVENT_PICKUP = 64;
export const EVENT_HORN = 128;

const TWO_PI = Math.PI * 2;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function turnToward(angle, target, maxStep) {
  let diff = target - angle;
  while (diff > Math.PI) diff -= TWO_PI;
  while (diff < -Math.PI) diff += TWO_PI;
  return angle + clamp(diff, -maxStep, maxStep);
}

export function createWorld(random, city) {
  const state = {
    player: { x: 0, y: 0, angle: -Math.PI / 2, health: PLAYER.health, inCar: null, punchCd: 0, fireCd: 0, speed: 0 },
    cars: [],
    peds: [],
    rivals: [],
    bullets: [],
    enemyBullets: [],
    wanted: 0,
    wantedTimer: 0,
    maxWantedReached: 0,
    cash: ECONOMY.startCash,
    missionIndex: 0,
    objectiveIndex: 0,
    objectiveState: {},
    missionDone: false,
    gameWon: false,
    banner: '',
    bannerTimer: 0,
    hour: DAY.startHour,
    elapsed: 0,
    carsStolen: 0,
    shotsFired: 0,
    rivalsDown: 0,
    busted: false,
    vaultTimer: 0,
    policeTimer: 0,
  };

  let nextCarId = 1;

  function makeCar(x, y, angle, kind, color) {
    const car = {
      id: nextCarId,
      x,
      y,
      angle,
      speed: 0,
      color,
      kind,
      axis: 'h',
      dir: 1,
      lane: 0,
      targetSpeed: 0,
      health: kind === 'police' ? 220 : 180,
      stuck: 0,
      turnCooldown: 0,
    };
    nextCarId += 1;
    return car;
  }

  function spawnTrafficCar() {
    const point = city.randomRoadPoint();
    const vertical = Math.abs(point.x - nearestRoadCoord(point.x)) < 1;
    const dir = random() < 0.5 ? -1 : 1;
    const car = makeCar(point.x, point.y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI, 'traffic', pick(random, city.carColors));
    car.axis = vertical ? 'v' : 'h';
    car.dir = dir;
    car.lane = (random() < 0.5 ? -1 : 1) * 22;
    car.targetSpeed = range(random, TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
    car.speed = car.targetSpeed;
    return car;
  }

  function spawnParkedCar() {
    const point = city.randomRoadPoint();
    const vertical = Math.abs(point.x - nearestRoadCoord(point.x)) < 1;
    const side = random() < 0.5 ? -1 : 1;
    const x = vertical ? point.x + side * (WORLD.roadWidth / 2 - 12) : point.x;
    const y = vertical ? point.y : point.y + side * (WORLD.roadWidth / 2 - 12);
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI;
    const car = makeCar(x, y, angle, 'parked', pick(random, city.carColors));
    car.axis = vertical ? 'v' : 'h';
    return car;
  }

  function spawnPed() {
    const point = city.randomSidewalkPoint();
    const vertical = Math.abs(point.x - nearestRoadCoord(point.x)) > WORLD.roadWidth / 2;
    const ped = {
      x: point.x,
      y: point.y,
      angle: pick(random, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: range(random, 28, 52),
      state: 'walk',
      timer: range(random, 2, 8),
      downTimer: 0,
      color: pick(random, ['#e84c3d', '#3d7dd9', '#e8c33d', '#7ec850', '#c96fd9', '#f28c2e', '#e8e8e8', '#5fa8c9']),
      skin: pick(random, ['#e8b58a', '#c98d5f', '#8a5a3b', '#f2c9a0']),
    };
    return ped;
  }

  function spawnPolice() {
    const point = snapToRoad(
      state.player.x + range(random, -250, 250),
      state.player.y + range(random, -250, 250),
    );
    const clamped = {
      x: clamp(point.x, 240, WORLD.size - 240),
      y: clamp(point.y, 240, WORLD.size - 240),
    };
    const car = makeCar(clamped.x, clamped.y, angleTo(clamped.x, clamped.y, state.player.x, state.player.y), 'police', '#1c2733');
    car.speed = POLICE.speed * 0.7;
    car.targetSpeed = POLICE.speed;
    return car;
  }

  function spawnRivals() {
    state.rivals = [];
    const base = city.places.harbor;
    for (let i = 0; i < 4; i += 1) {
      state.rivals.push({
        x: clamp(base.x + range(random, -160, 160), 200, WORLD.size - 200),
        y: clamp(base.y + range(random, -120, 120), 200, WORLD.size - 200),
        health: 50,
        alive: true,
        fireTimer: range(random, 0.5, 1.5),
        angle: 0,
      });
    }
  }

  function reset() {
    state.player.x = city.places.spawn.x;
    state.player.y = city.places.spawn.y;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.inCar = null;
    state.player.punchCd = 0;
    state.player.fireCd = 0;
    state.player.speed = 0;
    state.cars = [];
    state.peds = [];
    state.rivals = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.wanted = 0;
    state.wantedTimer = 0;
    state.maxWantedReached = 0;
    state.cash = ECONOMY.startCash;
    state.missionIndex = 0;
    state.objectiveIndex = 0;
    state.objectiveState = {};
    state.missionDone = false;
    state.gameWon = false;
    state.banner = '';
    state.bannerTimer = 0;
    state.hour = DAY.startHour;
    state.elapsed = 0;
    state.carsStolen = 0;
    state.shotsFired = 0;
    state.rivalsDown = 0;
    state.busted = false;
    state.vaultTimer = 0;
    state.policeTimer = 0;
    nextCarId = 1;
    for (let i = 0; i < TRAFFIC.count; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < 8; i += 1) state.cars.push(spawnParkedCar());
    for (let i = 0; i < PEDESTRIANS.count; i += 1) state.peds.push(spawnPed());
    startObjective();
  }

  function currentMission() {
    return MISSIONS[state.missionIndex] ?? null;
  }

  function currentObjective() {
    const mission = currentMission();
    return mission ? mission.objectives[state.objectiveIndex] ?? null : null;
  }

  function objectiveText() {
    const mission = currentMission();
    if (!mission) return state.gameWon ? 'Solmar City is yours.' : '';
    const objective = currentObjective();
    if (!objective) return mission.title;
    if (objective.kind === 'clear') {
      const left = state.rivals.filter((r) => r.alive).length;
      return `Deal with the Salt Dogs (${left} left)`;
    }
    if (objective.kind === 'heat') {
      if (!state.objectiveState.reached) return 'Draw police attention (reach 2 stars)';
      return 'Lose the cops — get your wanted level to 0';
    }
    return objective.text;
  }

  function startObjective() {
    const objective = currentObjective();
    state.objectiveState = {};
    if (!objective) return;
    if (objective.kind === 'clear') spawnRivals();
    if (objective.kind === 'heat') state.objectiveState.reached = false;
  }

  function addWanted(amount) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + amount, 0, 5);
    state.maxWantedReached = Math.max(state.maxWantedReached, state.wanted);
    if (state.wanted > before) return true;
    return false;
  }

  function setBanner(text, seconds = 3.5) {
    state.banner = text;
    state.bannerTimer = seconds;
  }

  function completeObjective() {
    const mission = currentMission();
    state.objectiveIndex += 1;
    if (state.objectiveIndex < mission.objectives.length) {
      startObjective();
      return EVENT_PICKUP;
    }
    // Mission complete: pay out and move to the next job.
    state.cash += mission.reward;
    state.missionDone = true;
    setBanner(`${mission.title} complete — $${mission.reward}`, 4);
    state.missionIndex += 1;
    state.objectiveIndex = 0;
    if (state.missionIndex >= MISSIONS.length) {
      state.gameWon = true;
      setBanner('THE BIG SCORE — Solmar City is yours, Jax.', 6);
    } else {
      startObjective();
    }
    return EVENT_MISSION;
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of state.cars) {
      const d = dist(x, y, car.x, car.y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  /** Resolve a circle against buildings, moving it out along the shallow axis. */
  function pushOutOfBuildings(pos, radius) {
    const hit = city.collideCircle(pos.x, pos.y, radius);
    if (!hit) return false;
    const left = pos.x - (hit.x - radius);
    const right = hit.x + hit.width + radius - pos.x;
    const top = pos.y - (hit.y - radius);
    const bottom = hit.y + hit.height + radius - pos.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) pos.x = hit.x - radius;
    else if (min === right) pos.x = hit.x + hit.width + radius;
    else if (min === top) pos.y = hit.y - radius;
    else pos.y = hit.y + hit.height + radius;
    return true;
  }

  function stepPlayerOnFoot(dt, input) {
    const player = state.player;
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const length = Math.hypot(mx, my);
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.speed = length > 0 ? speed : 0;
    if (length > 0) {
      const nx = mx / length;
      const ny = my / length;
      player.angle = Math.atan2(ny, nx);
      const nextX = player.x + nx * speed * dt;
      const nextY = player.y + ny * speed * dt;
      const trial = { x: nextX, y: player.y };
      if (!city.collideCircle(trial.x, trial.y, PLAYER.radius)) player.x = nextX;
      trial.x = player.x;
      trial.y = nextY;
      if (!city.collideCircle(trial.x, trial.y, PLAYER.radius)) player.y = nextY;
      player.x = clamp(player.x, 40, WORLD.size - 40);
      player.y = clamp(player.y, 40, WORLD.size - 40);
    }
    if (player.punchCd > 0) player.punchCd -= dt;
    if (player.fireCd > 0) player.fireCd -= dt;
  }

  function stepPlayerCar(dt, input) {
    const player = state.player;
    const car = state.cars.find((c) => c.id === player.inCar);
    if (!car) {
      player.inCar = null;
      return;
    }
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const speedAlong = car.speed;
    if (input.up) car.speed += CAR.accel * dt;
    if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
    if (!input.up && !input.down) car.speed -= car.speed * CAR.drag * dt;
    car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steer = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * (car.speed >= 0 ? 1 : -1);
    car.angle += steer * CAR.steer * clamp(Math.abs(car.speed) / 260, 0, 1) * dt;
    // Lateral grip: kill most of the sideways slide, keep a little drift.
    const newForward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const vx = newForward.x * speedAlong;
    const vy = newForward.y * speedAlong;
    const nextX = car.x + newForward.x * car.speed * dt;
    const nextY = car.y + newForward.y * car.speed * dt;
    const trial = { x: nextX, y: nextY };
    const front = { x: nextX + newForward.x * 20, y: nextY + newForward.y * 20 };
    const rear = { x: nextX - newForward.x * 20, y: nextY - newForward.y * 20 };
    const hitFront = city.collideCircle(front.x, front.y, 15);
    const hitRear = city.collideCircle(rear.x, rear.y, 15);
    if (hitFront || hitRear) {
      car.speed *= -0.25;
      pushOutOfBuildings(trial, 26);
      car.x = trial.x;
      car.y = trial.y;
    } else {
      car.x = nextX;
      car.y = nextY;
    }
    car.x = clamp(car.x, 60, WORLD.size - 60);
    car.y = clamp(car.y, 60, WORLD.size - 60);
    void vx;
    void vy;
    void forward;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = Math.abs(car.speed);
    // Running over a pedestrian at speed is a crime, and it hurts.
    for (const ped of state.peds) {
      if (ped.state === 'down') continue;
      if (dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 130) {
        ped.state = 'down';
        ped.downTimer = 6;
        if (addWanted(WANTED.starsForHitPed)) state.policeTimer = 0;
      }
    }
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind === 'parked') continue;
      if (car.kind === 'police') continue;
      if (state.player.inCar === car.id) continue;
      // Slow down for the car ahead on the same road.
      let ahead = null;
      let aheadDist = 120;
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const along = car.axis === 'v' ? dy * car.dir : dx * car.dir;
        const across = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
        if (along > 0 && along < aheadDist && across < 40) {
          aheadDist = along;
          ahead = other;
        }
      }
      const want = ahead ? Math.max(0, car.targetSpeed * (aheadDist / 120)) : car.targetSpeed;
      car.speed += clamp(want - car.speed, -260 * dt, 180 * dt);
      car.turnCooldown -= dt;
      const line = nearestRoadCoord(car.axis === 'v' ? car.x : car.y);
      const crossing = nearestRoadCoord(car.axis === 'v' ? car.y : car.x);
      const onIntersection = Math.abs((car.axis === 'v' ? car.y : car.x) - crossing) < 52;
      if (onIntersection && car.turnCooldown <= 0 && random() < 0.012) {
        // Turn onto the crossing road.
        const wasVertical = car.axis === 'v';
        car.axis = wasVertical ? 'h' : 'v';
        car.dir = random() < 0.5 ? -1 : 1;
        car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : car.dir > 0 ? 0 : Math.PI;
        car.lane = (random() < 0.5 ? -1 : 1) * 22;
        car.turnCooldown = 4;
        if (wasVertical) car.y = crossing;
        else car.x = crossing;
      }
      // Stay in lane: ease back toward the lane offset.
      if (car.axis === 'v') {
        car.x += clamp(line + car.lane - car.x, -60 * dt, 60 * dt);
        car.y += car.dir * car.speed * dt;
      } else {
        car.y += clamp(line + car.lane - car.y, -60 * dt, 60 * dt);
        car.x += car.dir * car.speed * dt;
      }
      // Loop around the city edge instead of driving off the map.
      if (car.x < 180 || car.x > WORLD.size - 180 || car.y < 180 || car.y > WORLD.size - 180) {
        const fresh = spawnTrafficCar();
        car.x = fresh.x;
        car.y = fresh.y;
        car.axis = fresh.axis;
        car.dir = fresh.dir;
        car.angle = fresh.angle;
        car.lane = fresh.lane;
        car.targetSpeed = fresh.targetSpeed;
        car.speed = fresh.targetSpeed;
      }
    }
  }

  function stepPolice(dt) {
    const wantedCount = state.wanted;
    const police = state.cars.filter((c) => c.kind === 'police');
    // Spawn or remove police to match the wanted level.
    const wantCount = wantedCount === 0 ? 0 : Math.min(wantedCount + 1, POLICE.maxCars);
    if (police.length < wantCount) {
      state.policeTimer += dt;
      if (state.policeTimer > 1.2) {
        state.cars.push(spawnPolice());
        state.policeTimer = 0;
      }
    } else {
      state.policeTimer = 0;
    }
    if (wantedCount === 0) {
      // No heat: the remaining cruisers drive off and despawn.
      for (const car of police) {
        car.speed = Math.max(0, car.speed - 200 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (dist(car.x, car.y, state.player.x, state.player.y) > 1400) {
          state.cars.splice(state.cars.indexOf(car), 1);
        }
      }
      return;
    }
    for (const car of police) {
      const targetAngle = angleTo(car.x, car.y, state.player.x, state.player.y);
      car.angle = turnToward(car.angle, targetAngle, 2.6 * dt);
      car.speed += clamp(POLICE.speed - car.speed, -300 * dt, 320 * dt);
      const nextX = car.x + Math.cos(car.angle) * car.speed * dt;
      const nextY = car.y + Math.sin(car.angle) * car.speed * dt;
      const trial = { x: nextX, y: nextY };
      if (pushOutOfBuildings(trial, 24)) {
        car.speed *= 0.4;
        car.angle += 0.6;
      }
      car.x = clamp(trial.x, 60, WORLD.size - 60);
      car.y = clamp(trial.y, 60, WORLD.size - 60);
      // Ramming the player hurts, on foot or in a car.
      const d = dist(car.x, car.y, state.player.x, state.player.y);
      if (d < 46) {
        if (state.player.inCar) {
          const playerCar = state.cars.find((c) => c.id === state.player.inCar);
          if (playerCar) {
            playerCar.speed *= 0.55;
            playerCar.health -= POLICE.ramDamage * dt * 6;
            if (playerCar.health <= 0) {
              playerCar.health = 0;
              state.player.inCar = null;
              state.player.x = playerCar.x + 40;
              state.player.y = playerCar.y;
            }
          }
        } else if (state.player.health > 0) {
          state.player.health -= POLICE.ramDamage * dt * 4;
        }
      }
    }
  }

  function stepPeds(dt, threat) {
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.timer = 3;
        }
        continue;
      }
      const threatNear = threat && dist(ped.x, ped.y, threat.x, threat.y) < 260;
      if (threatNear && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.timer = 2.5;
      }
      ped.timer -= dt;
      if (ped.state === 'flee') {
        const away = angleTo(threat ? threat.x : ped.x, threat ? threat.y : ped.y, ped.x, ped.y);
        ped.angle = away;
        const speed = 150;
        const nx = ped.x + Math.cos(away) * speed * dt;
        const ny = ped.y + Math.sin(away) * speed * dt;
        if (!city.collideCircle(nx, ny, 10) && !onRoad(nx, ny, -6)) {
          ped.x = nx;
          ped.y = ny;
        } else if (!city.collideCircle(nx, ped.y, 10)) {
          ped.x = nx;
        } else if (!city.collideCircle(ped.x, ny, 10)) {
          ped.y = ny;
        }
        if (ped.timer <= 0) {
          ped.state = 'walk';
          ped.timer = range(random, 3, 9);
        }
        continue;
      }
      if (ped.timer <= 0) {
        ped.timer = range(random, 3, 9);
        const turns = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        ped.angle = pick(random, turns);
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (city.collideCircle(nx, ny, 10) || onRoad(nx, ny, -10)) {
        ped.angle += Math.PI / 2;
        ped.timer = 1;
      } else {
        ped.x = clamp(nx, 40, WORLD.size - 40);
        ped.y = clamp(ny, 40, WORLD.size - 40);
      }
    }
  }

  function stepRivals(dt) {
    for (const rival of state.rivals) {
      if (!rival.alive) continue;
      const d = dist(rival.x, rival.y, state.player.x, state.player.y);
      rival.angle = angleTo(rival.x, rival.y, state.player.x, state.player.y);
      if (d < 520 && d > 90) {
        rival.x += Math.cos(rival.angle) * 42 * dt;
        rival.y += Math.sin(rival.angle) * 42 * dt;
      }
      rival.fireTimer -= dt;
      if (d < 520 && rival.fireTimer <= 0) {
        rival.fireTimer = range(random, 1.0, 1.8);
        const spread = range(random, -0.14, 0.14);
        state.enemyBullets.push({
          x: rival.x,
          y: rival.y,
          vx: Math.cos(rival.angle + spread) * 480,
          vy: Math.sin(rival.angle + spread) * 480,
          life: 1.6,
        });
      }
    }
  }

  function stepBullets(dt) {
    for (const bullet of state.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0) continue;
      for (const rival of state.rivals) {
        if (!rival.alive) continue;
        if (dist(bullet.x, bullet.y, rival.x, rival.y) < 18) {
          rival.health -= 25;
          bullet.life = 0;
          if (rival.health <= 0) {
            rival.alive = false;
            state.rivalsDown += 1;
          }
          break;
        }
      }
      if (bullet.life <= 0) continue;
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(bullet.x, bullet.y, ped.x, ped.y) < 14) {
          ped.state = 'down';
          ped.downTimer = 6;
          bullet.life = 0;
          if (addWanted(WANTED.starsForShoot)) state.policeTimer = 0;
          break;
        }
      }
      if (bullet.life <= 0) continue;
      for (const car of state.cars) {
        if (car.kind === 'police' && dist(bullet.x, bullet.y, car.x, car.y) < 30) {
          car.health -= 25;
          bullet.life = 0;
          if (car.health <= 0) {
            state.cars.splice(state.cars.indexOf(car), 1);
            if (addWanted(WANTED.starsForKillCop)) state.policeTimer = 0;
          }
          break;
        }
      }
      if (bullet.life <= 0) continue;
      if (city.collideCircle(bullet.x, bullet.y, 2)) bullet.life = 0;
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    for (const bullet of state.enemyBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life > 0 && dist(bullet.x, bullet.y, state.player.x, state.player.y) < 16) {
        state.player.health -= 8;
        bullet.life = 0;
      }
      if (bullet.life > 0 && city.collideCircle(bullet.x, bullet.y, 2)) bullet.life = 0;
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0);
  }

  function stepMissions(dt) {
    const mission = currentMission();
    if (!mission) return 0;
    const objective = currentObjective();
    if (!objective) return 0;
    const player = state.player;
    if (objective.kind === 'steal') {
      if (player.inCar) return completeObjective();
      return 0;
    }
    if (objective.kind === 'goto') {
      if (dist(player.x, player.y, objective.at[0], objective.at[1]) < 95) return completeObjective();
      return 0;
    }
    if (objective.kind === 'heat') {
      if (!state.objectiveState.reached && state.wanted >= objective.stars) {
        state.objectiveState.reached = true;
        setBanner('Now lose them — get to 0 stars', 3);
      }
      if (state.objectiveState.reached && state.wanted === 0) return completeObjective();
      return 0;
    }
    if (objective.kind === 'clear') {
      if (state.rivals.length > 0 && state.rivals.every((r) => !r.alive)) return completeObjective();
      return 0;
    }
    if (objective.kind === 'grab') {
      if (dist(player.x, player.y, city.places.bank.x, city.places.bank.y) < 80) {
        state.vaultTimer += dt;
        if (state.vaultTimer > 2) {
          state.vaultTimer = 0;
          return completeObjective();
        }
      } else {
        state.vaultTimer = 0;
      }
      return 0;
    }
    return 0;
  }

  function stepWanted(dt) {
    if (state.wanted === 0) return;
    const policeNear = state.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, state.player.x, state.player.y) < 700);
    if (!policeNear) {
      state.wantedTimer += dt;
      if (state.wantedTimer >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
      }
    } else {
      state.wantedTimer = 0;
    }
  }

  /** One fixed step. `input` carries the held keys and the mouse aim. */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    state.hour = (DAY.startHour + state.elapsed / DAY.secondsPerHour) % 24;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;

    const player = state.player;
    // Entering and leaving cars.
    if (input.enter && !player.inCar) {
      const car = nearestCar(player.x, player.y, 64);
      if (car) {
        const wasParked = car.kind === 'parked';
        const wasTraffic = car.kind === 'traffic';
        player.inCar = car.id;
        car.kind = 'player';
        car.speed = 0;
        state.carsStolen += 1;
        if ((wasParked || wasTraffic) && addWanted(WANTED.starsForSteal)) events |= EVENT_STAR;
        events |= EVENT_STEAL;
        if (wasTraffic) {
          // The driver bails out and runs.
          const ped = spawnPed();
          ped.x = car.x + 44;
          ped.y = car.y;
          ped.state = 'flee';
          ped.timer = 3;
          state.peds.push(ped);
        }
      }
    } else if (input.enter && player.inCar) {
      const car = state.cars.find((c) => c.id === player.inCar);
      player.inCar = null;
      if (car) {
        car.kind = 'parked';
        car.speed = 0;
        player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
        player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
      }
    }

    if (player.inCar) stepPlayerCar(dt, input);
    else stepPlayerOnFoot(dt, input);

    // Shooting (on foot, mouse aim) and punching.
    if (!player.inCar && input.shoot && player.fireCd <= 0 && input.aim) {
      player.fireCd = 0.18;
      const angle = angleTo(player.x, player.y, input.aim.x, input.aim.y);
      player.angle = angle;
      state.bullets.push({
        x: player.x + Math.cos(angle) * 20,
        y: player.y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * 920,
        vy: Math.sin(angle) * 920,
        life: 0.9,
      });
      state.shotsFired += 1;
      events |= EVENT_SHOT;
    }
    if (!player.inCar && input.punch && player.punchCd <= 0) {
      player.punchCd = PLAYER.punchCooldown;
      events |= EVENT_PUNCH;
      for (const rival of state.rivals) {
        if (rival.alive && dist(player.x, player.y, rival.x, rival.y) < PLAYER.punchRange + 14) {
          rival.health -= PLAYER.punchDamage;
          if (rival.health <= 0) {
            rival.alive = false;
            state.rivalsDown += 1;
          }
        }
      }
      for (const ped of state.peds) {
        if (ped.state !== 'down' && dist(player.x, player.y, ped.x, ped.y) < PLAYER.punchRange) {
          ped.state = 'down';
          ped.downTimer = 5;
          if (addWanted(1)) events |= EVENT_STAR;
        }
      }
    }

    stepTraffic(dt);
    stepPolice(dt);
    const threat = state.shotsFired > 0 || player.inCar ? { x: player.x, y: player.y } : null;
    stepPeds(dt, threat);
    stepRivals(dt);
    stepBullets(dt);
    stepWanted(dt);
    events |= stepMissions(dt);

    if (player.health <= 0 && !state.busted) {
      state.busted = true;
      events |= EVENT_WASTED;
    }
    return events;
  }

  function wasted() {
    const player = state.player;
    state.cash = Math.max(0, state.cash - ECONOMY.hospitalFee);
    state.wanted = 0;
    state.wantedTimer = 0;
    player.health = PLAYER.health;
    player.inCar = null;
    player.x = city.places.hospital.x;
    player.y = city.places.hospital.y;
    state.busted = false;
    setBanner(`You woke up at Solmar General. -$${ECONOMY.hospitalFee}`, 4);
    // The police cruisers leave once the heat is off.
    state.cars = state.cars.filter((c) => c.kind !== 'police');
  }

  function saveData() {
    return {
      missionIndex: state.missionIndex,
      objectiveIndex: state.objectiveIndex,
      cash: state.cash,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      hour: state.hour,
      health: state.player.health,
      carsStolen: state.carsStolen,
    };
  }

  function loadData(data) {
    if (!data) return false;
    state.missionIndex = Math.min(data.missionIndex | 0, MISSIONS.length - 1);
    state.objectiveIndex = data.objectiveIndex | 0;
    state.cash = data.cash | 0;
    state.player.x = clamp(data.x | 0, 40, WORLD.size - 40);
    state.player.y = clamp(data.y | 0, 40, WORLD.size - 40);
    state.hour = data.hour ?? DAY.startHour;
    state.elapsed = ((state.hour - DAY.startHour + 24) % 24) * DAY.secondsPerHour;
    state.player.health = data.health ?? PLAYER.health;
    state.carsStolen = data.carsStolen | 0;
    state.player.inCar = null;
    startObjective();
    return true;
  }

  reset();

  return {
    state,
    reset,
    step,
    wasted,
    currentMission,
    currentObjective,
    objectiveText,
    saveData,
    loadData,
    // Debug hooks the play-tests and the screenshot stager use.
    debug: {
      teleport(x, y) {
        state.player.x = x;
        state.player.y = y;
        if (state.player.inCar) {
          const car = state.cars.find((c) => c.id === state.player.inCar);
          if (car) {
            car.x = x;
            car.y = y;
          }
        }
      },
      setWanted(n) {
        state.wanted = clamp(n, 0, 5);
        state.maxWantedReached = Math.max(state.maxWantedReached, state.wanted);
      },
      startMission(index) {
        state.missionIndex = clamp(index, 0, MISSIONS.length - 1);
        state.objectiveIndex = 0;
        state.missionDone = false;
        state.gameWon = false;
        startObjective();
      },
      giveCar() {
        const car = spawnParkedCar();
        // Put it on the road by the player, facing along the road, so it
        // never spawns nose-first into a building mid-block.
        const roadX = nearestRoadCoord(state.player.x);
        const roadY = nearestRoadCoord(state.player.y);
        const vertical = Math.abs(roadX - state.player.x) <= Math.abs(roadY - state.player.y);
        car.x = vertical ? roadX : state.player.x;
        car.y = vertical ? state.player.y : roadY;
        car.angle = vertical ? Math.PI / 2 : 0;
        car.axis = vertical ? 'v' : 'h';
        car.kind = 'parked';
        state.cars.push(car);
        return car;
      },
      placeRivalsAt(x, y) {
        state.rivals = [];
        for (let i = 0; i < 4; i += 1) {
          state.rivals.push({ x: x + (i % 2) * 110 - 55, y: y + Math.floor(i / 2) * 110 - 55, health: 50, alive: true, fireTimer: 2, angle: 0 });
        }
      },
      clearPolice() {
        state.cars = state.cars.filter((c) => c.kind !== 'police');
        state.wanted = 0;
      },
    },
  };
}
