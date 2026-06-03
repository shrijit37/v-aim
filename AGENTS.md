# Repository Guidelines — V-AIM (Valorant Aim Trainer)

## Project Overview

A professional browser-based aim trainer inspired by Valorant. Players practice flicking, tracking, reflex, and deathmatch-style aim mechanics against procedurally generated targets. All rendering is canvas-based, audio is synthesised via the Web Audio API, and persistence uses `localStorage`.

**Production URL:** https://v-aim.vercel.app  
**Repository:** https://github.com/shrijit37/v-aim

---

## Architecture & Data Flow

The application uses modular ES modules bundled by esbuild for production.

```
index.html              → Slim shell, references external CSS/JS
styles.css              → All styles (~1100 lines), CSS custom properties
src/
 ├── main.js            → Entry point: imports Game, boots on DOMContentLoaded
 ├── game.js            → State machine orchestrator (menu→countdown→playing→paused→score)
 │                        owns AudioManager, StatsManager, EffectManager, active mode
 │                        includes Ranking, Training Routines, Keybinds, Session History, FPS, Export/Import
 ├── audio-manager.js   → Procedural sound synthesis via Web Audio API
 ├── stats-manager.js   → localStorage persistence, settings merging, defaults
 ├── effect-manager.js  → Hit markers, damage numbers, particle bursts, sparks
 ├── renderer.js        → Static canvas drawing helpers (targets, crosshair, background)
 └── modes/
      ├── gridshot.js   → 5×8 grid of static targets, fast-flick training
      ├── tracking.js   → Single moving target (Lissajous path), smooth tracking
      ├── reflex.js     → Single target that vanishes quickly, reaction training
      └── deathmatch.js → One bouncing target, speed scales with kills
dist/
 └── bundle.js          → esbuild production bundle (minified)
```

**Data flow:** User input → `Game._bindEvents()` → active mode's `onMouseDown(x,y)` / `onMouseMove(x,y)` → result + effects → HUD update → score screen → `StatsManager.recordGame()` → `localStorage`

**State machine:** `menu` → `countdown` → `playing` ↔ `paused` → `score` → `menu`

---

## Key Directories

| Path | Purpose |
|---|---|
| `index.html` | HTML shell — references external CSS/JS only |
| `styles.css` | All CSS styles |
| `src/` | ES module source files |
| `dist/` | esbuild production bundle (gitignored) |
| `.github/workflows/` | CI/CD pipelines (deploy, validate, lighthouse) |
| `vercel.json` | Vercel deployment configuration (with build step) |

---

## Development Commands

```bash
npm install           # Install dependencies
npm run build         # Build production bundle → dist/bundle.js
npm run dev           # Watch mode for development
npm run lint:css      # Run stylelint on CSS
```

---

## Code Conventions & Common Patterns

- **ES modules** — all source files use `export class` / `import { ... } from`
- **Classes:** PascalCase — `AudioManager`, `GridshotMode`, `StatsManager`, `EffectManager`, `Renderer`, `Game`
- **Methods:** camelCase — `_init()`, `setEnabled(v)`, `recordGame(…)`, `_spawnTarget()`
- **Private-ish methods** prefixed with `_` (convention only)
- **Settings/state keys:** dot-separated paths for `updateSetting('crosshair.size', val)`

### Game Modes Interface

All mode classes implement:
- `constructor(game)` — receives the `Game` orchestrator
- `start()` — reset state, spawn initial targets
- `update(dt)` — physics, timers, difficulty ramps
- `render(ctx)` — draw mode-specific content
- `onMouseDown(x, y)` → `{ hit, headshot } | null`
- `onMouseMove(x, y)`
- `end()` → `{ score, hits, shots, headshots, streak, reactionTimes, mode }`

### Professional Features

| Feature | Location |
|---|---|
| Ranking System (Bronze→Radiant) | `Game._getRank()`, `Game._updateRankDisplay()` |
| Training Routines | `Game._startTrainingRoutine()`, cycles through modes |
| Session History | `Game._sessionHistory`, stored in `localStorage('vaim_session_history')` |
| FPS Counter | `Game._createFPSCounter()` — real-time overlay |
| Keybind Customization | `StatsManager` defaults + `Game` keyboard handler |
| Export/Import | `Game._exportData()`, `Game._importData()` — JSON files |
| Animated Transitions | CSS scale/fade transitions on menu screens |
| Accessibility | ARIA labels, roles, `prefers-reduced-motion`, `:focus-visible` |
| Onboarding Tutorial | First-run overlay explaining all modes |

---

## Important Files

| File | Role |
|---|---|
| `index.html` | Entry point — references `styles.css` and `dist/bundle.js` |
| `styles.css` | Complete stylesheet with CSS custom properties theming |
| `package.json` | Dependencies and build scripts |
| `esbuild.config.mjs` | Build configuration for esbuild bundling |
| `vercel.json` | Vercel deployment config with build step |
| `.github/workflows/deploy.yml` | Vercel deploy with PR preview comments |
| `.github/workflows/validate.yml` | HTML/CSS validation + security scan |
| `.github/workflows/lighthouse.yml` | Lighthouse CI with performance budgets |
| `.lighthouserc.json` | Lighthouse assertion configuration |
