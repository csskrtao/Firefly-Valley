import { DAY_START, SEASON_DAYS } from '../core/constants';
import type { ClassId } from '../data/classes';
import { CLASSES } from '../data/classes';
import type { CropId } from '../data/crops';
import type { EquipSlot, Gear, NewGear } from '../data/gear';
import { EQUIP_SLOTS, MAX_GEAR_TIER, MAX_QUALITY, slotsFor } from '../data/gear';
import { MAX_PLUS } from '../data/equipment';
import type { BuffStat, ItemId } from '../data/items';
import { ITEMS } from '../data/items';
import type { HomeState } from '../data/buildings';
import { newHome } from '../data/buildings';
import type { BossId, MonsterId } from '../data/monsters';
import type { NpcId } from '../data/npcs';
import { NPC_IDS } from '../data/npcs';
import type { ExploreState } from '../data/treasure';
import { newExplore } from '../data/treasure';
import type { WeaponTypeId } from '../data/weapons';
import { WEAPON_TYPES, defaultType } from '../data/weapons';
import type { RegionId } from '../world/regions/defs';

export const SAVE_VERSION = 4;

/** 背包开局的格子数，以及一格最多叠多少个 */
export const BAG_START = 24;
export const STACK = 99;
export const STASH_START = 48;

/** 家里的仓库箱：和背包分开放东西，size 是格子数 */
export interface Stash {
  items: Partial<Record<ItemId, number>>;
  gear: number[];
  size: number;
}

export interface FieldTile {
  watered: boolean;
  crop: CropId | null;
  /** 已经长了几天 */
  days: number;
}

export interface NpcState {
  pts: number;
  talkDay: number;
  giftDay: number;
  /** 已经看过的心数剧情 */
  seenHearts: number;
}

export type Weather = 'sunny' | 'rain' | 'snow';

/** 吃料理得到的效果，到当天的 until 分钟为止，睡一觉就没了 */
export interface FoodBuff {
  stat: BuffStat;
  value: number;
  until: number;
  from: ItemId;
  /** 不是料理带来的效果（比如家里睡得香）时显示的名字 */
  label?: string;
}

export interface SaveData {
  version: number;
  slot: number;
  cls: ClassId;
  /** 从 1 开始的绝对天数 */
  day: number;
  time: number;
  weather: Weather;
  gold: number;
  hp: number;
  en: number;
  tool: number;
  /** 种子格当前选中的种子 */
  seed: ItemId | null;
  inv: Partial<Record<ItemId, number>>;
  /** 背包格子数 */
  bagSize: number;
  /** 拥有的全部装备（身上、背包、仓库箱里的都在这里） */
  gear: Gear[];
  /** 身上 6 个装备格放的是哪件装备，0 表示空着 */
  equip: Record<EquipSlot, number>;
  /** 下一件装备的编号 */
  gearSeq: number;
  stash: Stash;
  /** 背包满了被送回仓库箱的次数，场景里提示一下就清零 */
  mailed: number;
  /** 手上武器的类型（跟着武器格同步），和已经拿到图纸的武器类型 */
  weaponType: WeaponTypeId;
  weaponTypes: WeaponTypeId[];
  level: number;
  xp: number;
  /** 地上的采集物，小镇的键为 "x,y"，野外区域的键为 "区域id:x,y" */
  forage: Record<string, ItemId>;
  forageDay: number;
  buff: FoodBuff | null;
  field: Record<string, FieldTile>;
  deepest: number;
  bosses: BossId[];
  npcs: Record<NpcId, NpcState>;
  quest: { index: number; active: boolean; progress: number };
  kills: Partial<Record<MonsterId, number>>;
  perks: string[];
  /** 户外探险：挖宝点、藏宝图、隐藏宝箱、随机事件和收集册 */
  explore: ExploreState;
  tip: number;
  /** 家园：房子等级、农场上的设施和装饰、温室、鸡舍 */
  home: HomeState;
  playTime: number;
  savedAt: number;
  /** 去过的地面区域：世界地图上会亮起来，可以快速旅行过去 */
  regions: RegionId[];
  /** 野外区域的 Boss 上一次被打倒是第几天，当天不会再出现；没有记录表示还没打倒过 */
  regionBosses: Partial<Record<RegionId, number>>;
}

