import type { ItemId } from './items';

export type AiKind = 'hop' | 'fly' | 'walk' | 'burrow' | 'spore';

export interface MonsterDef {
  name: string;
  hp: number;
  atk: number;
  speed: number;
  hw: number;
  hh: number;
  gold: [number, number];
  drops: { item: ItemId; chance: number }[];
  ai: AiKind;
  /** 受击击退倍率 */
  knock: number;
  color: string;
}

export const MONSTERS = {
  slime: { name: '绿史莱姆', hp: 14, atk: 5, speed: 55, hw: 6, hh: 5, gold: [3, 6], drops: [{ item: 'gel', chance: 0.5 }], ai: 'hop', knock: 1, color: '#6fd16b' },
  bat: { name: '洞穴蝙蝠', hp: 9, atk: 6, speed: 42, hw: 6, hh: 4, gold: [4, 7], drops: [{ item: 'wing', chance: 0.35 }], ai: 'fly', knock: 1, color: '#8a64b0' },
  mushroom: { name: '蘑菇人', hp: 24, atk: 7, speed: 18, hw: 6, hh: 6, gold: [6, 10], drops: [{ item: 'spore', chance: 0.5 }], ai: 'spore', knock: 0.8, color: '#c94a4a' },
  skeleton: { name: '矿工骷髅', hp: 40, atk: 11, speed: 26, hw: 5, hh: 6, gold: [10, 16], drops: [{ item: 'bone', chance: 0.5 }], ai: 'walk', knock: 0.9, color: '#e8e4d4' },
  golem: { name: '锈蚀傀儡', hp: 75, atk: 15, speed: 17, hw: 7, hh: 6, gold: [18, 26], drops: [{ item: 'cog', chance: 0.55 }, { item: 'iron', chance: 0.3 }], ai: 'walk', knock: 0.3, color: '#9a5a32' },
  mole: { name: '钻地鼠', hp: 30, atk: 12, speed: 62, hw: 6, hh: 4, gold: [12, 18], drops: [{ item: 'claw', chance: 0.45 }], ai: 'burrow', knock: 1, color: '#7a5a44' },
} satisfies Record<string, MonsterDef>;

export type MonsterId = keyof typeof MONSTERS;

export interface BossDef {
  name: string;
  floor: number;
  hp: number;
  atk: number;
  gold: [number, number];
  /** 首次击败的奖励 */
  firstDrops: Partial<Record<ItemId, number>>;
  /** 之后再打的奖励 */
  repeatDrops: Partial<Record<ItemId, number>>;
  intro: string;
  rematch: string;
  defeat: string;
}

export const BOSSES = {
  slimeKing: {
    name: '史莱姆王·咕噜噜', floor: 5, hp: 360, atk: 14, gold: [120, 160],
    firstDrops: { crown: 1, gold: 3, gel: 5 }, repeatDrops: { gold: 2, gel: 3 },
    intro: '咕噜噜……谁敢闯进本王的王座！跳起来的时候，你可要看清地上的影子！',
    rematch: '咕噜噜！又是你！这次本王不会输！',
    defeat: '咕……咕噜……本王的王冠……拿去吧……',
  },
  ironJaw: {
    name: '铁颚掘地者', floor: 10, hp: 950, atk: 22, gold: [400, 520],
    firstDrops: { fang: 1, glowstone: 3, cog: 5 }, repeatDrops: { glowstone: 2, cog: 3 },
    intro: '（地底传来金属摩擦的轰鸣。一对生锈的铁颚从岩层里探了出来。）',
    rematch: '（铁颚又一次从地底钻了出来，眼睛里闪着红光。）',
    defeat: '（铁颚发出最后一声哀鸣，碎成了一地齿轮和萤石。）',
  },
} satisfies Record<string, BossDef>;

export type BossId = keyof typeof BOSSES;

/** 楼层越深，怪物越强 */
export function scaleFor(floor: number): { hp: number; atk: number } {
  return { hp: 1 + 0.18 * (floor - 1), atk: 1 + 0.1 * (floor - 1) };
}
