// Save and continue: the player's money, health, ammo, mission progress, position
// and the clock, kept in this browser's localStorage. Saving happens when a mission
// ends and from the pause menu; the title screen offers to continue.

import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(state) {
  try {
    const player = state.player;
    const data = {
      version: 1,
      money: player.money,
      health: player.health,
      ammo: player.ammo,
      mag: player.mag,
      missionIndex: state.missionState.index,
      missionStep: state.missionState.step,
      missionComplete: state.missionState.complete,
      missionsDone: state.stats.missionsDone,
      x: player.inCar ? player.inCar.x : player.x,
      y: player.inCar ? player.inCar.y : player.y,
      clock: state.clock,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

/** Apply a loaded save to a fresh world. */
export function applySave(state, data) {
  const player = state.player;
  player.money = data.money;
  player.health = data.health;
  player.ammo = data.ammo;
  player.mag = data.mag;
  player.x = data.x;
  player.y = data.y;
  player.inCar = null;
  state.clock = data.clock;
  state.missionState.index = Math.min(data.missionIndex, state.missions.length - 1);
  state.missionState.step = data.missionStep;
  state.missionState.complete = !!data.missionComplete;
  state.missionState.enemies = [];
  state.stats.missionsDone = data.missionsDone || 0;
  state.wanted = 0;
}