export function newSave(slot: number, cls: ClassId): SaveData {
  const npcs = {} as Record<NpcId, NpcState>;
  for (const id of NPC_IDS) npcs[id] = { pts: 0, talkDay: 0, giftDay: 0, seenHearts: 0 };
  const s: SaveData = {
    version: SAVE_VERSION,
    slot,
    cls,
    day: 1,
    time: DAY_START,
    weather: 'sunny',
    gold: 200,
    hp: 100 + CLASSES[cls].hp,
    en: 100,
    tool: 0,
    seed: 'radishSeed',
    inv: { radishSeed: 10, potion: 2 },
    bagSize: BAG_START,
    gear: [],
    equip: { weapon: 0, head: 0, body: 0, feet: 0, acc1: 0, acc2: 0 },
    gearSeq: 1,
    stash: { items: {}, gear: [], size: STASH_START },
    mailed: 0,
    weaponType: defaultType(cls),
    weaponTypes: [defaultType(cls)],
    level: 1,
    xp: 0,
    forage: {},
    forageDay: 0,
    buff: null,
    field: {},
    deepest: 0,
    bosses: [],
    npcs,
    quest: { index: 0, active: false, progress: 0 },
    kills: {},
    perks: [],
    explore: newExplore(),
    tip: 0,
    home: newHome(),
    playTime: 0,
    savedAt: Date.now(),
    regions: ['town'],
    regionBosses: {},
  };
  s.equip.weapon = putGear(s, { slot: 'weapon', wt: defaultType(cls), tier: 0, q: 0, plus: 0, affixes: [] }).id;
  s.equip.body = putGear(s, { slot: 'body', tier: 0, q: 0, plus: 0, affixes: [] }).id;
  return s;
}

/** 第 2 版的田在 (4,12)–(15,19)，第 3 版地图扩大后整块挪到了 (5,13) 开始的位置 */
const V2_FIELD_SHIFT: [number, number] = [1, 1];

/** 读档时补全旧版本缺失的字段，无法识别则返回 null。 */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SaveData> & V3Gear;
  if (!r.cls || !(r.cls in CLASSES)) return null;
  const base = newSave(r.slot ?? 0, r.cls);
  const merged: SaveData = { ...base, ...r, version: SAVE_VERSION };
  delete (merged as V3Gear).weapon;
  delete (merged as V3Gear).armor;
  delete (merged as V3Gear).accessories;
  merged.inv = { ...r.inv };
  merged.quest = { ...base.quest, ...r.quest };
  merged.npcs = { ...base.npcs };
  for (const id of NPC_IDS) merged.npcs[id] = { ...base.npcs[id], ...(r.npcs?.[id] ?? {}) };
  // 武器类型必须属于这个职业，默认武器总是有的
  const own = (r.weaponTypes ?? []).filter((t) => t in WEAPON_TYPES && WEAPON_TYPES[t].cls === r.cls);
  merged.weaponTypes = [...new Set([defaultType(r.cls), ...own])];
  if (!merged.weaponTypes.includes(merged.weaponType)) merged.weaponType = defaultType(r.cls);
  merged.forage = { ...r.forage };
  merged.home = { ...base.home, ...r.home };
  merged.explore = { ...base.explore, ...r.explore };
  merged.level = Math.max(1, r.level ?? 1);
  if ((r.version ?? 1) < 3 && r.field) {
    merged.field = {};
    for (const [k, f] of Object.entries(r.field)) {
      const [x, y] = k.split(',').map(Number);
      merged.field[`${x + V2_FIELD_SHIFT[0]},${y + V2_FIELD_SHIFT[1]}`] = f;
    }
  }
  merged.bagSize = Math.max(BAG_START, r.bagSize ?? BAG_START);
  merged.stash = { ...base.stash, ...r.stash };
  merged.stash.items = { ...r.stash?.items };
  merged.mailed = 0;
  if ((r.version ?? 1) < 4 || !Array.isArray(r.gear)) migrateV3Gear(merged, r);
  else fixGear(merged, r);
  return merged;
}

