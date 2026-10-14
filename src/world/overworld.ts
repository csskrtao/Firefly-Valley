import { hash } from '../core/math';
import { Tile, TileMap } from './TileMap';

export type BuildingKind = 'home' | 'smith' | 'shop' | 'clinic' | 'guild';

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
}

export interface Overworld {
  map: TileMap;
  buildings: Building[];
  spawns: { home: [number, number]; mine: [number, number] };
  field: [number, number, number, number];
}

export const OW_W = 48;
export const OW_H = 30;

/** 萤石谷地表：左边是农场，右上是小镇，南边是矿脉入口。 */
export function buildOverworld(): Overworld {
  const m = new TileMap(OW_W, OW_H, Tile.GRASS);
  // 边界：上、左、右是树林，下方是悬崖
  for (let x = 0; x < OW_W; x++) {
    m.set(x, 0, Tile.TREE);
    m.set(x, 1, Tile.TREE);
    for (let y = 27; y < OW_H; y++) m.set(x, y, Tile.CLIFF);
  }
  for (let y = 0; y < 27; y++) {
    m.set(0, y, Tile.TREE);
    m.set(OW_W - 1, y, Tile.TREE);
  }

  // 主路与通往矿脉的路
  m.fill(4, 9, 45, 9, Tile.PATH);
  m.fill(24, 10, 24, 26, Tile.PATH);
  m.set(24, 27, Tile.CAVE);

  // 农场
  for (let x = 3; x <= 16; x++) { m.set(x, 11, Tile.FENCE); m.set(x, 20, Tile.FENCE); }
  for (let y = 11; y <= 20; y++) { m.set(3, y, Tile.FENCE); m.set(16, y, Tile.FENCE); }
  m.set(5, 11, Tile.PATH);
  m.set(5, 10, Tile.PATH);
  const field: [number, number, number, number] = [4, 12, 15, 19];
  m.fill(field[0], field[1], field[2], field[3], Tile.FIELD);
  m.set(9, 8, Tile.BIN);

  // 广场与喷泉
  m.fill(26, 10, 34, 15, Tile.PLAZA);
  m.fill(29, 12, 30, 13, Tile.FOUNTAIN);

  // 池塘
  for (let x = 36; x <= 43; x++) {
    for (let y = 18; y <= 23; y++) {
      const corner = (x === 36 || x === 43) && (y === 18 || y === 23);
      if (!corner) m.set(x, y, Tile.WATER);
    }
  }

  const buildings: Building[] = [
    { kind: 'home', name: '家', x: 3, y: 4, w: 5, h: 4, roof: '#b84a3a', wall: '#e3c9a0', door: [5, 7] },
    { kind: 'smith', name: '铁匠铺', x: 21, y: 4, w: 5, h: 4, roof: '#4a4f5c', wall: '#9a8a78', door: [23, 7], chimney: true },
    { kind: 'shop', name: '杂货店', x: 28, y: 4, w: 5, h: 4, roof: '#3f8f7a', wall: '#efdcb4', door: [30, 7] },
    { kind: 'clinic', name: '诊所', x: 35, y: 4, w: 5, h: 4, roof: '#d7d2e8', wall: '#f4f0ea', door: [37, 7] },
    { kind: 'guild', name: '冒险者公会', x: 41, y: 4, w: 5, h: 4, roof: '#6b3a5a', wall: '#c9b08a', door: [43, 7] },
  ];
  for (const b of buildings) {
    m.fill(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, Tile.WALL);
    m.set(b.door[0], b.door[1], Tile.DOOR);
    m.set(b.door[0], b.door[1] + 1, Tile.PATH);
  }

  // 树丛（只种在草地上）
  const clusters: [number, number, number, number][] = [
    [1, 2, 2, 26], [9, 2, 19, 2], [17, 13, 21, 25], [26, 18, 33, 25], [44, 11, 46, 26], [36, 11, 41, 15], [10, 22, 16, 25],
  ];
  for (const [x0, y0, x1, y1] of clusters) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if (m.get(x, y) === Tile.GRASS && hash(x, y) < 0.55) m.set(x, y, Tile.TREE);
    }
  }
  // 保证去矿脉的路两侧和 NPC 站位是空的
  for (let y = 10; y <= 26; y++) for (const x of [23, 25]) if (m.get(x, y) === Tile.TREE) m.set(x, y, Tile.GRASS);
  for (let x = 1; x < OW_W - 1; x++) for (let y = 2; y < 27; y++) {
    if (m.get(x, y) === Tile.GRASS && hash(y * 7, x * 3) < 0.06) m.set(x, y, Tile.FLOWER);
  }

  return { map: m, buildings, spawns: { home: [5, 8], mine: [24, 26] }, field };
}
