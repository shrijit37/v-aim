'use strict';
import { getWeapon } from './weapons.js';

export class Renderer {
  static clear(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  static drawBackground(ctx, w, h, theme) {
    const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.max(w,h)*0.7);
    if (theme === 'red-accent') {
      gradient.addColorStop(0, 'rgba(255,70,85,0.08)');
      gradient.addColorStop(0.5, 'rgba(255,70,85,0.03)');
    } else {
      gradient.addColorStop(0, 'rgba(255,70,85,0.04)');
      gradient.addColorStop(0.5, 'rgba(255,70,85,0.01)');
    }
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  static drawTarget(ctx, x, y, radius, showHeadshot = true) {
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 50, 50, 0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner ring
    const innerR = radius * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, innerR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 30, 30, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (showHeadshot) {
      // Center headshot zone
      const hsR = radius * 0.28;
      ctx.beginPath();
      ctx.arc(x, y, hsR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 220, 220, 0.5)';
      ctx.fill();
      // Center dot
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
    }
  }

  static drawCrosshair(ctx, x, y, cfg) {
    const { size, thickness, gap, color, dot, outline } = cfg;
    const armLen = size * thickness;
    const offset = gap + thickness;
    // Bloom circle shows current weapon inaccuracy
    if (cfg.bloom && cfg.bloom > 0) {
      const bloomRadius = cfg.bloom * 2;
      ctx.beginPath();
      ctx.arc(x, y, bloomRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 100, 100, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const drawArms = (clr, w) => {
      ctx.strokeStyle = clr;
      ctx.lineWidth = w || thickness;
      ctx.lineCap = 'square';

      ctx.beginPath();
      ctx.moveTo(x, y - offset);
      ctx.lineTo(x, y - offset - armLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y + offset);
      ctx.lineTo(x, y + offset + armLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x - offset, y);
      ctx.lineTo(x - offset - armLen, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset + armLen, y);
      ctx.stroke();
    };

    if (outline) {
      drawArms('rgba(0,0,0,0.5)', thickness + 2);
    }

    drawArms(color, thickness);

    if (dot) {
      ctx.fillStyle = color;
      ctx.fillRect(x - thickness/2, y - thickness/2, thickness, thickness);
    }

  }

  static drawRecoilIndicator(ctx, x, y, spread) {
    const halfSize = Math.max(2, spread * 10);
    ctx.beginPath();
    ctx.moveTo(x, y - halfSize);
    ctx.lineTo(x + halfSize, y);
    ctx.lineTo(x, y + halfSize);
    ctx.lineTo(x - halfSize, y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  static drawWeaponSilhouette(ctx, w, h, weaponId) {
    ctx.save();
    const wp = getWeapon(weaponId);
    const name = (wp ? wp.name : weaponId).toUpperCase();
    const type = wp ? wp.type.toUpperCase() : '';

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.font = '14px "Inter", system-ui, sans-serif';
    ctx.fillText(name, w - 24, h - 44);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.font = '11px "Inter", system-ui, sans-serif';
    ctx.fillText(type, w - 24, h - 28);

    ctx.restore();
  }

  static drawTrackingIndicator(ctx, x, y, onTarget) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = onTarget ? '#00FF00' : '#FF4655';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
