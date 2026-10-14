import type { CropId } from './crops';
import type { ItemId } from './items';

/** 金币加材料的花费（家园这边自己一份，不依赖铁匠的数据） */
export interface HomeCost {
  gold?: number;
  items: Partial<Record<ItemId, number>>;
}

/* ---------- 房子 ---------- */

export interface HouseDef {
  name: string;
  desc: string;
  /** 升到这一级的花费，第 0 级没有 */
  cost?: HomeCost;
  wall: string;
  roof: string;
  /** 房子占几格宽（高度不变，门的位置不变） */
  w: number;
  /** 仓库箱的格子数，给背包和仓库那条线用 */
  storage: number;
  /** 熬过半夜才睡时，第二天早上恢复的体力 */
  lateEnergy: number;
  /** 房子本身提供的舒适度 */
  comfort: number;
}

export const HOUSES: HouseDef[] = [
  {
    name: '木屋', desc: '祖母留下的旧木屋。', wall: '#e3c9a0', roof: '#b84a3a', w: 6, storage: 24, lateEnergy: 70, comfort: 0,
  },
  {
    name: '石屋', desc: '石墙加厚，灶台换成大灶，能做更多菜。熬夜后恢复更多体力，仓库更大。',
    cost: { gold: 2000, items: { wood: 30, stone: 40, copperBar: 5 } },
    wall: '#bdb4a6', roof: '#4f6a8a', w: 6, storage: 48, lateEnergy: 85, comfort: 4,
  },
  {
    name: '大宅', desc: '加盖了东边的厢房，厨房什么菜都能做。熬夜也能睡饱，仓库最大。',
    cost: { gold: 8000, items: { wood: 60, stone: 80, ironBar: 10, goldBar: 3 } },
    wall: '#f0e4cc', roof: '#7a3a4a', w: 8, storage: 72, lateEnergy: 100, comfort: 8,
  },
];

export const MAX_HOUSE = HOUSES.length - 1;

/* ---------- 农场上能摆的东西 ---------- */

export type BuildKind = 'facility' | 'sprinkler' | 'decor';

export interface BuildDef {
  name: string;
  desc: string;
  kind: BuildKind;
  /** 占地（格） */
  w: number;
  h: number;
  /** 设施：在建造菜单里直接花材料盖，每种只能盖一座 */
  cost?: HomeCost;
  /** 需要的房子等级 */
  house?: number;
  /** 洒水器和装饰：从背包里拿这件物品摆上去，收起来时还回背包 */
  item?: ItemId;
  /** 洒水器浇水的范围（相对自己的格子） */
  reach?: [number, number][];
  comfort?: number;
}

const CROSS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RING: [number, number][] = [...CROSS, [1, 1], [1, -1], [-1, 1], [-1, -1]];

export const BUILDS = {
  workbench: {
    name: '工作台', desc: '用木材、锭和怪物素材做洒水器、装饰和药水。', kind: 'facility', w: 2, h: 1,
    cost: { items: { wood: 15, stone: 5 } },
  },
  furnace: {
    name: '熔炉', desc: '把矿石炼成锭。盖房子和做洒水器要用锭。', kind: 'facility', w: 1, h: 1,
    cost: { items: { stone: 25, copper: 10 } },
  },
  coop: {
    name: '鸡舍', desc: '养鸡的地方。每只鸡每天下一个蛋，鸡蛋能做新菜。', kind: 'facility', w: 4, h: 3,
    cost: { gold: 1500, items: { wood: 40, stone: 20, copperBar: 3 } },
  },
  greenhouse: {
    name: '温室', desc: '玻璃房里四季如春，什么季节的种子都能种，不用浇水。', kind: 'facility', w: 5, h: 4, house: 1,
    cost: { gold: 3000, items: { wood: 50, stone: 40, ironBar: 6 } },
  },
  sprinkler: { name: '洒水器', desc: '每天早上给上下左右 4 格田浇水。', kind: 'sprinkler', w: 1, h: 1, item: 'sprinkler', reach: CROSS },
  qualitySprinkler: { name: '优质洒水器', desc: '每天早上给周围 8 格田浇水。', kind: 'sprinkler', w: 1, h: 1, item: 'qualitySprinkler', reach: RING },
  fence: { name: '木篱笆', desc: '装饰。', kind: 'decor', w: 1, h: 1, item: 'fenceKit', comfort: 1 },
  flowerBed: { name: '花坛', desc: '装饰。', kind: 'decor', w: 1, h: 1, item: 'flowerBed', comfort: 2 },
  bench: { name: '木长椅', desc: '装饰。', kind: 'decor', w: 1, h: 1, item: 'bench', comfort: 2 },
  lantern: { name: '萤石灯', desc: '装饰，晚上会亮。', kind: 'decor', w: 1, h: 1, item: 'lantern', comfort: 3 },
} satisfies Record<string, BuildDef>;

