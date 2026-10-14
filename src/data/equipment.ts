import type { ItemId } from './items';

export interface Cost {
  gold: number;
  items: Partial<Record<ItemId, number>>;
}

/** 各阶武器的基础攻击和颜色 */
export const WEAPON_TIERS = [
  { atk: 4, color: '#c49a5e' },
  { atk: 8, color: '#e8894a' },
  { atk: 13, color: '#dfe6ee' },
  { atk: 20, color: '#ffd34d' },
  { atk: 30, color: '#62f0d6' },
];

/** 各阶衣服的名字和基础数值 */
export const ARMOR_TIERS = [
  { name: '布衣', def: 0, hp: 0, color: '#4f8f5a' },
  { name: '铜甲', def: 2, hp: 15, color: '#c0703a' },
  { name: '铁甲', def: 4, hp: 30, color: '#8c96a3' },
  { name: '金甲', def: 7, hp: 50, color: '#e8b830' },
  { name: '萤石甲', def: 11, hp: 80, color: '#3fbfae' },
];

export const MAX_TIER = WEAPON_TIERS.length - 1;

/** 把一件装备升到第 n 阶的花费，下标 0 不用。金器和萤石器另外要有 Boss 的战利品（见 gear.ts 的 TIER_NEEDS）。 */
export const FORGE_WEAPON: (Cost | null)[] = [
  null,
  { gold: 100, items: { copper: 5 } },
  { gold: 300, items: { iron: 5, copper: 3 } },
  { gold: 800, items: { gold: 5, gel: 6 } },
  { gold: 2000, items: { glowstone: 5, gold: 3, cog: 4 } },
];

export const FORGE_ARMOR: (Cost | null)[] = [
  null,
  { gold: 80, items: { copper: 4, gel: 3 } },
  { gold: 260, items: { iron: 4, bone: 3 } },
  { gold: 700, items: { gold: 4, gel: 10 } },
  { gold: 1800, items: { glowstone: 4, cog: 6 } },
];

export const MAX_PLUS = 10;
/** 从 +n 强化到 +n+1 的成功率 */
export const ENHANCE_RATE = [1, 1, 1, 0.85, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25];
