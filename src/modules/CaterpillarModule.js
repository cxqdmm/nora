// ============================================================
//  CaterpillarModule.js — 毛毛虫：绘制 + 沿树枝爬行动画
// ============================================================
import { CONFIG } from '../config.js';

const C = CONFIG.CATERPILLAR;

/** 二次贝塞尔折线近似（Phaser 3 Graphics 无 quadraticCurveTo） */
function quadBezier(gfx, x0, y0, cpx, cpy, x1, y1, segments = 12) {
  gfx.moveTo(x0, y0);
  for (let i = 1; i <= segments; i++) {
    const t  = i / segments;
    const mt = 1 - t;
    gfx.lineTo(
      mt * mt * x0 + 2 * mt * t * cpx + t * t * x1,
      mt * mt * y0 + 2 * mt * t * cpy + t * t * y1
    );
  }
}

export class CaterpillarModule {
  /**
   * @param {Phaser.Scene} scene
   * @param {import('./MapModule').MapModule} mapModule
   */
  constructor(scene, mapModule) {
    this.scene     = scene;
    this.mapModule = mapModule;

    this._currentNodeId = null;
    this._moving        = false;

    /** 身体各节图形（index 0 = 头） */
    this._segments = [];
    /** 每节的历史坐标队列，用于尾随动画 */
    this._posHistory = [];  // [{x,y}, ...]

    /** 移动完成回调 */
    this.onMoveComplete = null;
  }

  // ── 创建 ─────────────────────────────────────────────────
  create(startNodeId) {
    this._currentNodeId = startNodeId;
    const node = this.mapModule.getNode(startNodeId);

    // 初始化位置历史（所有节从同一点出发）
    for (let i = 0; i <= C.BODY_SEGMENTS; i++) {
      this._posHistory.push({ x: node.x, y: node.y });
    }

    // 绘制身体各节（从尾到头，保证头在最上层）
    for (let i = C.BODY_SEGMENTS; i >= 0; i--) {
      const gfx = this.scene.add.graphics();
      this._segments[i] = gfx;
    }

    this._redraw();
    return this;
  }

