// ============================================================
//  FoodModule.js — 食物生成、显示、拾取
// ============================================================
import { CONFIG } from '../config.js';

export class FoodModule {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('./MapModule').MapModule} mapModule
   */
  constructor(scene, mapModule) {
    this.scene     = scene;
    this.mapModule = mapModule;
    /** nodeId → { type, gfx, energyValue } */
    this._foods = new Map();
  }

  // ── 创建 ─────────────────────────────────────────────────
  create(levelData) {
    for (const foodDef of levelData.food) {
      const node = this.mapModule.getNode(foodDef.nodeId);
      if (!node) continue;
      const energyValue = CONFIG.ENERGY.FOOD[foodDef.type] ?? 10;
      const gfx = this._drawFood(foodDef.type, node.x, node.y - 28);
      this._foods.set(foodDef.nodeId, {
        type: foodDef.type,
        energyValue,
        gfx,
      });
    }
  }

  // ── 检查拾取 ──────────────────────────────────────────────
  /**
   * 到达节点时调用；若有食物则消耗并返回能量值，否则返回 0
   * @param {number} nodeId
   * @returns {number}  恢复的能量值
   */
  checkPickup(nodeId) {
    const food = this._foods.get(nodeId);
    if (!food) return 0;

    // 播放收集动画后销毁
    this._playPickupAnim(food.gfx);
    this._foods.delete(nodeId);
    return food.energyValue;
  }

  getFoodAt(nodeId) {
    return this._foods.get(nodeId) ?? null;
  }

  // ── 绘制各类食物 ──────────────────────────────────────────
  _drawFood(type, x, y) {
    const gfx = this.scene.add.graphics();
    switch (type) {
      case 'leaf':  this._drawLeaf(gfx, x, y);  break;
      case 'berry': this._drawBerry(gfx, x, y); break;
      case 'apple': this._drawApple(gfx, x, y); break;
      default:      this._drawLeaf(gfx, x, y);
    }
    // 轻微上下漂浮动画（用相对位移，避免绝对坐标错误）
    this.scene.tweens.add({
      targets: gfx,
      y: '-=6',
      duration: 1200 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return gfx;
  }

  _drawLeaf(gfx, x, y) {
    // 叶片：绿色椭圆 + 茎
    gfx.lineStyle(1.5, 0x2e7d32, 1);
    gfx.fillStyle(0x66bb6a, 1);
    gfx.fillEllipse(x, y, 22, 14);
    gfx.strokeEllipse(x, y, 22, 14);
    // 叶脉
    gfx.lineStyle(1, 0x388e3c, 0.7);
    gfx.beginPath();
    gfx.moveTo(x - 10, y);
    gfx.lineTo(x + 10, y);
    gfx.strokePath();
    // 茎
    gfx.lineStyle(2, 0x2e7d32, 1);
    gfx.beginPath();
    gfx.moveTo(x, y + 7);
    gfx.lineTo(x + 3, y + 14);
    gfx.strokePath();
    // 能量标签
    this._addEnergyLabel(gfx, x, y - 16, '+15', '#66ff66');
  }

  _drawBerry(gfx, x, y) {
    // 浆果：3 颗红色小圆
    const positions = [{ dx: -7, dy: 0 }, { dx: 7, dy: 0 }, { dx: 0, dy: -8 }];
    gfx.fillStyle(0xe53935, 1);
    gfx.lineStyle(1, 0xb71c1c, 1);
    for (const p of positions) {
      gfx.fillCircle(x + p.dx, y + p.dy, 6);
      gfx.strokeCircle(x + p.dx, y + p.dy, 6);
    }
    // 高光
    gfx.fillStyle(0xffffff, 0.5);
    for (const p of positions) {
      gfx.fillCircle(x + p.dx - 2, y + p.dy - 2, 2);
    }
    // 枝梗
    gfx.lineStyle(1.5, 0x4e342e, 1);
    gfx.beginPath();
    gfx.moveTo(x, y - 8);
    gfx.lineTo(x, y + 8);
    gfx.strokePath();
    this._addEnergyLabel(gfx, x, y - 22, '+30', '#ff9999');
  }

  _drawApple(gfx, x, y) {
    // 苹果：红色圆 + 茎 + 小叶
    gfx.fillStyle(0xef5350, 1);
    gfx.lineStyle(2, 0xc62828, 1);
    gfx.fillCircle(x, y + 2, 12);
    gfx.strokeCircle(x, y + 2, 12);
    // 顶部凹陷
    gfx.fillStyle(0xc62828, 1);
    gfx.fillCircle(x, y - 8, 3);
    // 茎
    gfx.lineStyle(2, 0x4e342e, 1);
    gfx.beginPath();
    gfx.moveTo(x, y - 10);
    gfx.lineTo(x + 2, y - 18);
    gfx.strokePath();
    // 小叶子
    gfx.fillStyle(0x43a047, 1);
    gfx.fillEllipse(x + 8, y - 17, 12, 7);
    // 高光
    gfx.fillStyle(0xffffff, 0.45);
    gfx.fillEllipse(x - 4, y - 2, 6, 9);
    this._addEnergyLabel(gfx, x, y - 30, '+50', '#ffdd44');
  }

  _addEnergyLabel(gfx, x, y, text, color) {
    const label = this.scene.add.text(x, y, text, {
      fontSize: '11px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    // 把 text 附加到 gfx 的父对象里一起销毁（通过 tween 的 targets）
    gfx._energyLabel = label;
  }

  _playPickupAnim(gfx) {
    // 向上飘散消失
    this.scene.tweens.killTweensOf(gfx);
    if (gfx._energyLabel) this.scene.tweens.killTweensOf(gfx._energyLabel);

    this.scene.tweens.add({
      targets: [gfx, gfx._energyLabel].filter(Boolean),
      y: '-=40',
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 500,
      ease: 'Power2',
      onComplete: () => {
        gfx._energyLabel?.destroy();
        gfx.destroy();
      },
    });
  }

  destroy() {
    for (const { gfx } of this._foods.values()) {
      gfx._energyLabel?.destroy();
      gfx.destroy();
    }
    this._foods.clear();
  }
}
