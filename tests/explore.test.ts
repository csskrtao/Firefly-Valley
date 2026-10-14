import { describe, expect, it } from 'vitest';
import { NPCS, NPC_IDS } from '../src/data/npcs';
import type { Cell } from '../src/data/treasure';
import { BOOK_TREASURES, BOULDER_RING, BRAZIERS, EVENT_SPOTS, HIDDEN_CHESTS, HIDDEN_IDS, MAP_SPOTS, WILD_HIDDEN } from '../src/data/treasure';
import { QUALITIES } from '../src/data/gear';
import { migrate, newSave } from '../src/state/save';
import * as ex from '../src/systems/explore';
import type { ZoneSites } from '../src/world/exploreSites';
import { placeExploreSites, townZone, wildZone } from '../src/world/exploreSites';
import { WILD_IDS } from '../src/world/regions/defs';
import { wildLayout } from '../src/world/regions/layout';
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
const town = townZone(sites.digCells);
const wilds = WILD_IDS.map((id) => wildZone(wildLayout(id as never)));
const allZones: ZoneSites[] = [town, ...wilds];

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
    ex.newExploreDay(s, [town], seeded(1));
    expect(s.explore.digs.length).toBeGreaterThanOrEqual(3);
    expect(s.explore.digs).not.toContain(`${sites.digCells[0][0]},${sites.digCells[0][1]}`);
    s.day++;
    const before = [...s.explore.digs];
    ex.newExploreDay(s, [town], seeded(2));
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
    const spot = ex.readMap(s, [town], seeded(4))!;
    expect(MAP_SPOTS.map((p) => p.at)).toContainEqual(spot.at);
    expect(ex.mapTarget(s)).toEqual(spot);
    const loot = ex.digMap(s, seeded(5))!;
    expect(loot.gold).toBeGreaterThanOrEqual(150);
    expect(Object.keys(loot.items).some((id) => BOOK_TREASURES.includes(id as never))).toBe(true);
    expect(loot.got.length).toBe(1);
    // 还剩一张图：看一眼就指向下一个地点
    expect(s.inv.treasureMap).toBe(1);
    expect(ex.mapTarget(s)).toBeNull();
    expect(ex.readMap(s, [town], seeded(7))).not.toBeNull();
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
    expect(ex.lightBrazier(s, 'brazier', 0, 3)).toBe(false);
    expect(ex.lightBrazier(s, 'brazier', 0, 3)).toBe(false);
    expect(ex.lightBrazier(s, 'mistwood', 1, 3)).toBe(false);
    expect(ex.lightBrazier(s, 'brazier', 1, 3)).toBe(false);
    expect(ex.lightBrazier(s, 'brazier', 2, 3)).toBe(true);
    s.day++;
    ex.newExploreDay(s, [town], seeded(7));
    expect(s.explore.lit).toEqual([]);
  });

  it('sells the one-off merchant goods once', () => {
    const s = newSave(0, 'warrior');
    s.gold = 5000;
    s.explore.event = { kind: 'merchant', spot: 0, stage: 0, sold: [] };
    const map = ex.merchantStock(s).find((i) => i.id === 'treasureMap')!;
    expect(ex.buyFromMerchant(s, map).ok).toBe(true);
    expect(ex.readMap(s, [town])).not.toBeNull();
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
    expect(ex.canClaim(s, 'treasure', 'half')).toBe(false);
    ex.openHidden(s, 'boulder');
    expect(ex.canClaim(s, 'treasure', 'half')).toBe(true);
    expect(ex.canClaim(s, 'treasure', 'full')).toBe(false);
    const gold = s.gold;
    expect(ex.claimBook(s, 'treasure', 'half')).not.toBeNull();
    expect(s.gold).toBe(gold + 300);
    expect(ex.claimBook(s, 'treasure', 'half')).toBeNull();
    for (const id of HIDDEN_IDS) ex.openHidden(s, id);
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

describe('exploring the wild regions', () => {
  it('gives every region a hidden chest, map spots, events and dig spots you can reach all at once', () => {
    for (const z of wilds) {
      const L = wildLayout(z.region as never);
      const lm = L.map;
      const things: Cell[] = [...z.hidden.flatMap((hs) => [hs.at, ...hs.braziers]), ...z.mapSpots.map((p) => p.at), ...Object.values(z.events).flat().map((e) => e.at)];
      const camp = z.events.camp[0];
      if (camp) things.push([camp.at[0] + 1, camp.at[1]]);
      expect(z.hidden.length, z.region).toBe(1);
      expect(z.hidden[0].braziers.length).toBe(WILD_HIDDEN[z.region as keyof typeof WILD_HIDDEN].puzzle === 'brazier' ? 3 : 0);
      expect(z.mapSpots.length, z.region).toBeGreaterThanOrEqual(1);
      expect(z.events.merchant.length + z.events.traveler.length + z.events.camp.length, z.region).toBeGreaterThanOrEqual(2);
      expect(z.digCells.length, z.region).toBeGreaterThanOrEqual(4);
      // 所有东西都放下以后，从路标还能走到每一样东西旁边
      const key = (c: Cell) => `${c[0]},${c[1]}`;
      expect(new Set(things.map(key)).size).toBe(things.length);
      const saved = things.map(([x, y]) => lm.get(x, y));
      things.forEach(([x, y]) => lm.set(x, y, Tile.STONE));
      const d = distanceField(lm, L.arrive[0], L.arrive[1], (t) => !isSolidTile(t) && t !== Tile.WATER);
      things.forEach(([x, y], i) => lm.set(x, y, saved[i]));
      const ok = (x: number, y: number) => d[y * lm.w + x] >= 0;
      for (const [x, y] of things) expect(N4.some(([dx, dy]) => ok(x + dx, y + dy)), `${z.region} ${x},${y}`).toBe(true);
      for (const [x, y] of z.digCells) expect(ok(x, y) || N4.some(([dx, dy]) => ok(x + dx, y + dy))).toBe(true);
      for (const e of z.events.merchant.concat(z.events.traveler, z.events.camp)) expect(e.where).toContain('路标');
    }
  });

  it('spreads dig spots over every reachable region with region-prefixed keys', () => {
    const s = newSave(0, 'warrior');
    ex.newExploreDay(s, allZones, seeded(11));
    expect(s.explore.digs.some((k) => !k.includes(':'))).toBe(true);
    for (const z of wilds) expect(s.explore.digs.some((k) => k.startsWith(`${z.region}:`)), z.region).toBe(true);
  });

  it('pays more gold and a better tier of gear deeper in the wild', () => {
    const s = newSave(0, 'warrior');
    const tiers: number[] = [];
    let townGold = 0;
    let ruinsGold = 0;
    for (let i = 0; i < 40; i++) {
      s.explore.digs = ['10,40', `ruins:${i},5`];
      townGold += ex.dig(s, '10,40', seeded(100 + i))!.gold;
      ruinsGold += ex.dig(s, `ruins:${i},5`, seeded(100 + i))!.gold;
    }
    expect(ruinsGold).toBeGreaterThan(townGold);
    s.inv.treasureMap = 1;
    s.explore.map = { region: 'ruins', at: [5, 5], hint: '' };
    const loot = ex.digMap(s, seeded(12))!;
    tiers.push(loot.got[0].tier);
    expect(loot.got[0].tier).toBe(ex.regionGearTier('ruins'));
    expect(ex.regionGearTier('ruins')).toBeGreaterThan(ex.regionGearTier('town'));
  });

  it('puts gear of at least rare quality in wild hidden chests and camp chests', () => {
    for (let i = 0; i < 10; i++) {
      const s = newSave(0, 'rogue');
      const loot = ex.openHidden(s, 'starmarsh', seeded(200 + i))!;
      expect(loot.items.fossil).toBe(1);
      expect(loot.got.length).toBe(1);
      expect(loot.got[0].q).toBeGreaterThanOrEqual(2);
      expect(QUALITIES[loot.got[0].q]).toBeDefined();
      s.explore.event = { kind: 'camp', region: 'northcrag', spot: 0, stage: 1, sold: [] };
      expect(ex.campTier(s)).toBe(8);
      const camp = ex.openCampChest(s, { gold: 10, items: {}, blueprint: null, gear: null }, seeded(300 + i))!;
      expect(camp.got[0].q).toBeGreaterThanOrEqual(2);
    }
  });

  it('sells one piece of gear from the merchant', () => {
    const s = newSave(0, 'mage');
    s.gold = 100000;
    s.explore.event = { kind: 'merchant', region: 'mistwood', spot: 0, stage: 0, sold: [] };
    ex.newExploreDay(s, allZones, () => 0.01);
    expect(s.explore.event?.kind).toBe('merchant');
    const gear = ex.merchantStock(s).find((i) => i.gear)!;
    expect(gear.price).toBeGreaterThan(0);
    const n = s.gear.length;
    const r = ex.buyFromMerchant(s, gear);
    expect(r.ok).toBe(true);
    expect(r.got.length).toBe(1);
    expect(s.gear.length).toBe(n + 1);
    expect(ex.merchantStock(s).find((i) => i.gear)!.soldOut).toBe(true);
  });

  it('points treasure maps at visited wild regions too', () => {
    const s = newSave(0, 'warrior');
    const regions = new Set<string>();
    for (let i = 0; i < 60; i++) {
      s.inv.treasureMap = 1;
      s.explore.map = null;
      regions.add(ex.readMap(s, allZones, seeded(400 + i))!.region);
    }
    expect(regions.size).toBeGreaterThan(2);
    expect(ex.mapCandidates(allZones).every((t) => t.hint.length > 0)).toBe(true);
  });

  it('upgrades the first version of a save', () => {
    const s = newSave(0, 'warrior');
    s.inv.treasureMap = 1;
    const e = s.explore as unknown as Record<string, unknown>;
    e.mapSpot = 1;
    delete e.map;
    e.lit = [0, 2];
    e.event = { kind: 'merchant', spot: 0, stage: 0, sold: [] };
    ex.explore(s);
    expect(ex.mapTarget(s)).toEqual({ region: 'town', at: MAP_SPOTS[1].at, hint: MAP_SPOTS[1].hint });
    expect(s.explore.mapSpot).toBe(-1);
    expect(ex.isLit(s, 'brazier', 0)).toBe(true);
    expect(ex.litCount(s, 'brazier')).toBe(2);
    expect(s.explore.event?.region).toBe('town');
  });
});
