import { hash } from '../core/math';
import { Tile, TileMap, distanceField, isSolidTile } from './TileMap';

export type BuildingKind = 'home' | 'smith' | 'shop' | 'clinic' | 'guild' | 'house';

export interface Building {
  kind: BuildingKind;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roof: string;
  wall: string;
  door: [number, number];
  chimney?: boolean;
  /** 民居敲门时的说明 */
  note?: string;
}

export type ForageArea = 'forest' | 'meadow' | 'beach';

export interface Overworld {
  map: TileMap;
  buildings: Building[];
  spawns: { home: [number, number]; mine: [number, number] };
  field: [number, number, number, number];
  /** 路牌：键为 "x,y" */
  signs: Record<string, string>;
  lamps: [number, number][];
  /** 每天刷新采集物的候选格子（都能从家门口走到） */
  forage: Record<ForageArea, [number, number][]>;
  /** 萤火森林的范围，夜里在这里画萤火虫 */
  forest: [number, number, number, number];
}

export const OW_W = 84;
export const OW_H = 56;

/** 通往相邻区域的路口：北边（x 范围）去北山，西边和东边（y 范围）去湿地和雾语森林 */
export const TOWN_GATES = { n: [19, 20], w: [9, 10], e: [9, 10] } as const;

/** 河流和湖泊在地图上的位置 */
const LAKE = { cx: 13.5, cy: 41, rx: 9.2, ry: 5.6 };
const RIVER_Y = 40;
const RIVER_TURN = 57;
const MINE_ROAD = 46;

/**
 * 萤石谷地表：
 * 西边是农场，北边沿着大路是小镇和广场，东边是萤火森林，
 * 西南是镜湖，一条河从湖里流出来向东拐进南边的悬崖，
 * 矿脉入口在南边的悬崖下。
 */
