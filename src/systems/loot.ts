import type { ClassId } from '../data/classes';
import type { Gear, NewGear } from '../data/gear';
import { CHEST_GEAR_CHANCE, gearTierFor } from '../data/gear';
import type { ItemId } from '../data/items';
import type { WeaponTypeId } from '../data/weapons';
import { typesOf, weaponType } from '../data/weapons';
import type { SaveData } from '../state/save';
import { addItem, giveGear, owns } from '../state/save';
import { rollGear, unlockWeaponType } from './gear';
import { accSum } from './stats';

export interface Loot {
  gold: number;
  items: Partial<Record<ItemId, number>>;
  blueprint: WeaponTypeId | null;
  /** 宝箱里的装备，品质和阶级看楼层 */
  gear?: NewGear | null;
}

interface Table {
  gold: [number, number];
  items: { id: ItemId; n: [number, number]; w: number; from?: number }[];
  accessories: ItemId[];
}

const TABLES: { to: number; t: Table }[] = [
  {
    to: 5,
    t: {
      gold: [30, 80],
      items: [{ id: 'potion', n: [1, 2], w: 4 }, { id: 'copper', n: [3, 5], w: 4 }, { id: 'iron', n: [2, 3], w: 2, from: 3 }, { id: 'tonic', n: [1, 1], w: 2 }],
      accessories: ['copperRing', 'powerCharm', 'mossCharm', 'clover'],
    },
  },
  {
    to: 99,
    t: {
      gold: [80, 200],
      items: [{ id: 'bigPotion', n: [1, 1], w: 3 }, { id: 'iron', n: [3, 5], w: 4 }, { id: 'gold', n: [1, 3], w: 3 }, { id: 'glowstone', n: [1, 2], w: 2, from: 8 }],
      accessories: ['vampFang', 'glowPendant', 'powerCharm', 'clover'],
    },
  },
];

/** 这一层的宝箱里还能出哪些图纸 */
export function blueprintsFor(cls: ClassId, have: WeaponTypeId[], floor: number): WeaponTypeId[] {
  return typesOf(cls).filter((t) => {
    const bp = weaponType(t).blueprint;
    return !have.includes(t) && !!bp && bp.floor <= floor;
  });
}

/** 开宝箱：一定有金币和一样东西，有几率出饰品或者武器图纸，还有几率出一件装备 */
export function rollChest(s: SaveData, floor: number, rand: () => number = Math.random): Loot {
  const t = (TABLES.find((x) => floor <= x.to) ?? TABLES[TABLES.length - 1]).t;
  const r = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const loot: Loot = { gold: r(t.gold[0], t.gold[1]), items: {}, blueprint: null, gear: null };
  const pool = t.items.filter((i) => !i.from || floor >= i.from);
  const total = pool.reduce((a, i) => a + i.w, 0);
  let roll = rand() * total;
  for (const i of pool) {
    roll -= i.w;
    if (roll <= 0) {
      loot.items[i.id] = r(i.n[0], i.n[1]);
      break;
    }
  }
  const special = rand();
  if (special < 0.3) {
    const acc = t.accessories.filter((id) => !owns(s, id));
    if (acc.length) loot.items[acc[Math.floor(rand() * acc.length)]] = 1;
    else loot.gold += r(40, 90);
  } else if (special < 0.42) {
    const bps = blueprintsFor(s.cls, s.weaponTypes, floor);
    if (bps.length) loot.blueprint = bps[Math.floor(rand() * bps.length)];
    else loot.gold += r(40, 90);
  }
  if (rand() < CHEST_GEAR_CHANCE) {
    loot.gear = rollGear({ cls: s.cls, types: s.weaponTypes, tier: gearTierFor(floor), source: 'chest', luck: accSum(s, 'luck') }, rand);
  }
  return loot;
}

/** 把宝箱里的东西放进背包，返回拿到的装备（图纸送的武器也算） */
export function applyLoot(s: SaveData, loot: Loot): Gear[] {
  s.gold += loot.gold;
  for (const [id, n] of Object.entries(loot.items) as [ItemId, number][]) addItem(s, id, n);
  const got: Gear[] = [];
  if (loot.blueprint) {
    const w = unlockWeaponType(s, loot.blueprint);
    if (w) got.push(w);
  }
  if (loot.gear) got.push(giveGear(s, loot.gear));
  return got;
}

