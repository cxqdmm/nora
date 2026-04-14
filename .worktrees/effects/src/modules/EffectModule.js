// ============================================================
//  EffectModule.js — 状态装饰效果渲染器
//  纯函数式，每个方法画到传入的 Graphics 上，不持有状态
// ============================================================

export class EffectModule {
  // ── 火焰效果 ─────────────────────────────────────────────
  // 在 (x, y) 处画一团卡通火焰，scale 控制大小
  static drawFire(gfx, x, y, scale = 1) {
    // 外层大火焰（橙色）
    gfx.fillStyle(0xff6600, 0.85);
    gfx.fillTriangle(
      x,                y - 28 * scale,
      x - 12 * scale,  y,
      x + 12 * scale,  y
    );
    // 中层火焰（橙黄）
    gfx.fillStyle(0xff9900, 1);
    gfx.fillTriangle(
      x,                y - 20 * scale,
      x - 8 * scale,   y - 2 * scale,
      x + 8 * scale,   y - 2 * scale
    );
    // 内芯（黄色）
    gfx.fillStyle(0xffdd00, 1);
    gfx.fillCircle(x, y - 4 * scale, 5 * scale);
    // 小火星点
    gfx.fillStyle(0xffcc00, 0.7);
    gfx.fillCircle(x - 4 * scale, y - 16 * scale, 2 * scale);
    gfx.fillCircle(x + 5 * scale, y - 14 * scale, 1.5 * scale);
  }

  // ── 彩色光晕效果 ──────────────────────────────────────────
  // 在 (x, y) 处画三层脉冲圆环
  static drawGlow(gfx, x, y, color = 0xff4444) {
    // 外圈（淡）
    gfx.fillStyle(color, 0.15);
    gfx.fillCircle(x, y, 32);
    // 中圈
    gfx.fillStyle(color, 0.25);
    gfx.fillCircle(x, y, 22);
    // 内圈（稍浓）
    gfx.fillStyle(color, 0.4);
    gfx.fillCircle(x, y, 14);
  }

  // ── 睡眠气泡效果 ──────────────────────────────────────────
  // 画一排 ZZZ 气泡（浮动感）
  static drawSleepBubble(gfx, x, y, scale = 1) {
    const colors  = [0x90caf9, 0x64b5f6, 0x42a5f5];
    const offsets = [
      { dx: 12 * scale, dy: -30 * scale, r: 8  * scale },
      { dx: 22 * scale, dy: -22 * scale, r: 6  * scale },
      { dx: 30 * scale, dy: -16 * scale, r: 5  * scale },
    ];
    for (let i = 0; i < 3; i++) {
      gfx.fillStyle(colors[i], 0.8);
      gfx.fillCircle(x + offsets[i].dx, y + offsets[i].dy, offsets[i].r);
    }
  }
}
