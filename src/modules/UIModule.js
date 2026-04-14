// ============================================================
//  UIModule.js — HUD：能量条、提示文字、关卡信息
// ============================================================
import { CONFIG } from '../config.js';

const U  = CONFIG.UI;
const CC = CONFIG.COLORS;

export class UIModule {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('./EnergyModule').EnergyModule} energyModule
   */
  constructor(scene, energyModule) {
    this.scene        = scene;
    this.energyModule = energyModule;

    this._barBg   = null;
    this._barFill = null;
    this._barText = null;
    this._levelText = null;
    this._hintText  = null;
    this._hintTimer = null;
    this._container = null;
  }

  // ── 创建 HUD ─────────────────────────────────────────────
  create(levelData) {
    // 固定在摄像机视口（setScrollFactor(0) 使 UI 不随摄像机移动）
    const depth = 100;

    // 能量条背景面板
    const panel = this.scene.add.graphics().setScrollFactor(0).setDepth(depth);
    panel.fillStyle(0x000000, 0.45);
    panel.fillRoundedRect(U.BAR_X - 8, U.BAR_Y - 8, U.BAR_W + 16, U.BAR_H + 36, 10);

    // 能量图标 🐛
    this.scene.add.text(U.BAR_X, U.BAR_Y - 2, '⚡ 能量', {
      fontSize: '13px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ddffcc',
    }).setScrollFactor(0).setDepth(depth + 1);

    // 能量条 bg
    this._barBg = this.scene.add.graphics().setScrollFactor(0).setDepth(depth + 1);
    this._barBg.fillStyle(U.BAR_COLOR_BG, 1);
    this._barBg.fillRoundedRect(U.BAR_X, U.BAR_Y + 16, U.BAR_W, U.BAR_H, 6);

    // 能量条 fill（实时更新）
    this._barFill = this.scene.add.graphics().setScrollFactor(0).setDepth(depth + 2);

    // 能量数字
    this._barText = this.scene.add.text(
      U.BAR_X + U.BAR_W / 2,
      U.BAR_Y + 16 + U.BAR_H / 2,
      '', {
        fontSize: '12px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#ffffff',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 3);

    // 关卡信息（右上角）
    this._levelText = this.scene.add.text(
      CONFIG.CANVAS_WIDTH - 16, 16,
      `第 ${levelData.id} 关  ${levelData.name}\n难度：${levelData.difficulty}`, {
        fontSize: '13px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#e8f5e9',
        align: 'right',
        stroke: '#1b3a0a',
        strokeThickness: 3,
      }
    ).setOrigin(1, 0).setScrollFactor(0).setDepth(depth);

    // 提示文字（居中底部）
    this._hintText = this.scene.add.text(
      CONFIG.CANVAS_WIDTH / 2,
      CONFIG.CANVAS_HEIGHT - 28,
      '', {
        fontSize: '15px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#fffde7',
        stroke: '#3e2000',
        strokeThickness: 3,
        backgroundColor: '#00000066',
        padding: { x: 12, y: 6 },
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 5).setAlpha(0);

    this._updateBar();
  }

  // ── 每帧更新 ──────────────────────────────────────────────
  update() {
    this._updateBar();
  }

  _updateBar() {
    if (!this._barFill) return;
    const ratio = this.energyModule.getRatio();
    const energy = Math.ceil(this.energyModule.getEnergy());
    const fillW  = Math.max(0, U.BAR_W * ratio);
    const color  = ratio < U.LOW_THRESHOLD ? U.BAR_COLOR_LOW : U.BAR_COLOR_FILL;

    this._barFill.clear();
    this._barFill.fillStyle(color, 1);
    if (fillW > 0) {
      this._barFill.fillRoundedRect(U.BAR_X, U.BAR_Y + 16, fillW, U.BAR_H, 6);
    }

    this._barText.setText(`${energy} / ${this.energyModule.getMax()}`);

    // 能量低于 25% 时条条闪烁
    if (ratio < U.LOW_THRESHOLD && !this._lowPulse) {
      this._lowPulse = this.scene.tweens.add({
        targets: this._barFill,
        alpha: { from: 1, to: 0.3 },
        duration: 350,
        yoyo: true,
        repeat: -1,
      });
      this.showMessage('⚠️ 能量不足，快找食物！', 2000);
    } else if (ratio >= U.LOW_THRESHOLD && this._lowPulse) {
      this._lowPulse.stop();
      this._lowPulse = null;
      this._barFill.alpha = 1;
    }
  }

  // ── 显示提示 ──────────────────────────────────────────────
  showMessage(text, duration = 2500) {
    if (!this._hintText) return;
    if (this._hintTimer) {
      this._hintTimer.remove();
      this._hintTimer = null;
    }
    this.scene.tweens.killTweensOf(this._hintText);
    this._hintText.setText(text).setAlpha(1);

    this._hintTimer = this.scene.time.delayedCall(duration, () => {
      this.scene.tweens.add({
        targets: this._hintText,
        alpha: 0,
        duration: 400,
      });
    });
  }

  // ── 显示食物收集浮动文字 ──────────────────────────────────
  showFoodPickup(x, y, text) {
    const t = this.scene.add.text(x, y - 20, text, {
      fontSize: '18px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ffff66',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200);

    this.scene.tweens.add({
      targets: t,
      y: y - 70,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  destroy() {
    this._hintTimer?.remove();
    this._lowPulse?.stop();
  }
}
