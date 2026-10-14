import type { ItemId } from './items';

export type NpcRole = 'smith' | 'shop' | 'clinic' | 'guild' | 'owl' | 'kid';

export interface NpcDef {
  name: string;
  title: string;
  role: NpcRole;
  /** 一天的行程：[几点开始, 图块 x, 图块 y]，按时间排序 */
  schedule: [number, number, number][];
  /** 到了目的地后在附近几格内闲逛 */
  roam?: number;
  loves: ItemId[];
  likes: ItemId[];
  dislikes: ItemId[];
  lines: string[];
  /** 达到对应心数后第一次对话时触发的剧情 */
  heartEvents: Record<number, string>;
  /** 好感奖励说明，显示在人物关系页 */
  perks: { hearts: number; text: string }[];
}

export const NPCS = {
  smith: {
    name: '老岩', title: '铁匠', role: 'smith', roam: 1,
    schedule: [[6, 33, 8], [12, 41, 16], [13.5, 33, 8], [19, 44, 19], [22, 33, 8]],
    loves: ['gold', 'glowstone', 'pepper', 'pepperSoup'], likes: ['iron', 'copper', 'yam', 'stew', 'skewer'], dislikes: ['gel', 'berry', 'dandelion'],
    lines: [
      '哼，又来了？剑钝了就拿来。',
      '矿脉里的史莱姆王……你祖母当年也差点栽在它手上。',
      '好铁配好手。先把矿石挖够再说。',
      '+3 之后就看运气了。失败也不会掉级，别哭。',
      '锈铁坑道里那些傀儡，身上的齿轮倒是好料子。',
    ],
    heartEvents: {
      2: '……你祖母第一次来铺子，也是拿着一把木剑。她说要把萤石谷的光找回来。',
      4: '拿着，这是我年轻时的锤子。没什么用，就是想给你看看。以后强化，我多费点心。',
      6: '这阵子你挖回来的矿，够我打十把好剑了。以后锻造，我少收你点钱。',
    },
    perks: [{ hearts: 4, text: '强化成功率 +10%' }, { hearts: 6, text: '锻造金币花费 -20%' }],
  },
  vera: {
    name: '薇拉', title: '杂货店', role: 'shop', roam: 1,
    schedule: [[6, 43, 8], [11, 50, 13], [13, 43, 8], [18, 49, 19], [21, 43, 8]],
    loves: ['berry', 'melon', 'pumpkin', 'jam', 'pie'], likes: ['radish', 'pepper', 'wing', 'dandelion', 'raspberry', 'shell'], dislikes: ['bone', 'spore'],
    lines: [
      '欢迎光临！今天的种子都是新到的~',
      '听说锈铁坑道里有会钻地的老鼠，好吓人！',
      '你种的萝卜真水灵，卖给我吧？',
      '光莓晚上会发光，种在田边可漂亮了。',
      '换季的时候记得把旧作物收完，过季就枯了哦。',
    ],
    heartEvents: {
      2: '其实我小时候也想去矿里冒险……后来发现我连蝙蝠都怕，哈哈。',
      4: '老顾客啦！以后买种子给你打九折。',
      6: '这是我的秘密：每个季节第一天进的种子最新鲜！以后给你八折~',
    },
    perks: [{ hearts: 4, text: '种子九折' }, { hearts: 6, text: '种子八折' }],
  },
  lia: {
    name: '莉娅', title: '药剂师', role: 'clinic', roam: 1,
    schedule: [[6, 51, 8], [15, 27, 35], [18, 51, 8]],
    loves: ['berry', 'spore', 'pumpkin', 'fireflower', 'morel', 'tea'], likes: ['radish', 'yam', 'gel', 'leek', 'salad'], dislikes: ['bone', 'cog'],
    lines: [
      '受伤了吗？别逞强，药水要随身带着。',
      '光莓和蘑菇孢子……一起熬的话，说不定能做出新药。',
      '我怕黑，所以从来没下过矿。你真勇敢。',
      '高级药水需要更好的材料，等我研究出来再卖给你。',
    ],
    heartEvents: {
      2: '谢谢你常来看我。诊所平时很安静……有人说话真好。',
      4: '我把配方改良了一下，以后药水便宜一些卖你。',
      5: '高级药水做出来了！只卖给信得过的人，也就是你。',
    },
    perks: [{ hearts: 4, text: '药水八五折' }, { hearts: 5, text: '解锁高级药水' }],
  },
  ian: {
    name: '艾恩', title: '冒险者公会', role: 'guild', roam: 1,
    schedule: [[6, 58, 8], [13, 66, 12], [16, 58, 8], [20, 53, 16], [22, 58, 8]],
    loves: ['glowstone', 'melon', 'bar', 'crystalFruit'], likes: ['claw', 'wing', 'bone', 'hazelnut'], dislikes: ['gel', 'radish'],
    lines: [
      '公会委托按顺序发布。完成一个，下一个才会出来。',
      '冒险者守则第一条：别死。第二条：别把公会的地板弄脏。',
      '……你看到我在写的东西了？那只是报告，不是小说。',
    ],
    heartEvents: {
      3: '好吧，我承认我在写小说。主角是一个从城里回来的农夫……别笑。',
      4: '你的委托完成得很漂亮。以后报酬给你多加两成。',
      5: '这副眼镜陪我写完了第一本小说。现在换你用吧，看东西会更清楚。',
    },
    perks: [{ hearts: 4, text: '委托金币 +25%' }, { hearts: 5, text: '获得饰品「学者眼镜」' }],
  },
  owl: {
    name: '咕咕', title: '猫头鹰', role: 'owl',
    schedule: [[6, 34, 14]],
    loves: ['wing', 'bone', 'hazelnut'], likes: ['claw', 'gel', 'shell'], dislikes: ['berry', 'pepper'],
    lines: [],
    heartEvents: {
      3: '咕。你还挺有意思的。我告诉你个秘密：我其实……算了，下次再说。',
      5: '咕咕。这根羽毛送你。戴在身上，走路会轻快一点。咕。',
    },
    perks: [{ hearts: 5, text: '获得饰品「咕咕羽毛」' }],
  },
  kid: {
    name: '小橡', title: '镇上的孩子', role: 'kid', roam: 3,
    schedule: [[6, 50, 17], [15, 38, 26], [18, 42, 13], [20, 60, 17]],
    loves: ['wing', 'claw', 'shell', 'raspberry'], likes: ['berry', 'radish', 'melon', 'crystalFruit', 'smoothie'], dislikes: ['spore', 'yam'],
    lines: [
      '你去过矿里吗？里面有没有宝藏？',
      '我丢了个玩具在矿里……等我长大了自己去找！',
      '咕咕会说话，大人们都不信我。',
      '我长大了也要当冒险者！',
    ],
    heartEvents: {
      2: '给你看我收集的石头！……这块会发光！你要吗？不给！哈哈。',
      4: '这个送你！是我偷偷从莉娅姐姐那里拿的饮料……嘘。',
    },
    perks: [{ hearts: 4, text: '获得体力饮剂 ×3' }],
  },
} satisfies Record<string, NpcDef>;

