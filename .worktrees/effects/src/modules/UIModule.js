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
    /** 道具 HUD */
    this._itemGfx = null;
    this._itemIcons = [];
    this._itemContainer = null;
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

    this._createItemHUD();
    this._updateBar();
  }

  // ── 每帧更新 ──────────────────────────────────────────────
  update() {
    this._updateBar();
  }

  // ── 道具 HUD（左侧常驻）────────────────────────────────
  _createItemHUD() {
    const X = 18;
    const Y = 72;
    const CELL = 42;
    const GAP  = 6;

    this._itemContainer = this.scene.add.container(X, Y).setDepth(90);
    this._itemIcons = [];
  }

  /**
   * 刷新道具 HUD（从外部调用，GameScene 在道具变化时调用）
   * @param {import('./ItemModule').ItemModule} itemModule
   */
  refreshItemHUD(itemModule) {
    if (!this._itemContainer) return;
    this._itemContainer.removeAll(true);
    this._itemIcons = [];

    const CELL = 42;
    const GAP  = 6;

    const hasKnife  = itemModule.hasItem('knife');
    const hasPotion = itemModule.hasItem('potion');

    if (!hasKnife && !hasPotion) return;

    // 半透明背景
    const bg = this.scene.add.graphics().setDepth(89);
    const rowCount = (hasKnife ? 1 : 0) + (hasPotion ? 1 : 0);
    bg.fillStyle(0x000000, 0.4);
    bg.fillRoundedRect(-4, -4, CELL + 8, CELL * rowCount + GAP + 8, 10);
    this._itemContainer.add(bg);

    let cy = 0;
    if (hasKnife) {
      const count = itemModule.getCount('knife');
      this._addItemCell(0, cy, '🗡️', count, CELL);
      cy += CELL + GAP;
    }
    if (hasPotion) {
      const count = itemModule.getCount('potion');
      this._addItemCell(0, cy, '💤', count, CELL);
    }
  }

  _addItemCell(x, y, emoji, count, cellSize) {
    const gfx = this.scene.add.graphics().setDepth(90);
    gfx.fillStyle(0x2d1a00, 0.85);
    gfx.fillRoundedRect(x, y, cellSize, cellSize, 8);
    gfx.lineStyle(1.5, 0x6dcf5a, 0.6);
    gfx.strokeRoundedRect(x, y, cellSize, cellSize, 8);

    const icon = this.scene.add.text(x + cellSize / 2, y + cellSize / 2, emoji, {
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(91);

    this._itemContainer.add([gfx, icon]);
    this._itemIcons.push({ type: emoji === '🗡️' ? 'knife' : 'potion', gfx, icon });

    if (count > 1) {
      const badge = this.scene.add.graphics().setDepth(92);
      badge.fillStyle(0xff9800, 1);
      badge.fillCircle(x + cellSize, y, 9);
      const badgeText = this.scene.add.text(x + cellSize, y, String(count), {
        fontSize: '10px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(93);
      this._itemContainer.add([badge, badgeText]);
    }
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
