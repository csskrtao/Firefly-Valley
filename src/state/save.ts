import { DAY_START, SEASON_DAYS } from '../core/constants';
import type { ClassId } from '../data/classes';
import { CLASSES } from '../data/classes';
import type { CropId } from '../data/crops';
import type { ItemId } from '../data/items';
import type { BossId, MonsterId } from '../data/monsters';
import type { NpcId } from '../data/npcs';
import { NPC_IDS } from '../data/npcs';

export const SAVE_VERSION = 2;

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
  field: Record<string, FieldTile>;
  deepest: number;
  bosses: BossId[];
  npcs: Record<NpcId, NpcState>;
  quest: { index: number; active: boolean; progress: number };
  kills: Partial<Record<MonsterId, number>>;
  perks: string[];
  tip: number;
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
    field: {},
    deepest: 0,
    bosses: [],
    npcs,
    quest: { index: 0, active: false, progress: 0 },
    kills: {},
    perks: [],
    tip: 0,
    playTime: 0,
    savedAt: Date.now(),
  };
}

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
  return merged;
}

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
