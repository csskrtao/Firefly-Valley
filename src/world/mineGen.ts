import type { ItemId } from '../data/items';
import type { BossId, MonsterId } from '../data/monsters';
import { isBossFloor, zoneFor } from '../data/floors';
import { weighted } from '../core/math';
import { Tile, TileMap, distanceField } from './TileMap';

export interface FloorLayout {
  map: TileMap;
  floor: number;
  spawn: [number, number];
  ladder: [number, number];
  /** 普通楼层一开始就有的下行楼梯 */
  stairs: [number, number] | null;
  /** Boss 层击败 Boss 后出现楼梯的位置 */
  bossExit: [number, number] | null;
  ores: { tx: number; ty: number; item: ItemId }[];
  monsters: { id: MonsterId; tx: number; ty: number }[];
  crystals: [number, number][];
  boss: { id: BossId; tx: number; ty: number } | null;
}

export const MINE_W = 30;
export const MINE_H = 20;

const passable = (t: number) => t === Tile.FLOOR || t === Tile.STAIRS;

export function generateFloor(floor: number, rand: () => number = Math.random): FloorLayout {
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const zone = zoneFor(floor);
  const boss = isBossFloor(floor);
  const m = new TileMap(MINE_W, MINE_H, Tile.ROCK);
  m.fill(1, 1, MINE_W - 2, MINE_H - 2, Tile.FLOOR);

  const ladder: [number, number] = [5, 5];
  const spawn: [number, number] = [5, 6];

  if (!boss) {
    // 随机岩柱和小石堆
    const blobs = 30 + floor * 2;
    for (let i = 0; i < blobs; i++) {
      const x = ri(1, MINE_W - 2);
      const y = ri(1, MINE_H - 2);
      if (Math.abs(x - spawn[0]) + Math.abs(y - spawn[1]) < 4) continue;
      m.set(x, y, Tile.ROCK);
      if (rand() < 0.45 && x < MINE_W - 2) m.set(x + 1, y, Tile.ROCK);
      if (rand() < 0.35 && y < MINE_H - 2) m.set(x, y + 1, Tile.ROCK);
    }
  } else {
    for (const [x, y] of [[7, 6], [22, 6], [7, 13], [22, 13]]) m.fill(x, y, x + 1, y, Tile.ROCK);
  }
  m.set(ladder[0], ladder[1], Tile.LADDER);
  m.set(spawn[0], spawn[1], Tile.FLOOR);

  // 封掉走不到的区域，保证每个格子都能到达
  const dist = distanceField(m, spawn[0], spawn[1], passable);
  for (let i = 0; i < m.t.length; i++) if (m.t[i] === Tile.FLOOR && dist[i] < 0) m.t[i] = Tile.ROCK;

  const cells: { x: number; y: number; d: number }[] = [];
  for (let i = 0; i < m.t.length; i++) if (dist[i] > 0 && m.t[i] === Tile.FLOOR) cells.push({ x: i % m.w, y: Math.floor(i / m.w), d: dist[i] });

  const used = new Set<string>([`${ladder}`, `${spawn}`]);
  const take = (minD: number) => {
    for (let k = 0; k < 300; k++) {
      const c = cells[Math.floor(rand() * cells.length)];
      const key = `${c.x},${c.y}`;
      if (c.d >= minD && !used.has(key)) {
        used.add(key);
        return c;
      }
    }
    return null;
  };

  let stairs: [number, number] | null = null;
  let bossExit: [number, number] | null = null;
  if (boss) {
    bossExit = [MINE_W - 6, MINE_H - 5];
    used.add(`${bossExit}`);
  } else {
    const far = cells.slice().sort((a, b) => b.d - a.d)[Math.floor(rand() * Math.min(6, cells.length))];
    stairs = [far.x, far.y];
    m.set(far.x, far.y, Tile.STAIRS);
    used.add(`${far.x},${far.y}`);
  }

  const oreWeights: Partial<Record<ItemId, number>> = {};
  for (const o of zone.ores) if (!o.from || floor >= o.from) oreWeights[o.item] = o.weight;
  const ores: FloorLayout['ores'] = [];
  const nOre = boss ? 6 : 8 + Math.floor(floor / 2);
  for (let i = 0; i < nOre; i++) {
    const c = take(3);
    if (c) ores.push({ tx: c.x, ty: c.y, item: weighted(oreWeights, rand()) });
  }

  const crystals: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const c = take(2);
    if (c) crystals.push([c.x, c.y]);
  }

  const monsters: FloorLayout['monsters'] = [];
  if (!boss) {
    const n = (zone.from === 1 ? 5 : 6) + (floor - zone.from);
    for (let i = 0; i < n; i++) {
      const c = take(7);
      if (c) monsters.push({ id: weighted(zone.monsters, rand()), tx: c.x, ty: c.y });
    }
  }

  return {
    map: m, floor, spawn, ladder, stairs, bossExit, ores, monsters, crystals,
    boss: boss ? { id: zone.boss.id, tx: Math.floor(MINE_W / 2), ty: Math.floor(MINE_H / 2) } : null,
  };
}
