'use strict';

import { Game } from './game.js';

document.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.init();
  window.__game = game;
});
