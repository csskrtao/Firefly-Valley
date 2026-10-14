import type { ItemId } from './items';
import type { BossId, MonsterId } from './monsters';

export type QuestGoal =
  | { type: 'kill'; target: MonsterId; count: number }
  | { type: 'collect'; item: ItemId; count: number }
  | { type: 'boss'; target: BossId };

export interface QuestDef {
  title: string;
  desc: string;
  goal: QuestGoal;
  reward: { gold: number; items?: Partial<Record<ItemId, number>> };
}

/** 艾恩按顺序发布的委托 */
export const QUESTS: QuestDef[] = [
  { title: '史莱姆清理', desc: '苔藓矿道的史莱姆越来越多了。消灭 8 只绿史莱姆。', goal: { type: 'kill', target: 'slime', count: 8 }, reward: { gold: 150, items: { potion: 2 } } },
  { title: '铜矿短缺', desc: '镇上修屋顶缺铜。交 10 块铜矿给公会。', goal: { type: 'collect', item: 'copper', count: 10 }, reward: { gold: 220 } },
  { title: '蝙蝠之患', desc: '蝙蝠吓坏了运矿车的马。消灭 10 只洞穴蝙蝠。', goal: { type: 'kill', target: 'bat', count: 10 }, reward: { gold: 250, items: { tonic: 2 } } },
  { title: '王座之下', desc: '击败第 5 层的史莱姆王·咕噜噜。', goal: { type: 'boss', target: 'slimeKing' }, reward: { gold: 500, items: { glowstone: 1 } } },
  { title: '骷髅矿工', desc: '锈铁坑道里的骷髅还在挖矿。让它们安息吧：消灭 12 只。', goal: { type: 'kill', target: 'skeleton', count: 12 }, reward: { gold: 420, items: { bigPotion: 2 } } },
  { title: '齿轮回收', desc: '老岩想研究傀儡的构造。交 8 个锈齿轮。', goal: { type: 'collect', item: 'cog', count: 8 }, reward: { gold: 600 } },
  { title: '地底的轰鸣', desc: '第 10 层有东西在啃矿脉。击败铁颚掘地者。', goal: { type: 'boss', target: 'ironJaw' }, reward: { gold: 1500, items: { glowstone: 3 } } },
];
