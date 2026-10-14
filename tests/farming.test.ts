import { describe, expect, it } from 'vitest';
import { SEASON_DAYS } from '../src/core/constants';
import { newSave } from '../src/state/save';
import { advanceDay, harvest, isRipe, plant, rollWeather, till, water } from '../src/systems/farming';

const KEY = '5,12';

describe('farming', () => {
  it('requires tilling before planting or watering', () => {
    const s = newSave(0, 'warrior');
    expect(plant(s, KEY, 'radishSeed').ok).toBe(false);
    expect(water(s, KEY).ok).toBe(false);
    expect(till(s, KEY).ok).toBe(true);
    expect(till(s, KEY).ok).toBe(false);
    expect(plant(s, KEY, 'radishSeed').ok).toBe(true);
    expect(s.inv.radishSeed).toBe(9);
    expect(plant(s, KEY, 'radishSeed').ok).toBe(false);
  });

  it('only grows crops that were watered', () => {
    const s = newSave(0, 'warrior');
    till(s, KEY);
    plant(s, KEY, 'radishSeed');
    advanceDay(s, 0.99);
    expect(s.field[KEY].days).toBe(0);
    water(s, KEY);
    advanceDay(s, 0.99);
    expect(s.field[KEY].days).toBe(1);
    expect(s.field[KEY].watered).toBe(false);
  });

  it('harvests ripe radishes and clears the tile', () => {
    const s = newSave(0, 'warrior');
    till(s, KEY);
    plant(s, KEY, 'radishSeed');
    for (let i = 0; i < 2; i++) {
      water(s, KEY);
      advanceDay(s, 0.99);
    }
    expect(isRipe(s.field[KEY])).toBe(true);
    expect(harvest(s, KEY)).toBe('radish');
    expect(s.inv.radish).toBe(1);
    expect(s.field[KEY].crop).toBeNull();
  });

  it('keeps regrowing crops after harvest', () => {
    const s = newSave(0, 'warrior');
    s.inv.berrySeed = 1;
    till(s, KEY);
    plant(s, KEY, 'berrySeed');
    s.field[KEY].days = 3;
    expect(harvest(s, KEY)).toBe('berry');
    expect(s.field[KEY].crop).toBe('berry');
    expect(isRipe(s.field[KEY])).toBe(false);
    expect(s.field[KEY].days).toBe(1);
  });

  it('refuses out-of-season seeds', () => {
    const s = newSave(0, 'warrior');
    s.inv.melonSeed = 3;
    till(s, KEY);
    const r = plant(s, KEY, 'melonSeed');
    expect(r.ok).toBe(false);
    expect(s.inv.melonSeed).toBe(3);
  });

  it('withers crops that do not survive the season change', () => {
    const s = newSave(0, 'warrior');
    s.day = SEASON_DAYS;
    till(s, KEY);
    plant(s, KEY, 'radishSeed');
    const withered = advanceDay(s, 0.99);
    expect(withered).toBe(1);
    expect(s.field[KEY].crop).toBeNull();
  });

  it('waters every tile on rainy days', () => {
    const s = newSave(0, 'warrior');
    till(s, KEY);
    advanceDay(s, 0);
    expect(s.weather).toBe('rain');
    expect(s.field[KEY].watered).toBe(true);
  });

  it('never rains on day one and only snows in winter', () => {
    expect(rollWeather(1, 0)).toBe('sunny');
    expect(rollWeather(2, 0)).toBe('rain');
    expect(rollWeather(SEASON_DAYS * 3 + 1, 0)).toBe('snow');
  });
});
