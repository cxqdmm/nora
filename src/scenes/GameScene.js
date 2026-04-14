// ============================================================
//  GameScene.js — 主游戏场景，编排所有模块
// ============================================================
import { CONFIG }             from '../config.js';
import { MapModule }          from '../modules/MapModule.js';
import { CaterpillarModule }  from '../modules/CaterpillarModule.js';
import { FoodModule }         from '../modules/FoodModule.js';
import { EnergyModule }       from '../modules/EnergyModule.js';
import { UIModule }           from '../modules/UIModule.js';
import { ItemModule }         from '../modules/ItemModule.js';
import { ObstaclePanel }      from '../ui/ObstaclePanel.js';
import { FrogNPC }            from '../npcs/FrogNPC.js';
import { LEVEL1 }             from '../levels/level1.js';
import { LEVEL2 }             from '../levels/level2.js';
import { LEVEL3 }             from '../levels/level3.js';

const LEVELS = { 1: LEVEL1, 2: LEVEL2, 3: LEVEL3 };

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  // ── 接收关卡参数 ──────────────────────────────────────────
  init(data) {
    this._levelId = data?.levelId ?? 1;
    this._items   = new ItemModule();
  }

  // ── 创建 ─────────────────────────────────────────────────
  create() {
    const levelData = LEVELS[this._levelId];
    if (!levelData) {
      console.error('找不到关卡数据：', this._levelId);
      this.scene.start('MenuScene');
      return;
    }
    this._levelData = levelData;
    this._gameOver  = false;

    try {
      // ── 实例化模块（顺序重要，因为有依赖关系）──────────────
      this._energy  = new EnergyModule(levelData.initialEnergy);
      this._map     = new MapModule(this, levelData);
      this._food    = new FoodModule(this, this._map);
      this._cat     = new CaterpillarModule(this, this._map);
      this._ui      = new UIModule(this, this._energy);

      // ── 创建（绘制）──────────────────────────────────────
      this._map.create();
      this._food.create(levelData);
      this._cat.create(levelData.startNode);
      this._ui.create(levelData);

      // ── 注册 NPC ─────────────────────────────────────────
      if (levelData.npcs) {
        for (const npcDef of levelData.npcs) {
          if (npcDef.type === 'frog') {
            const frog = new FrogNPC({ id: npcDef.id, edgeA: npcDef.edgeA, edgeB: npcDef.edgeB });
            this._map.registerNPC(frog);
          }
        }
      }

      // ── 绑定事件 ────────────────────────────────────────
      this._bindEvents();

      // ── 毛毛虫移动完成回调 ──────────────────────────────
      this._cat.onMoveComplete = (nodeId) => this._onArrived(nodeId);

      // ── 能量耗尽回调 ────────────────────────────────────
      this._energy.onEmpty = () => this._triggerLose();

      // ── 初始高亮可达节点 ────────────────────────────────
      this._refreshHighlight();

      // ── 显示关卡提示 ────────────────────────────────────
      this.time.delayedCall(600, () => {
        this._ui.showMessage(levelData.hint, 3500);
      });

      // ── 返回菜单按钮 ────────────────────────────────────
      this._addBackButton();

      // 淡入（放在最后，确保所有元素都已创建）
      this.cameras.main.fadeIn(400, 0, 0, 0);

    } catch (err) {
      // 把错误渲染到屏幕，方便调试
      console.error('[GameScene] create() 报错：', err);
      this.add.rectangle(400, 300, 740, 180, 0x000000, 0.85);
      this.add.text(400, 270, '⚠️ 游戏加载出错', {
        fontSize: '20px', color: '#ff4444', fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.add.text(400, 310, String(err.message ?? err), {
        fontSize: '13px', color: '#ffaaaa', fontFamily: 'monospace',
        wordWrap: { width: 700 },
      }).setOrigin(0.5);
      this.add.text(400, 360, '点击返回菜单', {
        fontSize: '16px', color: '#88ff88', fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ cursor: 'pointer' })
        .once('pointerdown', () => this.scene.start('MenuScene'));
    }
  }

  // ── 主循环 ────────────────────────────────────────────────
  update() {
    if (!this._gameOver) {
      this._ui.update();
    }
  }

  // ── 事件绑定 ──────────────────────────────────────────────
  _bindEvents() {
    this._map.onNodeClick((nodeId) => {
      if (this._gameOver)      return;
      if (this._cat.isMoving()) return;

      const curId = this._cat.getCurrentNodeId();
      if (!this._map.isConnected(curId, nodeId)) {
        // 点击了不相邻节点，不响应
        return;
      }

      // 高亮取消
      this._map.clearHighlight();

      // 计算能量消耗
      const dist    = this._map.getDistance(curId, nodeId);
      const drain   = dist * CONFIG.ENERGY.DRAIN_PER_PX;

      // 开始移动
      this._cat.moveTo(nodeId);

      // 移动过程中持续扣能量（tween 结束时一次性扣）
      this._pendingDrain = drain;
    });
  }

  // ── 到达节点 ──────────────────────────────────────────────
  _onArrived(nodeId) {
    if (this._gameOver) return;

    // ── NPC 触发检测 ───────────────────────────────────────
    const blockingNpcs = this._map.getBlockingNpcsAtNode(nodeId);
    if (blockingNpcs.length > 0) {
      const npc = blockingNpcs[0];  // 取第一个拦路的 NPC
      npc.activate();
      this._showObstaclePanel(npc);
      return;  // 暂停，等待玩家操作
    }

    // 扣除移动能量
    if (this._pendingDrain > 0) {
      this._energy.drain(this._pendingDrain);
      this._pendingDrain = 0;
    }
    if (this._gameOver) return;  // drain 可能触发了 onEmpty

    // 拾取食物
    const gained = this._food.checkPickup(nodeId);
    if (gained > 0) {
      this._energy.restore(gained);
      const node = this._map.getNode(nodeId);
      this._ui.showFoodPickup(node.x, node.y, `+${gained} ⚡`);
    }

    // 道具掉落检测
    const foodType = this._food.getLastFoodType?.(nodeId);
    if (foodType) {
      const dropped = this._items.rollDrop(foodType);
      if (dropped) {
        this._items.addItem(dropped);
        const icon = dropped === 'knife' ? '🗡️' : '💤';
        this._ui.showMessage(`${icon} 获得道具！`, 2000);
      }
    }

    // 检查是否到达终点
    const node = this._map.getNode(nodeId);
    if (node?.isHome) {
      this._triggerWin();
      return;
    }

    // 检查死路
    if (node?.isDead) {
      this._ui.showMessage('🚫 死路！需要原路返回', 2000);
    }

    // 刷新高亮
    this._refreshHighlight();
  }

  // ── 高亮可点击的相邻节点 ──────────────────────────────────
  _refreshHighlight() {
    const curId    = this._cat.getCurrentNodeId();
    const adjacent = this._map.getConnected(curId);
    this._map.highlightNodes(adjacent);
  }

  // ── 胜利 ─────────────────────────────────────────────────
  _triggerWin() {
    if (this._gameOver) return;
    this._gameOver = true;
    this._map.clearHighlight();

    // 庆祝粒子效果
    this._playWinEffect();

    this.time.delayedCall(1800, () => {
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('WinScene', {
          levelId:    this._levelId,
          energyLeft: Math.ceil(this._energy.getEnergy()),
        });
      });
      this.cameras.main.fadeOut(500, 255, 255, 200);
    });
  }

  // ── 失败 ─────────────────────────────────────────────────
  _triggerLose() {
    if (this._gameOver) return;
    this._gameOver = true;
    this._map.clearHighlight();

    this._ui.showMessage('😢 能量耗尽！毛毛虫累倒了...', 3000);

    // 毛毛虫颤抖动画
    const segs = this._cat._segments;
    this.tweens.add({
      targets: segs,
      x: '+=4',
      duration: 80,
      yoyo: true,
      repeat: 5,
    });

    this.time.delayedCall(2000, () => {
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('LoseScene', { levelId: this._levelId });
      });
      this.cameras.main.fadeOut(600, 20, 0, 0);
    });
  }

  // ── 胜利特效：彩色粒子 ───────────────────────────────────
  _playWinEffect() {
    const node = this._map.getNode(this._levelData.homeNode);
    const colors = [0xffdd00, 0xff6688, 0x66ff99, 0x66ccff, 0xff9944];
    for (let i = 0; i < 30; i++) {
      const gfx = this.add.graphics();
      gfx.fillStyle(Phaser.Utils.Array.GetRandom(colors), 1);
      const size = 4 + Math.random() * 6;
      gfx.fillCircle(node.x, node.y, size);
      this.tweens.add({
        targets: gfx,
        x: node.x + (Math.random() - 0.5) * 200,
        y: node.y + (Math.random() - 0.5) * 200,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 800 + Math.random() * 600,
        ease: 'Power2',
        onComplete: () => gfx.destroy(),
      });
    }
    this._ui.showMessage('🎉 找到家啦！太棒了！', 3000);
  }

  // ── 道具选择面板 ──────────────────────────────────────────
  _showObstaclePanel(npc) {
    this._obstaclePanel = new ObstaclePanel(this, this._items, npc, {
      onKnife: () => this._handleKnife(npc),
      onPotion: () => this._handlePotion(npc),
      onSneak: () => this._handleSneak(npc),
    });
    this._obstaclePanel.show();
  }

  _handleKnife(npc) {
    // 飞刀动画
    this._playKnifeAnimation(npc, () => {
      npc.kill();
      this._resumeAfterObstacle();
    });
  }

  _handlePotion(npc) {
    const duration = CONFIG.NPC?.FROG?.SLEEP_DURATION_MS ?? 5000;
    npc.sleep(duration);
    npc.startCountdownUI(this);
    this._resumeAfterObstacle();
  }

  _handleSneak(npc) {
    const sneakCost = CONFIG.NPC?.FROG?.SNEAK_ENERGY_COST ?? 20;
    this._energy.drain(sneakCost);
    this._ui.showMessage(`🤫 偷偷溜过，消耗 ⚡${sneakCost} 能量`, 2000);
    npc.reset();
    this._resumeAfterObstacle();
  }

  _resumeAfterObstacle() {
    if (this._obstaclePanel) {
      this._obstaclePanel.destroy();
      this._obstaclePanel = null;
    }
    this._refreshHighlight();
  }

  // ── 飞刀动画 ─────────────────────────────────────────────
  _playKnifeAnimation(npc, onComplete) {
    const catPos = this._cat.getHeadPosition?.() ?? { x: 0, y: 0 };
    const na = this._map.getNode(npc.edgeA);
    const nb = this._map.getNode(npc.edgeB);
    if (!na || !nb) { onComplete?.(); return; }
    const targetX = (na.x + nb.x) / 2;
    const targetY = (na.y + nb.y) / 2;

    const knifeGfx = this.scene.add.graphics();
    // 画小刀形状
    knifeGfx.fillStyle(0xcfd8dc, 1);
    knifeGfx.fillRect(-12, -3, 24, 6);
    knifeGfx.fillStyle(0xffd700, 1);
    knifeGfx.fillRect(-4, -6, 8, 12);
    knifeGfx.setPosition(catPos.x, catPos.y);
    knifeGfx.setDepth(200);

    this.scene.tweens.add({
      targets: knifeGfx,
      x: targetX,
      y: targetY,
      angle: 360 * 2,
      duration: 300,
      ease: 'Power1',
      onComplete: () => {
        knifeGfx.destroy();
        onComplete?.();
      },
    });
  }

  // ── 返回菜单按钮 ──────────────────────────────────────────
  _addBackButton() {
    const gfx = this.add.graphics().setScrollFactor(0).setDepth(100);
    gfx.fillStyle(0x000000, 0.4);
    gfx.fillRoundedRect(CONFIG.CANVAS_WIDTH - 90, CONFIG.CANVAS_HEIGHT - 42, 82, 32, 8);

    const btn = this.add.text(
      CONFIG.CANVAS_WIDTH - 49,
      CONFIG.CANVAS_HEIGHT - 26,
      '← 菜单', {
        fontSize: '14px',
        fontFamily: 'Microsoft YaHei, sans-serif',
        color: '#ffffffcc',
      }
    ).setOrigin(0.5).setScrollFactor(0).setDepth(101).setInteractive({ cursor: 'pointer' });

    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout',  () => btn.setColor('#ffffffcc'));
    btn.on('pointerdown', () => {
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
      this.cameras.main.fadeOut(300, 0, 0, 0);
    });
  }

  // ── 销毁 ─────────────────────────────────────────────────
  shutdown() {
    this._obstaclePanel?.destroy();
    this._map?.destroy();
    this._food?.destroy();
    this._cat?.destroy();
    this._ui?.destroy();
  }
}
