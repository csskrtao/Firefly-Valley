import type { ClassId } from '../data/classes';
import type { Cost } from '../data/equipment';
import { FORGE_ARMOR, FORGE_WEAPON, MAX_PLUS } from '../data/equipment';
import type { Affix, DropSource, EquipSlot, Gear, GearSlot, NewGear } from '../data/gear';
import {
  ACC_DROPS, AFFIXES, EQUIP_SLOTS, ESSENCE, MAX_GEAR_TIER, QUALITIES, QUALITY_WEIGHTS, SLOT_WEIGHTS, TIER_NEEDS,
  gearEnhanceCost, gearName, qualityUpgradeCost, slotsFor,
} from '../data/gear';
import type { AccStat, ItemId } from '../data/items';
import { ITEMS, ITEM_IDS } from '../data/items';
import type { WeaponTypeId } from '../data/weapons';
import type { SaveData } from '../state/save';
import { STACK, addItem, bagGear, bagUsed, count, giveGear, stacksOf, takesSpace } from '../state/save';
import { canAfford, pay, successRate } from './forge';

type Rand = () => number;

const pickWeighted = <T>(entries: [T, number][], rand: Rand): T => {
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r < 0) return v;
  }
  return entries[entries.length - 1][0];
};

/* ---------- 生成 ---------- */

/** 给一件装备补随机词条，同一件不会出现重复的属性 */
export function rollAffix(slot: GearSlot, tier: number, have: Affix[], rand: Rand): Affix | null {
  const pool = (Object.keys(AFFIXES) as AccStat[]).filter((k) => AFFIXES[k].slots.includes(slot) && !have.some((a) => a.k === k));
  if (!pool.length) return null;
  const k = pool[Math.floor(rand() * pool.length)];
  const d = AFFIXES[k];
  const raw = d.min + (d.max - d.min) * rand() + d.perTier * tier;
  return { k, v: d.int ? Math.max(1, Math.round(raw)) : Math.round(raw * 1000) / 1000 };
}

export interface DropOptions {
  cls: ClassId;
  /** 武器只会出这些类型（拿到图纸的） */
  types: WeaponTypeId[];
  /** 区域对应的装备阶级 */
  tier: number;
  source: DropSource;
  /** 运气：有几率多抽一次品质，取好的那个 */
  luck?: number;
}

/** 随机生成一件装备：先抽部位，再抽品质，品质决定词条数 */
export function rollGear(o: DropOptions, rand: Rand = Math.random): NewGear {
  const slot = pickWeighted(Object.entries(SLOT_WEIGHTS) as [GearSlot, number][], rand);
  const qRoll = () => pickWeighted(QUALITY_WEIGHTS[o.source].map((w, i) => [i, w] as [number, number]), rand);
  let q = qRoll();
  if (o.luck && rand() < o.luck * 0.15) q = Math.max(q, qRoll());
  // 偶尔会掉比这一带好一阶的
  const tier = Math.min(MAX_GEAR_TIER, Math.max(0, o.tier + (rand() < 0.08 ? 1 : 0)));
  const g: NewGear = { slot, tier, q, plus: 0, affixes: [] };
  if (slot === 'weapon') g.wt = o.types[Math.floor(rand() * o.types.length)];
  if (slot === 'acc') {
    const pool = ACC_DROPS.filter((a) => a.from <= tier);
    g.acc = pool[Math.floor(rand() * pool.length)].id;
    g.tier = 0;
  }
  for (let i = 0; i < QUALITIES[q].affixes; i++) {
    const a = rollAffix(slot, g.tier, g.affixes, rand);
    if (a) g.affixes.push(a);
  }
  return g;
}

/** Boss 必掉稀有以上；首次击败多给一件 */
export function bossDrops(o: Omit<DropOptions, 'source'>, first: boolean, rand: Rand = Math.random): NewGear[] {
  const out = [rollGear({ ...o, source: 'boss' }, rand)];
  if (first) out.push(rollGear({ ...o, source: 'chest' }, rand));
  return out;
}

