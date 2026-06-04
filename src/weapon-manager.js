'use strict';

import { getWeapon, DEFAULT_WEAPON } from './weapons.js';

/**
 * Manages weapon state: selection, ammo, reload, recoil, movement accuracy.
 * This is the bridge between raw Valorant weapon data and the game loop.
 */
export class WeaponManager {
  constructor(game) {
    this.game = game;
    this.currentId = DEFAULT_WEAPON;
    this.ammo = 0;
    this.reserveAmmo = 0; // not used in aim trainer — infinite
    this._weapon = getWeapon(this.currentId);
    this.ammo = this._weapon.magSize;
    this._ammoById = { [this.currentId]: this._weapon.magSize };
    // Fire rate gating
    this._lastFireTime = 0;
    this._heldKeys = new Set();
    this._fireHeld = false;

    // Recoil state
    this.recoilIndex = 0;
    this.recoilOffset = { x: 0, y: 0 };
    this.recoilSmooth = { x: 0, y: 0 }; // smoothed for crosshair visual
    this.spread = 0; // current bullet spread (deg)
    this._lastRecoilUpdate = 0;

    // Reload state
    this.reloading = false;
    this._reloadTimer = 0;

    // Movement state — simulated via WASD
    this.moveX = 0;
    this.moveY = 0;

    // Shot counter for this round
    this.shotsFired = 0;
    this.hitsLanded = 0;

    // Recoil recovery delay + speed
    this._recoveryDelay = 0.15; // seconds before recoil starts recovering
    this._recoveryRate = 8.0;   // recovery speed (units/s)
    this._lastShotTime = 0;

    // ADS state
    this.ads = false;
    this.adsProgress = 0; // 0=hip, 1=ADS, interpolated
    this._adsToggleCooldown = 0;
  }

  get weapon() { return this._weapon; }

  selectWeapon(id) {
    const w = getWeapon(id);
    // getWeapon always returns a weapon (falls back to DEFAULT_WEAPON),
    // so normalize currentId to the resolved weapon's actual id
    // Persist current weapon's ammo before switching
    this._ammoById[this.currentId] = this.ammo;
    if (this.reloading) {
      // Cancel in-progress reload when switching weapons
      this.reloading = false;
      this._reloadTimer = 0;
    }
    this.currentId = w.id;
    this._weapon = w;
    this.ammo = this._ammoById[w.id] ?? w.magSize;
    this.resetRecoil();
  }

  /** Fully reset weapon for a new round: full ammo, cancel reload, reset recoil, clear ADS */
  resetForRound() {
    this.reloading = false;
    this._reloadTimer = 0;
    this.ammo = this._weapon.magSize;
    this._ammoById[this.currentId] = this.ammo;
    this.resetRecoil();
    this.shotsFired = 0;
    this.clearADS();
  }

  resetRecoil() {
    this.recoilIndex = 0;
    this.recoilOffset = { x: 0, y: 0 };
    this.recoilSmooth = { x: 0, y: 0 };
    this.spread = 0;
  }

  canFire() {
    const now = performance.now() / 1000;
    const interval = 1.0 / this._weapon.fireRate;
    return !this.reloading
      && this.ammo > 0
      && (now - this._lastFireTime) >= interval;
  }

  /**
   * Called when the player clicks. Returns null if can't fire,
   * otherwise returns the spread+recoil-modified aim offset and shot data.
   */
  fire() {
    const now = performance.now() / 1000;
    if (!this.canFire()) return null;

    this._lastFireTime = now;
    this._lastShotTime = now;
    this.ammo--;
    this._ammoById[this.currentId] = this.ammo;
    this.shotsFired++;

    // ---- Recoil ----
    const pattern = this._weapon.recoil;
    if (this.recoilIndex < pattern.length) {
      this.recoilOffset.x += pattern[this.recoilIndex].x;
      this.recoilOffset.y += pattern[this.recoilIndex].y;
      this.recoilIndex++;
    } else {
      const last = pattern[pattern.length - 1];
      this.recoilOffset.x += last.x + (Math.random() - 0.5) * 1.5;
      this.recoilOffset.y += last.y + (Math.random() - 0.5) * 1.0;
    }

    // ---- Spread ----
    const { standing, walking, running, crouching } = this._weapon.spread;
    let baseSpread = standing;
    const moveMag = Math.sqrt(this.moveX * this.moveX + this.moveY * this.moveY);
    if (moveMag > 0.8) {
      baseSpread = running;
    } else if (moveMag > 0.1) {
      baseSpread = walking;
    }
    if (this._weapon.pellets) {
      baseSpread = Math.max(baseSpread, standing);
    }

    const isFirstShot = this.recoilIndex <= 1;
    const firstShotBonus = isFirstShot ? this._weapon.firstShotInaccuracy : 0;
    this.spread = (baseSpread + (this.recoilIndex * 0.05) + firstShotBonus) * this.getADSMultiplier();

    const angle = Math.random() * Math.PI * 2;
    const spreadAmount = (Math.random() * this.spread) * 0.5;
    const spreadX = Math.cos(angle) * spreadAmount;
    const spreadY = Math.sin(angle) * spreadAmount;

    return {
      recoilOffset: { x: this.recoilOffset.x, y: this.recoilOffset.y },
      spreadOffset: { x: spreadX, y: spreadY },
      spread: this.spread,
      weapon: this._weapon,
      isFirstShot
    };
  }

