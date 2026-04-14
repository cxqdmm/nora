// ============================================================
//  MenuScene.js — 标题 + 关卡选择
// ============================================================
import { CONFIG } from '../config.js';

const W = CONFIG.CANVAS_WIDTH;
const H = CONFIG.CANVAS_HEIGHT;

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    this._drawBackground();
    this._drawTitle();
    this._drawLevelButtons();
    this._drawDecorations();
  }

  _drawBackground() {
    const gfx = this.add.graphics();
    gfx.fillGradientStyle(
      CONFIG.COLORS.BG_TOP,    CONFIG.COLORS.BG_TOP,
      CONFIG.COLORS.BG_BOTTOM, CONFIG.COLORS.BG_BOTTOM, 1
    );
    gfx.fillRect(0, 0, W, H);

    // 底部草地
    gfx.fillStyle(0x3d8c28, 0.7);
    for (let i = 0; i < 25; i++) {
      const bx = 15 + i * 32;
      gfx.fillTriangle(bx, H, bx - 10, H - 28, bx + 10, H - 28);
    }
  }

  _drawTitle() {
    // 标题背景木牌
    const gfx = this.add.graphics();
    gfx.fillStyle(0x8B5E1A, 1);
    gfx.fillRoundedRect(W / 2 - 210, 60, 420, 130, 18);
    gfx.lineStyle(5, 0x5a3a0a, 1);
    gfx.strokeRoundedRect(W / 2 - 210, 60, 420, 130, 18);
    // 木纹装饰线
    gfx.lineStyle(1, 0x5a3a0a, 0.3);
    for (let i = 0; i < 6; i++) {
      gfx.beginPath();
      gfx.moveTo(W / 2 - 205, 75 + i * 18);
      gfx.lineTo(W / 2 + 205, 75 + i * 18);
      gfx.strokePath();
    }

    this.add.text(W / 2, 100, '🐛 毛毛虫找家', {
      fontSize: '42px',
      fontFamily: 'Microsoft YaHei, "PingFang SC", sans-serif',
      color: '#fff8dc',
      stroke: '#5a3a0a',
      strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(W / 2, 152, '帮助迷路的小毛毛虫找到回家的路！', {
      fontSize: '16px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ffe0a0',
      stroke: '#3a2000',
      strokeThickness: 3,
    }).setOrigin(0.5);
  }

  _drawLevelButtons() {
    const levels = [
      { id: 1, label: '第一关', sub: '迷失的早晨',  diff: '简单 ⭐',     color: 0x56ab2f },
      { id: 2, label: '第二关', sub: '迷雾的森林',  diff: '中等 ⭐⭐',   color: 0xf7971e },
      { id: 3, label: '第三关', sub: '深夜的归途',  diff: '困难 ⭐⭐⭐', color: 0xc0392b },
    ];

    levels.forEach((lv, i) => {
      const bx = W / 2 + (i - 1) * 210;
      const by = 310;

      // 按钮背景
      const gfx = this.add.graphics();
      gfx.fillStyle(lv.color, 1);
      gfx.fillRoundedRect(bx - 85, by - 55, 170, 120, 14);
      gfx.lineStyle(3, 0xffffff, 0.6);
      gfx.strokeRoundedRect(bx - 85, by - 55, 170, 120, 14);

      // 按钮文字
      this.add.text(bx, by - 22, lv.label, {
        fontSize: '22px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#ffffff',
        stroke: '#00000066',
        strokeThickness: 3,
      }).setOrigin(0.5);

      this.add.text(bx, by + 8, lv.sub, {
        fontSize: '13px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#ffffffcc',
      }).setOrigin(0.5);

      this.add.text(bx, by + 32, lv.diff, {
        fontSize: '13px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#fff9c4',
      }).setOrigin(0.5);

      // 交互热区
      const zone = this.add.zone(bx, by, 170, 120).setInteractive({ cursor: 'pointer' });

      zone.on('pointerover', () => {
        gfx.clear();
        gfx.fillStyle(Phaser.Display.Color.ValueToColor(lv.color).brighten(20).color, 1);
        gfx.fillRoundedRect(bx - 85, by - 55, 170, 120, 14);
        gfx.lineStyle(3, 0xffffff, 1);
        gfx.strokeRoundedRect(bx - 85, by - 55, 170, 120, 14);
        this.tweens.add({ targets: gfx, scaleX: 1.03, scaleY: 1.03, duration: 100 });
      });

      zone.on('pointerout', () => {
        this.tweens.add({ targets: gfx, scaleX: 1, scaleY: 1, duration: 100 });
        gfx.clear();
        gfx.fillStyle(lv.color, 1);
        gfx.fillRoundedRect(bx - 85, by - 55, 170, 120, 14);
        gfx.lineStyle(3, 0xffffff, 0.6);
        gfx.strokeRoundedRect(bx - 85, by - 55, 170, 120, 14);
      });

      zone.on('pointerdown', () => {
        // 用 event 监听代替 t===1 浮点比较，更可靠
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('GameScene', { levelId: lv.id });
        });
        this.cameras.main.fadeOut(300, 0, 0, 0);
      });
    });
  }

  _drawDecorations() {
    // 玩法说明
    const gfx = this.add.graphics();
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillRoundedRect(W / 2 - 280, 455, 560, 105, 12);

    const tips = [
      '🍎 吃食物可以补充能量，不同食物能量不同',
      '🌿 沿树枝爬行寻找回家的路，注意有死路！',
      '⚡ 能量耗尽则游戏失败，合理规划路线',
    ];
    tips.forEach((tip, i) => {
      this.add.text(W / 2, 472 + i * 28, tip, {
        fontSize: '14px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#e8f5e9',
        stroke: '#1b3a0a',
        strokeThickness: 2,
      }).setOrigin(0.5);
    });

    // 底部版本信息
    this.add.text(W - 10, H - 10, 'v1.0', {
      fontSize: '11px',
      color: '#ffffff44',
    }).setOrigin(1, 1);

    // 漂浮的小毛毛虫装饰
    this._drawDecoCaterpillar(120, 240);
    this._drawDecoCaterpillar(680, 220);
  }

  _drawDecoCaterpillar(x, y) {
    const gfx = this.add.graphics();
    // 简单3节毛毛虫
    const colors = [0x4e8b2e, 0x72b83e, 0x72b83e];
    const sizes  = [12, 9, 8];
    for (let i = 2; i >= 0; i--) {
      gfx.fillStyle(colors[i], 1);
      gfx.fillCircle(x - i * 16, y, sizes[i]);
    }
    // 眼睛
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(x + 6, y - 4, 3);
    gfx.fillStyle(0x000000, 1);
    gfx.fillCircle(x + 7, y - 3, 1.5);

    // 小触角
    gfx.lineStyle(1.5, 0x2d5018, 1);
    gfx.beginPath();
    gfx.moveTo(x + 2, y - 12);
    gfx.lineTo(x - 2, y - 20);
    gfx.strokePath();
    gfx.beginPath();
    gfx.moveTo(x + 8, y - 12);
    gfx.lineTo(x + 12, y - 20);
    gfx.strokePath();

    // 晃动动画
    this.tweens.add({
      targets: gfx,
      y: '-=10',
      duration: 1500 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
