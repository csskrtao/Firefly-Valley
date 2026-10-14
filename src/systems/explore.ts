import type { ItemId } from '../data/items';
import { ITEMS, ITEM_IDS } from '../data/items';
import type { MonsterId } from '../data/monsters';
import { BOSSES, MONSTERS } from '../data/monsters';
import type { BookPage, Cell, EventKind, ExploreState, HiddenId } from '../data/treasure';
import {
  BOOK_REWARDS, BOOK_TREASURES, DIG_ACC_CHANCE, DIG_DAILY, DIG_GOLD, DIG_MAP_CHANCE, DIG_TABLE, EVENT_CHANCE, EVENT_SPOTS, EVENT_WEIGHTS,
  HIDDEN_CHESTS, HIDDEN_IDS, MAP_GOLD, MAP_SPOTS, MAP_TREASURES, MERCHANT_STOCK, TRAVELER_GIFTS, TRAVELER_GOLD, TRAVELER_MAP_CHANCE,
  TREASURE_ACCESSORIES, newExplore,
} from '../data/treasure';
import type { SaveData } from '../state/save';
import { addItem, count, owns, removeItem, seasonOf } from '../state/save';
import type { Loot } from './loot';
import { forageFor } from './forage';
import { accSum } from './stats';

type Rand = () => number;

