// Solmar City — every tuning number, colour and story beat in one place.
// The world is a fixed 5200x5200 open city; the camera follows the player and
// the renderer scales the 1280x720 view to the window, so no rule below
// depends on the screen size.

export const STEP = 1 / 60;
export const WORLD = { size: 5200, roadGap: 400, roadWidth: 96, firstRoad: 200 };
export const VIEW = { width: 1280, height: 720 };

export const SAVE_KEY = 'solmar-city.save.v1';
export const BEST_KEY = 'solmar-city.best.v1';

/** The player's on-foot body. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  runSpeed: 265,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.45,
};

/** Driving: top speed, acceleration and steering, in world units. */
export const CAR = {
  length: 64,
  width: 32,
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 170,
  drag: 0.55,
  grip: 6.5,
  steer: 2.5,
};

export const TRAFFIC = { count: 26, minSpeed: 120, maxSpeed: 210 };
export const PEDESTRIANS = { count: 46 };
export const POLICE = { maxCars: 6, speed: 520, ramDamage: 9 };

export const WANTED = {
  decaySeconds: 9,
  starsForSteal: 1,
  starsForHitPed: 2,
  starsForShoot: 2,
  starsForKillCop: 1,
};

/** One game hour lasts this many real seconds; a full day is 24 of them. */
export const DAY = { secondsPerHour: 34, startHour: 8.5 };

export const ECONOMY = { startCash: 120, hospitalFee: 150, impoundFee: 80 };

export const PALETTE = {
  skyDawn: '#ffb36b',
  skyDay: '#7ec8f2',
  skyDusk: '#ff8f5e',
  skyNight: '#101a33',
  grass: '#7ec850',
  grassDry: '#a8c25a',
  park: '#5da843',
  sand: '#eed9a4',
  water: '#2f7fc9',
  waterDeep: '#1d5da0',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#f5d76e',
  sidewalk: '#c9c2b4',
  plaza: '#b9b2a2',
  buildingA: '#e8b04b',
  buildingB: '#5fa8c9',
  buildingC: '#d97b6c',
  buildingD: '#8fae7e',
  buildingE: '#b48ec9',
  towerGlass: '#6fb7d9',
  roof: '#6d5a4a',
  windowLit: '#ffe9a8',
  windowDark: '#2e3d55',
  tree: '#2f8f3a',
  treeDark: '#1f6b2a',
  trunk: '#7a5230',
  playerShirt: '#e84c3d',
  playerSkin: '#e8b58a',
  playerPants: '#2e3d55',
  policeCar: '#1c2733',
  policeLightR: '#ff2e2e',
  policeLightB: '#2e7dff',
  taxi: '#f7c948',
  text: '#f4f1e8',
  muted: '#cfc9b8',
  gold: '#ffd34d',
  red: '#ff5347',
  panel: 'rgba(12, 18, 30, 0.82)',
  panelEdge: 'rgba(255, 255, 255, 0.18)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** The five story missions. Each objective is one step of the job; the game
 *  walks the player through them in order and pays out at the end. */
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Mara Voss',
    brief:
      'Mara needs wheels for the crew. Jack any car on the street and bring it to the garage on Coral Row.',
    reward: 250,
    objectives: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', at: [2600, 2200], text: 'Drive the car to Mara\u2019s garage' },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    giver: 'Mara Voss',
    brief:
      'A package is waiting at the marina. Pick it up and deliver it to the buyer at the plaza — no police, no fuss.',
    reward: 400,
    objectives: [
      { kind: 'goto', at: [700, 4900], text: 'Pick up the package at the marina' },
      { kind: 'goto', at: [3400, 3400], text: 'Deliver the package to the plaza buyer' },
    ],
  },
  {
    id: 'heat-run',
    title: 'Heat Run',
    giver: 'Mara Voss',
    brief:
      'The crew\u2019s last job lit up the whole precinct. Get the heat off: shake the cops and make it to the safehouse.',
    reward: 550,
    objectives: [
      { kind: 'heat', stars: 2, text: 'Draw police attention (2 stars) — then lose them' },
      { kind: 'goto', at: [4600, 600], text: 'Reach the safehouse in the north-east' },
    ],
  },
  {
    id: 'harbor-lights',
    title: 'Harbor Lights',
    giver: 'Mara Voss',
    brief:
      'Rival crew the Salt Dogs are holding the harbor. Clear them out and take back the docks for Solmar.',
    reward: 800,
    objectives: [
      { kind: 'goto', at: [1000, 4900], text: 'Get to the harbor docks' },
      { kind: 'clear', count: 4, text: 'Deal with the Salt Dogs (4 left)' },
      { kind: 'goto', at: [2600, 2200], text: 'Report back to Mara\u2019s garage' },
    ],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: 'Mara Voss',
    brief:
      'One last job: the Meridian Bank vault. Grab the cash, dodge the whole Solmar PD, and vanish at the safehouse.',
    reward: 1500,
    objectives: [
      { kind: 'goto', at: [2600, 2600], text: 'Reach the Meridian Bank' },
      { kind: 'grab', text: 'Grab the vault cash (stand in the vault)' },
      { kind: 'goto', at: [4600, 600], text: 'Escape to the safehouse — the whole city is after you' },
    ],
  },
];

export const STORY = {
  hero: 'Jax Mercer',
  fixer: 'Mara Voss',
  city: 'Solmar City',
  intro:
    'Jax Mercer came back to Solmar City with nothing but a duffel bag and a name the old crews still remember. Fixer Mara Voss has five jobs for him — and the whole city is watching.',
  outro:
    'The vault money is safe, the cops are chasing ghosts, and Solmar City belongs to Jax Mercer now. For tonight, anyway.',
};

export const CONTROLS = [
  'WASD / Arrows — move or drive',
  'Shift — run',
  'E — enter / steal a car, get out',
  'Mouse click — shoot (on foot)',
  'F — punch',
  'P — pause, M — mute, H — help',
];
