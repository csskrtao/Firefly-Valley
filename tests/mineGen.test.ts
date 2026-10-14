import { describe, expect, it } from 'vitest';
import { MAX_FLOOR, ZONES, isBossFloor, zoneFor } from '../src/data/floors';
import { generateFloor } from '../src/world/mineGen';
import { buildOverworld } from '../src/world/overworld';
import { Tile, distanceField, isSolidTile } from '../src/world/TileMap';

/** 固定种子的伪随机数，保证测试可复现 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const walkable = (t: number) => t === Tile.FLOOR || t === Tile.STAIRS;

describe('mine generation', () => {
  for (let floor = 1; floor <= MAX_FLOOR; floor++) {
    it(`floor ${floor} is fully connected across many seeds`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const L = generateFloor(floor, mulberry32(seed * 1000 + floor));
        const dist = distanceField(L.map, L.spawn[0], L.spawn[1], walkable);
        const at = (x: number, y: number) => dist[y * L.map.w + x];
        if (isBossFloor(floor)) {
          expect(L.stairs).toBeNull();
          expect(L.boss?.id).toBe(zoneFor(floor).boss.id);
          expect(L.monsters).toHaveLength(0);
          const [bx, by] = L.bossExit!;
          expect(at(bx, by)).toBeGreaterThan(0);
          expect(at(L.boss!.tx, L.boss!.ty)).toBeGreaterThan(0);
        } else {
          const [sx, sy] = L.stairs!;
          expect(L.map.get(sx, sy)).toBe(Tile.STAIRS);
          expect(at(sx, sy)).toBeGreaterThan(0);
          expect(L.boss).toBeNull();
          expect(L.monsters.length).toBeGreaterThan(0);
        }
        // 出生点旁边就是梯子
        expect(L.map.get(L.ladder[0], L.ladder[1])).toBe(Tile.LADDER);
        // 矿石、怪物、萤石都在能走到的格子上，而且互不重叠
        const seen = new Set<string>();
        for (const p of [...L.ores.map((o) => [o.tx, o.ty]), ...L.monsters.map((m) => [m.tx, m.ty]), ...L.crystals]) {
          expect(at(p[0], p[1])).toBeGreaterThan(0);
          const k = `${p[0]},${p[1]}`;
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      }
    });
  }

  it('only spawns ores and monsters that belong to the zone', () => {
    for (const z of ZONES) {
      for (let f = z.from; f <= z.to; f++) {
        const L = generateFloor(f, mulberry32(f));
        for (const o of L.ores) expect(z.ores.map((x) => x.item)).toContain(o.item);
        for (const m of L.monsters) expect(Object.keys(z.monsters)).toContain(m.id);
      }
    }
  });
});

describe('overworld', () => {
  it('connects home, every shop door, the field and the mine', () => {
    const ow = buildOverworld();
    const [hx, hy] = ow.spawns.home;
    const dist = distanceField(ow.map, hx, hy, (t) => !isSolidTile(t));
    const at = (x: number, y: number) => dist[y * ow.map.w + x];
    for (const b of ow.buildings) expect(at(b.door[0], b.door[1] + 1)).toBeGreaterThanOrEqual(0);
    expect(at(ow.spawns.mine[0], ow.spawns.mine[1])).toBeGreaterThan(0);
    expect(at(ow.field[0], ow.field[1])).toBeGreaterThan(0);
    expect(ow.map.get(ow.spawns.mine[0], ow.spawns.mine[1] + 1)).toBe(Tile.CAVE);
  });
});
