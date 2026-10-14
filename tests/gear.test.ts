import { describe, expect, it } from 'vitest';
import { MAX_PLUS } from '../src/data/equipment';
import type { NewGear } from '../src/data/gear';
import { ESSENCE, MAX_GEAR_TIER, MAX_QUALITY, QUALITIES, gearStats, gearTierFor } from '../src/data/gear';
import { BAG_START, STACK, addItem, bagUsed, count, giveGear, newSave, owns } from '../src/state/save';
import { canAfford, successRate } from '../src/systems/forge';
import {
  bagCells, bossDrops, enhanceGear, equip, equipped, expandBag, rollGear, salvage, salvageUpTo, sortBag, storeGear, storeItem, storeMaterials,
  takeGear, takeItem, tierUp, tierUpCost, unequip, unlockWeaponType, upgradeQuality, weaponOf,
} from '../src/systems/gear';
import { accSum, attack, compareEquip, critChance, defense, maxHp } from '../src/systems/stats';

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

const helm = (q = 0, tier = 0): NewGear => ({ slot: 'head', tier, q, plus: 0, affixes: [] });

describe('gear instances', () => {
  it('starts with a white weapon and clothes on', () => {
    const s = newSave(0, 'mage');
    expect(weaponOf(s)).toMatchObject({ slot: 'weapon', wt: 'staff', tier: 0, q: 0, plus: 0 });
    expect(equipped(s, 'body')).toMatchObject({ slot: 'body', tier: 0 });
    expect(equipped(s, 'head')).toBeUndefined();
    expect(bagUsed(s)).toBe(2); // 萝卜种子和药水
  });

  it('adds up stats from every equipped piece', () => {
    const s = newSave(0, 'warrior');
    const hp = maxHp(s);
    const def = defense(s);
    const crit = critChance(s);
    const g = giveGear(s, { ...helm(2, 2), affixes: [{ k: 'hp', v: 10 }, { k: 'crit', v: 0.05 }] });
    expect(equip(s, g.id)).toBe(true);
    const st = gearStats(g);
    expect(maxHp(s)).toBe(hp + st.hp + 10);
    expect(defense(s)).toBe(def + st.def);
    expect(critChance(s)).toBeCloseTo(crit + 0.05, 5);
    expect(unequip(s, 'head')).toBe('ok');
    expect(maxHp(s)).toBe(hp);
  });

  it('makes higher qualities stronger', () => {
    for (let q = 1; q <= MAX_QUALITY; q++) {
      expect(QUALITIES[q].mul).toBeGreaterThan(QUALITIES[q - 1].mul);
      expect(QUALITIES[q].affixes).toBe(q);
    }
    const s = newSave(0, 'warrior');
    const base = attack(s);
    weaponOf(s).q = 4;
    expect(attack(s)).toBeGreaterThan(base);
  });

  it('switches weapon type by equipping another weapon', () => {
    const s = newSave(0, 'warrior');
    const sword = attack(s);
    const axe = giveGear(s, { slot: 'weapon', wt: 'axe', tier: 0, q: 0, plus: 0, affixes: [] });
    expect(equip(s, axe.id)).toBe(false); // 还没有图纸
    s.weaponTypes.push('axe');
    expect(equip(s, axe.id)).toBe(true);
    expect(s.weaponType).toBe('axe');
    expect(attack(s)).toBeGreaterThan(sword);
    expect(unequip(s, 'weapon')).toBe('weapon');
  });

  it('fills empty accessory slots first, then replaces the first', () => {
    const s = newSave(0, 'rogue');
    addItem(s, 'powerCharm');
    addItem(s, 'vampFang');
    addItem(s, 'clover');
    expect(count(s, 'powerCharm')).toBe(0);
    expect(owns(s, 'powerCharm')).toBe(true);
    const [a, b, c] = s.gear.filter((g) => g.slot === 'acc');
    equip(s, a.id);
    equip(s, b.id);
    expect(accSum(s, 'atk')).toBeCloseTo(0.1);
    expect(accSum(s, 'lifesteal')).toBeCloseTo(0.05);
    equip(s, c.id);
    expect(s.equip.acc1).toBe(c.id);
    expect(s.equip.acc2).toBe(b.id);
    expect(accSum(s, 'atk')).toBe(0);
  });

  it('compares against what you wear', () => {
    const s = newSave(0, 'warrior');
    const better = giveGear(s, { slot: 'weapon', wt: 'sword', tier: 2, q: 1, plus: 0, affixes: [] });
    const lines = compareEquip(s, better, 'weapon');
    const atk = lines.find((l) => l.label === '攻击力')!;
    expect(atk.next).toBeGreaterThan(atk.cur);
    expect(equipped(s, 'weapon')!.id).not.toBe(better.id);
  });
});

