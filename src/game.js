'use strict';

import { AudioManager } from './audio-manager.js';
import { StatsManager } from './stats-manager.js';
import { EffectManager } from './effect-manager.js';
import { Renderer } from './renderer.js';
import { WeaponManager } from './weapon-manager.js';
import { WEAPONS, WEAPON_LIST, DEFAULT_WEAPON } from './weapons.js';
import { ViewModel } from './viewmodel.js';
import { GridshotMode } from './modes/gridshot.js';
import { TrackingMode } from './modes/tracking.js';
import { ReflexMode } from './modes/reflex.js';
import { DeathmatchMode } from './modes/deathmatch.js';
import { SprayControlMode } from './modes/spray-control.js';
import { PeekPracticeMode } from './modes/peek-practice.js';
import { PrecisionMode } from './modes/precision.js';
import { MultitargetMode } from './modes/multitarget.js';
import { StrafetrackMode } from './modes/strafetrack.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.audio = new AudioManager();
    this.stats = new StatsManager();
    this.effects = new EffectManager();
    this.state = 'menu'; // menu | countdown | playing | paused | score
    this.mode = null;
    this.mouseX = -100;
    this.mouseY = -100;
    this.lastClickTime = 0;
    this._elapsed = 0;
    this._lastTime = 0;
    this._rafId = null;
    this.width = 0;
    this.height = 0;
    this._dpr = window.devicePixelRatio || 1;
    this._lastResult = null;
    this._currentModeName = null;
    // FPS tracking
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this._fps = 0;
    this._fpsDisplay = null;
    this.weapon = new WeaponManager(this);
    this.viewmodel = new ViewModel(this);
    // Session history
    this._sessionHistory = [];
  }

  init() {
    this._setupCanvas();
    this._bindEvents();
    this._applySettings();
    this._populateStats();
    this._initSettingsUI();
    this._renderCrosshairPreview();
    this._checkFirstRun();
    this._loadSessionHistory();
    this._createFPSCounter();
  }

  _setupCanvas() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this._dpr;
    this.canvas.height = this.height * this._dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.scale(this._dpr, this._dpr);
  }

  getTimerDuration() {
    return this.stats.getSettings().timer;
  }

  getTargetSize() {
    return this.stats.getSettings().targetSize;
  }

  /* ==========================================
     STATE MACHINE
     ========================================== */
  showMenu(id) {
    this._clearActiveKeybind();
    this._trainingQueue = null;
    document.querySelectorAll('.menu-screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    document.getElementById('hud').classList.remove('visible');
    document.getElementById('pause-overlay').classList.remove('active');
    this.state = 'menu'; this._updateCursor();
    this._exitPointerLock();
    if (this.mode) { this.mode.end(); this.mode = null; }
    this.effects.clear();
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (id === 'menu-stats') this._populateStats();
    if (id === 'menu-settings') this._initSettingsUI();
    this.audio.play('menuClick');
  }

  startGame(modeName, fromRoutine = false) {
    this._clearActiveKeybind();
    if (!fromRoutine) {
      this._trainingQueue = null;
    }
    if (this.mode) {
      this.mode.end();
      this.mode = null;
    }
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._currentModeName = modeName;
    this.audio.play('menuClick');
    this._startCountdown();
  }

  _startCountdown() {
    this.state = 'countdown'; this._updateCursor();
    this._requestPointerLock();
    const s = this.stats.getSettings();
    if (s.rawInput) {
      this.mouseX = this.width / 2;
      this.mouseY = this.height / 2;
    }
    document.querySelectorAll('.menu-screen').forEach(el => el.classList.remove('active'));
    const overlay = document.getElementById('countdown-overlay');
    const display = document.getElementById('countdownDisplay');

    overlay.classList.add('active');

    const steps = ['3', '2', '1', 'GO'];
    let i = 0;
    const playStep = () => {
      if (i >= steps.length) {
        overlay.classList.remove('active');
        this._beginRound();
        return;
      }
      const val = steps[i];
      display.textContent = val;
      display.className = 'countdown-number';
      if (val === 'GO') {
        display.classList.add('go');
        this.audio.play('go');
      } else {
        this.audio.play('countdown');
      }
      void display.offsetWidth;
      display.style.animation = 'none';
      void display.offsetWidth;
      display.style.animation = '';
      display.className = 'countdown-number' + (val === 'GO' ? ' go' : '');
      i++;
      setTimeout(playStep, val === 'GO' ? 400 : 600);
    };
    playStep();
  }

  _beginRound() {
    this.lastClickTime = performance.now();
    this._elapsed = 0;
    this._lastTime = performance.now();
    // Clear any stale kill-feed entries from previous round
    const feed = document.getElementById('hudKillFeed');
    if (feed) feed.textContent = '';

    switch (this._currentModeName) {
      case 'gridshot': this.mode = new GridshotMode(this); break;
      case 'tracking': this.mode = new TrackingMode(this); break;
      case 'reflex': this.mode = new ReflexMode(this); break;
      case 'deathmatch': this.mode = new DeathmatchMode(this); break;
      case 'spray-control': this.mode = new SprayControlMode(this); break;
      case 'peek-practice': this.mode = new PeekPracticeMode(this); break;
      case 'precision': this.mode = new PrecisionMode(this); break;
      case 'multitarget': this.mode = new MultitargetMode(this); break;
      case 'strafetrack': this.mode = new StrafetrackMode(this); break;
    }

    // Fully reset weapon for new round (full ammo, cancel reload, reset recoil)
    this.weapon.resetForRound();
    this.viewmodel.onEquip();

    this.mode.start();
    this.state = 'playing'; this._updateCursor();
    document.getElementById('hud').classList.add('visible');
    this._updateHUD();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _loop(timestamp) {
    if (this.state === 'paused') {
      this._rafId = requestAnimationFrame((t) => this._loop(t));
      this._render();
      return;
    }

    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;
    this._elapsed += dt;

    // FPS counter
    this._fpsFrames++;
    this._fpsTime += dt;
    if (this._fpsTime >= 0.5) {
      this._fps = Math.round(this._fpsFrames / this._fpsTime);
      this._fpsFrames = 0;
      this._fpsTime = 0;
      if (this._fpsDisplay) {
        this._fpsDisplay.textContent = this._fps + ' FPS';
      }
    }

    this.weapon.update(dt);

    this.viewmodel.setADS(this.weapon.adsProgress);
    this.viewmodel.update(dt);
    this.mode.update(dt);
    this.effects.update(dt);
    this._render();
    this._updateHUD();

    if (!this.mode.running) {
      this._endRound();
      return;
    }

    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  _render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const theme = this.stats.getSettings().theme;

    Renderer.clear(ctx, w, h);
    Renderer.drawBackground(ctx, w, h, theme);

    if (this.mode) this.mode.render(ctx);

    this.effects.render(ctx);

    if (this.state === 'playing' || this.state === 'paused') {
      const ch = this.stats.getSettings().crosshair;
      const wm = this.weapon;
      // Crosshair with recoil offset (gun moves up during spray)
      const cx = this.mouseX;
      const cy = this.mouseY;
      // Draw crosshair bloom based on current spread
      const bloom = wm.getCurrentSpread() * 3;
      // Pass bloom and ADS info to renderer
      const chWithBloom = { ...ch, bloom, ads: wm.adsProgress };
      Renderer.drawCrosshair(ctx, cx, cy, chWithBloom);
      if (wm.recoilIndex > 1) {
        const rx = cx + wm.recoilSmooth.x * 1.5;
        const ry = cy - (wm.recoilSmooth.y) * 1.5;
        Renderer.drawRecoilIndicator(ctx, rx, ry, wm.getCurrentSpread());
      }
      Renderer.drawWeaponSilhouette(ctx, w, h, wm.currentId);
      // Draw the viewmodel weapon (replaces old drawWeaponSilhouette)
      this.viewmodel.render(ctx, w, h);
      // ADS scope overlay (sniper-style) — only for sniper-type weapons
      if (wm.weapon.type === 'sniper') {
        Renderer.drawADSScope(ctx, w, h, wm.adsProgress);
      }
    }
  }

  _updateHUD() {
    if (!this.mode) return;
    document.getElementById('hudModeName').textContent = this.mode.displayName || this._currentModeName.toUpperCase();

    const timeLeft = Math.max(0, this.mode.timeLeft || 0);
    const secs = Math.ceil(timeLeft);
    const mins = Math.floor(secs / 60);
    const remainSecs = secs % 60;
    const timerEl = document.getElementById('hudTimer');
    timerEl.textContent = mins > 0
      ? mins + ':' + String(remainSecs).padStart(2, '0')
      : String(remainSecs);
    timerEl.classList.toggle('warning', secs <= 5 && this.state === 'playing');

    document.getElementById('hudScore').textContent = this.mode.score || 0;

    const shots = this.mode.shots || 0;
    const hits = this.mode.hits || 0;
    const acc = shots > 0 ? Math.round((hits / shots) * 100) : 100;
    document.getElementById('hudAccuracy').textContent = acc + '%';

    document.getElementById('hudHeadshots').textContent = 'HEADSHOTS: ' + (this.mode.headshots || 0);
    document.getElementById('hudStreak').textContent = 'STREAK: ' + (this.mode.streak || 0);

    // Weapon HUD
    const wp = this.weapon;
    const wpNameEl = document.getElementById('hudWeaponName');
    const wpAmmoEl = document.getElementById('hudWeaponAmmo');
    if (wpNameEl) wpNameEl.textContent = wp.weapon.name.toUpperCase();
    if (wpAmmoEl) {
      wpAmmoEl.textContent = wp.ammo + ' / ' + wp.weapon.magSize;
      wpAmmoEl.classList.toggle('low-ammo', wp.ammo <= wp.weapon.magSize * 0.25);
    }
    // Reload indicator
    const reloadEl = document.getElementById('hudReloading');
    if (reloadEl) reloadEl.classList.toggle('visible', wp.reloading);
    // ADS indicator + bar
    const adsEl = document.getElementById('hudADS');
    const adsBar = document.getElementById('hudADSBar');
    const adsBarFill = adsBar ? adsBar.querySelector('.hud-ads-bar-fill') : null;
    if (adsEl) {
      if (this.weapon.ads || this.weapon.adsProgress > 0.01) {
        adsEl.textContent = 'ADS';
        adsEl.classList.add('active');
      } else {
        adsEl.textContent = '';
        adsEl.classList.remove('active');
      }
    }
    if (adsBar) {
      adsBar.classList.toggle('visible', this.weapon.ads || this.weapon.adsProgress > 0.01);
    }
    if (adsBarFill) {
      adsBarFill.style.width = (this.weapon.adsProgress * 100) + '%';
    }
  }

  /** Add a kill feed entry (Valorant-style top-right notification) */
  _addKillFeed(headshot, weaponName) {
    const feed = document.getElementById('hudKillFeed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'hud-killfeed-item' + (headshot ? ' headshot' : '');
    const icon = headshot ? '◆' : '✕';
    const weaponLabel = weaponName || '';
    item.innerHTML = `<span class="kill-icon">${icon}</span><span>${weaponLabel}</span>`;
    feed.appendChild(item);
    // Auto-remove after animation completes
    setTimeout(() => {
      if (item.parentNode) item.remove();
    }, 3000);
    // Keep max 5 items
    while (feed.children.length > 5) {
      feed.removeChild(feed.firstChild);
    }
  }

  _endRound() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    this._exitPointerLock();

    const result = this.mode.end();
    this._lastResult = result;

    const isNewHigh = this.stats.recordGame(
      result.mode, result.score,
      result.hits, result.shots,
      result.headshots, result.streak,
      result.reactionTimes
    );

    // Record session history (keep last 50)
    try {
      const sessionEntry = {
        mode: result.mode,
        score: result.score,
        hits: result.hits,
        shots: result.shots,
        headshots: result.headshots,
        streak: result.streak,
        timestamp: Date.now()
      };
      this._sessionHistory.push(sessionEntry);
      if (this._sessionHistory.length > 50) {
        this._sessionHistory = this._sessionHistory.slice(-50);
      }
      localStorage.setItem('vaim_session_history', JSON.stringify(this._sessionHistory));
    } catch (e) { /* ignore */ }

    this.state = 'score'; this._updateCursor();
    document.getElementById('hud').classList.remove('visible');
    this._showScore(result, isNewHigh);
  }

  _showScore(result, isNewHigh) {
    const menu = document.getElementById('menu-score');
    document.querySelectorAll('.menu-screen').forEach(el => el.classList.remove('active'));
    menu.classList.add('active');

    document.getElementById('finalScore').textContent = result.score;
    const hl = document.getElementById('highScoreHighlight');
    if (isNewHigh && result.score > 0) {
      hl.classList.add('show');
    } else {
      hl.classList.remove('show');
    }

    const shots = result.shots || 1;
    const acc = Math.round((result.hits / shots) * 100);
    const hsPct = result.hits > 0 ? Math.round((result.headshots / result.hits) * 100) : 0;

    document.getElementById('scoreDetails').innerHTML = `
      <div class="score-detail-item">
        <div class="detail-label">KILLS</div>
        <div class="detail-value">${result.hits}</div>
      </div>
      <div class="score-detail-item">
        <div class="detail-label">ACCURACY</div>
        <div class="detail-value">${acc}%</div>
      </div>
      <div class="score-detail-item">
        <div class="detail-label">HEADSHOT %</div>
        <div class="detail-value">${hsPct}%</div>
      </div>
      <div class="score-detail-item">
        <div class="detail-label">BEST STREAK</div>
        <div class="detail-value">${result.streak}</div>
      </div>
    `;

    const playAgainBtn = document.getElementById('playAgainBtn');
    if (this._trainingQueue && this._trainingQueue.length > 0) {
      playAgainBtn.querySelector('span').textContent = 'NEXT MODE';
      playAgainBtn.onclick = () => {
        this.audio.play('menuClick');
        this._nextTrainingMode();
      };
    } else if (this._trainingQueue && this._trainingQueue.length === 0) {
      playAgainBtn.querySelector('span').textContent = 'COMPLETE ROUTINE';
      playAgainBtn.onclick = () => {
        this.audio.play('menuClick');
        this._nextTrainingMode();
      };
    } else {
      playAgainBtn.querySelector('span').textContent = 'PLAY AGAIN';
      playAgainBtn.onclick = () => {
        this.audio.play('menuClick');
        this.startGame(result.mode);
      };
    }
  }

  /* ==========================================
     EVENTS
     ========================================== */
  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this._unlockAudio();
      const s = this.stats.getSettings();
      if (s.rawInput && document.pointerLockElement !== this.canvas) {
        if (this.state === 'playing' || this.state === 'countdown') {
          this.canvas.requestPointerLock();
          return;
        }
      }
      // Right-click: toggle ADS
      if (e.button === 2) {
        e.preventDefault();
        if (this.state === 'playing' || this.state === 'paused') {
          this.weapon.toggleADS();
          this.audio.play('menuClick');
        }
        return;
      }
      // Left-click or touch
      const pos = this._getPos(e);
      if (this.state === 'playing' && this.mode) {
        // Fire weapon (checks ammo, fire rate, reload)
        const shot = this.weapon.fire();
        if (!shot) {
          // Weapon blocked — play empty click if ammo empty, else ignore (fire rate cap)
          if (this.weapon.ammo === 0 && !this.weapon.reloading) {
            this.audio.play('empty');
          }
          return;
        }
        const aimX = pos.x + (shot.recoilOffset.x + shot.spreadOffset.x) * 1.2;
        const aimY = pos.y - (shot.recoilOffset.y + shot.spreadOffset.y) * 1.2;
        const r = this.mode.onMouseDown(aimX, aimY);
        if (r) {
          if (r.headshot) {
            this.audio.play('headshot');
            this._addKillFeed(true, this.weapon.weapon.name);
          } else if (r.hit) {
            this.audio.play('hit');
            this._addKillFeed(false, this.weapon.weapon.name);
          } else {
            this.audio.play('miss');
          }
          this.audio.playWeaponFire(this.weapon.currentId);

          // Trigger viewmodel recoil kick
          this.viewmodel.onFire();

          // Custom muzzle flash
          this.effects.addMuzzleFlash(this.viewmodel.muzzleX, this.viewmodel.muzzleY, this.weapon.currentId);

          // Muzzle smoke
          this.effects.addMuzzleSmoke(this.viewmodel.muzzleX, this.viewmodel.muzzleY);

          // Bullet impact decals (holes)
          this.effects.addBulletHole(aimX, aimY);

          // Bullet tracers connecting muzzle to impact
          const tracerColor = (this.weapon.currentId === 'phantom' || this.weapon.currentId === 'spectre' || this.weapon.currentId === 'ghost')
            ? 'rgba(0, 240, 255, 0.75)'
            : this.weapon.currentId === 'operator'
            ? 'rgba(255, 200, 50, 0.9)'
            : 'rgba(255, 180, 50, 0.8)';

          if (this.weapon.weapon.pellets) {
            for (let i = 0; i < this.weapon.weapon.pellets; i++) {
              const spreadMult = this.weapon.weapon.spread.standing * 0.8;
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * spreadMult;
              const pAimX = aimX + Math.cos(angle) * dist * 6;
              const pAimY = aimY + Math.sin(angle) * dist * 6;
              this.effects.addTracer(this.viewmodel.muzzleX, this.viewmodel.muzzleY, pAimX, pAimY, tracerColor, true);
            }
          } else {
            this.effects.addTracer(this.viewmodel.muzzleX, this.viewmodel.muzzleY, aimX, aimY, tracerColor, false);
          }

          // Auto-reload when empty
          if (this.weapon.ammo === 0 && !this.weapon.reloading) {
            const started = this.weapon.reload();
            if (started) this.viewmodel.onReload();
          }
        }
      }
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      const s = this.stats.getSettings();
      if (s.rawInput && document.pointerLockElement === this.canvas) {
        const sensMultiplier = this.weapon.ads ? (s.scopedSensitivity !== undefined ? s.scopedSensitivity : 1.0) : 1.0;
        const sensitivity = (s.sensitivity || 1.0) * sensMultiplier;
        const pixelsPerCount = sensitivity * 0.07 * (this.width / 103);

        this.mouseX = Math.max(0, Math.min(this.width, this.mouseX + e.movementX * pixelsPerCount));
        this.mouseY = Math.max(0, Math.min(this.height, this.mouseY + e.movementY * pixelsPerCount));
        if (this.mode) this.mode.onMouseMove(this.mouseX, this.mouseY);
      } else {
        const pos = this._getPos(e);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        if (this.mode) this.mode.onMouseMove(pos.x, pos.y);
      }
    });

    document.addEventListener('pointerlockchange', () => {
      const s = this.stats.getSettings();
      if (s.rawInput && document.pointerLockElement !== this.canvas) {
        if (this.state === 'playing') {
          this._pause();
        }
      }
    });

    document.addEventListener('pointerlockerror', (err) => {
      console.warn('Pointer lock error:', err);
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._unlockAudio();
      const touch = e.touches[0];
      const pos = this._getPos(touch);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
      if (this.state === 'playing' && this.mode) {
        const shot = this.weapon.fire();
        if (!shot) {
          if (this.weapon.ammo === 0 && !this.weapon.reloading) {
            this.audio.play('empty');
          }
          return;
        }
        const aimX = pos.x + (shot.recoilOffset.x + shot.spreadOffset.x) * 1.2;
        const aimY = pos.y - (shot.recoilOffset.y + shot.spreadOffset.y) * 1.2;
        const r = this.mode.onMouseDown(aimX, aimY);
        if (r) {
          if (r.headshot) {
            this.audio.play('headshot');
            this._addKillFeed(true, this.weapon.weapon.name);
          } else if (r.hit) {
            this.audio.play('hit');
            this._addKillFeed(false, this.weapon.weapon.name);
          } else {
            this.audio.play('miss');
          }
          this.audio.playWeaponFire(this.weapon.currentId);
          
          // Trigger viewmodel recoil kick
          this.viewmodel.onFire();

          // Custom muzzle flash
          this.effects.addMuzzleFlash(this.viewmodel.muzzleX, this.viewmodel.muzzleY, this.weapon.currentId);

          // Muzzle smoke
          this.effects.addMuzzleSmoke(this.viewmodel.muzzleX, this.viewmodel.muzzleY);

          // Bullet impact decals (holes)
          this.effects.addBulletHole(aimX, aimY);

          // Bullet tracers connecting muzzle to impact
          const tracerColor = (this.weapon.currentId === 'phantom' || this.weapon.currentId === 'spectre' || this.weapon.currentId === 'ghost')
            ? 'rgba(0, 240, 255, 0.75)'
            : this.weapon.currentId === 'operator'
            ? 'rgba(255, 200, 50, 0.9)'
            : 'rgba(255, 180, 50, 0.8)';

          if (this.weapon.weapon.pellets) {
            for (let i = 0; i < this.weapon.weapon.pellets; i++) {
              const spreadMult = this.weapon.weapon.spread.standing * 0.8;
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * spreadMult;
              const pAimX = aimX + Math.cos(angle) * dist * 6;
              const pAimY = aimY + Math.sin(angle) * dist * 6;
              this.effects.addTracer(this.viewmodel.muzzleX, this.viewmodel.muzzleY, pAimX, pAimY, tracerColor, true);
            }
          } else {
            this.effects.addTracer(this.viewmodel.muzzleX, this.viewmodel.muzzleY, aimX, aimY, tracerColor, false);
          }

          if (this.weapon.ammo === 0 && !this.weapon.reloading) {
            const started = this.weapon.reload();
            if (started) this.viewmodel.onReload();
          }
        }
      }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const pos = this._getPos(touch);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
      if (this.mode) this.mode.onMouseMove(pos.x, pos.y);
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
      const kb = this.stats.getSettings().keybinds || {};
      const key = e.key;

      if (key === kb.training && this.state === 'menu') {
        this._startTrainingRoutine();
        return;
      }

      switch (key) {
        case '1':
        case kb.gridshot: if (this.state === 'menu') { this.startGame('gridshot'); return; } break;
        case '2':
        case kb.tracking: if (this.state === 'menu') { this.startGame('tracking'); return; } break;
        case '3':
        case kb.reflex: if (this.state === 'menu') { this.startGame('reflex'); return; } break;
        case '4':
        case kb.deathmatch: if (this.state === 'menu') { this.startGame('deathmatch'); return; } break;
        case '5':
        case kb['spray-control']: if (this.state === 'menu') { this.startGame('spray-control'); return; } break;
        case '6':
        case kb['peek-practice']: if (this.state === 'menu') { this.startGame('peek-practice'); return; } break;
        case '7':
        case kb.precision: if (this.state === 'menu') { this.startGame('precision'); return; } break;
        case '8':
        case kb.multitarget: if (this.state === 'menu') { this.startGame('multitarget'); return; } break;
        case '9':
        case kb.strafetrack: if (this.state === 'menu') { this.startGame('strafetrack'); return; } break;
    }

    // Weapon controls (playing state only)
    if (this.state === 'playing' || this.state === 'paused') {
      // Weapon switching
      const weaponKeys = WEAPON_LIST;
      const numIdx = parseInt(key) - 1;
      if (numIdx >= 0 && numIdx < weaponKeys.length) {
        this.weapon.selectWeapon(weaponKeys[numIdx]);
        this.viewmodel.onEquip();
        return;
      }
      if (key.toLowerCase() === 'q') {
        const idx = weaponKeys.indexOf(this.weapon.currentId);
        const prev = (idx - 1 + weaponKeys.length) % weaponKeys.length;
        this.weapon.selectWeapon(weaponKeys[prev]);
        this.viewmodel.onEquip();
        return;
      }
      if (key.toLowerCase() === 'e') {
        const idx = weaponKeys.indexOf(this.weapon.currentId);
        const next = (idx + 1) % weaponKeys.length;
        this.weapon.selectWeapon(weaponKeys[next]);
        this.viewmodel.onEquip();
        return;
      }
      // Reload
      if (key.toLowerCase() === 'r' && this.state === 'playing') {
        const started = this.weapon.reload();
        if (started) this.viewmodel.onReload();
        return;
      }
      // Movement (affects accuracy)
      if (key === 'w' || key === 'W') { this.weapon.keyDown(key); return; }
      if (key === 's' || key === 'S') { this.weapon.keyDown(key); return; }
      if (key === 'a' || key === 'A') { this.weapon.keyDown(key); return; }
      if (key === 'd' || key === 'D') { this.weapon.keyDown(key); return; }
    }
      if (key === kb.play || key === 'Enter') {
        if (this.state === 'menu') { this.startGame('gridshot'); return; }
      }
      if (key === kb.pause || key === 'Escape') {
        if (this.state === 'playing') { this._pause(); return; }
        else if (this.state === 'paused') { this._resume(); return; }
        else if (this.state === 'menu') {
          const active = document.querySelector('.menu-screen.active');
          if (active && active.id !== 'menu-main') { this.showMenu('menu-main'); return; }
        }
      }
      if (key === kb.restart) {
        if (this.state === 'playing' || this.state === 'paused') {
          if (this.mode) { this.startGame(this.mode.name); return; }
        }
      }
      if (key === kb.menu || key.toLowerCase() === 'm') {
        if (this.state !== 'menu') { this.showMenu('menu-main'); return; }
      }
    });

    // Keyup: release movement keys via weapon keyUp
    document.addEventListener('keyup', (e) => {
      const key = e.key;
      if (key === 'w' || key === 'W' || key === 's' || key === 'S' ||
          key === 'a' || key === 'A' || key === 'd' || key === 'D') {
        this.weapon.keyUp(key);
      }
    });
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this._setupCanvas();
      }, 200);
    });

    document.getElementById('ui-overlay').addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]');
      if (action) {
        const act = action.dataset.action;
        if (act.startsWith('show-')) {
          this.showMenu('menu-' + act.slice(5));
        }
      }

      const card = e.target.closest('.mode-card');
      if (card && card.dataset.mode) {
        this.startGame(card.dataset.mode);
      }
    });

    document.getElementById('resumeBtn').addEventListener('click', () => this._resume());
    document.getElementById('restartBtn').addEventListener('click', () => {
      if (this.mode) this.startGame(this.mode.name);
    });
    document.getElementById('trainingRoutineBtn').addEventListener('click', () => {
      this.audio.play('menuClick');
      this._startTrainingRoutine();
    });
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : e.pageX;
    const clientY = e.clientY !== undefined ? e.clientY : e.pageY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  _unlockAudio() {
    if (this.audio.ctx && this.audio.ctx.state === 'suspended') {
      this.audio.ctx.resume();
    }
  }

  _pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused'; this._updateCursor();
    this._exitPointerLock();
    this.audio.play('menuClick');
    document.getElementById('pause-overlay').classList.add('active');
  }

  _resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing'; this._updateCursor();
    this._requestPointerLock();
    const s = this.stats.getSettings();
    if (s.rawInput) {
      this.mouseX = this.width / 2;
      this.mouseY = this.height / 2;
    }
    this._lastTime = performance.now();
    document.getElementById('pause-overlay').classList.remove('active');
  }

  /* ==========================================
     SETTINGS UI
     ========================================== */
  _initSettingsUI() {
    if (this._settingsReady) return;
    this._settingsReady = true;
    const s = this.stats.getSettings();
    const ch = s.crosshair;
    // Keybind display
    const kb = s.keybinds || {};
    const kbMap = { 'kb-gridshot': kb.gridshot, 'kb-tracking': kb.tracking, 'kb-reflex': kb.reflex, 'kb-deathmatch': kb.deathmatch,
      'kb-spray-control': kb['spray-control'], 'kb-peek-practice': kb['peek-practice'], 'kb-precision': kb.precision,
      'kb-multitarget': kb.multitarget, 'kb-strafetrack': kb.strafetrack, 'kb-restart': kb.restart, 'kb-menu': kb.menu };
    for (const [id, val] of Object.entries(kbMap)) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val).toUpperCase();
    }

    const sensSlider = document.getElementById('sensitivity');
    const sensNum = document.getElementById('sensitivity-num');
    const scopedSlider = document.getElementById('scoped-sensitivity');
    const scopedNum = document.getElementById('scoped-sens-num');
    const rawInputToggle = document.getElementById('rawInputToggle');

    sensSlider.value = Math.min(5.0, s.sensitivity);
    sensNum.value = s.sensitivity.toFixed(3);

    const updateSens = (val) => {
      val = Math.max(0.01, Math.min(10.0, parseFloat(val) || 1.0));
      this.stats.updateSetting('sensitivity', val);
      sensSlider.value = Math.min(5.0, val);
      sensNum.value = val.toFixed(3);
    };

    sensSlider.addEventListener('input', () => {
      updateSens(sensSlider.value);
    });

    sensNum.addEventListener('change', () => {
      updateSens(sensNum.value);
    });

    sensNum.addEventListener('input', () => {
      const val = parseFloat(sensNum.value);
      if (!isNaN(val) && val >= 0.01 && val <= 10.0) {
        this.stats.updateSetting('sensitivity', val);
        sensSlider.value = Math.min(5.0, val);
      }
    });

    const scopedSensVal = s.scopedSensitivity !== undefined ? s.scopedSensitivity : 1.0;
    scopedSlider.value = Math.min(5.0, scopedSensVal);
    scopedNum.value = scopedSensVal.toFixed(3);

    const updateScopedSens = (val) => {
      val = Math.max(0.01, Math.min(10.0, parseFloat(val) || 1.0));
      this.stats.updateSetting('scopedSensitivity', val);
      scopedSlider.value = Math.min(5.0, val);
      scopedNum.value = val.toFixed(3);
    };

    scopedSlider.addEventListener('input', () => {
      updateScopedSens(scopedSlider.value);
    });

    scopedNum.addEventListener('change', () => {
      updateScopedSens(scopedNum.value);
    });

    scopedNum.addEventListener('input', () => {
      const val = parseFloat(scopedNum.value);
      if (!isNaN(val) && val >= 0.01 && val <= 10.0) {
        this.stats.updateSetting('scopedSensitivity', val);
        scopedSlider.value = Math.min(5.0, val);
      }
    });

    const isRaw = s.rawInput !== undefined ? s.rawInput : true;
    rawInputToggle.classList.toggle('active', isRaw);
    rawInputToggle.addEventListener('click', () => {
      const val = rawInputToggle.classList.toggle('active');
      this.stats.updateSetting('rawInput', val);
      if (!val) {
        this._exitPointerLock();
      }
    });

    this._initOptions('targetSize', (val) => {
      this.stats.updateSetting('targetSize', val);
    }, s.targetSize);

    this._initOptions('roundTimer', (val) => {
      this.stats.updateSetting('timer', parseInt(val));
    }, String(s.timer));

    const soundToggle = document.getElementById('soundToggle');
    soundToggle.classList.toggle('active', s.soundEnabled);
    soundToggle.addEventListener('click', () => {
      const val = soundToggle.classList.toggle('active');
      this.stats.updateSetting('soundEnabled', val);
      this.audio.setEnabled(val);
    });

    this._initOptions('themeSelect', (val) => {
      this.stats.updateSetting('theme', val);
      this._applySettings();
    }, s.theme);

    const chSize = document.getElementById('chSize');
    chSize.value = ch.size;
    document.getElementById('chSizeValue').textContent = ch.size;
    chSize.addEventListener('input', () => {
      const val = parseInt(chSize.value);
      document.getElementById('chSizeValue').textContent = val;
      this.stats.updateSetting('crosshair.size', val);
      this._renderCrosshairPreview();
    });

    const chGap = document.getElementById('chGap');
    chGap.value = ch.gap;
    document.getElementById('chGapValue').textContent = ch.gap;
    chGap.addEventListener('input', () => {
      const val = parseInt(chGap.value);
      document.getElementById('chGapValue').textContent = val;
      this.stats.updateSetting('crosshair.gap', val);
      this._renderCrosshairPreview();
    });

    const chThick = document.getElementById('chThickness');
    chThick.value = ch.thickness;
    document.getElementById('chThickValue').textContent = ch.thickness;
    chThick.addEventListener('input', () => {
      const val = parseInt(chThick.value);
      document.getElementById('chThickValue').textContent = val;
      this.stats.updateSetting('crosshair.thickness', val);
      this._renderCrosshairPreview();
    });

    const chOutline = document.getElementById('chOutline');
    chOutline.classList.toggle('active', ch.outline);
    chOutline.addEventListener('click', () => {
      const val = chOutline.classList.toggle('active');
      this.stats.updateSetting('crosshair.outline', val);
      this._renderCrosshairPreview();
    });

    const chDot = document.getElementById('chDot');
    chDot.classList.toggle('active', ch.dot);
    chDot.addEventListener('click', () => {
      const val = chDot.classList.toggle('active');
      this.stats.updateSetting('crosshair.dot', val);
      this._renderCrosshairPreview();
    });

    document.querySelectorAll('#chColors .color-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === ch.color);
      sw.addEventListener('click', () => {
        document.querySelectorAll('#chColors .color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        this.stats.updateSetting('crosshair.color', sw.dataset.color);
        this._renderCrosshairPreview();
      });
    });

    document.getElementById('resetCrosshair').addEventListener('click', () => {
      this.stats.resetCrosshair();
      this._syncCrosshairUI();
      this._renderCrosshairPreview();
    });

    document.getElementById('resetStats').addEventListener('click', () => {
      if (confirm('Reset all statistics? This cannot be undone.')) {
        this.stats.resetStats();
        this._populateStats();
      }
    });

    // Export/Import buttons
    document.getElementById('exportData').addEventListener('click', () => this._exportData());
    document.getElementById('importData').addEventListener('click', () => this._importData());
    this._initKeybindsUI();
  }

  _initKeybindsUI() {
    const keybindRows = document.querySelectorAll('.setting-row .value[id^="kb-"]');
    keybindRows.forEach(el => {
      el.style.cursor = 'pointer';
      el.title = 'Click to rebind';
      el.addEventListener('click', () => {
        // Cancel any active binding first
        if (this._activeBindingElement && this._activeBindingElement !== el) {
          const oldVal = this.stats.getSettings().keybinds[this._activeBindingElement.id.replace('kb-', '')];
          this._activeBindingElement.textContent = String(oldVal).toUpperCase();
          this._activeBindingElement.classList.remove('binding-active');
          if (this._activeBindingHandler) {
            document.removeEventListener('keydown', this._activeBindingHandler, true);
          }
        }

        if (el.classList.contains('binding-active')) {
          // Toggle off if clicked again
          const oldVal = this.stats.getSettings().keybinds[el.id.replace('kb-', '')];
          el.textContent = String(oldVal).toUpperCase();
          el.classList.remove('binding-active');
          if (this._activeBindingHandler) {
            document.removeEventListener('keydown', this._activeBindingHandler, true);
            this._activeBindingHandler = null;
          }
          this._activeBindingElement = null;
          return;
        }

        this._activeBindingElement = el;
        el.textContent = 'PRESS KEY...';
        el.classList.add('binding-active');

        const handleBind = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const newKey = e.key;

          if (newKey === 'Escape') {
            const oldVal = this.stats.getSettings().keybinds[el.id.replace('kb-', '')];
            el.textContent = String(oldVal).toUpperCase();
            el.classList.remove('binding-active');
            this._activeBindingElement = null;
            this._activeBindingHandler = null;
            document.removeEventListener('keydown', handleBind, true);
            return;
          }

          const blockedKeys = ['Tab', 'CapsLock', 'Shift', 'Control', 'Alt', 'Meta', 'Backspace', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
          const isFKey = e.key.length > 1 && e.key.startsWith('F') && !isNaN(e.key.slice(1));
          if (blockedKeys.includes(newKey) || isFKey) {
            return; // Ignore system/modifier/navigation keys
          }
          
          const bindId = el.id.replace('kb-', '');
          this.stats.updateSetting(`keybinds.${bindId}`, newKey);
          el.textContent = newKey.toUpperCase();
          el.classList.remove('binding-active');
          this._activeBindingElement = null;
          this._activeBindingHandler = null;
          
          document.removeEventListener('keydown', handleBind, true);
        };
        
        this._activeBindingHandler = handleBind;
        document.addEventListener('keydown', handleBind, true);
      });
    });
  }

  _clearActiveKeybind() {
    if (this._activeBindingElement) {
      const oldVal = this.stats.getSettings().keybinds[this._activeBindingElement.id.replace('kb-', '')];
      this._activeBindingElement.textContent = String(oldVal).toUpperCase();
      this._activeBindingElement.classList.remove('binding-active');
      if (this._activeBindingHandler) {
        document.removeEventListener('keydown', this._activeBindingHandler, true);
        this._activeBindingHandler = null;
      }
      this._activeBindingElement = null;
    }
  }

  _initOptions(groupId, onChange, activeValue) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.setting-option').forEach(btn => {
      const val = btn.dataset.value;
      btn.classList.toggle('active', val === activeValue);
      btn.addEventListener('click', () => {
        group.querySelectorAll('.setting-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(val);
      });
    });
  }

  _syncCrosshairUI() {
    const ch = this.stats.getSettings().crosshair;
    document.getElementById('chSize').value = ch.size;
    document.getElementById('chSizeValue').textContent = ch.size;
    document.getElementById('chGap').value = ch.gap;
    document.getElementById('chGapValue').textContent = ch.gap;
    document.getElementById('chThickness').value = ch.thickness;
    document.getElementById('chThickValue').textContent = ch.thickness;
    document.getElementById('chOutline').classList.toggle('active', ch.outline);
    document.getElementById('chDot').classList.toggle('active', ch.dot);
    document.querySelectorAll('#chColors .color-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === ch.color);
    });
  }
  _syncSettingsUI() {
    const s = this.stats.getSettings();
    // Keybind display
    const kb = s.keybinds || {};
    const kbMap = { 'kb-gridshot': kb.gridshot, 'kb-tracking': kb.tracking, 'kb-reflex': kb.reflex, 'kb-deathmatch': kb.deathmatch,
      'kb-spray-control': kb['spray-control'], 'kb-peek-practice': kb['peek-practice'], 'kb-precision': kb.precision,
      'kb-multitarget': kb.multitarget, 'kb-strafetrack': kb.strafetrack, 'kb-restart': kb.restart, 'kb-menu': kb.menu };
    for (const [id, val] of Object.entries(kbMap)) {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val).toUpperCase();
    }
    // Sensitivity slider & number input
    const sensSlider = document.getElementById('sensitivity');
    const sensNum = document.getElementById('sensitivity-num');
    if (sensSlider) sensSlider.value = Math.min(5.0, s.sensitivity);
    if (sensNum) sensNum.value = s.sensitivity.toFixed(3);

    // Scoped sensitivity slider & number input
    const scopedSlider = document.getElementById('scoped-sensitivity');
    const scopedNum = document.getElementById('scoped-sens-num');
    const scopedSensVal = s.scopedSensitivity !== undefined ? s.scopedSensitivity : 1.0;
    if (scopedSlider) scopedSlider.value = Math.min(5.0, scopedSensVal);
    if (scopedNum) scopedNum.value = scopedSensVal.toFixed(3);

    // Raw input toggle
    const rawInputToggle = document.getElementById('rawInputToggle');
    const isRaw = s.rawInput !== undefined ? s.rawInput : true;
    if (rawInputToggle) rawInputToggle.classList.toggle('active', isRaw);
    // Sound toggle + runtime audio
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) soundToggle.classList.toggle('active', s.soundEnabled);
    this.audio.setEnabled(s.soundEnabled);
    // Sync option-group active states without re-adding listeners
    const syncGroup = (groupId, activeValue) => {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll('.setting-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === activeValue);
      });
    };
    syncGroup('targetSize', s.targetSize);
    syncGroup('roundTimer', String(s.timer));
    syncGroup('themeSelect', s.theme);
  }

  _renderCrosshairPreview() {
    const canvas = document.getElementById('crosshairPreview');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = 200;
    const h = 120;

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const ch = this.stats.getSettings().crosshair;
    Renderer.drawCrosshair(ctx, w / 2, h / 2, ch);
  }

  _applySettings() {
    const theme = this.stats.getSettings().theme;
    document.documentElement.setAttribute('data-theme', theme);
  }

  _updateCursor() {
    document.body.style.cursor = (this.state === 'playing' || this.state === 'paused') ? 'none' : '';
  }

  _requestPointerLock() {
    const s = this.stats.getSettings();
    if (s.rawInput) {
      this.canvas.requestPointerLock();
    }
  }

  _exitPointerLock() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  _populateStats() {
    const grid = document.getElementById('statsGrid');
    if (!grid) return;

    const modes = [
      { key: 'gridshot', name: 'Gridshot' },
      { key: 'tracking', name: 'Tracking' },
      { key: 'reflex', name: 'Reflex' },
      { key: 'deathmatch', name: 'Deathmatch' },
      { key: 'spray-control', name: 'Spray Control' },
      { key: 'peek-practice', name: 'Peek Practice' },
      { key: 'precision', name: 'Precision' },
      { key: 'multitarget', name: 'Multitarget' },
      { key: 'strafetrack', name: 'Strafetrack' }
    ];

    grid.innerHTML = '';

    for (const m of modes) {
      const st = this.stats.getStats(m.key);
      const acc = st.totalShots > 0 ? Math.round((st.totalHits / st.totalShots) * 100) + '%' : '—';
      const avgRt = st.reactionTimes.length > 0
        ? (st.reactionTimes.reduce((a, b) => a + b, 0) / st.reactionTimes.length * 1000).toFixed(0) + 'ms'
        : '—';
      const hs = st.totalHits > 0 ? Math.round((st.headshots / st.totalHits) * 100) + '%' : '—';

      grid.innerHTML += `
        <div class="stat-card">
          <h3>${m.name}</h3>
          <div class="stat-row">
            <span class="stat-label">High Score</span>
            <span class="stat-value">${st.highScore}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Accuracy</span>
            <span class="stat-value">${acc}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Avg Reaction</span>
            <span class="stat-value">${avgRt}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Headshot %</span>
            <span class="stat-value">${hs}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Sessions</span>
            <span class="stat-value">${st.sessions}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Best Streak</span>
            <span class="stat-value">${st.maxStreak}</span>
          </div>
        </div>
      `;
    }

    // Update rankings
    this._updateRankDisplay();

    // Recent sessions
    this._renderSessionHistory();
  }

  _renderSessionHistory() {
    const grid = document.getElementById('statsGrid');
    if (!grid || this._sessionHistory.length === 0) return;

    const recent = this._sessionHistory.slice(-5).reverse();
    let html = `<div class="stat-card" style="grid-column:1/-1">
      <h3>RECENT SESSIONS</h3>`;
    for (const s of recent) {
      const date = new Date(s.timestamp);
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const acc = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) + '%' : '—';
      html += `<div class="stat-row">
        <span class="stat-label">${s.mode.toUpperCase()} ${time}</span>
        <span class="stat-value">${s.score} · ${acc}</span>
      </div>`;
    }
    html += '</div>';
    grid.innerHTML += html;
   }

  /* ==========================================
     RANKING SYSTEM
     ========================================== */
  _getRank() {
    const stats = this.stats.data.stats;
    const tiers = [
      { name: 'RADIANT', min: 95, color: '#FFD700', icon: '✦' },
      { name: 'IMMORTAL', min: 90, color: '#FF4655', icon: '◆' },
      { name: 'ASCENDANT', min: 80, color: '#9B59B6', icon: '▲' },
      { name: 'DIAMOND', min: 70, color: '#3498DB', icon: '◇' },
      { name: 'PLATINUM', min: 55, color: '#2ECC71', icon: '★' },
      { name: 'GOLD', min: 40, color: '#F1C40F', icon: '●' },
      { name: 'SILVER', min: 20, color: '#BDC3C7', icon: '■' },
      { name: 'BRONZE', min: 0, color: '#CD7F32', icon: '▼' }
    ];

    // Calculate composite score
    let totalScore = 0;
    let modeCount = 0;
    for (const mode of ['gridshot', 'tracking', 'reflex', 'deathmatch', 'spray-control', 'peek-practice', 'precision', 'multitarget', 'strafetrack']) {
      const s = stats[mode];
      if (s && s.sessions > 0) {
        const acc = s.totalShots > 0 ? s.totalHits / s.totalShots : 0;
        const avgScore = s.highScore > 0 ? Math.min(s.highScore / 500, 1) : 0;
        totalScore += (acc * 0.4 + avgScore * 0.6) * 100;
        modeCount++;
      }
    }

    const composite = modeCount > 0 ? totalScore / modeCount : 0;
    const rank = tiers.find(t => composite >= t.min) || tiers[tiers.length - 1];
    return { ...rank, score: Math.round(composite) };
  }
  _loadSessionHistory() {
    try {
      const raw = localStorage.getItem('vaim_session_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this._sessionHistory = parsed.slice(-50);
        }
      }
    } catch (e) { /* ignore */ }
  }

  _updateRankDisplay() {
    const rankEl = document.getElementById('currentRank');
    const progressEl = document.getElementById('rankProgress');
    if (!rankEl && !progressEl) return;

    const rank = this._getRank();
    if (rankEl) {
      rankEl.innerHTML = `<span style="color:${rank.color}">${rank.icon} ${rank.name}</span>`;
    }
    if (progressEl) {
      const nextTier = [
        { name: 'RADIANT', min: 95 }, { name: 'IMMORTAL', min: 90 },
        { name: 'ASCENDANT', min: 80 }, { name: 'DIAMOND', min: 70 },
        { name: 'PLATINUM', min: 55 }, { name: 'GOLD', min: 40 },
        { name: 'SILVER', min: 20 }, { name: 'BRONZE', min: 0 }
      ].find(t => t.name === rank.name);
      if (nextTier) {
        const prevMin = Math.max(0, nextTier.min - 15);
        const prog = Math.min(100, ((rank.score - prevMin) / (nextTier.min - prevMin)) * 100);
        progressEl.style.width = Math.max(5, prog) + '%';
      }
    }
  }

  /* ==========================================
     TRAINING ROUTINES
     ========================================== */
  _startTrainingRoutine() {
    this._trainingQueue = ['gridshot', 'tracking', 'reflex'];
    this._routines = [
      { name: 'Quick Warmup', modes: ['gridshot', 'tracking', 'reflex'] },
      { name: 'Full Session', modes: ['gridshot', 'tracking', 'reflex', 'deathmatch', 'spray-control', 'peek-practice', 'precision', 'multitarget', 'strafetrack'] },
      { name: 'Flick Focus', modes: ['gridshot', 'gridshot', 'reflex', 'spray-control'] },
      { name: 'Precision Pack', modes: ['tracking', 'reflex', 'deathmatch', 'strafetrack'] },
      { name: 'Endurance', modes: ['multitarget', 'peek-practice', 'precision', 'strafetrack', 'deathmatch'] }
    ];
    this._trainingQueue = [...this._routines[0].modes];
    this._trainingRoutineScore = 0;
    this._nextTrainingMode();
  }

  _nextTrainingMode() {
    if (!this._trainingQueue || this._trainingQueue.length === 0) {
      this._showTrainingComplete();
      return;
    }
    const next = this._trainingQueue.shift();
    this.startGame(next, true);
  }

  _showTrainingComplete() {
    alert('Training routine complete! Check your statistics for improvements.');
    this._trainingQueue = null;
    this.showMenu('menu-main');
  }

  /* ==========================================
     FPS COUNTER
     ========================================== */
  _createFPSCounter() {
    const hud = document.getElementById('hud');
    if (!hud) return;
    const el = document.createElement('div');
    el.id = 'fpsCounter';
    el.style.cssText = 'position:absolute;bottom:24px;right:24px;z-index:6;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);letter-spacing:1px;pointer-events:none;opacity:0.6';
    el.textContent = '0 FPS';
    hud.insertAdjacentElement('afterend', el);
    this._fpsDisplay = document.getElementById('fpsCounter');
  }

  /* ==========================================
     EXPORT / IMPORT
     ========================================== */
  _exportData() {
    const data = this.stats.data;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'v-aim-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  _importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.settings && data.stats) {
            this.stats.data = this.stats._mergeDefaults(data);
            this.stats.save();
            this._applySettings();
            this._syncSettingsUI();
            this._syncCrosshairUI();
            this._renderCrosshairPreview();
            this._populateStats();
            alert('Data imported successfully!');
          } else {
            alert('Invalid data file. Must contain both settings and stats.');
          }
        } catch { alert('Failed to parse file.'); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  /* ==========================================
     ONBOARDING
     ========================================== */
  _checkFirstRun() {
    const data = this.stats.data;
    if (data.stats.gridshot.sessions === 0 &&
        data.stats.tracking.sessions === 0 &&
        data.stats.reflex.sessions === 0 &&
        data.stats.deathmatch.sessions === 0) {
      this._showOnboarding();
    }
  }

  _showOnboarding() {
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:100;
      background:rgba(0,0,0,0.85);
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      backdrop-filter:blur(8px);
      -webkit-backdrop-filter:blur(8px);
      padding:24px;
    `;
    overlay.innerHTML = `
      <div style="max-width:480px;text-align:center">
        <div style="font-size:48px;font-weight:900;letter-spacing:-2px;text-transform:uppercase;margin-bottom:8px">
          <span style="color:var(--text)">V</span><span style="color:var(--red)">—</span><span style="color:var(--red)">AIM</span>
        </div>
        <div style="font-size:13px;letter-spacing:6px;text-transform:uppercase;color:var(--text-muted);margin-bottom:32px;font-weight:300">
          WELCOME
        </div>
        <div style="text-align:left;color:var(--text-dim);font-size:14px;line-height:1.8;margin-bottom:32px">
          <p style="margin-bottom:6px"><strong style="color:var(--text)">GRIDSHOT</strong> — Flick between static targets. Speed matters.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">TRACKING</strong> — Follow the moving target. Stay on it to score.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">REFLEX</strong> — React before the target vanishes. Quick precision.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">DEATHMATCH</strong> — One target, escalating speed. Kill or be outscored.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">SPRAY CONTROL</strong> — Rapid consecutive hits. Master recoil transfer.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">PEEK PRACTICE</strong> — Enemies peek from cover. React and eliminate.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">PRECISION</strong> — Head-sized targets only. Pixel-perfect aim.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">MULTITARGET</strong> — Multiple targets per cluster. Switch and eliminate.</p>
          <p style="margin-bottom:6px"><strong style="color:var(--text)">STRAFETRACK</strong> — Track strafing enemies. Hit during movement.</p>
        </div>
        <button id="onboarding-start" class="menu-btn" style="min-width:240px">
          <span>GET STARTED</span><span class="key-hint">ENTER</span>
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    const handleKey = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        dismiss();
      }
    };

    const dismiss = () => {
      const el = document.getElementById('onboarding-overlay');
      if (el) {
        el.style.transition = 'opacity 0.3s';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
      }
      document.removeEventListener('keydown', handleKey, true);
    };

    overlay.querySelector('#onboarding-start').addEventListener('click', dismiss);
    document.addEventListener('keydown', handleKey, true);
  }
}