const ri = (rand: Rand, a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const pickOf = <T>(rand: Rand, arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const keyOf = (x: number, y: number) => `${x},${y}`;

/** 老存档或者手动改坏的存档：缺的字段补上默认值 */
export function explore(s: SaveData): ExploreState {
  if (!s.explore) s.explore = newExplore();
  const e = s.explore;
  const base = newExplore();
  for (const k of Object.keys(base) as (keyof ExploreState)[]) {
    if (e[k] === undefined) (e as unknown as Record<string, unknown>)[k] = base[k];
  }
  return e;
}

const emptyLoot = (): Loot => ({ gold: 0, items: {}, blueprint: null });

function addTo(loot: Loot, id: ItemId, n: number): void {
  loot.items[id] = (loot.items[id] ?? 0) + n;
}

/** 一件还没有的饰品，都有了就返回 null */
function newAccessory(s: SaveData, rand: Rand, pool: ItemId[] = TREASURE_ACCESSORIES): ItemId | null {
  const left = pool.filter((id) => !owns(s, id));
  return left.length ? pickOf(rand, left) : null;
}

/** 把奖励放进背包，并记到收集册里 */
export function grant(s: SaveData, loot: Loot): void {
  s.gold += loot.gold;
  for (const [id, n] of Object.entries(loot.items) as [ItemId, number][]) {
    addItem(s, id, n);
    record(s, id);
  }
}

/** 收集册：宝物和采集物第一次拿到时记下来 */
export function record(s: SaveData, id: ItemId): void {
  const e = explore(s);
  if (BOOK_TREASURES.includes(id) && !e.found.includes(id)) e.found.push(id);
  if (ITEMS[id].kind === 'forage' && !e.foraged.includes(id)) e.foraged.push(id);
}

/* ---------- 新的一天 ---------- */

/**
 * 新的一天：清掉昨天没挖的闪光点，重新冒出几个；火盆熄灭；重新抽今天的随机事件。
 * 返回早上要告诉玩家的话。
 */
export function newExploreDay(s: SaveData, digCells: Cell[], rand: Rand = Math.random): string[] {
  const e = explore(s);
  e.day = s.day;
  e.lit = [];
  e.digs = [];
  const want = ri(rand, DIG_DAILY[0], DIG_DAILY[1]);
  const free = digCells.filter(([x, y]) => !s.forage[keyOf(x, y)]);
  for (let tries = 0; e.digs.length < want && tries < want * 20 && free.length; tries++) {
    const [x, y] = pickOf(rand, free);
    const k = keyOf(x, y);
    if (!e.digs.includes(k)) e.digs.push(k);
  }
  e.event = null;
  const news: string[] = [];
  if (rand() < EVENT_CHANCE) {
    const kind = rollKind(rand);
    const spot = Math.floor(rand() * EVENT_SPOTS[kind].length);
    e.event = { kind, spot, stage: 0, sold: [] };
    const where = EVENT_SPOTS[kind][spot].where;
    news.push({
      merchant: `听说${where}来了一位流浪商人，带着些稀罕货。`,
      traveler: `有人说${where}躺着一位受伤的旅人，好像需要帮忙。`,
      camp: `${where}出现了一个怪物营地，领头的家伙看起来不好惹。`,
    }[kind]);
  }
  return news;
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

/** 挖开一个闪光点：一定有金币，再出一样东西，有几率出藏宝图或饰品。不是闪光点返回 null */
export function dig(s: SaveData, k: string, rand: Rand = Math.random): Loot | null {
  const e = explore(s);
  const i = e.digs.indexOf(k);
  if (i < 0) return null;
  e.digs.splice(i, 1);
  const luck = accSum(s, 'luck');
  const loot = emptyLoot();
  loot.gold = ri(rand, DIG_GOLD[0], DIG_GOLD[1]);
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
  else if (rand() < DIG_ACC_CHANCE) {
    const acc = newAccessory(s, rand);
    if (acc) addTo(loot, acc, 1);
  }
  grant(s, loot);
  if (loot.items.treasureMap) readMap(s, rand);
  return loot;
}

/* ---------- 藏宝图 ---------- */

/** 拿到藏宝图后看看它指向哪里；已经有一张在找了就先不换 */
export function readMap(s: SaveData, rand: Rand = Math.random): number {
  const e = explore(s);
  if (e.mapSpot >= 0 || count(s, 'treasureMap') <= 0) return e.mapSpot;
  e.mapSpot = Math.floor(rand() * MAP_SPOTS.length);
  return e.mapSpot;
}

/** 当前藏宝图的埋宝格子 */
export function mapTarget(s: SaveData): Cell | null {
  const e = explore(s);
  if (e.mapSpot < 0 || count(s, 'treasureMap') <= 0) return null;
  return MAP_SPOTS[e.mapSpot]?.at ?? null;
}

/** 在藏宝图指的地方挖：用掉一张图，挖出一大笔宝藏；还有图的话接着看下一张 */
export function digMap(s: SaveData, rand: Rand = Math.random): Loot | null {
  const e = explore(s);
  if (!mapTarget(s)) return null;
  removeItem(s, 'treasureMap', 1);
  e.mapSpot = -1;
  const loot = emptyLoot();
  loot.gold = ri(rand, MAP_GOLD[0], MAP_GOLD[1]);
  // 宝藏页还缺的稀有宝物优先
  const missing = MAP_TREASURES.filter((id) => !e.found.includes(id));
  addTo(loot, pickOf(rand, missing.length ? missing : MAP_TREASURES), 1);
  const acc = newAccessory(s, rand);
  if (acc && rand() < 0.5) addTo(loot, acc, 1);
  else addTo(loot, rand() < 0.5 ? 'gold' : 'glowstone', ri(rand, 1, 2));
  grant(s, loot);
  readMap(s, rand);
  return loot;
}

/* ---------- 隐藏宝箱 ---------- */

export const isOpened = (s: SaveData, id: HiddenId): boolean => explore(s).opened.includes(id);

export function openHidden(s: SaveData, id: HiddenId): Loot | null {
  const e = explore(s);
  if (e.opened.includes(id)) return null;
  e.opened.push(id);
  const r = HIDDEN_CHESTS[id].reward;
  const loot: Loot = { gold: r.gold, items: { ...r.items }, blueprint: null };
  grant(s, loot);
  return loot;
}

/** 点亮一个火盆，返回是不是三个都亮了 */
export function lightBrazier(s: SaveData, i: number, total: number): boolean {
  const e = explore(s);
  if (!e.lit.includes(i)) e.lit.push(i);
  return e.lit.length >= total;
}

/* ---------- 随机事件 ---------- */

export interface StockItem {
  key: string;
  id: ItemId;
  price: number;
  soldOut: boolean;
}

/** 商人今天卖的东西。饰品那一格每天按日子固定成一件还没有的饰品 */
export function merchantStock(s: SaveData): StockItem[] {
  const e = explore(s);
  const out: StockItem[] = [];
  for (const st of MERCHANT_STOCK) {
    let id: ItemId | null;
    if (st.id === 'accessory') {
      const left = TREASURE_ACCESSORIES.filter((a) => !owns(s, a));
      id = left.length ? left[s.day % left.length] : null;
    } else id = st.id;
    if (!id) continue;
    out.push({ key: st.id, id, price: st.price, soldOut: !!st.once && !!e.event?.sold.includes(st.id) });
  }
  return out;
}

export function buyFromMerchant(s: SaveData, item: StockItem, rand: Rand = Math.random): { ok: boolean; msg: string } {
  const e = explore(s);
  if (e.event?.kind !== 'merchant') return { ok: false, msg: '商人已经走了。' };
  if (item.soldOut) return { ok: false, msg: '这件已经卖完了。' };
  if (s.gold < item.price) return { ok: false, msg: '金币不够。' };
  s.gold -= item.price;
  addItem(s, item.id, 1);
  record(s, item.id);
  const once = MERCHANT_STOCK.find((m) => m.id === item.key)?.once;
  if (once) e.event.sold.push(item.key);
  if (item.id === 'treasureMap') readMap(s, rand);
  return { ok: true, msg: `买下了${ITEMS[item.id].name}。` };
}

/** 能拿来救旅人的东西：药水和能回血的料理、作物 */
export function travelerCures(s: SaveData): ItemId[] {
  return ITEM_IDS.filter((id) => {
    const d = ITEMS[id] as { kind: string; heal?: number };
    return count(s, id) > 0 && (d.heal ?? 0) >= 20 && ['consumable', 'dish', 'crop'].includes(d.kind);
  });
}

export function helpTraveler(s: SaveData, give: ItemId, rand: Rand = Math.random): Loot | null {
  const e = explore(s);
  if (e.event?.kind !== 'traveler' || e.event.stage >= 2) return null;
  if (!travelerCures(s).includes(give) || !removeItem(s, give, 1)) return null;
  e.event.stage = 2;
  const loot = emptyLoot();
  loot.gold = ri(rand, TRAVELER_GOLD[0], TRAVELER_GOLD[1]);
  addTo(loot, pickOf(rand, TRAVELER_GIFTS), 1);
  if (rand() < TRAVELER_MAP_CHANCE) addTo(loot, 'treasureMap', 1);
  grant(s, loot);
  if (loot.items.treasureMap) readMap(s, rand);
  return loot;
}

/** 精英营地打完了 */
export function clearCamp(s: SaveData): void {
  const e = explore(s);
  if (e.event?.kind !== 'camp' || e.event.stage !== 0) return;
  e.event.stage = 1;
  e.camps++;
}

/** 打开营地的宝箱：金币和宝物，再加上按矿脉宝箱算的那一份 */
export function openCampChest(s: SaveData, chest: Loot, rand: Rand = Math.random): Loot | null {
  const e = explore(s);
  if (e.event?.kind !== 'camp' || e.event.stage !== 1) return null;
  e.event.stage = 2;
  const loot: Loot = { gold: chest.gold, items: { ...chest.items }, blueprint: chest.blueprint };
  addTo(loot, pickOf(rand, ['amber', 'fossil', 'starShard'] as ItemId[]), 1);
  grant(s, loot);
  if (loot.blueprint && !s.weaponTypes.includes(loot.blueprint)) s.weaponTypes.push(loot.blueprint);
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
        ...HIDDEN_IDS.map((id) => ({ name: HIDDEN_CHESTS[id].name, got: e.opened.includes(id) })),
      ];
    case 'monster':
      return [
        ...(Object.keys(MONSTERS) as MonsterId[]).map((id) => ({ name: MONSTERS[id].name, got: (s.kills[id] ?? 0) > 0, note: s.kills[id] ? `${s.kills[id]} 只` : undefined })),
        ...(Object.keys(BOSSES) as (keyof typeof BOSSES)[]).map((id) => ({ name: BOSSES[id].name, got: s.bosses.includes(id) })),
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

export function claimBook(s: SaveData, page: BookPage, tier: Tier, rand: Rand = Math.random): Loot | null {
  if (!canClaim(s, page, tier)) return null;
  explore(s).claimed.push(`${page}:${tier}`);
  const r = BOOK_REWARDS[page][tier];
  const loot: Loot = { gold: r.gold, items: { ...r.items }, blueprint: null };
  grant(s, loot);
  if (loot.items.treasureMap) readMap(s, rand);
  return loot;
}
