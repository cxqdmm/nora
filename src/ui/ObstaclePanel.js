// ============================================================
//  ObstaclePanel.js — 道具选择面板
// ============================================================
import { CONFIG } from '../config.js';

export class ObstaclePanel {
  constructor(scene, itemModule, npc, { onKnife, onPotion, onSneak }) {
    this.scene      = scene;
    this.itemModule = itemModule;
    this.npc        = npc;
    this.onKnife    = onKnife;
    this.onPotion   = onPotion;
    this.onSneak    = onSneak;
    this._container = null;
    this._visible   = false;
  }

  show() {
    if (this._visible) return;
    this._visible = true;

    const W = CONFIG.CANVAS_WIDTH;
    const H = CONFIG.CANVAS_HEIGHT;
    const depth = 300;

    // 半透明遮罩
    const overlay = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55)
      .setDepth(depth).setInteractive();

    // 面板
    const panelW = 320, panelH = 240;
    const panel  = this.scene.add.container(W / 2, H / 2).setDepth(depth + 1);
    const gfx    = this.scene.add.graphics().setDepth(depth + 2);

    // 面板背景
    gfx.fillStyle(0x1b2a1b, 0.95);
    gfx.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);
    gfx.lineStyle(3, 0x6dcf5a, 1);
    gfx.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 16);

    // 标题
    const title = this.scene.add.text(0, -panelH / 2 + 24, '\u{1F438} \u9752\u86DE\u6321\u4F4F\u4E86\u53BB\u8DEF\uFF01', {
      fontSize: '18px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ff6b6b', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(depth + 3);

    // 道具行
    const hasKnife  = this.itemModule.hasItem('knife');
    const hasPotion = this.itemModule.hasItem('potion');
    const sneakCost = CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;

    const knifeParts  = this._makeItemBtn(-75,  20, '\u{1F5E1} \u5C0F\u5200',     hasKnife,  depth + 3, () => this._handleKnife());
    const potionParts = this._makeItemBtn(  0,  20, '\u{1F4A4} \u811A\u7720\u836F',   hasPotion, depth + 3, () => this._handlePotion());
    const sneakParts  = this._makeSneakBtn(75,  20, sneakCost,      depth + 3, () => this._handleSneak());

    panel.add([gfx, title, ...knifeParts, ...potionParts, ...sneakParts]);
    this._container = { overlay, panel };
  }

  _makeItemBtn(x, y, label, enabled, depth, onClick) {
    const color = enabled ? 0x4caf50 : 0x555555;
    const alpha = enabled ? 1.0     : 0.45;
    const gfx   = this.scene.add.graphics().setDepth(depth);
    gfx.fillStyle(color, alpha);
    gfx.fillRoundedRect(x - 55, y - 22, 110, 48, 10);
    if (enabled) {
      gfx.lineStyle(2, 0xffff88, 0.7);
      gfx.strokeRoundedRect(x - 55, y - 22, 110, 48, 10);
    }
    const text = this.scene.add.text(x, y, label, {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: enabled ? '#ffffff' : '#aaaaaa', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(depth + 1);
    const hitArea = this.scene.add.rectangle(x, y, 110, 48)
      .setFill(0x000000, 0).setDepth(depth + 2)
      .setInteractive({ cursor: enabled ? 'pointer' : 'not-allowed' });
    if (enabled) hitArea.on('pointerdown', onClick);
    return [gfx, text, hitArea];
  }

  _makeSneakBtn(x, y, cost, depth, onClick) {
    const gfx   = this.scene.add.graphics().setDepth(depth);
    gfx.fillStyle(0xff9800, 0.9);
    gfx.fillRoundedRect(x - 65, y - 22, 130, 48, 10);
    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.strokeRoundedRect(x - 65, y - 22, 130, 48, 10);
    const text = this.scene.add.text(x, y, `\u{1F92B} \u5077\u5077\u6E9C \u26A1${cost}`, {
      fontSize: '14px', fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ffffff', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(depth + 1);
    const hitArea = this.scene.add.rectangle(x, y, 130, 48)
      .setFill(0x000000, 0).setDepth(depth + 2)
      .setInteractive({ cursor: 'pointer' });
    hitArea.on('pointerdown', onClick);
    return [gfx, text, hitArea];
  }

  _handleKnife() {
    if (!this.itemModule.hasItem('knife')) return;
    this.itemModule.removeItem('knife');
    this._close();
    this.onKnife?.();
  }

  _handlePotion() {
    if (!this.itemModule.hasItem('potion')) return;
    this.itemModule.removeItem('potion');
    this._close();
    this.onPotion?.();
  }

  _handleSneak() {
    this._close();
    this.onSneak?.();
  }

  _close() {
    if (!this._visible) return;
    this._visible = false;
    if (this._container) {
      this._container.overlay.destroy();
      this._container.panel.destroy();
    }
    this._container = null;
  }

  isVisible() { return this._visible; }

  destroy() { this._close(); }
}
