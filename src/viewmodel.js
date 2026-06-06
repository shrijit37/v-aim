'use strict';

/**
 * ViewModel — renders the first-person weapon model on screen.
 * Handles positioning, fire/reload/equip animations, and ADS transition.
 * Features snappy spring-damper recoil simulation, slide blowback,
 * Sheriff cylinder rotation, Operator bolt cycle, and high-fidelity
 * vector silhouettes of all 8 Valorant weapons.
 */

const WEAPON_VIEW = {
  vandal: {
    posX: 0.72,
    posY: 0.88,
    adsPosX: 0.50,
    adsPosY: 0.78,
    fireKickX: 5,
    fireKickY: 15,
    fireReturn: 0.12,
    adsFov: 0.75,
    muzzleOffset: { x: 190, y: -26 },
    draw: drawVandal,
  },
  phantom: {
    posX: 0.71,
    posY: 0.87,
    adsPosX: 0.50,
    adsPosY: 0.78,
    fireKickX: 3.5,
    fireKickY: 10,
    fireReturn: 0.10,
    adsFov: 0.80,
    muzzleOffset: { x: 195, y: -22 },
    draw: drawPhantom,
  },
  sheriff: {
    posX: 0.68,
    posY: 0.84,
    adsPosX: 0.50,
    adsPosY: 0.76,
    fireKickX: 7,
    fireKickY: 28,
    fireReturn: 0.15,
    adsFov: 0.75,
    muzzleOffset: { x: 110, y: -21 },
    draw: drawSheriff,
  },
  ghost: {
    posX: 0.66,
    posY: 0.82,
    adsPosX: 0.50,
    adsPosY: 0.74,
    fireKickX: 4.5,
    fireKickY: 12,
    fireReturn: 0.14,
    adsFov: 0.75,
    muzzleOffset: { x: 145, y: -16 },
    draw: drawGhost,
  },
  spectre: {
    posX: 0.70,
    posY: 0.86,
    adsPosX: 0.50,
    adsPosY: 0.77,
    fireKickX: 4,
    fireKickY: 9,
    fireReturn: 0.10,
    adsFov: 0.80,
    muzzleOffset: { x: 155, y: -20 },
    draw: drawSpectre,
  },
  operator: {
    posX: 0.75,
    posY: 0.90,
    adsPosX: 0.50,
    adsPosY: 0.70,
    fireKickX: 10,
    fireKickY: 38,
    fireReturn: 0.22,
    adsFov: 0.50,
    muzzleOffset: { x: 260, y: -22 },
    draw: drawOperator,
  },
  judge: {
    posX: 0.73,
    posY: 0.88,
    adsPosX: 0.50,
    adsPosY: 0.80,
    fireKickX: 6,
    fireKickY: 20,
    fireReturn: 0.12,
    adsFov: 0.78,
    muzzleOffset: { x: 150, y: -25 },
    draw: drawJudge,
  },
  guardian: {
    posX: 0.72,
    posY: 0.88,
    adsPosX: 0.50,
    adsPosY: 0.78,
    fireKickX: 6,
    fireKickY: 22,
    fireReturn: 0.14,
    adsFov: 0.75,
    muzzleOffset: { x: 200, y: -28 },
    draw: drawGuardian,
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

    // Snappy spring-based recoil offsets (relative to baseline)
    this.recoilX = 0;   // horizontal kick
    this.recoilY = 0;   // vertical kick
    this.recoilZ = 0;   // back kick (scales weapon down/back)
    this.recoilRot = 0; // rotational kick

    // Recoil spring velocities
    this.recoilVelX = 0;
    this.recoilVelY = 0;
    this.recoilVelZ = 0;
    this.recoilVelRot = 0;

    // Weapon mechanical animations
    this.slideOffset = 0;      // for slide blowback on pistols/SMGs/rifles
    this.cylinderRot = 0;      // for Sheriff cylinder rotation
    this.targetCylinderRot = 0; // target cylinder rotation (multiples of 60 deg)
    this.boltProgress = 0;     // for Operator bolt pull progress (0 to 1)
    this.boltCycleTimer = 0;   // Operator bolt cycle timer
    this.pumpOffset = 0;       // for Judge pump slide offset
    this.pumpTimer = 0;        // Judge pump cycle timer

    // Animation state
    this._reloadTime = 0;
    this._reloadPhase = 0; // 0=down, 1=pause, 2=up
    this._equipTime = 0;
    this._breathPhase = 0;

    // Sway offset (idle breathing)
    this._swayX = 0;
    this._swayY = 0;

    // Muzzle position in screen coords
    this.muzzleX = 0;
    this.muzzleY = 0;
  }

  get cfg() {
    return WEAPON_VIEW[this.game.weapon.currentId] || WEAPON_VIEW.vandal;
  }

  onFire() {
    const id = this.game.weapon.currentId;
    const c = this.cfg;

    // Snappy recoil impulse depending on weapon
    if (id === 'vandal') {
      this.recoilVelY += 14;
      this.recoilVelZ += 20;
      this.recoilVelRot -= 0.09;
      this.recoilVelX += (Math.random() - 0.5) * 6;
      this.slideOffset = 1.0;
    } else if (id === 'phantom') {
      this.recoilVelY += 10;
      this.recoilVelZ += 15;
      this.recoilVelRot -= 0.07;
      this.recoilVelX += (Math.random() - 0.5) * 4;
      this.slideOffset = 1.0;
    } else if (id === 'sheriff') {
      this.recoilVelY += 28;
      this.recoilVelZ += 24;
      this.recoilVelRot -= 0.16;
      this.recoilVelX += (Math.random() - 0.5) * 8;
      this.targetCylinderRot += Math.PI / 3; // rotate cylinder 60 deg
    } else if (id === 'ghost') {
      this.recoilVelY += 9;
      this.recoilVelZ += 12;
      this.recoilVelRot -= 0.06;
      this.recoilVelX += (Math.random() - 0.5) * 3;
      this.slideOffset = 1.0;
    } else if (id === 'spectre') {
      this.recoilVelY += 8;
      this.recoilVelZ += 13;
      this.recoilVelRot -= 0.05;
      this.recoilVelX += (Math.random() - 0.5) * 4;
      this.slideOffset = 1.0;
    } else if (id === 'operator') {
      this.recoilVelY += 36;
      this.recoilVelZ += 48;
      this.recoilVelRot -= 0.28;
      this.recoilVelX += (Math.random() - 0.5) * 12;
      this.boltCycleTimer = 1.0; // starts a 1-second bolt animation cycle
    } else if (id === 'judge') {
      this.recoilVelY += 18;
      this.recoilVelZ += 26;
      this.recoilVelRot -= 0.14;
      this.recoilVelX += (Math.random() - 0.5) * 9;
      this.pumpTimer = 0.5; // starts a 0.5-second pump animation cycle
    } else if (id === 'guardian') {
      this.recoilVelY += 17;
      this.recoilVelZ += 22;
      this.recoilVelRot -= 0.11;
      this.recoilVelX += (Math.random() - 0.5) * 7;
      this.slideOffset = 1.0;
    }
  }

  onReload() {
    const wp = this.game.weapon.weapon;
    this._reloadTime = wp.reloadTime;
    this._reloadPhase = 0;
  }

  onEquip() {
    this._equipTime = 0.35;
    this.slideOffset = 0;
    this.boltProgress = 0;
    this.boltCycleTimer = 0;
    this.pumpOffset = 0;
    this.pumpTimer = 0;
  }

  setADS(progress) {
    this.adsProgress = Math.max(0, Math.min(1, progress));
  }

  update(dt) {
    const c = this.cfg;

    // --- Recoil Spring-Damper Physics ---
    const k = 175; // stiffness
    const d = 19;  // damping
    
    // Spring forces pull displacements back to zero
    const fx = -k * this.recoilX - d * this.recoilVelX;
    const fy = -k * this.recoilY - d * this.recoilVelY;
    const fz = -k * this.recoilZ - d * this.recoilVelZ;
    const frot = -140 * this.recoilRot - 16 * this.recoilVelRot;

    this.recoilVelX += fx * dt;
    this.recoilVelY += fy * dt;
    this.recoilVelZ += fz * dt;
    this.recoilVelRot += frot * dt;

    this.recoilX += this.recoilVelX * dt;
    this.recoilY += this.recoilVelY * dt;
    this.recoilZ += this.recoilVelZ * dt;
    this.recoilRot += this.recoilVelRot * dt;

    // --- Mechanical Animations Decay ---
    // Slide blowback decay (quick return)
    this.slideOffset = Math.max(0, this.slideOffset - dt * 14);

    // Sheriff cylinder rotation interpolation
    this.cylinderRot += (this.targetCylinderRot - this.cylinderRot) * Math.min(1, dt * 15);

    // Operator bolt cycle animation
    if (this.boltCycleTimer > 0) {
      this.boltCycleTimer -= dt;
      const elapsed = 1.0 - this.boltCycleTimer; // 1-second duration
      this.boltProgress = Math.max(0, Math.min(1, elapsed));
    } else {
      this.boltProgress = 0;
      this.boltCycleTimer = 0;
    }

    // Judge pump action slide animation
    if (this.pumpTimer > 0) {
      this.pumpTimer -= dt;
      const elapsed = 0.5 - this.pumpTimer; // 0.5-second duration
      if (elapsed < 0.25) {
        this.pumpOffset = elapsed / 0.25; // slide back
      } else {
        this.pumpOffset = 1.0 - (elapsed - 0.25) / 0.25; // slide forward
      }
    } else {
      this.pumpOffset = 0;
      this.pumpTimer = 0;
    }

    // --- Reload Animation ---
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

    // --- Equip Animation ---
    if (this._equipTime > 0) {
      this._equipTime -= dt;
      if (this._equipTime < 0) this._equipTime = 0;
    }

    // --- Idle Sway ---
    this._breathPhase += dt * 1.2;
    this._swayX = Math.sin(this._breathPhase) * 0.8;
    this._swayY = Math.cos(this._breathPhase * 0.7) * 0.4;

    // --- Final Position Calculation ---
    const baseX = c.posX;
    const baseY = c.posY;
    const ads = this.adsProgress;
    
    // ADS position interpolation
    let tx = baseX + (c.adsPosX - baseX) * ads;
    let ty = baseY + (c.adsPosY - baseY) * ads;

    // Apply recoil springs (convert pixels to fraction of height/width)
    tx += this.recoilX / this.game.width;
    ty -= this.recoilY / this.game.height;

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

    // Smooth position interpolation
    const lerp = Math.min(1, dt * 12);
    this.x += (tx - this.x) * lerp;
    this.y += (ty - this.y) * lerp;

    // Rotation: tilt from recoil springs + ADS skew
    const targetRot = this.recoilRot + ads * (-0.01);
    this.rot += (targetRot - this.rot) * Math.min(1, dt * 10);

    // Scale down slightly when recoil pushes weapon back
    this.scale = (1 - ads * 0.12) * (1 - this.recoilZ * 0.0035);
  }

  render(ctx, w, h) {
    const wm = this.game.weapon;
    if (!wm.currentId) return;

    const weaponData = wm.weapon;
    const c = WEAPON_VIEW[weaponData.id] || WEAPON_VIEW.vandal;

    const cx = this.x * w;
    const cy = this.y * h;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rot);
    ctx.scale(this.scale, this.scale);

    // Draw the specific weapon silhouette
    c.draw(ctx, w, h, weaponData, this.adsProgress, this);

    ctx.restore();

    // Store muzzle position for effects (tip of the barrel)
    const muzzleCfg = c.muzzleOffset || { x: 60, y: -20 };
    const s = Math.min(w, h) / 800;
    const localX = muzzleCfg.x * s * this.scale;
    const localY = muzzleCfg.y * s * this.scale;
    const cos = Math.cos(this.rot);
    const sin = Math.sin(this.rot);
    this.muzzleX = cx + (localX * cos - localY * sin);
    this.muzzleY = cy + (localX * sin + localY * cos);
  }
}

