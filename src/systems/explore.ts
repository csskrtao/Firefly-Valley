import type { Gear, NewGear } from '../data/gear';
import { gearTierFor } from '../data/gear';
import type { ItemId } from '../data/items';
import { ITEMS, ITEM_IDS } from '../data/items';
import type { MonsterId } from '../data/monsters';
import { BOSSES, MONSTERS } from '../data/monsters';
import type { BookPage, Cell, EventKind, ExploreState, HiddenId, MapTarget, WildRegion } from '../data/treasure';
import {
  BOOK_REWARDS, BOOK_TREASURES, CAMP, DIG_DAILY, DIG_DAILY_WILD, DIG_GEAR_CHANCE, DIG_GOLD, DIG_MAP_CHANCE, DIG_TABLE, EVENT_CHANCE,
  EVENT_TOWN_WEIGHT, EVENT_WEIGHTS, HIDDEN_CHESTS, HIDDEN_IDS, MAP_GEAR_LUCK, MAP_GOLD, MAP_SPOTS, MAP_TREASURES, MERCHANT_STOCK,
  TRAVELER_GEAR_CHANCE, TRAVELER_GIFTS, TRAVELER_GOLD, TRAVELER_MAP_CHANCE, WILD_HIDDEN, gearPrice, hiddenName, newExplore,
} from '../data/treasure';
import type { SaveData } from '../state/save';
import { addItem, count, giveGear, removeItem, seasonOf } from '../state/save';
import type { RegionId } from '../world/regions/defs';
import { REGIONS } from '../world/regions/defs';
import type { ZoneSites } from '../world/exploreSites';
import { forageFor } from './forage';
import { rollGear } from './gear';
import type { Loot } from './loot';
import { forageKey } from './regions';
import { accSum } from './stats';

type Rand = () => number;

/** 探险拿到的东西；got 是真正放进背包的装备（有编号，可以拿去提示） */
export type ExploreLoot = Loot & { got: Gear[] };

const ri = (rand: Rand, a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pickOf = <T>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];

/** 存档里的键 "区域id:x,y" 拆开；小镇的键没有前缀 */
export function splitKey(k: string): { region: RegionId; x: number; y: number } {
  const i = k.indexOf(':');
  const region = (i < 0 ? 'town' : k.slice(0, i)) as RegionId;
  const [x, y] = k.slice(i + 1).split(',').map(Number);
  return { region, x, y };
}

/** 一个区域掉的装备是第几阶 */
export const regionGearTier = (r: RegionId): number => gearTierFor(REGIONS[r]?.tier ?? 1);

/** 按这个区域的阶级抽一件装备 */
function gearFor(s: SaveData, region: RegionId, source: 'monster' | 'chest' | 'boss', rand: Rand, luck = 0): NewGear {
  return rollGear({ cls: s.cls, types: s.weaponTypes, tier: regionGearTier(region), source, luck: accSum(s, 'luck') + luck }, rand);
}

/** 老存档或者手动改坏的存档：缺的字段补上默认值，旧格式换成新格式 */
export function explore(s: SaveData): ExploreState {
  if (!s.explore) s.explore = newExplore();
  const e = s.explore;
  const base = newExplore();
  for (const k of Object.keys(base) as (keyof ExploreState)[]) {
    if (e[k] === undefined) (e as unknown as Record<string, unknown>)[k] = base[k];
  }
  // 第一版的藏宝图只记了小镇埋宝点的下标
  if (e.mapSpot >= 0) {
    const old = MAP_SPOTS[e.mapSpot];
    if (old && !e.map) e.map = { region: 'town', at: old.at, hint: old.hint };
    e.mapSpot = -1;
  }
  e.lit = e.lit.map((v) => (typeof v === 'number' ? `brazier:${v}` : v));
  if (e.event && !e.event.region) e.event.region = 'town';
  return e;
}

const emptyLoot = (): ExploreLoot => ({ gold: 0, items: {}, blueprint: null, gear: null, got: [] });

