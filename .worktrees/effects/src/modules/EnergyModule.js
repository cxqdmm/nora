// ============================================================
//  EnergyModule.js — 能量管理，纯逻辑，不依赖 Phaser
// ============================================================

export class EnergyModule {
  /**
   * @param {number} initialEnergy  起始能量值
   * @param {number} maxEnergy      上限（默认与初始值相同）
   */
  constructor(initialEnergy, maxEnergy) {
    this._max    = maxEnergy ?? initialEnergy;
    this._energy = initialEnergy;

    /** 能量耗尽回调 */
    this.onEmpty = null;
    /** 能量变化回调 (current, max) */
    this.onChange = null;
  }

  // ── 读取 ──────────────────────────────────────────────────
  getEnergy()    { return this._energy; }
  getMax()       { return this._max;    }
  getRatio()     { return this._energy / this._max; }
  isEmpty()      { return this._energy <= 0; }

  // ── 写入 ──────────────────────────────────────────────────
  /**
   * 消耗能量
   * @param {number} amount 正数
   */
  drain(amount) {
    this._energy = Math.max(0, this._energy - amount);
    this.onChange?.(this._energy, this._max);
    if (this.isEmpty()) this.onEmpty?.();
  }

  /**
   * 恢复能量（不超上限）
   * @param {number} amount 正数
   */
  restore(amount) {
    this._energy = Math.min(this._max, this._energy + amount);
    this.onChange?.(this._energy, this._max);
  }

  reset(value) {
    this._energy = value ?? this._max;
    this.onChange?.(this._energy, this._max);
  }
}
