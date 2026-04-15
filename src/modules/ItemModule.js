// ============================================================
//  ItemModule.js — 道具管理，背包无限容量
// ============================================================
import { CONFIG } from '../config.js';

export class ItemModule {
  constructor() {
    /** @type {{ knife: number, potion: number, wing: number }} */
    this._items = { knife: 0, potion: 0, wing: 0 };
  }

  addItem(type) {
    if (!['knife', 'potion', 'wing'].includes(type)) return;
    this._items[type]++;
  }

  removeItem(type) {
    if (!['knife', 'potion', 'wing'].includes(type)) return;
    this._items[type] = Math.max(0, this._items[type] - 1);
  }

  hasItem(type) {
    return (this._items[type] ?? 0) > 0;
  }

  getCount(type) {
    return this._items[type] ?? 0;
  }

  /** 随机掉落检查，根据食物类型决定是否掉落道具，返回 'knife' | 'potion' | null */
  rollDrop(foodType) {
    const cfg = CONFIG.ITEMS.DROP_CHANCE[foodType];
    if (!cfg) return null;
    if (Math.random() < (cfg.knife ?? 0)) return 'knife';
    if (Math.random() < (cfg.potion ?? 0)) return 'potion';
    return null;
  }
}
