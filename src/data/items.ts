export type ItemKind = 'seed' | 'crop' | 'forage' | 'dish' | 'ore' | 'material' | 'consumable' | 'accessory' | 'key' | 'build';

/** 料理和饰品能提供的属性 */
export type BuffStat = 'atk' | 'def' | 'speed' | 'crit' | 'regen' | 'light';
export type AccStat = 'hp' | 'def' | 'atk' | 'speed' | 'crit' | 'lifesteal' | 'luck' | 'xp' | 'regen' | 'light';
export type ForageArea = 'forest' | 'meadow' | 'beach';
export type Glyph = 'plant' | 'shell' | 'mushroom' | 'nut' | 'crystal' | 'flower' | 'log';

/** 效果的说明文字 */
export const BUFF_TEXT: Record<BuffStat, (v: number) => string> = {
  atk: (v) => `攻击 +${Math.round(v * 100)}%`,
  def: (v) => `防御 +${v}`,
  speed: (v) => `移速 +${Math.round(v * 100)}%`,
  crit: (v) => `暴击 +${Math.round(v * 100)}%`,
  regen: (v) => `每秒回复 ${v} 生命`,
  light: (v) => `视野 +${Math.round(v * 100)}%`,
};


export interface ItemDef {
  name: string;
  kind: ItemKind;
  desc: string;
  /** 图标主色 */
  color: string;
  /** 商店售价 */
  buy?: number;
  /** 卖出价格，0 或缺省表示不能卖 */
  sell?: number;
  heal?: number;
  energy?: number;
  /** 采集物：出现的季节和区域，地上画成什么样子 */
  seasons?: number[];
  areas?: ForageArea[];
  glyph?: Glyph;
  /** 料理附带的效果，持续 minutes 游戏分钟 */
  buff?: { stat: BuffStat; value: number; minutes: number };
  /** 饰品的属性 */
  acc?: Partial<Record<AccStat, number>>;
  /** 建材里能摆到农场上的东西，对应 data/buildings.ts 里的建筑 id */
  place?: string;
}

