'use strict';

export class EffectManager {
  constructor() {
    this.hitMarkers = [];
    this.damageNumbers = [];
    this.particles = [];
    this.sparks = [];
  }

  addHitMarker(x, y) {
    this.hitMarkers.push({ x, y, time: 0, duration: 0.4 });
  }

  addDamageNumber(x, y, value, isHeadshot) {
    this.damageNumbers.push({
      x, y, value, isHeadshot,
      time: 0, duration: 0.8,
      offsetX: (Math.random() - 0.5) * 20,
      startY: y
    });
  }

  addKillBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.5;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
        color: Math.random() > 0.5 ? '#FF4655' : '#ff8a92',
        size: 3 + Math.random() * 3
      });
    }
  }

  addSparks(x, y, count) {
    for (let i = 0; i < (count || 4); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      this.sparks.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        size: 1.5 + Math.random() * 1.5
      });
    }
  }

  update(dt) {
    for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
      this.hitMarkers[i].time += dt;
      if (this.hitMarkers[i].time >= this.hitMarkers[i].duration) {
        this.hitMarkers.splice(i, 1);
      }
    }
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      this.damageNumbers[i].time += dt;
      if (this.damageNumbers[i].time >= this.damageNumbers[i].duration) {
        this.damageNumbers.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this.particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      if (s.life >= s.maxLife) { this.sparks.splice(i, 1); continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
  }

  render(ctx) {
    // Hit markers
    for (const hm of this.hitMarkers) {
      const progress = hm.time / hm.duration;
      const alpha = 1 - progress;
      const scale = 0.5 + progress * 0.5;
      ctx.save();
      ctx.translate(hm.x, hm.y);
      ctx.rotate(Math.PI / 4);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#FF4655';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      const len = 10;
      ctx.beginPath();
      ctx.moveTo(-len, -len);
      ctx.lineTo(len, len);
      ctx.moveTo(len, -len);
      ctx.lineTo(-len, len);
      ctx.stroke();
      ctx.restore();
    }

    // Damage numbers
    for (const dn of this.damageNumbers) {
      const progress = dn.time / dn.duration;
      const alpha = 1 - progress * progress;
      const y = dn.startY - progress * 50;
      const x = dn.x + dn.offsetX * progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = dn.isHeadshot ? 'bold 24px "JetBrains Mono", monospace' : 'bold 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (dn.isHeadshot) {
        ctx.shadowColor = '#FF4655';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#FF4655';
      } else {
        ctx.fillStyle = '#ece8e1';
      }
      ctx.fillText(dn.value, x, y);
      ctx.restore();
    }

    // Particles (kill burst)
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Sparks
    for (const s of this.sparks) {
      const alpha = 1 - s.life / s.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffcc66';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() {
    this.hitMarkers.length = 0;
    this.damageNumbers.length = 0;
    this.particles.length = 0;
    this.sparks.length = 0;
  }
}
