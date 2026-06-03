'use strict';

import { Renderer } from '../renderer.js';

export class PeekPracticeMode {
  constructor(game) {
    this.game = game;
    this.name = 'peek-practice';
    this.displayName = 'PEEK PRACTICE';
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
    const rad = size === 'small' ? 14 : size === 'medium' ? 18 : 24;

    this.target = {
      x: 0, y: 0,
      radius: rad,
      alive: false,
      peeking: false,
      peekProgress: 0, // 0 = hidden, 1 = fully peeked, then back to 0
      peekDuration: 0, // time to stay peeked
      peekTimer: 0,
      edge: 0, // 0=left, 1=top, 2=right, 3=bottom
      speed: 2.0, // peek speed multiplier
      slideOut: false
    };
    this._scheduleNext(0.5 + Math.random() * 0.5);
  }

  _scheduleNext(delay) {
    setTimeout(() => {
      if (this.running) this._startPeek();
    }, (delay || 0.5) * 1000);
  }

  _startPeek() {
    if (!this.running) return;
    const w = this.game.width;
    const h = this.game.height;
    const margin = 60;
    const edge = Math.floor(Math.random() * 4);
    const rad = this.target.radius;

    // Place target just off-screen on the chosen edge
    // Y position is clustered in the center band (head-height area)
    let x, y;
    const centerBand = h * 0.3 + Math.random() * h * 0.4; // 30%-70% height

    switch (edge) {
      case 0: // left
        x = -rad;
        y = centerBand;
        break;
      case 1: // top
        x = w * 0.2 + Math.random() * w * 0.6;
        y = -rad;
        break;
      case 2: // right
        x = w + rad;
        y = centerBand;
        break;
      case 3: // bottom
        x = w * 0.2 + Math.random() * w * 0.6;
        y = h + rad;
        break;
    }

    this.target.x = x;
    this.target.y = y;
    this.target.edge = edge;
    this.target.alive = true;
    this.target.hasReached = false;

    this.target.peeking = true;
    this.target.peekProgress = 0;
    this.target.slideOut = false;
    this.target.speed = 2.0 + this.kills * 0.08;

    // Peek duration decreases with kills
    this.target.peekDuration = Math.max(0.2, 0.6 - this.kills * 0.015);
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    if (!this.target.alive || !this.target.peeking) return;

    const speed = this.target.speed * 200 * dt;
    const w = this.game.width;
    const h = this.game.height;
    const peekDist = 80 + Math.random() * 40;

    if (!this.target.slideOut && !this.target.hasReached) {
      // Sliding in
      let reached = false;
      switch (this.target.edge) {
        case 0: // left
          this.target.x += speed;
          if (this.target.x >= peekDist) { this.target.x = peekDist; reached = true; }
          break;
        case 1: // top
          this.target.y += speed;
          if (this.target.y >= peekDist) { this.target.y = peekDist; reached = true; }
          break;
        case 2: // right
          this.target.x -= speed;
          if (this.target.x <= w - peekDist) { this.target.x = w - peekDist; reached = true; }
          break;
        case 3: // bottom
          this.target.y -= speed;
          if (this.target.y <= h - peekDist) { this.target.y = h - peekDist; reached = true; }
          break;
      }

      if (reached) {
        // Paused at peek - start timer
        this.target.hasReached = true;
        this.target.peekTimer = this.target.peekDuration;
      }
    }

    // Countdown while peeked
    if (this.target.peekTimer > 0) {
      this.target.peekTimer -= dt;
      if (this.target.peekTimer <= 0) {
        this.target.slideOut = true;
      }
    }

    // Sliding out
    if (this.target.slideOut) {
      switch (this.target.edge) {
        case 0:
          this.target.x -= speed * 1.5;
          if (this.target.x <= -this.target.radius) { this.target.alive = false; this._scheduleNext(); }
          break;
        case 1:
          this.target.y -= speed * 1.5;
          if (this.target.y <= -this.target.radius) { this.target.alive = false; this._scheduleNext(); }
          break;
        case 2:
          this.target.x += speed * 1.5;
          if (this.target.x >= w + this.target.radius) { this.target.alive = false; this._scheduleNext(); }
          break;
        case 3:
          this.target.y += speed * 1.5;
          if (this.target.y >= h + this.target.radius) { this.target.alive = false; this._scheduleNext(); }
          break;
      }
    }
  }

  render(ctx) {
    if (this.target.alive) {
      Renderer.drawTarget(ctx, this.target.x, this.target.y, this.target.radius);

      // Show peek warning indicator when about to slide out
      if (this.target.peekTimer > 0 && this.target.peekTimer < 0.15) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#FF4655';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(this.target.x, this.target.y, this.target.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
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
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      const base = 100;
      const headBonus = isHeadshot ? 50 : 0;
      this.score += base + headBonus;

      const rt = this.game.lastClickTime ? (now - this.game.lastClickTime) / 1000 : 0.2;
      this.reactionTimes.push(rt);
      this.game.lastClickTime = now;

      this.target.alive = false;
      this.game.effects.addHitMarker(x, y);
      this.game.effects.addDamageNumber(x, y, base + headBonus, isHeadshot);
      if (isHeadshot) {
        this.game.effects.addSparks(x, y, 6);
        this.game.effects.addKillBurst(this.target.x, this.target.y);
      }
      this._scheduleNext(0.2 + Math.random() * 0.3);
      return { hit: true, headshot: isHeadshot };
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
