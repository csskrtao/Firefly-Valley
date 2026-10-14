import type { ForageArea, ItemId } from '../../data/items';
import type { BossId, MonsterId } from '../../data/monsters';

/** 地面上的区域。矿脉是萤石镇下面的地下区域，单独由 mineGen 生成 */
export type RegionId = 'town' | 'mistwood' | 'starmarsh' | 'northcrag' | 'ruins';

/** 地图的四条边 */
export type Edge = 'n' | 's' | 'e' | 'w';

/** 野外区域的 Boss：用一种现有怪物的行为，放大两倍，血量和攻击单独给 */
export interface RegionBossDef {
  name: string;
  base: MonsterId;
  hp: number;
  atk: number;
  gold: [number, number];
  /** 第一次击败的奖励 */
  firstDrops: Partial<Record<ItemId, number>>;
  /** 之后每天再打的奖励 */
  drops: Partial<Record<ItemId, number>>;
  intro: string;
  defeat: string;
}

/** 开放条件，全部满足才能进入。hint 是还没开放时给玩家的提示 */
export interface RegionUnlock {
  level?: number;
  boss?: BossId;
  hint: string;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  desc: string;
  /** 世界地图上的位置（列、行），矿脉画在萤石镇正下方 */
  pos: [number, number];
  /** 主题色：世界地图上的节点、区域名横幅 */
  color: string;
  /** 怪物强度，相当于矿脉第几层 */
  tier: number;
  /** 每条边通往哪个区域 */
  links: Partial<Record<Edge, RegionId>>;
  unlock: RegionUnlock | null;
  /** 进入区域时刷出的怪物和权重（户外探险线会接管怪物的刷新） */
  monsters: Partial<Record<MonsterId, number>>;
  boss: RegionBossDef | null;
  /** 地上能捡到哪几类采集物 */
  forage: ForageArea[];
}

export const REGIONS: Record<RegionId, RegionDef> = {
  town: {
    id: 'town', name: '萤石镇', desc: '祖母留下的农场和小镇。南边的悬崖下是老矿脉的入口。',
    pos: [1, 1], color: '#ffcf5a', tier: 1,
    links: { n: 'northcrag', w: 'starmarsh', e: 'mistwood' },
    unlock: null, monsters: {}, boss: null, forage: [],
  },
  mistwood: {
    id: 'mistwood', name: '雾语森林', desc: '萤火森林再往东，常年起雾的老林子。听说雾里有会说话的蘑菇。',
    pos: [2, 1], color: '#7fd18a', tier: 2,
    links: { w: 'town', n: 'ruins' },
    unlock: null,
    monsters: { mushroom: 4, slime: 3, bat: 2 },
    boss: {
      name: '雾林菇老', base: 'mushroom', hp: 260, atk: 11, gold: [80, 120],
      firstDrops: { spore: 6, morel: 2, potion: 2 }, drops: { spore: 3, potion: 1 },
      intro: '（雾里有一朵比人还高的蘑菇转过身来，伞盖上的孢子簌簌往下掉。）',
      defeat: '（菇老慢慢缩成了一朵普通的大蘑菇，雾也淡了一些。）',
    },
    forage: ['forest'],
  },
  starmarsh: {
    id: 'starmarsh', name: '星湖湿地', desc: '镇子西边的一大片水泽。晴天的夜里，水面会倒映出整片星空。',
    pos: [0, 1], color: '#6ab4e8', tier: 4,
    links: { e: 'town' },
    unlock: { level: 3, hint: '去湿地的木栈道还没修好。等级到 3 级以后再来吧。' },
    monsters: { slime: 4, mole: 3, bat: 2 },
    boss: {
      name: '泥沼掘王', base: 'mole', hp: 420, atk: 14, gold: [120, 170],
      firstDrops: { claw: 5, shell: 3, bigPotion: 1 }, drops: { claw: 2, shell: 1 },
      intro: '（脚下的泥地拱起了一道长长的土包，有什么大家伙正朝你钻过来。）',
      defeat: '（泥沼掘王翻着肚皮沉进了泥里，只留下几只爪子。）',
    },
    forage: ['beach', 'meadow'],
  },
  northcrag: {
    id: 'northcrag', name: '北山岩地', desc: '小镇北边的碎石山坡。山路以前被史莱姆堵着，现在终于通了。',
    pos: [1, 0], color: '#b9b0a4', tier: 7,
    links: { s: 'town', e: 'ruins' },
    unlock: { boss: 'slimeKing', hint: '北山的山口被一大团黏糊糊的凝胶堵住了。也许打败矿脉里的史莱姆王就能通过。' },
    monsters: { golem: 3, mole: 3, bat: 2 },
    boss: {
      name: '岩山巨像', base: 'golem', hp: 900, atk: 20, gold: [260, 340],
      firstDrops: { iron: 6, gold: 3, cog: 4 }, drops: { iron: 3, cog: 2 },
      intro: '（山坡上一块巨石站了起来。它身上长满了青苔，眼睛里亮着萤石的光。）',
      defeat: '（巨像轰然倒地，碎成了一堆矿石。）',
    },
    forage: ['meadow'],
  },
  ruins: {
    id: 'ruins', name: '古代遗迹', desc: '森林北边、北山东边的一片废墟。石柱上刻着和矿脉深处一样的萤石纹路。',
    pos: [2, 0], color: '#c49af0', tier: 10,
    links: { w: 'northcrag', s: 'mistwood' },
    unlock: { level: 10, boss: 'ironJaw', hint: '遗迹外面笼着一层萤石光幕。也许要先打倒矿脉深处的铁颚，并且到 10 级。' },
    monsters: { skeleton: 4, golem: 2, bat: 2 },
    boss: {
      name: '遗迹守墓人', base: 'skeleton', hp: 1400, atk: 26, gold: [420, 560],
      firstDrops: { glowstone: 4, bone: 6, bigPotion: 2 }, drops: { glowstone: 2, bone: 3 },
      intro: '（石棺的盖子滑开了。一具披着破斗篷的骷髅握着生锈的长剑站了起来。）',
      defeat: '（守墓人的骨头散了一地，斗篷下面露出几块发光的萤石。）',
    },
    forage: ['meadow', 'forest'],
  },
};

export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

/** 野外区域（萤石镇以外的地面区域） */
export const WILD_IDS = REGION_IDS.filter((id) => id !== 'town');

export const OPPOSITE: Record<Edge, Edge> = { n: 's', s: 'n', e: 'w', w: 'e' };