  // Movement input with multi-key support
  keyDown(key) {
    this._heldKeys.add(key);
    this._updateMovement();
  }

  keyUp(key) {
    this._heldKeys.delete(key);
    this._updateMovement();
  }

  _updateMovement() {
    let dx = 0, dy = 0;
    if (this._heldKeys.has('w') || this._heldKeys.has('W')) dy = -1;
    if (this._heldKeys.has('s') || this._heldKeys.has('S')) dy = 1;
    if (this._heldKeys.has('a') || this._heldKeys.has('A')) dx = -1;
    if (this._heldKeys.has('d') || this._heldKeys.has('D')) dx = 1;
    this.moveX = dx;
    this.moveY = dy;
  }

  setMovement(dx, dy) {
    this.moveX = Math.max(-1, Math.min(1, dx));
    this.moveY = Math.max(-1, Math.min(1, dy));
  }

  /**
   * Update recoil recovery and smoothing each frame.
   */
  update(dt) {
    const now = performance.now() / 1000;
    if (this._adsToggleCooldown > 0) this._adsToggleCooldown -= dt;

    // ADS progress interpolation runs every frame (even during reload) to keep HUD/viewmodel in sync
    const adsTarget = this.ads ? 1 : 0;
    this.adsProgress += (adsTarget - this.adsProgress) * Math.min(1, dt * 10);

    // Reload timer
    if (this.reloading) {
      this._reloadTimer -= dt;
      if (this._reloadTimer <= 0) {
        this.ammo = this._weapon.magSize;
        this._ammoById[this.currentId] = this.ammo;
        this.reloading = false;
        this._reloadTimer = 0;
        this.resetRecoil();
      }
      return;
    }

    // Auto-reload on empty
    if (this.ammo <= 0 && !this.reloading) {
      this.reload();
      return;
    }

    // Recoil recovery
    const timeSinceLastShot = now - this._lastShotTime;
    if (timeSinceLastShot > this._recoveryDelay && this.recoilIndex > 0 && !this.reloading) {
      // Exponential recovery
      const recovery = this._recoveryRate * dt;
      const mag = Math.sqrt(
        this.recoilOffset.x * this.recoilOffset.x +
        this.recoilOffset.y * this.recoilOffset.y
      );
      if (mag > recovery) {
        const ratio = 1 - recovery / mag;
        this.recoilOffset.x *= ratio;
        this.recoilOffset.y *= ratio;
        this.recoilSmooth.x = this.recoilOffset.x;
        this.recoilSmooth.y = this.recoilOffset.y;
      } else {
        this.resetRecoil();
      }
    }

    // Smooth recoil
    this.recoilSmooth.x += (this.recoilOffset.x - this.recoilSmooth.x) * Math.min(1, dt * 15);
    this.recoilSmooth.y += (this.recoilOffset.y - this.recoilSmooth.y) * Math.min(1, dt * 15);

  }

  reload() {
    if (this.reloading || this.ammo === this._weapon.magSize) return false;
    this.reloading = true;
    this._reloadTimer = this._weapon.reloadTime;
    this.resetRecoil();
    return true;
  }


  getCurrentSpread() {
    return this.spread;
  }

  // Score multiplier based on weapon difficulty
  getScoreMultiplier() {
    const typeMult = {
      rifle: 1.0,
      smg: 0.85,
      pistol: 1.0,
      sniper: 1.5,
      shotgun: 0.7
    };
    return typeMult[this._weapon.type] || 1.0;
  }

  setADS(enabled) {
    this.ads = Boolean(enabled);
    if (!enabled) {
      this.adsProgress = 0;
      this._adsToggleCooldown = 0;
    }
  }

  clearADS() {
    this.ads = false;
    this.adsProgress = 0;
    this._adsToggleCooldown = 0;
  }

  toggleADS() {
    if (this._adsToggleCooldown > 0) return;
    this.setADS(!this.ads);
    this._adsToggleCooldown = 0.2; // prevent rapid toggling
  }

  isADS() {
    return this.ads;
  }

  getADSMultiplier() {
    // ADS improves accuracy: reduces spread by 40%
    return this.ads ? 0.6 : 1.0;
  }

  getMovementSpeedMultiplier() {
    // ADS slows movement by 50%
    if (!this.ads) return 1.0;
    return this._weapon.type === 'sniper' ? 0.3 : 0.5;
  }
}

