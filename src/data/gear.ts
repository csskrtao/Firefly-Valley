import type { Cost } from './equipment';
import { ARMOR_TIERS, WEAPON_TIERS } from './equipment';
import type { AccStat, ItemId } from './items';
import { ITEMS, itemDef } from './items';
import type { WeaponTypeId } from './weapons';
import { WEAPON_TYPES } from './weapons';

/**
 * 装备：每件都是单独的一件，有自己的部位、阶级（材料）、品质、强化等级和随机词条。
 * 武器记着武器类型，饰品记着对应的饰品物品，护甲只看部位和阶级。
 */
export type GearSlot = 'weapon' | 'head' | 'body' | 'feet' | 'acc';
/** 身上的 6 个装备格 */
export type EquipSlot = 'weapon' | 'head' | 'body' | 'feet' | 'acc1' | 'acc2';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'head', 'body', 'feet', 'acc1', 'acc2'];
export const EQUIP_SLOT_NAME: Record<EquipSlot, string> = {
  weapon: '武器', head: '头盔', body: '衣服', feet: '鞋子', acc1: '饰品', acc2: '饰品',
};
export const GEAR_SLOT_NAME: Record<GearSlot, string> = { weapon: '武器', head: '头盔', body: '衣服', feet: '鞋子', acc: '饰品' };
export const slotsFor = (slot: GearSlot): EquipSlot[] => (slot === 'acc' ? ['acc1', 'acc2'] : [slot]);

export interface Affix {
  k: AccStat;
  v: number;
}

export interface Gear {
  id: number;
  slot: GearSlot;
  /** 武器类型（只有武器有） */
  wt?: WeaponTypeId;
  /** 饰品对应的物品（只有饰品有） */
  acc?: ItemId;
  /** 材料阶级 0–4：木/布、铜、铁、金、萤石。饰品固定为 0 */
  tier: number;
  /** 品质 0–4：普通、优秀、稀有、史诗、传说 */
  q: number;
  plus: number;
  affixes: Affix[];
}

/** 还没放进存档、没有编号的装备 */
export type NewGear = Omit<Gear, 'id'>;

export interface QualityDef {
  name: string;
  color: string;
  /** 基础属性倍率 */
  mul: number;
  /** 随机词条数 */
  affixes: number;
  /** 分解得到的萤尘 */
  salvage: number;
}

export const QUALITIES: QualityDef[] = [
  { name: '普通', color: '#e8e4d4', mul: 1, affixes: 0, salvage: 1 },
  { name: '优秀', color: '#6fd16b', mul: 1.15, affixes: 1, salvage: 3 },
  { name: '稀有', color: '#5aa8ff', mul: 1.32, affixes: 2, salvage: 7 },
  { name: '史诗', color: '#c06bff', mul: 1.52, affixes: 3, salvage: 15 },
  { name: '传说', color: '#ff9a3a', mul: 1.75, affixes: 4, salvage: 30 },
];
export const MAX_QUALITY = QUALITIES.length - 1;

/** 头盔和鞋子的名字和基础数值；衣服沿用原来的护甲阶级 */
export const ARMOR_PIECES: Record<'head' | 'body' | 'feet', { names: string[]; base: { def: number; hp: number }[]; plusDef: number; plusHp: number }> = {
  head: {
    names: ['布帽', '铜盔', '铁盔', '金盔', '萤石盔'],
    base: [{ def: 0, hp: 6 }, { def: 1, hp: 12 }, { def: 2, hp: 20 }, { def: 3, hp: 30 }, { def: 5, hp: 45 }],
    plusDef: 0.5, plusHp: 3,
  },
  body: {
    names: ARMOR_TIERS.map((t) => t.name),
    base: ARMOR_TIERS.map((t) => ({ def: t.def, hp: t.hp })),
    plusDef: 1, plusHp: 5,
  },
  feet: {
    names: ['草鞋', '铜靴', '铁靴', '金靴', '萤石靴'],
    base: [{ def: 0, hp: 4 }, { def: 1, hp: 6 }, { def: 1, hp: 12 }, { def: 2, hp: 20 }, { def: 4, hp: 30 }],
    plusDef: 0.5, plusHp: 3,
  },
};

