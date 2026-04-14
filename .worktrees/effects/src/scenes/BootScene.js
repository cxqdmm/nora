// ============================================================
//  BootScene.js — 预加载（无外部资源，仅生成程序纹理）
// ============================================================

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // 无外部资源需要加载，生成一个 loading 文字即可
    this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      '🐛 加载中...', {
        fontSize: '28px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#4a7a2e',
        stroke: '#ffffff',
        strokeThickness: 4,
      }
    ).setOrigin(0.5);
  }

  create() {
    // 跳转菜单
    this.scene.start('MenuScene');
  }
}
