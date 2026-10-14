import type { ItemId } from './items';
import type { MonsterId } from './monsters';

/**
 * 户外探险的数据：挖宝点、藏宝图的埋宝地点、隐藏宝箱、户外怪物、随机事件和收集册。
 * 坐标暂时都在萤石镇的地图上；世界地图做好以后再按区域拆开。
 */

/** 一个格子的坐标 */
export type Cell = [number, number];

/* ---------- 挖宝 ---------- */

/** 每天地上冒出几个闪光点 */
export const DIG_DAILY: [number, number] = [3, 5];
/** 挖一次花的体力 */
export const DIG_COST = 4;

/** 挖宝点挖出来的东西：金币一定有，再按权重出一样 */
export const DIG_TABLE: { id: ItemId | 'forage'; n: [number, number]; w: number }[] = [
  { id: 'forage', n: [1, 2], w: 3 },
  { id: 'oldCoin', n: [1, 2], w: 4 },
  { id: 'amber', n: [1, 1], w: 2 },
  { id: 'fossil', n: [1, 1], w: 1 },
  { id: 'copper', n: [2, 4], w: 3 },
  { id: 'iron', n: [1, 2], w: 2 },
  { id: 'potion', n: [1, 1], w: 1 },
];
export const DIG_GOLD: [number, number] = [10, 40];
/** 挖出藏宝图、饰品的几率 */
export const DIG_MAP_CHANCE = 0.1;
export const DIG_ACC_CHANCE = 0.04;
/** 挖宝和宝箱可能出的饰品（已经有的不会再出） */
export const TREASURE_ACCESSORIES: ItemId[] = ['copperRing', 'powerCharm', 'mossCharm', 'clover', 'vampFang', 'glowPendant'];

/** 藏宝图指向的埋宝地点，hint 是地图背面写的话 */
export const MAP_SPOTS: { at: Cell; hint: string }[] = [
  { at: [3, 46], hint: '镜湖的西南角，湖岸和悬崖碰头的地方。' },
  { at: [74, 27], hint: '萤火森林正中有三个火盆的空地，往西南角走。' },
  { at: [24, 36], hint: '镜湖东岸，沙滩边上开着花的地方。' },
  { at: [35, 39], hint: '河的北岸，木桥往西十来步的草地。' },
  { at: [54, 46], hint: '去矿脉的路往东，河南岸的草地。' },
];
/** 藏宝图的宝藏：金币多，一定有一件稀有宝物 */
export const MAP_GOLD: [number, number] = [150, 300];
export const MAP_TREASURES: ItemId[] = ['starShard', 'goldIdol', 'fossil'];

/* ---------- 隐藏宝箱 ---------- */

export type HiddenId = 'boulder' | 'brazier' | 'detour';

export interface HiddenChest {
  id: HiddenId;
  name: string;
  /** 宝箱的位置 */
  at: Cell;
  /** 第一次打开时给的东西 */
  reward: { gold: number; items: Partial<Record<ItemId, number>> };
  color: string;
}

export const HIDDEN_CHESTS: Record<HiddenId, HiddenChest> = {
  boulder: { id: 'boulder', name: '石圈里的宝箱', at: [35, 43], reward: { gold: 200, items: { bronzeAmulet: 1, amber: 1 } }, color: '#8a8f9a' },
  brazier: { id: 'brazier', name: '火盆中间的宝箱', at: [76, 24], reward: { gold: 260, items: { emberCharm: 1, starShard: 1 } }, color: '#c94a3a' },
  detour: { id: 'detour', name: '河对岸的宝箱', at: [60, 46], reward: { gold: 180, items: { travelerPin: 1, fossil: 1 } }, color: '#3f8f7a' },
};
export const HIDDEN_IDS = Object.keys(HIDDEN_CHESTS) as HiddenId[];

/**
 * 石圈：一圈树围着宝箱，唯一的口子被一块大石头堵着。
 * 从南边把石头往里推两下才能进去。origin 是左上角，rows 里 T 是树、. 是空地、B 是石头的起点。
 */
export const BOULDER_RING = {
  origin: [34, 42] as Cell,
  rows: ['TTTTT', 'T...T', 'T...T', 'T...T', 'TTBTT'],
  /** 站在这里往北推 */
  approach: [36, 47] as Cell,
};

/** 森林空地上的三个火盆，都点亮了宝箱才会出现 */
export const BRAZIERS: Cell[] = [[77, 23], [78, 25], [75, 26]];

/* ---------- 户外怪物 ---------- */

export type WildArea = 'meadow' | 'forest';

export interface WildSpawn {
  /** 白天和晚上最多同时有几只 */
  cap: { day: number; night: number };
  day: Partial<Record<MonsterId, number>>;
  night: Partial<Record<MonsterId, number>>;
  /** 按第几层矿脉的强度算 */
  floor: { day: number; night: number };
}

export const WILD: Record<WildArea, WildSpawn> = {
  meadow: { cap: { day: 2, night: 4 }, day: { slime: 1 }, night: { slime: 2, bat: 1 }, floor: { day: 1, night: 2 } },
  forest: { cap: { day: 2, night: 5 }, day: { slime: 1, mushroom: 1 }, night: { bat: 2, mushroom: 1, skeleton: 1 }, floor: { day: 2, night: 3 } },
};
/** 草地上的怪只在镜湖和小镇以南出没 */
export const MEADOW_MIN_Y = 30;
/** 离出生点太远就回去（直接消失） */
export const WILD_LEASH = 14;
/** 晚上从几点开始 */
export const NIGHT_FROM = 19 * 60;