/** 随机词条：数值范围（0 阶），每高一阶加多少，哪些部位能出 */
export interface AffixDef {
  min: number;
  max: number;
  perTier: number;
  /** 整数词条（生命、防御） */
  int?: boolean;
  slots: GearSlot[];
}

const ALL: GearSlot[] = ['weapon', 'head', 'body', 'feet', 'acc'];
export const AFFIXES: Record<AccStat, AffixDef> = {
  atk: { min: 0.03, max: 0.06, perTier: 0.01, slots: ['weapon', 'head', 'acc'] },
  crit: { min: 0.02, max: 0.04, perTier: 0.005, slots: ['weapon', 'head', 'feet', 'acc'] },
  lifesteal: { min: 0.01, max: 0.025, perTier: 0.004, slots: ['weapon', 'acc'] },
  speed: { min: 0.03, max: 0.06, perTier: 0.005, slots: ['feet', 'body', 'acc'] },
  hp: { min: 6, max: 14, perTier: 8, int: true, slots: ['head', 'body', 'feet', 'acc'] },
  def: { min: 1, max: 2, perTier: 0.6, int: true, slots: ['head', 'body', 'feet', 'acc'] },
  luck: { min: 0.3, max: 0.6, perTier: 0.08, slots: ALL },
  xp: { min: 0.05, max: 0.1, perTier: 0.015, slots: ALL },
  regen: { min: 0.2, max: 0.4, perTier: 0.1, slots: ['body', 'head', 'acc'] },
  light: { min: 0.08, max: 0.16, perTier: 0.02, slots: ['head', 'acc'] },
};

/** 属性说明文字。运气在挖矿时按 25% 一点折算，所以写成采集加成 */
export const STAT_TEXT: Record<AccStat, (v: number) => string> = {
  hp: (v) => `生命 +${v}`,
  def: (v) => `防御 +${v}`,
  atk: (v) => `攻击 +${pct(v)}%`,
  speed: (v) => `移速 +${pct(v)}%`,
  crit: (v) => `暴击 +${pct(v)}%`,
  lifesteal: (v) => `吸血 ${pct(v, 1)}%`,
  luck: (v) => `采集加成 +${pct(v * 0.25)}%`,
  xp: (v) => `经验 +${pct(v)}%`,
  regen: (v) => `每秒回复 ${Math.round(v * 10) / 10} 生命`,
  light: (v) => `视野 +${pct(v)}%`,
};

function pct(v: number, digits = 0): number {
  const k = 10 ** digits;
  return Math.round(v * 100 * k) / k;
}

/** 可以从掉落里出现的饰品：前一组 0–1 阶就有，后一组 2 阶以上才有 */
export const ACC_DROPS: { id: ItemId; from: number }[] = [
  { id: 'copperRing', from: 0 },
  { id: 'powerCharm', from: 0 },
  { id: 'mossCharm', from: 0 },
  { id: 'clover', from: 1 },
  { id: 'vampFang', from: 2 },
  { id: 'glowPendant', from: 2 },
  { id: 'crownRing', from: 3 },
  { id: 'jawCharm', from: 4 },
];

/* ---------- 单件装备的名字和数值 ---------- */

export function gearName(g: Pick<Gear, 'slot' | 'wt' | 'acc' | 'tier'>): string {
  if (g.slot === 'weapon') return WEAPON_TYPES[g.wt ?? 'sword'].tiers[g.tier];
  if (g.slot === 'acc') return ITEMS[g.acc ?? 'copperRing'].name;
  return ARMOR_PIECES[g.slot].names[g.tier];
}

export const gearColor = (g: Pick<Gear, 'q'>): string => QUALITIES[g.q].color;

export interface GearStats {
  /** 武器的基础攻击（还没乘武器类型和等级） */
  atk: number;
  def: number;
  hp: number;
  /** 饰品本身的属性和随机词条，按百分比或固定值加到角色身上 */
  mods: Partial<Record<AccStat, number>>;
}

