import type { CropId } from '../data/crops';
import { CROPS, cropForSeed } from '../data/crops';
import type { ItemId } from '../data/items';
import type { FieldTile, SaveData, Weather } from '../state/save';
import { addItem, count, removeItem, seasonOf } from '../state/save';

export const fieldKey = (x: number, y: number): string => `${x},${y}`;

export function isRipe(f: FieldTile | undefined): boolean {
  return !!f && !!f.crop && f.days >= CROPS[f.crop].days;
}

export type FarmResult =
  | { ok: true; msg?: string }
  | { ok: false; msg: string };

export function till(s: SaveData, key: string): FarmResult {
  if (s.field[key]) return { ok: false, msg: '这块地已经锄好了' };
  s.field[key] = { watered: s.weather === 'rain', crop: null, days: 0 };
  return { ok: true };
}

export function water(s: SaveData, key: string): FarmResult {
  const f = s.field[key];
  if (!f) return { ok: false, msg: '先用锄头锄地' };
  f.watered = true;
  return { ok: true };
}

export function plant(s: SaveData, key: string, seed: ItemId): FarmResult {
  const f = s.field[key];
  if (!f) return { ok: false, msg: '先用锄头锄地' };
  if (f.crop) return { ok: false, msg: '这里已经种了东西' };
  const crop = cropForSeed(seed);
  if (!crop) return { ok: false, msg: '这不是种子' };
  if (count(s, seed) <= 0) return { ok: false, msg: '种子用完了，去杂货店找薇拉' };
  const def = CROPS[crop];
  if (!def.seasons.includes(seasonOf(s.day))) return { ok: false, msg: `${def.name}不能在这个季节种` };
  removeItem(s, seed);
  f.crop = crop;
  f.days = 0;
  return { ok: true };
}

/** 收获成熟作物，返回得到的作物 id */
export function harvest(s: SaveData, key: string): CropId | null {
  const f = s.field[key];
  if (!f || !f.crop || !isRipe(f)) return null;
  const crop = f.crop;
  const def = CROPS[crop];
  addItem(s, def.item);
  if ('regrow' in def && def.regrow) {
    f.days = def.days - def.regrow;
  } else {
    f.crop = null;
    f.days = 0;
  }
  return crop;
}

export function rollWeather(day: number, roll = Math.random()): Weather {
  if (day === 1) return 'sunny';
  const season = seasonOf(day);
  if (season === 3) return roll < 0.3 ? 'snow' : 'sunny';
  return roll < 0.22 ? 'rain' : 'sunny';
}

/**
 * 睡觉进入新的一天：浇过水的作物生长一天，过季作物枯死，再根据新天气决定是否自动浇水。
 * 返回枯死的作物数量。
 */
export function advanceDay(s: SaveData, weatherRoll = Math.random()): number {
  let withered = 0;
  const prevSeason = seasonOf(s.day);
  for (const f of Object.values(s.field)) {
    if (f.crop && f.watered && !isRipe(f)) f.days++;
    f.watered = false;
  }
  s.day++;
  s.weather = rollWeather(s.day, weatherRoll);
  const season = seasonOf(s.day);
  for (const f of Object.values(s.field)) {
    if (season !== prevSeason && f.crop && !CROPS[f.crop].seasons.includes(season)) {
      f.crop = null;
      f.days = 0;
      withered++;
    }
    if (s.weather === 'rain') f.watered = true;
  }
  return withered;
}
