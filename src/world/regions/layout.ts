import { hash } from '../../core/math';
import type { ForageArea } from '../../data/items';
import type { Overworld } from '../overworld';
import { TOWN_GATES } from '../overworld';
import { Tile, TileMap, distanceField, isSolidTile } from '../TileMap';
import type { Edge, RegionId } from './defs';
import { REGIONS } from './defs';

export interface RegionExit {
  edge: Edge;
  /** 路口在这条边上占的格子范围（北、南边是 x，东、西边是 y） */
  from: number;
  to: number;
  target: RegionId;
}

/** 一个地面区域的地图和上面的各种位置。小镇和野外区域都用这个结构 */
export interface RegionLayout {
  id: RegionId;
  map: TileMap;
  exits: RegionExit[];
  /** 快速旅行过来时站的位置 */
  arrive: [number, number];
  /** 萤石路标的位置，小镇没有 */
  waystone: [number, number] | null;
  /** 路牌：键为 "x,y" */
  signs: Record<string, string>;
  /** 每天刷新采集物的候选格子 */
  forage: Record<ForageArea, [number, number][]>;
  /** 进入区域时刷怪的候选格子（离路口和路标都有一段距离） */
  monsterSpots: [number, number][];
  /** 区域 Boss 站的位置 */
  boss: [number, number] | null;
  /** 给户外探险线用的候选位置：可以挖的宝藏点、可以放宝箱的角落。地图本身不放东西 */
  digSpots: [number, number][];
  chestSpots: [number, number][];
  /** 按森林画法绘制树和地面的范围 */
  forest: [number, number, number, number] | null;
  /** 树画成松树（北山） */
  pines: boolean;
}

export const WILD_W = 64;
export const WILD_H = 44;

/** 野外区域每条边上的路口位置 */
const GATE: Record<Edge, [number, number]> = { n: [30, 31], s: [30, 31], w: [20, 21], e: [20, 21] };
const HUB: [number, number] = [32, 22];

/** 进入一个区域时站的格子：从 edge 这条边的路口往里走两格 */
export function arrivalAt(L: RegionLayout, edge: Edge): [number, number] {
  const ex = L.exits.find((e) => e.edge === edge);
  if (!ex) return L.arrive;
  const { w, h } = L.map;
  switch (edge) {
    case 'n': return [ex.from, 2];
    case 's': return [ex.from, h - 3];
    case 'w': return [2, ex.from];
    case 'e': return [w - 3, ex.from];
  }
}

/** 路口在地图上占的格子，depth 是从边缘往里数几格 */
export function exitCells(L: RegionLayout, ex: RegionExit, depth = 2): [number, number][] {
  const out: [number, number][] = [];
  const { w, h } = L.map;
  for (let k = ex.from; k <= ex.to; k++) {
    for (let d = 0; d < depth; d++) {
      if (ex.edge === 'n') out.push([k, d]);
      else if (ex.edge === 's') out.push([k, h - 1 - d]);
      else if (ex.edge === 'w') out.push([d, k]);
      else out.push([w - 1 - d, k]);
    }
  }
  return out;
}

/** 站在哪个路口上（地图最边上那一排），没有返回 null */
export function exitAt(L: RegionLayout, tx: number, ty: number): RegionExit | null {
  const { w, h } = L.map;
  for (const ex of L.exits) {
    const along = ex.edge === 'n' || ex.edge === 's' ? tx : ty;
    if (along < ex.from || along > ex.to) continue;
    if ((ex.edge === 'n' && ty <= 0) || (ex.edge === 's' && ty >= h - 1) || (ex.edge === 'w' && tx <= 0) || (ex.edge === 'e' && tx >= w - 1)) return ex;
  }
  return null;
}

/** 小镇也是一个区域：路口和采集点来自 buildOverworld */
export function townLayout(ow: Overworld): RegionLayout {
  const links = REGIONS.town.links;
  const exits: RegionExit[] = (Object.keys(links) as Edge[]).map((edge) => {
    const [from, to] = TOWN_GATES[edge as keyof typeof TOWN_GATES];
    return { edge, from, to, target: links[edge]! };
  });
  return {
    id: 'town', map: ow.map, exits,
    // 快速旅行回小镇时站在广场南边
    arrive: [49, 20],
    waystone: null,
    signs: ow.signs,
    forage: ow.forage,
    monsterSpots: [], boss: null, digSpots: [], chestSpots: [],
    forest: ow.forest,
    pines: false,
  };
}

