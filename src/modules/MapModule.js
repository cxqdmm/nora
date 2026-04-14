// ============================================================
//  MapModule.js — 地图：节点图数据 + 树枝绘制 + 交互高亮
// ============================================================
import { CONFIG } from '../config.js';

const C = CONFIG.MAP;

/**
 * 用折线段近似二次贝塞尔曲线（Phaser 3 Graphics 没有 quadraticCurveTo）
 * @param {Phaser.GameObjects.Graphics} gfx
 * @param {number} x0 起点 x
 * @param {number} y0 起点 y
 * @param {number} cpx 控制点 x
 * @param {number} cpy 控制点 y
 * @param {number} x1 终点 x
 * @param {number} y1 终点 y
 * @param {number} [segments=16] 分段数，越高越平滑
 */
function quadBezier(gfx, x0, y0, cpx, cpy, x1, y1, segments = 16) {
  gfx.moveTo(x0, y0);
  for (let i = 1; i <= segments; i++) {
    const t  = i / segments;
    const mt = 1 - t;
    const x  = mt * mt * x0 + 2 * mt * t * cpx + t * t * x1;
    const y  = mt * mt * y0 + 2 * mt * t * cpy + t * t * y1;
    gfx.lineTo(x, y);
  }
}

export class MapModule {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} levelData  关卡数据 (nodes / edges)
   */
  constructor(scene, levelData) {
    this.scene     = scene;
    this.levelData = levelData;

    /** id → node 对象 */
    this._nodeMap = new Map();
    /** id → Set<id>  邻接表 */
    this._adj     = new Map();
    /** 树枝 Graphics 图层 */
    this._branchGfx = null;
    /** 节点交互区域 */
    this._nodeSprites = new Map();  // id → { circle, glow }
    /** 当前高亮的节点 id 集合 */
    this._highlighted = new Set();

    this._buildGraph();
  }

  // ── 初始化图 ─────────────────────────────────────────────
  _buildGraph() {
    for (const n of this.levelData.nodes) {
      this._nodeMap.set(n.id, { ...n });
      this._adj.set(n.id, new Set());
    }
    for (const [a, b] of this.levelData.edges) {
      this._adj.get(a).add(b);
      this._adj.get(b).add(a);
    }
  }

  // ── 公开 API：数据查询 ────────────────────────────────────
  getNode(id)           { return this._nodeMap.get(id); }
  getAllNodes()          { return [...this._nodeMap.values()]; }
  getConnected(id)      { return [...(this._adj.get(id) || [])]; }
  isConnected(a, b)     { return this._adj.get(a)?.has(b) ?? false; }

  getDistance(a, b) {
    const na = this._nodeMap.get(a);
    const nb = this._nodeMap.get(b);
    if (!na || !nb) return 0;
    return Math.hypot(nb.x - na.x, nb.y - na.y);
  }

  // ── 创建（绘制全部地图元素）────────────────────────────────
  create() {
    this._drawBackground();
    this._drawBranches();
    this._drawNodes();
  }

  // ── 背景 ─────────────────────────────────────────────────
  _drawBackground() {
    const { CANVAS_WIDTH: W, CANVAS_HEIGHT: H } = CONFIG;
    const gfx = this.scene.add.graphics();

    // 渐变天空
    gfx.fillGradientStyle(
      CONFIG.COLORS.BG_TOP, CONFIG.COLORS.BG_TOP,
      CONFIG.COLORS.BG_BOTTOM, CONFIG.COLORS.BG_BOTTOM, 1
    );
    gfx.fillRect(0, 0, W, H);

    // 底部装饰草地
    gfx.fillStyle(0x4a9e30, 0.6);
    for (let i = 0; i < 20; i++) {
      const bx = 30 + i * 40;
      gfx.fillTriangle(bx, H, bx - 12, H - 30, bx + 12, H - 30);
    }

    // 漂浮树叶装饰（小椭圆）
    const leafColors = [0x5baa3a, 0x3d8c28, 0x7cc45a];
    const rng = this.scene.add.graphics();
    const decorLeaves = [
      {x:60, y:80}, {x:730, y:120}, {x:150, y:500},
      {x:680, y:480}, {x:50, y:320}, {x:760, y:300},
    ];
    for (const pos of decorLeaves) {
      rng.fillStyle(Phaser.Utils.Array.GetRandom(leafColors), 0.35);
      rng.fillEllipse(pos.x, pos.y, 44, 26);
    }
  }

  // ── 树枝 ─────────────────────────────────────────────────
  _drawBranches() {
    const gfx = this.scene.add.graphics();
    this._branchGfx = gfx;

    for (const [a, b] of this.levelData.edges) {
      this._drawSingleBranch(gfx, a, b);
    }
  }

  _drawSingleBranch(gfx, idA, idB) {
    const na = this._nodeMap.get(idA);
    const nb = this._nodeMap.get(idB);

    const isMainTrunk = (idA === this.levelData.startNode || idB === this.levelData.startNode);
    const width = isMainTrunk ? C.BRANCH_WIDTH_MAIN : C.BRANCH_WIDTH_SUB;

    const mx = (na.x + nb.x) / 2;
    const my = (na.y + nb.y) / 2;

    // 轻微弯曲控制点偏移，模拟手绘感
    const dx = nb.x - na.x;
    const dy = nb.y - na.y;
    const perpX = -dy * 0.08;
    const perpY =  dx * 0.08;
    const cpx = mx + perpX;
    const cpy = my + perpY;

    // 阴影层（略粗略深）
    gfx.lineStyle(width + 4, C.BRANCH_SHADOW_COLOR, 0.5);
    gfx.beginPath();
    quadBezier(gfx, na.x, na.y, cpx + 2, cpy + 2, nb.x, nb.y);
    gfx.strokePath();

    // 主干颜色
    gfx.lineStyle(width, C.BRANCH_COLOR, 1);
    gfx.beginPath();
    quadBezier(gfx, na.x, na.y, cpx, cpy, nb.x, nb.y);
    gfx.strokePath();

    // 树皮纹理：沿树枝方向画几条细线
    this._drawBarkTexture(gfx, na, nb, cpx, cpy, width);
  }

  _drawBarkTexture(gfx, na, nb, cpx, cpy, width) {
    const n = C.BARK_LINES;
    gfx.lineStyle(1, 0x5a3a0a, 0.3);
    for (let i = 1; i < n; i++) {
      const t  = i / n;
      // 贝塞尔曲线上的点
      const bx = (1-t)*(1-t)*na.x + 2*(1-t)*t*cpx + t*t*nb.x;
      const by = (1-t)*(1-t)*na.y + 2*(1-t)*t*cpy + t*t*nb.y;
      // 切线方向
      const tx = 2*(1-t)*(cpx - na.x) + 2*t*(nb.x - cpx);
      const ty = 2*(1-t)*(cpy - na.y) + 2*t*(nb.y - cpy);
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len;
      const ny =  tx / len;
      const half = (width * 0.35) * (0.5 + Math.random() * 0.5);
      gfx.beginPath();
      gfx.moveTo(bx + nx * half, by + ny * half);
      gfx.lineTo(bx - nx * half, by - ny * half);
      gfx.strokePath();
    }
  }

  // ── 节点标记 ──────────────────────────────────────────────
  _drawNodes() {
    for (const node of this._nodeMap.values()) {
      this._createNodeSprite(node);
    }
  }

  _createNodeSprite(node) {
    const gfx  = this.scene.add.graphics();
    const r    = C.NODE_RADIUS;
    const color = node.isHome  ? C.NODE_COLOR_HOME
                : node.isStart ? C.NODE_COLOR_START
                :                C.NODE_COLOR_NORMAL;

    // 光晕（初始隐藏）
    gfx.fillStyle(0xffff88, 0);
    gfx.fillCircle(node.x, node.y, r + 8);

    // 主节点圆
    gfx.lineStyle(2, 0xffffff, 0.8);
    gfx.fillStyle(color, 1);
    gfx.fillCircle(node.x, node.y, r);
    gfx.strokeCircle(node.x, node.y, r);

    // HOME 特殊图标：小叶片巢穴
    if (node.isHome) {
      this._drawHomeIcon(node.x, node.y);
    }

    // START 标记
    if (node.isStart) {
      this._drawStartIcon(node.x, node.y);
    }

    // 可交互的透明热区
    const zone = this.scene.add.zone(node.x, node.y, (r + 12) * 2, (r + 12) * 2)
      .setInteractive({ cursor: 'pointer' });

    zone.nodeId = node.id;

    zone.on('pointerover', () => {
      if (this._highlighted.has(node.id)) {
        this._glowNode(node.id, true);
      }
    });
    zone.on('pointerout', () => {
      this._glowNode(node.id, false);
    });

    this._nodeSprites.set(node.id, { gfx, zone });
    return zone;
  }

  _drawHomeIcon(x, y) {
    const g = this.scene.add.graphics();
    // 小屋剪影
    g.fillStyle(0xffe0b2, 1);
    g.fillTriangle(x - 18, y + 4, x, y - 14, x + 18, y + 4);
    g.fillStyle(0xffab40, 1);
    g.fillRect(x - 10, y + 4, 20, 14);
    g.fillStyle(0x6d4c41, 1);
    g.fillRect(x - 4, y + 8, 8, 10);
    // 门
    g.lineStyle(1.5, 0xffffff, 0.9);
    g.strokeRect(x - 10, y + 4, 20, 14);
  }

  _drawStartIcon(x, y) {
    const g = this.scene.add.graphics();
    g.fillStyle(0xffffff, 0.9);
    // 小脚印
    g.fillCircle(x - 4, y + 2, 3);
    g.fillCircle(x + 4, y + 2, 3);
    g.fillEllipse(x, y - 4, 10, 7);
  }

  // ── 高亮可点击节点 ────────────────────────────────────────
  /**
   * @param {number[]} nodeIds  要高亮的节点 id 列表
   */
  highlightNodes(nodeIds) {
    this.clearHighlight();
    this._highlighted = new Set(nodeIds);
    for (const id of nodeIds) {
      const sprite = this._nodeSprites.get(id);
      if (!sprite) continue;
      const node = this._nodeMap.get(id);
      // 重绘高亮圆
      const { gfx } = sprite;
      gfx.clear();
      gfx.fillStyle(0xffee44, C.HIGHLIGHT_ALPHA);
      gfx.fillCircle(node.x, node.y, C.NODE_RADIUS + 9);
      gfx.fillStyle(C.NODE_COLOR_HOVER, 1);
      gfx.fillCircle(node.x, node.y, C.NODE_RADIUS);
      gfx.lineStyle(2, 0xffffff, 1);
      gfx.strokeCircle(node.x, node.y, C.NODE_RADIUS);
      // 脉冲动画
      this.scene.tweens.add({
        targets: gfx,
        alpha: { from: 0.7, to: 1 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  clearHighlight() {
    for (const id of this._highlighted) {
      const sprite = this._nodeSprites.get(id);
      const node   = this._nodeMap.get(id);
      if (!sprite || !node) continue;
      this.scene.tweens.killTweensOf(sprite.gfx);
      const color = node.isHome  ? C.NODE_COLOR_HOME
                  : node.isStart ? C.NODE_COLOR_START
                  :                C.NODE_COLOR_NORMAL;
      sprite.gfx.clear();
      sprite.gfx.fillStyle(color, 1);
      sprite.gfx.fillCircle(node.x, node.y, C.NODE_RADIUS);
      sprite.gfx.lineStyle(2, 0xffffff, 0.8);
      sprite.gfx.strokeCircle(node.x, node.y, C.NODE_RADIUS);
      sprite.gfx.alpha = 1;
    }
    this._highlighted = new Set();
  }

  _glowNode(id, on) {
    const sprite = this._nodeSprites.get(id);
    if (!sprite) return;
    const node = this._nodeMap.get(id);
    sprite.gfx.clear();
    if (on) {
      sprite.gfx.fillStyle(0xffffff, 0.7);
      sprite.gfx.fillCircle(node.x, node.y, C.NODE_RADIUS + 12);
    }
    const color = this._highlighted.has(id)
      ? C.NODE_COLOR_HOVER
      : (node.isHome ? C.NODE_COLOR_HOME : node.isStart ? C.NODE_COLOR_START : C.NODE_COLOR_NORMAL);
    sprite.gfx.fillStyle(color, 1);
    sprite.gfx.fillCircle(node.x, node.y, C.NODE_RADIUS);
    sprite.gfx.lineStyle(2, 0xffffff, 1);
    sprite.gfx.strokeCircle(node.x, node.y, C.NODE_RADIUS);
  }

  /**
   * 注册节点点击监听
   * @param {function(nodeId: number): void} callback
   */
  onNodeClick(callback) {
    for (const [id, { zone }] of this._nodeSprites) {
      zone.on('pointerdown', () => callback(id));
    }
  }

  destroy() {
    this._branchGfx?.destroy();
    for (const { gfx, zone } of this._nodeSprites.values()) {
      gfx.destroy();
      zone.destroy();
    }
  }
}
