import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../src/data/classes';
import { ITEMS, ITEM_IDS, itemDef } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { SKILLS } from '../src/data/skills';
import { WEAPON_TYPES, defaultType, typesOf, weaponType } from '../src/data/weapons';
import { count, newSave, owns } from '../src/state/save';
import { applyDishBuff, canCook, cook } from '../src/systems/cooking';
import { FORAGE_CAP, forageFor, pickForage, spawnForage } from '../src/systems/forage';
import { MAX_LEVEL, gainXp, xpToNext } from '../src/systems/level';
import { equip, unlockWeaponType } from '../src/systems/gear';
import { applyLoot, blueprintsFor, rollChest } from '../src/systems/loot';
import { attack, maxHp } from '../src/systems/stats';

/** 固定种子的伪随机数，保证测试可复现 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('weapons and skills', () => {
  it('gives every class three weapon types and three skills', () => {
    for (const cls of CLASS_IDS) {
      const types = typesOf(cls);
      expect(types).toHaveLength(3);
      // 第一种是开局自带的，后两种要靠图纸
      expect(weaponType(types[0]).blueprint).toBeUndefined();
      for (const t of types.slice(1)) expect(weaponType(t).blueprint).toBeDefined();
      for (const t of types) expect(weaponType(t).tiers.length).toBeGreaterThanOrEqual(5);
      const skills = SKILLS[cls];
      expect(skills.map((k) => k.level)).toEqual([1, 3, 6]);
      expect(new Set(skills.map((k) => k.id)).size).toBe(3);
    }
    expect(Object.keys(WEAPON_TYPES)).toHaveLength(12);
  });

  it('changes attack with the weapon type', () => {
    const s = newSave(0, 'warrior');
    const sword = attack(s);
    const axe = unlockWeaponType(s, 'axe')!;
    equip(s, axe.id);
    expect(attack(s)).toBeGreaterThan(sword);
    equip(s, s.gear.find((g) => g.wt === defaultType('warrior'))!.id);
    expect(attack(s)).toBe(sword);
  });
});

describe('levels', () => {
  it('needs more experience for every level', () => {
    for (let l = 1; l < MAX_LEVEL; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('carries leftover experience and stops at the cap', () => {
    const s = newSave(0, 'mage');
    const hp1 = maxHp(s);
    expect(gainXp(s, xpToNext(1) + 5)).toBe(1);
    expect(s.level).toBe(2);
    expect(s.xp).toBe(5);
    expect(maxHp(s)).toBeGreaterThan(hp1);
    expect(gainXp(s, 1e9)).toBe(MAX_LEVEL - 2);
    expect(s.level).toBe(MAX_LEVEL);
    expect(s.xp).toBe(0);
    expect(gainXp(s, 100)).toBe(0);
  });
});

describe('foraging', () => {
  const spots = {
    forest: Array.from({ length: 30 }, (_, i) => [i, 0] as [number, number]),
    meadow: Array.from({ length: 20 }, (_, i) => [i, 1] as [number, number]),
    beach: Array.from({ length: 10 }, (_, i) => [i, 2] as [number, number]),
  };

  it('has something to find in every season', () => {
    for (let season = 0; season < 4; season++) expect(forageFor('forest', season).length).toBeGreaterThan(0);
  });

  it('only grows in-season items on the given spots, up to the cap', () => {
    const s = newSave(0, 'rogue');
    const rand = mulberry32(7);
    for (let day = 1; day <= 12; day++) {
      s.day = day;
      spawnForage(s, spots, rand);
    }
    const all = new Set(Object.values(spots).flat().map(([x, y]) => `${x},${y}`));
    for (const [k, id] of Object.entries(s.forage)) {
      expect(all.has(k)).toBe(true);
      expect(itemDef(id).seasons).toContain(0);
    }
    for (const area of ['forest', 'meadow', 'beach'] as const) {
      const keys = new Set(spots[area].map(([x, y]) => `${x},${y}`));
      expect(Object.keys(s.forage).filter((k) => keys.has(k)).length).toBeLessThanOrEqual(FORAGE_CAP[area]);
    }
    expect(s.forageDay).toBe(12);
  });

  it('clears out-of-season items when the season changes', () => {
    const s = newSave(0, 'rogue');
    s.forage['0,0'] = 'leek';
    s.day = 29; // 夏天第一天
    spawnForage(s, spots, mulberry32(3));
    expect(s.forage['0,0']).not.toBe('leek');
  });

  it('picks items up into the bag', () => {
    const s = newSave(0, 'rogue');
    s.forage['3,4'] = 'morel';
    expect(pickForage(s, '3,4', true)).toEqual({ id: 'morel', n: 2 });
    expect(count(s, 'morel')).toBe(2);
    expect(s.forage['3,4']).toBeUndefined();
    expect(pickForage(s, '3,4')).toBeNull();
  });
});

describe('cooking', () => {
  it('only uses ingredients that exist', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.dish].kind).toBe('dish');
      expect(itemDef(r.dish).buff).toBeDefined();
      for (const id of Object.keys(r.needs)) expect(ITEM_IDS).toContain(id);
    }
  });

  it('turns ingredients into a dish whose buff lasts a while', () => {
    const s = newSave(0, 'warrior');
    const salad = RECIPES.find((r) => r.dish === 'salad')!;
    expect(canCook(s, salad)).toBe(false);
    expect(cook(s, salad)).toBe(false);
    s.inv.radish = 1;
    s.inv.leek = 1;
    expect(cook(s, salad)).toBe(true);
    expect(count(s, 'radish')).toBe(0);
    expect(count(s, 'leek')).toBe(0);
    expect(count(s, 'salad')).toBe(1);
    expect(applyDishBuff(s, 'salad')).toBe(true);
    expect(s.buff?.from).toBe('salad');
    expect(s.buff!.until).toBeGreaterThan(s.time);
    expect(applyDishBuff(s, 'radish')).toBe(false);
  });
});

describe('chests', () => {
  it('always gives gold and never repeats an accessory or blueprint you have', () => {
    for (const cls of CLASS_IDS) {
      const s = newSave(0, cls);
      const rand = mulberry32(11);
      for (let i = 0; i < 300; i++) {
        const floor = 1 + (i % 19);
        const loot = rollChest(s, floor, rand);
        expect(loot.gold).toBeGreaterThan(0);
        for (const id of Object.keys(loot.items) as (keyof typeof ITEMS)[]) {
          if (ITEMS[id].kind === 'accessory') expect(owns(s, id)).toBe(false);
        }
        if (loot.blueprint) {
          expect(typesOf(cls)).toContain(loot.blueprint);
          expect(s.weaponTypes).not.toContain(loot.blueprint);
          expect(weaponType(loot.blueprint).blueprint!.floor).toBeLessThanOrEqual(floor);
        }
        applyLoot(s, loot);
      }
      // 300 个宝箱之后，这个职业的图纸都该拿全了
      expect(blueprintsFor(cls, s.weaponTypes, 99)).toEqual([]);
      expect(new Set(s.weaponTypes).size).toBe(s.weaponTypes.length);
    }
  });
});
