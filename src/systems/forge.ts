import type { Cost } from '../data/equipment';
import { ENHANCE_RATE, FORGE_ARMOR, FORGE_WEAPON, MAX_PLUS, MAX_TIER, enhanceCost } from '../data/equipment';
import type { ItemId } from '../data/items';
import type { SaveData } from '../state/save';
import { count, removeItem } from '../state/save';

export type GearKind = 'weapon' | 'armor';

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

export function nextForgeCost(s: SaveData, kind: GearKind): Cost | null {
  const tier = s[kind].tier;
  if (tier >= MAX_TIER) return null;
  return (kind === 'weapon' ? FORGE_WEAPON : FORGE_ARMOR)[tier + 1];
}

export type ForgeResult = 'ok' | 'max' | 'cost';

/** 升阶：强化等级归零，但新阶的基础数值大幅提高 */
export function forge(s: SaveData, kind: GearKind, discount = 0): ForgeResult {
  const cost = nextForgeCost(s, kind);
  if (!cost) return 'max';
  if (!canAfford(s, cost, discount)) return 'cost';
  pay(s, cost, discount);
  s[kind].tier++;
  s[kind].plus = 0;
  return 'ok';
}

export function successRate(plus: number, bonus = 0): number {
  return Math.min(1, (ENHANCE_RATE[plus] ?? 0) + bonus);
}

export type EnhanceResult = 'success' | 'fail' | 'max' | 'cost';

/** 强化：失败只扣材料，不会掉级 */
export function enhance(s: SaveData, kind: GearKind, bonus = 0, roll = Math.random()): EnhanceResult {
  const g = s[kind];
  if (g.plus >= MAX_PLUS) return 'max';
  const cost = enhanceCost(g.tier, g.plus);
  if (!canAfford(s, cost)) return 'cost';
  pay(s, cost);
  if (roll < successRate(g.plus, bonus)) {
    g.plus++;
    return 'success';
  }
  return 'fail';
}

export function costText(cost: Cost, names: (id: ItemId) => string, discount = 0): string {
  const parts = [`${goldCost(cost, discount)}金`];
  for (const [id, n] of Object.entries(cost.items) as [ItemId, number][]) parts.push(`${names(id)}×${n}`);
  return parts.join(' + ');
}
