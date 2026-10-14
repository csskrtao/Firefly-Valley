import { describe, expect, it } from 'vitest';
import { FARM_LOT, HOUSES, MAX_CHICKENS, SMELT, WORKBENCH } from '../src/data/buildings';
import { RECIPES } from '../src/data/recipes';
import { addItem, count, migrate, newSave } from '../src/state/save';
import { canCook } from '../src/systems/cooking';
import { advanceDay, till } from '../src/systems/farming';
import * as home from '../src/systems/home';
import { buildOverworld } from '../src/world/overworld';
import { Tile } from '../src/world/TileMap';

const rich = (cls: 'warrior' = 'warrior') => {
  const s = newSave(0, cls);
  s.gold = 100000;
  // 背包现在有格子上限，测试里放大一点，免得材料被送进仓库箱
  s.bagSize = 200;
  for (const id of ['wood', 'stone', 'copper', 'iron', 'gold', 'copperBar', 'ironBar', 'goldBar', 'glowstone'] as const) addItem(s, id, 200);
  return s;
};

describe('house upgrades', () => {
  it('goes wood → stone → manor and stops there', () => {
    const s = rich();
    expect(home.storageSlots(s)).toBe(s.stash.size);
    expect(home.upgradeHouse(s)).toBe('ok');
    expect(home.houseOf(s).name).toBe('石屋');
    expect(home.storageSlots(s)).toBe(72);
    expect(s.stash.size).toBe(72);
    expect(home.upgradeHouse(s)).toBe('ok');
    expect(home.houseOf(s).name).toBe('大宅');
    expect(home.upgradeHouse(s)).toBe('max');
    expect(home.lateEnergy(s)).toBe(100);
    expect(s.stash.size).toBe(96);
  });

  it('refuses without materials and takes nothing', () => {
    const s = newSave(0, 'mage');
    s.gold = 5000;
    expect(home.upgradeHouse(s)).toBe('cost');
    expect(s.gold).toBe(5000);
    expect(s.home.house).toBe(0);
  });

  it('unlocks bigger kitchen recipes', () => {
    const s = rich();
    addItem(s, 'egg', 5);
    addItem(s, 'berry', 5);
    const cake = RECIPES.find((r) => r.dish === 'cake')!;
    expect(canCook(s, cake)).toBe(false);
    home.upgradeHouse(s);
    expect(canCook(s, cake)).toBe(true);
    expect(HOUSES.every((h, i) => i === 0 || !!h.cost)).toBe(true);
  });
});

describe('placing builds', () => {
  const ow = buildOverworld();

  it('lets facilities go on the empty yard east of the house', () => {
    const s = rich();
    expect(home.placeError(ow.map, s, FARM_LOT, 'workbench', 14, 4)).toBeNull();
    expect(home.place(s, 'workbench', 14, 4)).toBe(true);
    expect(home.hasBuild(s, 'workbench')).toBe(true);
    expect(count(s, 'wood')).toBe(185);
    // 每种设施只能盖一座
    expect(home.buildBlocker(s, 'workbench')).toBe('已经盖好了');
    expect(home.buildAt(s, 15, 4)?.id).toBe('workbench');
  });

  it('keeps builds off roads, the field, the manor lot and outside the farm', () => {
    const s = rich();
    expect(home.placeError(ow.map, s, FARM_LOT, 'furnace', 14, 9)).not.toBeNull();
    expect(home.placeError(ow.map, s, FARM_LOT, 'furnace', 10, 15)).not.toBeNull();
    expect(home.placeError(ow.map, s, FARM_LOT, 'furnace', 11, 4)).toBe('这里要留空');
    expect(home.placeError(ow.map, s, FARM_LOT, 'furnace', 45, 30)).toBe('只能盖在自家农场的空地上');
  });

  it('needs a stone house before the greenhouse', () => {
    const s = rich();
    expect(home.buildBlocker(s, 'greenhouse')).toMatch('石屋');
    home.upgradeHouse(s);
    expect(home.buildBlocker(s, 'greenhouse')).toBeNull();
  });

  it('refuses spots that would wall off part of the map', () => {
    const s = rich();
    const m = ow.map.t.slice();
    const map = buildOverworld().map;
    // 用树围出一条只有南边一个出口的死胡同，堵住出口就不行，摆在里面可以
    map.fill(13, 3, 13, 8, Tile.TREE);
    map.fill(15, 3, 15, 8, Tile.TREE);
    map.fill(14, 3, 14, 3, Tile.TREE);
    expect(home.placeError(map, s, FARM_LOT, 'fence', 14, 8)).toBe('会把路堵住');
    expect(home.placeError(map, s, FARM_LOT, 'fence', 14, 4)).toBeNull();
    expect(ow.map.t).toEqual(m);
  });

  it('puts sprinklers only on empty field tiles and they water every morning', () => {
    const s = rich();
    addItem(s, 'sprinkler', 1);
    expect(home.placeError(ow.map, s, FARM_LOT, 'sprinkler', 14, 4)).toBe('洒水器要摆在田里');
    expect(home.placeError(ow.map, s, FARM_LOT, 'sprinkler', 10, 18)).toBeNull();
    home.place(s, 'sprinkler', 10, 18);
    expect(count(s, 'sprinkler')).toBe(0);
    till(s, '11,18');
    till(s, '11,19');
    advanceDay(s, 0.99);
    home.homeMorning(s);
    expect(s.field['11,18'].watered).toBe(true);
    expect(s.field['11,19'].watered).toBe(false);
    const b = home.buildAt(s, 10, 18)!;
    expect(home.pickUp(s, b)).toBe(true);
    expect(count(s, 'sprinkler')).toBe(1);
  });
});

