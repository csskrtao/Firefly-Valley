import { DAY_START, SEASON_DAYS } from '../core/constants';
import type { ClassId } from '../data/classes';
import { CLASSES } from '../data/classes';
import type { CropId } from '../data/crops';
import type { BuffStat, ItemId } from '../data/items';
import { ITEMS } from '../data/items';
import type { HomeState } from '../data/buildings';
import { newHome } from '../data/buildings';
import type { BossId, MonsterId } from '../data/monsters';
import type { NpcId } from '../data/npcs';
import { NPC_IDS } from '../data/npcs';
import type { WeaponTypeId } from '../data/weapons';
import { WEAPON_TYPES, defaultType } from '../data/weapons';

export const SAVE_VERSION = 3;

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
  weapon: { tier: number; plus: number };
  armor: { tier: number; plus: number };
  /** 当前使用的武器类型，和已经拿到图纸的武器类型 */
  weaponType: WeaponTypeId;
  weaponTypes: WeaponTypeId[];
  /** 戴着的饰品，最多两件（戴上后从背包里移出） */
  accessories: ItemId[];
  level: number;
  xp: number;
  /** 地上的采集物，键为 "x,y" */
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
  tip: number;
  /** 家园：房子等级、农场上的设施和装饰、温室、鸡舍 */
  home: HomeState;
  playTime: number;
  savedAt: number;
}

export function newSave(slot: number, cls: ClassId): SaveData {
  const npcs = {} as Record<NpcId, NpcState>;
  for (const id of NPC_IDS) npcs[id] = { pts: 0, talkDay: 0, giftDay: 0, seenHearts: 0 };
  return {
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
    weapon: { tier: 0, plus: 0 },
    armor: { tier: 0, plus: 0 },
    weaponType: defaultType(cls),
    weaponTypes: [defaultType(cls)],
    accessories: [],
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
    tip: 0,
    home: newHome(),
    playTime: 0,
    savedAt: Date.now(),
  };
}

/** 第 2 版的田在 (4,12)–(15,19)，第 3 版地图扩大后整块挪到了 (5,13) 开始的位置 */
const V2_FIELD_SHIFT: [number, number] = [1, 1];

/** 读档时补全旧版本缺失的字段，无法识别则返回 null。 */
export function migrate(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<SaveData>;
  if (!r.cls || !(r.cls in CLASSES)) return null;
  const base = newSave(r.slot ?? 0, r.cls);
  const merged: SaveData = { ...base, ...r, version: SAVE_VERSION };
  merged.inv = { ...r.inv };
  merged.weapon = { ...base.weapon, ...r.weapon };
  merged.armor = { ...base.armor, ...r.armor };
  merged.quest = { ...base.quest, ...r.quest };
  merged.npcs = { ...base.npcs };
  for (const id of NPC_IDS) merged.npcs[id] = { ...base.npcs[id], ...(r.npcs?.[id] ?? {}) };
  // 武器类型必须属于这个职业，默认武器总是有的
  const own = (r.weaponTypes ?? []).filter((t) => t in WEAPON_TYPES && WEAPON_TYPES[t].cls === r.cls);
  merged.weaponTypes = [...new Set([defaultType(r.cls), ...own])];
  if (!merged.weaponTypes.includes(merged.weaponType)) merged.weaponType = defaultType(r.cls);
  merged.accessories = (r.accessories ?? []).filter((id) => id in ITEMS && ITEMS[id].kind === 'accessory').slice(0, 2);
  merged.forage = { ...r.forage };
  merged.home = { ...base.home, ...r.home };
  merged.level = Math.max(1, r.level ?? 1);
  if ((r.version ?? 1) < 3 && r.field) {
    merged.field = {};
    for (const [k, f] of Object.entries(r.field)) {
      const [x, y] = k.split(',').map(Number);
      merged.field[`${x + V2_FIELD_SHIFT[0]},${y + V2_FIELD_SHIFT[1]}`] = f;
    }
  }
  return merged;
}

/** 背包里有，或者已经戴在身上 */
export const owns = (s: SaveData, id: ItemId): boolean => (s.inv[id] ?? 0) > 0 || s.accessories.includes(id);

export const seasonOf = (day: number): number => Math.floor((day - 1) / SEASON_DAYS) % 4;
export const dayOfSeason = (day: number): number => ((day - 1) % SEASON_DAYS) + 1;
export const yearOf = (day: number): number => Math.floor((day - 1) / (SEASON_DAYS * 4)) + 1;

export const count = (s: SaveData, id: ItemId): number => s.inv[id] ?? 0;

export function addItem(s: SaveData, id: ItemId, n = 1): void {
  s.inv[id] = count(s, id) + n;
  if ((s.inv[id] ?? 0) <= 0) delete s.inv[id];
}

export function removeItem(s: SaveData, id: ItemId, n = 1): boolean {
  if (count(s, id) < n) return false;
  addItem(s, id, -n);
  return true;
}
