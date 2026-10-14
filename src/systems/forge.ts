import type { Cost } from '../data/equipment';
import { ENHANCE_RATE } from '../data/equipment';
import type { ItemId } from '../data/items';
import type { SaveData } from '../state/save';
import { count, removeItem } from '../state/save';

/** 铁匠用到的花费计算。具体的强化、升品、升阶在 gear.ts。 */

export function goldCost(cost: Cost, discount = 0): number {
  return Math.round(cost.gold * (1 - discount));
}

export function canAfford(s: SaveData, cost: Cost, discount = 0): boolean {
  if (s.gold < goldCost(cost, discount)) return false;
  for (const [id, n] of Object.entries(cost.items) as [ItemId, number][]) if (count(s, id) < n) return false;
  return true;
}

export function pay(s: SaveData, cost: Cost, discount = 0): void {
  s.gold -= goldCost(cost, discount);
  for (const [id, n] of Object.entries(cost.items) as [ItemId, number][]) removeItem(s, id, n);
}

export function successRate(plus: number, bonus = 0): number {
  return Math.min(1, (ENHANCE_RATE[plus] ?? 0) + bonus);
}

export function costText(cost: Cost, names: (id: ItemId) => string, discount = 0): string {
  const parts = [`${goldCost(cost, discount)}金`];
  for (const [id, n] of Object.entries(cost.items) as [ItemId, number][]) parts.push(`${names(id)}×${n}`);
  return parts.join(' + ');
}