describe('workbench, furnace, greenhouse and coop', () => {
  it('smelts ore into bars and crafts sprinklers', () => {
    const s = newSave(0, 'rogue');
    addItem(s, 'copper', 10);
    addItem(s, 'wood', 2);
    addItem(s, 'stone', 5);
    const bar = SMELT.find((c) => c.out === 'copperBar')!;
    expect(home.craft(s, bar)).toBe(true);
    expect(count(s, 'copperBar')).toBe(1);
    const spr = WORKBENCH.find((c) => c.out === 'sprinkler')!;
    expect(home.craft(s, spr)).toBe(true);
    expect(count(s, 'sprinkler')).toBe(1);
    expect(home.craft(s, spr)).toBe(false);
  });

  it('grows any season in the greenhouse without water', () => {
    const s = rich();
    home.upgradeHouse(s);
    home.place(s, 'greenhouse', 14, 4);
    s.day = 3 * 28 + 1; // 冬天
    addItem(s, 'melonSeed', 1);
    expect(home.plantGreen(s, 0, 'melonSeed')).toBe(true);
    for (let i = 0; i < 6; i++) home.homeMorning(s);
    expect(home.greenRipe(s, 0)).toBe(true);
    expect(home.harvestGreen(s, 0)).toBe('melon');
    expect(s.home.greenhouse[0].crop).toBeNull();
  });

  it('lays one egg per chicken a day, up to three days', () => {
    const s = rich();
    expect(home.buyChicken(s)).toBe(false);
    home.place(s, 'coop', 14, 4);
    for (let i = 0; i < MAX_CHICKENS + 1; i++) home.buyChicken(s);
    expect(s.home.chickens).toBe(MAX_CHICKENS);
    for (let i = 0; i < 5; i++) home.homeMorning(s);
    expect(home.collectEggs(s)).toBe(MAX_CHICKENS * 3);
    expect(count(s, 'egg')).toBe(MAX_CHICKENS * 3);
  });
});

describe('comfort and materials', () => {
  it('gives a rested regen buff once decor adds up', () => {
    const s = rich();
    home.homeMorning(s);
    expect(s.buff).toBeNull();
    addItem(s, 'lantern', 2);
    home.place(s, 'lantern', 14, 4);
    home.place(s, 'lantern', 16, 4);
    expect(home.comfort(s)).toBe(6);
    home.homeMorning(s);
    expect(s.buff?.stat).toBe('regen');
    expect(s.buff?.label).toBe('睡得香');
  });

  it('quarries each ground stone once a day', () => {
    const s = newSave(0, 'warrior');
    expect(home.quarry(s, 3, 26, () => 0.9)).toBe(2);
    expect(home.quarry(s, 3, 26)).toBe(0);
    home.homeMorning(s);
    expect(home.quarry(s, 3, 26, () => 0.1)).toBe(3);
    expect(count(s, 'stone')).toBe(5);
  });

  it('drops wood on the ground once a day', () => {
    const s = newSave(0, 'warrior');
    const ow = buildOverworld();
    const spots = [...ow.forage.forest, ...ow.forage.meadow];
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    expect(home.spawnWood(s, spots, rand)).toBeGreaterThan(0);
    expect(home.spawnWood(s, spots, rand)).toBe(0);
    expect(Object.values(s.forage)).toContain('wood');
  });

  it('fills home defaults into older saves', () => {
    const s = newSave(0, 'warrior');
    const raw = JSON.parse(JSON.stringify(s));
    delete raw.home;
    expect(migrate(raw)?.home).toEqual(newSave(0, 'warrior').home);
  });
});
