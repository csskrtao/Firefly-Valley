import { describe, expect, it } from 'vitest';
import { MAX_PLUS, MAX_TIER } from '../src/data/equipment';
import { newSave } from '../src/state/save';
import { canAfford, enhance, forge, nextForgeCost, successRate } from '../src/systems/forge';
import { attack, defense, maxHp } from '../src/systems/stats';

describe('forge', () => {
  it('upgrades a weapon tier and resets its enhancement', () => {
    const s = newSave(0, 'warrior');
    s.weapon.plus = 3;
    expect(forge(s, 'weapon')).toBe('cost');
    s.gold = 1000;
    s.inv.copper = 5;
    expect(forge(s, 'weapon')).toBe('ok');
    expect(s.weapon).toEqual({ tier: 1, plus: 0 });
    expect(s.gold).toBe(900);
    expect(s.inv.copper).toBeUndefined();
    expect(attack(s)).toBeGreaterThan(attack(newSave(0, 'warrior')));
  });

  it('applies the gold discount but not to materials', () => {
    const s = newSave(0, 'warrior');
    s.gold = 80;
    s.inv.copper = 5;
    const cost = nextForgeCost(s, 'weapon')!;
    expect(canAfford(s, cost)).toBe(false);
    expect(canAfford(s, cost, 0.2)).toBe(true);
    expect(forge(s, 'weapon', 0.2)).toBe('ok');
    expect(s.gold).toBe(0);
  });

  it('stops at the highest tier', () => {
    const s = newSave(0, 'warrior');
    s.weapon.tier = MAX_TIER;
    expect(nextForgeCost(s, 'weapon')).toBeNull();
    expect(forge(s, 'weapon')).toBe('max');
  });

  it('never loses levels when enhancing fails', () => {
    const s = newSave(0, 'warrior');
    s.armor.plus = 3;
    s.gold = 10_000;
    s.inv.copper = 50;
    const hp = maxHp(s);
    expect(enhance(s, 'armor', 0, 0.99)).toBe('fail');
    expect(s.armor.plus).toBe(3);
    expect(enhance(s, 'armor', 0, 0)).toBe('success');
    expect(s.armor.plus).toBe(4);
    expect(maxHp(s)).toBeGreaterThan(hp);
    expect(defense(s)).toBeGreaterThan(0);
  });

  it('caps enhancement and success rate', () => {
    const s = newSave(0, 'rogue');
    s.weapon.plus = MAX_PLUS;
    expect(enhance(s, 'weapon')).toBe('max');
    expect(successRate(0)).toBe(1);
    expect(successRate(9, 0.1)).toBeCloseTo(0.35);
    expect(successRate(0, 0.5)).toBe(1);
  });
});
