import type { Cell, EventKind, HiddenId, WildRegion } from '../data/treasure';
import { BOULDER_RING, BRAZIERS, EVENT_SPOTS, HIDDEN_CHESTS, MAP_SPOTS, MEADOW_MIN_Y, TOWN_HIDDEN_IDS, WILD_HIDDEN } from '../data/treasure';
import type { Overworld } from './overworld';
import type { RegionId } from './regions/defs';
import { REGIONS } from './regions/defs';
import type { RegionLayout } from './regions/layout';
import { Tile, distanceField, isSolidTile } from './TileMap';
import type { TileMap } from './TileMap';

/** 户外探险在小镇地图上用到的格子 */
export interface ExploreSites {
  /** 每天可以冒出闪光点的格子 */
  digCells: Cell[];
  /** 户外怪物的出生点 */
  wild: { meadow: Cell[]; forest: Cell[] };
  /** 石头的起点（石圈的口子） */
  boulderStart: Cell;
  /** 石圈里面的格子，石头只能在这些格子里推来推去 */
  ringInside: Cell[];
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * 把探险用的东西布置到小镇地图上：种出石圈的树，
 * 再把这些格子从采集点里去掉，免得采集物长在树上或者火盆底下。
 */
export function placeExploreSites(ow: Overworld): ExploreSites {
  const m = ow.map;
  const [ox, oy] = BOULDER_RING.origin;
  let boulderStart: Cell = [ox, oy];
  const ringInside: Cell[] = [];
  const taken = new Set<string>();
  BOULDER_RING.rows.forEach((row, dy) => {
    [...row].forEach((c, dx) => {
      const x = ox + dx;
      const y = oy + dy;
      taken.add(key(x, y));
      if (c === 'T') m.set(x, y, Tile.TREE);
      else {
        m.set(x, y, Tile.GRASS);
        if (c === 'B') boulderStart = [x, y];
        else ringInside.push([x, y]);
      }
    });
  });
  const [ax, ay] = BOULDER_RING.approach;
  m.set(ax, ay, Tile.GRASS);
  taken.add(key(ax, ay));

  const reserved: Cell[] = [
    ...BRAZIERS,
    ...Object.values(HIDDEN_CHESTS).map((c) => c.at),
    ...MAP_SPOTS.map((p) => p.at),
    ...Object.values(EVENT_SPOTS).flat().map((p) => p.at),
  ];
  for (const [x, y] of reserved) {
    taken.add(key(x, y));
    // 事件和宝箱周围留一圈空地，免得闪光点和采集物挤在一起
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) taken.add(key(x + dx, y + dy));
  }
  for (const area of ['forest', 'meadow', 'beach'] as const) {
    ow.forage[area] = ow.forage[area].filter(([x, y]) => !taken.has(key(x, y)));
  }
  const free = (c: Cell) => !taken.has(key(c[0], c[1]));
  const digCells = [...ow.forage.meadow, ...ow.forage.forest, ...ow.forage.beach].filter(free);
  const wild = {
    meadow: ow.forage.meadow.filter(([, y]) => y >= MEADOW_MIN_Y).filter(free),
    forest: ow.forage.forest.filter(free),
  };
  return { digCells, wild, boulderStart, ringInside };
}

/* ---------- 每个区域的探险位置 ---------- */

/** 一个隐藏宝箱：位置，和要点亮的火盆（没有火盆就是绕路的宝箱） */
export interface HiddenSite {
  id: HiddenId;
  at: Cell;
  braziers: Cell[];
}

/** 一个区域里户外探险用到的所有位置 */
export interface ZoneSites {
  region: RegionId;
  digCells: Cell[];
  mapSpots: { at: Cell; hint: string }[];
  events: Record<EventKind, { at: Cell; where: string }[]>;
  hidden: HiddenSite[];
}

/** 萤石镇：位置都写在 data/treasure.ts 里，闪光点的格子会随家园设施变化 */
export function townZone(digCells: Cell[]): ZoneSites {
  return {
    region: 'town',
    digCells,
    mapSpots: MAP_SPOTS,
    events: EVENT_SPOTS,
    hidden: TOWN_HIDDEN_IDS.map((id) => ({ id, at: HIDDEN_CHESTS[id].at, braziers: id === 'brazier' ? BRAZIERS : [] })),
  };
}

const DIRS = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
/** 从 from 看 to 在哪个方向 */
export function direction(from: Cell, to: Cell): string {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  return DIRS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}

const walkable = (m: TileMap, x: number, y: number) => {
  const t = m.get(x, y);
  return !isSolidTile(t) && t !== Tile.WATER;
};
/** 小路和桥上不放会挡路的东西 */
const onTrail = (m: TileMap, x: number, y: number) => [Tile.PATH, Tile.BRIDGE, Tile.RUIN].includes(m.get(x, y) as never);
const N4: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * 放下这些会挡路的东西以后，路标旁边还能不能走到 need 里每一个东西的旁边。
 * 用来保证火盆、宝箱、商人、营火不会把唯一的通道堵死。
 */
