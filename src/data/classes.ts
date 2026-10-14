export interface ClassDef {
  name: string;
  /** 各阶武器名，对应 WEAPON_TIERS */
  weapons: string[];
  hp: number;
  def: number;
  speed: number;
  /** 攻击力倍率 */
  mul: number;
  /** 普攻冷却（秒） */
  cooldown: number;
  crit: number;
  /** 近战挥砍半径；远程职业为空 */
  reach?: number;
  ranged?: 'bolt' | 'shard';
  skill: { name: string; cooldown: number; cost: number };
  desc: string;
  secret?: boolean;
}

export const CLASSES = {
  warrior: {
    name: '战士', weapons: ['木剑', '铜剑', '铁剑', '金剑', '萤石大剑'],
    hp: 40, def: 2, speed: 1, mul: 1.1, cooldown: 0.38, crit: 0, reach: 15,
    skill: { name: '旋风斩', cooldown: 4, cost: 8 },
    desc: '血厚甲硬，挥砍范围大。技能【旋风斩】横扫身边一圈敌人。',
  },
  mage: {
    name: '法师', weapons: ['木杖', '铜杖', '铁杖', '金杖', '萤石法杖'],
    hp: -10, def: 0, speed: 1, mul: 1.0, cooldown: 0.45, crit: 0, ranged: 'bolt',
    skill: { name: '冰霜新星', cooldown: 6, cost: 10 },
    desc: '普攻发射魔法弹，可以远程风筝。技能【冰霜新星】冻住周围的敌人。',
  },
  rogue: {
    name: '刺客', weapons: ['木匕首', '铜匕首', '铁匕首', '金匕首', '萤石短刃'],
    hp: 0, def: 0, speed: 1.28, mul: 0.8, cooldown: 0.2, crit: 0.2, reach: 11,
    skill: { name: '影步', cooldown: 3, cost: 6 },
    desc: '跑得快、出手快、暴击高。技能【影步】向前突进，途中无敌并划伤敌人。',
  },
  spirit: {
    name: '萤灵使', weapons: ['萤石灯', '铜萤灯', '铁萤灯', '金萤灯', '星辉萤灯'],
    hp: 20, def: 1, speed: 1.1, mul: 0.9, cooldown: 0.35, crit: 0.05, ranged: 'shard',
    skill: { name: '萤光爆发', cooldown: 7, cost: 10 },
    desc: '隐藏职业。两只萤灵绕身自动攻击，普攻射出穿透的萤石碎片。技能【萤光爆发】回血并震伤周围敌人。',
    secret: true,
  },
} satisfies Record<string, ClassDef>;

export type ClassId = keyof typeof CLASSES;
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const classDef = (id: ClassId): ClassDef => CLASSES[id];
