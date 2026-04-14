// ============================================================
//  FrogNPC.js — 青蛙 NPC
// ============================================================
import { NPCModule } from './NPCModule.js';
import { CONFIG }    from '../config.js';

export class FrogNPC extends NPCModule {
  constructor(opts) {
    super(opts);
    this._sleepDuration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;

    /** 睡眠倒计时气泡（独立于 _effectGfx） */
    this._countdownGfx    = null;
    this._countdownText   = null;
    this._countdownInterval = null;
  }

  // ── 渲染本体 ─────────────────────────────────────────
  renderBody() {
    const scale = this._state === 'idle' ? 0.6
               : this._state === 'sleeping' ? 0.8 : 1.0;

    // ── 身体（椭圆）────────────────────────────────
    this._gfx.fillStyle(0x388e3c, 1);
    this._gfx.fillEllipse(0, 4, 26 * scale, 20 * scale);
    // ── 头部（圆头顶）────────────────────────────
    this._gfx.fillCircle(0, -4, 14 * scale);
    // ── 肚皮（浅绿）────────────────────────────
    this._gfx.fillStyle(0x81c784, 1);
    this._gfx.fillEllipse(0, 6, 16 * scale, 12 * scale);

    // ── 眼睛（鼓出来的蛙眼）──────────────────
    const eyeY  = -12 * scale;
    const eyeXOff = 8 * scale;
    const eyeR   = 7 * scale;

    // 左眼
    this._gfx.fillStyle(0xffffff, 1);
    this._gfx.fillCircle(-eyeXOff, eyeY, eyeR);
    this._gfx.fillStyle(0x1b5e20, 1);
    this._gfx.fillCircle(-eyeXOff, eyeY, eyeR * 0.6);
    this._gfx.fillStyle(0xffffff, 1);
    this._gfx.fillCircle(-eyeXOff - 1.5 * scale, eyeY - 1.5 * scale, eyeR * 0.25);

    // 右眼
    this._gfx.fillStyle(0xffffff, 1);
    this._gfx.fillCircle(eyeXOff, eyeY, eyeR);
    this._gfx.fillStyle(0x1b5e20, 1);
    this._gfx.fillCircle(eyeXOff, eyeY, eyeR * 0.6);
    this._gfx.fillStyle(0xffffff, 1);
    this._gfx.fillCircle(eyeXOff - 1.5 * scale, eyeY - 1.5 * scale, eyeR * 0.25);

    // ── 微笑嘴巴 ────────────────────────────────
    this._gfx.lineStyle(2, 0x1b5e20, 1);
    this._gfx.beginPath();
    this._gfx.arc(0, 2, 6 * scale, 0.2, Math.PI - 0.2, false);
    this._gfx.strokePath();

    // ── 后腿（小脚蹼）────────────────────────
    this._gfx.fillStyle(0x388e3c, 1);
    this._gfx.fillEllipse(-14 * scale, 12 * scale, 10 * scale, 6 * scale);
    this._gfx.fillEllipse( 14 * scale, 12 * scale, 10 * scale, 6 * scale);
    this._gfx.fillStyle(0x2e7d32, 1);
    this._gfx.fillCircle(-18 * scale, 13 * scale, 2.5 * scale);
    this._gfx.fillCircle( 18 * scale, 13 * scale, 2.5 * scale);
  }

  // ── 状态装饰效果配置 ───────────────────────────────
  getStateEffects(state) {
    if (state === 'active') {
      return [
        { type: 'fire',     scale: 1.0 },
        { type: 'glow-red', scale: 1.0 },
      ];
    }
    if (state === 'sleeping') {
      return [
        { type: 'glow-blue',    scale: 1.0 },
        { type: 'sleep-bubble', scale: 0.8 },
      ];
    }
    return [];
  }

  // ── 睡眠倒计时气泡（独立于效果层）────────────────
  _startCountdown() {
    this._killCountdown();
    if (!this._scene) return;

    this._countdownGfx  = this._scene.add.graphics().setDepth(152);
    this._countdownText = this._scene.add.text(0, -30, '', {
      fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(153);

    this._countdownInterval = setInterval(() => {
      const left = this.getSleepSecondsLeft();
      if (left < 0) { this._killCountdown(); return; }

      if (this._countdownGfx) {
        this._countdownGfx.clear();
        const radius = 10 + left * 2;
        const red    = Math.min(255, (5 - left) * 50);
        this._countdownGfx.fillStyle(Phaser.Display.Color.GetColor(red, 50, 50), 0.85);
        this._countdownGfx.fillCircle(0, -30, radius);
      }
      if (this._countdownText) {
        this._countdownText.setText(left > 0 ? String(left) : '!');
      }
    }, 200);
  }

  _killCountdown() {
    if (this._countdownInterval) { clearInterval(this._countdownInterval); this._countdownInterval = null; }
    this._countdownGfx?.destroy();  this._countdownGfx  = null;
    this._countdownText?.destroy(); this._countdownText = null;
  }

  // ── 公开方法 ───────────────────────────────────────
  startCountdownUI(scene) {
    // scene 在 bindGraphics 时已存入 this._scene，直接用
    this._startCountdown();
  }

  destroy() {
    this._killCountdown();
    super.destroy();
  }
}
