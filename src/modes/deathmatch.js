'use strict';

import { Renderer } from '../renderer.js';

export class DeathmatchMode {
  constructor(game) {
    this.game = game;
    this.name = 'deathmatch';
    this.displayName = 'DEATHMATCH';
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

    this.target = {
      x: this.game.width / 2, y: this.game.height / 2,
      radius: rad,
      vx: 100, vy: 60,
      alive: true,
      wobblePhase: Math.random() * Math.PI * 2
    };
    this.speed = 100;
    this._spawnTarget();
  }

  _spawnTarget() {
    if (!this.running) return;
    const margin = 80;
    const w = this.game.width;
    const h = this.game.height;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: this.target.x = Math.random() * w; this.target.y = margin; break;
      case 1: this.target.x = w - margin; this.target.y = Math.random() * h; break;
      case 2: this.target.x = Math.random() * w; this.target.y = h - margin; break;
      case 3: this.target.x = margin; this.target.y = Math.random() * h; break;
    }
    const angle = Math.random() * Math.PI * 2;
    this.target.vx = Math.cos(angle) * this.speed;
    this.target.vy = Math.sin(angle) * this.speed;
    this.target.alive = true;
    this.target.wobblePhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    if (this.target.alive) {
      const wobble = Math.sin(this.target.wobblePhase + this.game._elapsed * 6) * 4;
      this.target.wobblePhase += dt * 4;
      this.target.x += (this.target.vx + wobble) * dt;
      this.target.y += this.target.vy * dt;

      const m = 20;
      if (this.target.x < m) { this.target.x = m; this.target.vx = Math.abs(this.target.vx); }
      if (this.target.x > this.game.width - m) { this.target.x = this.game.width - m; this.target.vx = -Math.abs(this.target.vx); }
      if (this.target.y < m) { this.target.y = m; this.target.vy = Math.abs(this.target.vy); }
      if (this.target.y > this.game.height - m) { this.target.y = this.game.height - m; this.target.vy = -Math.abs(this.target.vy); }
    }
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
      const points = isHeadshot ? 150 : 100;
      this.score += points;
      this.target.alive = false;
      const rt = this.game.lastClickTime ? (now - this.game.lastClickTime) / 1000 : 0.2;
      this.reactionTimes.push(rt);
      this.game.lastClickTime = now;
      this.speed = 100 + this.kills * 8;
      this.game.effects.addHitMarker(x, y);
      this.game.effects.addDamageNumber(x, y, points, isHeadshot);
      if (isHeadshot) {
        this.game.effects.addSparks(x, y, 8);
        this.game.effects.addKillBurst(this.target.x, this.target.y);
        this._spawnTarget();
      } else {
        setTimeout(() => { if (this.running) this._spawnTarget(); }, 150);
      }
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
