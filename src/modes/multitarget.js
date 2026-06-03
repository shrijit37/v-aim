'use strict';

import { Renderer } from '../renderer.js';

export class MultitargetMode {
  constructor(game) {
    this.game = game;
    this.name = 'multitarget';
    this.displayName = 'MULTITARGET';
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
    this.targets = [];
    this.nextId = 0;
    this.clusterSize = 3;
    this.clusterClearTime = 0;

    this._spawnCluster();
  }

  _spawnCluster() {
    if (!this.running) return;
    const w = this.game.width;
    const h = this.game.height;
    const margin = 80;

    const size = this.game.getTargetSize();
    const rad = size === 'small' ? 14 : size === 'medium' ? 18 : 24;

    // Increase cluster size as player progresses
    this.clusterSize = Math.min(6, 3 + Math.floor(this.kills / 8));

    // Choose a cluster center, biased toward center of screen
    const cx = w * 0.3 + Math.random() * w * 0.4;
    const cy = h * 0.3 + Math.random() * h * 0.4;

    // Spawn targets in a cluster around the center
    this.targets = [];
    for (let i = 0; i < this.clusterSize; i++) {
      const angle = (Math.PI * 2 * i) / this.clusterSize + (Math.random() - 0.5) * 0.5;
      const dist = rad * 2.5 + Math.random() * rad * 2;
      const tx = Math.max(margin, Math.min(w - margin, cx + Math.cos(angle) * dist));
      const ty = Math.max(margin, Math.min(h - margin, cy + Math.sin(angle) * dist));

      this.targets.push({
        id: this.nextId++,
        x: tx,
        y: ty,
        radius: rad,
        alive: true,
        spawnScale: 0
      });
    }

    this.clusterSpawnTime = performance.now();
  }

  update(dt) {
    if (!this.running) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.running = false; return; }

    // Animate spawn scale
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

    for (const t of this.targets) {
      if (!t.alive) continue;
      const dx = x - t.x;
      const dy = y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= t.radius) {
        const isHeadshot = dist <= t.radius * 0.28;
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

        t.alive = false;
        this.game.effects.addHitMarker(x, y);
        this.game.effects.addDamageNumber(x, y, base + headBonus, isHeadshot);
        if (isHeadshot) this.game.effects.addSparks(x, y, 5);

        // Check if cluster is cleared
        if (this.targets.every(tg => !tg.alive)) {
          const clearTime = (performance.now() - this.clusterSpawnTime) / 1000;
          const timeBonus = Math.max(0, Math.floor((5 - clearTime) * 20));
          this.score += timeBonus;
          this.game.effects.addDamageNumber(x, y + 30, `+${timeBonus}`, false);
          this._spawnCluster();
        }

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
