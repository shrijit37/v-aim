'use strict';

import { WEAPONS } from './weapons.js';

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this._enabled = true;
    this._reverbCache = {};
  }

  _init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
  }

  setEnabled(v) {
    this._enabled = v;
    if (v && this.master) this.master.gain.value = 0.3;
    else if (this.master) this.master.gain.value = 0;
  }

  _reverb(duration, decay) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * decay));
    }
    return buf;
  }

  _convolve(buffer, reverbBuf) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const convolver = ctx.createConvolver();
    convolver.buffer = reverbBuf;
    const g = ctx.createGain();
    g.gain.value = 0.3;
    src.connect(convolver).connect(g).connect(this.master);
    src.start();
  }

  _noise(duration) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }
  playWeaponFire(weaponId) {
    if (!this._enabled) return;
    this._init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const cacheReverb = (duration) => {
      const cacheKey = duration.toFixed(3);
      let revBuf = this._reverbCache[cacheKey];
      if (!revBuf) {
        revBuf = this._reverb(duration, 0.04);
        this._reverbCache[cacheKey] = revBuf;
      }
      return revBuf;
    };

    const playReverb = (gainVal, duration) => {
      const revSrc = ctx.createBufferSource();
      revSrc.buffer = cacheReverb(duration);
      const revG = ctx.createGain();
      revG.gain.setValueAtTime(0, now);
      revG.gain.linearRampToValueAtTime(gainVal * 0.25, now + 0.005);
      revG.gain.exponentialRampToValueAtTime(0.001, now + duration);
      revSrc.connect(revG).connect(this.master);
      revSrc.start(now);
      revSrc.stop(now + duration);
    };

    if (weaponId === 'vandal') {
      // Vandal Firing Sound: Deep, heavy, metallic crack
      // 1. Bass thump layer
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0, now);
      oscG.gain.linearRampToValueAtTime(0.35, now + 0.004);
      oscG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(oscG).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.12);

      // 2. Metallic bandpass resonance layer
      const metOsc = ctx.createOscillator();
      metOsc.type = 'sawtooth';
      metOsc.frequency.setValueAtTime(450, now);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 4;
      const metG = ctx.createGain();
      metG.gain.setValueAtTime(0, now);
      metG.gain.linearRampToValueAtTime(0.15, now + 0.005);
      metG.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      metOsc.connect(bp).connect(metG).connect(this.master);
      metOsc.start(now);
      metOsc.stop(now + 0.07);

      // 3. Main white noise gunshot crack
      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(0.12);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;
      const noiseG = ctx.createGain();
      noiseG.gain.setValueAtTime(0, now);
      noiseG.gain.linearRampToValueAtTime(0.35, now + 0.003);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(lp).connect(noiseG).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.12);

      // Reverb tail
      playReverb(0.35, 0.22);

    } else if (weaponId === 'phantom') {
      // Phantom Firing Sound: Clean suppressed pop
      // 1. High frequency sine chirp
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.035);
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0, now);
      oscG.gain.linearRampToValueAtTime(0.25, now + 0.002);
      oscG.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(oscG).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.04);

      // 2. High-frequency suppressed noise
      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(0.07);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2800;
      bp.Q.value = 1.2;
      const noiseG = ctx.createGain();
      noiseG.gain.setValueAtTime(0, now);
      noiseG.gain.linearRampToValueAtTime(0.28, now + 0.003);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      noise.connect(bp).connect(noiseG).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.07);

      // Short suppressed tail
      playReverb(0.2, 0.09);

    } else if (weaponId === 'sheriff') {
      // Sheriff Firing Sound: Loud crisp revolver crack
      // 1. Deep barrel thump
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);
      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 200;
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0, now);
      oscG.gain.linearRampToValueAtTime(0.4, now + 0.003);
      oscG.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(lpFilter).connect(oscG).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.16);

      // 2. Loud metallic clang / noise burst
      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(0.18);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 1.8;
      const noiseG = ctx.createGain();
      noiseG.gain.setValueAtTime(0, now);
      noiseG.gain.linearRampToValueAtTime(0.5, now + 0.003);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      noise.connect(bp).connect(noiseG).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.18);

      // Long spacious revolver tail
      playReverb(0.5, 0.35);

    } else if (weaponId === 'ghost') {
      // Ghost Firing Sound: Snappy, high-frequency pop
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.02);
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0, now);
      oscG.gain.linearRampToValueAtTime(0.18, now + 0.002);
      oscG.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(oscG).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.035);

      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(0.05);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3500;
      const noiseG = ctx.createGain();
      noiseG.gain.setValueAtTime(0, now);
      noiseG.gain.linearRampToValueAtTime(0.2, now + 0.002);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      noise.connect(hp).connect(noiseG).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.05);

      playReverb(0.15, 0.06);

    } else if (weaponId === 'spectre') {
      // Spectre Firing Sound: Fast snappy suppressed flutter
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.03);
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0, now);
      oscG.gain.linearRampToValueAtTime(0.2, now + 0.002);
      oscG.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(oscG).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.05);

      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(0.06);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      const noiseG = ctx.createGain();
      noiseG.gain.setValueAtTime(0, now);
      noiseG.gain.linearRampToValueAtTime(0.24, now + 0.002);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      noise.connect(bp).connect(noiseG).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.06);

      playReverb(0.18, 0.08);

    } else if (weaponId === 'operator') {
      // Operator Firing Sound: Deafening cannon blast + mechanical bolt
      // 1. Massive sub-bass boom
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(70, now);
      sub.frequency.exponentialRampToValueAtTime(28, now + 0.22);
      const subG = ctx.createGain();
      subG.gain.setValueAtTime(0, now);
      subG.gain.linearRampToValueAtTime(0.7, now + 0.005);
      subG.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      sub.connect(subG).connect(this.master);
      sub.start(now);
      sub.stop(now + 0.25);

      // 2. High-gain wide explosion noise
      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(0.25);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1100;
      const noiseG = ctx.createGain();
      noiseG.gain.setValueAtTime(0, now);
      noiseG.gain.linearRampToValueAtTime(0.7, now + 0.004);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      noise.connect(lp).connect(noiseG).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.25);

      // Giant stadium tail
      playReverb(0.7, 0.48);

      // 3. Scheduled bolt-action cycling sound (click-clack)
      // Bolt unlock (click up) at 0.35s
      const tUnlock = now + 0.35;
      const unlockOsc = ctx.createOscillator();
      unlockOsc.type = 'triangle';
      unlockOsc.frequency.setValueAtTime(900, tUnlock);
      unlockOsc.frequency.exponentialRampToValueAtTime(300, tUnlock + 0.06);
      const unlockG = ctx.createGain();
      unlockG.gain.setValueAtTime(0, tUnlock);
      unlockG.gain.linearRampToValueAtTime(0.12, tUnlock + 0.003);
      unlockG.gain.exponentialRampToValueAtTime(0.001, tUnlock + 0.06);
      unlockOsc.connect(unlockG).connect(this.master);
      unlockOsc.start(tUnlock);
      unlockOsc.stop(tUnlock + 0.06);

      // Bolt pull back (sliding scratch) at 0.52s
      const tPull = now + 0.52;
      const pullNoise = ctx.createBufferSource();
      pullNoise.buffer = this._noise(0.08);
      const pullBp = ctx.createBiquadFilter();
      pullBp.type = 'bandpass';
      pullBp.frequency.setValueAtTime(1400, tPull);
      pullBp.frequency.exponentialRampToValueAtTime(800, tPull + 0.08);
      const pullG = ctx.createGain();
      pullG.gain.setValueAtTime(0, tPull);
      pullG.gain.linearRampToValueAtTime(0.08, tPull + 0.005);
      pullG.gain.exponentialRampToValueAtTime(0.001, tPull + 0.08);
      pullNoise.connect(pullBp).connect(pullG).connect(this.master);
      pullNoise.start(tPull);
      pullNoise.stop(tPull + 0.08);

      // Bolt push forward (slide & lock down clack) at 0.72s
      const tLock = now + 0.72;
      const lockNoise = ctx.createBufferSource();
      lockNoise.buffer = this._noise(0.06);
      const lockBp = ctx.createBiquadFilter();
      lockBp.type = 'bandpass';
      lockBp.frequency.setValueAtTime(600, tLock);
      lockBp.frequency.exponentialRampToValueAtTime(1200, tLock + 0.06);
      const lockG = ctx.createGain();
      lockG.gain.setValueAtTime(0, tLock);
      lockG.gain.linearRampToValueAtTime(0.14, tLock + 0.003);
      lockG.gain.exponentialRampToValueAtTime(0.001, tLock + 0.06);
      lockNoise.connect(lockBp).connect(lockG).connect(this.master);
      lockNoise.start(tLock);
      lockNoise.stop(tLock + 0.06);

    } else if (weaponId === 'judge') {
      // Judge Firing Sound: Chaotic wide shotgun flame blast
      // Low end boom noise
      const lowNoise = ctx.createBufferSource();
      lowNoise.buffer = this._noise(0.16);
      const lowFilter = ctx.createBiquadFilter();
      lowFilter.type = 'lowpass';
      lowFilter.frequency.value = 650;
      const lowG = ctx.createGain();
      lowG.gain.setValueAtTime(0, now);
      lowG.gain.linearRampToValueAtTime(0.55, now + 0.004);
      lowG.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      lowNoise.connect(lowFilter).connect(lowG).connect(this.master);
      lowNoise.start(now);
      lowNoise.stop(now + 0.16);

      // High end pellet scatter crackle noise
      const highNoise = ctx.createBufferSource();
      highNoise.buffer = this._noise(0.12);
      const highFilter = ctx.createBiquadFilter();
      highFilter.type = 'highpass';
      highFilter.frequency.value = 3200;
      const highG = ctx.createGain();
      highG.gain.setValueAtTime(0, now);
      highG.gain.linearRampToValueAtTime(0.45, now + 0.003);
      highG.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      highNoise.connect(highFilter).connect(highG).connect(this.master);
      highNoise.start(now);
      highNoise.stop(now + 0.12);

      playReverb(0.45, 0.28);

    } else if (weaponId === 'guardian') {
      // Guardian Firing Sound: Punchy semi-auto crack
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
      const lpFilter = ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.frequency.value = 350;
      const oscG = ctx.createGain();
      oscG.gain.setValueAtTime(0, now);
      oscG.gain.linearRampToValueAtTime(0.45, now + 0.003);
      oscG.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(lpFilter).connect(oscG).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.13);

      const noise = ctx.createBufferSource();
      noise.buffer = this._noise(0.14);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      const noiseG = ctx.createGain();
      noiseG.gain.setValueAtTime(0, now);
      noiseG.gain.linearRampToValueAtTime(0.45, now + 0.003);
      noiseG.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(bp).connect(noiseG).connect(this.master);
      noise.start(now);
      noise.stop(now + 0.14);

      playReverb(0.4, 0.25);
    }
  }

   play(name) {
    if (!this._enabled) return;
    this._init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    switch (name) {
      case 'gunshot': {
        const src = ctx.createBufferSource();
        src.buffer = this._noise(0.08);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.3, now + 0.003);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        src.connect(lp).connect(g).connect(this.master);
        src.start(now);
        src.stop(now + 0.08);
        // Add reverb tail
        const revBuf = this._reverb(0.15, 0.04);
        const revSrc = ctx.createBufferSource();
        revSrc.buffer = revBuf;
        const revG = ctx.createGain();
        revG.gain.setValueAtTime(0, now);
        revG.gain.linearRampToValueAtTime(0.08, now + 0.005);
        revG.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        revSrc.connect(revG).connect(this.master);
        revSrc.start(now);
        revSrc.stop(now + 0.15);
        break;
      }
      case 'headshot': {
        [1600, 2400, 3200].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now + i * 0.02);
          g.gain.linearRampToValueAtTime(0.15, now + i * 0.02 + 0.005);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(g).connect(this.master);
          osc.start(now + i * 0.02);
          osc.stop(now + 0.12);
        });
        const ns = ctx.createBufferSource();
        ns.buffer = this._noise(0.08);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 5000;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0, now + 0.01);
        ng.gain.linearRampToValueAtTime(0.08, now + 0.02);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        ns.connect(hp).connect(ng).connect(this.master);
        ns.start(now + 0.01);
        ns.stop(now + 0.09);
        break;
      }
      case 'hit': {
        const ns = ctx.createBufferSource();
        ns.buffer = this._noise(0.02);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 4000;
        bp.Q.value = 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        ns.connect(bp).connect(g).connect(this.master);
        ns.start(now);
        ns.stop(now + 0.02);
        // Soft click overlay
        const pingOsc = ctx.createOscillator();
        pingOsc.type = 'sine';
        pingOsc.frequency.value = 2000;
        const pingG = ctx.createGain();
        pingG.gain.setValueAtTime(0.04, now);
        pingG.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        pingOsc.connect(pingG).connect(this.master);
        pingOsc.start(now);
        pingOsc.stop(now + 0.04);
        break;
      }
      case 'kill': {
        [900, 600].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.15, now + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
          osc.connect(g).connect(this.master);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.15);
        });
        break;
      }
      case 'miss': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 120;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
      case 'empty': {
        // Dry click — very short metallic tick
        const src = ctx.createBufferSource();
        src.buffer = this._noise(0.02);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 8000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.04, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        src.connect(hp).connect(g).connect(this.master);
        src.start(now);
        src.stop(now + 0.03);
        break;
      }
      case 'menuClick': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.08);
        // Layer a subtle harmonic
        const osc2 = ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1200, now);
        osc2.frequency.exponentialRampToValueAtTime(600, now + 0.06);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.03, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc2.connect(g2).connect(this.master);
        osc2.start(now);
        osc2.stop(now + 0.1);
        break;
      }
      case 'countdown': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 600;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }
      case 'go': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 1000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }
    }
  }
}
