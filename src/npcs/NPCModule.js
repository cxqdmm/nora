// ============================================================
//  NPCModule.js — NPC 抽象基类
// ============================================================
import { CONFIG } from '../config.js';

export class NPCModule {
  /**
   * @param {object} opts
   * @param {string} opts.id  唯一标识
   * @param {number} opts.edgeA  所在边端点节点 id
   * @param {number} opts.edgeB  所在边另一端点节点 id
   */
  constructor(opts) {
    this.id     = opts.id;
    this.edgeA  = opts.edgeA;
    this.edgeB  = opts.edgeB;
    this._state = 'idle';  // 'idle' | 'active' | 'sleeping' | 'dead'
    this._sleepDuration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
    this._sleepTimer    = null;
    this._sleepEndTime  = 0;
    /** 玩家通过时的回调 (npc) */
    this.onPass = null;
  }

  // ── 状态查询 ──────────────────────────────────────────────
  getState()    { return this._state; }
  isBlocking()   { return this._state === 'active' || this._state === 'idle'; }
  isDead()       { return this._state === 'dead'; }

  // ── 状态转换 ──────────────────────────────────────────────
  activate() {
    if (this._state === 'dead' || this._state === 'sleeping') return;
    this._state = 'active';
    this._render();
  }

  /** 睡眠 duration 毫秒后自动醒来 */
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
    this._render();
  }

  // ── 睡眠内部 ──────────────────────────────────────────────
  _wakeUp() {
    if (this._state === 'sleeping') {
      this._state = 'active';
      this._render();
    }
  }

  _clearSleepTimer() {
    if (this._sleepTimer) {
      clearTimeout(this._sleepTimer);
      this._sleepTimer = null;
    }
  }

  /** 获取剩余睡眠秒数，-1 表示未在睡眠 */
  getSleepSecondsLeft() {
    if (this._state !== 'sleeping') return -1;
    return Math.max(0, Math.ceil((this._sleepEndTime - Date.now()) / 1000));
  }

  // ── 子类实现 ──────────────────────────────────────────────
  /** 绑定 Phaser Graphics 对象（子类覆盖） */
  bindGraphics(/** @type {Phaser.GameObjects.Graphics} */ gfx) {
    this._gfx = gfx;
    this._render();
  }

  /** 根据当前状态重绘（子类覆盖） */
  _render() {
    // 基类实现为空
  }

  /** 返回触发区域节点 id 列表 */
  getTriggerNodeIds() {
    return [this.edgeA, this.edgeB];
  }

  destroy() {
    this._clearSleepTimer();
  }
}
