import type { ClassId } from './classes';

export interface SkillDef {
  id: string;
  name: string;
  /** 解锁等级 */
  level: number;
  cooldown: number;
  cost: number;
  desc: string;
}

/** 每个职业 3 个技能，分别在 1、3、6 级解锁，对应 L、U、O 键 */
export const SKILLS: Record<ClassId, SkillDef[]> = {
  warrior: [
    { id: 'whirl', name: '旋风斩', level: 1, cooldown: 4, cost: 8, desc: '横扫身边一圈的敌人。' },
    { id: 'charge', name: '冲锋', level: 3, cooldown: 5, cost: 8, desc: '向前猛冲，撞晕路上的敌人。' },
    { id: 'warcry', name: '战吼', level: 6, cooldown: 16, cost: 12, desc: '8 秒内攻击 +30%、防御 +4，并震退身边的敌人。' },
  ],
  mage: [
    { id: 'nova', name: '冰霜新星', level: 1, cooldown: 6, cost: 10, desc: '冻住周围的敌人。' },
    { id: 'fireball', name: '火球术', level: 3, cooldown: 3.5, cost: 8, desc: '射出火球，撞到敌人后爆炸，伤害一片。' },
    { id: 'blink', name: '闪现', level: 6, cooldown: 5, cost: 6, desc: '瞬移到前方，原地留下一圈冰霜。' },
  ],
  rogue: [
    { id: 'shadow', name: '影步', level: 1, cooldown: 3, cost: 6, desc: '向前突进，途中无敌并划伤敌人。' },
    { id: 'knives', name: '飞刀扇', level: 3, cooldown: 4, cost: 8, desc: '向前方扇形扔出 7 把飞刀。' },
    { id: 'venom', name: '毒刃', level: 6, cooldown: 14, cost: 10, desc: '8 秒内攻击会让敌人中毒，持续掉血。' },
  ],
  spirit: [
    { id: 'burst', name: '萤光爆发', level: 1, cooldown: 7, cost: 10, desc: '回复 30 生命并震伤周围的敌人。' },
    { id: 'swarm', name: '萤灵增殖', level: 3, cooldown: 14, cost: 12, desc: '10 秒内萤灵变成 4 只，转得更快。' },
    { id: 'starfall', name: '星辉之雨', level: 6, cooldown: 10, cost: 12, desc: '星光落向附近的敌人，每颗都会爆开。' },
  ],
};