export const ITEMS = {
  // 种子
  radishSeed: { name: '萝卜种子', kind: 'seed', desc: '春季作物，2 天成熟。', color: '#e05a7a', buy: 20 },
  berrySeed: { name: '光莓种子', kind: 'seed', desc: '春季作物，3 天成熟，之后每 2 天可再收获。', color: '#62f0d6', buy: 45 },
  pepperSeed: { name: '火椒种子', kind: 'seed', desc: '夏季作物，3 天成熟，之后每 2 天可再收获。', color: '#e8503a', buy: 40 },
  melonSeed: { name: '星瓜种子', kind: 'seed', desc: '夏季作物，6 天成熟，价格很高。', color: '#ffd34d', buy: 80 },
  yamSeed: { name: '铁根薯种子', kind: 'seed', desc: '秋季作物，4 天成熟，吃了很顶饱。', color: '#9a7a5a', buy: 50 },
  pumpkinSeed: { name: '月南瓜种子', kind: 'seed', desc: '秋季作物，7 天成熟，镇民最爱的礼物。', color: '#f0a040', buy: 100 },
  // 作物
  radish: { name: '萝卜', kind: 'crop', desc: '水灵的萝卜。吃下回复体力。', color: '#e05a7a', sell: 60, heal: 12, energy: 20 },
  berry: { name: '光莓', kind: 'crop', desc: '夜里会发光的浆果。', color: '#62f0d6', sell: 130, heal: 28, energy: 10 },
  pepper: { name: '火椒', kind: 'crop', desc: '辣得冒烟。', color: '#e8503a', sell: 110, heal: 10, energy: 25 },
  melon: { name: '星瓜', kind: 'crop', desc: '瓜皮上有星星一样的斑点。', color: '#ffd34d', sell: 260, heal: 40, energy: 30 },
  yam: { name: '铁根薯', kind: 'crop', desc: '硬得像铁，煮熟了很香。', color: '#9a7a5a', sell: 150, heal: 20, energy: 40 },
  pumpkin: { name: '月南瓜', kind: 'crop', desc: '圆得像满月。', color: '#f0a040', sell: 380, heal: 50, energy: 50 },
  egg: { name: '鸡蛋', kind: 'crop', desc: '鸡舍里捡的新鲜鸡蛋，做菜用得上。', color: '#f4ead0', sell: 45, heal: 10, energy: 15 },
  // 采集物
  leek: { name: '野葱', kind: 'forage', desc: '春天草地上的野葱，闻起来很冲。', color: '#9fd86a', sell: 30, heal: 8, energy: 15, seasons: [0], areas: ['meadow'], glyph: 'plant' },
  dandelion: { name: '蒲公英', kind: 'forage', desc: '可以泡茶，也可以许愿。', color: '#ffe066', sell: 25, heal: 5, energy: 10, seasons: [0, 1], areas: ['meadow', 'forest'], glyph: 'flower' },
  morel: { name: '羊肚菌', kind: 'forage', desc: '春天森林里才有的珍贵蘑菇。', color: '#b8865a', sell: 70, heal: 15, energy: 10, seasons: [0], areas: ['forest'], glyph: 'mushroom' },
  raspberry: { name: '野树莓', kind: 'forage', desc: '酸酸甜甜，小橡最爱。', color: '#e04a6a', sell: 35, heal: 12, energy: 12, seasons: [1], areas: ['meadow', 'forest'], glyph: 'plant' },
  fireflower: { name: '萤火花', kind: 'forage', desc: '夏夜森林里会发光的花。', color: '#c8ff7a', sell: 90, energy: 20, seasons: [1], areas: ['forest'], glyph: 'flower' },
  shell: { name: '贝壳', kind: 'forage', desc: '镜湖沙滩上的贝壳，很漂亮。', color: '#f4d0c0', sell: 40, seasons: [0, 1, 2, 3], areas: ['beach'], glyph: 'shell' },
  mushroom: { name: '林菇', kind: 'forage', desc: '秋天森林里长满了这种蘑菇。', color: '#c9603a', sell: 55, heal: 15, energy: 15, seasons: [2], areas: ['forest'], glyph: 'mushroom' },
  hazelnut: { name: '榛子', kind: 'forage', desc: '秋天从树上掉下来的坚果。', color: '#a8783a', sell: 45, heal: 5, energy: 20, seasons: [2], areas: ['forest', 'meadow'], glyph: 'nut' },
  winterRoot: { name: '冬根', kind: 'forage', desc: '埋在雪下的块根，煮汤很暖和。', color: '#c8a070', sell: 50, heal: 10, energy: 25, seasons: [3], areas: ['meadow', 'forest'], glyph: 'plant' },
  crystalFruit: { name: '冰晶果', kind: 'forage', desc: '冬天森林里结的果子，透明得像冰。', color: '#9fe8ff', sell: 120, heal: 25, energy: 15, seasons: [3], areas: ['forest'], glyph: 'crystal' },
  // 料理
  salad: { name: '萝卜沙拉', kind: 'dish', desc: '清爽的沙拉。', color: '#9fd86a', sell: 110, heal: 45, energy: 45, buff: { stat: 'speed', value: 0.1, minutes: 240 } },
  morelSoup: { name: '羊肚菌汤', kind: 'dish', desc: '鲜得掉眉毛。', color: '#b8865a', sell: 180, heal: 70, energy: 30, buff: { stat: 'def', value: 3, minutes: 240 } },
  skewer: { name: '烤蘑菇串', kind: 'dish', desc: '香喷喷的林菇串。', color: '#c9603a', sell: 150, heal: 60, energy: 30, buff: { stat: 'def', value: 3, minutes: 240 } },
  pepperSoup: { name: '火椒浓汤', kind: 'dish', desc: '辣得浑身是劲。', color: '#e8503a', sell: 260, heal: 30, energy: 40, buff: { stat: 'atk', value: 0.2, minutes: 240 } },
  jam: { name: '光莓果酱', kind: 'dish', desc: '在黑暗里微微发光的果酱。', color: '#62f0d6', sell: 330, heal: 90, energy: 20, buff: { stat: 'regen', value: 1.5, minutes: 240 } },
  smoothie: { name: '星瓜冰沙', kind: 'dish', desc: '冰凉的冰沙，跑起来脚下生风。', color: '#ffd34d', sell: 450, heal: 30, energy: 90, buff: { stat: 'speed', value: 0.15, minutes: 300 } },
  pie: { name: '南瓜派', kind: 'dish', desc: '镇上人人都爱的南瓜派。', color: '#f0a040', sell: 520, heal: 120, energy: 60, buff: { stat: 'def', value: 5, minutes: 300 } },
  bar: { name: '榛子能量棒', kind: 'dish', desc: '冒险者的口粮。', color: '#a8783a', sell: 140, energy: 70, buff: { stat: 'crit', value: 0.1, minutes: 240 } },
  stew: { name: '冬根暖汤', kind: 'dish', desc: '冬天里最暖和的一碗汤。', color: '#c8a070', sell: 240, heal: 80, energy: 50, buff: { stat: 'regen', value: 2, minutes: 240 } },
  tea: { name: '萤火花茶', kind: 'dish', desc: '喝下去眼睛亮亮的，矿里也看得更清楚。', color: '#c8ff7a', sell: 160, energy: 60, buff: { stat: 'light', value: 0.5, minutes: 300 } },
  friedEgg: { name: '荷包蛋', kind: 'dish', desc: '最简单的早饭。', color: '#ffe9a0', sell: 80, heal: 35, energy: 35, buff: { stat: 'def', value: 2, minutes: 240 } },
  eggYam: { name: '铁根薯烩蛋', kind: 'dish', desc: '石屋的大灶才炖得出来，吃完浑身结实。', color: '#c9a070', sell: 280, heal: 80, energy: 60, buff: { stat: 'def', value: 5, minutes: 300 } },
  cake: { name: '光莓蛋糕', kind: 'dish', desc: '石屋的烤箱烤的蛋糕，夜里会微微发光。', color: '#9ff0e0', sell: 360, heal: 100, energy: 40, buff: { stat: 'regen', value: 2.5, minutes: 300 } },
  pudding: { name: '冰晶布丁', kind: 'dish', desc: '大宅的厨房才做得出来的点心，凉得透亮。', color: '#bff0ff', sell: 420, heal: 60, energy: 80, buff: { stat: 'crit', value: 0.18, minutes: 300 } },
  feast: { name: '丰收宴', kind: 'dish', desc: '大宅里摆满一桌的大餐，吃完能打穿一整层矿。', color: '#ffb86b', sell: 900, heal: 200, energy: 100, buff: { stat: 'atk', value: 0.3, minutes: 360 } },
  // 矿石
  copper: { name: '铜矿', kind: 'ore', desc: '苔藓矿道里常见的矿石。', color: '#e8894a', sell: 15 },
  iron: { name: '铁矿', kind: 'ore', desc: '锻造铁器的原料。', color: '#c9d4e0', sell: 30 },
  gold: { name: '金矿', kind: 'ore', desc: '沉甸甸的金矿石。', color: '#ffd34d', sell: 60 },
  glowstone: { name: '萤石', kind: 'ore', desc: '会自己发光的石头，萤石谷名字的由来。', color: '#62f0d6', sell: 120 },
  // 怪物素材
  gel: { name: '史莱姆凝胶', kind: 'material', desc: '黏糊糊的。', color: '#6fd16b', sell: 8 },
  wing: { name: '蝙蝠翅膀', kind: 'material', desc: '薄得透光。', color: '#8a64b0', sell: 12 },
  spore: { name: '蘑菇孢子', kind: 'material', desc: '别吸进去。', color: '#d9c2a0', sell: 14 },
  bone: { name: '骨头', kind: 'material', desc: '矿工骷髅留下的。', color: '#e8e4d4', sell: 18 },
  cog: { name: '锈齿轮', kind: 'material', desc: '锈蚀傀儡身上的零件。', color: '#b0703a', sell: 25 },
  claw: { name: '钻地鼠爪', kind: 'material', desc: '能挖穿岩石的爪子。', color: '#d9d2c0', sell: 22 },
  essence: { name: '萤尘', kind: 'material', desc: '分解装备得到的发光粉末。铁匠强化和提升品质要用。', color: '#b8f0ff' },
  crown: { name: '王冠凝胶', kind: 'key', desc: '史莱姆王的王冠化成的凝胶。有了它，老岩才肯把装备升成金器。', color: '#ffd34d' },
  fang: { name: '掘地者之牙', kind: 'key', desc: '铁颚掘地者的獠牙。有了它，老岩才肯把装备升成萤石器。', color: '#c9d4e0' },
  shovel: { name: '祖母的铲子', kind: 'key', desc: '祖母留下的旧铲子。对着地上闪光的地方按 E 就能挖宝。', color: '#9a8a78' },
  treasureMap: { name: '藏宝图', kind: 'key', desc: '画着埋宝地点的旧地图。在背包的收集册页能看到它指向哪里，走近了地上会出现红叉。', color: '#e8d4a0' },
  // 宝物（挖宝、藏宝图、隐藏宝箱，收集册会记下来）
  oldCoin: { name: '古铜币', kind: 'material', desc: '不知道哪个年代的铜币，上面刻着一只萤火虫。', color: '#c98a3a', sell: 40 },
  amber: { name: '琥珀', kind: 'material', desc: '里面封着一只小虫子。', color: '#f0a040', sell: 90 },
  fossil: { name: '贝壳化石', kind: 'material', desc: '很久以前这里大概是一片海。', color: '#d9d2c0', sell: 140 },
  starShard: { name: '星之碎片', kind: 'material', desc: '据说是流星落在山谷里留下的，摸起来暖暖的。', color: '#ffe680', sell: 260 },
  goldIdol: { name: '黄金小像', kind: 'material', desc: '一尊小小的金像，雕的是一只猫头鹰。咕咕看了会很得意。', color: '#ffd34d', sell: 520 },
  // 消耗品
  potion: { name: '治疗药水', kind: 'consumable', desc: '回复 60 生命。', color: '#ef5d5d', buy: 60, heal: 60 },
  bigPotion: { name: '高级药水', kind: 'consumable', desc: '回复 150 生命。', color: '#ff8fb3', buy: 160, heal: 150 },
  tonic: { name: '体力饮剂', kind: 'consumable', desc: '回复 60 体力。', color: '#86d65c', buy: 80, energy: 60 },
  // 饰品（最多同时戴两件）。拿到时会变成一件普通品质的装备
  copperRing: { name: '铜戒指', kind: 'accessory', desc: '朴素的铜戒指。', color: '#e8894a', sell: 60, acc: { def: 1, hp: 10 } },
  powerCharm: { name: '力量护符', kind: 'accessory', desc: '握紧它，手上就有使不完的劲。', color: '#e8503a', sell: 120, acc: { atk: 0.1 } },
  mossCharm: { name: '苔藓护符', kind: 'accessory', desc: '湿润的苔藓，伤口好得更快。', color: '#6fd16b', sell: 100, acc: { regen: 0.5 } },
  clover: { name: '四叶草', kind: 'accessory', desc: '据说能带来好运。挖矿和采集时更容易多得。', color: '#4caf50', sell: 150, acc: { crit: 0.08, luck: 1 } },
  vampFang: { name: '吸血獠牙', kind: 'accessory', desc: '把造成伤害的一部分变成自己的生命。', color: '#ff6b8a', sell: 200, acc: { lifesteal: 0.05 } },
  glowPendant: { name: '萤石吊坠', kind: 'accessory', desc: '发着青光的吊坠，矿里更亮。', color: '#62f0d6', sell: 240, acc: { hp: 30, light: 0.3 } },
  owlFeather: { name: '咕咕羽毛', kind: 'accessory', desc: '咕咕送的羽毛，戴上走路轻飘飘的。', color: '#c9a77a', acc: { speed: 0.1 } },
  scholarGlasses: { name: '学者眼镜', kind: 'accessory', desc: '艾恩的旧眼镜。战斗时更容易总结经验。', color: '#ffcf5a', acc: { xp: 0.25 } },
  crownRing: { name: '王冠戒指', kind: 'accessory', desc: '用史莱姆王的凝胶做的戒指。', color: '#b06bd8', sell: 260, acc: { hp: 20, atk: 0.05 } },
  jawCharm: { name: '铁颚护符', kind: 'accessory', desc: '铁颚掘地者的碎齿磨成的护符。', color: '#c9d4e0', sell: 400, acc: { atk: 0.15, def: 2 } },
  bronzeAmulet: { name: '古铜护身符', kind: 'accessory', desc: '石圈里的宝箱找到的，沉甸甸的很安心。', color: '#b0703a', sell: 220, acc: { def: 2, hp: 15 } },
  emberCharm: { name: '余烬护符', kind: 'accessory', desc: '火盆里一直没熄的火星，握着手心发热。', color: '#ff8a3a', sell: 260, acc: { atk: 0.08, light: 0.2 } },
  travelerPin: { name: '旅人别针', kind: 'accessory', desc: '绕了一大圈才拿到的别针，走远路也不累。', color: '#3f8f7a', sell: 220, acc: { speed: 0.08, regen: 0.3 } },
  compass: { name: '寻宝罗盘', kind: 'accessory', desc: '收集册的宝藏页集齐后得到的罗盘。挖宝更容易多得，也更容易挖到藏宝图。', color: '#ffcf5a', sell: 500, acc: { luck: 1, speed: 0.05 } },
  // 建材：盖房子、造设施用。木材在地上捡或者找薇拉买，石料用镐敲地上的石头或者挖矿时顺带得到，锭在熔炉里炼
  wood: { name: '木材', kind: 'build', desc: '林子和草地上捡到的木头，也可以在杂货店买。盖房子、造设施都要用。', color: '#a8743a', buy: 12, sell: 4, seasons: [0, 1, 2, 3], glyph: 'log' },
  stone: { name: '石料', kind: 'build', desc: '用镐敲碎地上的石头，或者在矿里挖矿时顺带得到。', color: '#a9a39b', sell: 3 },
  copperBar: { name: '铜锭', kind: 'build', desc: '熔炉里炼出来的铜锭。', color: '#e8894a', sell: 90 },
  ironBar: { name: '铁锭', kind: 'build', desc: '熔炉里炼出来的铁锭。', color: '#c9d4e0', sell: 180 },
  goldBar: { name: '金锭', kind: 'build', desc: '熔炉里炼出来的金锭。', color: '#ffd34d', sell: 360 },
  // 能摆到农场上的东西（工作台做出来，从家里的“家园建造”摆放）
  sprinkler: { name: '洒水器', kind: 'build', desc: '摆在田里，每天早上给上下左右 4 格浇水。', color: '#7fb0e8', place: 'sprinkler' },
  qualitySprinkler: { name: '优质洒水器', kind: 'build', desc: '摆在田里，每天早上给周围 8 格浇水。', color: '#62f0d6', place: 'qualitySprinkler' },
  fenceKit: { name: '木篱笆', kind: 'build', desc: '一段木篱笆。装饰，舒适度 +1。', color: '#c99a5a', place: 'fence' },
  flowerBed: { name: '花坛', kind: 'build', desc: '种满花的小花坛。装饰，舒适度 +2。', color: '#ff8fb3', place: 'flowerBed' },
  bench: { name: '木长椅', kind: 'build', desc: '坐着看日落。装饰，舒适度 +2。', color: '#8a6038', place: 'bench' },
  lantern: { name: '萤石灯', kind: 'build', desc: '里面嵌着萤石的灯，晚上会亮。装饰，舒适度 +3。', color: '#62f0d6', place: 'lantern' },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const itemDef = (id: ItemId): ItemDef => ITEMS[id];
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
