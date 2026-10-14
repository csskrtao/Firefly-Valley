import type { ForageArea, ItemId } from '../data/items';
import { ITEMS, ITEM_IDS } from '../data/items';
import type { SaveData } from '../state/save';
import { addItem, seasonOf } from '../state/save';

/** 每个区域地上最多同时有几个采集物，每天新长出几个 */
export const FORAGE_CAP: Record<ForageArea, number> = { forest: 12, meadow: 8, beach: 4 };
const DAILY: Record<ForageArea, number> = { forest: 5, meadow: 3, beach: 2 };
const AREAS: ForageArea[] = ['forest', 'meadow', 'beach'];

/** 这个季节在这个区域能捡到的东西 */
export function forageFor(area: ForageArea, season: number): ItemId[] {
  return ITEM_IDS.filter((id) => {
    const d = ITEMS[id] as { kind: string; seasons?: number[]; areas?: ForageArea[] };
    return d.kind === 'forage' && !!d.seasons?.includes(season) && !!d.areas?.includes(area);
  });
}

/**
 * 新的一天长出新的采集物：先清掉过季的，再在空着的候选格子上补到上限。
 * spots 是地图给出的候选格子，rand 可以传固定种子方便测试。
 * prefix 加在键前面，用来区分不同区域（小镇是空串，野外区域是 "区域id:"）。
 */
export function spawnForage(s: SaveData, spots: Record<ForageArea, [number, number][]>, rand: () => number = Math.random, prefix = ''): number {
  const season = seasonOf(s.day);
  for (const [k, id] of Object.entries(s.forage)) {
    const seasons = (ITEMS[id] as { seasons?: number[] }).seasons;
    if (!seasons?.includes(season)) delete s.forage[k];
  }
  let added = 0;
  for (const area of AREAS) {
    const pool = forageFor(area, season);
    const cells = spots[area];
    if (!pool.length || !cells.length) continue;
    const keys = new Set(cells.map(([x, y]) => `${prefix}${x},${y}`));
    let have = Object.keys(s.forage).filter((k) => keys.has(k)).length;
    for (let i = 0; i < DAILY[area] && have < FORAGE_CAP[area]; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const [x, y] = cells[Math.floor(rand() * cells.length)];
        const k = `${prefix}${x},${y}`;
        if (s.forage[k]) continue;
        s.forage[k] = pool[Math.floor(rand() * pool.length)];
        have++;
        added++;
        break;
      }
    }
  }
  s.forageDay = s.day;
  return added;
}

/** 捡起一个采集物，lucky 为真时多捡一个。返回捡到的物品和数量 */
export function pickForage(s: SaveData, key: string, lucky = false): { id: ItemId; n: number } | null {
  const id = s.forage[key];
  if (!id) return null;
  delete s.forage[key];
  const n = lucky ? 2 : 1;
  addItem(s, id, n);
  return { id, n };
}
