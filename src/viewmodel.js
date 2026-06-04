'use strict';

/**
 * ViewModel — renders the first-person weapon model on screen.
 * Handles positioning, fire/reload/equip animations, and ADS transition.
 * Each weapon type gets a distinct canvas-drawn silhouette inspired by Valorant.
 */

// Weapon view model config per type
const WEAPON_VIEW = {
  rifle: {
    posX: 0.72,  // fraction of screen width
    posY: 0.88,  // fraction of screen height
    adsPosX: 0.52,
    adsPosY: 0.78,
    fireKickX: 3,
    fireKickY: 8,
    fireReturn: 0.12,  // seconds to return
    adsFov: 0.75,      // fov multiplier when ADS
    draw: drawRifle,
  },
  smg: {
    posX: 0.70,
    posY: 0.86,
    adsPosX: 0.51,
    adsPosY: 0.76,
    fireKickX: 4,
    fireKickY: 6,
    fireReturn: 0.10,
    adsFov: 0.80,
    draw: drawSMG,
  },
  pistol: {
    posX: 0.66,
    posY: 0.82,
    adsPosX: 0.50,
    adsPosY: 0.74,
    fireKickX: 5,
    fireKickY: 10,
    fireReturn: 0.15,
    adsFov: 0.75,
    draw: drawPistol,
  },
  sniper: {
    posX: 0.76,
    posY: 0.90,
    adsPosX: 0.50,
    adsPosY: 0.70,
    fireKickX: 2,
    fireKickY: 14,
    fireReturn: 0.20,
    adsFov: 0.50,
    draw: drawSniper,
  },
  shotgun: {
    posX: 0.74,
    posY: 0.88,
    adsPosX: 0.52,
    adsPosY: 0.80,
    fireKickX: 4,
    fireKickY: 7,
    fireReturn: 0.12,
    adsFov: 0.78,
    draw: drawShotgun,
  },
};

export class ViewModel {
  constructor(game) {
    this.game = game;

    // Position (interpolated)
    this.x = 0;
    this.y = 0;
    this.rot = 0;       // gun tilt in radians
    this.scale = 1;
    this.adsProgress = 0; // 0=hip, 1=ADS

    // Animation state
    this._fireTime = 0;
    this._reloadTime = 0;
    this._reloadPhase = 0; // 0=down, 1=pause, 2=up
    this._equipTime = 0;
    this._lastWeaponId = null;
    this._breathPhase = 0;

    // Sway offset (idle breathing)
    this._swayX = 0;
    this._swayY = 0;

    // Muzzle position in screen coords (set during render for effects)
    this.muzzleX = 0;
    this.muzzleY = 0;
  }

  get cfg() {
    const w = this.game.weapon.weapon;
    return WEAPON_VIEW[w.type] || WEAPON_VIEW.rifle;
  }

  onFire() {
    this._fireTime = 0.08; // quick kick
  }

  onReload() {
    const wp = this.game.weapon.weapon;
    this._reloadTime = wp.reloadTime;
    this._reloadPhase = 0;
  }

  onEquip() {
    this._equipTime = 0.35;
  }

  setADS(progress) {
    this.adsProgress = Math.max(0, Math.min(1, progress));
  }

