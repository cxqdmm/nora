// ============================================================
//  NPCModule.js — NPC 抽象基类
// ============================================================
import { CONFIG }      from '../config.js';
import { EffectModule } from '../modules/EffectModule.js';

export class NPCModule {
  /**
   * @param {object} opts
   * @param {string} opts.id   唯一标识
   * @param {number} opts.edgeA 所在边端点节点 id
   * @param {number} opts.edgeB 所在边另一端点节点 id
   */
  constructor(opts) {
    this.id     = opts.id;
    this.edgeA  = opts.edgeA;
    this.edgeB  = opts.edgeB;
    // 偷偷溜过的能量消耗（可由子类/关卡覆盖）
    this._sneakEnergyCost = opts.sneakEnergyCost ?? CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;
    this._state = 'idle';   // 'idle' | 'active' | 'sleeping' | 'dead'
    this._sleepDuration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
    this._sleepTimer   = null;
    this._sleepEndTime = 0;
    /** 玩家通过时的回调 */
    this.onPass = null;

    /** 效果 Graphics 对象数组 */
    this._effectGfx = [];
    this._gfx       = null;
    this._scene     = null;
    this._mx = 0;
    this._my = 0;
  }

  // ── 状态查询 ────────────────────────────────────────────
  getState()     { return this._state; }
  isBlocking()    { return this._state === 'active' || this._state === 'idle'; }
  isDead()        { return this._state === 'dead'; }

  // ── 状态转换 ────────────────────────────────────────────
  activate() {
    if (this._state === 'dead' || this._state === 'sleeping') return;
    this._state = 'active';
    this._render();
    // 受惊后短暂显示攻击姿态（600ms），然后进入睡眠
    this._clearSleepTimer();
    this._sleepEndTime = Date.now() + 600;
    this._sleepTimer = setTimeout(() => {
      if (this._state === 'active') {
        this._state = 'sleeping';
        this._render();
        this._sleepTimer = setTimeout(() => this._wakeUp(), this._sleepDuration);
      }
    }, 600);
  }

  sleep(durationMs) {
    if (this._state === 'dead') return;
    this._clearSleepTimer();
    this._state = 'sleeping';
    this._sleepEndTime = Date.now() + (durationMs ?? this._sleepDuration);
    this._render();
    this._sleepTimer = setTimeout(() => this._wakeUp(), durationMs ?? this._sleepDuration);
  }

  kill() {
    if (this._state === 'dead') return;
    this._clearSleepTimer();
    this._state = 'dead';
    this._render();
  }

  reset() {
    this._clearSleepTimer();
    this._state = 'idle';
    // 不 kill 效果，让 active 火焰继续显示直到 600ms 定时器
    this._render(false);
  }

  // ── 睡眠内部 ─────────────────────────────────────────
  _wakeUp() {
    if (this._state === 'sleeping') {
      this._state = 'active';
      this._render();
    }
  }

  _clearSleepTimer() {
    if (this._sleepTimer) { clearTimeout(this._sleepTimer); this._sleepTimer = null; }
  }

  getSleepSecondsLeft() {
    if (this._state !== 'sleeping') return -1;
    return Math.max(0, Math.ceil((this._sleepEndTime - Date.now()) / 1000));
  }

  // ── 绑定 ──────────────────────────────────────────────
  bindMap(mapModule) {
    this._map = mapModule;
  }

  bindGraphics(gfx, scene) {
    this._gfx   = gfx;
    this._scene = scene;
    this._render();
  }

  // ── 渲染主流程 ────────────────────────────────────────
  _render(killEffects = true) {
    if (!this._gfx) return;
    const nodeA = this._map?.getNode(this.edgeA);
    const nodeB = this._map?.getNode(this.edgeB);
    if (!nodeA || !nodeB) return;

    this._mx = (nodeA.x + nodeB.x) / 2;
    this._my = (nodeA.y + nodeB.y) / 2;

    this._gfx.clear();
    this._gfx.setPosition(this._mx, this._my);
    this._gfx.setScale(1, 1);
    this._gfx.setAlpha(1);
    if (killEffects) this._killEffects();

    if (this._state === 'dead') return;

    // 画本体（局部坐标 0,0）
    this.renderBody();

    // 画装饰效果
    const effects = this.getStateEffects(this._state);
    for (const cfg of effects) {
      this._renderEffect(cfg);
    }
  }

  /**
   * 子类覆盖：画 NPC 本体
   * 坐标相对于 (0, 0)，外部已在 _gfx 上 setPosition(mx, my)
   */
  renderBody() {
    // 基类为空，子类覆盖
  }

  /**
   * 子类覆盖：返回装饰效果配置数组
   * @param {string} _state （子类实现时使用）
   * @returns {{ type: string, scale?: number }[]}
   */
  getStateEffects(_state) {
    return [];
  }

  // ── 效果渲染 ─────────────────────────────────────────
  _renderEffect(cfg) {
    if (!this._scene) return;
    const gfx = this._scene.add.graphics().setDepth(51);
    gfx.setPosition(this._mx, this._my);
    this._effectGfx.push(gfx);

    if (cfg.type === 'fire') {
      EffectModule.drawFire(gfx, 0, -20 * (cfg.scale ?? 1), cfg.scale ?? 1);
      // 火焰抖动 tween
      this._scene.tweens.add({
        targets: gfx,
        scaleX: { from: 0.9, to: 1.1 },
        scaleY: { from: 0.9, to: 1.1 },
        duration: 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (cfg.type === 'glow-red') {
      EffectModule.drawGlow(gfx, 0, 0, 0xff4444);
      // 光晕脉冲
      this._scene.tweens.add({
        targets: gfx,
        alpha: { from: 0.5, to: 1 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (cfg.type === 'glow-blue') {
      EffectModule.drawGlow(gfx, 0, 0, 0x64b5f6);
      this._scene.tweens.add({
        targets: gfx,
        alpha: { from: 0.4, to: 0.9 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (cfg.type === 'sleep-bubble') {
      EffectModule.drawSleepBubble(gfx, 0, 0, cfg.scale ?? 1);
    }
  }

  _killEffects() {
    for (const g of this._effectGfx) {
      this._scene?.tweens.killTweensOf(g);
      g.destroy();
    }
    this._effectGfx = [];
  }

  // ── 工具方法 ─────────────────────────────────────────
  getTriggerNodeIds() {
    return [this.edgeA, this.edgeB];
  }

  destroy() {
    this._clearSleepTimer();
    this._killEffects();
  }

  // ── 能量消耗查询 ─────────────────────────────────────────
  getSneakEnergyCost() {
    return this._sneakEnergyCost;
  }
}
