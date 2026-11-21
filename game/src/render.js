// Drawing only: the world's state and the current screen in, pixels out.
// The camera follows the player across the 5200x5200 city; the 1280x720 view
// is scaled to fit the window. Flat vector art with soft shadows, a day-cycle
// sky tint, a HUD with cash, health, wanted stars, clock and a live minimap.

import { CAR, FONT, MISSIONS, PALETTE, PLAYER, STORY, VIEW, WORLD } from './config.js';
import { onRoad } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WON = 'won';
export const SCREEN_HELP = 'help';

const TWO_PI = Math.PI * 2;

/** Daylight factor 0..1 from the hour: 0 at night, 1 at noon. */
export function daylight(hour) {
  if (hour < 5 || hour >= 21) return 0;
  if (hour < 7) return (hour - 5) / 2;
  if (hour < 18) return 1;
  if (hour < 21) return 1 - (hour - 18) / 3;
  return 0;
}

/** Sky tint for the hour, as [colour, alpha] painted over the scene. */
function skyTint(hour) {
  const light = daylight(hour);
  if (light >= 1) return null;
  if (hour >= 5 && hour < 7) return ['#ff9a4d', 0.22 * (1 - light)];
  if (hour >= 18 && hour < 21) return ['#ff7a3d', 0.25 * (1 - light)];
  return ['#0a1230', 0.5 * (1 - light)];
}

function clockText(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const hh = h < 10 ? `0${h}` : `${h}`;
  const mm = m < 10 ? `0${m}` : `${m}`;
  return `${hh}:${mm}`;
}

