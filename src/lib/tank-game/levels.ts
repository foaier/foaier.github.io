export const TILE = 24;
export const COLS = 25;
export const ROWS = 21;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
export const BASE = { col: 12, row: 19 };
export const PLAYER_SPAWN = { col: 10, row: 19 };
export const SPAWNS = [1, 12, 23].map((col) => ({ col, row: 1 }));

export type Tile = 0 | 1 | 2 | 3 | 4 | 5;
export type EnemyKind = "scout" | "runner" | "gunner" | "armor" | "commander";
export type Level = {
  id: number;
  name: string;
  chapter: number;
  tip: string;
  enemies: number;
  active: number;
  interval: number;
  speed: number;
  fireDelay: number;
  boss: boolean;
  tiles: Tile[];
  roster: EnemyKind[];
};

export const CHAPTERS = [
  { name: "绿野哨站", subtitle: "学会移动，守住第一道防线", color: "#d9bb6c", ground: "#293a31", detail: "#35463a", brick: "#ac7451", steel: "#89998b", water: "#315d66", foliage: "#496b43" },
  { name: "沙海前线", subtitle: "绕过水道，截住快速突袭", color: "#e8b876", ground: "#514734", detail: "#60523b", brick: "#bd8759", steel: "#a79e80", water: "#3b6970", foliage: "#647348" },
  { name: "霜原要塞", subtitle: "冰面机动，迎战装甲部队", color: "#a8d6df", ground: "#354a51", detail: "#40575c", brick: "#9b8582", steel: "#acbec3", water: "#356879", foliage: "#527568" },
  { name: "暮色城区", subtitle: "穿过街巷，拆解交叉火力", color: "#d6a2a0", ground: "#39383e", detail: "#47434a", brick: "#a77168", steel: "#93999b", water: "#3e5d6a", foliage: "#4e6554" },
  { name: "熔火决战", subtitle: "重装集结，守住最后的基地", color: "#eda275", ground: "#3e342f", detail: "#4c3e35", brick: "#b46647", steel: "#a29b8b", water: "#4b6667", foliage: "#626c44" },
] as const;

const NAMES = [
  "初次出击", "砖墙之间", "林间小路", "两翼来袭", "十字路口", "河岸守卫", "钢铁屏障", "森林伏击", "三路合围", "哨站保卫战",
  "沙丘行军", "干涸河床", "绿洲通道", "迂回包抄", "废墟交火", "狭路相逢", "断桥两端", "沙海迷阵", "疾速追击", "沙堡攻防战",
  "初雪警戒", "冰河穿越", "冻土阵地", "雪松掩护", "装甲先锋", "冰面交锋", "钢墙回廊", "寒潮突袭", "重装围猎", "霜原突破战",
  "街区封锁", "巷口交火", "废厂巡逻", "中央大道", "双线压制", "暗巷追踪", "十字火网", "城市边缘", "午夜围城", "暮色防御战",
  "焦土推进", "钢铁峡谷", "火线穿行", "装甲洪流", "多点突破", "最后补给", "重炮封锁", "四面楚歌", "黎明之前", "最后的堡垒",
];

const TIPS = [
  "黄色是你的坦克。方向键移动，空格开火，先消灭正前方的敌人。",
  "砖墙可以击碎，钢墙会挡住炮弹。试着打开一条射击通道。",
  "树林能藏住坦克，但挡不住炮弹。留意树丛里的红色履带。",
  "别只追着一辆敌军跑，基地附近的两条侧路也要看住。",
  "路口火力密集，先退到掩体后，再转向反击。",
  "水面不能通行，炮弹却能飞过去。注意对岸的敌人。",
  "钢墙后面适合躲避。拾取火力道具后，可以击穿钢墙。",
  "绿箱修复装甲，蓝盾抵挡伤害；每击毁四辆敌军会掉落补给。",
  "敌人会从三个入口轮流出现，靠近基地防守更容易兼顾两侧。",
  "本关有重装指挥车。先清掉护卫，再集中火力。",
];

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Ten terrain compositions, with five authored themes and a stable seed per stage.
// Reserved roads keep every spawn connected even before any brick is destroyed.
function buildMap(id: number): Tile[] {
  const chapter = Math.floor((id - 1) / 10);
  const layout = (id - 1) % 10;
  const rand = random(id * 7919);
  const tiles: Tile[] = Array(COLS * ROWS).fill(0);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const index = row * COLS + col;
      if (row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1) {
        tiles[index] = 2;
        continue;
      }
      const roll = rand();
      const mirror = Math.min(col, COLS - 1 - col);
      const patterns = [
        row % 4 === 3 && mirror % 4 !== 0,
        col % 4 === 3 && row % 4 !== 0,
        (row + mirror) % 5 < 2,
        row % 5 < 2 && mirror > 2,
        Math.abs(col - 12) === 4 || row === 8 || row === 13,
        row % 6 === 3 || col % 6 === 3,
        mirror % 5 === 3 || (row % 5 === 2 && mirror > 3),
        (Math.floor(col / 3) + Math.floor(row / 3)) % 2 === 0,
        (row + col + chapter) % 6 < 2,
        row % 3 === 0 && mirror > 1,
      ];
      if (patterns[layout]) tiles[index] = roll < 0.14 + chapter * 0.035 && id >= 7 ? 2 : 1;
      else if (roll < 0.1 + chapter * 0.012) tiles[index] = 4;
      else if (chapter === 2 && roll < 0.32) tiles[index] = 5;
      if (id >= 6 && row >= 6 && row <= 14 && (col === 4 + layout % 3 || col === 20 - layout % 3) && row % 5 !== 0) tiles[index] = 3;
      if ([1, 6, 12, 18, 23].includes(col) || [1, 5, 10, 15, 19].includes(row)) {
        if (tiles[index] !== 4 && tiles[index] !== 5) tiles[index] = 0;
      }
      if (row >= 17 && col >= 9 && col <= 15) tiles[index] = 0;
    }
  }
  for (const { col, row } of SPAWNS) tiles[row * COLS + col] = 0;
  for (const [col, row] of [[11, 18], [12, 18], [13, 18], [11, 19], [13, 19]]) tiles[row * COLS + col] = 1;
  return tiles;
}

function rosterFor(id: number, count: number): EnemyKind[] {
  return Array.from({ length: count }, (_, index) => {
    if (id % 10 === 0 && index === count - 1) return "commander";
    if (id >= 21 && (index + id) % 4 === 0) return "armor";
    if (id >= 12 && index % 3 === 2) return "gunner";
    if (id >= 5 && index % 3 === 1) return "runner";
    return "scout";
  });
}

export const LEVELS: Level[] = NAMES.map((name, index) => {
  const id = index + 1;
  const enemies = 4 + Math.floor(index / 2);
  return {
    id, name, chapter: Math.floor(index / 10),
    tip: TIPS[index % 10], enemies,
    active: Math.min(5, 2 + Math.floor(index / 12)),
    interval: Math.max(1.7, 4.5 - index * 0.055),
    speed: 31 + index * 0.52,
    fireDelay: Math.max(1.2, 3.4 - index * 0.039),
    boss: id % 10 === 0,
    tiles: buildMap(id), roster: rosterFor(id, enemies),
  };
});
