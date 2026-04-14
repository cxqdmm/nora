// ============================================================
//  LoseScene.js — 失败画面
// ============================================================
import { CONFIG } from '../config.js';

const W = CONFIG.CANVAS_WIDTH;
const H = CONFIG.CANVAS_HEIGHT;

export class LoseScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoseScene' });
  }

  init(data) {
    this._levelId = data?.levelId ?? 1;
  }

  create() {
    this._drawBackground();
    this._drawPanel();
    this._drawButtons();

    this.cameras.main.fadeIn(500, 20, 0, 0);
  }

  _drawBackground() {
    const gfx = this.add.graphics();
    gfx.fillGradientStyle(0x3a1a00, 0x3a1a00, 0x1a0a00, 0x1a0a00, 1);
    gfx.fillRect(0, 0, W, H);

    // 星星装饰（夜晚氛围）
    gfx.fillStyle(0xffffff, 1);
    for (let i = 0; i < 60; i++) {
      const sx   = Math.random() * W;
      const sy   = Math.random() * H * 0.6;
      const size = 0.5 + Math.random() * 1.5;
      gfx.fillCircle(sx, sy, size);
    }
  }

  _drawPanel() {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x1a0a00, 0.88);
    gfx.fillRoundedRect(W / 2 - 220, H / 2 - 175, 440, 320, 20);
    gfx.lineStyle(4, 0x8b3a00, 1);
    gfx.strokeRoundedRect(W / 2 - 220, H / 2 - 175, 440, 320, 20);

    // 哭脸
    this.add.text(W / 2, H / 2 - 135, '😢', {
      fontSize: '52px',
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 70, '能量耗尽了...', {
      fontSize: '32px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ff8a65',
      stroke: '#1a0a00',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 18, '毛毛虫太累啦，倒在了回家的路上...', {
      fontSize: '15px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ffccaa',
    }).setOrigin(0.5);

    const tips = [
      '💡 提示：先规划路线，尽量走最短路',
      '💡 提示：死路里的食物可以补能再回头',
      '💡 提示：能量低时优先寻找苹果 🍎',
    ];
    this.add.text(W / 2, H / 2 + 32, Phaser.Utils.Array.GetRandom(tips), {
      fontSize: '13px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#aaaaaa',
    }).setOrigin(0.5);
  }

  _drawButtons() {
    const buttons = [
      {
        label: '再试一次',
        x: W / 2 - 110,
        color: 0xbf360c,
        action: () => this.scene.start('GameScene', { levelId: this._levelId }),
      },
      {
        label: '选关',
        x: W / 2 + 110,
        color: 0x4a5568,
        action: () => this.scene.start('MenuScene'),
      },
    ];

    for (const btn of buttons) {
      const gfx = this.add.graphics();
      gfx.fillStyle(btn.color, 1);
      gfx.fillRoundedRect(btn.x - 90, H / 2 + 100, 180, 50, 12);
      gfx.lineStyle(2, 0xffffff, 0.5);
      gfx.strokeRoundedRect(btn.x - 90, H / 2 + 100, 180, 50, 12);

      const t = this.add.text(btn.x, H / 2 + 125, btn.label, {
        fontSize: '20px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#ffffff',
      }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

      t.on('pointerover', () => {
        gfx.clear();
        gfx.fillStyle(btn.color, 0.75);
        gfx.fillRoundedRect(btn.x - 90, H / 2 + 100, 180, 50, 12);
      });
      t.on('pointerout', () => {
        gfx.clear();
        gfx.fillStyle(btn.color, 1);
        gfx.fillRoundedRect(btn.x - 90, H / 2 + 100, 180, 50, 12);
        gfx.lineStyle(2, 0xffffff, 0.5);
        gfx.strokeRoundedRect(btn.x - 90, H / 2 + 100, 180, 50, 12);
      });
      t.on('pointerdown', () => {
        this.cameras.main.once('camerafadeoutcomplete', () => btn.action());
        this.cameras.main.fadeOut(300, 0, 0, 0);
      });
    }
  }
}
