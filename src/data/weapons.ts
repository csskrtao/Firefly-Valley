import type { ClassId } from './classes';
import type { Cost } from './equipment';

/**
 * 武器类型：每个职业 3 种，共用同一套阶级和强化等级，只是打法不同。
 * slash 挥砍 / cleave 重劈 / thrust 突刺 / twin 双刃连击
 * bolt 魔法弹 / spread 三连发 / orb 追踪法球 / dart 飞镖
 * shard 穿透碎片 / pulse 身边震波 / fan 扇形碎片
 */
export type AttackKind = 'slash' | 'cleave' | 'thrust' | 'twin' | 'bolt' | 'spread' | 'orb' | 'dart' | 'shard' | 'pulse' | 'fan';

export interface WeaponType {
  cls: ClassId;
  name: string;
  /** 各阶的名字，对应 WEAPON_TIERS */
  tiers: string[];
  kind: AttackKind;
  mul: number;
  cooldown: number;
  /** 近战的攻击距离 */
  reach?: number;
  desc: string;
  /** 向老岩买图纸的价格，以及最深到过第几层才会出现；默认武器没有 */
  blueprint?: { cost: Cost; floor: number };
}

export const WEAPON_TYPES = {
  sword: {
    cls: 'warrior', name: '剑', tiers: ['木剑', '铜剑', '铁剑', '金剑', '萤石大剑'], kind: 'slash', mul: 1.1, cooldown: 0.38, reach: 15,
    desc: '攻守平衡，挥砍范围大。',
  },
  axe: {
    cls: 'warrior', name: '战斧', tiers: ['木斧', '铜战斧', '铁战斧', '金战斧', '萤石巨斧'], kind: 'cleave', mul: 1.6, cooldown: 0.62, reach: 17,
    desc: '出手慢，但一斧子能把一圈敌人劈飞。', blueprint: { cost: { gold: 300, items: { copper: 6 } }, floor: 2 },
  },
  spear: {
    cls: 'warrior', name: '长枪', tiers: ['木枪', '铜枪', '铁枪', '金枪', '萤石长枪'], kind: 'thrust', mul: 1.2, cooldown: 0.42, reach: 26,
    desc: '向前直刺，攻击距离最远，可以一次刺穿一排敌人。', blueprint: { cost: { gold: 800, items: { iron: 6, bone: 4 } }, floor: 6 },
  },
  staff: {
    cls: 'mage', name: '法杖', tiers: ['木杖', '铜杖', '铁杖', '金杖', '萤石法杖'], kind: 'bolt', mul: 1.0, cooldown: 0.45,
    desc: '发射一枚魔法弹，射程远。',
  },
  tome: {
    cls: 'mage', name: '魔导书', tiers: ['旧笔记', '铜扣书', '铁皮书', '金页书', '萤石典籍'], kind: 'spread', mul: 0.62, cooldown: 0.6,
    desc: '一次扇形射出三枚魔法弹，适合对付成群的敌人。', blueprint: { cost: { gold: 300, items: { copper: 4, wing: 3 } }, floor: 2 },
  },
  orb: {
    cls: 'mage', name: '法球', tiers: ['木球', '铜球', '铁球', '金球', '萤石宝珠'], kind: 'orb', mul: 1.4, cooldown: 0.75,
    desc: '慢悠悠的大法球，会自己追着敌人飞，还能穿透。', blueprint: { cost: { gold: 800, items: { iron: 5, spore: 4 } }, floor: 6 },
  },
  dagger: {
    cls: 'rogue', name: '匕首', tiers: ['木匕首', '铜匕首', '铁匕首', '金匕首', '萤石短刃'], kind: 'slash', mul: 0.8, cooldown: 0.2, reach: 11,
    desc: '出手极快，暴击高。',
  },
  twin: {
    cls: 'rogue', name: '双刃', tiers: ['木双刃', '铜双刃', '铁双刃', '金双刃', '萤石双刃'], kind: 'twin', mul: 0.62, cooldown: 0.28, reach: 12,
    desc: '一次砍两刀，第二刀会追着最近的敌人。', blueprint: { cost: { gold: 300, items: { copper: 6 } }, floor: 2 },
  },
  darts: {
    cls: 'rogue', name: '飞镖', tiers: ['木镖', '铜镖', '铁镖', '金镖', '萤石飞镖'], kind: 'dart', mul: 0.78, cooldown: 0.24,
    desc: '远距离连续投掷，飞得快但射程不远。', blueprint: { cost: { gold: 800, items: { iron: 5, claw: 3 } }, floor: 6 },
  },
  lantern: {
    cls: 'spirit', name: '萤灯', tiers: ['萤石灯', '铜萤灯', '铁萤灯', '金萤灯', '星辉萤灯'], kind: 'shard', mul: 0.9, cooldown: 0.35,
    desc: '射出穿透的萤石碎片。',
  },
  bell: {
    cls: 'spirit', name: '萤铃', tiers: ['小铃', '铜铃', '铁铃', '金铃', '星辉萤铃'], kind: 'pulse', mul: 0.9, cooldown: 0.55,
    desc: '摇响铃铛，震伤身边一圈的敌人。', blueprint: { cost: { gold: 300, items: { copper: 4, gel: 4 } }, floor: 2 },
  },
  fan: {
    cls: 'spirit', name: '萤蝶扇', tiers: ['纸扇', '铜扇', '铁扇', '金扇', '星辉蝶扇'], kind: 'fan', mul: 0.6, cooldown: 0.5,
    desc: '扇出三片穿透的萤光碎片。', blueprint: { cost: { gold: 800, items: { iron: 5, wing: 4 } }, floor: 6 },
  },
} satisfies Record<string, WeaponType>;

export type WeaponTypeId = keyof typeof WEAPON_TYPES;
export const WEAPON_TYPE_IDS = Object.keys(WEAPON_TYPES) as WeaponTypeId[];
export const weaponType = (id: WeaponTypeId): WeaponType => WEAPON_TYPES[id];

/** 某个职业的三种武器，第一种是开局就有的 */
export const typesOf = (cls: ClassId): WeaponTypeId[] => WEAPON_TYPE_IDS.filter((id) => WEAPON_TYPES[id].cls === cls);
export const defaultType = (cls: ClassId): WeaponTypeId => typesOf(cls)[0];

export const isRanged = (k: AttackKind): boolean => k === 'bolt' || k === 'spread' || k === 'orb' || k === 'dart' || k === 'shard' || k === 'fan';
