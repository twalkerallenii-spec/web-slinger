# Web-Slinger 🕸️

A Three.js **Spider-Man-style web-swinging sandbox** — a dusk procedural Manhattan you traverse with real pendulum web-swinging, web-zips, wall-crawling, dive-kicks, and a style-combo score.

> Original red-and-blue web-slinger. **Not affiliated with, or a copy of, Marvel or Insomniac's Spider-Man** — this is an homage built from scratch with original procedural art and physics.

## Run it
Open `index.html` in a modern browser (Chrome recommended). It pulls two libraries from a CDN, so you need internet on first load:
- [three.js](https://threejs.org/) r128 — rendering
- [simplex-noise](https://github.com/jwagner/simplex-noise.js) — procedural texture grunge/dirt

Or serve locally:
```bash
cd spiderman
python3 -m http.server 8000
# open http://localhost:8000
```

## Controls
| Input | Action |
|---|---|
| **Mouse** | Look (click to lock pointer) |
| **W A S D** | Steer (air, ground, wall) |
| **Space / Left-Click** (hold) | Fire web & swing — release at the **bottom of the arc** for a **PERFECT** boost |
| **Shift / Right-Click** | Web-zip toward a surface |
| **W** while swinging | Reel in (tightens the arc, gains speed) · **S** lets out |
| **F** | Punch · **G** | Heavy kick (launches thug away) |
| **Q** | Web-strike — yank the nearest thug flying through the air |
| **E** | Cling to a wall |
| **1–4 / T** | Swap between four suits (Classic, Noir, Crimson, Cyber) |
| **R** | Respawn on a rooftop · **H** toggle help |

## The map — a geographically-real Manhattan
The city is built to the **real island's proportions** (~5.8:1 long, widest near 14th St, narrowing to the tips) with:
- The **avenue (N–S) / cross-street (E–W) grid**
- **Central Park** (59th–110th) with grass, trees and a pond — no anchors, so zip across it
- The **Hudson & East rivers** on both sides (fall in → respawn)
- **Financial District** super-talls at the south tip + a **Midtown** tower cluster below the park
- A **minimap** (bottom-right), **crime beacons** to chase, and web-thwip / wind audio

> This grounds the layout in public geographic fact rather than copying Insomniac's copyrighted level.

## The physics (how the swing works)
Position-based pendulum, the standard game approach:
1. Fire a web → pick the best rooftop anchor **above & ahead** of you.
2. Each frame: apply gravity, integrate, then **project the player back onto the rope-length sphere** and remove any outward velocity — that constraint *is* the pendulum.
3. On release, the arc's angular momentum becomes linear momentum, plus an Insomniac-style **forward + up "feel" boost** and a minimum release velocity.

Sources that informed the model: [Envato Tuts+ — Swinging Physics](https://code.tutsplus.com/swinging-physics-for-player-movement-as-seen-in-spider-man-2-and-energy-hook--gamedev-8782t), [Critical Hit — you're on a pendulum](https://www.criticalhit.net/gaming/youre-pendulum-youre-web-swinging-insomniacs-spider-man/).

## Files
- `index.html` — markup, HUD, script/library tags
- `styles.css` — all UI/HUD styling
- `game.js` — the whole game (one IIFE): city gen, player, physics, camera, combat, HUD

## Ideas for next
Rooftop-rim web wrapping, gadget web-bombs, a chase mission, minimap, gamepad, and audio (swing whoosh / thwip).