  update(dt) {
    const c = this.cfg;

    // --- Fire animation decay ---
    if (this._fireTime > 0) {
      this._fireTime -= dt;
      if (this._fireTime < 0) this._fireTime = 0;
    }

    // --- Reload animation ---
    if (this._reloadTime > 0) {
      this._reloadTime -= dt;
      const total = this.game.weapon.weapon.reloadTime;
      const elapsed = total - this._reloadTime;
      const phaseDuration = total / 3;
      if (elapsed < phaseDuration) {
        this._reloadPhase = elapsed / phaseDuration; // 0→1 dip
      } else if (elapsed < phaseDuration * 2) {
        this._reloadPhase = 1; // hold
      } else {
        this._reloadPhase = 2 - (elapsed - phaseDuration * 2) / phaseDuration; // 1→0 rise
      }
      if (this._reloadTime < 0) this._reloadTime = 0;
    }

    // --- Equip animation ---
    if (this._equipTime > 0) {
      this._equipTime -= dt;
      if (this._equipTime < 0) this._equipTime = 0;
    }

    // --- Idle sway ---
    this._breathPhase += dt * 1.2;
    this._swayX = Math.sin(this._breathPhase) * 0.8;
    this._swayY = Math.cos(this._breathPhase * 0.7) * 0.4;

    // --- Compute final position ---
    const baseX = c.posX;
    const baseY = c.posY;

    // ADS interpolation
    const ads = this.adsProgress;
    let tx = baseX + (c.adsPosX - baseX) * ads;
    let ty = baseY + (c.adsPosY - baseY) * ads;

    // Fire kick
    const fireKick = this._fireTime > 0 ? 1 - (1 - this._fireTime / 0.08) : 0;
    // Ease out quickly
    const kickFactor = fireKick * fireKick;
    tx += (c.fireKickX * kickFactor) / this.game.width;
    ty += (c.fireKickY * kickFactor) / this.game.height;

    // Reload dip
    if (this._reloadTime > 0) {
      ty += (this._reloadPhase * 0.08);
    }

    // Equip slide-in
    if (this._equipTime > 0) {
      const equipProgress = 1 - (this._equipTime / 0.35);
      const slide = 1 - equipProgress * equipProgress;
      ty += slide * 0.15;
    }

    // Add idle sway (reduced when ADS)
    const swayScale = 1 - ads * 0.7;
    tx += (this._swayX * 0.01) * swayScale;
    ty += (this._swayY * 0.01) * swayScale;

    // Smooth interpolation
    const lerp = Math.min(1, dt * 12);
    this.x += (tx - this.x) * lerp;
    this.y += (ty - this.y) * lerp;

    // Rotation: slight tilt from recoil
    const targetRot = -kickFactor * 0.02 + ads * (-0.01);
    this.rot += (targetRot - this.rot) * Math.min(1, dt * 10);

    // Scale slightly when ADS
    this.scale = 1 - ads * 0.12;
  }

  render(ctx, w, h) {
    const wm = this.game.weapon;
    if (!wm.currentId) return;

    const weaponData = wm.weapon;
    const c = WEAPON_VIEW[weaponData.type] || WEAPON_VIEW.rifle;

    const cx = this.x * w;
    const cy = this.y * h;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rot);
    ctx.scale(this.scale, this.scale);

    // Draw the weapon shape
    c.draw(ctx, w, h, weaponData, this.adsProgress);

    ctx.restore();

    // Store muzzle position for effects (tip of the barrel)
    this.muzzleX = cx + 60 * this.scale;
    this.muzzleY = cy - 20 * this.scale;
  }
}

/* =============================================
   WEAPON DRAWING FUNCTIONS
   Each draws a stylized canvas silhouette
   inspired by Valorant weapon view models.
   ============================================= */