export function gearStats(g: Gear): GearStats {
  const q = QUALITIES[g.q];
  const st: GearStats = { atk: 0, def: 0, hp: 0, mods: {} };
  const add = (k: AccStat, v: number) => (st.mods[k] = (st.mods[k] ?? 0) + v);
  if (g.slot === 'weapon') {
    st.atk = WEAPON_TIERS[g.tier].atk * q.mul * (1 + 0.15 * g.plus);
  } else if (g.slot === 'acc') {
    const scale = q.mul * (1 + 0.1 * g.plus);
    for (const [k, v] of Object.entries(itemDef(g.acc ?? 'copperRing').acc ?? {}) as [AccStat, number][]) {
      add(k, AFFIXES[k].int ? Math.round(v * scale) : v * scale);
    }
  } else {
    const p = ARMOR_PIECES[g.slot];
    const b = p.base[g.tier];
    st.def = Math.round(b.def * q.mul + g.plus * p.plusDef);
    st.hp = Math.round(b.hp * q.mul + g.plus * p.plusHp);
  }
  for (const a of g.affixes) add(a.k, a.v);
  return st;
}

/** 武器每强化一级加的暴击 */
export const PLUS_CRIT = 0.02;

/* ---------- 掉落 ---------- */

export type DropSource = 'monster' | 'chest' | 'boss';

/** 各来源出各品质的权重（普通→传说） */
export const QUALITY_WEIGHTS: Record<DropSource, number[]> = {
  monster: [70, 22, 6, 1.6, 0.4],
  chest: [40, 36, 17, 6, 1],
  boss: [0, 0, 62, 30, 8],
};

/** 普通怪物掉装备的几率；宝箱见 loot.ts，Boss 必掉 */
export const MONSTER_GEAR_CHANCE = 0.05;
export const CHEST_GEAR_CHANCE = 0.4;

export const SLOT_WEIGHTS: Record<GearSlot, number> = { weapon: 3, head: 2, body: 2, feet: 2, acc: 1 };

/** 区域等级对应的装备阶级。矿脉里区域等级就是楼层，地面是 0 */
const TIER_BY_LEVEL = [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
export function gearTierFor(level: number): number {
  return TIER_BY_LEVEL[Math.max(0, Math.min(TIER_BY_LEVEL.length - 1, Math.floor(level)))];
}
export const MAX_GEAR_TIER = WEAPON_TIERS.length - 1;

/* ---------- 铁匠 ---------- */

/** 强化石：分解装备得到的萤尘 */
export const ESSENCE: ItemId = 'essence';
/** 各阶装备强化时消耗的矿石 */
export const TIER_ORE: ItemId[] = ['copper', 'copper', 'iron', 'gold', 'glowstone'];

/** 从 +plus 强化到 +plus+1：金币、对应矿石，+3 以后还要萤尘 */
export function gearEnhanceCost(g: Pick<Gear, 'tier' | 'plus'>): Cost {
  const items: Partial<Record<ItemId, number>> = { [TIER_ORE[g.tier]]: g.plus + 1 };
  if (g.plus >= 3) items[ESSENCE] = g.plus - 2;
  return { gold: (g.plus + 1) * 30 * (g.tier + 1), items };
}

const UPGRADE_GOLD = [150, 400, 1000, 2500];
const UPGRADE_ESSENCE = [6, 15, 30, 60];
/** 提升一档品质：金币和萤尘，升到传说还要萤石 */
export function qualityUpgradeCost(g: Pick<Gear, 'tier' | 'q'>): Cost | null {
  if (g.q >= MAX_QUALITY) return null;
  const items: Partial<Record<ItemId, number>> = { [ESSENCE]: UPGRADE_ESSENCE[g.q] };
  if (g.q + 1 === MAX_QUALITY) items.glowstone = 3;
  return { gold: Math.round(UPGRADE_GOLD[g.q] * (1 + g.tier * 0.5)), items };
}

/** 升阶（换更好的材料重新打造）：沿用原来锻造的花费；金器和萤石器要先打败对应的 Boss */
export const TIER_NEEDS: (ItemId | null)[] = [null, null, null, 'crown', 'fang'];