/** 第 3 版以前的装备：一把按阶级升级的武器（所有武器类型共用）、一件护甲、戴着的饰品 */
interface V3Gear {
  weapon?: { tier?: number; plus?: number };
  armor?: { tier?: number; plus?: number };
  accessories?: ItemId[];
}

const clampInt = (v: unknown, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

/** 老存档换成新装备：每种拿到的武器类型各给一把同阶同强化的普通武器，护甲换成同阶的衣服，饰品都变成普通品质 */
function migrateV3Gear(s: SaveData, r: V3Gear): void {
  s.gear = [];
  s.gearSeq = 1;
  s.stash.gear = [];
  s.equip = { weapon: 0, head: 0, body: 0, feet: 0, acc1: 0, acc2: 0 };
  const wTier = clampInt(r.weapon?.tier, 0, MAX_GEAR_TIER);
  const wPlus = clampInt(r.weapon?.plus, 0, MAX_PLUS);
  for (const wt of s.weaponTypes) {
    const g = putGear(s, { slot: 'weapon', wt, tier: wTier, q: 0, plus: wPlus, affixes: [] });
    if (wt === s.weaponType) s.equip.weapon = g.id;
  }
  s.equip.body = putGear(s, { slot: 'body', tier: clampInt(r.armor?.tier, 0, MAX_GEAR_TIER), q: 0, plus: clampInt(r.armor?.plus, 0, MAX_PLUS), affixes: [] }).id;
  const worn = (r.accessories ?? []).filter((id) => id in ITEMS && ITEMS[id].kind === 'accessory').slice(0, 2);
  worn.forEach((id, i) => (s.equip[i ? 'acc2' : 'acc1'] = putGear(s, accGear(id)).id));
  // 背包里的饰品也换成装备
  for (const id of Object.keys(s.inv) as ItemId[]) {
    if (!(id in ITEMS)) {
      delete s.inv[id];
      continue;
    }
    if (ITEMS[id].kind !== 'accessory') continue;
    const n = s.inv[id] ?? 0;
    delete s.inv[id];
    for (let i = 0; i < n; i++) putGear(s, accGear(id));
  }
}

/** 第 4 版存档：去掉坏掉的装备和对不上的装备格 */
function fixGear(s: SaveData, r: Partial<SaveData>): void {
  const valid = (g: Gear): boolean =>
    !!g && typeof g.id === 'number' && ['weapon', 'head', 'body', 'feet', 'acc'].includes(g.slot) &&
    (g.slot !== 'weapon' || (!!g.wt && g.wt in WEAPON_TYPES && WEAPON_TYPES[g.wt].cls === s.cls)) &&
    (g.slot !== 'acc' || (!!g.acc && g.acc in ITEMS && ITEMS[g.acc].kind === 'accessory'));
  s.gear = (r.gear ?? []).filter(valid).map((g) => ({
    ...g,
    tier: g.slot === 'acc' ? 0 : clampInt(g.tier, 0, MAX_GEAR_TIER),
    q: clampInt(g.q, 0, MAX_QUALITY),
    plus: clampInt(g.plus, 0, MAX_PLUS),
    affixes: Array.isArray(g.affixes) ? g.affixes.map((a) => ({ ...a })) : [],
  }));
  const ids = new Set(s.gear.map((g) => g.id));
  s.gearSeq = Math.max(r.gearSeq ?? 1, ...s.gear.map((g) => g.id + 1));
  s.equip = { weapon: 0, head: 0, body: 0, feet: 0, acc1: 0, acc2: 0 };
  const used = new Set<number>();
  for (const slot of EQUIP_SLOTS) {
    const id = r.equip?.[slot] ?? 0;
    const g = s.gear.find((x) => x.id === id);
    if (g && !used.has(id) && slotsFor(g.slot).includes(slot)) {
      s.equip[slot] = id;
      used.add(id);
    }
  }
  s.stash.gear = [...new Set((r.stash?.gear ?? []).filter((id) => ids.has(id) && !used.has(id)))];
  // 手上总得有一把武器
  if (!s.equip.weapon) {
    const w = s.gear.find((g) => g.slot === 'weapon' && !s.stash.gear.includes(g.id)) ?? putGear(s, { slot: 'weapon', wt: defaultType(s.cls), tier: 0, q: 0, plus: 0, affixes: [] });
    s.equip.weapon = w.id;
  }
  s.weaponType = s.gear.find((g) => g.id === s.equip.weapon)!.wt!;
}

const accGear = (id: ItemId): NewGear => ({ slot: 'acc', acc: id, tier: 0, q: 0, plus: 0, affixes: [] });

/** 给装备编号并放进存档（不管背包满没满），返回放进去的那件 */
export function putGear(s: SaveData, g: NewGear): Gear {
  const full: Gear = { ...g, id: s.gearSeq++ };
  s.gear.push(full);
  return full;
}

/** 背包里有，或者已经有这件饰品（身上、背包、仓库箱里都算） */
export const owns = (s: SaveData, id: ItemId): boolean =>
  (s.inv[id] ?? 0) > 0 || (s.stash.items[id] ?? 0) > 0 || s.gear.some((g) => g.acc === id);

export const seasonOf = (day: number): number => Math.floor((day - 1) / SEASON_DAYS) % 4;
export const dayOfSeason = (day: number): number => ((day - 1) % SEASON_DAYS) + 1;
export const yearOf = (day: number): number => Math.floor((day - 1) / (SEASON_DAYS * 4)) + 1;

export const count = (s: SaveData, id: ItemId): number => s.inv[id] ?? 0;

/* ---------- 背包格子 ---------- */

/** 重要物品不占格子 */
export const takesSpace = (id: ItemId): boolean => ITEMS[id].kind !== 'key';
export const stacksOf = (n: number): number => Math.ceil(n / STACK);

const isEquipped = (s: SaveData, id: number): boolean => EQUIP_SLOTS.some((k) => s.equip[k] === id);

/** 背包里（不在身上、不在仓库箱）的装备 */
export const bagGear = (s: SaveData): Gear[] => s.gear.filter((g) => !isEquipped(s, g.id) && !s.stash.gear.includes(g.id));

/** 背包已经用了几格：每件装备一格，物品每 99 个一格 */
export function bagUsed(s: SaveData): number {
  let n = bagGear(s).length;
  for (const [id, c] of Object.entries(s.inv) as [ItemId, number][]) if (c > 0 && takesSpace(id)) n += stacksOf(c);
  return n;
}

/** 这件物品还能往背包里放几个 */
export function roomFor(s: SaveData, id: ItemId): number {
  if (!takesSpace(id)) return Infinity;
  const have = count(s, id);
  const free = Math.max(0, s.bagSize - bagUsed(s));
  return free * STACK + (stacksOf(have) * STACK - have);
}

/**
 * 放进背包。饰品会变成一件普通品质的装备。
 * 背包放不下的部分送回家里的仓库箱，不会弄丢东西，场景会提示一下。
 */
export function addItem(s: SaveData, id: ItemId, n = 1): void {
  if (n > 0 && ITEMS[id].kind === 'accessory') {
    for (let i = 0; i < n; i++) giveGear(s, accGear(id));
    return;
  }
  if (n > 0) {
    const fit = Math.min(n, roomFor(s, id));
    if (fit < n) {
      s.stash.items[id] = (s.stash.items[id] ?? 0) + (n - fit);
      s.mailed++;
    }
    n = fit;
  }
  s.inv[id] = count(s, id) + n;
  if ((s.inv[id] ?? 0) <= 0) delete s.inv[id];
}

/** 拿到一件装备：背包满了就送回仓库箱 */
export function giveGear(s: SaveData, g: NewGear): Gear {
  const full = putGear(s, g);
  if (bagUsed(s) > s.bagSize) {
    s.stash.gear.push(full.id);
    s.mailed++;
  }
  return full;
}

export function removeItem(s: SaveData, id: ItemId, n = 1): boolean {
  if (count(s, id) < n) return false;
  s.inv[id] = count(s, id) - n;
  if ((s.inv[id] ?? 0) <= 0) delete s.inv[id];
  return true;
}
