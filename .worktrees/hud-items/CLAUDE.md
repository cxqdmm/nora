# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Phaser 3 browser game called "毛毛虫找家" (Caterpillar Find Home). The player guides a caterpillar along a branching tree map from a start node to a home node, managing energy and collecting food. No build step — pure ES modules served statically.

## Running the Game

```bash
# Any static server works, e.g.:
python3 -m http.server 8080
# Then open http://localhost:8080
```

No build, no tests, no linter.

## Architecture

### Scenes (scene lifecycle)
`BootScene` → `MenuScene` → `GameScene` → `WinScene` / `LoseScene`

Each scene is a `Phaser.Scene` subclass registered in `src/main.js`.

### GameScene Orchestration
`GameScene` owns the game loop and coordinates all modules. Module instantiation order matters because of dependencies:

```
GameScene
  EnergyModule  — pure logic, no Phaser
  MapModule     — needs scene + levelData
  FoodModule    — needs scene + MapModule
  CaterpillarModule — needs scene + MapModule
  UIModule      — needs scene + EnergyModule
```

Creation order: `energy → map → food → cat → ui`, then `create()` on each.

### Modules

| Module | Responsibility |
|---|---|
| `MapModule` | Graph (node/edge) data, adjacency lookup, branch drawing, clickable nodes, pathfinding helpers |
| `CaterpillarModule` | Caterpillar body drawing (segmented, with history queue), movement tweens, position tracking |
| `FoodModule` | Food placement on nodes, pickup detection, floating-bob animation |
| `EnergyModule` | Pure JS energy pool (drain/restore), callbacks: `onEmpty`, `onChange`. No Phaser dependency. |
| `UIModule` | HUD: energy bar, hint text, food pickup floating text, back button |

### Level Data Format (`src/levels/level{N}.js`)

Each level exports an object with:
- `nodes[]` — `{ id, x, y, isStart?, isHome?, isDead? }` (pixel coords on 800×600 canvas)
- `edges[]` — `[nodeIdA, nodeIdB]` pairs (bidirectional)
- `food[]` — `{ nodeId, type: 'leaf'|'berry'|'apple' }`
- `startNode`, `homeNode`, `initialEnergy`, `hint`

Energy values in `CONFIG.ENERGY.FOOD`. Movement drain: `distance × CONFIG.ENERGY.DRAIN_PER_PX`.

### Key Patterns

- **Bezier approximation**: Phaser 3 Graphics has no `quadraticCurveTo` — `quadBezier()` in both `MapModule` and `CaterpillarModule` polyfills it with line segments.
- **History queue** (`CaterpillarModule._posHistory`): circular queue of `{x,y}` points. Each body segment samples from this history at `i * 4` offset, creating the tail-follows-head effect.
- **Camera fade transitions**: Scenes use `cameras.main.fadeIn/fadeOut` with `camerafadeoutcomplete` events to sequence transitions.
- **`onMoveComplete` callback**: `CaterpillarModule` fires this when a tween completes; `GameScene` uses it to trigger energy drain, food pickup, and win/lose checks.
- **`setScrollFactor(0)`**: UI elements use this to stay fixed relative to the camera viewport.

## Adding a New Level

1. Create `src/levels/level4.js` with the standard level object shape.
2. Add it to the `LEVELS` map at the top of `GameScene.js`.
3. (Optional) Add a button in `MenuScene._drawLevelButtons()`.