/* ---------- 野外区域的生成 ---------- */

interface Theme {
  ground: number;
  /** 地图四周的边界 */
  wall: number;
  path: number;
  /** Boss 所在空地的中心 */
  boss: [number, number];
  /** 在走得到的地面上铺地形（池塘、山崖、废墟），在小路开出来之前调用 */
  terrain(m: TileMap, r: (x: number, y: number, k?: number) => number): void;
  /** 开完小路以后在剩下的空地上放障碍物 */
  scatter(t: number, v: number): number | null;
  /** 什么地面会长出哪一类采集物 */
  forageOf(t: number): ForageArea | null;
  forest: boolean;
  pines: boolean;
}

const ellipse = (m: TileMap, cx: number, cy: number, rx: number, ry: number, fn: (x: number, y: number, d: number) => void) => {
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
    if (!m.inBounds(x, y)) continue;
    fn(x, y, Math.hypot((x - cx) / rx, (y - cy) / ry));
  }
};

const THEMES: Record<Exclude<RegionId, 'town'>, Theme> = {
  // 雾语森林：深色林地上密密的树，几块开满花的空地和一个小水潭
  mistwood: {
    ground: Tile.FOREST, wall: Tile.TREE, path: Tile.PATH, boss: [52, 34], forest: true, pines: false,
    terrain(m, r) {
      ellipse(m, 14, 33, 4.5, 3, (x, y, d) => {
        if (d < 1) m.set(x, y, Tile.WATER);
      });
      for (const [cx, cy, rr] of [[18, 10, 3.5], [46, 12, 3], [26, 34, 3]] as const) {
        ellipse(m, cx, cy, rr, rr, (x, y, d) => {
          if (d < 1 && r(x, y, 3) < 0.35) m.set(x, y, Tile.FLOWER);
        });
      }
    },
    scatter: (t, v) => (t !== Tile.FOREST ? null : v < 0.34 ? Tile.TREE : v < 0.39 ? Tile.BUSH : v < 0.41 ? Tile.STONE : null),
    forageOf: (t) => (t === Tile.FOREST || t === Tile.FLOWER ? 'forest' : null),
  },
  // 星湖湿地：软泥地上一片片水塘，水边长满芦苇，小路过水的地方是木栈道
  starmarsh: {
    ground: Tile.MARSH, wall: Tile.TREE, path: Tile.PATH, boss: [12, 32], forest: false, pines: false,
    terrain(m, r) {
      for (const [cx, cy, rx, ry] of [[22, 11, 7, 4], [46, 31, 8, 4.5], [50, 10, 5, 3], [21, 27, 5, 3]] as const) {
        ellipse(m, cx, cy, rx, ry, (x, y, d) => {
          if (d < 1) m.set(x, y, Tile.WATER);
          else if (d < 1.25 && m.get(x, y) === Tile.MARSH) m.set(x, y, r(x, y, 5) < 0.55 ? Tile.REED : Tile.SAND);
        });
      }
      for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
        if (m.get(x, y) === Tile.MARSH && r(x, y, 6) < 0.08) m.set(x, y, Tile.REED);
      }
    },
    scatter: (t, v) => (t !== Tile.MARSH ? null : v < 0.1 ? Tile.TREE : v < 0.16 ? Tile.BUSH : null),
    forageOf: (t) => (t === Tile.SAND ? 'beach' : t === Tile.MARSH || t === Tile.REED ? 'meadow' : null),
  },
  // 北山岩地：碎石坡上一道道山崖，零星的松树和草甸
  northcrag: {
    ground: Tile.GRAVEL, wall: Tile.CLIFF, path: Tile.PATH, boss: [14, 10], forest: false, pines: true,
    terrain(m, r) {
      for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
        const ridge = Math.sin(x * 0.33 + 1.3) * Math.cos(y * 0.41 + 0.4) + 0.55 * Math.sin((x + y) * 0.19);
        if (ridge > 0.95) m.set(x, y, Tile.CLIFF);
        else if (ridge < -0.9 || r(x, y, 7) < 0.04) m.set(x, y, Tile.GRASS);
      }
    },
    scatter: (t, v) => (t === Tile.GRAVEL ? (v < 0.07 ? Tile.STONE : v < 0.12 ? Tile.TREE : null) : t === Tile.GRASS ? (v < 0.15 ? Tile.TREE : v < 0.2 ? Tile.FLOWER : null) : null),
    forageOf: (t) => (t === Tile.GRASS || t === Tile.FLOWER ? 'meadow' : null),
  },
  // 古代遗迹：草地上几座残破的石砌院子，院墙有缺口，院子里立着断柱
  ruins: {
    ground: Tile.GRASS, wall: Tile.TREE, path: Tile.RUIN, boss: [48, 10], forest: false, pines: false,
    terrain(m, r) {
      for (const [x0, y0, x1, y1] of [[6, 5, 20, 14], [38, 4, 58, 16], [8, 27, 24, 38], [40, 27, 56, 38]] as const) {
        m.fill(x0, y0, x1, y1, Tile.RUIN);
        for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if (r(x, y, 8) > 0.35) m.set(x, y, Tile.PILLAR);
        for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) if (r(x, y, 8) > 0.35) m.set(x, y, Tile.PILLAR);
        for (let y = y0 + 3; y < y1 - 1; y += 4) for (let x = x0 + 3; x < x1 - 1; x += 5) if (r(x, y, 9) < 0.6) m.set(x, y, Tile.PILLAR);
      }
    },
    scatter: (t, v) => (t !== Tile.GRASS ? null : v < 0.08 ? Tile.TREE : v < 0.11 ? Tile.BUSH : v < 0.13 ? Tile.STONE : v < 0.18 ? Tile.FLOWER : null),
    forageOf: (t) => (t === Tile.GRASS ? 'meadow' : t === Tile.FLOWER ? 'forest' : null),
  },
};

