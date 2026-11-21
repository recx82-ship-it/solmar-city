// The city itself: a road grid, the blocks between the roads, the buildings
// that fill them, and the places the story needs — the garage, the marina,
// the plaza, the bank, the safehouse and the harbor. Generation is seeded, so
// the same seed always builds the same Solmar City.

import { WORLD, PALETTE } from './config.js';
import { intRange, pick, range } from './random.js';

const ROAD_COLORS = [
  PALETTE.buildingA,
  PALETTE.buildingB,
  PALETTE.buildingC,
  PALETTE.buildingD,
  PALETTE.buildingE,
];
const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33d', '#e8e8e8', '#2b2b2b', '#7ec850', '#c96fd9', '#f28c2e'];

/** Road centre lines, one every roadGap, starting at firstRoad. */
export function roadLines() {
  const lines = [];
  for (let at = WORLD.firstRoad; at <= WORLD.size - WORLD.firstRoad; at += WORLD.roadGap) lines.push(at);
  return lines;
}

/** Is a point on a road (within the asphalt, plus a small margin)? */
export function onRoad(x, y, margin = 0) {
  const half = WORLD.roadWidth / 2 + margin;
  for (const line of roadLines()) {
    if (Math.abs(x - line) <= half || Math.abs(y - line) <= half) return true;
  }
  return false;
}

/** The nearest road centre to a point, on one axis. */
export function nearestRoadCoord(value) {
  const lines = roadLines();
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  return best;
}

/** Snap a point onto the nearest road, keeping the other axis. */
export function snapToRoad(x, y) {
  const dx = Math.abs(nearestRoadCoord(x) - x);
  const dy = Math.abs(nearestRoadCoord(y) - y);
  return dx <= dy ? { x: nearestRoadCoord(x), y } : { x, y: nearestRoadCoord(y) };
}

export function createCity(random) {
  const lines = roadLines();
  const buildings = [];
  const trees = [];
  const parks = [];
  const water = { x: 0, y: WORLD.size - 260, width: WORLD.size, height: 260 };

  // The harbor water strip along the south edge; the marina sits on it.
  const harbor = { x: 300, y: WORLD.size - 260, width: 900, height: 260 };

  // District of a block, from where it sits: downtown in the middle, the
  // park in the south-west, homes in the north, the harbor in the south.
  function district(cx, cy) {
    const dx = Math.abs(cx - WORLD.size / 2);
    const dy = Math.abs(cy - WORLD.size / 2);
    if (cy > WORLD.size - 700) return 'harbor';
    if (cx < 1600 && cy > 3400) return 'park';
    if (dx < 900 && dy < 900) return 'downtown';
    if (cy < 1400) return 'homes';
    return 'mixed';
  }

  for (let ix = 0; ix < lines.length - 1; ix += 1) {
    for (let iy = 0; iy < lines.length - 1; iy += 1) {
      const x0 = lines[ix] + WORLD.roadWidth / 2;
      const y0 = lines[iy] + WORLD.roadWidth / 2;
      const x1 = lines[ix + 1] - WORLD.roadWidth / 2;
      const y1 = lines[iy + 1] - WORLD.roadWidth / 2;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const kind = district(cx, cy);
      if (kind === 'park') {
        parks.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: range(random, x0 + 20, x1 - 20), y: range(random, y0 + 20, y1 - 20), size: range(random, 16, 26) });
        }
        continue;
      }
      if (kind === 'harbor') continue;
      // One to four buildings per block, with a yard around each.
      const count = kind === 'downtown' ? intRange(random, 1, 2) : intRange(random, 2, 4);
      const cols = count <= 2 ? 2 : 2;
      const rows = Math.ceil(count / cols);
      const cellW = (x1 - x0) / cols;
      const cellH = (y1 - y0) / rows;
      for (let b = 0; b < count; b += 1) {
        const col = b % cols;
        const row = Math.floor(b / cols);
        const tall = kind === 'downtown' && random() < 0.6;
        const bw = cellW * range(random, 0.5, 0.72);
        const bh = cellH * range(random, 0.5, 0.72);
        const bx = x0 + col * cellW + (cellW - bw) / 2;
        const by = y0 + row * cellH + (cellH - bh) / 2;
        buildings.push({
          x: bx,
          y: by,
          width: bw,
          height: bh,
          color: pick(random, ROAD_COLORS),
          tall,
          windows: intRange(random, 2, 5),
          roof: random() < 0.5,
        });
      }
      if (random() < 0.7) {
        trees.push({ x: range(random, x0 + 14, x1 - 14), y: range(random, y0 + 14, y1 - 14), size: range(random, 12, 18) });
      }
    }
  }

  // Street trees along a few avenues.
  for (const line of lines) {
    for (let at = 500; at < WORLD.size - 400; at += 640) {
      if (random() < 0.55) trees.push({ x: line + WORLD.roadWidth / 2 + 16, y: at, size: range(random, 12, 18) });
      if (random() < 0.55) trees.push({ x: at, y: line - WORLD.roadWidth / 2 - 16, size: range(random, 12, 18) });
    }
  }

  // Named places the story and the missions point at.
  const places = {
    garage: { x: 2600, y: 2200, label: 'Mara\u2019s Garage' },
    marina: { x: 700, y: 4900, label: 'Marina' },
    plaza: { x: 3400, y: 3400, label: 'Coral Plaza' },
    bank: { x: 2600, y: 2600, label: 'Meridian Bank' },
    safehouse: { x: 4600, y: 600, label: 'Safehouse' },
    harbor: { x: 1000, y: 4900, label: 'Harbor Docks' },
    hospital: { x: 1400, y: 1400, label: 'Solmar General' },
    spawn: { x: 2600, y: 3000, label: 'Coral Row' },
  };

  /** Push a circle out of every building it overlaps; returns true if it hit one. */
  function collideCircle(x, y, radius) {
    for (const b of buildings) {
      const nearX = Math.max(b.x, Math.min(x, b.x + b.width));
      const nearY = Math.max(b.y, Math.min(y, b.y + b.height));
      const dx = x - nearX;
      const dy = y - nearY;
      if (dx * dx + dy * dy < radius * radius) return b;
    }
    return null;
  }

  /** A random point on a road, for spawning traffic and pedestrians. */
  function randomRoadPoint() {
    const vertical = random() < 0.5;
    const line = pick(random, lines);
    const along = range(random, 300, WORLD.size - 300);
    return vertical ? { x: line, y: along } : { x: along, y: line };
  }

  /** A random point on a sidewalk (just off a road), for pedestrians. */
  function randomSidewalkPoint() {
    const vertical = random() < 0.5;
    const line = pick(random, lines);
    const along = range(random, 300, WORLD.size - 300);
    const side = random() < 0.5 ? -1 : 1;
    const off = WORLD.roadWidth / 2 + 14;
    return vertical ? { x: line + side * off, y: along } : { x: along, y: line + side * off };
  }

  return {
    lines,
    buildings,
    trees,
    parks,
    water,
    harbor,
    places,
    collideCircle,
    randomRoadPoint,
    randomSidewalkPoint,
    carColors: CAR_COLORS,
  };
}
