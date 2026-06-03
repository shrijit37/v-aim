'use strict';

import { Renderer } from '../renderer.js';

export class TrackingMode {
  constructor(game) {
    this.game = game;
    this.name = 'tracking';
    this.displayName = 'TRACKING';
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
    this.elapsed = 0;
    this.onTargetTime = 0;
    this.onTarget = false;

    const size = this.game.getTargetSize();
    const rad = size === 'small' ? 16 : size === 'medium' ? 22 : 30;
    this.target = { x: this.game.width / 2, y: this.game.height / 2, radius: rad };
    this.speed = 1.0;
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    this.elapsed += dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    this.speed = 1.0 + Math.floor(this.elapsed / 15) * 0.2;

    const t = this.elapsed * 0.8 * this.speed;
    const w = this.game.width * 0.35;
    const h = this.game.height * 0.3;
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;

    this.target.x = cx + Math.sin(t) * w + Math.sin(t * 1.3) * 20;
    this.target.y = cy + Math.sin(t * 2) * h + Math.cos(t * 0.7) * 15;

    if (this.game.mouseX !== undefined && this.game.mouseY !== undefined) {
      const dx = this.game.mouseX - this.target.x;
      const dy = this.game.mouseY - this.target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.onTarget = dist <= this.target.radius;
      if (this.onTarget) {
        this.onTargetTime += dt * 1000;
        this.hits++;
      }
      this.shots++;
      this.score = Math.floor(this.onTargetTime);
    }
  }

  render(ctx) {
    Renderer.drawTarget(ctx, this.target.x, this.target.y, this.target.radius);
    Renderer.drawTrackingIndicator(ctx, this.target.x, this.target.y, this.onTarget);
  }

  onMouseDown(x, y) {
    if (!this.running) return null;
    this.shots++;
    const dx = x - this.target.x;
    const dy = y - this.target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= this.target.radius) {
      this.hits++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      const isHeadshot = dist <= this.target.radius * 0.28;
      if (isHeadshot) this.headshots++;
      this.game.effects.addHitMarker(x, y);
      this.game.effects.addDamageNumber(x, y, Math.floor(this.score), isHeadshot);
      return { hit: true, headshot: isHeadshot };
    }
    this.streak = 0;
    return { hit: false, headshot: false };
  }

  onMouseMove(x, y) {
    this.game.mouseX = x;
    this.game.mouseY = y;
  }

  end() {
    this.running = false;
    return {
      score: this.score,
      hits: this.hits,
      shots: this.shots,
      headshots: this.headshots,
      streak: this.maxStreak,
      reactionTimes: this.reactionTimes,
      mode: this.name,
      accuracy: this.shots > 0 ? (this.onTargetTime / (this.elapsed * 1000) * 100) : 0
    };
  }
}