/* ---------- 随机事件 ---------- */

export type EventKind = 'merchant' | 'traveler' | 'camp';

export const EVENT_CHANCE = 0.7;
export const EVENT_WEIGHTS: Record<EventKind, number> = { merchant: 35, traveler: 30, camp: 35 };

export const EVENT_SPOTS: Record<EventKind, { at: Cell; where: string }[]> = {
  merchant: [
    { at: [58, 15], where: '小镇广场东边' },
    { at: [28, 34], where: '镜湖东边的小路旁' },
    { at: [49, 25], where: '去矿脉的路边' },
  ],
  traveler: [
    { at: [40, 36], where: '河北岸的草地上' },
    { at: [12, 30], where: '农场南边的树林边' },
    { at: [77, 44], where: '萤火森林南边的空地' },
  ],
  camp: [
    { at: [74, 37], where: '萤火森林里的空地' },
    { at: [36, 33], where: '小镇南边的草地' },
  ],
};

/** 流浪商人卖的东西：price 是金币，once 表示每次来只卖一件 */
export const MERCHANT_STOCK: { id: ItemId | 'accessory'; price: number; once?: boolean }[] = [
  { id: 'treasureMap', price: 400, once: true },
  { id: 'bigPotion', price: 120 },
  { id: 'tonic', price: 60 },
  { id: 'accessory', price: 650, once: true },
];

/** 受伤的旅人：送他一样能回血的东西，他会回礼 */
export const TRAVELER_GOLD: [number, number] = [120, 200];
export const TRAVELER_GIFTS: ItemId[] = ['oldCoin', 'amber', 'fossil'];
export const TRAVELER_MAP_CHANCE = 0.4;

/** 精英营地：几只小怪围着一只精英，全部打倒后营火边的宝箱就能打开 */
export const CAMP = {
  minions: { slime: 1, mushroom: 1, skeleton: 1 } as Partial<Record<MonsterId, number>>,
  minionCount: 3,
  elite: ['skeleton', 'mushroom', 'golem'] as MonsterId[],
  floor: 4,
  eliteHp: 3,
  eliteAtk: 1.3,
  gold: [150, 260] as [number, number],
  /** 宝箱按这一层的矿脉宝箱来开 */
  chestFloor: 7,
  xp: 40,
};

/* ---------- 收集册 ---------- */

export type BookPage = 'treasure' | 'monster' | 'forage';

export const BOOK_PAGES: { id: BookPage; name: string; desc: string }[] = [
  { id: 'treasure', name: '宝藏', desc: '挖出来的宝物和找到的隐藏宝箱' },
  { id: 'monster', name: '怪物', desc: '打倒过的怪物、守层者和精英营地' },
  { id: 'forage', name: '采集', desc: '采到过的野生植物和贝壳' },
];

/** 宝藏页要找的宝物 */
export const BOOK_TREASURES: ItemId[] = ['oldCoin', 'amber', 'fossil', 'starShard', 'goldIdol'];

/** 收集到一半和集齐时的奖励 */
export const BOOK_REWARDS: Record<BookPage, { half: { gold: number; items: Partial<Record<ItemId, number>> }; full: { gold: number; items: Partial<Record<ItemId, number>> } }> = {
  treasure: { half: { gold: 300, items: { treasureMap: 1 } }, full: { gold: 800, items: { compass: 1 } } },
  monster: { half: { gold: 300, items: { bigPotion: 2 } }, full: { gold: 1000, items: { bigPotion: 3, glowstone: 3 } } },
  forage: { half: { gold: 200, items: { tonic: 3 } }, full: { gold: 600, items: { mossCharm: 1 } } },
};

/* ---------- 存档 ---------- */

export interface ExploreEvent {
  kind: EventKind;
  /** EVENT_SPOTS 里的下标 */
  spot: number;
  /** 0 进行中，1 营地已经打完、宝箱还没开，2 结束了 */
  stage: number;
  /** 商人这次已经卖掉的限购商品 */
  sold: string[];
}

/** 户外探险的存档，挂在 SaveData.explore 上 */
export interface ExploreState {
  /** 上次刷新挖宝点和事件是哪一天 */
  day: number;
  /** 今天还没挖的闪光点，键为 "x,y" */
  digs: string[];
  /** 当前藏宝图指向 MAP_SPOTS 的哪一个，-1 表示没有 */
  mapSpot: number;
  /** 已经打开过的隐藏宝箱 */
  opened: HiddenId[];
  /** 今天点亮的火盆（BRAZIERS 的下标） */
  lit: number[];
  event: ExploreEvent | null;
  /** 收集册：找到过的宝物、采到过的采集物 */
  found: ItemId[];
  foraged: ItemId[];
  /** 清掉的精英营地数 */
  camps: number;
  /** 已经领过的收集奖励，例如 "treasure:half" */
  claimed: string[];
}

export const newExplore = (): ExploreState => ({
  day: 0,
  digs: [],
  mapSpot: -1,
  opened: [],
  lit: [],
  event: null,
  found: [],
  foraged: [],
  camps: 0,
  claimed: [],
});
