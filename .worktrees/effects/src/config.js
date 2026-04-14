// ============================================================
//  config.js — 全局常量，所有模块共享
// ============================================================

export const CONFIG = {
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,

  // ---------- 能量系统 ----------
  ENERGY: {
    INITIAL: 120,
    DRAIN_PER_PX: 0.22,   // 每移动 1 像素消耗能量
    FOOD: {
      leaf:  15,
      berry: 30,
      apple: 50,
    },
  },

  // ---------- 毛毛虫 ----------
  CATERPILLAR: {
    SPEED: 160,           // 像素/秒
    BODY_SEGMENTS: 5,
    HEAD_RADIUS: 14,
    BODY_RADIUS: 10,
    SEGMENT_GAP: 22,      // 身体节间距
    COLOR_HEAD:   0x4e8b2e,
    COLOR_BODY:   0x72b83e,
    COLOR_STRIPE: 0x3a6a20,
    COLOR_EYE_W:  0xffffff,
    COLOR_EYE_P:  0x222222,
    COLOR_ANTENNA:0x2d5018,
  },

  // ---------- 地图 ----------
  MAP: {
    BRANCH_COLOR:        0x7a4f1e,
    BRANCH_SHADOW_COLOR: 0x4e2e08,
    BRANCH_WIDTH_MAIN:   18,
    BRANCH_WIDTH_SUB:    13,
    NODE_RADIUS:         14,
    NODE_COLOR_NORMAL:   0xb8924a,
    NODE_COLOR_HOVER:    0xffd966,
    NODE_COLOR_HOME:     0xff7043,
    NODE_COLOR_START:    0x64b5f6,
    HIGHLIGHT_ALPHA:     0.55,
    BARK_LINES:          6,       // 每段树枝的纹理线条数
  },

  // ---------- 视觉 ----------
  COLORS: {
    BG_TOP:    0xb8e4a0,
    BG_BOTTOM: 0x7dbf58,
    PANEL_BG:  0x2d1a00,
  },

  // ---------- UI ----------
  UI: {
    BAR_X: 20,
    BAR_Y: 20,
    BAR_W: 200,
    BAR_H: 22,
    BAR_COLOR_BG:   0x333333,
    BAR_COLOR_FILL: 0x55dd44,
    BAR_COLOR_LOW:  0xff4444,
    LOW_THRESHOLD:  0.25,         // 能量低于 25% 显示红色
  },

  // ---------- 道具 ----------
  ITEMS: {
    DROP_CHANCE: {
      leaf:  { knife: 0.20, potion: 0    },
      berry: { knife: 0    , potion: 0.20 },
      apple: { knife: 0.15 , potion: 0.15 },
    },
  },

  // ---------- NPC ----------
  NPC: {
    FROG: {
      SLEEP_DURATION_MS: 5000,
      SNEAK_ENERGY_COST: 20,
    },
  },
};
