import type { ClassDef } from '../data/classes';
import { CLASSES } from '../data/classes';
import { ARMOR_TIERS, WEAPON_TIERS } from '../data/equipment';
import type { SaveData } from '../state/save';

export const classOf = (s: SaveData): ClassDef => CLASSES[s.cls];

export const maxHp = (s: SaveData): number => 100 + ARMOR_TIERS[s.armor.tier].hp + s.armor.plus * 5 + classOf(s).hp;
export const defense = (s: SaveData): number => ARMOR_TIERS[s.armor.tier].def + s.armor.plus + classOf(s).def;
export const attack = (s: SaveData): number => Math.round(WEAPON_TIERS[s.weapon.tier].atk * (1 + 0.15 * s.weapon.plus) * classOf(s).mul);
export const critChance = (s: SaveData): number => 0.08 + s.weapon.plus * 0.02 + classOf(s).crit;
export const weaponName = (s: SaveData, tier = s.weapon.tier): string => classOf(s).weapons[tier];
export const armorName = (tier: number): string => ARMOR_TIERS[tier].name;

/** 受到伤害：防御直接减伤，至少 1 点 */
export const damageTaken = (raw: number, def: number): number => Math.max(1, Math.round(raw - def));