/* ---------- 查找和穿戴 ---------- */

export const gearById = (s: SaveData, id: number): Gear | undefined => s.gear.find((g) => g.id === id);
export const equipped = (s: SaveData, slot: EquipSlot): Gear | undefined => (s.equip[slot] ? gearById(s, s.equip[slot]) : undefined);
export const allEquipped = (s: SaveData): Gear[] => EQUIP_SLOTS.map((k) => equipped(s, k)).filter((g): g is Gear => !!g);
export const equippedSlot = (s: SaveData, id: number): EquipSlot | null => EQUIP_SLOTS.find((k) => s.equip[k] === id) ?? null;
export const inStash = (s: SaveData, id: number): boolean => s.stash.gear.includes(id);

/** 手上的武器（存档保证总有一把） */
export const weaponOf = (s: SaveData): Gear => equipped(s, 'weapon')!;

/** 能不能穿：武器要是自己职业的 */
export function canWear(s: SaveData, g: Gear): boolean {
  return g.slot !== 'weapon' || (!!g.wt && s.weaponTypes.includes(g.wt));
}

/** 穿上背包里的一件装备。饰品先填空着的格子，满了换掉第一格。换下来的放回背包。 */
export function equip(s: SaveData, id: number, to?: EquipSlot): boolean {
  const g = gearById(s, id);
  if (!g || inStash(s, id) || equippedSlot(s, id) || !canWear(s, g)) return false;
  const slots = slotsFor(g.slot);
  const slot = to && slots.includes(to) ? to : (slots.find((k) => !s.equip[k]) ?? slots[0]);
  s.equip[slot] = id;
  if (g.slot === 'weapon') s.weaponType = g.wt!;
  return true;
}

/** 卸下：武器不能空手，背包满了也卸不下来 */
export function unequip(s: SaveData, slot: EquipSlot): 'ok' | 'weapon' | 'full' | 'empty' {
  if (!s.equip[slot]) return 'empty';
  if (slot === 'weapon') return 'weapon';
  if (bagUsed(s) >= s.bagSize) return 'full';
  s.equip[slot] = 0;
  return 'ok';
}

/** 从存档里彻底拿掉一件装备 */
function dropGear(s: SaveData, id: number): void {
  s.gear = s.gear.filter((g) => g.id !== id);
  s.stash.gear = s.stash.gear.filter((x) => x !== id);
  for (const k of EQUIP_SLOTS) if (s.equip[k] === id) s.equip[k] = 0;
}

/* ---------- 分解 ---------- */

export const salvageValue = (g: Gear): number => QUALITIES[g.q].salvage + g.tier + g.plus;

/** 分解背包里的一件装备，得到萤尘。身上的不能分解。 */
export function salvage(s: SaveData, id: number): number {
  const g = gearById(s, id);
  if (!g || equippedSlot(s, id) || inStash(s, id)) return 0;
  const n = salvageValue(g);
  dropGear(s, id);
  addItem(s, ESSENCE, n);
  return n;
}

/** 一键分解背包里某个品质及以下、没有强化过的装备 */
export function salvageUpTo(s: SaveData, maxQ: number): { count: number; essence: number } {
  const list = bagGear(s).filter((g) => g.q <= maxQ && g.plus === 0);
  let essence = 0;
  for (const g of list) essence += salvage(s, g.id);
  return { count: list.length, essence };
}

/* ---------- 铁匠 ---------- */

export type EnhanceResult = 'success' | 'fail' | 'max' | 'cost';

/** 强化 +1：失败只扣材料，不会掉级 */
export function enhanceGear(s: SaveData, id: number, bonus = 0, roll = Math.random()): EnhanceResult {
  const g = gearById(s, id);
  if (!g || g.plus >= MAX_PLUS) return 'max';
  const cost = gearEnhanceCost(g);
  if (!canAfford(s, cost)) return 'cost';
  pay(s, cost);
  if (roll < successRate(g.plus, bonus)) {
    g.plus++;
    return 'success';
  }
  return 'fail';
}

