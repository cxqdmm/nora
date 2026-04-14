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

  // ── 徽章渲染（跟随 NPC 位置）──────────────────────────────
  _renderCostBadge() {
    console.log('[_renderCostBadge] state:', this._state, 'mx:', this._mx, 'my:', this._my, 'costBg:', !!this._costBg, 'costText:', !!this._costText);
    if (!this._costBg || !this._costText) return;
    const cost    = this.getSneakEnergyCost();
    const badgeX  = this._mx + 20;
    const badgeY  = this._my - 20;
    const radius  = 14;

    this._costBg.clear();
    this._costBg.fillStyle(0xff4444, 0.9);
    this._costBg.fillCircle(badgeX, badgeY, radius);

    this._costText.setPosition(badgeX, badgeY);
    this._costText.setText(`⚡${cost}`);
    console.log('[_renderCostBadge] drawn at', badgeX, badgeY, 'text:', this._costText.text);
  }

  // ── 覆盖基类 bindGraphics：创建徽章对象 ─────────────────
  bindGraphics(gfx, scene) {
    super.bindGraphics(gfx, scene);
    console.log('[bindGraphics] creating badge, scene:', !!this._scene);
    // 能量消耗徽章（背景圆 + 文字）
    this._costBg = this._scene.add.graphics().setDepth(155);
    this._costText = this._scene.add.text(0, 0, '', {
      fontSize: '12px',
      fontFamily: 'Microsoft YaHei, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(156);
    console.log('[bindGraphics] badge created, cost:', this.getSneakEnergyCost(), 'mx:', this._mx, 'my:', this._my);
  }

  // ── 覆盖基类 _render：渲染完成后更新徽章 ─────────────────
  _render() {
    super._render();
    this._renderCostBadge();
  }

  // ── 公开方法 ───────────────────────────────────────
  startCountdownUI(scene) {
    // scene 在 bindGraphics 时已存入 this._scene，直接用
    this._startCountdown();
  }

  destroy() {
    this._killCountdown();
    this._costBg?.destroy();
    this._costText?.destroy();
    super.destroy();
  }
}
