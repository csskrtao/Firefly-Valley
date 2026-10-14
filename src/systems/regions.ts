import type { SaveData } from '../state/save';
import type { RegionId } from '../world/regions/defs';
import { REGIONS } from '../world/regions/defs';

/** 去过的区域（过滤掉存档里不认识的 id），萤石镇总是算去过 */
export function visitedRegions(s: SaveData): RegionId[] {
  const list = (s.regions ?? []).filter((id) => id in REGIONS);
  return list.includes('town') ? list : ['town', ...list];
}

export const hasVisited = (s: SaveData, id: RegionId): boolean => visitedRegions(s).includes(id);

/** 记下来过这个区域，第一次来返回 true */
export function markVisited(s: SaveData, id: RegionId): boolean {
  const list = visitedRegions(s);
  if (list.includes(id)) {
    s.regions = list;
    return false;
  }
  s.regions = [...list, id];
  return true;
}

/** 区域开放了没有，没开放时返回提示 */
export function lockReason(s: SaveData, id: RegionId): string | null {
  const u = REGIONS[id].unlock;
  if (!u) return null;
  if (u.level && s.level < u.level) return u.hint;
  if (u.boss && !s.bosses.includes(u.boss)) return u.hint;
  return null;
}

export const isUnlocked = (s: SaveData, id: RegionId): boolean => lockReason(s, id) === null;

/** 快速旅行：只能去去过而且开放着的区域，不能原地传送 */
export function canFastTravel(s: SaveData, from: RegionId | null, to: RegionId): { ok: boolean; msg: string } {
  if (from === to) return { ok: false, msg: '你已经在这里了' };
  if (!hasVisited(s, to)) return { ok: false, msg: '还没去过的地方没法快速旅行，先走过去吧' };
  const lock = lockReason(s, to);
  if (lock) return { ok: false, msg: lock };
  return { ok: true, msg: '' };
}

/** 快速旅行花掉的游戏时间（分钟） */
export const TRAVEL_MINUTES = 30;

/** 今天这个区域的 Boss 还在不在 */
export function regionBossAround(s: SaveData, id: RegionId): boolean {
  return !!REGIONS[id].boss && s.regionBosses?.[id] !== s.day;
}

/** 记下今天打倒了这个区域的 Boss，第一次打倒返回 true */
export function recordRegionBoss(s: SaveData, id: RegionId): boolean {
  const first = s.regionBosses?.[id] === undefined;
  s.regionBosses = { ...s.regionBosses, [id]: s.day };
  return first;
}

/** 采集物在存档里的键：小镇是 "x,y"，野外区域前面加上 "区域id:" */
export const foragePrefix = (id: RegionId): string => (id === 'town' ? '' : `${id}:`);
export const forageKey = (id: RegionId, x: number, y: number): string => `${foragePrefix(id)}${x},${y}`;