/** 提升一档品质：基础属性跟着变高，并多一条随机词条 */
export function upgradeQuality(s: SaveData, id: number, rand: Rand = Math.random): 'ok' | 'max' | 'cost' {
  const g = gearById(s, id);
  const cost = g && qualityUpgradeCost(g);
  if (!g || !cost) return 'max';
  if (!canAfford(s, cost)) return 'cost';
  pay(s, cost);
  g.q++;
  while (g.affixes.length < QUALITIES[g.q].affixes) {
    const a = rollAffix(g.slot, g.tier, g.affixes, rand);
    if (!a) break;
    g.affixes.push(a);
  }
  return 'ok';
}

/** 升阶的花费；饰品不能升阶，到顶了返回 null */
export function tierUpCost(g: Gear): Cost | null {
  if (g.slot === 'acc' || g.tier >= MAX_GEAR_TIER) return null;
  return (g.slot === 'weapon' ? FORGE_WEAPON : FORGE_ARMOR)[g.tier + 1];
}

/** 升阶还缺的 Boss 战利品 */
export const tierUpNeed = (s: SaveData, g: Gear): ItemId | null => {
  const need = TIER_NEEDS[g.tier + 1];
  return need && count(s, need) <= 0 ? need : null;
};

/** 升阶：换成更好的材料，品质、强化和词条都保留 */
export function tierUp(s: SaveData, id: number, discount = 0): 'ok' | 'max' | 'cost' | 'need' {
  const g = gearById(s, id);
  const cost = g && tierUpCost(g);
  if (!g || !cost) return 'max';
  if (tierUpNeed(s, g)) return 'need';
  if (!canAfford(s, cost, discount)) return 'cost';
  pay(s, cost, discount);
  g.tier++;
  return 'ok';
}

/** 新的武器类型（图纸）：送一把和手上武器同阶的普通武器 */
export function unlockWeaponType(s: SaveData, wt: WeaponTypeId): Gear | null {
  if (s.weaponTypes.includes(wt)) return null;
  s.weaponTypes.push(wt);
  return giveGear(s, { slot: 'weapon', wt, tier: weaponOf(s).tier, q: 0, plus: 0, affixes: [] });
}

/* ---------- 背包和仓库箱 ---------- */

export type BagCell = { kind: 'gear'; g: Gear } | { kind: 'item'; id: ItemId; n: number };

const KIND_ORDER = ['consumable', 'dish', 'crop', 'forage', 'seed', 'ore', 'material', 'build', 'key'];

/** 背包格子：装备一件一格，物品每 99 个一格，重要物品排在最后、不占格子 */
export function bagCells(s: SaveData): BagCell[] {
  return [...bagGear(s).map((g): BagCell => ({ kind: 'gear', g })), ...itemCells(s.inv)];
}

export function itemCells(inv: Partial<Record<ItemId, number>>): BagCell[] {
  const out: BagCell[] = [];
  const keys: BagCell[] = [];
  for (const [id, n] of Object.entries(inv) as [ItemId, number][]) {
    if (!(id in ITEMS) || n <= 0) continue;
    if (!takesSpace(id)) keys.push({ kind: 'item', id, n });
    else for (let left = n; left > 0; left -= STACK) out.push({ kind: 'item', id, n: Math.min(STACK, left) });
  }
  return [...out, ...keys];
}

/** 一键整理：装备按部位、品质、阶级排，物品按种类和图鉴顺序排 */
export function sortBag(s: SaveData): void {
  const slotOrder: GearSlot[] = ['weapon', 'head', 'body', 'feet', 'acc'];
  s.gear.sort((a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot) || b.q - a.q || b.tier - a.tier || b.plus - a.plus || a.id - b.id);
  const inv: Partial<Record<ItemId, number>> = {};
  const ids = (Object.keys(s.inv) as ItemId[]).filter((id) => id in ITEMS);
  ids.sort((a, b) => KIND_ORDER.indexOf(ITEMS[a].kind) - KIND_ORDER.indexOf(ITEMS[b].kind) || ITEM_IDS.indexOf(a) - ITEM_IDS.indexOf(b));
  for (const id of ids) inv[id] = s.inv[id];
  s.inv = inv;
}

