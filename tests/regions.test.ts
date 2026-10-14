import { describe, expect, it } from 'vitest';
import { migrate, newSave } from '../src/state/save';
import { spawnForage } from '../src/systems/forage';
import { canFastTravel, foragePrefix, hasVisited, isUnlocked, lockReason, markVisited, recordRegionBoss, regionBossAround, visitedRegions } from '../src/systems/regions';
import { buildOverworld } from '../src/world/overworld';
import type { Edge, RegionId } from '../src/world/regions/defs';
import { OPPOSITE, REGIONS, REGION_IDS, WILD_IDS } from '../src/world/regions/defs';
import type { RegionLayout } from '../src/world/regions/layout';
import { arrivalAt, buildWild, exitAt, exitCells, townLayout, wildLayout } from '../src/world/regions/layout';
import { Tile, distanceField, isSolidTile } from '../src/world/TileMap';

const town = townLayout(buildOverworld());
const layoutOf = (id: RegionId): RegionLayout => (id === 'town' ? town : wildLayout(id as Exclude<RegionId, 'town'>));

function reachFrom(L: RegionLayout, [sx, sy]: [number, number]) {
  const dist = distanceField(L.map, sx, sy, (t) => !isSolidTile(t) && t !== Tile.WATER);
  const ok = (x: number, y: number) => dist[y * L.map.w + x] >= 0;
  const beside = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ok(x + dx, y + dy));
  return { ok, beside };
}

describe('region graph', () => {
  it('links both ways, and every link has a matching gate on the map', () => {
    for (const id of REGION_IDS) {
      const L = layoutOf(id);
      const links = Object.entries(REGIONS[id].links) as [Edge, RegionId][];
      expect(L.exits.length).toBe(links.length);
      for (const [edge, to] of links) {
        expect(REGIONS[to].links[OPPOSITE[edge]]).toBe(id);
        expect(L.exits.find((e) => e.edge === edge)?.target).toBe(to);
      }
    }
  });

  it('can reach every region from town by walking', () => {
    const seen = new Set<RegionId>(['town']);
    const queue: RegionId[] = ['town'];
    while (queue.length) for (const to of Object.values(REGIONS[queue.shift()!].links)) if (!seen.has(to)) seen.add(to), queue.push(to);
    expect([...seen].sort()).toEqual([...REGION_IDS].sort());
  });
});

describe('region maps', () => {
  for (const id of REGION_IDS) {
    it(`${REGIONS[id].name}: gates, arrival spots, boss and forage are all walkable`, () => {
      const L = layoutOf(id);
      const start: [number, number] = id === 'town' ? [8, 8] : L.arrive;
      const { ok, beside } = reachFrom(L, start);
      expect(ok(...L.arrive)).toBe(true);
      for (const ex of L.exits) {
        for (const [x, y] of exitCells(L, ex)) {
          expect(L.map.solid(x, y)).toBe(false);
          expect(ok(x, y)).toBe(true);
        }
        const [ax, ay] = arrivalAt(L, ex.edge);
        expect(ok(ax, ay)).toBe(true);
        // 刚走进来的位置不能马上又算站在路口上
        expect(exitAt(L, ax, ay)).toBeNull();
        expect(exitAt(L, ...exitCells(L, ex, 1)[0])).toBe(ex);
      }
      for (const k of Object.keys(L.signs)) {
        const [x, y] = k.split(',').map(Number);
        expect(L.map.get(x, y)).toBe(Tile.SIGN);
        expect(beside(x, y)).toBe(true);
      }
      if (id === 'town') return;
      expect(L.waystone).not.toBeNull();
      expect(L.map.get(...L.waystone!)).toBe(Tile.WAYSTONE);
      expect(beside(...L.waystone!)).toBe(true);
      expect(L.boss).not.toBeNull();
      expect(ok(...L.boss!)).toBe(true);
      expect(L.monsterSpots.length).toBeGreaterThan(20);
      for (const [x, y] of [...L.monsterSpots, ...L.digSpots, ...L.chestSpots]) expect(ok(x, y)).toBe(true);
      const forage = Object.values(L.forage).flat();
      expect(forage.length).toBeGreaterThan(20);
      for (const [x, y] of forage) expect(ok(x, y)).toBe(true);
    });
  }

  it('builds the same map every time', () => {
    for (const id of WILD_IDS) {
      const a = buildWild(id as Exclude<RegionId, 'town'>);
      const b = buildWild(id as Exclude<RegionId, 'town'>);
      expect(Array.from(a.map.t)).toEqual(Array.from(b.map.t));
    }
  });

  it('gives each wild region its own look', () => {
    const has = (id: Exclude<RegionId, 'town'>, t: number) => wildLayout(id).map.t.includes(t);
    expect(has('mistwood', Tile.FOREST)).toBe(true);
    expect(has('starmarsh', Tile.REED) && has('starmarsh', Tile.BRIDGE)).toBe(true);
    expect(has('northcrag', Tile.GRAVEL) && has('northcrag', Tile.CLIFF)).toBe(true);
    expect(has('ruins', Tile.RUIN) && has('ruins', Tile.PILLAR)).toBe(true);
  });
});

