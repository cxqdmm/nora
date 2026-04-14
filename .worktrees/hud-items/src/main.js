// ============================================================
//  main.js — Phaser 3 游戏入口
// ============================================================
import { CONFIG } from './config.js';
import { BootScene }  from './scenes/BootScene.js';
import { MenuScene }  from './scenes/MenuScene.js';
import { GameScene }  from './scenes/GameScene.js';
import { WinScene }   from './scenes/WinScene.js';
import { LoseScene }  from './scenes/LoseScene.js';

const gameConfig = {
  type: Phaser.AUTO,
  width:  CONFIG.CANVAS_WIDTH,
  height: CONFIG.CANVAS_HEIGHT,
  backgroundColor: '#b8e4a0',
  parent: 'game-container',
  scene: [BootScene, MenuScene, GameScene, WinScene, LoseScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(gameConfig);
