export interface ClassDef {
  name: string;
  hp: number;
  def: number;
  speed: number;
  crit: number;
  desc: string;
  secret?: boolean;
}

/** 职业只决定基础属性；武器（data/weapons.ts）和技能（data/skills.ts）各有三种 */
export const CLASSES = {
  warrior: {
    name: '战士', hp: 40, def: 2, speed: 1, crit: 0,
    desc: '血厚甲硬，近身作战。可以换用剑、战斧、长枪，技能有旋风斩、冲锋、战吼。',
  },
  mage: {
    name: '法师', hp: -10, def: 0, speed: 1, crit: 0,
    desc: '远程施法，可以边退边打。可以换用法杖、魔导书、法球，技能有冰霜新星、火球术、闪现。',
  },
  rogue: {
    name: '刺客', hp: 0, def: 0, speed: 1.28, crit: 0.2,
    desc: '跑得快、暴击高。可以换用匕首、双刃、飞镖，技能有影步、飞刀扇、毒刃。',
  },
  spirit: {
    name: '萤灵使', hp: 20, def: 1, speed: 1.1, crit: 0.05,
    desc: '隐藏职业。萤灵绕身自动攻击。可以换用萤灯、萤铃、萤蝶扇，技能有萤光爆发、萤灵增殖、星辉之雨。',
    secret: true,
  },
} satisfies Record<string, ClassDef>;

export type ClassId = keyof typeof CLASSES;
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const classDef = (id: ClassId): ClassDef => CLASSES[id];
