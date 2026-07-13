# Headless test harness

A browser-free "emulator" that runs `game.js` and **presses buttons to verify behavior** — so
regressions get caught without opening Chrome (the game is WebGL; CI has no GPU).

## Run
```bash
npm install       # gets express + the three devDependency
npm test          # or: node test/harness.js
```
Exit code `0` = PASS, `1` = FAIL.

## How it works
- Loads the **real three.js** (all vector/scene math is genuine) but swaps `THREE.WebGLRenderer`
  for a no-op renderer, and stubs the DOM, 2D canvas, `Image`, `AudioContext`, `localStorage`,
  gamepad, and `requestAnimationFrame`.
- Executes `game.js`, then drives it like a player: clicks **ENTER**, holds **Space+WASD**,
  moves the mouse, fires **F/G/Q** attacks, swaps suits, **respawns**, and toggles **World Builder**.
- Reads real state through the game's `window.__wsState()` debug hook and asserts:
  player actually moves while swinging, never falls through the world, health/web stay sane,
  respawn lands on a roof, a placed block becomes real city, etc.

## Why it exists
Two shipped bugs would have been caught here instantly:
1. `Object.assign(mesh, {position})` throwing on init (read-only `Object3D.position`) — killed the
   ENTER button.
2. Any exception before the button's click handler is attached.

Run `npm test` before every push.
