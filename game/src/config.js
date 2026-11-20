// Solmar City — every tuning number, colour and constant in one place.
// The world is a fixed 3200x2400 unit city; the camera scales it to the window,
// so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Roads run on a grid. Roads are named by their centre line; blocks sit between them. */
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_W = 92;
export const LANE = 24;

export const PLAYER = {
  radius: 14,
  walk: 175,
  run: 270,
  health: 100,
  punchDamage: 34,
  punchRange: 34,
  punchCooldown: 0.45,
};

export const PISTOL = {
  damage: 34,
  magSize: 12,
  reloadTime: 1.1,
  range: 520,
  fireCooldown: 0.22,
  spread: 0.05,
};

export const CAR = {
  length: 56,
  width: 28,
  accel: 330,
  brake: 560,
  reverseAccel: 220,
  maxSpeed: 430,
  reverseMax: 150,
  turnRate: 2.7,
  grip: 0.92,
  health: 100,
};

export const TRAFFIC = {
  count: 26,
  speed: 130,
  speedJitter: 45,
  turnChance: 0.22,
};

export const PEDS = { count: 34, walk: 55, flee: 150 };

export const POLICE = {
  maxCars: 6,
  maxOfficers: 6,
  carSpeed: 470,
  officerSpeed: 185,
  arrestRange: 42,
  arrestTime: 2.4,
  spawnDistance: 700,
  decaySeconds: 26,
};

export const WANTED = {
  max: 5,
  stealCar: 1,
  killPed: 1,
  killCop: 1,
  shootNearPolice: 1,
  hitPed: 1,
};

export const MONEY = {
  start: 120,
  bustedFine: 150,
  wastedFine: 150,
  sprayCost: 200,
  healCost: 80,
  ammoCost: 60,
  ammoPack: 36,
};

/** Minutes of game clock per real second; a full day takes about 8 minutes of play. */
export const CLOCK_RATE = 3;

export const SAVE_KEY = 'solmar-city.save.v1';

export const PALETTE = {
  backdrop: '#10131c',
  grass: '#7fae62',
  grassDark: '#6f9c55',
  park: '#69a854',
  sand: '#e8d29a',
  water: '#2e7fa8',
  waterDeep: '#1f5f86',
  sidewalk: '#b9b3a4',
  asphalt: '#3a3f47',
  asphaltDark: '#33373f',
  roadLine: '#e8d44d',
  curb: '#8f887a',
  building: '#c98f5f',
  roof: '#a9713f',
  glass: '#7fc4d8',
  text: '#f4f1e8',
  muted: '#b9b3a4',
  money: '#7ddb7a',
  danger: '#ff5a4e',
  police: '#4d8dff',
  policeLight: '#ff3b30',
  marker: '#ffd23e',
  objective: '#ffd23e',
  health: '#58d158',
  panel: 'rgba(12, 16, 26, 0.82)',
  panelEdge: 'rgba(255, 255, 255, 0.16)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
