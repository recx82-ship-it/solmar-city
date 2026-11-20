// The story: five jobs for Mara Voss, the fixer who runs Solmar from a phone booth
// on the marina. Each mission is a list of steps — go somewhere, steal a car, pick
// something up, take someone out, lose the heat, deliver. Steps complete in order;
// the world marker, the objective line and the minimap all follow the current step.

import { createPed } from './entities.js';
import { randomRange } from './random.js';

export function createMissionList(places) {
  return [
    {
      id: 'first-wheels',
      title: 'First Wheels',
      giver: 'Mara Voss',
      brief: 'New in town, huh? Everybody in Solmar needs wheels. Borrow one — permanently — and bring it to Sunset Paint & Spray so it stops looking stolen.',
      reward: 300,
      steps: [
        { type: 'enterCar', text: 'Steal a car (walk up to one and press E)' },
        { type: 'goto', x: places.sprayShop.x, y: places.sprayShop.y, radius: 70, text: 'Drive the car to Sunset Paint & Spray' },
      ],
    },
    {
      id: 'the-pickup',
      title: 'The Pickup',
      giver: 'Mara Voss',
      brief: 'A package is waiting on the Marina Pier. Nobody opens it, nobody asks. Take it to the Coral Hotel and walk away like you were never there.',
      reward: 500,
      steps: [
        { type: 'goto', x: places.pier.x, y: places.pier.y, radius: 60, text: 'Go to the Marina Pier' },
        { type: 'pickup', x: places.pier.x, y: places.pier.y, radius: 46, text: 'Pick up the package' },
        { type: 'goto', x: places.hotel.x, y: places.hotel.y, radius: 70, text: 'Deliver the package to the Coral Hotel' },
      ],
    },
    {
      id: 'loose-ends',
      title: 'Loose Ends',
      giver: 'Mara Voss',
      brief: 'The Harbour Boys have been talking to the cops about my business. Three of them are hanging around the warehouse. Make it a quiet night for them.',
      reward: 800,
      ammo: 36,
      steps: [
        { type: 'goto', x: places.warehouse.x, y: places.warehouse.y, radius: 260, text: 'Get to the Harbour Warehouse' },
        { type: 'kill', count: 3, cx: places.warehouse.x, cy: places.warehouse.y, spread: 150, text: 'Take out the three Harbour Boys' },
      ],
    },
    {
      id: 'the-getaway',
      title: 'The Getaway',
      giver: 'Mara Voss',
      brief: 'Somebody talked. The whole PD is rolling your way. Lose them — all of them — then get to the safehouse and stay out of sight.',
      reward: 1000,
      startWanted: 3,
      steps: [
        { type: 'escape', text: 'Lose the police — get your wanted level to zero' },
        { type: 'goto', x: places.safehouse.x, y: places.safehouse.y, radius: 70, text: 'Reach the safehouse' },
      ],
    },
    {
      id: 'harbor-lights',
      title: 'Harbor Lights',
      giver: 'Mara Voss',
      brief: 'One last job, kid, and then you are a legend in this town. Guards on the shipment at the harbour. Take them down, take the truck, bring it to the safehouse. Do not scratch the paint.',
      reward: 2000,
      steps: [
        { type: 'goto', x: places.warehouse.x, y: places.warehouse.y, radius: 260, text: 'Get to the Harbour Warehouse' },
        { type: 'kill', count: 4, cx: places.warehouse.x, cy: places.warehouse.y, spread: 170, text: 'Take out the four guards' },
        { type: 'enterCar', needKind: 'truck', text: 'Steal the shipment truck' },
        { type: 'goto', x: places.safehouse.x, y: places.safehouse.y, radius: 80, text: 'Deliver the truck to the safehouse', needCar: true },
      ],
    },
  ];
}

export function createMissionState() {
  return { index: 0, step: 0, enemies: [], started: false, complete: false, stepTimer: 0 };
}

function spawnEnemies(state, step, random) {
  state.enemies = [];
  for (let i = 0; i < step.count; i += 1) {
    const x = step.cx + randomRange(random, -step.spread, step.spread);
    const y = step.cy + randomRange(random, -step.spread, step.spread);
    const enemy = createPed(x, y, '#7a2b2b');
    enemy.state = 'enemy';
    enemy.hp = 100;
    enemy.fireCooldown = randomRange(random, 0.4, 1.4);
    enemy.dead = false;
    state.enemies.push(enemy);
  }
}

