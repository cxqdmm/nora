// ============================================================
//  WinScene.js — 胜利结算画面
// ============================================================
import { CONFIG } from '../config.js';

const W = CONFIG.CANVAS_WIDTH;
const H = CONFIG.CANVAS_HEIGHT;

export class WinScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WinScene' });
  }

  init(data) {
    this._levelId    = data?.levelId    ?? 1;
    this._energyLeft = data?.energyLeft ?? 0;
  }

  create() {
    this._drawBackground();
    this._drawPanel();
    this._drawButtons();
    this._startConfetti();

    this.cameras.main.fadeIn(500, 255, 255, 200);
  }

  _drawBackground() {
    const gfx = this.add.graphics();
    gfx.fillGradientStyle(0xd4f0c0, 0xd4f0c0, 0x7dbf58, 0x7dbf58, 1);
    gfx.fillRect(0, 0, W, H);
  }

  _drawPanel() {
    const gfx = this.add.graphics();
    // 面板
    gfx.fillStyle(0x2d5a1b, 0.85);
    gfx.fillRoundedRect(W / 2 - 220, H / 2 - 175, 440, 330, 20);
    gfx.lineStyle(4, 0x9cdf5a, 1);
    gfx.strokeRoundedRect(W / 2 - 220, H / 2 - 175, 440, 330, 20);

    // 标题
    this.add.text(W / 2, H / 2 - 130, '🎉 找到家啦！', {
      fontSize: '40px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ffee58',
      stroke: '#2d5a1b',
      strokeThickness: 5,
    }).setOrigin(0.5);

    // 关卡
    this.add.text(W / 2, H / 2 - 70, `第 ${this._levelId} 关 通关！`, {
      fontSize: '22px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#c8f0a0',
    }).setOrigin(0.5);

    // 剩余能量
    const ratio = this._energyLeft / (this._levelId === 3 ? 105 : 120);
    const stars  = ratio > 0.5 ? '⭐⭐⭐' : ratio > 0.25 ? '⭐⭐' : '⭐';

    this.add.text(W / 2, H / 2 - 20, `剩余能量：${this._energyLeft}  ${stars}`, {
      fontSize: '20px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#fff9c4',
    }).setOrigin(0.5);

    const praise = ratio > 0.5
      ? '太厉害了！路线完美！'
      : ratio > 0.25
        ? '不错哦，还有改进空间~'
        : '险险过关！再练练？';

    this.add.text(W / 2, H / 2 + 20, praise, {
      fontSize: '16px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#a5d6a7',
    }).setOrigin(0.5);
  }

  _drawButtons() {
    const buttons = [
      { label: '再玩一次',   x: W / 2 - 110, color: 0x43a047, action: () => this.scene.start('GameScene', { levelId: this._levelId }) },
      { label: '选关',       x: W / 2 + 110, color: 0x1976d2, action: () => this.scene.start('MenuScene') },
    ];

    // 下一关（如果有）
    if (this._levelId < 3) {
      buttons[0].label = '下一关';
      buttons[0].action = () => this.scene.start('GameScene', { levelId: this._levelId + 1 });
    }

    for (const btn of buttons) {
      const gfx = this.add.graphics();
      gfx.fillStyle(btn.color, 1);
      gfx.fillRoundedRect(btn.x - 90, H / 2 + 90, 180, 50, 12);
      gfx.lineStyle(2, 0xffffff, 0.7);
      gfx.strokeRoundedRect(btn.x - 90, H / 2 + 90, 180, 50, 12);

      const t = this.add.text(btn.x, H / 2 + 115, btn.label, {
        fontSize: '20px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#ffffff',
        stroke: '#00000055',
        strokeThickness: 3,
      }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

      t.on('pointerover', () => {
        gfx.clear();
        gfx.fillStyle(btn.color, 0.8);
        gfx.fillRoundedRect(btn.x - 90, H / 2 + 90, 180, 50, 12);
        this.tweens.add({ targets: gfx, scaleX: 1.04, scaleY: 1.04, duration: 80 });
      });
      t.on('pointerout', () => {
        this.tweens.add({ targets: gfx, scaleX: 1, scaleY: 1, duration: 80 });
        gfx.clear();
        gfx.fillStyle(btn.color, 1);
        gfx.fillRoundedRect(btn.x - 90, H / 2 + 90, 180, 50, 12);
        gfx.lineStyle(2, 0xffffff, 0.7);
        gfx.strokeRoundedRect(btn.x - 90, H / 2 + 90, 180, 50, 12);
      });
      t.on('pointerdown', () => {
        this.cameras.main.once('camerafadeoutcomplete', () => btn.action());
        this.cameras.main.fadeOut(300, 0, 0, 0);
      });
    }
  }

  _startConfetti() {
    const colors = [0xffdd00, 0xff6688, 0x66ff99, 0x66ccff, 0xff9944, 0xcc66ff];
    for (let i = 0; i < 40; i++) {
      this.time.delayedCall(i * 80, () => {
        const gfx = this.add.graphics();
        const color = Phaser.Utils.Array.GetRandom(colors);
        gfx.fillStyle(color, 1);
        const sx = Math.random() * W;
        gfx.fillRect(sx, -10, 8, 12);
        this.tweens.add({
          targets: gfx,
          x: sx + (Math.random() - 0.5) * 150,
          y: H + 20,
          angle: 360 * (Math.random() > 0.5 ? 1 : -1),
          duration: 2000 + Math.random() * 1500,
          ease: 'Linear',
          onComplete: () => gfx.destroy(),
        });
      });
    }
  }
}
