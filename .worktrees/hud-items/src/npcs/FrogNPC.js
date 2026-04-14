// ============================================================
//  FrogNPC.js — 青蛙 NPC
// ============================================================
import { NPCModule } from './NPCModule.js';
import { CONFIG }    from '../config.js';

export class FrogNPC extends NPCModule {
  constructor(opts) {
    super(opts);
    this._sleepDuration   = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
    this._countdownGfx    = null;
    this._countdownText   = null;
    this._countdownInterval = null;
    this._map = null;
    this._scene = null;
  }

  bindGraphics(gfx, scene) {
    this._gfx = gfx;
    this._scene = scene;
    this._render();
  }

  _setGfxPosition(x, y) {
    this._gfx.setPosition(x, y);
    this._gfx.setScale(1, 1);
    this._gfx.setAlpha(1);
  }

  _render() {
    if (!this._gfx) return;
    this._gfx.clear();
    this._killCountdown();

    const nodeA = this._map?.getNode(this.edgeA);
    const nodeB = this._map?.getNode(this.edgeB);
    if (!nodeA || !nodeB) return;

    const mx = (nodeA.x + nodeB.x) / 2;
    const my = (nodeA.y + nodeB.y) / 2;

    if (this._state === 'dead') {
      return;
    }

    if (this._state === 'idle') {
      this._drawFrog(mx, my, 0.6, 0x4caf50);
      this._setGfxPosition(mx, my);
    } else if (this._state === 'active') {
      this._drawFrog(mx, my, 1.0, 0xf44336);
      this._gfx.lineStyle(2, 0xff0000, 0.5);
      this._gfx.strokeCircle(mx, my, 22);
      this._setGfxPosition(mx, my);
      if (this._scene) {
        // 扑出缩放动画
        this._scene.tweens.add({
          targets: this._gfx,
          scaleX: { from: 1.3, to: 1 },
          scaleY: { from: 1.3, to: 1 },
          duration: 200,
          ease: 'Back.easeOut',
        });
        // 抖动动画
        this._scene.tweens.add({
          targets: this._gfx,
          x: mx + 3,
          duration: 60,
          yoyo: true,
          repeat: 3,
          onComplete: () => { if (this._gfx) this._gfx.x = mx; },
        });
      }
    } else if (this._state === 'sleeping') {
      this._drawFrog(mx, my, 0.8, 0x2196f3);
      this._setGfxPosition(mx, my);
    }
  }

  _drawFrog(x, y, scale, bodyColor) {
    const r = Math.round(14 * scale);
    // 身体
    this._gfx.fillStyle(0x2e7d32, 1);
    this._gfx.fillCircle(x, y + 4, r);
    this._gfx.fillCircle(x, y - r + 4, Math.round(r * 0.85));
    // 眼睛
    this._gfx.fillStyle(0xffffff, 1);
    this._gfx.fillCircle(x - 4, y - r + 2, 3);
    this._gfx.fillCircle(x + 4, y - r + 2, 3);
    this._gfx.fillStyle(0x000000, 1);
    this._gfx.fillCircle(x - 4, y - r + 3, 1.5);
    this._gfx.fillCircle(x + 4, y - r + 3, 1.5);
  }

  _startCountdown(scene) {
    if (!scene) return;
    this._killCountdown();

    const nodeA = this._map?.getNode(this.edgeA);
    const nodeB = this._map?.getNode(this.edgeB);
    if (!nodeA || !nodeB) return;
    const mx = (nodeA.x + nodeB.x) / 2;
    const my = (nodeA.y + nodeB.y) / 2;

    this._countdownGfx   = scene.add.graphics().setDepth(150);
    this._countdownText  = scene.add.text(mx, my - 30, '', {
      fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(151);

    this._countdownInterval = setInterval(() => {
      const left = this.getSleepSecondsLeft();
      if (left < 0) { this._killCountdown(); return; }
      if (this._countdownGfx) {
        this._countdownGfx.clear();
        const radius = 10 + left * 2;
        const red = Math.min(255, (5 - left) * 50);
        this._countdownGfx.fillStyle(Phaser.Display.Color.GetColor(red, 50, 50), 0.85);
        this._countdownGfx.fillCircle(mx, my - 30, radius);
      }
      if (this._countdownText) {
        this._countdownText.setText(left > 0 ? String(left) : '!');
      }
    }, 200);
  }

  _killCountdown() {
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
    this._countdownGfx?.destroy();   this._countdownGfx  = null;
    this._countdownText?.destroy();  this._countdownText = null;
  }

  startCountdownUI(scene) {
    this._startCountdown(scene);
  }

  bindMap(mapModule) {
    this._map = mapModule;
  }

  getTriggerNodeIds() {
    return [this.edgeA, this.edgeB];
  }

  destroy() {
    this._killCountdown();
    super.destroy();
  }
}