export type BuildId = keyof typeof BUILDS;
export const BUILD_IDS = Object.keys(BUILDS) as BuildId[];
export const buildDef = (id: BuildId): BuildDef => BUILDS[id];
export const FACILITY_IDS = BUILD_IDS.filter((id) => BUILDS[id].kind === 'facility');

/* ---------- 工作台和熔炉的配方 ---------- */

export interface Craft {
  out: ItemId;
  n: number;
  needs: HomeCost;
}

/** 工作台。以后装备做出来以后，可以把装备配方也加在这里 */
export const WORKBENCH: Craft[] = [
  { out: 'sprinkler', n: 1, needs: { items: { copperBar: 1, stone: 5 } } },
  { out: 'qualitySprinkler', n: 1, needs: { items: { ironBar: 1, goldBar: 1, glowstone: 1 } } },
  { out: 'fenceKit', n: 4, needs: { items: { wood: 4 } } },
  { out: 'bench', n: 1, needs: { items: { wood: 10 } } },
  { out: 'flowerBed', n: 1, needs: { items: { stone: 6, wood: 2 } } },
  { out: 'lantern', n: 1, needs: { items: { ironBar: 1, glowstone: 1 } } },
  { out: 'potion', n: 1, needs: { items: { gel: 4, spore: 2 } } },
  { out: 'tonic', n: 1, needs: { items: { wing: 2, gel: 2 } } },
];

/** 熔炉：5 块矿石加木材当燃料，炼成 1 块锭 */
export const SMELT: Craft[] = [
  { out: 'copperBar', n: 1, needs: { items: { copper: 5, wood: 1 } } },
  { out: 'ironBar', n: 1, needs: { items: { iron: 5, wood: 1 } } },
  { out: 'goldBar', n: 1, needs: { items: { gold: 5, wood: 2 } } },
];

/* ---------- 鸡舍、温室、舒适度 ---------- */

export const CHICKEN_PRICE = 500;
export const MAX_CHICKENS = 4;
/** 鸡舍里最多攒几天的蛋 */
export const EGG_DAYS = 3;
export const GREENHOUSE_PLOTS = 9;

/** 舒适度达到 min 时，每天早上醒来带一个“睡得香”的回复效果，到中午为止 */
export const COMFORT_TIERS: { min: number; name: string; regen: number }[] = [
  { min: 30, name: '睡得特别香', regen: 1.5 },
  { min: 15, name: '睡得很香', regen: 1 },
  { min: 6, name: '睡得香', regen: 0.5 },
];
export const RESTED_UNTIL = 12 * 60;

/* ---------- 存档里的家园 ---------- */

export interface PlacedBuild {
  id: BuildId;
  /** 左上角的格子 */
  x: number;
  y: number;
}

export interface GreenPlot {
  crop: CropId | null;
  days: number;
}

export interface HomeState {
  /** 房子等级，0 木屋 1 石屋 2 大宅 */
  house: number;
  builds: PlacedBuild[];
  greenhouse: GreenPlot[];
  chickens: number;
  eggs: number;
  /** 今天已经敲碎的地上石头（"x,y"），第二天会重新长出来 */
  quarried: string[];
  /** 上次在地上刷木材是哪一天 */
  woodDay: number;
}

export function newHome(): HomeState {
  return {
    house: 0,
    builds: [],
    greenhouse: Array.from({ length: GREENHOUSE_PLOTS }, () => ({ crop: null, days: 0 })),
    chickens: 0,
    eggs: 0,
    quarried: [],
    woodDay: 0,
  };
}

/* ---------- 农场上能盖东西的地方（萤石镇地图上的坐标） ---------- */

export const FARM_LOT = {
  areas: [
    // 房子东边、大路北边的空地
    [11, 3, 25, 8],
    // 农场围栏东边到小路之间
    [26, 12, 29, 27],
    // 围栏里的田（只给洒水器用）
    [5, 13, 24, 26],
  ] as [number, number, number, number][],
  // 房子东边两格留给大宅扩建
  reserved: [[11, 3, 12, 7]] as [number, number, number, number][],
  home: [8, 8] as [number, number],
};
