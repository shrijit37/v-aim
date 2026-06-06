'use strict';

export class StatsManager {
  constructor() {
    this.data = this._load();
  }

  _defaults() {
    return {
      settings: {
        sensitivity: 1.0,
        scopedSensitivity: 1.0,
        rawInput: true,
        targetSize: 'medium',
        timer: 60,
        theme: 'dark',
        soundEnabled: true,
        crosshair: {
          color: '#00FF00',
          size: 5,
          thickness: 2,
          gap: 3,
          dot: false,
          outline: true
        },
        keybinds: {
          gridshot: '1',
          tracking: '2',
          reflex: '3',
          deathmatch: '4',
          'spray-control': '5',
          'peek-practice': '6',
          precision: '7',
          multitarget: '8',
          strafetrack: '9',
          play: 'Enter',
          pause: 'Escape',
          restart: 'r',
          menu: 'm',
          training: 't'
        }
      },
      stats: {
        gridshot: { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        tracking: { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        reflex: { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        deathmatch: { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        'spray-control': { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        'peek-practice': { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        precision: { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        multitarget: { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] },
        strafetrack: { highScore: 0, totalHits: 0, totalShots: 0, headshots: 0, sessions: 0, maxStreak: 0, reactionTimes: [] }
      }
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem('vaim_data');
      if (raw) {
        const parsed = JSON.parse(raw);
        return this._mergeDefaults(parsed);
      }
    } catch (e) { /* ignore */ }
    return this._defaults();
  }

  _mergeDefaults(data) {
    const defs = this._defaults();
    if (!data.settings) data.settings = defs.settings;
    else {
      Object.keys(defs.settings).forEach(k => {
        if (typeof defs.settings[k] === 'object' && defs.settings[k] !== null) {
          if (!data.settings[k]) data.settings[k] = defs.settings[k];
          else Object.keys(defs.settings[k]).forEach(sk => {
            if (data.settings[k][sk] === undefined) data.settings[k][sk] = defs.settings[k][sk];
          });
        } else if (data.settings[k] === undefined) data.settings[k] = defs.settings[k];
      });
    }
    if (!data.stats) data.stats = defs.stats;
    else {
      Object.keys(defs.stats).forEach(m => {
        if (!data.stats[m]) data.stats[m] = defs.stats[m];
        else {
          Object.keys(defs.stats[m]).forEach(k => {
            if (data.stats[m][k] === undefined) data.stats[m][k] = defs.stats[m][k];
          });
        }
      });
    }
    return data;
  }

  save() { localStorage.setItem('vaim_data', JSON.stringify(this.data)); }

  getStats(mode) { return this.data.stats[mode] || this.data.stats.gridshot; }

  recordGame(mode, score, hits, shots, headshots, streak, reactionTimes) {
    const s = this.getStats(mode);
    s.totalHits += hits;
    s.totalShots += shots;
    s.headshots += headshots;
    s.sessions++;
    if (streak > s.maxStreak) s.maxStreak = streak;
    if (score > s.highScore) s.highScore = score;
    if (reactionTimes && reactionTimes.length) {
      s.reactionTimes.push(...reactionTimes);
      if (s.reactionTimes.length > 1000) s.reactionTimes = s.reactionTimes.slice(-1000);
    }
    this.save();
    return score >= s.highScore && score > 0;
  }

  resetStats() {
    const s = this._defaults().stats;
    Object.keys(s).forEach(k => {
      this.data.stats[k] = s[k];
    });
    this.save();
  }

  getSettings() { return this.data.settings; }

  updateSetting(path, value) {
    const parts = path.split('.');
    let obj = this.data.settings;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    this.save();
  }

  resetCrosshair() {
    const defs = this._defaults().settings.crosshair;
    const ch = this.data.settings.crosshair;
    Object.keys(defs).forEach(k => { ch[k] = defs[k]; });
    this.save();
  }
}
