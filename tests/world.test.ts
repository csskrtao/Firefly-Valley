import { describe, expect, it } from 'vitest';
import { NPCS, NPC_IDS, scheduleAt } from '../src/data/npcs';
import { buildOverworld } from '../src/world/overworld';
import { TileMap, Tile, distanceField, findPath, isSolidTile } from '../src/world/TileMap';

const ow = buildOverworld();
const [hx, hy] = ow.spawns.home;
const dist = distanceField(ow.map, hx, hy, (t) => !isSolidTile(t));
const reachable = (x: number, y: number) => dist[y * ow.map.w + x] >= 0;
/** 实心的东西（告示牌、路灯）要能走到它旁边 */
const besideReachable = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachable(x + dx, y + dy));

describe('bigger overworld', () => {
  it('can walk to every forage spot, sign and lamp', () => {
    for (const area of ['forest', 'meadow', 'beach'] as const) {
      expect(ow.forage[area].length).toBeGreaterThan(0);
      for (const [x, y] of ow.forage[area]) expect(reachable(x, y)).toBe(true);
    }
    for (const k of Object.keys(ow.signs)) {
      const [x, y] = k.split(',').map(Number);
      expect(ow.map.get(x, y)).toBe(Tile.SIGN);
      expect(besideReachable(x, y)).toBe(true);
    }
    for (const [x, y] of ow.lamps) {
      expect(ow.map.get(x, y)).toBe(Tile.LAMP);
      expect(besideReachable(x, y)).toBe(true);
    }
  });

  it('crosses the river on the bridge to reach the mine', () => {
    const [mx, my] = ow.spawns.mine;
    const path = findPath(ow.map, hx, hy, mx, my, (x, y) => !ow.map.solid(x, y), 10000);
    expect(path).not.toBeNull();
    expect(path!.some(([x, y]) => ow.map.get(x, y) === Tile.BRIDGE)).toBe(true);
  });

  it('gives every NPC a schedule it can actually walk', () => {
    const canWalk = (x: number, y: number) => !ow.map.solid(x, y);
    for (const id of NPC_IDS) {
      const stops = NPCS[id].schedule;
      expect(stops[0][0]).toBe(6);
      for (let i = 0; i < stops.length; i++) {
        const [, x, y] = stops[i];
        expect(canWalk(x, y)).toBe(true);
        expect(reachable(x, y)).toBe(true);
        // 和 NPC 用的寻路一样（默认搜索上限），下一站必须找得到路
        const [, nx, ny] = stops[(i + 1) % stops.length];
        expect(findPath(ow.map, x, y, nx, ny, canWalk)).not.toBeNull();
      }
    }
  });

  it('picks the latest schedule entry for the time of day', () => {
    const smith = NPCS.smith;
    expect(scheduleAt(smith, 6 * 60)).toEqual([smith.schedule[0][1], smith.schedule[0][2]]);
    expect(scheduleAt(smith, 12 * 60 + 10)).toEqual([41, 16]);
    expect(scheduleAt(smith, 13 * 60 + 40)).toEqual([33, 8]);
    // 凌晨（第二天 0:00–2:00）还在最后一站
    const last = smith.schedule[smith.schedule.length - 1];
    expect(scheduleAt(smith, 25 * 60)).toEqual([last[1], last[2]]);
  });
});

describe('findPath', () => {
  it('walks around walls and returns null when boxed in', () => {
    const m = new TileMap(7, 5, Tile.GRASS);
    for (let y = 0; y < 4; y++) m.set(3, y, Tile.ROCK);
    const walk = (x: number, y: number) => !m.solid(x, y);
    const path = findPath(m, 1, 1, 5, 1, walk)!;
    expect(path[path.length - 1]).toEqual([5, 1]);
    // 只能从最下面一行绕过去
    expect(path.some(([x, y]) => x === 3 && y === 4)).toBe(true);
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      expect(Math.abs(ax - bx) + Math.abs(ay - by)).toBe(1);
    }
    expect(findPath(m, 1, 1, 1, 1, walk)).toEqual([]);
    m.set(3, 4, Tile.ROCK);
    expect(findPath(m, 1, 1, 5, 1, walk)).toBeNull();
  });
});
