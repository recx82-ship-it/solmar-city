# Solmar City — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/recx82-ship-it/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/recx82-ship-it/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** is a complete open-world crime game in the spirit of GTA 6, built
for make.fun's ["Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666).
It runs offline in a desktop browser from static files — no build step, no
network request, keyboard and mouse.

You are Jax Mercer, new in Solmar City — a sun-soaked coastal town with a beach,
a harbour, a park and a police force that does not like you. Mara Voss, the
fixer on the marina, has five jobs for you: steal a car, run a pickup, settle
some loose ends, lose a three-star wanted level, and steal a shipment truck
from the harbour. Between jobs the city is yours: steal any car, buy ammo at
Lock & Load, get a fresh paint job at Sunset Paint & Spray to clear the heat,
or just cruise the beach road at golden hour.

## What is in the game

- **A city on foot and by car** — a 3200×2400 road grid with buildings, a park,
  a beach and ocean, and a harbour, all generated from a seed.
- **Traffic and pedestrians** — cars that drive the grid and turn at
  intersections, people who walk the sidewalks and run from trouble.
- **Cars to steal** — parked cars, traffic cars (the driver bails), even a
  police car if you dare. Driving is arcade: throttle, steering, slides.
- **A wanted level and police** — five stars. Crimes raise the heat; police
  cars chase your last seen position and ram, officers on foot try to arrest
  you. Break line of sight and stay quiet and the heat cools off.
- **Missions and a story** — five jobs for Mara Voss with objectives, a
  waypoint arrow, minimap blips and a mission marker in the world.
- **Combat** — a pistol with mouse aim, a reload, and a punch for close work.
  Mission enemies shoot back.
- **A HUD with a minimap** — money, health, wanted stars, the clock, the
  objective, speed, ammo, and a live minimap with police and mission blips.
- **A start and a save** — title screen, pause menu, and a save in
  localStorage that keeps your money, health, ammo and mission progress.
- **Polish** — a day cycle (golden afternoon, purple dusk, dark night with
  headlights and lit windows), particles, and synthesised WebAudio sound:
  engine hum, sirens, gunshots, and a quiet bass-and-pad drive loop.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Run |
| Mouse | Aim (on foot) |
| Click | Shoot |
| E | Enter / steal a car, use a shop |
| F | Punch |
| R | Reload |
| P / Esc | Pause (saves) |
| M | Mute |
| Space / click | Start, continue |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

`?seed=N` fixes the city. `?shot=cover|drive|foot|title` stages a screenshot
scene. `?test=1` runs the scripted play-test and writes its results into the
page.

## Files

- `game/index.html` — the page, canvas and HUD
- `game/src/config.js` — tuning, palette, constants
- `game/src/city.js` — the city generator
- `game/src/entities.js` — the player, cars, pedestrians, physics
- `game/src/traffic.js` — traffic and pedestrian AI
- `game/src/police.js` — the wanted level and the Solmar PD
- `game/src/missions.js` — the five jobs for Mara Voss
- `game/src/world.js` — the world state and its fixed-step loop
- `game/src/render.js` — the camera and all the drawing
- `game/src/hud.js` — the HUD and the minimap
- `game/src/audio.js` — synthesised WebAudio sound and music
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — the screenshot scenes
- `game/src/test.js` — the scripted play-test
- `game/src/main.js` — boot and the game loop
- `main.ts` — the hand-in program (copies game/ and screenshots/ to /output)

Built by an AI agent for make.fun — see the bounty page for the entry.
