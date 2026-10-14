import { describe, expect, it } from 'vitest';
import { NPCS, NPC_IDS } from '../src/data/npcs';
import type { Cell } from '../src/data/treasure';
import { BOOK_TREASURES, BOULDER_RING, BRAZIERS, EVENT_SPOTS, HIDDEN_CHESTS, MAP_SPOTS } from '../src/data/treasure';
import { migrate, newSave } from '../src/state/save';
import * as ex from '../src/systems/explore';
import { placeExploreSites } from '../src/world/exploreSites';
import { buildOverworld } from '../src/world/overworld';
import { Tile, distanceField, findPath, isSolidTile } from '../src/world/TileMap';

/** 固定种子的随机数 */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ow = buildOverworld();
const sites = placeExploreSites(ow);
const m = ow.map;
const [hx, hy] = ow.spawns.home;
const dist = distanceField(m, hx, hy, (t) => !isSolidTile(t));
const reachable = (x: number, y: number) => dist[y * m.w + x] >= 0;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const besideReachable = ([x, y]: Cell) => N4.some(([dx, dy]) => reachable(x + dx, y + dy));

describe('explore sites on the town map', () => {
  it('keeps the town walkable after planting the stone ring', () => {
    for (const area of ['forest', 'meadow', 'beach'] as const) for (const [x, y] of ow.forage[area]) expect(reachable(x, y)).toBe(true);
    for (const [x, y] of sites.digCells) expect(reachable(x, y)).toBe(true);
    const canWalk = (x: number, y: number) => !m.solid(x, y);
    for (const id of NPC_IDS) {
      const stops = NPCS[id].schedule;
      for (let i = 0; i < stops.length; i++) {
        const [, x, y] = stops[i];
        const [, nx, ny] = stops[(i + 1) % stops.length];
        expect(findPath(m, x, y, nx, ny, canWalk)).not.toBeNull();
      }
    }
  });

  it('puts every chest, brazier, event and map spot somewhere you can get to', () => {
    for (const b of BRAZIERS) {
      expect(m.solid(b[0], b[1])).toBe(false);
      expect(m.get(b[0], b[1])).not.toBe(Tile.PATH);
      expect(besideReachable(b)).toBe(true);
    }
    expect(besideReachable(HIDDEN_CHESTS.brazier.at)).toBe(true);
    expect(besideReachable(HIDDEN_CHESTS.detour.at)).toBe(true);
    for (const kind of Object.keys(EVENT_SPOTS) as (keyof typeof EVENT_SPOTS)[]) {
      for (const { at } of EVENT_SPOTS[kind]) {
        expect(m.solid(at[0], at[1])).toBe(false);
        expect(besideReachable(at)).toBe(true);
        if (kind === 'camp') expect(m.solid(at[0] + 1, at[1])).toBe(false);
      }
    }
    for (const { at } of MAP_SPOTS) expect(reachable(at[0], at[1])).toBe(true);
  });

  it('makes the detour chest a real detour: close as the crow flies, far on foot', () => {
    const [cx, cy] = HIDDEN_CHESTS.detour.at;
    const from: Cell = [47, cy];
    expect(reachable(from[0], from[1])).toBe(true);
    const path = findPath(m, from[0], from[1], cx - 1, cy, (x, y) => !m.solid(x, y), 10000)!;
    expect(path.length).toBeGreaterThan(Math.abs(cx - from[0]) * 1.8);
  });

  it('can solve the stone ring by pushing the boulder', () => {
    const inside = new Set(sites.ringInside.map(([x, y]) => `${x},${y}`));
    const chest = HIDDEN_CHESTS.boulder.at;
    const blocked = (x: number, y: number, b: Cell) => m.solid(x, y) || (x === b[0] && y === b[1]) || (x === chest[0] && y === chest[1]);
    // 广度优先搜索（玩家位置，石头位置）
    const start = { p: BOULDER_RING.approach, b: sites.boulderStart };
    const seen = new Set<string>();
    const q = [start];
    let solved = false;
    while (q.length && !solved) {
      const { p, b } = q.shift()!;
      const k = `${p}|${b}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (N4.some(([dx, dy]) => p[0] + dx === chest[0] && p[1] + dy === chest[1])) solved = true;
      for (const [dx, dy] of N4) {
        const nx = p[0] + dx;
        const ny = p[1] + dy;
        if (nx === b[0] && ny === b[1]) {
          const bx = b[0] + dx;
          const by = b[1] + dy;
          if (inside.has(`${bx},${by}`) && !(bx === chest[0] && by === chest[1])) q.push({ p: b, b: [bx, by] });
        } else if (!blocked(nx, ny, b)) q.push({ p: [nx, ny], b });
      }
    }
    expect(solved).toBe(true);
    // 不推石头就进不去：把石头那一格当成墙再算一次
    const [bx, by] = sites.boulderStart;
    m.set(bx, by, Tile.STONE);
    const walled = distanceField(m, hx, hy, (t) => !isSolidTile(t));
    m.set(bx, by, Tile.GRASS);
    expect(N4.some(([dx, dy]) => walled[(chest[1] + dy) * m.w + chest[0] + dx] >= 0)).toBe(false);
  });
});

describe('digging and treasure maps', () => {
  it('spawns dig spots each day away from forage and clears yesterday’s', () => {
    const s = newSave(0, 'warrior');
    s.forage[`${sites.digCells[0][0]},${sites.digCells[0][1]}`] = 'leek';
    ex.newExploreDay(s, sites.digCells, seeded(1));
    expect(s.explore.digs.length).toBeGreaterThanOrEqual(3);
    expect(s.explore.digs).not.toContain(`${sites.digCells[0][0]},${sites.digCells[0][1]}`);
    s.day++;
    const before = [...s.explore.digs];
    ex.newExploreDay(s, sites.digCells, seeded(2));
    expect(s.explore.digs).not.toEqual(before);
    expect(s.explore.day).toBe(s.day);
  });

  it('digs up gold and something, once per spot', () => {
    const s = newSave(0, 'mage');
    s.explore.digs = ['10,40'];
    const gold = s.gold;
    const loot = ex.dig(s, '10,40', seeded(3))!;
    expect(loot.gold).toBeGreaterThan(0);
    expect(Object.keys(loot.items).length).toBeGreaterThan(0);
    expect(s.gold).toBe(gold + loot.gold);
    expect(ex.dig(s, '10,40', seeded(3))).toBeNull();
  });

  it('points a treasure map somewhere and pays out a rare treasure', () => {
    const s = newSave(0, 'rogue');
    s.inv.treasureMap = 2;
    const spot = ex.readMap(s, seeded(4));
    expect(spot).toBeGreaterThanOrEqual(0);
    expect(ex.mapTarget(s)).toEqual(MAP_SPOTS[spot].at);
    const loot = ex.digMap(s, seeded(5))!;
    expect(loot.gold).toBeGreaterThanOrEqual(150);
    expect(Object.keys(loot.items).some((id) => BOOK_TREASURES.includes(id as never))).toBe(true);
    // 还剩一张图：接着指向下一个地点
    expect(s.inv.treasureMap).toBe(1);
    expect(ex.mapTarget(s)).not.toBeNull();
    ex.digMap(s, seeded(6));
    expect(s.inv.treasureMap).toBeUndefined();
    expect(ex.mapTarget(s)).toBeNull();
  });
});

describe('hidden chests and events', () => {
  it('opens each hidden chest only once', () => {
    const s = newSave(0, 'warrior');
    const loot = ex.openHidden(s, 'boulder')!;
    expect(loot.items.bronzeAmulet).toBe(1);
    expect(s.gear.some((g) => g.acc === 'bronzeAmulet')).toBe(true); // 饰品拿到时会变成装备
    expect(ex.openHidden(s, 'boulder')).toBeNull();
  });

  it('needs all three braziers lit', () => {
    const s = newSave(0, 'warrior');
    expect(ex.lightBrazier(s, 0, 3)).toBe(false);
    expect(ex.lightBrazier(s, 0, 3)).toBe(false);
    expect(ex.lightBrazier(s, 1, 3)).toBe(false);
    expect(ex.lightBrazier(s, 2, 3)).toBe(true);
    s.day++;
    ex.newExploreDay(s, sites.digCells, seeded(7));
    expect(s.explore.lit).toEqual([]);
  });

  it('sells the one-off merchant goods once', () => {
    const s = newSave(0, 'warrior');
    s.gold = 5000;
    s.explore.event = { kind: 'merchant', spot: 0, stage: 0, sold: [] };
    const map = ex.merchantStock(s).find((i) => i.id === 'treasureMap')!;
    expect(ex.buyFromMerchant(s, map).ok).toBe(true);
    expect(ex.mapTarget(s)).not.toBeNull();
    const again = ex.merchantStock(s).find((i) => i.id === 'treasureMap')!;
    expect(again.soldOut).toBe(true);
    expect(ex.buyFromMerchant(s, again).ok).toBe(false);
    const potion = ex.merchantStock(s).find((i) => i.id === 'bigPotion')!;
    expect(ex.buyFromMerchant(s, potion).ok).toBe(true);
    expect(ex.buyFromMerchant(s, potion).ok).toBe(true);
  });

  it('rewards helping the traveler with a potion', () => {
    const s = newSave(0, 'warrior');
    s.explore.event = { kind: 'traveler', spot: 0, stage: 0, sold: [] };
    expect(ex.travelerCures(s)).toContain('potion');
    const gold = s.gold;
    const loot = ex.helpTraveler(s, 'potion', seeded(8))!;
    expect(s.gold).toBe(gold + loot.gold);
    expect(s.inv.potion).toBe(1);
    expect(ex.helpTraveler(s, 'potion', seeded(8))).toBeNull();
  });

  it('locks the camp chest until the camp is cleared', () => {
    const s = newSave(0, 'warrior');
    s.explore.event = { kind: 'camp', spot: 0, stage: 0, sold: [] };
    const chest = { gold: 100, items: {}, blueprint: null };
    expect(ex.openCampChest(s, chest)).toBeNull();
    ex.clearCamp(s);
    expect(s.explore.camps).toBe(1);
    expect(ex.openCampChest(s, chest, seeded(9))).not.toBeNull();
    expect(ex.openCampChest(s, chest)).toBeNull();
  });
});

describe('collection book', () => {
  it('tracks treasures, monsters and forage and pays out once', () => {
    const s = newSave(0, 'warrior');
    expect(ex.bookProgress(s, 'forage').have).toBe(0);
    ex.record(s, 'leek');
    ex.record(s, 'leek');
    expect(ex.bookProgress(s, 'forage').have).toBe(1);
    s.kills.slime = 3;
    expect(ex.bookEntries(s, 'monster').find((e) => e.name === '绿史莱姆')?.note).toBe('3 只');
    for (const id of BOOK_TREASURES) ex.record(s, id);
    expect(ex.canClaim(s, 'treasure', 'half')).toBe(true);
    expect(ex.canClaim(s, 'treasure', 'full')).toBe(false);
    const gold = s.gold;
    expect(ex.claimBook(s, 'treasure', 'half')).not.toBeNull();
    expect(s.gold).toBe(gold + 300);
    expect(ex.claimBook(s, 'treasure', 'half')).toBeNull();
    for (const id of ['boulder', 'brazier', 'detour'] as const) ex.openHidden(s, id);
    expect(ex.claimBook(s, 'treasure', 'full')?.items.compass).toBe(1);
  });

  it('gives old saves an empty explore record', () => {
    const old = { version: 3, slot: 0, cls: 'mage', day: 9 };
    const s = migrate(old)!;
    expect(s.explore.digs).toEqual([]);
    expect(s.explore.mapSpot).toBe(-1);
    const partial = migrate({ ...old, explore: { found: ['amber'] } })!;
    expect(partial.explore.found).toEqual(['amber']);
    expect(partial.explore.claimed).toEqual([]);
  });
});
