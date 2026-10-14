import type { ItemId } from '../data/items';
import { itemDef } from '../data/items';
import type { Recipe } from '../data/recipes';
import type { SaveData } from '../state/save';
import { addItem, count, removeItem } from '../state/save';

/** 厨房够不够格：石屋、大宅才能做的菜 */
export const kitchenOk = (s: SaveData, r: Recipe): boolean => (r.kitchen ?? 0) <= s.home.house;

export function canCook(s: SaveData, r: Recipe): boolean {
  return kitchenOk(s, r) && (Object.entries(r.needs) as [ItemId, number][]).every(([id, n]) => count(s, id) >= n);
}

export function cook(s: SaveData, r: Recipe): boolean {
  if (!canCook(s, r)) return false;
  for (const [id, n] of Object.entries(r.needs) as [ItemId, number][]) removeItem(s, id, n);
  addItem(s, r.dish, 1);
  return true;
}

/** 吃下料理：换上它的效果（同一时间只有一种料理效果） */
export function applyDishBuff(s: SaveData, id: ItemId): boolean {
  const buff = itemDef(id).buff;
  if (!buff) return false;
  s.buff = { stat: buff.stat, value: buff.value, until: s.time + buff.minutes, from: id };
  return true;
}
