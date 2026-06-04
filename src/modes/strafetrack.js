'use strict';

import { Renderer } from '../renderer.js';

export class StrafetrackMode {
  constructor(game) {
    this.game = game;
    this.name = 'strafetrack';
    this.displayName = 'STRAFETRACK';
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
    this.kills = 0;

    const size = this.game.getTargetSize();
    const rad = size === 'small' ? 14 : size === 'medium' ? 18 : 24;

    const cy = this.game.height * 0.3 + Math.random() * this.game.height * 0.4;
    this.target = {
      x: this.game.width * 0.2,
      y: cy,
      radius: rad,
      baseY: cy
    };

    // Strafing state
    this.strafeDir = 1; // 1 = right, -1 = left
    this.strafeSpeed = 200; // px/s
    this.isPaused = false;
    this.pauseTimer = 0;
    this.strafeBounds = {
      left: this.game.width * 0.15,
      right: this.game.width * 0.85
    };
    this.minPause = 0.3;
    this.maxPause = 1.2;

    // Stats for bonus scoring
    this.hitsWhileMoving = 0;
    this.hitsWhileStopped = 0;
    this._setNextPause();
  }

  _setNextPause() {
    // Randomize next strafe parameters
    this.strafeSpeed = 150 + Math.random() * 150 + this.kills * 5;
    const boundsPad = 60 + Math.random() * 80;
    this.strafeBounds = {
      left: boundsPad,
      right: this.game.width - boundsPad
    };
  }

  _startPause() {
    this.isPaused = true;
    this.pauseTimer = Math.max(0.2, this.minPause + Math.random() * (this.maxPause - this.minPause));
    // Speed increases with kills
    this.pauseTimer = Math.max(0.15, this.pauseTimer - this.kills * 0.008);
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    this.elapsed += dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    if (this.isPaused) {
      this.pauseTimer -= dt;
      if (this.pauseTimer <= 0) {
        this.isPaused = false;
        // Randomize direction on unpause
        this.strafeDir = Math.random() > 0.4 ? this.strafeDir : -this.strafeDir;
        this._setNextPause();
      }
    } else {
      // Move target horizontally
      this.target.x += this.strafeDir * this.strafeSpeed * dt;

      // Bounce off bounds and pause briefly (like a peek)
      if (this.target.x <= this.strafeBounds.left) {
        this.target.x = this.strafeBounds.left;
        this.strafeDir = 1;
        this._startPause();
      } else if (this.target.x >= this.strafeBounds.right) {
        this.target.x = this.strafeBounds.right;
        this.strafeDir = -1;
        this._startPause();
      }
    }

    // Track whether player is on target
    if (this.game.mouseX !== undefined && this.game.mouseY !== undefined) {
      const dx = this.game.mouseX - this.target.x;
      const dy = this.game.mouseY - this.target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.onTarget = dist <= this.target.radius;

      if (this.onTarget) {
        // Score scales: more points for tracking while moving vs while paused
        const trackingMultiplier = this.isPaused ? 0.5 : 1.5;
        this.onTargetTime += dt * trackingMultiplier;
      }
    }

    // Score from tracking time
    this.score = Math.floor(this.onTargetTime);
  }

  render(ctx) {
    Renderer.drawTarget(ctx, this.target.x, this.target.y, this.target.radius);

    // Draw tracking indicator
    Renderer.drawTrackingIndicator(ctx, this.target.x, this.target.y, this.onTarget);

    // Draw movement indicator
    ctx.save();
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.isPaused ? '#2ECC71' : '#FF4655';
    ctx.fillText(this.isPaused ? 'STOPPED' : 'MOVING', this.target.x, this.target.y - this.target.radius - 16);
    ctx.restore();
  }

  onMouseDown(x, y) {
    if (!this.running) return null;
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

      // Bonus points for hitting while moving
      let base = 50;
      if (!this.isPaused) {
        base = 100; // Harder to hit while moving
        this.hitsWhileMoving++;
      } else {
        this.hitsWhileStopped++;
      }
      const headBonus = isHeadshot ? 50 : 0;
      this.score += base + headBonus;

      const rt = this.game.lastClickTime ? (now - this.game.lastClickTime) / 1000 : 0.2;
      this.reactionTimes.push(rt);
      this.game.lastClickTime = now;

      this.game.effects.addHitMarker(x, y);
      this.game.effects.addDamageNumber(x, y, base + headBonus, isHeadshot);
      if (isHeadshot) {
        this.game.effects.addSparks(x, y, 6);
      }
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
      mode: this.name
    };
  }
}
