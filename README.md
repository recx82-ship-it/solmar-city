# Solmar City

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/recx82-ship-it/solmar-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/recx82-ship-it/solmar-city/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar City** is a complete 2D top-down open-world crime game that runs in a
desktop browser from static files — no libraries, no network requests, no
build step. It was built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).

Jax Mercer came back to Solmar City with nothing but a duffel bag and a name
the old crews still remember. Fixer Mara Voss has five jobs for him, the
Solmar PD has five stars with his name on them, and the whole sun-soaked city
is open from the first minute: drive it, walk it, steal from it.

## What is in the city

- **A real open world** — a 5200×5200 grid city with downtown towers, homes,
  a park, a marina and a harbor, traffic on every road and pedestrians on
  every sidewalk, all of it seeded so the same seed deals the same city.
- **On foot and by car** — run the streets, jack parked cars or pull drivers
  out of moving traffic, and drive with proper acceleration, steering and
  drift. Cars can be wrecked; wrecks strand you on foot.
- **A 5-star wanted level** — steal a car, hit a pedestrian or shoot up the
  street and the stars climb. Police cruisers spawn, chase and ram you, and
  the heat only fades once you are out of sight.
- **Combat** — punch up close, shoot with the mouse, and take on rival crews
  who shoot back.
- **Five story missions** — First Wheels, The Drop, Heat Run, Harbor Lights
  and The Big Score, each with its own objectives, a gold marker guiding you
  across the map, and a cash payout at the end.
- **A HUD with a live minimap** — cash, health, wanted stars, clock, mission
  tracker and a minimap showing roads, the player, police, rivals and the
  mission marker.
- **A start screen and a save** — progress (mission, cash, position, time of
  day) is saved to localStorage when a mission is completed or the run ends,
  and the title screen offers to continue it.
- **A day cycle** — the clock runs from morning through dusk to night; the
  sky tint, lit windows and street lights follow it.
- **Synthesized sound and music** — engine hum, two-tone sirens, gunshots and
  a looping bass-and-keys groove, all generated with WebAudio. `M` mutes.

Everything in the game — the city, the characters, the vehicles, the story,
the art, the sound and the music — is original work. Nothing is taken from
Rockstar Games.

## How to play

Serve the `game/` folder and open it in desktop Chrome:

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly from any static file server.

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive in a car |
| Shift | Run |
| E | Enter / steal a car, get out |
| Mouse click | Shoot (on foot) |
| F | Punch |
| P | Pause |
| M | Mute |
| H | Help |

## Layout

- `game/index.html` — the page; loads the game from `game/src/`.
- `game/src/main.js` — boot, the fixed-step loop, screens, save/load.
- `game/src/world.js` — the simulation: player, traffic, pedestrians,
  police, wanted level, combat, missions, day cycle.
- `game/src/city.js` — the seeded city: roads, blocks, buildings, parks,
  harbor and named places.
- `game/src/render.js` — all drawing: the city, the HUD and the minimap.
- `game/src/audio.js` — synthesized WebAudio sound and music.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the staged screenshot scenes (`?shot=start|drive|chase|mission`).
- `game/src/config.js` — tuning, palette and the mission scripts.
- `game/src/random.js` — the seeded random generator.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json`.
- `serve.ts` — a tiny static server for local play.
- `shots.json` — the four screenshot scenes and their URLs.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game's own
code, staged by `?shot=…` with a fixed seed: the title over the living city,
driving through downtown, a three-star police chase, and the Harbor Lights
mission at the docks.

---

Built for [make.fun](https://make.fun) — see the
[GTA 6 bounty](https://make.fun/bounty/gta6-01).