function addTo(loot: Loot, id: ItemId, n: number): void {
  loot.items[id] = (loot.items[id] ?? 0) + n;
}

/** 把奖励放进背包，并记到收集册里 */
export function grant(s: SaveData, loot: ExploreLoot): ExploreLoot {
  s.gold += loot.gold;
  for (const [id, n] of Object.entries(loot.items) as [ItemId, number][]) {
    addItem(s, id, n);
    record(s, id);
  }
  if (loot.gear) loot.got.push(giveGear(s, loot.gear));
  return loot;
}

/** 收集册：宝物和采集物第一次拿到时记下来 */
export function record(s: SaveData, id: ItemId): void {
  const e = explore(s);
  if (BOOK_TREASURES.includes(id) && !e.found.includes(id)) e.found.push(id);
  if (ITEMS[id].kind === 'forage' && !e.foraged.includes(id)) e.foraged.push(id);
}

/* ---------- 新的一天 ---------- */

/** 事件的位置 */
export function eventSpot(zones: ZoneSites[], ev: { kind: EventKind; region?: RegionId; spot: number }): { at: Cell; where: string } | null {
  const z = zones.find((zz) => zz.region === (ev.region ?? 'town'));
  return z?.events[ev.kind][ev.spot] ?? null;
}

/**
 * 新的一天：清掉昨天没挖的闪光点，在每个能去的区域重新冒出几个；火盆熄灭；重新抽今天的随机事件。
 * zones 是现在能去的区域（萤石镇排第一）。返回早上要告诉玩家的话。
 */
export function newExploreDay(s: SaveData, zones: ZoneSites[], rand: Rand = Math.random): string[] {
  const e = explore(s);
  e.day = s.day;
  e.lit = [];
  e.digs = [];
  for (const z of zones) {
    const [a, b] = z.region === 'town' ? DIG_DAILY : DIG_DAILY_WILD;
    const want = ri(rand, a, b);
    const free = z.digCells.filter(([x, y]) => !s.forage[forageKey(z.region, x, y)]);
    let got = 0;
    for (let tries = 0; got < want && tries < want * 20 && free.length; tries++) {
      const [x, y] = pickOf(rand, free);
      const k = forageKey(z.region, x, y);
      if (e.digs.includes(k)) continue;
      e.digs.push(k);
      got++;
    }
  }
  e.event = null;
  const news: string[] = [];
  if (rand() < EVENT_CHANCE) {
    const kind = rollKind(rand);
    const able = zones.filter((z) => z.events[kind].length);
    if (able.length) {
      const z = pickZone(able, rand);
      const spot = Math.floor(rand() * z.events[kind].length);
      e.event = { kind, region: z.region, spot, stage: 0, sold: [] };
      if (kind === 'merchant') e.event.wares = gearFor(s, z.region, 'chest', rand, 1);
      const where = z.events[kind][spot].where;
      news.push({
        merchant: `听说${where}来了一位流浪商人，带着些稀罕货。`,
        traveler: `有人说${where}躺着一位受伤的旅人，好像需要帮忙。`,
        camp: `${where}出现了一个怪物营地，领头的家伙看起来不好惹。`,
      }[kind]);
    }
  }
  return news;
}

function pickZone(zones: ZoneSites[], rand: Rand): ZoneSites {
  const w = zones.map((z) => (z.region === 'town' ? EVENT_TOWN_WEIGHT : 1));
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < zones.length; i++) {
    r -= w[i];
    if (r <= 0) return zones[i];
  }
  return zones[zones.length - 1];
}

