'use strict';

import { Renderer } from '../renderer.js';

export class ReflexMode {
  constructor(game) {
    this.game = game;
    this.name = 'reflex';
    this.displayName = 'REFLEX';
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

    const size = this.game.getTargetSize();
    const rad = size === 'small' ? 16 : size === 'medium' ? 22 : 30;
    this.visibility = size === 'small' ? 0.5 : size === 'medium' ? 0.7 : 1.0;
    this.target = { x: 0, y: 0, radius: rad, alive: false, timer: 0 };
    this._spawnTarget();
  }

  _spawnTarget() {
    const margin = 80;
    const w = this.game.width;
    const h = this.game.height;
    this.target.x = margin + Math.random() * (w - margin * 2);
    this.target.y = margin + Math.random() * (h - margin * 2);
    this.target.alive = true;
    const shrink = Math.min(0.5, Math.floor(this.kills / 10) * 0.05);
    this.target.timer = this.visibility * (1 - shrink);
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    if (this.target.alive) {
      this.target.timer -= dt;
      if (this.target.timer <= 0) {
        this.target.alive = false;
        this.timeLeft = Math.max(0, this.timeLeft - 0.5);
        this.streak = 0;
        this._scheduleNext();
      }
    }
  }

  _scheduleNext() {
    setTimeout(() => {
      if (this.running) this._spawnTarget();
    }, 300);
  }

  render(ctx) {
    if (this.target.alive) {
      Renderer.drawTarget(ctx, this.target.x, this.target.y, this.target.radius);
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
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      this.score += isHeadshot ? 150 : 100;
      const rt = this.game.lastClickTime ? (now - this.game.lastClickTime) / 1000 : 0.2;
      this.reactionTimes.push(rt);
      this.game.lastClickTime = now;
      this.target.alive = false;
      this.game.effects.addHitMarker(x, y);
      this.game.effects.addDamageNumber(x, y, isHeadshot ? 150 : 100, isHeadshot);
      if (isHeadshot) this.game.effects.addSparks(x, y, 6);
      this.game.effects.addKillBurst(this.target.x, this.target.y);
      this._scheduleNext();
      return { hit: true, headshot: isHeadshot };
    }
    this.streak = 0;
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
