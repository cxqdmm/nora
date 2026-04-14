// ============================================================
//  level2.js — 中等关卡：2 条死路，食物适中
//
//  节点结构（800×600）：
//
//            [10] HOME
//              |
//             [9]
//            /   \
//          [6]   [7]
//          |       |
//         [2]     [3]
//        / \       \
//      [5] [1]    [8] ← 死路2
//      ↑死路1
//      [0] START → [1] → [4] ← 死路3? No, keep 2 dead ends
//
//  简化：0起点 → 1主干 → 分三路：左[2]→[5]死路/[6]→[9], 中[3]→[7]→[9], 右[4]→[8]死路
//  [9]→[10]终点
// ============================================================

export const LEVEL2 = {
  id: 2,
  name: '迷雾的森林',
  difficulty: '中等',
  startNode: 0,
  homeNode: 10,
  initialEnergy: 120,

  nodes: [
    { id: 0,  x: 400, y: 555, isStart: true,  label: '起点' },
    { id: 1,  x: 400, y: 455,                 label: ''     },
    { id: 2,  x: 220, y: 355,                 label: ''     },
    { id: 3,  x: 400, y: 355,                 label: ''     },
    { id: 4,  x: 590, y: 355,                 label: ''     },
    { id: 5,  x: 130, y: 245, isDead: true,   label: '死路' }, // 死路1
    { id: 6,  x: 255, y: 245,                 label: ''     },
    { id: 7,  x: 400, y: 230,                 label: ''     },
    { id: 8,  x: 620, y: 245, isDead: true,   label: '死路' }, // 死路2
    { id: 9,  x: 340, y: 145,                 label: ''     },
    { id: 10, x: 340, y:  55, isHome: true,   label: '家'   },
  ],

  edges: [
    [0,  1],
    [1,  2],
    [1,  3],
    [1,  4],
    [2,  5],  // 死路1 分支
    [2,  6],
    [3,  7],
    [4,  8],  // 死路2 分支
    [6,  9],
    [7,  9],
    [9, 10],
  ],

  food: [
    { nodeId: 2,  type: 'leaf'  },
    { nodeId: 5,  type: 'berry' },   // 死路1 有奖励但要回头
    { nodeId: 6,  type: 'leaf'  },
    { nodeId: 8,  type: 'apple' },   // 死路2 高诱惑苹果
    { nodeId: 7,  type: 'berry' },
    { nodeId: 9,  type: 'leaf'  },
  ],

  hint: '树林里有两条死路，走错了就要回头！注意能量！',
};