function rollKind(rand: Rand): EventKind {
  const entries = Object.entries(EVENT_WEIGHTS) as [EventKind, number][];
  let r = rand() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/* ---------- 挖宝 ---------- */

export const hasShovel = (s: SaveData): boolean => count(s, 'shovel') > 0;

/** 挖开一个闪光点：一定有金币，再出一样东西，有几率出藏宝图或一件装备。不是闪光点返回 null */
export function dig(s: SaveData, k: string, rand: Rand = Math.random): ExploreLoot | null {
  const e = explore(s);
  const i = e.digs.indexOf(k);
  if (i < 0) return null;
  e.digs.splice(i, 1);
  const { region } = splitKey(k);
  const luck = accSum(s, 'luck');
  const loot = emptyLoot();
  // 越危险的地方挖出来的金币越多
  const mul = 1 + ((REGIONS[region]?.tier ?? 1) - 1) * 0.15;
  loot.gold = Math.round(ri(rand, DIG_GOLD[0], DIG_GOLD[1]) * mul);
  const total = DIG_TABLE.reduce((a, t) => a + t.w, 0);
  let r = rand() * total;
  for (const t of DIG_TABLE) {
    r -= t.w;
    if (r > 0) continue;
    const n = ri(rand, t.n[0], t.n[1]) + (luck > 0 && rand() < 0.3 ? 1 : 0);
    if (t.id === 'forage') {
      const pool = [...new Set([...forageFor('meadow', seasonOf(s.day)), ...forageFor('forest', seasonOf(s.day))])];
      addTo(loot, pool.length ? pickOf(rand, pool) : 'oldCoin', n);
    } else addTo(loot, t.id, n);
    break;
  }
  if (rand() < DIG_MAP_CHANCE * (1 + luck)) addTo(loot, 'treasureMap', 1);
  else if (rand() < DIG_GEAR_CHANCE * (1 + luck * 0.5)) loot.gear = gearFor(s, region, 'monster', rand);
  return grant(s, loot);
}

/* ---------- 藏宝图 ---------- */

/** 藏宝图可能指向的地方：现在能去的区域里的埋宝点 */
export function mapCandidates(zones: ZoneSites[]): MapTarget[] {
  return zones.flatMap((z) => z.mapSpots.map((m) => ({ region: z.region, at: m.at, hint: m.hint })));
}

/** 手上有藏宝图但还没看过：看看它指向哪里；已经有一张在找了就先不换 */
export function readMap(s: SaveData, zones: ZoneSites[], rand: Rand = Math.random): MapTarget | null {
  const e = explore(s);
  if (count(s, 'treasureMap') <= 0) return null;
  if (e.map) return e.map;
  const list = mapCandidates(zones);
  if (!list.length) return null;
  e.map = pickOf(rand, list);
  return e.map;
}

/** 当前藏宝图的埋宝地点 */
export function mapTarget(s: SaveData): MapTarget | null {
  const e = explore(s);
  return count(s, 'treasureMap') > 0 ? e.map : null;
}

/** 在藏宝图指的地方挖：用掉一张图，挖出一大笔宝藏和一件好装备 */
export function digMap(s: SaveData, rand: Rand = Math.random): ExploreLoot | null {
  const e = explore(s);
  const t = mapTarget(s);
  if (!t) return null;
  removeItem(s, 'treasureMap', 1);
  e.map = null;
  const loot = emptyLoot();
  loot.gold = ri(rand, MAP_GOLD[0], MAP_GOLD[1]);
  // 宝藏页还缺的稀有宝物优先
  const missing = MAP_TREASURES.filter((id) => !e.found.includes(id));
  addTo(loot, pickOf(rand, missing.length ? missing : MAP_TREASURES), 1);
  loot.gear = gearFor(s, t.region, 'chest', rand, MAP_GEAR_LUCK);
  return grant(s, loot);
}

/* ---------- 隐藏宝箱 ---------- */

export const isOpened = (s: SaveData, id: HiddenId): boolean => explore(s).opened.includes(id);

/** 打开隐藏宝箱。小镇的三个给固定的饰品；野外的一定有一件稀有以上的装备 */
export function openHidden(s: SaveData, id: HiddenId, rand: Rand = Math.random): ExploreLoot | null {
  const e = explore(s);
  if (e.opened.includes(id)) return null;
  e.opened.push(id);
  const loot = emptyLoot();
  if (id in HIDDEN_CHESTS) {
    const r = HIDDEN_CHESTS[id as keyof typeof HIDDEN_CHESTS].reward;
    loot.gold = r.gold;
    loot.items = { ...r.items };
  } else {
    const w = WILD_HIDDEN[id as WildRegion];
    loot.gold = w.gold;
    loot.items = { ...w.items };
    loot.gear = gearFor(s, id as WildRegion, 'boss', rand);
  }
  return grant(s, loot);
}

/** 点亮一个火盆，返回是不是这个宝箱的火盆都亮了 */
export function lightBrazier(s: SaveData, chest: HiddenId, i: number, total: number): boolean {
  const e = explore(s);
  const k = `${chest}:${i}`;
  if (!e.lit.includes(k)) e.lit.push(k);
  return litCount(s, chest) >= total;
}

export const isLit = (s: SaveData, chest: HiddenId, i: number): boolean => explore(s).lit.includes(`${chest}:${i}`);
export const litCount = (s: SaveData, chest: HiddenId): number => explore(s).lit.filter((k) => String(k).startsWith(`${chest}:`)).length;

/* ---------- 随机事件 ---------- */

export interface StockItem {
  key: string;
  /** 卖的是物品，或者是一件装备 */
  id?: ItemId;
  gear?: NewGear;
  price: number;
  soldOut: boolean;
}

/** 商人今天卖的东西，最后一格是他这次带来的装备 */
export function merchantStock(s: SaveData): StockItem[] {
  const e = explore(s);
  const out: StockItem[] = [];
  for (const st of MERCHANT_STOCK) {
    const soldOut = !!st.once && !!e.event?.sold.includes(st.id);
    if (st.id === 'gear') {
      const g = e.event?.wares;
      if (g) out.push({ key: st.id, gear: g, price: gearPrice(g), soldOut });
    } else out.push({ key: st.id, id: st.id, price: st.price, soldOut });
  }
  return out;
}

export function buyFromMerchant(s: SaveData, item: StockItem): { ok: boolean; msg: string; got: Gear[] } {
  const e = explore(s);
  if (e.event?.kind !== 'merchant') return { ok: false, msg: '商人已经走了。', got: [] };
  if (item.soldOut) return { ok: false, msg: '这件已经卖完了。', got: [] };
  if (s.gold < item.price) return { ok: false, msg: '金币不够。', got: [] };
  s.gold -= item.price;
  const got: Gear[] = [];
  if (item.gear) got.push(giveGear(s, item.gear));
  if (item.id) {
    addItem(s, item.id, 1);
    record(s, item.id);
  }
  const once = MERCHANT_STOCK.find((m) => m.id === item.key)?.once;
  if (once) e.event.sold.push(item.key);
  return { ok: true, msg: item.id ? `买下了${ITEMS[item.id].name}。` : '买下了这件装备。', got };
}

/** 能拿来救旅人的东西：药水和能回血的料理、作物 */
export function travelerCures(s: SaveData): ItemId[] {
  return ITEM_IDS.filter((id) => {
    const d = ITEMS[id] as { kind: string; heal?: number };
    return count(s, id) > 0 && (d.heal ?? 0) >= 20 && ['consumable', 'dish', 'crop'].includes(d.kind);
  });
}

export function helpTraveler(s: SaveData, give: ItemId, rand: Rand = Math.random): ExploreLoot | null {
  const e = explore(s);
  if (e.event?.kind !== 'traveler' || e.event.stage >= 2) return null;
  if (!travelerCures(s).includes(give) || !removeItem(s, give, 1)) return null;
  e.event.stage = 2;
  const loot = emptyLoot();
  loot.gold = ri(rand, TRAVELER_GOLD[0], TRAVELER_GOLD[1]);
  addTo(loot, pickOf(rand, TRAVELER_GIFTS), 1);
  if (rand() < TRAVELER_MAP_CHANCE) addTo(loot, 'treasureMap', 1);
  if (rand() < TRAVELER_GEAR_CHANCE) loot.gear = gearFor(s, e.event.region ?? 'town', 'chest', rand);
  return grant(s, loot);
}

/** 精英营地打完了 */
export function clearCamp(s: SaveData): void {
  const e = explore(s);
  if (e.event?.kind !== 'camp' || e.event.stage !== 0) return;
  e.event.stage = 1;
  e.camps++;
}

/** 营地的强度：至少是 CAMP.floor，野外区域按区域强度再高一层 */
export function campTier(s: SaveData): number {
  const r = explore(s).event?.region ?? 'town';
  return Math.max(CAMP.floor, (REGIONS[r]?.tier ?? 1) + 1);
}

/** 打开营地的宝箱：金币和宝物，再加上按矿脉宝箱算的那一份，精英一定掉一件稀有以上的装备 */
export function openCampChest(s: SaveData, chest: Loot, rand: Rand = Math.random): ExploreLoot | null {
  const e = explore(s);
  if (e.event?.kind !== 'camp' || e.event.stage !== 1) return null;
  e.event.stage = 2;
  const loot: ExploreLoot = { gold: chest.gold, items: { ...chest.items }, blueprint: null, gear: gearFor(s, e.event.region ?? 'town', 'boss', rand), got: [] };
  addTo(loot, pickOf(rand, ['amber', 'fossil', 'starShard'] as ItemId[]), 1);
  grant(s, loot);
  // 矿脉宝箱那一份也可能带了一件装备
  if (chest.gear) loot.got.push(giveGear(s, chest.gear));
  return loot;
}

/* ---------- 收集册 ---------- */

export interface BookEntry {
  name: string;
  got: boolean;
  /** 打倒的数量之类的小字 */
  note?: string;
}

export function bookEntries(s: SaveData, page: BookPage): BookEntry[] {
  const e = explore(s);
  switch (page) {
    case 'treasure':
      return [
        ...BOOK_TREASURES.map((id) => ({ name: ITEMS[id].name, got: e.found.includes(id) })),
        ...HIDDEN_IDS.map((id) => ({ name: hiddenName(id), got: e.opened.includes(id) })),
      ];
    case 'monster':
      return [
        ...(Object.keys(MONSTERS) as MonsterId[]).map((id) => ({ name: MONSTERS[id].name, got: (s.kills[id] ?? 0) > 0, note: s.kills[id] ? `${s.kills[id]} 只` : undefined })),
        ...(Object.keys(BOSSES) as (keyof typeof BOSSES)[]).map((id) => ({ name: BOSSES[id].name, got: s.bosses.includes(id) })),
        ...(Object.keys(REGIONS) as RegionId[]).flatMap((id) => {
          const b = REGIONS[id].boss;
          return b ? [{ name: b.name, got: s.regionBosses?.[id] !== undefined }] : [];
        }),
        { name: '精英营地', got: e.camps > 0, note: e.camps ? `${e.camps} 个` : undefined },
      ];
    case 'forage':
      return ITEM_IDS.filter((id) => ITEMS[id].kind === 'forage').map((id) => ({ name: ITEMS[id].name, got: e.foraged.includes(id) }));
  }
}

export function bookProgress(s: SaveData, page: BookPage): { have: number; need: number } {
  const list = bookEntries(s, page);
  return { have: list.filter((x) => x.got).length, need: list.length };
}

export type Tier = 'half' | 'full';

export function canClaim(s: SaveData, page: BookPage, tier: Tier): boolean {
  if (explore(s).claimed.includes(`${page}:${tier}`)) return false;
  const { have, need } = bookProgress(s, page);
  return tier === 'full' ? have >= need : have * 2 >= need;
}

export function claimBook(s: SaveData, page: BookPage, tier: Tier): ExploreLoot | null {
  if (!canClaim(s, page, tier)) return null;
  explore(s).claimed.push(`${page}:${tier}`);
  const r = BOOK_REWARDS[page][tier];
  return grant(s, { ...emptyLoot(), gold: r.gold, items: { ...r.items } });
}
