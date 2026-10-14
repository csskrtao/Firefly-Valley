import type { ClassDef } from '../data/classes';
import { CLASSES } from '../data/classes';
import { ARMOR_TIERS, WEAPON_TIERS } from '../data/equipment';
import type { AccStat, BuffStat } from '../data/items';
import { itemDef } from '../data/items';
import type { WeaponType, WeaponTypeId } from '../data/weapons';
import { WEAPON_TYPES } from '../data/weapons';
import type { SaveData } from '../state/save';
import { levelAtk, levelHp } from './level';

export const classOf = (s: SaveData): ClassDef => CLASSES[s.cls];
export const weaponTypeOf = (s: SaveData): WeaponType => WEAPON_TYPES[s.weaponType];

/** 身上所有饰品某项属性的总和 */
export function accSum(s: SaveData, key: AccStat): number {
  let v = 0;
  for (const id of s.accessories) {
    v += itemDef(id).acc?.[key] ?? 0;
  }
  return v;
}

/** 料理效果的数值，过期或不是这一项就是 0 */
export function buffValue(s: SaveData, stat: BuffStat): number {
  const b = s.buff;
  return b && b.stat === stat && s.time < b.until ? b.value : 0;
}

export const maxHp = (s: SaveData): number =>
  100 + ARMOR_TIERS[s.armor.tier].hp + s.armor.plus * 5 + classOf(s).hp + levelHp(s.level) + accSum(s, 'hp');
export const defense = (s: SaveData): number =>
  ARMOR_TIERS[s.armor.tier].def + s.armor.plus + classOf(s).def + accSum(s, 'def') + buffValue(s, 'def');
export const attack = (s: SaveData): number =>
  Math.round(WEAPON_TIERS[s.weapon.tier].atk * (1 + 0.15 * s.weapon.plus) * weaponTypeOf(s).mul * levelAtk(s.level) * (1 + accSum(s, 'atk') + buffValue(s, 'atk')));
export const critChance = (s: SaveData): number => 0.08 + s.weapon.plus * 0.02 + classOf(s).crit + accSum(s, 'crit') + buffValue(s, 'crit');
export const moveSpeed = (s: SaveData): number => classOf(s).speed * (1 + accSum(s, 'speed') + buffValue(s, 'speed'));
export const regenRate = (s: SaveData): number => accSum(s, 'regen') + buffValue(s, 'regen');
export const lightRadiusMul = (s: SaveData): number => 1 + accSum(s, 'light') + buffValue(s, 'light');

export const weaponName = (s: SaveData, tier = s.weapon.tier, type: WeaponTypeId = s.weaponType): string => WEAPON_TYPES[type].tiers[tier];
export const armorName = (tier: number): string => ARMOR_TIERS[tier].name;

/** 受到伤害：防御直接减伤，至少 1 点 */
export const damageTaken = (raw: number, def: number): number => Math.max(1, Math.round(raw - def));
