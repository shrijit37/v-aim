'use strict';

export class EffectManager {
  constructor() {
    this.hitMarkers = [];
    this.damageNumbers = [];
    this.particles = [];
    this.sparks = [];
    this.muzzleFlashes = [];
    this.bulletHoles = [];
    this.tracers = [];
  }

  addMuzzleFlash(x, y, weaponId) {
    let duration = 0.06;
    let size = 12;
    if (weaponId === 'operator') {
      duration = 0.12;
      size = 32;
    } else if (weaponId === 'sheriff') {
      size = 18;
    } else if (weaponId === 'phantom' || weaponId === 'ghost' || weaponId === 'spectre') {
      size = 5;
      duration = 0.04;
    } else if (weaponId === 'judge') {
      size = 24;
    }

    this.muzzleFlashes.push({
      x, y,
      weaponId,
      time: 0,
      duration,
      size
    });
  }

  addTracer(startX, startY, endX, endY, color, isShotgun = false) {
    this.tracers.push({
      startX, startY, endX, endY,
      color,
      time: 0,
      duration: isShotgun ? 0.08 : 0.12,
      isShotgun
    });
  }

  addBulletHole(x, y) {
    this.bulletHoles.push({
      x, y,
      time: 0,
      duration: 4.0 // lasts 4 seconds before completely fading
    });
    // Cap at 50 bullet holes for performance
    if (this.bulletHoles.length > 50) {
      this.bulletHoles.shift();
    }
  }

