import type { BuildId, Craft, HomeCost, HouseDef, PlacedBuild } from '../data/buildings';
import {
  BUILDS, CHICKEN_PRICE, COMFORT_TIERS, EGG_DAYS, HOUSES, MAX_CHICKENS, MAX_HOUSE, RESTED_UNTIL, buildDef,
} from '../data/buildings';
import { CROPS, cropForSeed } from '../data/crops';
import type { ItemId } from '../data/items';
import { ITEMS } from '../data/items';
import type { SaveData } from '../state/save';
import { addItem, count, removeItem } from '../state/save';
import type { TileMap } from '../world/TileMap';
import { Tile, distanceField, isSolidTile } from '../world/TileMap';

/* ---------- 花费 ---------- */

export function canPay(s: SaveData, c: HomeCost): boolean {
  if (s.gold < (c.gold ?? 0)) return false;
  return (Object.entries(c.items) as [ItemId, number][]).every(([id, n]) => count(s, id) >= n);
}

export function pay(s: SaveData, c: HomeCost): boolean {
  if (!canPay(s, c)) return false;
  s.gold -= c.gold ?? 0;
  for (const [id, n] of Object.entries(c.items) as [ItemId, number][]) removeItem(s, id, n);
  return true;
}

export function costText(c: HomeCost): string {
  const parts = (Object.entries(c.items) as [ItemId, number][]).map(([id, n]) => `${ITEMS[id].name}×${n}`);
  if (c.gold) parts.unshift(`${c.gold} 金`);
  return parts.join('、');
}

/* ---------- 房子 ---------- */

export const houseOf = (s: SaveData): HouseDef => HOUSES[Math.min(s.home.house, MAX_HOUSE)];
export const nextHouse = (s: SaveData): HouseDef | null => (s.home.house < MAX_HOUSE ? HOUSES[s.home.house + 1] : null);
/** 仓库箱的格子数（仓库箱本身由背包那条线来做） */
export const storageSlots = (s: SaveData): number => houseOf(s).storage;
export const lateEnergy = (s: SaveData): number => houseOf(s).lateEnergy;

export type UpgradeResult = 'ok' | 'max' | 'cost';

export function upgradeHouse(s: SaveData): UpgradeResult {
  const next = nextHouse(s);
  if (!next?.cost) return 'max';
  if (!pay(s, next.cost)) return 'cost';
  s.home.house++;
  return 'ok';
}

/* ---------- 摆放 ---------- */

export const hasBuild = (s: SaveData, id: BuildId): boolean => s.home.builds.some((b) => b.id === id);

export function footprint(id: BuildId, x: number, y: number): [number, number][] {
  const d = buildDef(id);
  const out: [number, number][] = [];
  for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) out.push([x + dx, y + dy]);
  return out;
}

/** 某个格子上摆着的东西 */
export function buildAt(s: SaveData, x: number, y: number): PlacedBuild | null {
  return s.home.builds.find((b) => {
    const d = buildDef(b.id);
    return x >= b.x && x < b.x + d.w && y >= b.y && y < b.y + d.h;
  }) ?? null;
}

/** 为什么这个东西现在不能盖（和位置无关）；能盖返回 null */
export function buildBlocker(s: SaveData, id: BuildId): string | null {
  const d = buildDef(id);
  if (d.kind === 'facility') {
    if (hasBuild(s, id)) return '已经盖好了';
    if ((d.house ?? 0) > s.home.house) return `房子升到${HOUSES[d.house ?? 0].name}以后才能盖`;
    if (d.cost && !canPay(s, d.cost)) return `材料不够：${costText(d.cost)}`;
    return null;
  }
  if (d.item && count(s, d.item) <= 0) return `背包里没有${ITEMS[d.item].name}`;
  return null;
}

/** 农场上可以盖东西的几块地（地图给出），以及要留空的格子 */
export interface Lot {
  areas: [number, number, number, number][];
  reserved: [number, number, number, number][];
  /** 从这里出发检查会不会把路堵死 */
  home: [number, number];
}

