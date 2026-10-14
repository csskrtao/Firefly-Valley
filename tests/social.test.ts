import { describe, expect, it } from 'vitest';
import { QUESTS } from '../src/data/quests';
import { newSave } from '../src/state/save';
import { buy, sellAll, sellableValue } from '../src/systems/economy';
import { gift, hearts, pendingHeartEvent, talk } from '../src/systems/friendship';
import * as quests from '../src/systems/quests';

describe('friendship', () => {
  it('counts talking once per day', () => {
    const s = newSave(0, 'mage');
    expect(talk(s, 'vera')).toBe(true);
    expect(talk(s, 'vera')).toBe(false);
    s.day++;
    expect(talk(s, 'vera')).toBe(true);
    expect(s.npcs.vera.pts).toBe(40);
  });

  it('reacts to gifts by preference and only once per day', () => {
    const s = newSave(0, 'mage');
    s.inv.berry = 2;
    s.inv.bone = 1;
    expect(gift(s, 'vera', 'berry')).toBe('love');
    expect(gift(s, 'vera', 'berry')).toBe('already');
    expect(s.inv.berry).toBe(1);
    s.day++;
    expect(gift(s, 'vera', 'bone')).toBe('dislike');
    expect(gift(s, 'smith', 'radish')).toBe('none');
  });

  it('plays each heart event once, in order', () => {
    const s = newSave(0, 'mage');
    s.npcs.smith.pts = 450;
    expect(hearts(s, 'smith')).toBe(4);
    expect(pendingHeartEvent(s, 'smith')?.hearts).toBe(2);
    expect(pendingHeartEvent(s, 'smith')?.hearts).toBe(4);
    expect(pendingHeartEvent(s, 'smith')).toBeNull();
  });
});

describe('quests', () => {
  it('tracks kills only after accepting', () => {
    const s = newSave(0, 'warrior');
    const q = quests.currentQuest(s)!;
    expect(q.goal.type).toBe('kill');
    quests.onKill(s, 'slime');
    expect(s.quest.progress).toBe(0);
    quests.accept(s);
    for (let i = 0; i < 20; i++) quests.onKill(s, 'slime');
    expect(quests.isComplete(s)).toBe(true);
    const gold = s.gold;
    expect(quests.turnIn(s)).toBe(q);
    expect(s.gold).toBe(gold + q.reward.gold);
    expect(s.quest).toEqual({ index: 1, active: false, progress: 0 });
  });

  it('takes collected items on turn-in', () => {
    const s = newSave(0, 'warrior');
    s.quest.index = 1;
    quests.accept(s);
    s.inv.copper = 12;
    expect(quests.isComplete(s)).toBe(true);
    quests.turnIn(s, 0.25);
    expect(s.inv.copper).toBe(2);
    expect(s.gold).toBe(200 + Math.round(QUESTS[1].reward.gold * 1.25));
  });

  it('has a reachable boss quest for every boss', () => {
    const bosses = QUESTS.filter((q) => q.goal.type === 'boss').map((q) => (q.goal.type === 'boss' ? q.goal.target : null));
    expect(bosses).toContain('slimeKing');
    expect(bosses).toContain('ironJaw');
  });
});

describe('economy', () => {
  it('buys with discounts and sells by item kind', () => {
    const s = newSave(0, 'rogue');
    s.gold = 100;
    expect(buy(s, 'radishSeed', 5, 0.2)).toBe(true);
    expect(s.inv.radishSeed).toBe(15);
    expect(buy(s, 'copper', 1)).toBe(false);
    s.inv.radish = 3;
    s.inv.copper = 2;
    const crops = sellableValue(s, ['crop']);
    expect(crops).toBeGreaterThan(0);
    const gold = s.gold;
    expect(sellAll(s, ['crop'])).toBe(crops);
    expect(s.gold).toBe(gold + crops);
    expect(s.inv.radish).toBeUndefined();
    expect(s.inv.copper).toBe(2);
  });
});
