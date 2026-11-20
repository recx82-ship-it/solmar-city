// The HUD: DOM for crisp text (money, health, wanted stars, objective, prompts,
// speed, ammo, the clock) and a small canvas for the minimap — roads, the player
// arrow, police, the mission marker and nearby cars, all live.

import { PALETTE, WORLD } from './config.js';

export function createHud() {
  const money = document.getElementById('hud-money');
  const healthFill = document.getElementById('hud-health-fill');
  const healthText = document.getElementById('hud-health-text');
  const stars = document.getElementById('hud-stars');
  const clock = document.getElementById('hud-clock');
  const objective = document.getElementById('hud-objective');
  const prompt = document.getElementById('hud-prompt');
  const speed = document.getElementById('hud-speed');
  const ammo = document.getElementById('hud-ammo');
  const toastBox = document.getElementById('hud-toasts');
  const minimap = document.getElementById('hud-minimap');
  const mapCtx = minimap.getContext('2d');
  const toasts = [];
  let lastObjective = '';

  function formatClock(hours) {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    const hh = h % 12 === 0 ? 12 : h % 12;
    const ap = h < 12 ? 'AM' : 'PM';
    return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
  }

  function showToast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ` toast-${kind}` : '');
    el.textContent = text;
    toastBox.appendChild(el);
    toasts.push(el);
    window.setTimeout(() => {
      el.classList.add('toast-out');
      window.setTimeout(() => el.remove(), 600);
    }, 4200);
    while (toasts.length > 6) {
      const old = toasts.shift();
      if (old) old.remove();
    }
  }

  function drawMinimap(state, marker) {
    const w = minimap.width;
    const h = minimap.height;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    mapCtx.clearRect(0, 0, w, h);
    mapCtx.fillStyle = 'rgba(20, 28, 20, 0.9)';
    mapCtx.fillRect(0, 0, w, h);
    // Water and beach.
    mapCtx.fillStyle = '#2e7fa8';
    mapCtx.fillRect(0, state.city.beach.y * sy, w, (WORLD.height - state.city.beach.y) * sy);
    mapCtx.fillStyle = '#e8d29a';
    mapCtx.fillRect(0, state.city.beach.y * sy, w, 8);
    // Roads.
    mapCtx.fillStyle = '#8f96a3';
    for (const x of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) mapCtx.fillRect(x * sx - 1, 0, 2, h);
    for (const y of [200, 600, 1000, 1400, 1800, 2200]) mapCtx.fillRect(0, y * sy - 1, w, 2);
    // The park.
    mapCtx.fillStyle = '#69a854';
    mapCtx.fillRect(state.city.park.x * sx, state.city.park.y * sy, state.city.park.w * sx, state.city.park.h * sy);
    // Mission marker.
    if (marker) {
      const pulse = 3 + Math.sin(state.elapsed * 5) * 1.5;
      mapCtx.fillStyle = '#ffd23e';
      mapCtx.beginPath();
      mapCtx.arc(marker.x * sx, marker.y * sy, pulse + 2, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Police.
    mapCtx.fillStyle = '#4d8dff';
    for (const car of state.cars) {
      if (car.kind === 'police' && !car.dead) {
        mapCtx.beginPath();
        mapCtx.arc(car.x * sx, car.y * sy, 2.5, 0, Math.PI * 2);
        mapCtx.fill();
      }
    }
    // Player arrow.
    const player = state.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    mapCtx.save();
    mapCtx.translate(px * sx, py * sy);
    mapCtx.rotate(player.angle);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(6, 0);
    mapCtx.lineTo(-4, -4);
    mapCtx.lineTo(-4, 4);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    // View frame.
    mapCtx.strokeStyle = 'rgba(255,255,255,0.35)';
    mapCtx.lineWidth = 1;
    mapCtx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  /** Refresh every HUD element from the world state. */
  function update(state, marker, objectiveText, promptText) {
    const player = state.player;
    money.textContent = `$${player.money.toLocaleString('en-US')}`;
    const hp = Math.max(0, Math.round(player.health));
    healthFill.style.width = `${hp}%`;
    healthFill.style.background = hp < 30 ? '#ff5a4e' : hp < 60 ? '#ffb347' : '#58d158';
    healthText.textContent = `${hp}`;
    let starText = '';
    for (let i = 0; i < 5; i += 1) starText += i < state.wanted ? '★' : '☆';
    stars.textContent = starText;
    stars.style.color = state.wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.4)';
    clock.textContent = formatClock(state.clock);
    if (objectiveText !== lastObjective) {
      objective.textContent = objectiveText;
      lastObjective = objectiveText;
    }
    prompt.textContent = promptText || '';
    prompt.style.display = promptText ? 'block' : 'none';
    if (player.inCar) {
      speed.style.display = 'block';
      speed.textContent = `${Math.round(Math.abs(player.inCar.speed) * 0.24)} mph`;
    } else {
      speed.style.display = 'none';
    }
    ammo.style.display = player.inCar ? 'none' : 'block';
    ammo.textContent = player.reloading > 0 ? 'Reloading…' : `Ammo ${player.mag} / ${player.ammo}`;
    drawMinimap(state, marker);
  }

  return { update, showToast };
}
