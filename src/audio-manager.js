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

    // Weapon-specific gunshot based on weaponId
    let gain = 0.3, lowpass = 3000, noiseLen = 0.08, tail = 0.15;
    const weapon = WEAPONS[weaponId];
    if (weapon?.audio) {
      gain = weapon.audio.gain;
      lowpass = weapon.audio.lowpass;
      noiseLen = weapon.audio.noiseLen;
      tail = weapon.audio.tail;
    }

    const src = ctx.createBufferSource();
    src.buffer = this._noise(noiseLen);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);
    src.connect(lp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + noiseLen);
    // Add reverb tail (cached — reuse buffers for same tail duration)
    const cacheKey = tail.toFixed(3);
    let revBuf = this._reverbCache[cacheKey];
    if (!revBuf) {
      revBuf = this._reverb(tail, 0.04);
      this._reverbCache[cacheKey] = revBuf;
    }
    const revSrc = ctx.createBufferSource();
    revSrc.buffer = revBuf;
    const revG = ctx.createGain();
    revG.gain.setValueAtTime(0, now);
    revG.gain.linearRampToValueAtTime(gain * 0.25, now + 0.005);
    revG.gain.exponentialRampToValueAtTime(0.001, now + tail);
    revSrc.connect(revG).connect(this.master);
    revSrc.start(now);
    revSrc.stop(now + tail);
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
