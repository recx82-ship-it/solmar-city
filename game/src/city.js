// Solmar City: a sun-soaked coastal city on a road grid, generated once from a seed.
// Blocks hold buildings with varied heights and colours; the south edge is a beach
// and ocean, the centre holds a park, and the south-east corner is the harbour.
// Key places (spray shop, hospital, ammo shop, safehouse, hotel, pier, warehouse)
// are fixed addresses the missions and the free roam both use.

import { LANE, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';
import { randomInt, randomPick, randomRange } from './random.js';

const BUILDING_COLORS = ['#c98f5f', '#b57a4e', '#d9a066', '#8fa8b8', '#a8b8c4', '#c4b49a', '#9a8fb0', '#7fae8f'];
const ROOF_COLORS = ['#a9713f', '#8a5a34', '#7a6a55', '#5f7a8a', '#6a5a7a'];
const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c832', '#e8e8e8', '#2b2b2b', '#7ac74f', '#d97ab8', '#8a5fd9', '#e8821e'];

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parkingSpots = [];

  // The park takes one whole block near the centre; the harbour takes the south-east.
  const parkBlock = { col: 3, row: 2 };
  const harbourBlock = { col: 6, row: 4 };

  for (let col = 0; col < ROADS_X.length - 1; col += 1) {
    for (let row = 0; row < ROADS_Y.length - 1; row += 1) {
      const x0 = ROADS_X[col] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[col + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[row] + ROAD_W / 2 + 14;
      const y1 = ROADS_Y[row + 1] - ROAD_W / 2 - 14;
      if (col === parkBlock.col && row === parkBlock.row) {
        for (let t = 0; t < 14; t += 1) {
          trees.push({
            x: randomRange(random, x0 + 20, x1 - 20),
            y: randomRange(random, y0 + 20, y1 - 20),
            r: randomRange(random, 12, 20),
          });
        }
        continue;
      }
      if (col === harbourBlock.col && row === harbourBlock.row) continue;
      // One to four buildings per block, in a row or a pair.
      const count = randomInt(random, 1, 5);
      const bw = (x1 - x0) / count;
      for (let b = 0; b < count; b += 1) {
        const w = bw * randomRange(random, 0.62, 0.92);
        const h = (y1 - y0) * randomRange(random, 0.5, 0.9);
        const bx = x0 + b * bw + (bw - w) / 2;
        const by = y0 + (y1 - y0 - h) / 2 + randomRange(random, -12, 12);
        buildings.push({
          x: bx,
          y: by,
          w,
          h,
          hgt: randomInt(random, 1, 4),
          color: randomPick(random, BUILDING_COLORS),
          roof: randomPick(random, ROOF_COLORS),
        });
      }
      // A tree or two on the block's edge, and a parked car on some blocks.
      if (random() < 0.6) {
        trees.push({ x: randomRange(random, x0, x1), y: y0 + 8, r: randomRange(random, 10, 15) });
      }
      if (random() < 0.45) {
        // Parked at the kerb, in the road's lane — clear of the block's buildings.
        parkingSpots.push({
          x: randomRange(random, x0 + 40, x1 - 40),
          y: random() < 0.5 ? y0 - 40 : y1 + 40,
          angle: 0,
          color: randomPick(random, CAR_COLORS),
        });
      }
    }
  }

  // Street lamps along the roads, every 300 units.
  for (const x of ROADS_X) {
    for (let y = 120; y < WORLD.height - 120; y += 300) {
      lamps.push({ x: x + ROAD_W / 2 + 8, y });
    }
  }
  for (const y of ROADS_Y) {
    for (let x = 120; x < WORLD.width - 120; x += 300) {
      lamps.push({ x, y: y + ROAD_W / 2 + 8 });
    }
  }

  // Parked cars along the kerbs.
  for (let i = 0; i < 22; i += 1) {
    const vertical = random() < 0.5;
    if (vertical) {
      const x = randomPick(random, ROADS_X);
      parkingSpots.push({
        x: x + (random() < 0.5 ? -LANE - 16 : LANE + 16),
        y: randomRange(random, 140, WORLD.height - 260),
        angle: Math.PI / 2,
        color: randomPick(random, CAR_COLORS),
      });
    } else {
      const y = randomPick(random, ROADS_Y);
      parkingSpots.push({
        x: randomRange(random, 140, WORLD.width - 140),
        y: y + (random() < 0.5 ? -LANE - 16 : LANE + 16),
        angle: 0,
        color: randomPick(random, CAR_COLORS),
      });
    }
  }

  const park = {
    x: ROADS_X[parkBlock.col] + ROAD_W / 2,
    y: ROADS_Y[parkBlock.row] + ROAD_W / 2,
    w: ROADS_X[parkBlock.col + 1] - ROADS_X[parkBlock.col] - ROAD_W,
    h: ROADS_Y[parkBlock.row + 1] - ROADS_Y[parkBlock.row] - ROAD_W,
  };
  const beach = { y: 2260, height: WORLD.height - 2260 };
  const harbour = {
    x: ROADS_X[harbourBlock.col] + ROAD_W / 2,
    y: ROADS_Y[harbourBlock.row] + ROAD_W / 2,
    w: ROADS_X[harbourBlock.col + 1] - ROADS_X[harbourBlock.col] - ROAD_W,
    h: ROADS_Y[harbourBlock.row + 1] - ROADS_Y[harbourBlock.row] - ROAD_W,
  };

  // Fixed addresses. All sit on a road so cars and feet can reach them.
  const places = {
    sprayShop: { x: 600, y: 1120, name: 'Sunset Paint & Spray' },
    hospital: { x: 1400, y: 200, name: 'Solmar General' },
    ammoShop: { x: 2200, y: 600, name: 'Lock & Load' },
    safehouse: { x: 1000, y: 1800, name: 'Jax Safehouse' },
    hotel: { x: 1800, y: 1400, name: 'Coral Hotel' },
    pier: { x: 2600, y: 2280, name: 'Marina Pier' },
    warehouse: { x: 2600, y: 1800, name: 'Harbour Warehouse' },
    policeStation: { x: 600, y: 600, name: 'Solmar PD' },
    start: { x: 1000, y: 1000, name: 'Downtown' },
  };

  return { buildings, trees, lamps, parkingSpots, park, beach, harbour, places, carColors: CAR_COLORS };
}

/** True when the circle at (x, y) with radius r touches a building. */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Push a circle out of any building it overlaps; returns the building hit, if any. */
export function resolveBuildings(city, body) {
  let hit = null;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.radius * body.radius) {
      hit = b;
      const d = Math.sqrt(d2) || 0.001;
      const push = (body.radius - d) / d;
      body.x += dx * push;
      body.y += dy * push;
    }
  }
  return hit;
}

/** The nearest point on a road centre line to (x, y), and which road it is on. */
export function nearestRoadPoint(x, y) {
  let best = null;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (!best || d < best.d) best = { d, x: rx, y: Math.max(100, Math.min(y, WORLD.height - 100)), vertical: true, road: rx };
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (!best || d < best.d) best = { d, x: Math.max(100, Math.min(x, WORLD.width - 100)), y: ry, vertical: false, road: ry };
  }
  return best;
}