export function placeError(map: TileMap, s: SaveData, lot: Lot, id: BuildId, x: number, y: number): string | null {
  const d = buildDef(id);
  const cells = footprint(id, x, y);
  const inRect = (cx: number, cy: number, [x0, y0, x1, y1]: [number, number, number, number]) => cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
  for (const [cx, cy] of cells) {
    if (!lot.areas.some((a) => inRect(cx, cy, a))) return '只能盖在自家农场的空地上';
    if (lot.reserved.some((r) => inRect(cx, cy, r))) return '这里要留空';
    const t = map.get(cx, cy);
    if (d.kind === 'sprinkler') {
      if (t !== Tile.FIELD) return '洒水器要摆在田里';
      if (s.field[`${cx},${cy}`]?.crop) return '这块田里种着东西';
    } else if (t !== Tile.GRASS && t !== Tile.FLOWER) return '这里不是空地';
    if (lot.home[0] === cx && lot.home[1] === cy) return '不能挡住家门';
  }
  // 洒水器在围栏里，不会挡路；其他东西盖下去以后，原来走得到的地方必须都还走得到
  if (d.kind !== 'sprinkler') {
    const before = reachable(map, lot.home, []);
    const after = reachable(map, lot.home, cells);
    if (after !== before - cells.length) return '会把路堵住';
  }
  return null;
}

function reachable(map: TileMap, from: [number, number], extra: [number, number][]): number {
  const blocked = new Set(extra.map(([x, y]) => y * map.w + x));
  const saved = extra.map(([x, y]) => map.get(x, y));
  for (const [x, y] of extra) map.set(x, y, Tile.BUILT);
  const dist = distanceField(map, from[0], from[1], (t) => !isSolidTile(t));
  extra.forEach(([x, y], i) => map.set(x, y, saved[i]));
  let n = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] >= 0 && !blocked.has(i)) n++;
  return n;
}

/** 盖下去：设施花材料，洒水器和装饰从背包里拿。位置合不合法由调用方先用 placeError 检查 */
export function place(s: SaveData, id: BuildId, x: number, y: number): boolean {
  if (buildBlocker(s, id)) return false;
  const d = buildDef(id);
  if (d.kind === 'facility') pay(s, d.cost ?? { items: {} });
  else if (d.item) removeItem(s, d.item);
  for (const [cx, cy] of footprint(id, x, y)) {
    delete s.field[`${cx},${cy}`];
    delete s.forage[`${cx},${cy}`];
  }
  s.home.builds.push({ id, x, y });
  return true;
}

/** 收起洒水器或装饰，放回背包。设施盖了就拆不掉 */
export function pickUp(s: SaveData, b: PlacedBuild): boolean {
  const d = buildDef(b.id);
  if (d.kind === 'facility' || !d.item) return false;
  const i = s.home.builds.indexOf(b);
  if (i < 0) return false;
  s.home.builds.splice(i, 1);
  addItem(s, d.item);
  return true;
}

/* ---------- 工作台和熔炉 ---------- */

export const canCraft = (s: SaveData, c: Craft): boolean => canPay(s, c.needs);

export function craft(s: SaveData, c: Craft): boolean {
  if (!pay(s, c.needs)) return false;
  addItem(s, c.out, c.n);
  return true;
}

/* ---------- 温室 ---------- */

export function plantGreen(s: SaveData, i: number, seed: ItemId): boolean {
  const plot = s.home.greenhouse[i];
  const crop = cropForSeed(seed);
  if (!plot || plot.crop || !crop || count(s, seed) <= 0) return false;
  removeItem(s, seed);
  plot.crop = crop;
  plot.days = 0;
  return true;
}

export const greenRipe = (s: SaveData, i: number): boolean => {
  const p = s.home.greenhouse[i];
  return !!p?.crop && p.days >= CROPS[p.crop].days;
};

export function harvestGreen(s: SaveData, i: number): ItemId | null {
  const p = s.home.greenhouse[i];
  if (!p?.crop || !greenRipe(s, i)) return null;
  const def = CROPS[p.crop];
  addItem(s, def.item);
  if ('regrow' in def && def.regrow) p.days = def.days - def.regrow;
  else {
    p.crop = null;
    p.days = 0;
  }
  return def.item;
}