  // ── 移动到目标节点 ────────────────────────────────────────
  /**
   * @param {number} targetNodeId
   */
  moveTo(targetNodeId) {
    if (this._moving) return;
    if (!this.mapModule.isConnected(this._currentNodeId, targetNodeId)) return;

    this._moving = true;
    const from = this.mapModule.getNode(this._currentNodeId);
    const to   = this.mapModule.getNode(targetNodeId);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = (dist / C.SPEED) * 1000;  // ms

    // 用一个虚拟对象承载头部坐标，tween 驱动
    const head = { x: from.x, y: from.y };

    this.scene.tweens.add({
      targets: head,
      x: to.x,
      y: to.y,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this._pushHistory(head.x, head.y);
        this._redraw();
      },
      onComplete: () => {
        this._currentNodeId = targetNodeId;
        this._moving = false;
        this.onMoveComplete?.(targetNodeId);
      },
    });
  }

  // ── 位置历史队列 ──────────────────────────────────────────
  _pushHistory(x, y) {
    this._posHistory.unshift({ x, y });
    // 保留足够长的历史，供所有身体节使用
    const maxLen = (C.BODY_SEGMENTS + 1) * 6;
    if (this._posHistory.length > maxLen) {
      this._posHistory.length = maxLen;
    }
  }

  // ── 重绘 ─────────────────────────────────────────────────
  _redraw() {
    const headPos = this._posHistory[0] || { x: 0, y: 0 };

    for (let i = 0; i <= C.BODY_SEGMENTS; i++) {
      const gfx = this._segments[i];
      if (!gfx) continue;
      gfx.clear();

      // 从位置历史按间距采样
      const histIdx = Math.min(i * 4, this._posHistory.length - 1);
      const pos = this._posHistory[histIdx] || headPos;

      if (i === 0) {
        this._drawHead(gfx, pos.x, pos.y, headPos);
      } else {
        this._drawBodySegment(gfx, pos.x, pos.y, i);
      }
    }
  }

  _drawHead(gfx, x, y, headPos) {
    const r = C.HEAD_RADIUS;
    // 身体阴影
    gfx.fillStyle(0x000000, 0.15);
    gfx.fillCircle(x + 2, y + 2, r);

    // 头部主体
    gfx.fillStyle(C.COLOR_HEAD, 1);
    gfx.fillCircle(x, y, r);

    // 条纹
    gfx.lineStyle(2, C.COLOR_STRIPE, 0.5);
    gfx.beginPath();
    gfx.arc(x, y, r - 2, -0.8, 0.8, false);
    gfx.strokePath();

    // 眼睛（左右各一）
    const eyeOffsets = [{ dx: -5, dy: -5 }, { dx: 5, dy: -5 }];
    for (const e of eyeOffsets) {
      gfx.fillStyle(C.COLOR_EYE_W, 1);
      gfx.fillCircle(x + e.dx, y + e.dy, 4);
      gfx.fillStyle(C.COLOR_EYE_P, 1);
      gfx.fillCircle(x + e.dx + 1, y + e.dy + 1, 2);
    }

    // 触角
    gfx.lineStyle(1.5, C.COLOR_ANTENNA, 1);
    gfx.beginPath();
    quadBezier(gfx, x - 4, y - r, x - 10, y - r - 10, x - 8, y - r - 16);
    gfx.strokePath();
    gfx.beginPath();
    quadBezier(gfx, x + 4, y - r, x + 10, y - r - 10, x + 8, y - r - 16);
    gfx.strokePath();
    // 触角末端小球
    gfx.fillStyle(C.COLOR_ANTENNA, 1);
    gfx.fillCircle(x - 8, y - r - 16, 3);
    gfx.fillCircle(x + 8, y - r - 16, 3);

    // 嘴巴
    gfx.lineStyle(1.5, 0x2d5018, 1);
    gfx.beginPath();
    gfx.arc(x, y + 4, 5, 0.2, Math.PI - 0.2, false);
    gfx.strokePath();
  }

  _drawBodySegment(gfx, x, y, idx) {
    const r = C.BODY_RADIUS - Math.floor(idx / 2);  // 越往后越小

    // 阴影
    gfx.fillStyle(0x000000, 0.12);
    gfx.fillCircle(x + 1, y + 1, r);

    // 主体
    const alpha = 1 - idx * 0.04;
    gfx.fillStyle(C.COLOR_BODY, alpha);
    gfx.fillCircle(x, y, r);

    // 横向条纹
    if (idx % 2 === 0) {
      gfx.lineStyle(1.5, C.COLOR_STRIPE, 0.45);
      gfx.beginPath();
      gfx.arc(x, y, r - 1, -0.7, 0.7, false);
      gfx.strokePath();
    }

    // 小脚
    if (idx < C.BODY_SEGMENTS - 1) {
      gfx.lineStyle(1.5, C.COLOR_STRIPE, 0.7);
      gfx.beginPath();
      gfx.moveTo(x - r, y + 2);
      gfx.lineTo(x - r - 5, y + 8);
      gfx.strokePath();
      gfx.beginPath();
      gfx.moveTo(x + r, y + 2);
      gfx.lineTo(x + r + 5, y + 8);
      gfx.strokePath();
    }
  }

  // ── 公开状态 ──────────────────────────────────────────────
  getCurrentNodeId() { return this._currentNodeId; }

  /**
   * 返回毛毛虫头部当前位置（像素坐标）
   * @returns {{ x: number, y: number }}
   */
  getHeadPosition() {
    const head = this._posHistory[0];
    return head ? { x: head.x, y: head.y } : { x: 0, y: 0 };
  }

  isMoving()         { return this._moving; }

  /**
   * 瞬间传送到目标节点（快速通航）
   * @param {number} nodeId
   */
  /**
   * 显示/隐藏毛毛虫（飞行时用）
   * @param {boolean} visible
   */
  setVisible(visible) {
    for (const gfx of this._segments) gfx?.setAlpha(visible ? 1 : 0);
  }

  /**
   * 瞬间传送到目标节点（飞行结束用）
   * @param {number} nodeId
   */
  teleportTo(nodeId) {
    const node = this.mapModule.getNode(nodeId);
    if (!node) return;
    this._currentNodeId = nodeId;
    this._posHistory = [];
    // 填充历史，让所有节都从目标位置出发
    for (let i = 0; i <= C.BODY_SEGMENTS; i++) {
      this._posHistory.push({ x: node.x, y: node.y });
    }
    this._redraw();
  }

  // ── 销毁 ─────────────────────────────────────────────────
  destroy() {
    for (const gfx of this._segments) gfx?.destroy();
    this._segments = [];
  }
}