function stillReachable(L: RegionLayout, blockers: Cell[], need: Cell[]): boolean {
  const m = L.map;
  const block = new Set(blockers.map(([x, y]) => key(x, y)));
  const saved = blockers.map(([x, y]) => m.get(x, y));
  blockers.forEach(([x, y]) => m.set(x, y, Tile.STONE));
  const d = distanceField(m, L.arrive[0], L.arrive[1], (t) => !isSolidTile(t) && t !== Tile.WATER);
  blockers.forEach(([x, y], i) => m.set(x, y, saved[i]));
  const ok = (x: number, y: number) => !block.has(key(x, y)) && d[y * m.w + x] >= 0;
  return need.every(([x, y]) => N4.some(([dx, dy]) => ok(x + dx, y + dy)));
}

const wildCache = new Map<RegionId, ZoneSites>();

/** 野外区域：从地图留下的候选格子里挑出宝箱、火盆、埋宝点和事件的位置。同一个区域每次结果都一样 */
export function wildZone(L: RegionLayout): ZoneSites {
  const hit = wildCache.get(L.id);
  if (hit) return hit;
  const id = L.id as WildRegion;
  const m = L.map;
  const hub: Cell = L.waystone ?? L.arrive;
  const name = REGIONS[id].name;
  const used: Cell[] = [];
  const near = (c: Cell, r: number) => used.some(([x, y]) => Math.abs(x - c[0]) <= r && Math.abs(y - c[1]) <= r);
  const nearBoss = (c: Cell) => !!L.boss && Math.hypot(c[0] - L.boss[0], c[1] - L.boss[1]) < 7;
  const free = (c: Cell) => walkable(m, c[0], c[1]) && !onTrail(m, c[0], c[1]) && !(L.waystone && c[0] === L.waystone[0] && c[1] === L.waystone[1]);

  // 隐藏宝箱：离路标最远的角落。火盆宝箱在周围两格放三个火盆
  const hidden: HiddenSite[] = [];
  const def = WILD_HIDDEN[id];
  const ring: Cell[] = [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [-2, 2], [2, -2], [-1, -2], [1, 2]];
  for (const at of L.chestSpots) {
    if (!free(at) || nearBoss(at)) continue;
    let braziers: Cell[] = [];
    if (def.puzzle === 'brazier') {
      for (const [dx, dy] of ring) {
        const c: Cell = [at[0] + dx, at[1] + dy];
        if (!free(c) || braziers.some((b) => Math.abs(b[0] - c[0]) + Math.abs(b[1] - c[1]) < 2)) continue;
        braziers.push(c);
        if (braziers.length === 3) break;
      }
      if (braziers.length < 3) continue;
    }
    if (!stillReachable(L, [at, ...braziers], [at, ...braziers])) continue;
    hidden.push({ id, at, braziers });
    used.push(at, ...braziers);
    break;
  }

  // 埋宝点：另外两个远远的角落
  const mapSpots: ZoneSites['mapSpots'] = [];
  for (const at of L.chestSpots) {
    if (mapSpots.length >= 2) break;
    if (!free(at) || near(at, 3) || nearBoss(at)) continue;
    mapSpots.push({ at, hint: `${name}，从萤石路标往${direction(hub, at)}一直走到尽头的角落。` });
    used.push(at);
  }

  // 事件：商人站在路标附近，旅人和营地在怪物出没的空地上
  const events: ZoneSites['events'] = { merchant: [], traveler: [], camp: [] };
  for (const [dx, dy] of [[3, 0], [-3, 0], [3, 1], [-3, 1], [2, 2], [-2, 2], [3, -1], [-3, -1]] as Cell[]) {
    const at: Cell = [hub[0] + dx, hub[1] + dy];
    if (!free(at) || !stillReachable(L, [at], [at, hub])) continue;
    events.merchant.push({ at, where: `${name}的萤石路标旁边` });
    used.push(at);
    break;
  }
  const spots = L.monsterSpots.filter((c) => free(c) && !nearBoss(c));
  const open = (c: Cell) => {
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (walkable(m, c[0] + dx, c[1] + dy)) n++;
    return n;
  };
  // 营地要一块够大的空地：营火和右边的宝箱都不能挡路
  const camp = spots
    .filter((c) => free([c[0] + 1, c[1]]) && !near(c, 6))
    .sort((a, b) => open(b) - open(a) || a[1] - b[1] || a[0] - b[0])
    .find((c) => open(c) >= 18 && stillReachable(L, [c, [c[0] + 1, c[1]]], [c, [c[0] + 1, c[1]]]));
  if (camp) {
    events.camp.push({ at: camp, where: `${name}路标${direction(hub, camp)}边的空地` });
    used.push(camp, [camp[0] + 1, camp[1]]);
  }
  const traveler = spots.filter((c) => !near(c, 5)).sort((a, b) => Math.hypot(a[0] - hub[0], a[1] - hub[1]) - Math.hypot(b[0] - hub[0], b[1] - hub[1]))
    .find((c) => stillReachable(L, [c], [c]));
  if (traveler) {
    events.traveler.push({ at: traveler, where: `${name}路标${direction(hub, traveler)}边不远的地方` });
    used.push(traveler);
  }

  const digCells = L.digSpots.filter((c) => free(c) && !near(c, 1));
  const z: ZoneSites = { region: id, digCells, mapSpots, events, hidden };
  wildCache.set(L.id, z);
  return z;
}