/** The marker the world, the minimap and the arrow should point at right now. */
export function currentMarker(missions, missionState) {
  if (missionState.complete) return null;
  const mission = missions[missionState.index];
  if (!mission) return null;
  const step = mission.steps[missionState.step];
  if (!step) return null;
  if (step.type === 'goto' || step.type === 'pickup') return { x: step.x, y: step.y };
  if (step.type === 'kill') return { x: step.cx, y: step.cy };
  return null;
}

export function currentObjective(missions, missionState) {
  if (missionState.complete) return 'Story complete — Solmar is yours. Free roam.';
  const mission = missions[missionState.index];
  if (!mission) return '';
  const step = mission.steps[missionState.step];
  return step ? `${mission.title}: ${step.text}` : '';
}

/**
 * Advance the mission state. Returns events: 'step' when a step completes,
 * 'mission' when a mission completes (with its reward), 'story' when the last
 * one ends. `world` is the world state the steps read (player, cars, wanted).
 */
export function updateMissions(state, dt, random) {
  const events = [];
  const missions = state.missions;
  const ms = state.missionState;
  if (ms.complete) return events;
  const mission = missions[ms.index];
  if (!mission) {
    ms.complete = true;
    return events;
  }
  const step = mission.steps[ms.step];
  if (!step) {
    // Mission finished: pay up and move to the next.
    state.player.money += mission.reward;
    if (mission.ammo) state.player.ammo += mission.ammo;
    events.push({ type: 'mission', mission });
    ms.index += 1;
    ms.step = 0;
    ms.enemies = [];
    if (ms.index >= missions.length) {
      ms.complete = true;
      events.push({ type: 'story' });
    } else {
      const next = missions[ms.index];
      if (next.startWanted) state.wanted = Math.max(state.wanted, next.startWanted);
      events.push({ type: 'phone', mission: next });
    }
    return events;
  }

  const player = state.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  let done = false;

  if (step.type === 'goto' || step.type === 'pickup') {
    const d = Math.hypot(px - step.x, py - step.y);
    if (step.type === 'goto' && step.needCar && !player.inCar) done = false;
    else done = d < step.radius;
  } else if (step.type === 'enterCar') {
    done = !!player.inCar && (!step.needKind || player.inCar.kind === step.needKind);
  } else if (step.type === 'kill') {
    if (ms.enemies.length === 0) spawnEnemies(ms, step, random);
    done = ms.enemies.every((e) => e.dead);
  } else if (step.type === 'escape') {
    done = state.wanted === 0;
  }

  if (done) {
    ms.step += 1;
    ms.stepTimer = 0;
    events.push({ type: 'step', mission, step });
    const nextStep = mission.steps[ms.step];
    if (nextStep && nextStep.type === 'kill') spawnEnemies(ms, nextStep, random);
  } else {
    ms.stepTimer += dt;
  }
  return events;
}

/** Mission enemies shoot at the player when close and in range. */
export function stepEnemies(state, dt, random) {
  const ms = state.missionState;
  const player = state.player;
  for (const enemy of ms.enemies) {
    if (enemy.dead) continue;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const dx = px - enemy.x;
    const dy = py - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    enemy.fireCooldown -= dt;
    if (d < 380) {
      // Strafe sideways and keep a little distance, then shoot.
      const strafe = Math.sin(state.elapsed * 1.3 + enemy.id) * 40;
      enemy.x += (-dy / d) * strafe * dt + (dx / d) * (d > 220 ? 60 : -30) * dt;
      enemy.y += (dx / d) * strafe * dt + (dy / d) * (d > 220 ? 60 : -30) * dt;
      enemy.angle = Math.atan2(dy, dx);
      if (enemy.fireCooldown <= 0 && d < 340) {
        enemy.fireCooldown = 1.5 + random() * 0.7;
        enemy.shot = { x: px + randomRange(random, -50, 50), y: py + randomRange(random, -50, 50) };
      } else {
        enemy.shot = null;
      }
    } else {
      // Walk toward the player until in range.
      enemy.x += (dx / d) * 70 * dt;
      enemy.y += (dy / d) * 70 * dt;
      enemy.angle = Math.atan2(dy, dx);
      enemy.shot = null;
    }
  }
}