/* ---------- 鸡舍 ---------- */

export function buyChicken(s: SaveData): boolean {
  if (!hasBuild(s, 'coop') || s.home.chickens >= MAX_CHICKENS || s.gold < CHICKEN_PRICE) return false;
  s.gold -= CHICKEN_PRICE;
  s.home.chickens++;
  return true;
}

export function collectEggs(s: SaveData): number {
  const n = s.home.eggs;
  if (n > 0) addItem(s, 'egg', n);
  s.home.eggs = 0;
  return n;
}

/* ---------- 舒适度 ---------- */

export function comfort(s: SaveData): number {
  let c = houseOf(s).comfort;
  for (const b of s.home.builds) c += buildDef(b.id).comfort ?? 0;
  return c;
}

export const comfortTier = (s: SaveData) => COMFORT_TIERS.find((t) => comfort(s) >= t.min) ?? null;

/* ---------- 新的一天 ---------- */

/**
 * 睡醒以后家里的变化。要在 advanceDay 之后、清掉料理效果之后调用：
 * 温室里的作物长一天，鸡下蛋，洒水器浇水，地上的石头重新长出来，舒适度够的话带上“睡得香”。
 * 返回早上要告诉玩家的消息。
 */
export function homeMorning(s: SaveData): string[] {
  const h = s.home;
  const msgs: string[] = [];
  if (hasBuild(s, 'greenhouse')) {
    for (const p of h.greenhouse) if (p.crop && p.days < CROPS[p.crop].days) p.days++;
    if (h.greenhouse.some((_, i) => greenRipe(s, i))) msgs.push('温室里有成熟的作物了。');
  }
  if (hasBuild(s, 'coop') && h.chickens > 0) {
    h.eggs = Math.min(h.chickens * EGG_DAYS, h.eggs + h.chickens);
  }
  let watered = 0;
  for (const b of h.builds) {
    const reach = (BUILDS[b.id] as { reach?: [number, number][] }).reach;
    if (!reach) continue;
    for (const [dx, dy] of reach) {
      const f = s.field[`${b.x + dx},${b.y + dy}`];
      if (f && !f.watered) {
        f.watered = true;
        watered++;
      }
    }
  }
  if (watered && s.weather !== 'rain') msgs.push(`洒水器给 ${watered} 块田浇好了水。`);
  h.quarried = [];
  const tier = comfortTier(s);
  if (tier && !s.buff) {
    s.buff = { stat: 'regen', value: tier.regen, until: RESTED_UNTIL, from: 'bench', label: tier.name };
  }
  return msgs;
}

/* ---------- 建材的来源 ---------- */

/** 用镐敲碎小镇地上的一块石头，返回得到的石料数量；今天已经敲过的返回 0 */
export function quarry(s: SaveData, x: number, y: number, rand: () => number = Math.random): number {
  const key = `${x},${y}`;
  if (s.home.quarried.includes(key)) return 0;
  s.home.quarried.push(key);
  const n = 2 + (rand() < 0.4 ? 1 : 0);
  addItem(s, 'stone', n);
  return n;
}

/** 挖矿时顺带得到的石料 */
export function oreStone(s: SaveData, rand: () => number = Math.random): number {
  if (rand() >= 0.35) return 0;
  addItem(s, 'stone', 1);
  return 1;
}

const WOOD_CAP = 10;
const WOOD_DAILY = 6;

/** 每天在林子和草地上掉一些木材，和采集物一样走过去就能捡 */
export function spawnWood(s: SaveData, spots: [number, number][], rand: () => number = Math.random): number {
  if (s.home.woodDay === s.day) return 0;
  s.home.woodDay = s.day;
  if (!spots.length) return 0;
  let have = Object.values(s.forage).filter((id) => id === 'wood').length;
  let added = 0;
  for (let i = 0; i < WOOD_DAILY && have < WOOD_CAP; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const [x, y] = spots[Math.floor(rand() * spots.length)];
      const k = `${x},${y}`;
      if (s.forage[k]) continue;
      s.forage[k] = 'wood';
      have++;
      added++;
      break;
    }
  }
  return added;
}