const SEED: Record<RegionId, number> = { town: 0, mistwood: 11, starmarsh: 23, northcrag: 37, ruins: 51 };

/** 生成一个野外区域。地图是固定的（同一个区域每次都一样），所以可以缓存 */
export function buildWild(id: Exclude<RegionId, 'town'>): RegionLayout {
  const def = REGIONS[id];
  const th = THEMES[id];
  const seed = SEED[id];
  const r = (x: number, y: number, k = 0) => hash(x * 3 + seed * 977 + k * 131, y * 5 + seed * 59 + k * 17);
  const W = WILD_W;
  const H = WILD_H;
  const m = new TileMap(W, H, th.ground);
  th.terrain(m, r);

  // 小路和空地：开出来的格子都不会再放障碍物
  const keep = new Set<number>();
  const brush = (x: number, y: number) => {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const t = m.get(nx, ny);
      m.set(nx, ny, t === Tile.WATER || t === Tile.BRIDGE ? Tile.BRIDGE : th.path);
      keep.add(ny * W + nx);
    }
  };
  /** 一条弯弯曲曲的小路：大体朝目标走，偶尔横着拐一下 */
  const trail = (x0: number, y0: number, x1: number, y1: number, k: number) => {
    let x = x0;
    let y = y0;
    for (let step = 0; step < 400 && (x !== x1 || y !== y1); step++) {
      brush(x, y);
      const dx = x1 - x;
      const dy = y1 - y;
      const v = r(x, y, k);
      if (dx && (!dy || v < Math.abs(dx) / (Math.abs(dx) + Math.abs(dy)))) x += Math.sign(dx);
      else y += Math.sign(dy);
    }
    brush(x1, y1);
  };
  const clearing = (cx: number, cy: number, rad: number) => {
    ellipse(m, cx, cy, rad, rad * 0.8, (x, y, d) => {
      if (d >= 1 || x < 2 || y < 2 || x >= W - 2 || y >= H - 2) return;
      const t = m.get(x, y);
      if (isSolidTile(t) || t === Tile.WATER) m.set(x, y, th.ground);
      keep.add(y * W + x);
    });
  };

  const exits: RegionExit[] = [];
  for (const edge of Object.keys(def.links) as Edge[]) {
    const [from, to] = GATE[edge];
    exits.push({ edge, from, to, target: def.links[edge]! });
    // 从边缘笔直往里走 4 格，再拐向路标
    const [sx, sy, ix, iy] = edge === 'n' ? [from, 0, from, 4] : edge === 's' ? [from, H - 2, from, H - 6] : edge === 'w' ? [0, from, 4, from] : [W - 2, from, W - 6, from];
    trail(sx, sy, ix, iy, 1);
    trail(ix, iy, HUB[0], HUB[1], 2 + exits.length);
  }
  clearing(HUB[0] + 0.5, HUB[1] + 0.5, 3.5);
  trail(HUB[0], HUB[1], th.boss[0], th.boss[1], 9);
  clearing(th.boss[0] + 0.5, th.boss[1] + 0.5, 5);

  // 边界：两格厚，路口处留空
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (keep.has(y * W + x)) continue;
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) m.set(x, y, th.wall);
  }

  // 剩下的空地上放树、石头、灌木
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (keep.has(y * W + x)) continue;
    const t = th.scatter(m.get(x, y), r(x, y, 4));
    if (t !== null) m.set(x, y, t);
  }

  const waystone: [number, number] = [HUB[0], HUB[1] - 1];
  const arrive: [number, number] = [HUB[0], HUB[1] + 1];
  m.set(waystone[0], waystone[1], Tile.WAYSTONE);

  // 路牌：每个路口往里几格，立在小路旁边
  const signs: Record<string, string> = {};
  for (const ex of exits) {
    const [x, y] = ex.edge === 'n' ? [ex.from - 1, 4] : ex.edge === 's' ? [ex.from - 1, H - 5] : ex.edge === 'w' ? [4, ex.from - 1] : [W - 5, ex.from - 1];
    const arrow = { n: '↑', s: '↓', w: '←', e: '→' }[ex.edge];
    m.set(x, y, Tile.SIGN);
    signs[`${x},${y}`] = `${arrow} ${REGIONS[ex.target].name}`;
  }

  // 封掉走不到的地方，保证所有空地都能从路标走到
  const dist = distanceField(m, arrive[0], arrive[1], (t) => !isSolidTile(t) && t !== Tile.WATER);
  for (let i = 0; i < m.t.length; i++) {
    const t = m.t[i];
    if (dist[i] < 0 && !isSolidTile(t) && t !== Tile.WATER) m.t[i] = th.wall;
  }

  const forage: Record<ForageArea, [number, number][]> = { forest: [], meadow: [], beach: [] };
  const monsterSpots: [number, number][] = [];
  const digSpots: [number, number][] = [];
  const cells: { x: number; y: number; d: number }[] = [];
  const nearGate = (x: number, y: number) => exits.some((ex) => {
    const [ax, ay] = ex.edge === 'n' ? [ex.from, 2] : ex.edge === 's' ? [ex.from, H - 3] : ex.edge === 'w' ? [2, ex.from] : [W - 3, ex.from];
    return Math.abs(ax - x) + Math.abs(ay - y) < 9;
  });
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    if (dist[i] < 0) continue;
    const t = m.t[i];
    const area = th.forageOf(t);
    if (area) forage[area].push([x, y]);
    if (t === th.path || t === Tile.BRIDGE) continue;
    cells.push({ x, y, d: dist[i] });
    if (dist[i] >= 8 && !nearGate(x, y) && Math.hypot(x - th.boss[0], y - th.boss[1]) > 8) monsterSpots.push([x, y]);
    if (r(x, y, 10) < 0.04) digSpots.push([x, y]);
  }
  // 宝箱候选：离路标最远的一批角落
  const chestSpots = cells.filter((c) => Math.hypot(c.x - th.boss[0], c.y - th.boss[1]) > 6).sort((a, b) => b.d - a.d).slice(0, 12).map((c): [number, number] => [c.x, c.y]);

  return {
    id, map: m, exits, arrive, waystone, signs, forage, monsterSpots,
    boss: def.boss ? th.boss : null,
    digSpots, chestSpots,
    forest: th.forest ? [0, 0, W - 1, H - 1] : null,
    pines: th.pines,
  };
}

const cache = new Map<RegionId, RegionLayout>();

/** 取一个野外区域的地图（第一次用到时生成）。小镇用 townLayout */
export function wildLayout(id: Exclude<RegionId, 'town'>): RegionLayout {
  let L = cache.get(id);
  if (!L) {
    L = buildWild(id);
    cache.set(id, L);
  }
  return L;
}
