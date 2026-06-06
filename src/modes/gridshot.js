'use strict';

import { Renderer } from '../renderer.js';

export class GridshotMode {
  constructor(game) {
    this.game = game;
    this.name = 'gridshot';
    this.displayName = 'GRIDSHOT';
  }

  start() {
    this.score = 0;
    this.shots = 0;
    this.hits = 0;
    this.headshots = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.reactionTimes = [];
    this.timeLeft = this.game.getTimerDuration();
    this.running = true;
    this.targets = [];
    this.nextId = 0;

    const size = this.game.getTargetSize();
    const cols = 5;
    const rows = 8;
    const w = this.game.width;
    const h = this.game.height;
    const margin = 60;
    const gapX = (w - margin * 2) / cols;
    const gapY = (h - margin * 2) / rows;

    this.gridCells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.gridCells.push({
          x: margin + c * gapX + gapX / 2,
          y: margin + r * gapY + gapY / 2
        });
      }
    }

    // Spawn 3 initial targets
    for (let i = 0; i < 3; i++) {
      this._spawnNewTarget();
    }
  }

  _spawnNewTarget(excludeCell = null) {
    if (!this.running) return;
    const occupied = new Set(this.targets.map(t => `${t.x},${t.y}`));
    if (excludeCell) {
      occupied.add(excludeCell);
    }
    const available = this.gridCells.filter(c => !occupied.has(`${c.x},${c.y}`));
    if (available.length === 0) return;
    const cell = available[Math.floor(Math.random() * available.length)];
    const size = this.game.getTargetSize();
    const rad = size === 'small' ? 14 : size === 'medium' ? 18 : 24;
    this.targets.push({
      id: this.nextId++,
      x: cell.x,
      y: cell.y,
      radius: rad,
      alive: true,
      spawnScale: 0
    });
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    for (const t of this.targets) {
      if (t.alive && t.spawnScale < 1) {
        t.spawnScale = Math.min(1, t.spawnScale + dt * 10);
      }
    }
  }

  render(ctx) {
    for (const t of this.targets) {
      if (t.alive) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.scale(t.spawnScale, t.spawnScale);
        Renderer.drawTarget(ctx, 0, 0, t.radius);
        ctx.restore();
      }
    }
  }

  onMouseDown(x, y) {
    if (!this.running) return null;
    this.shots++;
    const now = performance.now();

    for (let i = 0; i < this.targets.length; i++) {
      const t = this.targets[i];
      if (!t.alive) continue;
      const dx = x - t.x;
      const dy = y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= t.radius) {
        const isHeadshot = dist <= t.radius * 0.28;
        if (isHeadshot) this.headshots++;
        this.hits++;
        this.streak++;
        if (this.streak > this.maxStreak) this.maxStreak = this.streak;
        const timeBonus = Math.floor((this.timeLeft / this.game.getTimerDuration()) * 50);
        const base = 100;
        const headBonus = isHeadshot ? 50 : 0;
        this.score += base + timeBonus + headBonus;
        t.alive = false;

        // Remove hit target and spawn new one
        const hitX = t.x;
        const hitY = t.y;
        this.targets.splice(i, 1);
        this._spawnNewTarget(`${hitX},${hitY}`);

        const rt = this.game.lastClickTime ? (now - this.game.lastClickTime) / 1000 : 0.2;
        this.reactionTimes.push(rt);
        this.game.lastClickTime = now;
        this.game.effects.addHitMarker(x, y);
        this.game.effects.addDamageNumber(x, y, Math.floor(base + timeBonus + headBonus), isHeadshot);
        if (isHeadshot) this.game.effects.addSparks(x, y, 6);
        return { hit: true, headshot: isHeadshot };
      }
    }

    this.streak = 0;
    this.game.effects.addDamageNumber(x, y, 'MISS', false);
    return { hit: false, headshot: false };
  }

  onMouseMove(x, y) {}

  end() {
    this.running = false;
    return {
      score: this.score,
      hits: this.hits,
      shots: this.shots,
      headshots: this.headshots,
      streak: this.maxStreak,
      reactionTimes: this.reactionTimes,
      mode: this.name
    };
  }
}
