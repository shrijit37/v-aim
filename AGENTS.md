# Repository Guidelines — V-AIM (Valorant Aim Trainer)

## Project Overview

A browser-based aim trainer inspired by Valorant, built as a single-page HTML application. Players practice flicking, tracking, reflex, and deathmatch-style aim mechanics against procedurally generated targets. All rendering is canvas-based, audio is synthesised via the Web Audio API, and persistence uses `localStorage`.

---

## Architecture & Data Flow

The entire application lives in **one file** (`index.html`) with inline CSS and inline JavaScript. There is no build step, no bundler, no server-side component, and no framework.

```
index.html
 ├── <style> (CSS ~900 lines)
 ├── <body>/HTML (menus, HUD, overlays)
 └── <script> (JS ~1760 lines)
       ├── AudioManager          — Procedural sound via Web Audio API
       ├── StatsManager          — Settings + statistics in localStorage
       ├── EffectManager         — Hit markers, damage numbers, particles, sparks
       ├── Renderer (static)     — Canvas drawing helpers (targets, crosshair, background)
       ├── GridshotMode          — 5×8 grid of static targets, fast-flick training
       ├── TrackingMode          — Single moving target (Lissajous path), smooth tracking
       ├── ReflexMode            — Single target that vanishes quickly, reaction training
       ├── DeathmatchMode        — One moving target, speed scales with kills
       └── Game                  — State machine (menu → countdown → playing → paused → score)
                                  orchestrates modes, HUD updates, event binding
```

**Data flow:** User input → `Game._bindEvents()` → active mode's `onMouseDown(x,y)` / `onMouseMove(x,y)` → result + effects → HUD update → score screen → `StatsManager.recordGame()` → `localStorage`

**State machine:** `menu` → `countdown` → `playing` ↔ `paused` → `score` → `menu`

---

## Key Directories

The project root contains a single file:

| Path | Purpose |
|---|---|
| `index.html` | Entire application — HTML, CSS, and JavaScript |

No other directories, assets, or configuration files exist.

---

## Development Commands

There are no development commands. The app is a static HTML file — open it directly in a browser:

```
open index.html
```

No package.json, no build tooling, no linter, no type checker.

---

## Code Conventions & Common Patterns

### Formatting & Structure
- The file uses `/* ===== */` comment blocks to delimit sections (Audio, Stats, Effects, Renderer, each game mode, Game, Init).
- CSS uses a section-comment pattern: `/* === SECTION === */`.
- JS runs in `'use strict'` mode (line 1163).
- No semicolons are omitted; standard ES6 coding style.

### Naming
- **Classes:** PascalCase — `AudioManager`, `GridshotMode`, `StatsManager`, `EffectManager`, `Renderer`, `Game`
- **Methods:** camelCase — `_init()`, `setEnabled(v)`, `recordGame(…)`, `_spawnTarget()`
- **Private-ish methods** prefixed with `_` (convention only, no actual privacy) — `_initSettingsUI()`, `_getPos(e)`, `_renderCrosshairPreview()`
- **Settings/state keys:** dot-separated paths for `updateSetting('crosshair.size', val)`
- **DOM IDs:** kebab-case — `#gameCanvas`, `#ui-overlay`, `#hudStreak`, `#chSize`

### Class & Object Patterns
- Classes are **not exported** — they're global constructors in the single script scope.
- Game mode classes (`GridshotMode`, `TrackingMode`, `ReflexMode`, `DeathmatchMode`) implement the same interface:
  - `constructor(game)` — receives the `Game` orchestrator
  - `start()` — reset state, spawn initial targets
  - `update(dt)` — physics, timers, difficulty ramps
  - `render(ctx)` — draw mode-specific content
  - `onMouseDown(x, y)` → `{ hit, headshot } | null`
  - `onMouseMove(x, y)`
  - `end()` → `{ score, hits, shots, headshots, streak, reactionTimes, mode }`
- `Renderer` is a static utility class — all methods are `static`.
- `Game` orchestrates everything: owns `AudioManager`, `StatsManager`, `EffectManager`, and the active mode.

### Error Handling
- **Minimal** — JSON parsing in `StatsManager._load()` is wrapped in `try/catch` swallowing exceptions silently.
- `confirm()` dialog before resetting stats (line 2795).
- No validation beyond null/undefined checks.

### State Persistence
- `localStorage` key `'vaim_data'` stores all settings and per-mode statistics.
- `StatsManager._mergeDefaults()` merges saved data with latest defaults so new keys don't break old saves.
- Reaction times are capped at 1000 entries per mode (FIFO slice).

### Audio
- All sounds are procedurally synthesised via `AudioContext` + oscillators, noise buffers, and filter chains.
- No audio files are loaded.
- Audio is lazily initialised on first user interaction (`_unlockAudio()` to handle autoplay policy).

### Effects
- Visual feedback uses the `EffectManager` — hit markers (rotating "X"), damage numbers (floating text), particle bursts, sparks.
- All effects are time-based (no sprite sheets or pre-rendered assets).
- Effects are cleared between rounds.

### Touch Support
- Both mouse and touch events are handled, with `touch-action: none` and `preventDefault()` to avoid scroll interference.

---

## Important Files

| File | Role |
|---|---|
| `index.html` | Single entry point — all HTML, CSS, and JS |

**Key classes within the script:**
- `AudioManager` — lines 1168–1327
- `StatsManager` — lines 1332–1447
- `EffectManager` — lines 1452–1611
- `Renderer` — lines 1616–1774
- `GridshotMode` — lines 1779–1910
- `TrackingMode` — lines 1915–2019
- `ReflexMode` — lines 2024–2135
- `DeathmatchMode` — lines 2140–2272
- `Game` — lines 2277–2918

---

## Runtime/Tooling Preferences

- **Runtime:** Any modern browser (Chrome, Firefox, Safari, Edge).
- **No Node.js, no package manager, no build step required.**
- There is no TypeScript, no linter, no formatter configured.

---

## Testing & QA

- **No test framework exists.** The project has zero tests.
- **QA is manual** — open `index.html` in a browser and play through each game mode.
- There are no CI/CD pipelines.

---

## Design Patterns Summary

| Pattern | Where |
|---|---|
| State machine | `Game.state` drives menu/countdown/playing/paused/score transitions |
| Strategy / polymorphism | Each game mode implements the same interface; `Game.mode` references the active one |
| Static utility class | `Renderer` — pure functions with no instance state |
| Manager singletons | `AudioManager`, `StatsManager`, `EffectManager` — one instance each, owned by `Game` |
| Lazy initialisation | `AudioContext` created on first sound play, not at page load |
| Procedural generation | Audio (oscillators + noise) and all visual effects (no assets) |
| localStorage persistence | Settings and stats survive page reloads |
| CSS custom properties | Theming via `data-theme` attribute on `<html>` |
