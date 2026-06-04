'use strict';

/**
 * Real Valorant weapon data — damage, fire rate, mag size, reload, spread, recoil.
 * Damage numbers: verified against VALORANT v10.x patch notes.
 * Recoil patterns: stylized approximations of real spray patterns.
 */

export const WEAPONS = {
  vandal: {
    id: 'vandal',
    name: 'Vandal',
    type: 'rifle',
    cost: 2900,
    damage: { head: 160, body: 40, leg: 34 },
    fireRate: 4.75,       // rounds/sec
    magSize: 25,
    reloadTime: 2.5,
    equipTime: 1.0,
    spread: { standing: 0.25, walking: 1.0, running: 1.8, crouching: 0.15 },
    firstShotInaccuracy: 0.25,
    wallPen: 'high',
    runSpeed: 5.4,
    ads: false,
    automatic: true,
    audio: { gain: 0.35, lowpass: 3200, noiseLen: 0.09, tail: 0.18 },
    // Vertical-heavy spray with late horizontal zigzag
    recoil: [
      { x: 0.0, y: 0.8 },   // 1
      { x: 0.0, y: 1.6 },   // 2
      { x: -0.1, y: 2.3 },  // 3
      { x: -0.2, y: 3.0 },  // 4
      { x: -0.1, y: 3.6 },  // 5
      { x: 0.2, y: 4.1 },   // 6
      { x: 0.6, y: 4.5 },   // 7
      { x: 1.0, y: 4.8 },   // 8
      { x: 1.2, y: 5.0 },   // 9
      { x: 1.0, y: 5.1 },   // 10
      { x: 0.4, y: 5.2 },   // 11
      { x: -0.4, y: 5.2 },  // 12
      { x: -1.0, y: 5.1 },  // 13
      { x: -1.4, y: 5.0 },  // 14
      { x: -1.2, y: 4.9 },  // 15
      { x: -0.8, y: 4.8 },  // 16
      { x: 0.0, y: 4.7 },   // 17
      { x: 0.8, y: 4.6 },   // 18
      { x: 1.4, y: 4.5 },   // 19
      { x: 1.8, y: 4.4 },   // 20
      { x: 1.4, y: 4.3 },   // 21
      { x: 0.6, y: 4.2 },   // 22
      { x: -0.4, y: 4.1 },  // 23
      { x: -1.4, y: 4.0 },  // 24
      { x: -2.0, y: 3.9 },  // 25
    ]
  },

  phantom: {
    id: 'phantom',
    name: 'Phantom',
    type: 'rifle',
    cost: 2900,
    damage: { head: 156, body: 39, leg: 33 },
    fireRate: 4.5,
    magSize: 30,
    reloadTime: 2.5,
    equipTime: 1.0,
    spread: { standing: 0.2, walking: 0.85, running: 1.5, crouching: 0.1 },
    firstShotInaccuracy: 0.2,
    wallPen: 'medium',
    runSpeed: 5.4,
    ads: false,
    automatic: true,
    audio: { gain: 0.3, lowpass: 3500, noiseLen: 0.08, tail: 0.15 },
    // More horizontal, less vertical than vandal
    recoil: [
      { x: 0.0, y: 0.6 },
      { x: 0.0, y: 1.2 },
      { x: 0.1, y: 1.7 },
      { x: 0.3, y: 2.2 },
      { x: 0.5, y: 2.6 },
      { x: 0.6, y: 2.9 },
      { x: 0.5, y: 3.1 },
      { x: 0.2, y: 3.2 },
      { x: -0.2, y: 3.3 },
      { x: -0.6, y: 3.3 },
      { x: -0.8, y: 3.2 },
      { x: -0.6, y: 3.1 },
      { x: -0.2, y: 3.0 },
      { x: 0.2, y: 2.9 },
      { x: 0.6, y: 2.8 },
      { x: 0.8, y: 2.7 },
      { x: 0.6, y: 2.6 },
      { x: 0.2, y: 2.5 },
      { x: -0.2, y: 2.4 },
      { x: -0.6, y: 2.4 },
      { x: -0.8, y: 2.3 },
      { x: -0.6, y: 2.2 },
      { x: -0.2, y: 2.1 },
      { x: 0.2, y: 2.0 },
      { x: 0.6, y: 1.9 },
      { x: 0.8, y: 1.8 },
      { x: 0.6, y: 1.7 },
      { x: 0.2, y: 1.6 },
      { x: -0.2, y: 1.5 },
      { x: -0.6, y: 1.4 },
    ]
  },

  sheriff: {
    id: 'sheriff',
    name: 'Sheriff',
    type: 'pistol',
    cost: 800,
    damage: { head: 145, body: 55, leg: 47 },
    fireRate: 4.0,
    magSize: 6,
    reloadTime: 2.5,
    equipTime: 0.75,
    spread: { standing: 0.5, walking: 1.5, running: 3.0, crouching: 0.4 },
    firstShotInaccuracy: 0.15,
    wallPen: 'medium',
    runSpeed: 5.8,
    ads: true,
    automatic: false,
    audio: { gain: 0.45, lowpass: 2800, noiseLen: 0.1, tail: 0.22 },
    // Big vertical kick per shot, reset between shots
    recoil: [
      { x: 0.0, y: 2.0 },
      { x: 0.2, y: 3.0 },
      { x: 0.4, y: 3.5 },
      { x: 0.3, y: 3.8 },
      { x: 0.0, y: 4.0 },
      { x: -0.3, y: 4.2 },
    ]
  },

  ghost: {
    id: 'ghost',
    name: 'Ghost',
    type: 'pistol',
    cost: 500,
    damage: { head: 105, body: 30, leg: 26 },
    fireRate: 6.5,
    magSize: 15,
    reloadTime: 2.5,
    equipTime: 0.75,
    spread: { standing: 0.4, walking: 1.2, running: 2.5, crouching: 0.3 },
    firstShotInaccuracy: 0.1,
    wallPen: 'low',
    runSpeed: 5.8,
    ads: true,
    automatic: false,
    audio: { gain: 0.2, lowpass: 4000, noiseLen: 0.06, tail: 0.1 },
    // Suppressed — low recoil
    recoil: [
      { x: 0.0, y: 0.6 },
      { x: 0.0, y: 1.0 },
      { x: 0.1, y: 1.3 },
      { x: 0.0, y: 1.5 },
      { x: -0.1, y: 1.6 },
      { x: 0.0, y: 1.7 },
      { x: 0.1, y: 1.7 },
      { x: 0.0, y: 1.8 },
      { x: -0.1, y: 1.8 },
      { x: 0.0, y: 1.8 },
      { x: 0.1, y: 1.9 },
      { x: 0.0, y: 1.9 },
      { x: -0.1, y: 1.9 },
      { x: 0.0, y: 2.0 },
      { x: 0.0, y: 2.0 },
    ]
  },

  spectre: {
    id: 'spectre',
    name: 'Spectre',
    type: 'smg',
    cost: 1600,
    damage: { head: 78, body: 26, leg: 22 },
    fireRate: 5.5,
    magSize: 30,
    reloadTime: 2.5,
    equipTime: 0.85,
    spread: { standing: 0.4, walking: 1.0, running: 2.0, crouching: 0.25 },
    firstShotInaccuracy: 0.3,
    wallPen: 'low',
    runSpeed: 5.8,
    ads: true,
    automatic: true,
    audio: { gain: 0.28, lowpass: 3600, noiseLen: 0.07, tail: 0.13 },
    // SMG — snappy, horizontal-swaying spray
    recoil: [
      { x: 0.0, y: 0.5 },
      { x: 0.0, y: 0.9 },
      { x: 0.2, y: 1.2 },
      { x: 0.4, y: 1.4 },
      { x: 0.3, y: 1.6 },
      { x: 0.0, y: 1.7 },
      { x: -0.3, y: 1.8 },
      { x: -0.5, y: 1.8 },
      { x: -0.4, y: 1.8 },
      { x: -0.1, y: 1.7 },
      { x: 0.2, y: 1.7 },
      { x: 0.5, y: 1.6 },
      { x: 0.6, y: 1.5 },
      { x: 0.4, y: 1.4 },
      { x: 0.1, y: 1.3 },
      { x: -0.2, y: 1.3 },
      { x: -0.5, y: 1.2 },
      { x: -0.6, y: 1.1 },
      { x: -0.4, y: 1.0 },
      { x: -0.1, y: 1.0 },
      { x: 0.2, y: 0.9 },
      { x: 0.5, y: 0.9 },
      { x: 0.6, y: 0.8 },
      { x: 0.4, y: 0.7 },
      { x: 0.1, y: 0.7 },
      { x: -0.2, y: 0.6 },
      { x: -0.5, y: 0.6 },
      { x: -0.6, y: 0.5 },
      { x: -0.4, y: 0.5 },
      { x: -0.1, y: 0.4 },
    ]
  },

  operator: {
    id: 'operator',
    name: 'Operator',
    type: 'sniper',
    cost: 4700,
    damage: { head: 255, body: 150, leg: 127 },
    fireRate: 0.6,
    magSize: 5,
    reloadTime: 3.5,
    equipTime: 1.5,
    spread: { standing: 0.0, walking: 1.5, running: 5.0, crouching: 0.0 },
    firstShotInaccuracy: 0.0,
    wallPen: 'high',
    runSpeed: 4.8,
    ads: true,
    automatic: false,
    audio: { gain: 0.55, lowpass: 2200, noiseLen: 0.15, tail: 0.35 },
    // Heavy kick, scope reset between shots
    recoil: [
      { x: 0.0, y: 4.0 },
      { x: 0.5, y: 5.0 },
      { x: 1.0, y: 5.5 },
      { x: 0.5, y: 6.0 },
      { x: -1.0, y: 6.5 },
    ]
  },

  judge: {
    id: 'judge',
    name: 'Judge',
    type: 'shotgun',
    cost: 1850,
    damage: { head: 38, body: 17, leg: 14 }, // per pellet, 12 pellets
    fireRate: 3.5,
    magSize: 5,
    reloadTime: 2.5,
    equipTime: 1.0,
    spread: { standing: 3.0, walking: 4.5, running: 6.0, crouching: 2.5 },
    firstShotInaccuracy: 2.0,
    wallPen: 'low',
    runSpeed: 5.4,
    ads: false,
    automatic: true,
    pellets: 12,
    audio: { gain: 0.5, lowpass: 2000, noiseLen: 0.14, tail: 0.3 },
    // Heavy, wide spread
    recoil: [
      { x: 0.0, y: 1.5 },
      { x: 0.3, y: 2.0 },
      { x: 0.5, y: 2.2 },
      { x: 0.3, y: 2.4 },
      { x: 0.0, y: 2.5 },
    ]
  },

  guardian: {
    id: 'guardian',
    name: 'Guardian',
    type: 'rifle',
    cost: 2250,
    damage: { head: 195, body: 65, leg: 55 },
    fireRate: 2.5,
    magSize: 12,
    reloadTime: 2.5,
    equipTime: 1.0,
    spread: { standing: 0.15, walking: 0.7, running: 1.4, crouching: 0.1 },
    firstShotInaccuracy: 0.1,
    wallPen: 'high',
    runSpeed: 5.4,
    ads: true,
    automatic: false,
    audio: { gain: 0.4, lowpass: 3000, noiseLen: 0.1, tail: 0.2 },
    // Semi-auto, heavy single kick, full reset between shots
    recoil: [
      { x: 0.0, y: 2.5 },
      { x: 0.2, y: 3.0 },
      { x: 0.4, y: 3.2 },
      { x: 0.5, y: 3.5 },
      { x: 0.4, y: 3.6 },
      { x: 0.2, y: 3.7 },
      { x: 0.0, y: 3.8 },
      { x: -0.2, y: 3.9 },
      { x: -0.4, y: 4.0 },
      { x: -0.5, y: 4.0 },
      { x: -0.4, y: 4.1 },
      { x: -0.2, y: 4.2 },
    ]
  }
};

export const WEAPON_LIST = Object.keys(WEAPONS);
export const DEFAULT_WEAPON = 'vandal';

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS[DEFAULT_WEAPON];
}

export function getWeaponDamage(weapon, hitType, distance = 30) {
  const dmg = weapon.damage;
  // Valorant has damage falloff ranges. Simplified: no falloff within 50m
  if (hitType === 'head') return dmg.head;
  if (hitType === 'leg') return dmg.leg;
  return dmg.body;
}