describe('drops', () => {
  it('rolls affixes by quality, without repeats, from the right pool', () => {
    const rand = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const g = rollGear({ cls: 'mage', types: ['staff', 'orb'], tier: gearTierFor(i % 11), source: 'chest' }, rand);
      expect(g.affixes).toHaveLength(QUALITIES[g.q].affixes);
      expect(new Set(g.affixes.map((a) => a.k)).size).toBe(g.affixes.length);
      expect(g.tier).toBeLessThanOrEqual(MAX_GEAR_TIER);
      if (g.slot === 'weapon') expect(['staff', 'orb']).toContain(g.wt);
      if (g.slot === 'acc') expect(g.acc).toBeDefined();
      for (const a of g.affixes) expect(a.v).toBeGreaterThan(0);
    }
  });

  it('bosses always drop rare or better', () => {
    const rand = mulberry32(9);
    for (let i = 0; i < 200; i++) {
      const [g, extra] = bossDrops({ cls: 'warrior', types: ['sword'], tier: 2 }, i % 2 === 0, rand);
      expect(g.q).toBeGreaterThanOrEqual(2);
      expect(!!extra).toBe(i % 2 === 0);
    }
  });

  it('gets deeper gear on deeper floors', () => {
    expect(gearTierFor(0)).toBe(0);
    expect(gearTierFor(5)).toBeGreaterThan(gearTierFor(1));
    expect(gearTierFor(10)).toBeGreaterThan(gearTierFor(5));
    expect(gearTierFor(99)).toBeLessThanOrEqual(MAX_GEAR_TIER);
  });
});

describe('bag and stash', () => {
  it('stacks items and counts each piece of gear as one slot', () => {
    const s = newSave(0, 'warrior');
    s.inv = {};
    addItem(s, 'copper', STACK + 1);
    expect(bagUsed(s)).toBe(2);
    addItem(s, 'crown'); // 重要物品不占格子
    expect(bagUsed(s)).toBe(2);
    giveGear(s, helm());
    expect(bagUsed(s)).toBe(3);
    expect(bagCells(s).filter((c) => c.kind === 'item' && c.id === 'copper').map((c) => c.kind === 'item' && c.n)).toEqual([STACK, 1]);
  });

  it('sends overflow home instead of losing it', () => {
    const s = newSave(0, 'warrior');
    s.inv = {};
    for (let i = 0; i < BAG_START - 1; i++) giveGear(s, helm());
    addItem(s, 'copper', STACK + 5);
    expect(count(s, 'copper')).toBe(STACK);
    expect(s.stash.items.copper).toBe(5);
    const g = giveGear(s, helm());
    expect(s.stash.gear).toContain(g.id);
    expect(s.mailed).toBe(2);
    expect(bagUsed(s)).toBe(BAG_START);
    expect(unequip(s, 'body')).toBe('full');
  });

  it('moves things between the bag and the stash', () => {
    const s = newSave(0, 'warrior');
    addItem(s, 'gel', 7);
    const g = giveGear(s, helm());
    expect(storeItem(s, 'gel')).toBe(7);
    expect(count(s, 'gel')).toBe(0);
    expect(storeGear(s, g.id)).toBe(true);
    expect(equip(s, g.id)).toBe(false); // 在箱子里穿不了
    expect(storeGear(s, s.equip.weapon)).toBe(false);
    expect(takeItem(s, 'gel', 3)).toBe(3);
    expect(s.stash.items.gel).toBe(4);
    expect(takeGear(s, g.id)).toBe(true);
    addItem(s, 'copper', 4);
    s.seed = 'radishSeed';
    storeMaterials(s);
    expect(count(s, 'copper')).toBe(0);
    expect(count(s, 'radishSeed')).toBe(10);
  });

  it('sorts and expands the bag', () => {
    const s = newSave(0, 'warrior');
    giveGear(s, helm(0));
    giveGear(s, helm(3));
    addItem(s, 'copper');
    sortBag(s);
    const gears = bagCells(s).filter((c) => c.kind === 'gear');
    expect(gears[0].kind === 'gear' && gears[0].g.q).toBe(3);
    expect(Object.keys(s.inv)[0]).toBe('potion');
    expect(expandBag(s)).toBe(false);
    s.gold = 100_000;
    expect(expandBag(s)).toBe(true);
    expect(s.bagSize).toBe(BAG_START + 6);
    while (expandBag(s));
    expect(s.bagSize).toBe(48);
  });
});