export function buildOverworld(): Overworld {
  const m = new TileMap(OW_W, OW_H, Tile.GRASS);
  const grassOnly = (x: number, y: number, t: number) => {
    if (m.get(x, y) === Tile.GRASS) m.set(x, y, t);
  };

  // 边界：北、西、东是树林，南边是悬崖
  for (let x = 0; x < OW_W; x++) {
    m.set(x, 0, Tile.TREE);
    m.set(x, 1, Tile.TREE);
    for (let y = 50; y < OW_H; y++) m.set(x, y, Tile.CLIFF);
    // 悬崖边缘参差一点
    if (hash(x, 49) < 0.22 && Math.abs(x - MINE_ROAD) > 4 && Math.abs(x - RIVER_TURN) > 2) m.set(x, 49, Tile.CLIFF);
  }
  for (let y = 0; y < 50; y++) {
    m.set(0, y, Tile.TREE);
    m.set(1, y, Tile.TREE);
    m.set(OW_W - 1, y, Tile.TREE);
    m.set(OW_W - 2, y, Tile.TREE);
  }

  // 萤火森林：深色草地上长满树，中间一条弯弯曲曲的小路和两块空地
  const forest: [number, number, number, number] = [67, 2, 81, 48];
  for (let y = 2; y <= 49; y++) for (let x = 67; x <= 81; x++) if (m.get(x, y) === Tile.GRASS) m.set(x, y, Tile.FOREST);
  const clearings: [number, number, number][] = [[75, 24, 3.2], [72, 37, 3], [77, 44, 2.5]];
  const inClearing = (x: number, y: number) => clearings.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) < r);
  for (let y = 2; y <= 49; y++) for (let x = 67; x <= 81; x++) {
    if (m.get(x, y) !== Tile.FOREST || inClearing(x, y)) continue;
    const edge = x === 67 ? 0.35 : 0.62;
    if (hash(x * 3, y * 5) < edge) m.set(x, y, Tile.TREE);
  }
  const trail: [number, number][] = [];
  let tx = 73;
  for (let y = 11; y <= 46; y++) {
    tx += Math.round(Math.sin(y * 0.45) * 0.9);
    tx = Math.max(70, Math.min(79, tx));
    trail.push([tx, y], [tx + 1, y]);
  }
  for (const [x, y] of trail) m.set(x, y, Tile.PATH);
  for (const [cx, cy, r] of clearings) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (Math.hypot(x - cx, y - cy) < r && m.get(x, y) === Tile.FOREST && hash(x, y * 7) < 0.3) m.set(x, y, Tile.FLOWER);
    }
  }

  // 镜湖和流出来的河，湖边一圈沙滩
  for (let y = 30; y < 50; y++) for (let x = 2; x < 28; x++) {
    const d = Math.hypot((x - LAKE.cx) / LAKE.rx, (y - LAKE.cy) / LAKE.ry);
    if (d < 1) m.set(x, y, Tile.WATER);
    else if (d < 1.28) m.set(x, y, Tile.SAND);
  }
  for (let x = Math.floor(LAKE.cx + LAKE.rx) - 1; x <= RIVER_TURN + 1; x++) {
    m.set(x, RIVER_Y, Tile.WATER);
    m.set(x, RIVER_Y + 1, Tile.WATER);
  }
  for (let y = RIVER_Y; y <= 49; y++) {
    m.set(RIVER_TURN, y, Tile.WATER);
    m.set(RIVER_TURN + 1, y, Tile.WATER);
  }

  // 大路，西头通往星湖湿地，东头穿过萤火森林通往雾语森林
  m.fill(0, TOWN_GATES.w[0], 72, TOWN_GATES.w[1], Tile.PATH);
  m.fill(72, TOWN_GATES.e[0], OW_W - 1, TOWN_GATES.e[1], Tile.PATH);
  // 往北上山的小路
  m.fill(TOWN_GATES.n[0], 0, TOWN_GATES.n[1], 8, Tile.PATH);

  // 农场：围栏里是一大片田
  const field: [number, number, number, number] = [5, 13, 24, 26];
  for (let x = 4; x <= 25; x++) {
    m.set(x, 12, Tile.FENCE);
    m.set(x, 27, Tile.FENCE);
  }
  for (let y = 12; y <= 27; y++) {
    m.set(4, y, Tile.FENCE);
    m.set(25, y, Tile.FENCE);
  }
  m.fill(field[0], field[1], field[2], field[3], Tile.FIELD);
  m.fill(8, 8, 9, 12, Tile.PATH);
  m.fill(25, 18, 25, 19, Tile.PATH);
  m.fill(26, 18, 29, 19, Tile.PATH);
  m.fill(30, 11, 31, 19, Tile.PATH);
  m.set(11, 8, Tile.BIN);

  // 广场和喷泉
  m.fill(36, 12, 56, 20, Tile.PLAZA);
  m.fill(45, 15, 47, 17, Tile.FOUNTAIN);
  m.fill(44, 11, 48, 11, Tile.PATH);
  for (const [x, y] of [[40, 14], [52, 14], [40, 18], [52, 18]]) m.set(x, y, Tile.BENCH);

  // 去矿脉的路，过河的地方架一座桥
  m.fill(MINE_ROAD, 21, MINE_ROAD + 1, 49, Tile.PATH);
  m.fill(MINE_ROAD, RIVER_Y, MINE_ROAD + 1, RIVER_Y + 1, Tile.BRIDGE);
  m.set(MINE_ROAD, 50, Tile.CAVE);
  // 去湖边和森林的小路
  m.fill(24, 30, 31, 31, Tile.PATH);
  m.fill(30, 20, 31, 29, Tile.PATH);
  m.fill(57, 17, 62, 17, Tile.PATH);

  const buildings: Building[] = [
    { kind: 'home', name: '家', x: 5, y: 3, w: 6, h: 5, roof: '#b84a3a', wall: '#e3c9a0', door: [8, 7], chimney: true },
    { kind: 'smith', name: '铁匠铺', x: 32, y: 3, w: 6, h: 5, roof: '#4a4f5c', wall: '#9a8a78', door: [34, 7], chimney: true },
    { kind: 'shop', name: '杂货店', x: 40, y: 3, w: 6, h: 5, roof: '#3f8f7a', wall: '#efdcb4', door: [42, 7] },
    { kind: 'clinic', name: '诊所', x: 48, y: 3, w: 6, h: 5, roof: '#d7d2e8', wall: '#f4f0ea', door: [50, 7] },
    { kind: 'guild', name: '冒险者公会', x: 56, y: 3, w: 7, h: 5, roof: '#6b3a5a', wall: '#c9b08a', door: [59, 7], chimney: true },
    { kind: 'house', name: '小橡家', x: 60, y: 13, w: 5, h: 4, roof: '#c98a3a', wall: '#f0e0c0', door: [62, 16], note: '小橡家。门上挂着一块歪歪扭扭的牌子：「冒险者总部」。' },
    { kind: 'house', name: '空屋', x: 64, y: 3, w: 5, h: 5, roof: '#5a6a8a', wall: '#cfc6b8', door: [66, 7], note: '门锁着。窗户上落满了灰，好像很久没人住了。' },
  ];
  for (const b of buildings) {
    m.fill(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, Tile.WALL);
    m.set(b.door[0], b.door[1], Tile.DOOR);
    if (m.get(b.door[0], b.door[1] + 1) !== Tile.PATH) m.set(b.door[0], b.door[1] + 1, Tile.PATH);
  }

  // 路灯和路牌
  const lamps: [number, number][] = [
    [14, 11], [22, 11], [28, 11], [38, 11], [54, 11], [64, 11], [70, 11],
    [36, 12], [56, 12], [36, 20], [56, 20], [45, 28], [48, 34], [45, 46], [48, 47],
  ];
  for (const [x, y] of lamps) m.set(x, y, Tile.LAMP);
  const signs: Record<string, string> = {
    '6,8': '萤石谷农场。祖母留下的地，围栏里都可以耕种。',
    '45,22': '↑ 小镇广场　↓ 老矿脉入口　← 农场　→ 萤火森林',
    '71,11': '萤火森林。林子里能捡到蘑菇和坚果，夏天的夜里有很多萤火虫。',
    '24,32': '镜湖。湖边的沙滩上偶尔能捡到贝壳。',
    '48,48': '老矿脉入口。越往深处走，怪物越强，矿石也越好。',
    '29,11': '→ 小镇　铁匠铺 · 杂货店 · 诊所 · 冒险者公会',
    '21,6': '↑ 北山岩地。山口以前被一大团凝胶堵着。',
    '3,8': '← 星湖湿地',
    '80,8': '→ 雾语森林。起雾的时候别走散了。',
  };
  for (const k of Object.keys(signs)) {
    const [x, y] = k.split(',').map(Number);
    m.set(x, y, Tile.SIGN);
  }

  // 树丛、灌木、石头和野花，只放在草地上
  const clusters: [number, number, number, number, number][] = [
    [2, 2, 3, 48, 0.5], [12, 2, 31, 2, 0.6], [26, 3, 31, 7, 0.45], [31, 2, 66, 2, 0.5],
    [2, 28, 29, 33, 0.3], [26, 22, 29, 29, 0.35], [32, 23, 41, 31, 0.32], [51, 23, 62, 32, 0.32],
    [58, 18, 66, 30, 0.28], [26, 43, 42, 48, 0.35], [49, 43, 55, 48, 0.3], [60, 33, 66, 48, 0.4],
    [2, 47, 24, 48, 0.3], [32, 34, 44, 38, 0.3], [49, 34, 55, 38, 0.3],
  ];
  for (const [x0, y0, x1, y1, d] of clusters) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (hash(x, y) < d) grassOnly(x, y, Tile.TREE);
  }
  for (let x = 2; x < OW_W - 2; x++) for (let y = 2; y < 50; y++) {
    const r = hash(y * 7, x * 3);
    const town = x >= 30 && x <= 66 && y <= 21;
    if (r < 0.06) grassOnly(x, y, Tile.FLOWER);
    else if (r < 0.085 && !town && y > 21) grassOnly(x, y, Tile.BUSH);
    else if (r < 0.095 && !town && y > 21) grassOnly(x, y, Tile.STONE);
  }

  const spawns: Overworld['spawns'] = { home: [8, 8], mine: [MINE_ROAD, 49] };

  // 采集点：只保留能从家门口走到的格子
  const dist = distanceField(m, spawns.home[0], spawns.home[1], (t) => !isSolidTile(t));
  const reach = (x: number, y: number) => dist[y * m.w + x] >= 0;
  const forage: Overworld['forage'] = { forest: [], meadow: [], beach: [] };
  for (let y = 2; y < 50; y++) for (let x = 2; x < OW_W - 2; x++) {
    if (!reach(x, y)) continue;
    const t = m.get(x, y);
    if ((t === Tile.FOREST || t === Tile.FLOWER) && x >= forest[0]) forage.forest.push([x, y]);
    else if (t === Tile.SAND) forage.beach.push([x, y]);
    else if ((t === Tile.GRASS || t === Tile.FLOWER) && y >= 22 && x < forest[0]) forage.meadow.push([x, y]);
  }

  return { map: m, buildings, spawns, field, signs, lamps, forage, forest };
}
