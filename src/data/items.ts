export type ItemKind = 'seed' | 'crop' | 'ore' | 'material' | 'consumable' | 'key';

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
  crown: { name: '王冠凝胶', kind: 'key', desc: '史莱姆王的王冠化成的凝胶。打造金器要用。', color: '#ffd34d' },
  fang: { name: '掘地者之牙', kind: 'key', desc: '铁颚掘地者的獠牙。打造萤石武器要用。', color: '#c9d4e0' },
  // 消耗品
  potion: { name: '治疗药水', kind: 'consumable', desc: '回复 60 生命。', color: '#ef5d5d', buy: 60, heal: 60 },
  bigPotion: { name: '高级药水', kind: 'consumable', desc: '回复 150 生命。', color: '#ff8fb3', buy: 160, heal: 150 },
  tonic: { name: '体力饮剂', kind: 'consumable', desc: '回复 60 体力。', color: '#86d65c', buy: 80, energy: 60 },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const itemDef = (id: ItemId): ItemDef => ITEMS[id];
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
