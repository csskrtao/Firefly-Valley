import type { ItemId, ItemKind } from '../data/items';
import { ITEMS } from '../data/items';
import type { SaveData } from '../state/save';

export function sellableValue(s: SaveData, kinds: ItemKind[]): number {
  let total = 0;
  for (const [id, n] of Object.entries(s.inv) as [ItemId, number][]) {
    const d = ITEMS[id];
    if (kinds.includes(d.kind) && 'sell' in d && d.sell) total += d.sell * n;
  }
  return total;
}

/** 卖出指定种类的全部物品，返回获得的金币 */
export function sellAll(s: SaveData, kinds: ItemKind[]): number {
  const total = sellableValue(s, kinds);
  for (const id of Object.keys(s.inv) as ItemId[]) {
    const d = ITEMS[id];
    if (kinds.includes(d.kind) && 'sell' in d && d.sell) delete s.inv[id];
  }
  s.gold += total;
  return total;
}

export function buy(s: SaveData, id: ItemId, n: number, discount = 0): boolean {
  const d = ITEMS[id];
  if (!('buy' in d) || !d.buy) return false;
  const price = Math.round(d.buy * n * (1 - discount));
  if (s.gold < price) return false;
  s.gold -= price;
  s.inv[id] = (s.inv[id] ?? 0) + n;
  return true;
}

export const price = (id: ItemId, n: number, discount = 0): number => {
  const d = ITEMS[id];
  return 'buy' in d && d.buy ? Math.round(d.buy * n * (1 - discount)) : 0;
};