describe('unlocking and fast travel', () => {
  it('opens regions by level and story', () => {
    const s = newSave(0, 'warrior');
    expect(isUnlocked(s, 'town')).toBe(true);
    expect(isUnlocked(s, 'mistwood')).toBe(true);
    expect(lockReason(s, 'starmarsh')).toMatch(/3 级/);
    expect(isUnlocked(s, 'northcrag')).toBe(false);
    expect(isUnlocked(s, 'ruins')).toBe(false);
    s.level = 3;
    expect(isUnlocked(s, 'starmarsh')).toBe(true);
    s.bosses.push('slimeKing');
    expect(isUnlocked(s, 'northcrag')).toBe(true);
    s.bosses.push('ironJaw');
    expect(isUnlocked(s, 'ruins')).toBe(false);
    s.level = 10;
    expect(isUnlocked(s, 'ruins')).toBe(true);
  });

  it('only fast travels to regions already visited', () => {
    const s = newSave(0, 'mage');
    expect(visitedRegions(s)).toEqual(['town']);
    expect(canFastTravel(s, 'town', 'mistwood').ok).toBe(false);
    expect(markVisited(s, 'mistwood')).toBe(true);
    expect(markVisited(s, 'mistwood')).toBe(false);
    expect(hasVisited(s, 'mistwood')).toBe(true);
    expect(canFastTravel(s, 'town', 'mistwood').ok).toBe(true);
    expect(canFastTravel(s, 'mistwood', 'mistwood').ok).toBe(false);
    expect(canFastTravel(s, null, 'town').ok).toBe(true);
  });

  it('keeps old saves working: no regions field means only town', () => {
    const old = newSave(1, 'rogue') as unknown as Record<string, unknown>;
    delete old.regions;
    delete old.regionBosses;
    const s = migrate(old)!;
    expect(visitedRegions(s)).toEqual(['town']);
    expect(regionBossAround(s, 'mistwood')).toBe(true);
    s.regions = ['town', 'nowhere' as RegionId];
    expect(visitedRegions(s)).toEqual(['town']);
  });

  it('brings a region boss back the next day', () => {
    const s = newSave(0, 'warrior');
    expect(regionBossAround(s, 'town')).toBe(false);
    expect(regionBossAround(s, 'mistwood')).toBe(true);
    expect(recordRegionBoss(s, 'mistwood')).toBe(true);
    expect(regionBossAround(s, 'mistwood')).toBe(false);
    s.day++;
    expect(regionBossAround(s, 'mistwood')).toBe(true);
    expect(recordRegionBoss(s, 'mistwood')).toBe(false);
  });
});

describe('region forage', () => {
  it('keeps each region’s forage under its own keys', () => {
    const s = newSave(0, 'warrior');
    s.day = 1;
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    spawnForage(s, town.forage, rand);
    const townKeys = Object.keys(s.forage);
    expect(townKeys.length).toBeGreaterThan(0);
    expect(townKeys.every((k) => /^\d+,\d+$/.test(k))).toBe(true);
    spawnForage(s, wildLayout('mistwood').forage, rand, foragePrefix('mistwood'));
    const wild = Object.keys(s.forage).filter((k) => k.startsWith('mistwood:'));
    expect(wild.length).toBeGreaterThan(0);
    // 小镇的采集物没有被挤掉
    for (const k of townKeys) expect(s.forage[k]).toBeDefined();
  });
});