export function createRenderer(canvas, city) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, camX: 0, camY: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    context.font = font(size, bold);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  /** Screen (view) coordinates of a world point, for the mouse aim. */
  function worldToScreen(wx, wy) {
    return {
      x: (wx - view.camX) * view.scale + view.x,
      y: (wy - view.camY) * view.scale + view.y,
    };
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - view.x) / view.scale + view.camX,
      y: (sy - view.y) / view.scale + view.camY,
    };
  }

  function updateCamera(player) {
    view.camX = Math.max(0, Math.min(WORLD.size - VIEW.width, player.x - VIEW.width / 2));
    view.camY = Math.max(0, Math.min(WORLD.size - VIEW.height, player.y - VIEW.height / 2));
  }

  function drawGround() {
    const x0 = view.camX;
    const y0 = view.camY;
    const x1 = x0 + VIEW.width;
    const y1 = y0 + VIEW.height;
    context.fillStyle = '#8fb45a';
    context.fillRect(x0, y0, VIEW.width, VIEW.height);
    // Parks.
    for (const park of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.width, park.height);
    }
    // Sand along the harbor, then the water.
    context.fillStyle = PALETTE.sand;
    context.fillRect(city.water.x, city.water.y - 40, city.water.width, 40);
    context.fillStyle = PALETTE.water;
    context.fillRect(city.water.x, city.water.y, city.water.width, city.water.height);
    context.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 12; i += 1) {
      const wx = 240 + i * 430;
      const wy = city.water.y + 60 + (i % 3) * 60;
      context.fillRect(wx, wy, 180, 8);
    }
    // Sidewalks: pale bands along every road.
    context.fillStyle = PALETTE.sidewalk;
    for (const line of city.lines) {
      context.fillRect(x0, line - WORLD.roadWidth / 2 - 14, VIEW.width, WORLD.roadWidth + 28);
      context.fillRect(line - WORLD.roadWidth / 2 - 14, y0, WORLD.roadWidth + 28, VIEW.height);
    }
    // Asphalt.
    context.fillStyle = PALETTE.road;
    for (const line of city.lines) {
      context.fillRect(x0, line - WORLD.roadWidth / 2, VIEW.width, WORLD.roadWidth);
      context.fillRect(line - WORLD.roadWidth / 2, y0, WORLD.roadWidth, VIEW.height);
    }
    // Centre dashes.
    context.fillStyle = PALETTE.lane;
    const dash = 34;
    const gap = 30;
    for (const line of city.lines) {
      for (let d = Math.floor(x0 / (dash + gap)) * (dash + gap); d < x1; d += dash + gap) {
        context.fillRect(d, line - 3, dash, 6);
      }
      for (let d = Math.floor(y0 / (dash + gap)) * (dash + gap); d < y1; d += dash + gap) {
        context.fillRect(line - 3, d, 6, dash);
      }
    }
    // Road edge lines.
    context.fillStyle = PALETTE.roadEdge;
    for (const line of city.lines) {
      context.fillRect(x0, line - WORLD.roadWidth / 2, VIEW.width, 3);
      context.fillRect(x0, line + WORLD.roadWidth / 2 - 3, VIEW.width, 3);
      context.fillRect(line - WORLD.roadWidth / 2, y0, 3, VIEW.height);
      context.fillRect(line + WORLD.roadWidth / 2 - 3, y0, 3, VIEW.height);
    }
  }

  function drawBuildings(state) {
    const night = daylight(state.hour) < 0.4;
    for (const b of city.buildings) {
      if (b.x > view.camX + VIEW.width || b.x + b.width < view.camX || b.y > view.camY + VIEW.height || b.y + b.height < view.camY) continue;
      // Soft shadow to the south-east.
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.fillRect(b.x + 8, b.y + 10, b.width, b.height);
      context.fillStyle = b.tall ? PALETTE.towerGlass : b.color;
      context.fillRect(b.x, b.y, b.width, b.height);
      if (b.tall) {
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(b.x + 6, b.y + 6, 10, b.height - 12);
      }
      // Windows.
      const cols = Math.max(2, Math.floor(b.width / 34));
      const rows = Math.max(2, Math.floor(b.height / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const lit = night && ((cx * 7 + cy * 3 + Math.floor(b.x)) % 3 === 0);
          context.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
          context.fillRect(b.x + 8 + cx * ((b.width - 16) / cols), b.y + 8 + cy * ((b.height - 16) / rows), 12, 14);
        }
      }
      if (b.roof) {
        context.fillStyle = PALETTE.roof;
        context.fillRect(b.x + b.width / 2 - 12, b.y + b.height / 2 - 12, 24, 24);
      }
    }
  }

  function drawTrees() {
    for (const tree of city.trees) {
      if (tree.x < view.camX - 40 || tree.x > view.camX + VIEW.width + 40 || tree.y < view.camY - 40 || tree.y > view.camY + VIEW.height + 40) continue;
      context.fillStyle = 'rgba(0,0,0,0.15)';
      context.beginPath();
      context.ellipse(tree.x + 4, tree.y + 5, tree.size * 0.8, tree.size * 0.6, 0, 0, TWO_PI);
      context.fill();
      context.fillStyle = PALETTE.trunk;
      context.fillRect(tree.x - 2, tree.y - 2, 4, 10);
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(tree.x, tree.y, tree.size, 0, TWO_PI);
      context.fill();
      context.fillStyle = PALETTE.treeDark;
      context.beginPath();
      context.arc(tree.x - tree.size * 0.3, tree.y - tree.size * 0.3, tree.size * 0.55, 0, TWO_PI);
      context.fill();
    }
  }

  function drawCar(car, state) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 9);
    context.fill();
    // Wheels.
    context.fillStyle = '#141414';
    const wheelY = CAR.width / 2 - 3;
    context.fillRect(-CAR.length / 2 + 8, -wheelY - 4, 12, 7);
    context.fillRect(CAR.length / 2 - 20, -wheelY - 4, 12, 7);
    context.fillRect(-CAR.length / 2 + 8, wheelY - 3, 12, 7);
    context.fillRect(CAR.length / 2 - 20, wheelY - 3, 12, 7);
    // Body.
    context.fillStyle = car.kind === 'police' ? PALETTE.policeCar : car.color;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 9);
    context.fill();
    // Windshield, roof and rear window.
    context.fillStyle = '#bfe3f2';
    context.fillRect(8, -CAR.width / 2 + 5, 10, CAR.width - 10);
    context.fillStyle = car.kind === 'police' ? '#e8e8e8' : 'rgba(255,255,255,0.22)';
    context.fillRect(-8, -CAR.width / 2 + 5, 14, CAR.width - 10);
    context.fillStyle = '#bfe3f2';
    context.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 5, 8, CAR.width - 10);
    if (car.kind === 'police') {
      const blink = Math.floor(state.elapsed * 4) % 2 === 0;
      context.fillStyle = blink ? PALETTE.policeLightR : PALETTE.policeLightB;
      context.fillRect(-4, -CAR.width / 2 + 2, 8, 6);
      context.fillStyle = blink ? PALETTE.policeLightB : PALETTE.policeLightR;
      context.fillRect(-4, CAR.width / 2 - 8, 8, 6);
      context.fillStyle = '#ffffff';
      context.font = font(11, true);
      context.textAlign = 'center';
      context.fillText('PD', 0, 4);
    }
    // Headlights.
    context.fillStyle = '#fff6c9';
    context.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 4, 3, 6);
    context.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 10, 3, 6);
    context.restore();
  }

  function drawPed(ped) {
    context.save();
    context.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      context.rotate(Math.PI / 2);
    }
    context.fillStyle = 'rgba(0,0,0,0.2)';
    context.beginPath();
    context.ellipse(2, 3, 11, 8, 0, 0, TWO_PI);
    context.fill();
    // Body and head, facing the walk direction.
    context.rotate(ped.state === 'down' ? 0 : ped.angle);
    context.fillStyle = ped.color;
    roundRect(-7, -8, 16, 16, 5);
    context.fill();
    context.fillStyle = ped.skin;
    context.beginPath();
    context.arc(9, 0, 7, 0, TWO_PI);
    context.fill();
    context.fillStyle = '#2b2b2b';
    context.beginPath();
    context.arc(9, -3, 6, Math.PI, TWO_PI);
    context.fill();
    context.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar) return;
    context.save();
    context.translate(player.x, player.y);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(2, 4, 13, 10, 0, 0, TWO_PI);
    context.fill();
    context.rotate(player.angle);
    // Legs, torso, head — a top-down Jax in a red shirt.
    context.fillStyle = PALETTE.playerPants;
    context.fillRect(-8, -9, 10, 6);
    context.fillRect(-8, 3, 10, 6);
    context.fillStyle = PALETTE.playerShirt;
    roundRect(-9, -10, 18, 20, 6);
    context.fill();
    context.fillStyle = PALETTE.playerSkin;
    context.beginPath();
    context.arc(12, 0, 8, 0, TWO_PI);
    context.fill();
    context.fillStyle = '#2b2b2b';
    context.beginPath();
    context.arc(12, -3, 7, Math.PI, TWO_PI);
    context.fill();
    // Gun in hand when the mouse is held.
    context.fillStyle = '#222';
    context.fillRect(10, -2, 10, 4);
    context.restore();
  }

  function drawRival(rival, state) {
    context.save();
    context.translate(rival.x, rival.y);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(2, 4, 12, 9, 0, 0, TWO_PI);
    context.fill();
    context.rotate(rival.angle);
    context.fillStyle = '#3f6b2e';
    roundRect(-9, -10, 18, 20, 6);
    context.fill();
    context.fillStyle = '#e8b58a';
    context.beginPath();
    context.arc(12, 0, 8, 0, TWO_PI);
    context.fill();
    context.fillStyle = '#222';
    context.fillRect(10, -2, 11, 4);
    context.restore();
    // Health bar.
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(rival.x - 16, rival.y - 26, 32, 5);
    context.fillStyle = '#ff5347';
    context.fillRect(rival.x - 16, rival.y - 26, 32 * Math.max(0, rival.health / 50), 5);
  }

  function drawBullets(state) {
    context.fillStyle = '#ffe9a8';
    for (const bullet of state.bullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, TWO_PI);
      context.fill();
    }
    context.fillStyle = '#ff9a4d';
    for (const bullet of state.enemyBullets) {
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, TWO_PI);
      context.fill();
    }
  }

  function drawMarker(state) {
    const mission = MISSIONS[state.missionIndex];
    if (!mission) return;
    const objective = mission.objectives[state.objectiveIndex];
    if (!objective || !objective.at) return;
    const [mx, my] = objective.at;
    const pulse = 1 + 0.25 * Math.sin(state.elapsed * 4);
    context.save();
    context.translate(mx, my);
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 46 * pulse, 0, TWO_PI);
    context.stroke();
    context.fillStyle = 'rgba(255, 211, 77, 0.18)';
    context.beginPath();
    context.arc(0, 0, 46 * pulse, 0, TWO_PI);
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.moveTo(0, -58);
    context.lineTo(12, -34);
    context.lineTo(-12, -34);
    context.closePath();
    context.fill();
    context.font = font(13, true);
    context.textAlign = 'center';
    context.fillStyle = '#1c2733';
    context.fillText('!', 0, -40);
    context.restore();
    // A guiding arrow at the screen edge when the marker is off-screen.
    const sx = mx - view.camX;
    const sy = my - view.camY;
    if (sx < 60 || sx > VIEW.width - 60 || sy < 60 || sy > VIEW.height - 60) {
      const cx = Math.max(70, Math.min(VIEW.width - 70, sx));
      const cy = Math.max(70, Math.min(VIEW.height - 70, sy));
      const angle = Math.atan2(sy - cy, sx - cx);
      context.save();
      context.translate(cx, cy);
      context.rotate(angle);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
      context.font = font(15, true);
      context.textAlign = 'center';
      context.fillStyle = PALETTE.gold;
      const distText = `${Math.round(Math.hypot(sx - (state.player.x - view.camX), sy - (state.player.y - view.camY)))}m`;
      context.fillText(distText, cx, cy + 34);
    }
  }

  function drawPlaces() {
    context.font = font(13, true);
    context.textAlign = 'center';
    for (const key of Object.keys(city.places)) {
      const place = city.places[key];
      if (key === 'spawn') continue;
      const sx = place.x - view.camX;
      const sy = place.y - view.camY;
      if (sx < -80 || sx > VIEW.width + 80 || sy < -80 || sy > VIEW.height + 80) continue;
      context.fillStyle = 'rgba(12, 18, 30, 0.55)';
      const w = context.measureText(place.label).width + 18;
      roundRect(place.x - w / 2, place.y - 52, w, 22, 8);
      context.fill();
      context.fillStyle = PALETTE.text;
      context.fillText(place.label, place.x, place.y - 36);
    }
  }

  function drawWorld(state) {
    updateCamera(state.player);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - view.camX * view.scale, view.y - view.camY * view.scale);
    drawGround();
    drawBuildings(state);
    drawTrees();
    drawPlaces();
    drawMarker(state);
    for (const car of state.cars) drawCar(car, state);
    for (const ped of state.peds) drawPed(ped);
    for (const rival of state.rivals) if (rival.alive) drawRival(rival, state);
    drawPlayer(state);
    drawBullets(state);
    // Day-cycle tint over everything.
    const tint = skyTint(state.hour);
    if (tint) {
      context.fillStyle = tint[0];
      context.globalAlpha = tint[1];
      context.fillRect(view.camX, view.camY, VIEW.width, VIEW.height);
      context.globalAlpha = 1;
    }
    // Street lights at night.
    if (daylight(state.hour) < 0.4) {
      context.fillStyle = 'rgba(255, 233, 168, 0.10)';
      for (const line of city.lines) {
        for (let at = 400; at < WORLD.size; at += 800) {
          context.beginPath();
          context.arc(line, at, 46, 0, TWO_PI);
          context.fill();
          context.beginPath();
          context.arc(at, line, 46, 0, TWO_PI);
          context.fill();
        }
      }
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  function star(x, y, size, filled) {
    context.save();
    context.translate(x, y);
    context.fillStyle = filled ? PALETTE.gold : 'rgba(255,255,255,0.25)';
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? size : size * 0.45;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawMinimap(state) {
    const size = 208;
    const x = VIEW.width - size - 16;
    const y = 16;
    const scale = size / WORLD.size;
    context.save();
    context.fillStyle = PALETTE.panel;
    roundRect(x - 6, y - 6, size + 12, size + 12, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    roundRect(x, y, size, size, 6);
    context.clip();
    context.fillStyle = '#274b2e';
    context.fillRect(x, y, size, size);
    context.fillStyle = PALETTE.water;
    context.fillRect(x, y + city.water.y * scale, size, city.water.height * scale);
    context.strokeStyle = '#9aa0ab';
    context.lineWidth = 2;
    for (const line of city.lines) {
      context.beginPath();
      context.moveTo(x, y + line * scale);
      context.lineTo(x + size, y + line * scale);
      context.stroke();
      context.beginPath();
      context.moveTo(x + line * scale, y);
      context.lineTo(x + line * scale, y + size);
      context.stroke();
    }
    const mission = MISSIONS[state.missionIndex];
    if (mission) {
      const objective = mission.objectives[state.objectiveIndex];
      if (objective && objective.at) {
        context.fillStyle = PALETTE.gold;
        context.beginPath();
        context.arc(x + objective.at[0] * scale, y + objective.at[1] * scale, 5 + Math.sin(state.elapsed * 4) * 1.5, 0, TWO_PI);
        context.fill();
      }
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = PALETTE.policeLightB;
      context.beginPath();
      context.arc(x + car.x * scale, y + car.y * scale, 3.5, 0, TWO_PI);
      context.fill();
    }
    for (const rival of state.rivals) {
      if (!rival.alive) continue;
      context.fillStyle = '#ff9a4d';
      context.beginPath();
      context.arc(x + rival.x * scale, y + rival.y * scale, 3, 0, TWO_PI);
      context.fill();
    }
    // Player arrow.
    context.save();
    context.translate(x + state.player.x * scale, y + state.player.y * scale);
    context.rotate(state.player.angle);
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(8, 0);
    context.lineTo(-6, -5);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
    text('SOLMAR CITY', x + size / 2, y + size + 22, 12, PALETTE.muted, 'center', true);
  }

  function drawHud(state, ui) {
    // Top-left: cash and health.
    context.fillStyle = PALETTE.panel;
    roundRect(16, 16, 210, 74, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.stroke();
    text(`$${state.cash}`, 30, 46, 26, '#7ee787', 'left', true);
    text('CASH', 30, 66, 12, PALETTE.muted, 'left', true);
    context.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(30, 74, 182, 10, 5);
    context.fill();
    context.fillStyle = state.player.health > 30 ? '#7ee787' : PALETTE.red;
    roundRect(30, 74, 182 * Math.max(0, state.player.health / PLAYER.health), 10, 5);
    context.fill();
    // Wanted stars, top centre.
    for (let i = 0; i < 5; i += 1) star(VIEW.width / 2 - 56 + i * 28, 40, 13, i < state.wanted);
    if (state.wanted > 0) text('WANTED', VIEW.width / 2, 70, 13, PALETTE.gold, 'center', true);
    // Clock and speed, under the minimap.
    const clock = clockText(state.hour);
    text(clock, VIEW.width - 16, 268, 20, PALETTE.text, 'right', true);
    text(state.player.inCar ? `${Math.round(Math.abs(state.player.speed) * 0.12)} km/h` : 'ON FOOT', VIEW.width - 16, 292, 14, PALETTE.muted, 'right', true);
    drawMinimap(state);
    // Bottom-left: current mission and objective.
    const mission = MISSIONS[state.missionIndex];
    context.fillStyle = PALETTE.panel;
    const missionH = mission ? 66 : 40;
    roundRect(16, VIEW.height - 16 - missionH, 420, missionH, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.stroke();
    if (mission) {
      text(`${mission.title} — ${mission.giver}`, 30, VIEW.height - missionH + 8, 16, PALETTE.gold, 'left', true);
      text(ui.objectiveText || '', 30, VIEW.height - 16 - 12, 15, PALETTE.text, 'left');
    } else {
      text('All missions complete — Solmar City is yours.', 30, VIEW.height - 16 - 12, 15, PALETTE.text, 'left');
    }
    // Banner.
    if (state.bannerTimer > 0) {
      const alpha = Math.min(1, state.bannerTimer);
      context.save();
      context.globalAlpha = alpha;
      context.font = font(26, true);
      const w = context.measureText(state.banner).width + 44;
      context.fillStyle = PALETTE.panel;
      roundRect((VIEW.width - w) / 2, 96, w, 48, 10);
      context.fill();
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 1;
      context.stroke();
      text(state.banner, VIEW.width / 2, 128, 26, PALETTE.gold, 'center', true);
      context.restore();
    }
    // Hints.
    text('E — car   Click — shoot   F — punch   P — pause   M — sound', VIEW.width / 2, VIEW.height - 14, 13, PALETTE.muted, 'center');
    if (ui.muted) text('MUTED', 30, 116, 13, PALETTE.red, 'left', true);
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 30 + 60;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRect(x, y, width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    context.stroke();
    text(title, VIEW.width / 2, y + 62, 40, PALETTE.text, 'center', true);
    lines.forEach((line, index) => {
      text(line, VIEW.width / 2, y + 108 + index * 30, 18, PALETTE.muted, 'center');
    });
    text(prompt, VIEW.width / 2, y + height - 26, 18, PALETTE.gold, 'center', true);
  }

  function drawTitle(state, ui) {
    drawWorld(state);
    context.fillStyle = 'rgba(10, 16, 30, 0.45)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('SOLMAR CITY', VIEW.width / 2, 190, 84, '#ffd34d', 'center', true);
    text('A sun-soaked open-world crime story', VIEW.width / 2, 228, 22, PALETTE.text, 'center');
    const lines = [
      STORY.intro,
      '',
      `Jax Mercer  •  Mara Voss  •  ${MISSIONS.length} story missions  •  5-star wanted level`,
      'Steal cars, outrun the Solmar PD, and pull off the Big Score.',
    ];
    if (ui.saveExists) lines.push('A saved game is waiting — press Enter to continue it.');
    if (ui.best > 0) lines.push(`Best cash in one run: $${ui.best}`);
    drawPanelLines(lines);
    text('Press Enter or click to start  •  H for controls', VIEW.width / 2, VIEW.height - 52, 18, PALETTE.gold, 'center', true);
  }

  function drawPanelLines(lines) {
    let y = 268;
    for (const line of lines) {
      if (line === '') {
        y += 12;
        continue;
      }
      // Wrap long lines at the view width.
      const words = line.split(' ');
      let row = '';
      for (const word of words) {
        const trial = row ? `${row} ${word}` : word;
        context.font = font(17);
        if (context.measureText(trial).width > 760 && row) {
          text(row, VIEW.width / 2, y, 17, PALETTE.text, 'center');
          y += 26;
          row = word;
        } else {
          row = trial;
        }
      }
      if (row) {
        text(row, VIEW.width / 2, y, 17, PALETTE.text, 'center');
        y += 26;
      }
    }
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen. */
  function draw(state, screen, ui) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0a1230';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, ui);
      return;
    }
    drawWorld(state);
    if (screen === SCREEN_PLAY) {
      drawHud(state, ui);
      return;
    }
    drawHud(state, ui);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except now.', `Cash $${state.cash}  •  Mission ${Math.min(state.missionIndex + 1, MISSIONS.length)} of ${MISSIONS.length}`], 'Press P to resume  •  H for controls');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', ['The Solmar PD scraped you off the asphalt.', 'You woke up at Solmar General, lighter in the pocket.'], 'Press Enter to get back out there');
    } else if (screen === SCREEN_WON) {
      drawPanel('THE BIG SCORE', [STORY.outro, '', `Final cash: $${state.cash}`], 'Press Enter to play again');
    } else if (screen === SCREEN_HELP) {
      drawPanel('How to play', [
        'WASD / Arrows — move on foot, drive in a car',
        'Shift — run    E — enter / steal a car, get out',
        'Mouse click — shoot (on foot)    F — punch',
        'Follow the gold marker. Lose the stars to lose the cops.',
        'M — mute    P — pause    H — close this',
      ], 'Press H to close');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, worldToScreen, screenToWorld, view };
}