describe('blacksmith', () => {
  it('salvages gear into essence, but not what you wear', () => {
    const s = newSave(0, 'warrior');
    const g = giveGear(s, helm(2, 1));
    expect(salvage(s, s.equip.weapon)).toBe(0);
    const n = salvage(s, g.id);
    expect(n).toBe(QUALITIES[2].salvage + 1);
    expect(count(s, ESSENCE)).toBe(n);
    expect(s.gear.some((x) => x.id === g.id)).toBe(false);
    giveGear(s, helm(0));
    giveGear(s, helm(1));
    giveGear(s, helm(2));
    expect(salvageUpTo(s, 1).count).toBe(2);
  });

  it('never loses levels when enhancing fails', () => {
    const s = newSave(0, 'warrior');
    const w = weaponOf(s);
    w.plus = 3;
    s.gold = 10_000;
    s.inv.copper = 50;
    expect(enhanceGear(s, w.id, 0, 0.99)).toBe('cost'); // +3 以后要萤尘
    s.inv[ESSENCE] = 10;
    const atk = attack(s);
    expect(enhanceGear(s, w.id, 0, 0.99)).toBe('fail');
    expect(w.plus).toBe(3);
    expect(enhanceGear(s, w.id, 0, 0)).toBe('success');
    expect(w.plus).toBe(4);
    expect(attack(s)).toBeGreaterThan(atk);
    w.plus = MAX_PLUS;
    expect(enhanceGear(s, w.id)).toBe('max');
  });

  it('raises quality and adds an affix', () => {
    const s = newSave(0, 'warrior');
    const g = equipped(s, 'body')!;
    expect(upgradeQuality(s, g.id)).toBe('cost');
    s.gold = 100_000;
    s.inv[ESSENCE] = 500;
    s.inv.glowstone = 3;
    const hp = maxHp(s);
    for (let q = 1; q <= MAX_QUALITY; q++) {
      expect(upgradeQuality(s, g.id, mulberry32(q))).toBe('ok');
      expect(g.q).toBe(q);
      expect(g.affixes).toHaveLength(q);
    }
    expect(upgradeQuality(s, g.id)).toBe('max');
    expect(maxHp(s)).toBeGreaterThanOrEqual(hp);
    expect(count(s, 'glowstone')).toBe(0);
  });

  it('upgrades the material tier, keeping quality and plus, gated by bosses', () => {
    const s = newSave(0, 'warrior');
    const w = weaponOf(s);
    w.q = 2;
    w.plus = 4;
    s.gold = 100_000;
    s.inv = { copper: 99, iron: 99, gold: 99, glowstone: 99, gel: 99, cog: 99, bone: 99 };
    expect(tierUp(s, w.id)).toBe('ok');
    expect(tierUp(s, w.id)).toBe('ok');
    expect(w).toMatchObject({ tier: 2, q: 2, plus: 4 });
    expect(tierUp(s, w.id)).toBe('need');
    s.inv.crown = 1;
    expect(tierUp(s, w.id)).toBe('ok');
    expect(count(s, 'crown')).toBe(1); // 只要有，不会被用掉
    s.inv.fang = 1;
    expect(tierUp(s, w.id)).toBe('ok');
    expect(tierUpCost(w)).toBeNull();
    expect(tierUp(s, w.id)).toBe('max');
  });

  it('applies the gold discount but not to materials', () => {
    const s = newSave(0, 'warrior');
    s.gold = 80;
    s.inv.copper = 5;
    const cost = tierUpCost(weaponOf(s))!;
    expect(canAfford(s, cost)).toBe(false);
    expect(canAfford(s, cost, 0.2)).toBe(true);
    expect(tierUp(s, weaponOf(s).id, 0.2)).toBe('ok');
    expect(s.gold).toBe(0);
  });

  it('gives a weapon with each new blueprint', () => {
    const s = newSave(0, 'rogue');
    weaponOf(s).tier = 2;
    const w = unlockWeaponType(s, 'twin')!;
    expect(w).toMatchObject({ wt: 'twin', tier: 2, q: 0 });
    expect(unlockWeaponType(s, 'twin')).toBeNull();
    expect(equip(s, w.id)).toBe(true);
  });

  it('caps the success rate', () => {
    expect(successRate(0)).toBe(1);
    expect(successRate(9, 0.1)).toBeCloseTo(0.35);
    expect(successRate(0, 0.5)).toBe(1);
  });
});
