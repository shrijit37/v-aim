'use strict';

import { Renderer } from '../renderer.js';

export class SprayControlMode {
  constructor(game) {
    this.game = game;
    this.name = 'spray-control';
    this.displayName = 'SPRAY CONTROL';
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
    this.consecutiveHits = 0;
    this.kills = 0;

    const size = this.game.getTargetSize();
    const rad = size === 'small' ? 14 : size === 'medium' ? 18 : 24;
    this.target = {
      x: this.game.width / 2,
      y: this.game.height / 2,
      radius: rad,
      baseRadius: rad,
      alive: true
    };
  }

  _repositionTarget() {
    const margin = 80;
    const w = this.game.width;
    const h = this.game.height;
    const rad = this.target.baseRadius;

    // Each consecutive hit shrinks the target and moves it further
    const shrink = Math.min(rad * 0.6, rad - 6);
    const newRad = Math.max(8, rad - Math.floor(this.consecutiveHits / 3) * 2);

    // Move target within a radius that grows with consecutive hits
    const spread = Math.min(200, 40 + this.consecutiveHits * 8);
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * spread;
    let nx = this.target.x + Math.cos(angle) * dist;
    let ny = this.target.y + Math.sin(angle) * dist;
    nx = Math.max(margin, Math.min(w - margin, nx));
    ny = Math.max(margin, Math.min(h - margin, ny));

    this.target.x = nx;
    this.target.y = ny;
    this.target.radius = newRad;
    this.target.alive = true;
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }
  }

  render(ctx) {
    if (this.target.alive) {
      Renderer.drawTarget(ctx, this.target.x, this.target.y, this.target.radius);

      // Draw streak indicator below target
      if (this.consecutiveHits > 0) {
        ctx.save();
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF4655';
        ctx.fillText(`${this.consecutiveHits}x`, this.target.x, this.target.y + this.target.radius + 20);
        ctx.restore();
      }
    }
  }

  onMouseDown(x, y) {
    if (!this.running || !this.target.alive) return null;
    this.shots++;
    const now = performance.now();

    const dx = x - this.target.x;
    const dy = y - this.target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.target.radius) {
      const isHeadshot = dist <= this.target.radius * 0.28;
      if (isHeadshot) this.headshots++;
      this.hits++;
      this.kills++;
      this.consecutiveHits++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      // Scoring: base + streak bonus + headshot bonus
      const base = 10;
      const streakBonus = Math.min(this.consecutiveHits * 2, 50);
      const headBonus = isHeadshot ? 5 : 0;
      const points = base + streakBonus + headBonus;
      this.score += points;

      const rt = this.game.lastClickTime ? (now - this.game.lastClickTime) / 1000 : 0.2;
      this.reactionTimes.push(rt);
      this.game.lastClickTime = now;

      this.game.effects.addHitMarker(x, y);
      this.game.effects.addDamageNumber(x, y, points, isHeadshot);
      if (isHeadshot) this.game.effects.addSparks(x, y, 4);

      // Reposition for next spray transfer
      this._repositionTarget();
      return { hit: true, headshot: isHeadshot };
    }

    // Miss - reset streak, target stays
    this.streak = 0;
    this.consecutiveHits = 0;
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
