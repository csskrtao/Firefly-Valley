import { describe, expect, it } from 'vitest';
import { DAY_START, SEASON_DAYS } from '../src/core/constants';
import { CLASS_IDS, CLASSES } from '../src/data/classes';
import { NPC_IDS } from '../src/data/npcs';
import { SAVE_VERSION, addItem, dayOfSeason, migrate, newSave, removeItem, seasonOf, yearOf } from '../src/state/save';
import { maxHp } from '../src/systems/stats';
import { clockText, dateText, nightAlpha } from '../src/systems/time';

describe('save data', () => {
  it('starts every class at full health', () => {
    for (const cls of CLASS_IDS) {
      const s = newSave(1, cls);
      expect(s.hp).toBe(maxHp(s));
      expect(s.slot).toBe(1);
      expect(s.time).toBe(DAY_START);
      expect(Object.keys(s.npcs).sort()).toEqual([...NPC_IDS].sort());
    }
    expect(CLASSES.spirit.secret).toBe(true);
  });

  it('round-trips through JSON', () => {
    const s = newSave(2, 'rogue');
    s.gold = 1234;
    s.field['4,12'] = { watered: true, crop: 'radish', days: 1 };
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
  });

  it('fills in fields missing from older saves', () => {
    const old = { version: 1, slot: 0, cls: 'mage', day: 9, gold: 50, npcs: { smith: { pts: 120 } }, weapon: { tier: 2 } };
    const s = migrate(old)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.day).toBe(9);
    expect(s.weapon).toEqual({ tier: 2, plus: 0 });
    expect(s.npcs.smith).toEqual({ pts: 120, talkDay: 0, giftDay: 0, seenHearts: 0 });
    expect(s.npcs.vera.pts).toBe(0);
    expect(s.quest.index).toBe(0);
  });

  it('moves v2 fields onto the bigger map and fills in the new progression', () => {
    const v2 = { version: 2, slot: 1, cls: 'rogue', day: 4, field: { '5,12': { watered: false, crop: 'radish', days: 2 } } };
    const s = migrate(v2)!;
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.field).toEqual({ '6,13': { watered: false, crop: 'radish', days: 2 } });
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    expect(s.weaponType).toBe('dagger');
    expect(s.weaponTypes).toEqual(['dagger']);
    expect(s.accessories).toEqual([]);
    expect(s.buff).toBeNull();
    // v3 存档的田地不再挪动
    expect(migrate(JSON.parse(JSON.stringify(s)))!.field).toEqual(s.field);
  });

  it('drops weapon types and accessories that do not belong', () => {
    const s = migrate({ version: 3, cls: 'mage', weaponType: 'axe', weaponTypes: ['axe', 'orb', 'nope'], accessories: ['copperRing', 'radish', 'clover', 'vampFang'] })!;
    expect(s.weaponTypes).toEqual(['staff', 'orb']);
    expect(s.weaponType).toBe('staff');
    expect(s.accessories).toEqual(['copperRing', 'clover']);
  });

  it('rejects garbage', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate('hello')).toBeNull();
    expect(migrate({ cls: 'necromancer' })).toBeNull();
  });

  it('removes items that reach zero', () => {
    const s = newSave(0, 'warrior');
    addItem(s, 'copper', 2);
    expect(removeItem(s, 'copper', 3)).toBe(false);
    expect(removeItem(s, 'copper', 2)).toBe(true);
    expect('copper' in s.inv).toBe(false);
  });
});

describe('calendar', () => {
  it('maps days to seasons and years', () => {
    expect(seasonOf(1)).toBe(0);
    expect(seasonOf(SEASON_DAYS + 1)).toBe(1);
    expect(dayOfSeason(SEASON_DAYS + 3)).toBe(3);
    expect(yearOf(SEASON_DAYS * 4)).toBe(1);
    expect(yearOf(SEASON_DAYS * 4 + 1)).toBe(2);
    expect(dateText(SEASON_DAYS * 4 + 2)).toBe('第2年 春 · 第2天');
  });

  it('formats the clock past midnight', () => {
    expect(clockText(6 * 60)).toBe('06:00');
    expect(clockText(25 * 60 + 37)).toBe('01:30');
  });

  it('gets darker through the evening', () => {
    expect(nightAlpha(12 * 60)).toBe(0);
    expect(nightAlpha(20 * 60)).toBeGreaterThan(nightAlpha(19 * 60));
    expect(nightAlpha(25 * 60)).toBe(nightAlpha(23 * 60));
  });
});