/** 背包扩容：每次 +6 格，最多 48 格 */
export const BAG_MAX = 48;
const EXPAND_COST = [400, 1200, 3000, 6000];
export function expandCost(s: SaveData): number | null {
  const step = Math.round((s.bagSize - 24) / 6);
  return s.bagSize >= BAG_MAX ? null : (EXPAND_COST[step] ?? EXPAND_COST[EXPAND_COST.length - 1]);
}
export function expandBag(s: SaveData): boolean {
  const cost = expandCost(s);
  if (cost === null || s.gold < cost) return false;
  s.gold -= cost;
  s.bagSize = Math.min(BAG_MAX, s.bagSize + 6);
  return true;
}

export function stashUsed(s: SaveData): number {
  let n = s.stash.gear.length;
  for (const c of Object.values(s.stash.items)) if (c && c > 0) n += stacksOf(c);
  return n;
}

const stashRoom = (s: SaveData, id: ItemId): number => {
  const have = s.stash.items[id] ?? 0;
  return Math.max(0, s.stash.size - stashUsed(s)) * STACK + (stacksOf(have) * STACK - have);
};

/** 背包里的一样东西存进仓库箱，返回存了几个 */
export function storeItem(s: SaveData, id: ItemId, n = count(s, id)): number {
  const k = Math.min(n, count(s, id), stashRoom(s, id));
  if (k <= 0) return 0;
  s.inv[id] = count(s, id) - k;
  if (!s.inv[id]) delete s.inv[id];
  s.stash.items[id] = (s.stash.items[id] ?? 0) + k;
  return k;
}

/** 从仓库箱拿回背包，返回拿了几个 */
export function takeItem(s: SaveData, id: ItemId, n = s.stash.items[id] ?? 0): number {
  const have = s.stash.items[id] ?? 0;
  const free = Math.max(0, s.bagSize - bagUsed(s)) * STACK + (stacksOf(count(s, id)) * STACK - count(s, id));
  const k = Math.min(n, have, takesSpace(id) ? free : have);
  if (k <= 0) return 0;
  s.stash.items[id] = have - k;
  if (!s.stash.items[id]) delete s.stash.items[id];
  s.inv[id] = count(s, id) + k;
  return k;
}

export function storeGear(s: SaveData, id: number): boolean {
  if (!gearById(s, id) || equippedSlot(s, id) || inStash(s, id) || stashUsed(s) >= s.stash.size) return false;
  s.stash.gear.push(id);
  return true;
}

export function takeGear(s: SaveData, id: number): boolean {
  if (!inStash(s, id) || bagUsed(s) >= s.bagSize) return false;
  s.stash.gear = s.stash.gear.filter((x) => x !== id);
  return true;
}

/** 一键存入：矿石、怪物素材、种子和作物这些不太需要随身带的（萤尘要拿去铁匠铺，留着） */
export function storeMaterials(s: SaveData): number {
  let n = 0;
  for (const id of Object.keys(s.inv) as ItemId[]) {
    if (['ore', 'material', 'crop', 'forage', 'seed'].includes(ITEMS[id].kind) && id !== s.seed && id !== ESSENCE) n += storeItem(s, id);
  }
  return n;
}

export const stashCells = (s: SaveData): BagCell[] => [
  ...s.stash.gear.map((id) => gearById(s, id)).filter((g): g is Gear => !!g).map((g): BagCell => ({ kind: 'gear', g })),
  ...itemCells(s.stash.items),
];

/** 装备的完整名字，比如“稀有 铁剑 +3” */
export const gearLabel = (g: Gear): string => `${QUALITIES[g.q].name} ${gearName(g)}${g.plus ? ` +${g.plus}` : ''}`;
