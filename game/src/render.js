// Drawing only: the world state in, pixels out. A top-down camera follows the
// player (a little wider when driving), the city paints in layers — ground, roads,
// buildings with height, props, cars, people, particles, markers — and the clock
// tints the light: golden afternoon, purple dusk, dark night with headlights.

import { LANE, PALETTE, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';
import { carCircles } from './entities.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_STORY = 'story';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, width: 0, height: 0, zoom: 1 };
  const camera = { x: 0, y: 0, zoom: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.width = Math.round(window.innerWidth * ratio);
    view.height = Math.round(window.innerHeight * ratio);
    canvas.width = view.width;
    canvas.height = view.height;
  }

  function updateCamera(state) {
    const player = state.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const targetZoom = player.inCar ? 0.82 : 1.0;
    camera.zoom += (targetZoom - camera.zoom) * 0.04;
    camera.x += (px - camera.x) * 0.12;
    camera.y += (py - camera.y) * 0.12;
    const base = Math.min(view.width / 1280, view.height / 720);
    view.scale = base * camera.zoom;
    view.x = view.width / 2 - camera.x * view.scale;
    view.y = view.height / 2 - camera.y * view.scale;
  }

  function worldFromScreen(sx, sy) {
    return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
  }

  function screenFromWorld(wx, wy) {
    return { x: wx * view.scale + view.x, y: wy * view.scale + view.y };
  }

  function rr(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawGround(state) {
    const city = state.city;
    // Grass base.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    // The park.
    context.fillStyle = PALETTE.park;
    context.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
    // Beach and ocean along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, city.beach.y, WORLD.width, city.beach.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, city.beach.y + 90, WORLD.width, WORLD.height - city.beach.y - 90);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = 80; x < WORLD.width; x += 260) {
      context.fillRect(x, city.beach.y + 130, 120, 6);
      context.fillRect(x + 60, city.beach.y + 190, 90, 6);
    }
    // Harbour water in the south-east block.
    context.fillStyle = PALETTE.water;
    context.fillRect(city.harbour.x, city.harbour.y, city.harbour.w, city.harbour.h);
    // Sidewalks: pale borders around every road.
    context.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS_X) context.fillRect(x - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD.height);
    for (const y of ROADS_Y) context.fillRect(0, y - ROAD_W / 2 - 14, WORLD.width, ROAD_W + 28);
    // Asphalt.
    context.fillStyle = PALETTE.asphalt;
    for (const x of ROADS_X) context.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const y of ROADS_Y) context.fillRect(0, y - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.roadLine;
    for (const x of ROADS_X) {
      for (let y = 40; y < WORLD.height; y += 80) context.fillRect(x - 3, y, 6, 36);
    }
    for (const y of ROADS_Y) {
      for (let x = 40; x < WORLD.width; x += 80) context.fillRect(x, y - 3, 36, 6);
    }
  }

  function drawBuildings(state) {
    const night = state.clock < 6 || state.clock >= 19;
    for (const b of state.city.buildings) {
      // Height as a dark side face.
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x + 6, b.y + 6, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      // Windows: a grid of lit or dark panes.
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const lit = night && ((c * 7 + r * 3 + b.hgt) % 3 === 0);
          context.fillStyle = lit ? '#ffd97a' : PALETTE.glass;
          context.fillRect(b.x + 9 + c * 26, b.y + 9 + r * 26, 12, 12);
        }
      }
    }
  }

  function drawProps(state) {
    for (const t of state.city.trees) {
      context.fillStyle = '#5d4a2f';
      context.fillRect(t.x - 2, t.y - 2, 4, 6);
      context.fillStyle = '#4e8f3e';
      context.beginPath();
      context.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5da34a';
      context.beginPath();
      context.arc(t.x - 4, t.y - 8, t.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
    const night = state.clock < 6 || state.clock >= 19;
    for (const lamp of state.city.lamps) {
      context.fillStyle = '#3a3f47';
      context.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
      if (night) {
        context.fillStyle = 'rgba(255, 214, 120, 0.25)';
        context.beginPath();
        context.arc(lamp.x, lamp.y, 26, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffd678';
        context.beginPath();
        context.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawPlaceSigns(state) {
    const places = state.city.places;
    const signs = [
      { p: places.sprayShop, label: 'SPRAY', color: '#e8821e' },
      { p: places.hospital, label: 'H', color: '#e8e8e8' },
      { p: places.ammoShop, label: 'AMMO', color: '#ffd23e' },
      { p: places.safehouse, label: 'HOME', color: '#7ac74f' },
      { p: places.hotel, label: 'HOTEL', color: '#d97ab8' },
      { p: places.pier, label: 'PIER', color: '#4db8a8' },
      { p: places.warehouse, label: 'WARE', color: '#8a5fd9' },
      { p: places.policeStation, label: 'PD', color: '#4d8dff' },
    ];
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const s of signs) {
      context.fillStyle = s.color;
      context.font = 'bold 13px ' + 'system-ui, sans-serif';
      context.fillText(s.label, s.p.x, s.p.y - 26);
    }
  }

  function drawPickups(state) {
    const pulse = 1 + Math.sin(state.elapsed * 4) * 0.15;
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      context.save();
      context.translate(pickup.x, pickup.y);
      context.scale(pulse, pulse);
      if (pickup.kind === 'cash') {
        context.fillStyle = '#2f9e44';
        context.beginPath();
        context.arc(0, 0, 13, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#e8f5d0';
        context.font = 'bold 15px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('$', 0, 1);
      } else if (pickup.kind === 'health') {
        context.fillStyle = '#f2f2f2';
        context.fillRect(-11, -11, 22, 22);
        context.fillStyle = '#d94f3d';
        context.fillRect(-3, -8, 6, 16);
        context.fillRect(-8, -3, 16, 6);
      } else {
        context.fillStyle = '#ffd23e';
        context.beginPath();
        context.arc(0, 0, 12, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#7a5a00';
        context.font = 'bold 11px system-ui, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('AMMO', 0, 0);
      }
      context.restore();
    }
  }

  function drawCar(car, state) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const len = car.kind === 'truck' ? 84 : 56;
    const wid = car.kind === 'truck' ? 30 : 28;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    rr(-len / 2 + 3, -wid / 2 + 4, len, wid, 8);
    context.fill();
    // Body.
    context.fillStyle = car.dead ? '#3a3a3a' : car.color;
    rr(-len / 2, -wid / 2, len, wid, 8);
    context.fill();
    if (car.kind === 'truck') {
      context.fillStyle = '#d8d2c4';
      rr(-len / 2 + 6, -wid / 2 + 3, 44, wid - 6, 4);
      context.fill();
      context.fillStyle = '#8a5a34';
      rr(len / 2 - 24, -wid / 2 + 3, 18, wid - 6, 4);
      context.fill();
    } else {
      // Windshield and roof.
      context.fillStyle = 'rgba(20, 30, 40, 0.75)';
      rr(len / 2 - 20, -wid / 2 + 4, 12, wid - 8, 3);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.18)';
      rr(-8, -wid / 2 + 4, 18, wid - 8, 3);
      context.fill();
    }
    // Headlights.
    const night = state.clock < 6 || state.clock >= 19;
    context.fillStyle = night ? '#fff2b0' : '#ffe9a8';
    context.fillRect(len / 2 - 2, -wid / 2 + 3, 3, 6);
    context.fillRect(len / 2 - 2, wid / 2 - 9, 3, 6);
    if (night) {
      context.fillStyle = 'rgba(255, 242, 176, 0.12)';
      context.beginPath();
      context.moveTo(len / 2, -wid / 2 + 2);
      context.lineTo(len / 2 + 90, -wid / 2 - 26);
      context.lineTo(len / 2 + 90, wid / 2 + 26);
      context.lineTo(len / 2, wid / 2 - 2);
      context.closePath();
      context.fill();
    }
    // Police light bar, flashing.
    if (car.kind === 'police' && !car.dead) {
      const phase = Math.floor(car.sirenPhase * 6) % 2 === 0;
      context.fillStyle = phase ? '#ff3b30' : '#2f6bff';
      context.fillRect(-8, -wid / 2 - 2, 8, 5);
      context.fillStyle = phase ? '#2f6bff' : '#ff3b30';
      context.fillRect(0, -wid / 2 - 2, 8, 5);
      context.fillStyle = phase ? 'rgba(255,59,48,0.25)' : 'rgba(47,107,255,0.25)';
      context.beginPath();
      context.arc(0, 0, 46, 0, Math.PI * 2);
      context.fill();
    }
    // Smoke when wrecked or nearly.
    if (car.health < 40 && !car.dead) {
      context.fillStyle = 'rgba(90,90,90,0.5)';
      context.beginPath();
      context.arc(-len / 4, 0, 8 + Math.sin(state.elapsed * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPed(ped, state) {
    context.save();
    context.translate(ped.x, ped.y);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.dead ? '#5a4a3a' : ped.color;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    if (!ped.dead) {
      context.fillStyle = '#e8c39a';
      context.beginPath();
      context.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
      context.fill();
      if (ped.state === 'officer') {
        context.fillStyle = '#1b2f5e';
        context.beginPath();
        context.arc(0, 0, 12, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#e8c39a';
        context.beginPath();
        context.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
        context.fill();
      }
      if (ped.state === 'enemy') {
        context.fillStyle = '#ff5a4e';
        context.font = 'bold 12px system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillText('!', 0, -16);
      }
    }
    context.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (player.inCar) return;
    context.save();
    context.translate(player.x, player.y);
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) context.globalAlpha = 0.4;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(2, 4, 13, 10, 0, 0, Math.PI * 2);
    context.fill();
    // Jacket, head, cap.
    context.fillStyle = '#2fa8a0';
    context.beginPath();
    context.arc(0, 0, 13, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8c39a';
    context.beginPath();
    context.arc(Math.cos(player.angle) * 5, Math.sin(player.angle) * 5, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffd23e';
    context.beginPath();
    context.arc(Math.cos(player.angle) * 5, Math.sin(player.angle) * 5 - 2, 6, Math.PI, Math.PI * 2);
    context.fill();
    // Pistol in hand when armed.
    if (player.mag > 0 || player.ammo > 0) {
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(Math.cos(player.angle) * 10, Math.sin(player.angle) * 10);
      context.lineTo(Math.cos(player.angle) * 22, Math.sin(player.angle) * 22);
      context.stroke();
    }
    context.restore();
  }

  function drawMarker(state, marker) {
    if (!marker) return;
    const pulse = 1 + Math.sin(state.elapsed * 5) * 0.18;
    context.save();
    context.translate(marker.x, marker.y);
    context.strokeStyle = PALETTE.marker;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = 'rgba(255, 210, 62, 0.18)';
    context.beginPath();
    context.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    context.fill();
    // A beam of light so the marker reads from far away.
    context.fillStyle = 'rgba(255, 210, 62, 0.10)';
    context.fillRect(-8, -400, 16, 400);
    // Floating diamond.
    const bob = Math.sin(state.elapsed * 3) * 6;
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(0, -52 + bob);
    context.lineTo(10, -40 + bob);
    context.lineTo(0, -28 + bob);
    context.lineTo(-10, -40 + bob);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawWaypointArrow(state, marker) {
    if (!marker) return;
    const player = state.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    const top = screenFromWorld(marker.x, marker.y);
    if (top.x > 60 && top.x < view.width - 60 && top.y > 60 && top.y < view.height - 60) return;
    const cx = view.width / 2;
    const cy = view.height / 2;
    const angle = Math.atan2(marker.y - py, marker.x - px);
    const ax = cx + Math.cos(angle) * Math.min(view.width, view.height) * 0.36;
    const ay = cy + Math.sin(angle) * Math.min(view.width, view.height) * 0.36;
    context.save();
    context.translate(ax, ay);
    context.rotate(angle);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-12, -12);
    context.lineTo(-6, 0);
    context.lineTo(-12, 12);
    context.closePath();
    context.fill();
    context.restore();
    const dist = Math.round(Math.hypot(marker.x - px, marker.y - py));
    context.fillStyle = PALETTE.text;
    context.font = 'bold 15px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(`${dist}m`, ax, ay + 30);
  }

  function drawTimeTint(state) {
    const clock = state.clock;
    let color = null;
    let alpha = 0;
    if (clock >= 18.5 || clock < 5.5) {
      color = '#0a1230';
      alpha = clock >= 18.5 ? Math.min(0.42, (clock - 18.5) * 0.2) : 0.42;
      if (clock < 5.5) alpha = 0.42;
    } else if (clock >= 17.5) {
      color = '#ff7a2f';
      alpha = (clock - 17.5) * 0.14;
    } else if (clock < 7) {
      color = '#ff9a5c';
      alpha = (7 - clock) * 0.08;
    }
    if (color && alpha > 0) {
      context.fillStyle = color;
      context.globalAlpha = Math.min(0.42, alpha);
      context.fillRect(0, 0, view.width, view.height);
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt) {
    const w = 620;
    const h = 150 + lines.length * 34;
    const x = (view.width - w) / 2;
    const y = (view.height - h) / 2;
    context.fillStyle = PALETTE.panel;
    rr(x, y, w, h, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    rr(x, y, w, h, 14);
    context.stroke();
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillStyle = PALETTE.text;
    context.font = 'bold 44px system-ui, sans-serif';
    context.fillText(title, view.width / 2, y + 78);
    context.font = '21px system-ui, sans-serif';
    context.fillStyle = PALETTE.muted;
    lines.forEach((line, i) => context.fillText(line, view.width / 2, y + 128 + i * 34));
    context.fillStyle = PALETTE.marker;
    context.font = 'bold 22px system-ui, sans-serif';
    context.fillText(prompt, view.width / 2, y + h - 32);
  }

  function drawTitle(state) {
    drawPanel('SOLMAR CITY', [
      'A sun-soaked open-world crime story.',
      'Steal cars. Lose the cops. Do the jobs.',
      'WASD move / drive · Mouse aim · Click shoot',
      'E enter a car · F punch · R reload · P pause · M mute',
    ], 'Press Space or click to start');
    context.fillStyle = PALETTE.muted;
    context.font = '16px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText('Save: ' + (state.hasSave ? 'a saved game is waiting — press C to continue' : 'no save yet'), view.width / 2, view.height - 40);
  }

  /** Paint one frame: the world, the HUD's canvas parts, then the screen's panel. */
  function draw(state, screen, marker) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, view.width, view.height);
    updateCamera(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawGround(state);
    drawPlaceSigns(state);
    drawBuildings(state);
    drawProps(state);
    drawPickups(state);
    drawMarker(state, marker);
    for (const car of state.cars) if (!car.dead) drawCar(car, state);
    for (const ped of state.peds) if (!ped.gone) drawPed(ped, state);
    for (const enemy of state.missionState.enemies) if (!enemy.dead) drawPed(enemy, state);
    drawPlayer(state);
    // Particles.
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Back to screen space for the arrow and the light.
    context.setTransform(1, 0, 0, 1, 0, 0);
    drawWaypointArrow(state, marker);
    drawTimeTint(state);
    if (screen === SCREEN_TITLE) drawTitle(state);
    else if (screen === SCREEN_PAUSED) drawPanel('Paused', ['The city waits for you.'], 'Press P to keep playing');
    else if (screen === SCREEN_OVER) drawPanel('Wasted', ['Solmar General patched you up.', 'You dropped some cash on the way.'], 'Press Space to get back out there');
    else if (screen === SCREEN_BUSTED) drawPanel('Busted', ['The PD took their cut and let you go.', 'The heat is off — for now.'], 'Press Space to walk free');
    else if (screen === SCREEN_STORY) drawPanel('Story Complete', ['Every job done. Solmar is yours, Jax.', 'Free roam: the city, the cars, the cops.'], 'Press Space to keep playing');
    // Low health: a red edge.
    if (state.player.health > 0 && state.player.health < 30 && screen === SCREEN_PLAY) {
      context.strokeStyle = 'rgba(255, 59, 48, 0.55)';
      context.lineWidth = 14;
      context.strokeRect(0, 0, view.width, view.height);
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /** Point the camera at the player at once (screenshot staging, no slow pan). */
  function snap(state) {
    const player = state.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    camera.x = px;
    camera.y = py;
    camera.zoom = player.inCar ? 0.82 : 1.0;
  }

  return { draw, worldFromScreen, screenFromWorld, snap, get view() { return view; } };
}