/* =========================================================================
   WEAPON VECTOR DRAWING FUNCTIONS (Valorant Silhouettes & Accents)
   ========================================================================= */

function drawVandal(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;

  const darkMetal = '#232427';
  const midMetal = '#2d2f34';
  const lightMetal = '#43464d';
  const copperWood = '#834c2a'; // copper bronze wood detail
  const glowColor = '#FF4655';  // glowing red lines

  const slideX = -vm.slideOffset * 6 * s;

  // --- 1. STOCK ---
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.moveTo(-40 * s, -5 * s);
  ctx.lineTo(-90 * s, -15 * s);
  ctx.lineTo(-92 * s, 10 * s);
  ctx.lineTo(-45 * s, 10 * s);
  ctx.closePath();
  ctx.fill();

  // Stock buttpad
  ctx.fillStyle = '#141416';
  ctx.fillRect(-95 * s, -15 * s, 5 * s, 25 * s);

  // Stock Accent panel (Bronze/Wood)
  ctx.fillStyle = copperWood;
  ctx.beginPath();
  ctx.moveTo(-50 * s, -7 * s);
  ctx.lineTo(-80 * s, -13 * s);
  ctx.lineTo(-80 * s, 2 * s);
  ctx.lineTo(-50 * s, 5 * s);
  ctx.closePath();
  ctx.fill();

  // --- 2. RECEIVER & BODY ---
  ctx.fillStyle = midMetal;
  ctx.beginPath();
  ctx.moveTo(-40 * s, -10 * s);
  ctx.lineTo(25 * s, -28 * s);
  ctx.lineTo(30 * s, -10 * s);
  ctx.lineTo(25 * s, 12 * s);
  ctx.lineTo(-40 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  // Receiver design panel line
  ctx.strokeStyle = lightMetal;
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(-30 * s, -5 * s, 40 * s, 12 * s);

  // Sliding Bolt / Charging Handle (moves with slideX)
  ctx.fillStyle = lightMetal;
  ctx.fillRect(-10 * s + slideX, -20 * s, 12 * s, 4 * s);
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(-2 * s + slideX, -24 * s, 4 * s, 5 * s);

  // Glowing red stripes/accents (Valorant Red Vandal aesthetic)
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 6 * s;
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.moveTo(-20 * s, -8 * s);
  ctx.lineTo(-5 * s, -8 * s);
  ctx.lineTo(-10 * s, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(5 * s, -14 * s, 15 * s, 2 * s);
  ctx.shadowBlur = 0; // reset shadow

  // --- 3. BANANA MAGAZINE ---
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.moveTo(-5 * s, 8 * s);
  ctx.lineTo(12 * s, 8 * s);
  // Curve down and back
  ctx.quadraticCurveTo(22 * s, 32 * s, 10 * s, 45 * s);
  ctx.lineTo(-5 * s, 40 * s);
  ctx.quadraticCurveTo(8 * s, 28 * s, -5 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // Magazine ribs
  ctx.strokeStyle = '#151517';
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 4; i++) {
    const rY = 16 * s + i * 7 * s;
    ctx.beginPath();
    ctx.moveTo(8 * s, rY);
    ctx.lineTo(16 * s, rY + 2 * s);
    ctx.stroke();
  }

  // --- 4. BRONZE FOREGRIP / HANDGUARD ---
  ctx.fillStyle = copperWood;
  ctx.beginPath();
  ctx.moveTo(30 * s, -24 * s);
  ctx.lineTo(105 * s, -22 * s);
  ctx.lineTo(95 * s, -2 * s);
  ctx.lineTo(25 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // Lower handguard (black composite)
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.moveTo(25 * s, -2 * s);
  ctx.lineTo(95 * s, -2 * s);
  ctx.lineTo(85 * s, 8 * s);
  ctx.lineTo(25 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // --- 5. BARREL & MUZZLE BRAKE ---
  ctx.fillStyle = '#1c1d1f';
  ctx.fillRect(105 * s, -18 * s, 70 * s, 6 * s);

  // Gas tube underneath
  ctx.fillStyle = '#141416';
  ctx.fillRect(105 * s, -11 * s, 55 * s, 3 * s);

  // Muzzle brake (triple chamber style)
  ctx.fillStyle = '#0f1011';
  ctx.fillRect(175 * s, -22 * s, 15 * s, 12 * s);
  ctx.fillStyle = lightMetal;
  ctx.fillRect(177 * s, -20 * s, 2 * s, 8 * s);
  ctx.fillRect(183 * s, -20 * s, 2 * s, 8 * s);

  // --- 6. IRON SIGHTS ---
  ctx.fillStyle = darkMetal;
  ctx.fillRect(10 * s, -33 * s, 6 * s, 6 * s);
  ctx.beginPath();
  ctx.moveTo(150 * s, -18 * s);
  ctx.lineTo(155 * s, -30 * s);
  ctx.lineTo(160 * s, -18 * s);
  ctx.closePath();
  ctx.fill();

  // --- 7. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-30 * s, 12 * s);
  ctx.lineTo(-20 * s, 38 * s);
  ctx.lineTo(-5 * s, 38 * s);
  ctx.lineTo(0 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPhantom(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;

  const matteBlack = '#1c1d1f';
  const midGrey = '#27282c';
  const cyanGlow = '#00F0FF';
  const slideX = -vm.slideOffset * 5 * s;

  // --- 1. STOCK ---
  ctx.fillStyle = matteBlack;
  ctx.beginPath();
  ctx.moveTo(-45 * s, -2 * s);
  ctx.lineTo(-85 * s, -10 * s);
  ctx.lineTo(-85 * s, 15 * s);
  ctx.lineTo(-45 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // Stock hollow core detail
  ctx.fillStyle = '#101012';
  ctx.beginPath();
  ctx.moveTo(-55 * s, 1 * s);
  ctx.lineTo(-75 * s, -5 * s);
  ctx.lineTo(-75 * s, 8 * s);
  ctx.lineTo(-55 * s, 4 * s);
  ctx.closePath();
  ctx.fill();

  // --- 2. RECEIVER & BODY ---
  ctx.fillStyle = midGrey;
  ctx.beginPath();
  ctx.moveTo(-45 * s, -12 * s);
  ctx.lineTo(35 * s, -24 * s);
  ctx.lineTo(35 * s, 10 * s);
  ctx.lineTo(-45 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // Firing bolt cover
  ctx.fillStyle = '#121214';
  ctx.fillRect(-12 * s + slideX, -18 * s, 16 * s, 6 * s);

  // Cyan glowing line (Phantom signature glow)
  ctx.shadowColor = cyanGlow;
  ctx.shadowBlur = 6 * s;
  ctx.strokeStyle = cyanGlow;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(-25 * s, -4 * s);
  ctx.lineTo(15 * s, -4 * s);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // --- 3. STRAIGHT MAGAZINE ---
  ctx.fillStyle = matteBlack;
  ctx.fillRect(2 * s, 8 * s, 13 * s, 26 * s);
  ctx.strokeStyle = '#333';
  ctx.strokeRect(4 * s, 10 * s, 9 * s, 22 * s);

  // --- 4. INTEGRATED HANDGUARD ---
  ctx.fillStyle = midGrey;
  ctx.beginPath();
  ctx.moveTo(35 * s, -24 * s);
  ctx.lineTo(105 * s, -20 * s);
  ctx.lineTo(100 * s, 6 * s);
  ctx.lineTo(35 * s, 6 * s);
  ctx.closePath();
  ctx.fill();

  // Venting slots on handguard
  ctx.fillStyle = '#151517';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(45 * s + i * 12 * s, -12 * s, 6 * s, 4 * s);
    ctx.fillRect(45 * s + i * 12 * s, -4 * s, 6 * s, 4 * s);
  }

  // --- 5. RECTANGULAR SILENCER (Phantom suppressor) ---
  ctx.fillStyle = matteBlack;
  ctx.beginPath();
  ctx.moveTo(105 * s, -22 * s);
  ctx.lineTo(195 * s, -18 * s);
  ctx.lineTo(195 * s, -6 * s);
  ctx.lineTo(105 * s, -4 * s);
  ctx.closePath();
  ctx.fill();

  // Suppressor grooves
  ctx.strokeStyle = '#27282c';
  ctx.lineWidth = 1 * s;
  for (let i = 0; i < 3; i++) {
    const gX = 125 * s + i * 22 * s;
    ctx.beginPath();
    ctx.moveTo(gX, -20 * s);
    ctx.lineTo(gX, -6 * s);
    ctx.stroke();
  }

  // --- 6. IRON SIGHTS ---
  ctx.fillStyle = matteBlack;
  ctx.fillRect(15 * s, -28 * s, 25 * s, 4 * s);
  ctx.fillRect(90 * s, -23 * s, 8 * s, 4 * s);

  // --- 7. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-32 * s, 8 * s);
  ctx.lineTo(-22 * s, 34 * s);
  ctx.lineTo(-7 * s, 34 * s);
  ctx.lineTo(-2 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSheriff(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;

  const darkChrome = '#1e1f22';
  const lightChrome = '#383a40';
  const goldAccent = '#d4af37';

  // --- 1. GRIP ---
  ctx.fillStyle = '#141416';
  ctx.beginPath();
  ctx.moveTo(-20 * s, 10 * s);
  ctx.lineTo(-5 * s, 10 * s);
  ctx.lineTo(2 * s, 38 * s);
  ctx.lineTo(-15 * s, 38 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = goldAccent;
  ctx.fillRect(-12 * s, 16 * s, 8 * s, 16 * s);
  ctx.fillStyle = '#222';
  ctx.fillRect(-10 * s, 18 * s, 4 * s, 12 * s);

  // --- 2. RECEIVER FRAME & HAMMER ---
  ctx.fillStyle = darkChrome;
  ctx.beginPath();
  ctx.moveTo(-25 * s, -12 * s);
  ctx.lineTo(-12 * s, -22 * s);
  ctx.lineTo(10 * s, -22 * s);
  ctx.lineTo(10 * s, 10 * s);
  ctx.lineTo(-20 * s, 10 * s);
  ctx.closePath();
  ctx.fill();

  // Hammer detail
  ctx.fillStyle = lightChrome;
  ctx.beginPath();
  ctx.moveTo(-18 * s, -22 * s);
  ctx.lineTo(-24 * s, -28 * s);
  ctx.lineTo(-26 * s, -22 * s);
  ctx.lineTo(-20 * s, -18 * s);
  ctx.closePath();
  ctx.fill();

  // --- 3. REVOLVER CYLINDER ---
  const cylX = -2 * s;
  const cylY = -8 * s;
  const cylW = 24 * s;
  const cylH = 22 * s;

  ctx.fillStyle = '#101113';
  ctx.fillRect(cylX - cylW/2, cylY - cylH/2, cylW, cylH);

  // Shaded grooves
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(cylX - cylW/2, cylY - 9 * s, cylW, 3 * s);
  ctx.fillRect(cylX - cylW/2, cylY + 6 * s, cylW, 3 * s);

  // Rotated chamber dots
  ctx.save();
  ctx.translate(cylX, cylY);
  ctx.rotate(vm.cylinderRot);
  ctx.fillStyle = lightChrome;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 7 * s, Math.sin(angle) * 7 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    // brass primer
    ctx.fillStyle = '#8b7a3a';
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 7 * s, Math.sin(angle) * 7 * s, 1.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lightChrome;
  }
  ctx.restore();

  // --- 4. BARREL SHROUD ---
  ctx.fillStyle = darkChrome;
  ctx.beginPath();
  ctx.moveTo(10 * s, -22 * s);
  ctx.lineTo(110 * s, -17 * s);
  ctx.lineTo(110 * s, -6 * s);
  ctx.lineTo(10 * s, -1 * s);
  ctx.closePath();
  ctx.fill();

  // Underlug weight
  ctx.fillStyle = '#141416';
  ctx.beginPath();
  ctx.moveTo(10 * s, -1 * s);
  ctx.lineTo(100 * s, -5 * s);
  ctx.lineTo(100 * s, 0 * s);
  ctx.lineTo(10 * s, 4 * s);
  ctx.closePath();
  ctx.fill();

  // Shroud vent slot
  ctx.fillStyle = '#0d0e0f';
  ctx.fillRect(40 * s, -17 * s, 30 * s, 4 * s);

  // --- 5. TRIGGER GUARD ---
  ctx.strokeStyle = lightChrome;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(-5 * s, 8 * s, 7 * s, 0, Math.PI * 1.5);
  ctx.stroke();

  // Gold line trim on the bottom frame
  ctx.fillStyle = goldAccent;
  ctx.fillRect(15 * s, -2 * s, 30 * s, 1.5 * s);

  // --- 6. FRONT SIGHT ---
  ctx.fillStyle = goldAccent;
  ctx.fillRect(102 * s, -20 * s, 6 * s, 3 * s);

  // --- 7. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-25 * s, 12 * s);
  ctx.lineTo(-20 * s, 34 * s);
  ctx.lineTo(-8 * s, 34 * s);
  ctx.lineTo(-3 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawGhost(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyGrey = '#27292d';
  const slideGrey = '#34373d';
  const darkGrey = '#161719';
  const goldAccent = '#d4af37';

  const slideX = -vm.slideOffset * 10 * s;

  // --- 1. GRIP & FRAME (Stationary) ---
  ctx.fillStyle = darkGrey;
  ctx.beginPath();
  ctx.moveTo(-20 * s, 6 * s);
  ctx.lineTo(-5 * s, 6 * s);
  ctx.lineTo(-1 * s, 34 * s);
  ctx.lineTo(-15 * s, 34 * s);
  ctx.closePath();
  ctx.fill();

  // Grip panels
  ctx.fillStyle = '#222';
  ctx.fillRect(-12 * s, 12 * s, 8 * s, 16 * s);

  // Frame receiver
  ctx.fillStyle = bodyGrey;
  ctx.beginPath();
  ctx.moveTo(-22 * s, -2 * s);
  ctx.lineTo(20 * s, -6 * s);
  ctx.lineTo(20 * s, 6 * s);
  ctx.lineTo(-22 * s, 6 * s);
  ctx.closePath();
  ctx.fill();

  // Trigger guard
  ctx.strokeStyle = slideGrey;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(-2 * s, 6 * s, 6 * s, 0, Math.PI * 1.5);
  ctx.stroke();

  // --- 2. MOVING SLIDE ---
  ctx.save();
  ctx.translate(slideX, 0);

  ctx.fillStyle = slideGrey;
  ctx.beginPath();
  ctx.moveTo(-22 * s, -14 * s);
  ctx.lineTo(55 * s, -12 * s);
  ctx.lineTo(55 * s, -2 * s);
  ctx.lineTo(-22 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // Slide serrations
  ctx.fillStyle = '#222';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-16 * s + i * 4 * s, -11 * s, 1.5 * s, 6 * s);
  }

  // Front Sight
  ctx.fillStyle = goldAccent;
  ctx.fillRect(50 * s, -15 * s, 4 * s, 3 * s);

  ctx.restore();

  // --- 3. SUPPRESSOR ---
  ctx.fillStyle = darkGrey;
  ctx.beginPath();
  ctx.moveTo(55 * s, -12 * s);
  ctx.lineTo(145 * s, -10 * s);
  ctx.lineTo(145 * s, -2 * s);
  ctx.lineTo(55 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // Gold rings
  ctx.fillStyle = goldAccent;
  ctx.fillRect(65 * s, -11.8 * s, 4 * s, 9.6 * s);
  ctx.fillRect(132 * s, -10.3 * s, 3 * s, 8.2 * s);

  // --- 4. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-25 * s, 8 * s);
  ctx.lineTo(-20 * s, 34 * s);
  ctx.lineTo(-8 * s, 34 * s);
  ctx.lineTo(-3 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawSpectre(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;

  const bodyGrey = '#222326';
  const midGrey = '#2d2e33';
  const darkMetal = '#141416';
  const redGlow = '#FF4655';

  const slideX = -vm.slideOffset * 5 * s;

  // --- 1. RETRACTABLE STOCK (Wire outline) ---
  ctx.strokeStyle = darkMetal;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(-35 * s, 0 * s);
  ctx.lineTo(-65 * s, -8 * s);
  ctx.lineTo(-67 * s, 12 * s);
  ctx.lineTo(-35 * s, 6 * s);
  ctx.stroke();

  // --- 2. RECEIVER ---
  ctx.fillStyle = midGrey;
  ctx.beginPath();
  ctx.moveTo(-35 * s, -12 * s);
  ctx.lineTo(35 * s, -22 * s);
  ctx.lineTo(35 * s, 8 * s);
  ctx.lineTo(-35 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // Charging handle slot & bolt (animates!)
  ctx.fillStyle = darkMetal;
  ctx.fillRect(-15 * s, -15 * s, 25 * s, 3 * s);
  ctx.fillStyle = '#555';
  ctx.fillRect(-10 * s + slideX, -18 * s, 4 * s, 4 * s);

  // Red glow triangle accent
  ctx.fillStyle = redGlow;
  ctx.beginPath();
  ctx.moveTo(-25 * s, -4 * s);
  ctx.lineTo(-18 * s, -4 * s);
  ctx.lineTo(-21.5 * s, 0 * s);
  ctx.closePath();
  ctx.fill();

  // --- 3. CURVED SMG MAGAZINE ---
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.moveTo(5 * s, 8 * s);
  ctx.lineTo(18 * s, 8 * s);
  ctx.quadraticCurveTo(24 * s, 26 * s, 20 * s, 36 * s);
  ctx.lineTo(8 * s, 34 * s);
  ctx.quadraticCurveTo(12 * s, 24 * s, 5 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // --- 4. COMPACT VENTED HANDGUARD ---
  ctx.fillStyle = bodyGrey;
  ctx.beginPath();
  ctx.moveTo(35 * s, -22 * s);
  ctx.lineTo(95 * s, -18 * s);
  ctx.lineTo(85 * s, 6 * s);
  ctx.lineTo(35 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  // Vents
  ctx.fillStyle = '#0f0f11';
  ctx.fillRect(48 * s, -12 * s, 6 * s, 4 * s);
  ctx.fillRect(65 * s, -11 * s, 6 * s, 4 * s);

  // --- 5. SILENCER ---
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.moveTo(95 * s, -19 * s);
  ctx.lineTo(155 * s, -17 * s);
  ctx.lineTo(155 * s, -7 * s);
  ctx.lineTo(88 * s, -5 * s);
  ctx.closePath();
  ctx.fill();

  // --- 6. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-25 * s, 8 * s);
  ctx.lineTo(-18 * s, 34 * s);
  ctx.lineTo(-5 * s, 34 * s);
  ctx.lineTo(0 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawOperator(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.2; // hide viewmodel mostly when fully ADS scoped
  ctx.save();
  ctx.globalAlpha = alpha;

  const darkGraphite = '#161719';
  const midGrey = '#222327';
  const scopeColor = '#0f1012';
  const redDecal = '#FF4655';

  // --- 1. HEAVY STOCK ---
  ctx.fillStyle = darkGraphite;
  ctx.beginPath();
  ctx.moveTo(-45 * s, 0);
  ctx.lineTo(-100 * s, -12 * s);
  ctx.lineTo(-102 * s, 22 * s);
  ctx.lineTo(-50 * s, 16 * s);
  ctx.closePath();
  ctx.fill();

  // Cheek rest
  ctx.fillStyle = '#2f3136';
  ctx.fillRect(-85 * s, -9 * s, 30 * s, 5 * s);

  // Buttpad
  ctx.fillStyle = '#0a0a0b';
  ctx.fillRect(-106 * s, -12 * s, 6 * s, 34 * s);

  // --- 2. RECEIVER & ACTION ---
  ctx.fillStyle = midGrey;
  ctx.beginPath();
  ctx.moveTo(-45 * s, -15 * s);
  ctx.lineTo(45 * s, -25 * s);
  ctx.lineTo(45 * s, 12 * s);
  ctx.lineTo(-45 * s, 16 * s);
  ctx.closePath();
  ctx.fill();

  // Bolt Cycle Animation
  let boltRot = 0;
  let boltSlide = 0;
  if (vm.boltProgress > 0) {
    const p = vm.boltProgress;
    if (p < 0.25) {
      const f = p / 0.25;
      boltRot = (-Math.PI / 3) * f;
    } else if (p < 0.5) {
      const f = (p - 0.25) / 0.25;
      boltRot = -Math.PI / 3;
      boltSlide = f * 15 * s;
    } else if (p < 0.75) {
      const f = (p - 0.5) / 0.25;
      boltRot = -Math.PI / 3;
      boltSlide = (1 - f) * 15 * s;
    } else {
      const f = (p - 0.75) / 0.25;
      boltRot = (-Math.PI / 3) * (1 - f);
    }
  }

  // Bolt track slot
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(-10 * s, -16 * s, 25 * s, 4 * s);

  // Sliding bolt stem
  ctx.fillStyle = '#a0a5ad';
  ctx.fillRect(-10 * s + boltSlide, -15 * s, 15 * s, 2 * s);

  // Bolt handle
  ctx.save();
  ctx.translate(5 * s + boltSlide, -14 * s);
  ctx.rotate(boltRot);
  ctx.fillStyle = '#555';
  ctx.fillRect(0, -12 * s, 3 * s, 12 * s);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(1.5 * s, -12 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Operator Red Accent lines
  ctx.fillStyle = redDecal;
  ctx.beginPath();
  ctx.moveTo(-30 * s, -5 * s);
  ctx.lineTo(-10 * s, -5 * s);
  ctx.lineTo(-18 * s, 2 * s);
  ctx.closePath();
  ctx.fill();

  // --- 3. HUGE SCOPE (drawn only if not zoomed in) ---
  if (ads < 0.8) {
    ctx.fillStyle = scopeColor;
    ctx.fillRect(-25 * s, -32 * s, 10 * s, 8 * s);
    ctx.fillRect(15 * s, -30 * s, 10 * s, 6 * s);

    ctx.beginPath();
    ctx.moveTo(-45 * s, -45 * s);
    ctx.lineTo(55 * s, -41 * s);
    ctx.lineTo(55 * s, -27 * s);
    ctx.lineTo(-45 * s, -31 * s);
    ctx.closePath();
    ctx.fill();

    // Glint reflection
    ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.beginPath();
    ctx.moveTo(35 * s, -40 * s);
    ctx.lineTo(50 * s, -39 * s);
    ctx.lineTo(40 * s, -28 * s);
    ctx.lineTo(25 * s, -29 * s);
    ctx.closePath();
    ctx.fill();
  }

  // --- 4. LONG BARREL & HEAVY MUZZLE BRAKE ---
  ctx.fillStyle = darkGraphite;
  ctx.beginPath();
  ctx.moveTo(45 * s, -18 * s);
  ctx.lineTo(245 * s, -13 * s);
  ctx.lineTo(245 * s, -6 * s);
  ctx.lineTo(45 * s, -10 * s);
  ctx.closePath();
  ctx.fill();

  // Double-baffle muzzle brake
  ctx.fillStyle = '#0f1012';
  ctx.fillRect(245 * s, -20 * s, 22 * s, 15 * s);
  ctx.fillStyle = '#333';
  ctx.fillRect(250 * s, -18 * s, 3 * s, 11 * s);
  ctx.fillRect(258 * s, -18 * s, 3 * s, 11 * s);

  // --- 5. BIPOD ---
  ctx.strokeStyle = darkGraphite;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(75 * s, -6 * s);
  ctx.lineTo(135 * s, -2 * s);
  ctx.stroke();

  // --- 6. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-32 * s, 12 * s);
  ctx.lineTo(-22 * s, 38 * s);
  ctx.lineTo(-7 * s, 38 * s);
  ctx.lineTo(-2 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawJudge(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;

  const darkMetal = '#1a1b1d';
  const midMetal = '#2b2c30';
  const lightMetal = '#40434a';

  const pumpX = -vm.pumpOffset * 12 * s;

  // --- 1. HEAVY STOCK ---
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.moveTo(-40 * s, -2 * s);
  ctx.lineTo(-80 * s, -10 * s);
  ctx.lineTo(-84 * s, 16 * s);
  ctx.lineTo(-44 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  // --- 2. RECEIVER & ACTION ---
  ctx.fillStyle = midMetal;
  ctx.beginPath();
  ctx.moveTo(-40 * s, -18 * s);
  ctx.lineTo(35 * s, -24 * s);
  ctx.lineTo(35 * s, 12 * s);
  ctx.lineTo(-40 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  // Shell eject port
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(-10 * s, -14 * s, 16 * s, 6 * s);

  // --- 3. DRUM MAGAZINE ---
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.arc(8 * s, 22 * s, 20 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lightMetal;
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(8 * s, 22 * s, 12 * s, 0, Math.PI * 2);
  ctx.stroke();

  // --- 4. STUBBY SHOTGUN BARREL ---
  ctx.fillStyle = darkMetal;
  ctx.beginPath();
  ctx.moveTo(35 * s, -22 * s);
  ctx.lineTo(145 * s, -18 * s);
  ctx.lineTo(145 * s, -4 * s);
  ctx.lineTo(35 * s, -2 * s);
  ctx.closePath();
  ctx.fill();

  // Bore opening
  ctx.fillStyle = '#000';
  ctx.fillRect(144 * s, -16 * s, 3 * s, 10 * s);

  // --- 5. PUMP SLIDE (animates!) ---
  ctx.save();
  ctx.translate(pumpX, 0);
  ctx.fillStyle = lightMetal;
  ctx.beginPath();
  ctx.moveTo(45 * s, -2 * s);
  ctx.lineTo(85 * s, -2 * s);
  ctx.lineTo(80 * s, 8 * s);
  ctx.lineTo(45 * s, 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5 * s;
  for (let i = 0; i < 4; i++) {
    const rx = 52 * s + i * 8 * s;
    ctx.beginPath();
    ctx.moveTo(rx, -2 * s);
    ctx.lineTo(rx, 8 * s);
    ctx.stroke();
  }
  ctx.restore();

  // --- 6. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-30 * s, 12 * s);
  ctx.lineTo(-20 * s, 38 * s);
  ctx.lineTo(-5 * s, 38 * s);
  ctx.lineTo(0 * s, 12 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawGuardian(ctx, w, h, wp, ads, vm) {
  const s = Math.min(w, h) / 800;
  const alpha = 1 - ads * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;

  const darkGrey = '#1e2022';
  const silverGrey = '#3a3d45';
  const woodTan = '#834c2a'; // rich wooden bronze
  const lightGrey = '#4f535d';

  // --- 1. STOCK ---
  ctx.fillStyle = woodTan;
  ctx.beginPath();
  ctx.moveTo(-45 * s, -5 * s);
  ctx.lineTo(-90 * s, -12 * s);
  ctx.lineTo(-92 * s, 12 * s);
  ctx.lineTo(-45 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = darkGrey;
  ctx.fillRect(-94 * s, -12 * s, 4 * s, 24 * s);

  // --- 2. RECEIVER ---
  ctx.fillStyle = silverGrey;
  ctx.beginPath();
  ctx.moveTo(-45 * s, -12 * s);
  ctx.lineTo(35 * s, -24 * s);
  ctx.lineTo(35 * s, 10 * s);
  ctx.lineTo(-45 * s, 8 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = woodTan;
  ctx.fillRect(-20 * s, -12 * s, 12 * s, 14 * s);

  // --- 3. STRAIGHT DMR MAGAZINE ---
  ctx.fillStyle = darkGrey;
  ctx.fillRect(-2 * s, 8 * s, 10 * s, 14 * s);

  // --- 4. FOREGRIP ---
  ctx.fillStyle = woodTan;
  ctx.beginPath();
  ctx.moveTo(35 * s, -24 * s);
  ctx.lineTo(115 * s, -20 * s);
  ctx.lineTo(105 * s, 2 * s);
  ctx.lineTo(35 * s, 2 * s);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = darkGrey;
  ctx.fillRect(50 * s, -14 * s, 10 * s, 3 * s);
  ctx.fillRect(75 * s, -13 * s, 10 * s, 3 * s);

  // --- 5. LONG BARREL ---
  ctx.fillStyle = darkGrey;
  ctx.beginPath();
  ctx.moveTo(115 * s, -18 * s);
  ctx.lineTo(205 * s, -14 * s);
  ctx.lineTo(205 * s, -8 * s);
  ctx.lineTo(105 * s, -10 * s);
  ctx.closePath();
  ctx.fill();

  // Flash hider
  ctx.fillStyle = lightGrey;
  ctx.fillRect(205 * s, -16 * s, 8 * s, 10 * s);

  // Sights
  ctx.fillStyle = darkGrey;
  ctx.fillRect(15 * s, -29 * s, 8 * s, 5 * s);
  ctx.fillRect(195 * s, -21 * s, 4 * s, 7 * s);

  // --- 6. HAND ---
  ctx.fillStyle = '#4e3e33';
  ctx.beginPath();
  ctx.moveTo(-30 * s, 10 * s);
  ctx.lineTo(-20 * s, 36 * s);
  ctx.lineTo(-5 * s, 36 * s);
  ctx.lineTo(0 * s, 10 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