  addMuzzleSmoke(x, y) {
    for (let i = 0; i < 2; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4; // upward cone
      const speed = 12 + Math.random() * 20;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6, // constant drift velocity
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
        color: `rgba(220, 220, 225, ${0.12 + Math.random() * 0.12})`,
        size: 3 + Math.random() * 4,
        isSmoke: true
      });
    }
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
        color: '#ffcc66',
        size: 1.5 + Math.random() * 1.5
      });
    }
  }

  update(dt) {
    for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
      this.hitMarkers[i].time += dt;
      if (this.hitMarkers[i].time >= this.hitMarkers[i].duration) this.hitMarkers.splice(i, 1);
    }
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      this.damageNumbers[i].time += dt;
      if (this.damageNumbers[i].time >= this.damageNumbers[i].duration) this.damageNumbers.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.isSmoke) {
        p.size += dt * 7; // smoke expands as it rises
        p.vx *= 0.93;    // deceleration friction
        p.vy *= 0.93;
      } else {
        p.vy += 200 * dt; // gravity
      }
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life >= s.maxLife) this.sparks.splice(i, 1);
    }
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      this.muzzleFlashes[i].time += dt;
      if (this.muzzleFlashes[i].time >= this.muzzleFlashes[i].duration) this.muzzleFlashes.splice(i, 1);
    }
    for (let i = this.bulletHoles.length - 1; i >= 0; i--) {
      this.bulletHoles[i].time += dt;
      if (this.bulletHoles[i].time >= this.bulletHoles[i].duration) this.bulletHoles.splice(i, 1);
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].time += dt;
      if (this.tracers[i].time >= this.tracers[i].duration) this.tracers.splice(i, 1);
    }
  }

  render(ctx) {
    // 1. Bullet holes (rendered first, in the background)
    for (const bh of this.bulletHoles) {
      const progress = bh.time / bh.duration;
      const alpha = progress < 0.85 ? 0.75 : 0.75 * (1 - (progress - 0.85) / 0.15);
      ctx.save();
      ctx.globalAlpha = alpha;
      // Outer dust / burn mark
      ctx.fillStyle = 'rgba(25, 25, 28, 0.45)';
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      // Inner bullet hole core
      ctx.fillStyle = 'rgba(10, 10, 12, 0.85)';
      ctx.beginPath();
      ctx.arc(bh.x, bh.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Bullet tracers
    for (const t of this.tracers) {
      const progress = t.time / t.duration;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;
      
      const dx = t.endX - t.startX;
      const dy = t.endY - t.startY;
      
      // Calculate front and tail of bullet tracer segment
      const headX = t.startX + dx * Math.min(1, progress * 1.6);
      const headY = t.startY + dy * Math.min(1, progress * 1.6);
      
      const tailProgress = Math.max(0, progress * 1.6 - 0.4);
      const tailX = t.startX + dx * tailProgress;
      const tailY = t.startY + dy * tailProgress;

      ctx.strokeStyle = t.color;
      ctx.lineWidth = t.isShotgun ? 1.5 : t.color.includes('255, 200, 50') ? 4.5 : 3.0;
      ctx.lineCap = 'round';
      
      ctx.shadowColor = t.color;
      ctx.shadowBlur = t.isShotgun ? 2 : 6;
      
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Hit markers
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

    // 4. Damage numbers
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

    // 5. Particles (blood splatters / smoke wisps)
    for (const p of this.particles) {
      const alpha = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.isSmoke) {
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      } else {
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    // 6. Sparks
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

    // 7. Custom Muzzle Flashes
    for (const f of this.muzzleFlashes) {
      const progress = f.time / f.duration;
      const alpha = 1 - progress;
      ctx.save();
      ctx.globalAlpha = alpha;

      const size = f.size;
      const wId = f.weaponId;

      if (wId === 'phantom' || wId === 'ghost' || wId === 'spectre') {
        // Suppressed muzzle flash: soft purple-blue expanding puff
        const r = size * (1 + progress * 1.5);
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        grad.addColorStop(0, 'rgba(110, 90, 255, 0.7)');
        grad.addColorStop(0.5, 'rgba(80, 50, 200, 0.2)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (wId === 'operator') {
        // Operator: huge lateral brake exhausts + bright central star
        const r = size * (1 - progress * 0.3);
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        grad.addColorStop(0, 'rgba(255, 255, 210, 1)');
        grad.addColorStop(0.3, 'rgba(255, 170, 40, 0.6)');
        grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Sideways jets (Operator brake vents shoot sideways)
        ctx.fillStyle = 'rgba(255, 190, 40, 0.85)';
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x - r * 0.5, f.y - r * 1.8);
        ctx.lineTo(f.x + r * 0.5, f.y - r * 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(f.x, f.y);
        ctx.lineTo(f.x - r * 0.5, f.y + r * 1.8);
        ctx.lineTo(f.x + r * 0.5, f.y + r * 1.8);
        ctx.closePath();
        ctx.fill();

        // 8-point bright white core star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const angle = (i * Math.PI) / 8;
          const len = (i % 2 === 0) ? r * 1.2 : r * 0.25;
          const sx = f.x + Math.cos(angle) * len;
          const sy = f.y + Math.sin(angle) * len;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      } else if (wId === 'judge') {
        // Judge: wide multi-layered shotgun flame spray
        const r = size * (1 + progress * 0.5);
        for (let i = 0; i < 3; i++) {
          const ox = (Math.sin(i * 2) * size * 0.3) * progress;
          const oy = (Math.cos(i * 2) * size * 0.3) * progress;
          const rad = r * (0.5 + Math.random() * 0.5);
          const grad = ctx.createRadialGradient(f.x + ox, f.y + oy, 0, f.x + ox, f.y + oy, rad);
          grad.addColorStop(0, 'rgba(255, 235, 170, 0.95)');
          grad.addColorStop(0.4, 'rgba(255, 110, 30, 0.5)');
          grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(f.x + ox, f.y + oy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Vandal, Sheriff, Guardian, etc: bright orange 4-point star + radial glow
        const r = size * (1 - progress * 0.2);
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 1.8);
        grad.addColorStop(0, 'rgba(255, 225, 140, 0.85)');
        grad.addColorStop(0.4, 'rgba(255, 110, 30, 0.45)');
        grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r * 1.8, 0, Math.PI * 2);
        ctx.fill();

        // 4-point spike star
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const spikes = 4;
        for (let i = 0; i < spikes * 2; i++) {
          const angle = (i * Math.PI) / spikes;
          const len = (i % 2 === 0) ? r * 1.5 : r * 0.28;
          const sx = f.x + Math.cos(angle) * len;
          const sy = f.y + Math.sin(angle) * len;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }

  clear() {
    this.hitMarkers.length = 0;
    this.damageNumbers.length = 0;
    this.particles.length = 0;
    this.sparks.length = 0;
    this.muzzleFlashes.length = 0;
    this.bulletHoles.length = 0;
    this.tracers.length = 0;
  }
}
