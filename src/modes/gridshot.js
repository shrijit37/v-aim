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
    const rad = size === 'small' ? 14 : size === 'medium' ? 18 : 24;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.targets.push({
          id: this.nextId++,
          x: margin + c * gapX + gapX / 2,
          y: margin + r * gapY + gapY / 2,
          radius: rad,
          alive: true,
          respawnTimer: 0,
          spawnScale: 1
        });
      }
    }
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    let respawning = false;
    for (const t of this.targets) {
      if (!t.alive) {
        t.respawnTimer -= dt;
        if (t.respawnTimer <= 0) {
          t.alive = true;
          t.spawnScale = 0;
        }
      }
      if (t.alive && t.spawnScale < 1) {
        t.spawnScale = Math.min(1, t.spawnScale + dt * 8);
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

    for (const t of this.targets) {
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
        t.respawnTimer = 0.25;
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