function drawRifle(ctx, w, h, wp, ads) {
  const s = Math.min(w, h) / 800; // scale factor
  const alpha = 1 - ads * 0.15;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Color palette — dark metallic with red accent
  const bodyColor = '#2a2a2e';
  const accentColor = '#FF4655';
  const darkColor = '#1a1a1e';
  const barrelColor = '#222226';
  const lightColor = '#3a3a3e';

  // --- BARREL (extends forward/up) ---
  ctx.fillStyle = barrelColor;
  ctx.beginPath();
  ctx.moveTo(20 * s, -30 * s);
  ctx.lineTo(180 * s, -22 * s);
  ctx.lineTo(180 * s, -14 * s);
  ctx.lineTo(20 * s, -10 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#333336';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Barrel tip (muzzle brake)
  ctx.fillStyle = darkColor;
  ctx.fillRect(175 * s, -26 * s, 10 * s, 14 * s);

  // --- HANDGUARD ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, -12 * s);
  ctx.lineTo(20 * s, -30 * s);
  ctx.lineTo(20 * s, -4 * s);
  ctx.lineTo(5 * s, -4 * s);
  ctx.closePath();
  ctx.fill();

  // --- RECEIVER / BODY ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, -12 * s);
  ctx.lineTo(5 * s, -4 * s);
  ctx.lineTo(-15 * s, 14 * s);
  ctx.lineTo(-40 * s, 14 * s);
  ctx.lineTo(-40 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // --- MAGAZINE ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(-5 * s, 0);
  ctx.lineTo(8 * s, 0);
  ctx.lineTo(10 * s, 28 * s);
  ctx.lineTo(-8 * s, 28 * s);
  ctx.closePath();
  ctx.fill();

  // Magazine curve detail
  ctx.fillStyle = '#1e1e22';
  ctx.beginPath();
  ctx.moveTo(-3 * s, 4 * s);
  ctx.lineTo(6 * s, 4 * s);
  ctx.lineTo(7 * s, 22 * s);
  ctx.lineTo(-5 * s, 22 * s);
  ctx.closePath();
  ctx.fill();

  // --- STOCK ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(-40 * s, -2 * s);
  ctx.lineTo(-65 * s, -12 * s);
  ctx.lineTo(-68 * s, -8 * s);
  ctx.lineTo(-45 * s, 0);
  ctx.closePath();
  ctx.fill();

  // Stock butt
  ctx.fillStyle = '#151518';
  ctx.beginPath();
  ctx.moveTo(-65 * s, -12 * s);
  ctx.lineTo(-72 * s, -14 * s);
  ctx.lineTo(-75 * s, -8 * s);
  ctx.lineTo(-68 * s, -8 * s);
  ctx.closePath();
  ctx.fill();

  // --- RAIL / SIGHT ---
  ctx.fillStyle = accentColor;
  ctx.fillRect(10 * s, -28 * s, 4 * s, 4 * s);

  // --- ADS SCOPE overlay ---
  if (ads > 0.5) {
    ctx.fillStyle = `rgba(255, 70, 85, ${(ads - 0.5) * 0.15})`;
    ctx.fillRect(15 * s, -26 * s, 30 * s, 6 * s);
  }

  // --- HAND (simplified) ---
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.moveTo(-25 * s, 14 * s);
  ctx.lineTo(-15 * s, 36 * s);
  ctx.lineTo(-5 * s, 36 * s);
  ctx.lineTo(0, 14 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#6a5a4a';
  ctx.beginPath();
  ctx.moveTo(-20 * s, 14 * s);
  ctx.lineTo(-12 * s, 30 * s);
  ctx.lineTo(-5 * s, 30 * s);
  ctx.lineTo(-2 * s, 14 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSMG(ctx, w, h, wp, ads) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;

  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyColor = '#2a2a2e';
  const darkColor = '#1a1a1e';
  const barrelColor = '#222226';

  // --- BARREL (shorter than rifle) ---
  ctx.fillStyle = barrelColor;
  ctx.beginPath();
  ctx.moveTo(15 * s, -24 * s);
  ctx.lineTo(130 * s, -18 * s);
  ctx.lineTo(130 * s, -10 * s);
  ctx.lineTo(15 * s, -8 * s);
  ctx.closePath();
  ctx.fill();

  // --- RECEIVER (compact) ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, -10 * s);
  ctx.lineTo(15 * s, -24 * s);
  ctx.lineTo(15 * s, -4 * s);
  ctx.lineTo(-5 * s, 10 * s);
  ctx.lineTo(-30 * s, 10 * s);
  ctx.lineTo(-30 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // --- MAGAZINE (under receiver, SMG style) ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(12 * s, 0);
  ctx.lineTo(12 * s, 24 * s);
  ctx.lineTo(-2 * s, 24 * s);
  ctx.closePath();
  ctx.fill();

  // --- RETRACTABLE STOCK ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(-30 * s, -2 * s);
  ctx.lineTo(-50 * s, -8 * s);
  ctx.lineTo(-52 * s, -4 * s);
  ctx.lineTo(-32 * s, 2 * s);
  ctx.closePath();
  ctx.fill();

  // Wire stock detail
  ctx.strokeStyle = '#222226';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(-32 * s, -2 * s);
  ctx.lineTo(-48 * s, -10 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-30 * s, 4 * s);
  ctx.lineTo(-46 * s, 0);
  ctx.stroke();

  // --- HAND ---
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.moveTo(-20 * s, 10 * s);
  ctx.lineTo(-12 * s, 30 * s);
  ctx.lineTo(-2 * s, 30 * s);
  ctx.lineTo(0, 10 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPistol(ctx, w, h, wp, ads) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;

  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyColor = '#2a2a2e';
  const darkColor = '#1a1a1e';
  const barrelColor = '#222226';

  // --- SLIDE / BARREL ---
  ctx.fillStyle = barrelColor;
  ctx.beginPath();
  ctx.moveTo(10 * s, -14 * s);
  ctx.lineTo(120 * s, -10 * s);
  ctx.lineTo(120 * s, -4 * s);
  ctx.lineTo(10 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // Slide serrations
  ctx.fillStyle = '#2e2e32';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(90 * s + i * 4 * s, -12 * s, 2 * s, 8 * s);
  }

  // --- RECEIVER / FRAME ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, -6 * s);
  ctx.lineTo(10 * s, -14 * s);
  ctx.lineTo(10 * s, 0);
  ctx.lineTo(-5 * s, 8 * s);
  ctx.lineTo(-20 * s, 8 * s);
  ctx.lineTo(-20 * s, 0);
  ctx.closePath();
  ctx.fill();

  // --- TRIGGER GUARD ---
  ctx.fillStyle = 'transparent';
  ctx.strokeStyle = '#333336';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(0, 0, 6 * s, 0, Math.PI);
  ctx.stroke();

  // --- MAGAZINE WELL ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(-5 * s, 0);
  ctx.lineTo(8 * s, 0);
  ctx.lineTo(6 * s, 18 * s);
  ctx.lineTo(-3 * s, 18 * s);
  ctx.closePath();
  ctx.fill();

  // --- GRIP ---
  ctx.fillStyle = '#222226';
  ctx.beginPath();
  ctx.moveTo(-20 * s, 6 * s);
  ctx.lineTo(-5 * s, 6 * s);
  ctx.lineTo(-3 * s, 30 * s);
  ctx.lineTo(-18 * s, 30 * s);
  ctx.closePath();
  ctx.fill();

  // Grip texture lines
  ctx.strokeStyle = '#2a2a2e';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    const ly = 10 * s + i * 5 * s;
    ctx.beginPath();
    ctx.moveTo(-16 * s, ly);
    ctx.lineTo(-5 * s, ly);
    ctx.stroke();
  }

  // --- HAND ---
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.moveTo(-25 * s, 8 * s);
  ctx.lineTo(-20 * s, 34 * s);
  ctx.lineTo(-10 * s, 34 * s);
  ctx.lineTo(-8 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // Thumb
  ctx.fillStyle = '#6a5a4a';
  ctx.beginPath();
  ctx.moveTo(2 * s, -6 * s);
  ctx.lineTo(8 * s, -10 * s);
  ctx.lineTo(10 * s, -4 * s);
  ctx.lineTo(4 * s, 0);
  ctx.closePath();
  ctx.fill();

  // --- FRONT SIGHT ---
  ctx.fillStyle = '#FF4655';
  ctx.fillRect(115 * s, -13 * s, 3 * s, 8 * s);

  ctx.restore();
}

function drawSniper(ctx, w, h, wp, ads) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.2;

  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyColor = '#2a2a2e';
  const darkColor = '#1a1a1e';
  const scopeColor = '#18181c';

  // --- LONG BARREL ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(20 * s, -18 * s);
  ctx.lineTo(280 * s, -14 * s);
  ctx.lineTo(280 * s, -6 * s);
  ctx.lineTo(20 * s, -4 * s);
  ctx.closePath();
  ctx.fill();

  // Barrel shroud
  ctx.fillStyle = '#222226';
  ctx.beginPath();
  ctx.moveTo(15 * s, -20 * s);
  ctx.lineTo(40 * s, -22 * s);
  ctx.lineTo(40 * s, -2 * s);
  ctx.lineTo(15 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // --- SCOPE ---
  ctx.fillStyle = scopeColor;
  ctx.beginPath();
  ctx.moveTo(50 * s, -30 * s);
  ctx.lineTo(90 * s, -30 * s);
  ctx.lineTo(90 * s, -4 * s);
  ctx.lineTo(50 * s, -4 * s);
  ctx.closePath();
  ctx.fill();

  // Scope lenses
  ctx.fillStyle = '#101014';
  ctx.fillRect(55 * s, -26 * s, 30 * s, 18 * s);

  // Scope glass glint
  if (ads < 0.8) {
    ctx.fillStyle = `rgba(100, 180, 255, ${(1 - ads) * 0.1})`;
    ctx.fillRect(60 * s, -24 * s, 8 * s, 6 * s);
  }

  // --- RECEIVER ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, -10 * s);
  ctx.lineTo(20 * s, -22 * s);
  ctx.lineTo(20 * s, 0);
  ctx.lineTo(-5 * s, 8 * s);
  ctx.lineTo(-35 * s, 10 * s);
  ctx.lineTo(-35 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // Bolt handle
  ctx.fillStyle = '#3a3a3e';
  ctx.beginPath();
  ctx.moveTo(25 * s, 0);
  ctx.lineTo(35 * s, 16 * s);
  ctx.lineTo(38 * s, 16 * s);
  ctx.lineTo(30 * s, 0);
  ctx.closePath();
  ctx.fill();

  // --- BIPOD (partial) ---
  ctx.strokeStyle = '#222226';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(40 * s, 0);
  ctx.lineTo(45 * s, 20 * s);
  ctx.stroke();

  // --- MAGAZINE ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(-5 * s, 0);
  ctx.lineTo(8 * s, 0);
  ctx.lineTo(6 * s, 20 * s);
  ctx.lineTo(-3 * s, 20 * s);
  ctx.closePath();
  ctx.fill();

  // --- STOCK ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(-35 * s, -2 * s);
  ctx.lineTo(-55 * s, -10 * s);
  ctx.lineTo(-60 * s, -4 * s);
  ctx.lineTo(-38 * s, 4 * s);
  ctx.closePath();
  ctx.fill();

  // Check rest
  ctx.fillStyle = '#202024';
  ctx.beginPath();
  ctx.moveTo(-40 * s, -2 * s);
  ctx.lineTo(-50 * s, -8 * s);
  ctx.lineTo(-52 * s, -4 * s);
  ctx.lineTo(-42 * s, 2 * s);
  ctx.closePath();
  ctx.fill();

  // --- HAND ---
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.moveTo(-25 * s, 10 * s);
  ctx.lineTo(-15 * s, 34 * s);
  ctx.lineTo(-5 * s, 34 * s);
  ctx.lineTo(0, 10 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawShotgun(ctx, w, h, wp, ads) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;

  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyColor = '#2a2a2e';
  const darkColor = '#1a1a1e';
  const woodColor = '#3d2b1f';

  // --- WIDE BARREL ---
  ctx.fillStyle = darkColor;
  ctx.beginPath();
  ctx.moveTo(15 * s, -26 * s);
  ctx.lineTo(160 * s, -22 * s);
  ctx.lineTo(160 * s, 0);
  ctx.lineTo(15 * s, 4 * s);
  ctx.closePath();
  ctx.fill();

  // Ribbed barrel top
  ctx.fillStyle = '#222226';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(30 * s + i * 16 * s, -24 * s, 2 * s, 24 * s);
  }

  // --- FOREND (wood) ---
  ctx.fillStyle = woodColor;
  ctx.beginPath();
  ctx.moveTo(5 * s, 0);
  ctx.lineTo(15 * s, -26 * s);
  ctx.lineTo(15 * s, 6 * s);
  ctx.lineTo(5 * s, 6 * s);
  ctx.closePath();
  ctx.fill();

  // --- RECEIVER ---
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(0, -8 * s);
  ctx.lineTo(8 * s, -22 * s);
  ctx.lineTo(8 * s, 8 * s);
  ctx.lineTo(-5 * s, 18 * s);
  ctx.lineTo(-30 * s, 18 * s);
  ctx.lineTo(-30 * s, 0);
  ctx.closePath();
  ctx.fill();

  // --- TRIGGER GUARD ---
  ctx.strokeStyle = '#333336';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(-5 * s, 6 * s, 5 * s, 0, Math.PI);
  ctx.stroke();

  // --- PUMP ACTION handle ---
  ctx.fillStyle = woodColor;
  ctx.beginPath();
  ctx.moveTo(18 * s, 4 * s);
  ctx.lineTo(40 * s, 4 * s);
  ctx.lineTo(40 * s, 20 * s);
  ctx.lineTo(18 * s, 20 * s);
  ctx.closePath();
  ctx.fill();

  // --- MAGAZINE TUBE ---
  ctx.fillStyle = darkColor;
  ctx.fillRect(15 * s, -4 * s, 140 * s, 4 * s);

  // --- STOCK (wood) ---
  ctx.fillStyle = woodColor;
  ctx.beginPath();
  ctx.moveTo(-30 * s, 0);
  ctx.lineTo(-50 * s, -8 * s);
  ctx.lineTo(-56 * s, 10 * s);
  ctx.lineTo(-36 * s, 16 * s);
  ctx.closePath();
  ctx.fill();

  // Stock checkering
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 3; i++) {
    const lx = -40 * s - i * 5 * s;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx - 2 * s, 12 * s);
    ctx.stroke();
  }

  // --- HAND ---
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.moveTo(-20 * s, 18 * s);
  ctx.lineTo(-10 * s, 38 * s);
  ctx.lineTo(0, 38 * s);
  ctx.lineTo(2 * s, 18 * s);
  ctx.closePath();
  ctx.fill();

  // --- MUZZLE ---
  ctx.fillStyle = '#FF4655';
  ctx.fillRect(155 * s, -20 * s, 6 * s, 18 * s);

  ctx.restore();
}