export type NpcId = keyof typeof NPCS;
export const NPC_IDS = Object.keys(NPCS) as NpcId[];
export const npcDef = (id: NpcId): NpcDef => NPCS[id];

/** 某个时刻（游戏分钟）NPC 应该在的图块 */
export function scheduleAt(def: NpcDef, minutes: number): [number, number] {
  let cur = def.schedule[0];
  for (const e of def.schedule) if (minutes >= e[0] * 60) cur = e;
  return [cur[1], cur[2]];
}

export const OWL_TIPS = [
  '咕。J 用工具，K 攻击，L / U / O 放技能，E 互动，按住 Shift 跑步，I 打开背包，Esc 暂停。',
  '升级会学会新技能：3 级和 6 级各一个。经验靠在矿脉里打怪。',
  '东边的萤火森林、南边的草地、西南的镜湖，每天都会长出新的采集物，走过去就能捡起来。',
  '家里的灶台能做饭。料理除了回血，还会给你一种效果，比如攻击变高、跑得更快。',
  '矿脉里偶尔能找到宝箱，里面可能有饰品，甚至武器图纸。饰品最多同时戴两件。',
  '老岩那里能买新的武器图纸。同一个职业有三种武器，换着用打法完全不一样。',
  '锄地、播种、浇水。每天都要浇水，作物才会长大。下雨天不用浇。',
  '每个季节 28 天。换季时，不合季节的作物会枯死。',
  '矿脉入口在南边，过了河再往下走。每 5 层有一个守层者，它们跳起来或钻地时，盯着地上的影子跑。',
  '老岩能锻造和强化装备。木、铜、铁、金、萤石，越往后越需要 Boss 的素材。',
  '凌晨两点前回家睡觉。不然……咕，我可懒得再拖你回去。',
  '按 Q 先喝药水，没有药水就吃作物。莉娅那里能买药水。',
  '艾恩那里有委托，完成了有钱拿。',
  '每天和镇民说说话、送点礼物，好感高了他们会帮你。生日？我们这里不过生日，咕。',
  '听说打倒史莱姆王，会有一个藏起来的职业醒过来。别告诉别人是我说的，咕。',
];
