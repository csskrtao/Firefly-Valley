import type { ClassDef } from '../data/classes';
import { CLASSES } from '../data/classes';
import type { EquipSlot, Gear } from '../data/gear';
import { PLUS_CRIT, gearName, gearStats } from '../data/gear';
import type { AccStat, BuffStat } from '../data/items';
import type { WeaponType } from '../data/weapons';
import { WEAPON_TYPES } from '../data/weapons';
import type { SaveData } from '../state/save';
import { allEquipped, weaponOf } from './gear';
import { levelAtk, levelHp } from './level';

export const classOf = (s: SaveData): ClassDef => CLASSES[s.cls];
export const weaponTypeOf = (s: SaveData): WeaponType => WEAPON_TYPES[weaponOf(s).wt ?? s.weaponType];

/** 身上所有装备（饰品本身的属性和全部随机词条）某项属性的总和 */
export function accSum(s: SaveData, key: AccStat): number {
  let v = 0;
  for (const g of allEquipped(s)) v += gearStats(g).mods[key] ?? 0;
  return v;
}

/** 身上护甲的基础防御和生命 */
function armorSum(s: SaveData, key: 'def' | 'hp'): number {
  let v = 0;
  for (const g of allEquipped(s)) v += gearStats(g)[key];
  return v;
}

/** 料理效果的数值，过期或不是这一项就是 0 */
export function buffValue(s: SaveData, stat: BuffStat): number {
  const b = s.buff;
  return b && b.stat === stat && s.time < b.until ? b.value : 0;
}

export const maxHp = (s: SaveData): number =>
  100 + Math.round(armorSum(s, 'hp') + classOf(s).hp + levelHp(s.level) + accSum(s, 'hp'));
export const defense = (s: SaveData): number =>
  Math.round(armorSum(s, 'def') + classOf(s).def + accSum(s, 'def') + buffValue(s, 'def'));
export const attack = (s: SaveData): number =>
  Math.round(gearStats(weaponOf(s)).atk * weaponTypeOf(s).mul * levelAtk(s.level) * (1 + accSum(s, 'atk') + buffValue(s, 'atk')));
export const critChance = (s: SaveData): number => 0.08 + weaponOf(s).plus * PLUS_CRIT + classOf(s).crit + accSum(s, 'crit') + buffValue(s, 'crit');
export const moveSpeed = (s: SaveData): number => classOf(s).speed * (1 + accSum(s, 'speed') + buffValue(s, 'speed'));
export const regenRate = (s: SaveData): number => accSum(s, 'regen') + buffValue(s, 'regen');
export const lightRadiusMul = (s: SaveData): number => 1 + accSum(s, 'light') + buffValue(s, 'light');

export const weaponName = (s: SaveData): string => gearName(weaponOf(s));

/** 受到伤害：防御直接减伤，至少 1 点 */
export const damageTaken = (raw: number, def: number): number => Math.max(1, Math.round(raw - def));

/* ---------- 换装对比 ---------- */

export interface StatLine {
  label: string;
  cur: number;
  next: number;
  /** 显示格式 */
  fmt: (v: number) => string;
}

const STAT_ROWS: { label: string; get: (s: SaveData) => number; fmt: (v: number) => string }[] = [
  { label: '攻击力', get: attack, fmt: (v) => String(v) },
  { label: '防御力', get: defense, fmt: (v) => String(v) },
  { label: '生命上限', get: maxHp, fmt: (v) => String(v) },
  { label: '暴击率', get: critChance, fmt: (v) => `${Math.round(v * 100)}%` },
  { label: '移速', get: (s) => accSum(s, 'speed') + buffValue(s, 'speed'), fmt: (v) => `+${Math.round(v * 100)}%` },
  { label: '吸血', get: (s) => accSum(s, 'lifesteal'), fmt: (v) => `${Math.round(v * 1000) / 10}%` },
  { label: '每秒回复', get: regenRate, fmt: (v) => String(Math.round(v * 10) / 10) },
  { label: '经验加成', get: (s) => accSum(s, 'xp'), fmt: (v) => `+${Math.round(v * 100)}%` },
  { label: '采集加成', get: (s) => accSum(s, 'luck') * 0.25, fmt: (v) => `+${Math.round(v * 100)}%` },
  { label: '视野', get: (s) => accSum(s, 'light'), fmt: (v) => `+${Math.round(v * 100)}%` },
];

/**
 * 把 g 换到 slot 上以后，角色属性会怎么变。只列出有变化的项。
 * 不改动存档：在一份浅拷贝上算。
 */
export function compareEquip(s: SaveData, g: Gear, slot: EquipSlot): StatLine[] {
  const after: SaveData = { ...s, equip: { ...s.equip, [slot]: g.id }, weaponType: g.wt ?? s.weaponType };
  return STAT_ROWS.map((r) => ({ label: r.label, cur: r.get(s), next: r.get(after), fmt: r.fmt }))
    .filter((l) => Math.abs(l.next - l.cur) > 1e-6);
}
