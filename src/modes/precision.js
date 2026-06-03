'use strict';

import { Renderer } from '../renderer.js';

export class PrecisionMode {
  constructor(game) {
    this.game = game;
    this.name = 'precision';
    this.displayName = 'PRECISION';
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
    this.kills = 0;

    // Precision targets are very small — head-sized only
    const size = this.game.getTargetSize();
    // Override: precision mode uses even smaller targets regardless of setting
    const rad = size === 'small' ? 6 : size === 'medium' ? 9 : 12;
    this.target = { x: 0, y: 0, radius: rad, alive: false };
    this._spawnTarget();
  }

  _spawnTarget() {
    if (!this.running) return;
    const margin = 80;
    const w = this.game.width;
    const h = this.game.height;
    this.target.x = margin + Math.random() * (w - margin * 2);
    this.target.y = margin + Math.random() * (h - margin * 2);
    this.target.alive = true;
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }
  }

  render(ctx) {
    if (this.target.alive) {
      Renderer.drawTarget(ctx, this.target.x, this.target.y, this.target.radius, false);

      // Draw a very visible center dot (the actual hit zone)
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.target.x, this.target.y, this.target.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      ctx.restore();
    }
  }

  onMouseDown(x, y) {
    if (!this.running || !this.target.alive) return null;
    this.shots++;
    const now = performance.now();

    const dx = x - this.target.x;
    const dy = y - this.target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // In precision mode, only the headshot zone counts — no body hit
    if (dist <= this.target.radius * 0.28) {
      // Every hit is effectively a headshot
      this.headshots++;
      this.hits++;
      this.kills++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      const base = 150;
      this.score += base;

      const rt = this.game.lastClickTime ? (now - this.game.lastClickTime) / 1000 : 0.2;
      this.reactionTimes.push(rt);
      this.game.lastClickTime = now;

      this.target.alive = false;
      this.game.effects.addHitMarker(x, y);
      this.game.effects.addDamageNumber(x, y, base, true);
      this.game.effects.addSparks(x, y, 6);
      this.game.effects.addKillBurst(this.target.x, this.target.y);

      this._spawnTarget();
      return { hit: true, headshot: true };
    }

    // Miss penalty
    this.streak = 0;
    this.score = Math.max(0, this.score - 50);
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
