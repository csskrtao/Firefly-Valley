import { TS } from '../../core/constants';
import { ri } from '../../core/math';
import { CROPS, cropForSeed } from '../../data/crops';
import type { ItemId } from '../../data/items';
import { ITEMS, ITEM_IDS, itemDef } from '../../data/items';
import { addItem, count } from '../../state/save';
import { applyDishBuff } from '../../systems/cooking';
import { record } from '../../systems/explore';
import { pickForage } from '../../systems/forage';
import { applyLoot, rollChest } from '../../systems/loot';
import { WEAPON_TYPES } from '../../data/weapons';
import { BUFF_TEXT } from '../../data/items';
import { clockText } from '../../systems/time';
import { sellAll, sellableValue } from '../../systems/economy';
import * as farm from '../../systems/farming';
import { accSum, maxHp } from '../../systems/stats';
import { Tile } from '../../world/TileMap';
import type { PlayScene } from '../PlayScene';
import { announceGear } from './gearui';
import { exploreInteract } from './explore';
import { homeMenu, mineEntrance, talkTo } from './town';

export const TOOLS = [
  { id: 'hoe', name: '锄头', cost: 2 },
  { id: 'water', name: '水壶', cost: 1 },
  { id: 'seeds', name: '种子', cost: 0 },
  { id: 'pick', name: '镐', cost: 3 },
  { id: 'food', name: '回复', cost: 0 },
] as const;

export type ToolId = (typeof TOOLS)[number]['id'];

export const ownedSeeds = (sc: PlayScene): ItemId[] => ITEM_IDS.filter((id) => ITEMS[id].kind === 'seed' && count(sc.s, id) > 0);

/** 当前选中的种子；没有选中或用完时自动换成背包里的第一种 */
export function currentSeed(sc: PlayScene): ItemId | null {
  const owned = ownedSeeds(sc);
  if (sc.s.seed && owned.includes(sc.s.seed)) return sc.s.seed;
  sc.s.seed = owned[0] ?? null;
  return sc.s.seed;
}

/** 选择工具栏格子；再次选择种子格会切换到下一种种子 */
export function selectSlot(sc: PlayScene, i: number): void {
  if (i === 4) {
    heal(sc);
    return;
  }
  if (i === 2 && sc.s.tool === 2) {
    const owned = ownedSeeds(sc);
    if (owned.length > 1) {
      const cur = currentSeed(sc);
      sc.s.seed = owned[(owned.indexOf(cur ?? owned[0]) + 1) % owned.length];
      sc.toast(`切换到 ${ITEMS[sc.s.seed].name}`);
    }
  }
  sc.s.tool = i;
  sc.sfx('blip');
}

function energyCost(sc: PlayScene, base: number): number {
  // 战士干农活更省力
  return sc.s.cls === 'warrior' ? base * 0.8 : base;
}

export function useTool(sc: PlayScene): void {
  const s = sc.s;
  const tool = TOOLS[s.tool].id;
  if (tool === 'food') {
    heal(sc);
    return;
  }
  const [tx, ty] = sc.player.frontTile();
  const key = farm.fieldKey(tx, ty);

  if (sc.mode === 'town') {
    if (farm.isRipe(s.field[key])) {
      doHarvest(sc, tx, ty);
      return;
    }
    if (sc.map.get(tx, ty) !== Tile.FIELD) {
      if (tool === 'pick') sc.toast('镐要在矿脉里用');
      else if (tool === 'hoe') sc.toast('只能在围栏里的田地锄地');
      else sc.toast('面向田地使用');
      return;
    }
    const cost = energyCost(sc, TOOLS[s.tool].cost);
    if (s.en < cost) {
      sc.toast('太累了……回家睡一觉吧');
      return;
    }
    switch (tool) {
      case 'hoe': {
        const r = farm.till(s, key);
        if (!r.ok) return sc.toast(r.msg);
        s.en -= cost;
        sc.sfx('dig');
        sc.fx.burst(tx * TS + 8, ty * TS + 10, '#8a6038', 7, 30);
        return;
      }
      case 'water': {
        const r = farm.water(s, key);
        if (!r.ok) return sc.toast(r.msg);
        // 法师的水系魔法：顺便浇到前方再一格
        if (s.cls === 'mage') farm.water(s, farm.fieldKey(tx + sc.player.fx, ty + sc.player.fy));
        s.en -= cost;
        sc.sfx('water');
        sc.fx.burst(tx * TS + 8, ty * TS + 10, '#7fb0e8', 7, 30);
        return;
      }
      case 'seeds': {
        const seed = currentSeed(sc);
        if (!seed) return sc.toast('没有种子了，去杂货店找薇拉');
        const r = farm.plant(s, key, seed);
        if (!r.ok) return sc.toast(r.msg);
        sc.sfx('plant');
        sc.fx.text(tx * TS + 8, ty * TS, `种下${CROPS[cropForSeed(seed)!].name}`, '#f4ecd8');
        return;
      }
      default:
        sc.toast('镐要在矿脉里用');
    }
    return;
  }

  // 矿脉里
  if (tool !== 'pick') {
    sc.toast('在矿脉里用镐挖矿（按 4）');
    return;
  }
  const ore = sc.ores.find((o) => o.tx === tx && o.ty === ty);
  if (!ore) return;
  if (s.en < TOOLS[3].cost) {
    sc.toast('太累了，挖不动了');
    return;
  }
  s.en -= TOOLS[3].cost;
  ore.hp--;
  ore.shake = 0.2;
  sc.sfx('dig');
  sc.fx.burst(tx * TS + 8, ty * TS + 10, ITEMS[ore.item].color, 6, 40);
  if (ore.hp <= 0) {
    let n = ore.item === 'glowstone' || ore.item === 'gold' ? ri(1, 2) : ri(1, 3);
    // 刺客眼尖，常常多挖出一块
    if (s.cls === 'rogue' && Math.random() < 0.3) n++;
    // 四叶草：有几率再多一块
    if (Math.random() < accSum(s, 'luck') * 0.25) n++;
    addItem(s, ore.item, n);
    sc.sfx('pickup');
    sc.fx.text(tx * TS + 8, ty * TS, `+${n} ${ITEMS[ore.item].name}`, ITEMS[ore.item].color);
    sc.ores.splice(sc.ores.indexOf(ore), 1);
  }
}

function doHarvest(sc: PlayScene, tx: number, ty: number): void {
  const crop = farm.harvest(sc.s, farm.fieldKey(tx, ty));
  if (!crop) return;
  sc.sfx('pickup');
  sc.fx.text(tx * TS + 8, ty * TS, `+1 ${CROPS[crop].name}`, '#c4f7b4');
}

export function heal(sc: PlayScene): void {
  const s = sc.s;
  const mh = maxHp(s);
  if (s.hp >= mh && s.en >= 100) {
    sc.toast('现在不需要回复');
    return;
  }
  // 缺血优先喝药，只缺体力就吃作物和采集物（料理留着自己挑时机吃）
  const order: ItemId[] = s.hp < mh ? ['potion', 'bigPotion', 'tonic'] : ['tonic'];
  const crops = ITEM_IDS.filter((id) => (ITEMS[id].kind === 'crop' || ITEMS[id].kind === 'forage') && count(s, id) > 0 && (itemDef(id).heal || itemDef(id).energy))
    .sort((a, b) => (itemDef(a).sell ?? 0) - (itemDef(b).sell ?? 0));
  for (const id of [...order, ...crops]) {
    if (count(s, id) <= 0) continue;
    consume(sc, id);
    return;
  }
  sc.toast('没有药水，也没有能吃的东西了');
}

/** 使用一个可吃/可喝的物品 */
export function consume(sc: PlayScene, id: ItemId): boolean {
  const s = sc.s;
  const d = itemDef(id);
  const heal = d.heal ?? 0;
  const en = d.energy ?? 0;
  if (!heal && !en && !d.buff) return false;
  if (count(s, id) <= 0) return false;
  addItem(s, id, -1);
  s.hp = Math.min(maxHp(s), s.hp + heal);
  s.en = Math.min(100, s.en + en);
  sc.sfx('heal');
  sc.fx.text(sc.player.x, sc.player.y - 30, heal ? `+${heal} HP` : `+${en} 体力`, '#7fffb0');
  if (applyDishBuff(s, id) && s.buff) {
    sc.toast(`${d.name}：${BUFF_TEXT[s.buff.stat](s.buff.value)}，持续到 ${clockText(s.buff.until)}`);
  }
  return true;
}

export function interact(sc: PlayScene): void {
  const p = sc.player;
  const [tx, ty] = p.frontTile();
  const [ux, uy] = p.tile();
  const npc = sc.npcs.find((n) => n.tile[0] === tx && n.tile[1] === ty) ?? sc.npcs.find((n) => Math.hypot(n.x - p.x, n.y - p.y) < 20);
  if (npc) {
    npc.lookAt(p.x, p.y, 4);
    talkTo(sc, npc.id);
    return;
  }
  const t = sc.map.get(tx, ty);
  if (sc.mode === 'town') {
    const key = farm.fieldKey(tx, ty);
    if (farm.isRipe(sc.s.field[key])) {
      doHarvest(sc, tx, ty);
      return;
    }
    if (sc.s.forage[key]) {
      collectForage(sc, key, tx, ty);
      return;
    }
    if (exploreInteract(sc, tx, ty)) return;
    if (t === Tile.DOOR) {
      const b = sc.overworld.buildings.find((bb) => bb.door[0] === tx && bb.door[1] === ty);
      if (!b) return;
      sc.sfx('door');
      if (b.kind === 'home') homeMenu(sc);
      else if (b.kind === 'house') sc.ui.dialog.say(b.name, b.note ?? '门锁着。');
      else talkTo(sc, ({ smith: 'smith', shop: 'vera', clinic: 'lia', guild: 'ian' } as const)[b.kind]);
      return;
    }
    if (t === Tile.SIGN) {
      sc.sfx('blip');
      sc.ui.dialog.say('路牌', sc.overworld.signs[`${tx},${ty}`] ?? '字迹已经看不清了。');
      return;
    }
    if (t === Tile.BIN) {
      const v = sellableValue(sc.s, ['crop', 'forage']);
      if (!v) sc.toast('出货箱：放进作物和采集物就能换钱');
      else {
        sellAll(sc.s, ['crop', 'forage']);
        sc.sfx('coin');
        sc.toast(`卖出全部作物和采集物，获得 ${v} 金`);
      }
      return;
    }
    if (t === Tile.CAVE) {
      mineEntrance(sc);
      return;
    }
    const f = sc.s.field[key];
    if (f?.crop) {
      const c = CROPS[f.crop];
      sc.toast(`${c.name}：${Math.min(f.days, c.days)}/${c.days} 天，${f.watered ? '今天浇过水' : '今天还没浇水'}`);
    }
    return;
  }
  const chest = sc.chests.find((c) => c.tx === tx && c.ty === ty);
  if (chest) {
    openChest(sc, chest);
    return;
  }
  const ut = sc.map.get(ux, uy);
  if (t === Tile.STAIRS || ut === Tile.STAIRS) sc.goToFloor(sc.floor + 1);
  else if (t === Tile.LADDER || ut === Tile.LADDER) sc.exitMine();
}

function openChest(sc: PlayScene, chest: { tx: number; ty: number; open: boolean }): void {
  if (chest.open) {
    sc.toast('宝箱已经空了');
    return;
  }
  chest.open = true;
  const s = sc.s;
  const loot = rollChest(s, sc.floor);
  const gears = applyLoot(s, loot);
  sc.sfx('chest');
  const x = chest.tx * TS + 8;
  const y = chest.ty * TS;
  sc.fx.burst(x, y + 6, '#ffd34d', 14, 60);
  sc.fx.text(x, y - 4, `+${loot.gold} G`, '#ffcf5a');
  let dy = 10;
  for (const [id, n] of Object.entries(loot.items) as [ItemId, number][]) {
    sc.fx.text(x, y - 4 - dy, `+${n} ${ITEMS[id].name}`, ITEMS[id].color);
    dy += 8;
    if (ITEMS[id].kind === 'accessory') sc.ui.dialog.say('宝箱', `找到了饰品【${ITEMS[id].name}】！${ITEMS[id].desc} 在背包里点它就能戴上。`);
  }
  if (loot.blueprint) {
    const wt = WEAPON_TYPES[loot.blueprint];
    sc.ui.dialog.say('宝箱', `找到了一张武器图纸：【${wt.name}】，还有一把照着图纸打的${wt.name}。${wt.desc} 在背包里点它就能换上。`);
  }
  // 图纸送的那把武器上面已经说过了
  announceGear(sc, gears.slice(loot.blueprint ? 1 : 0), x, y - 4 - dy);
}

/** 走到采集物上自动捡起来 */
export function pickupForage(sc: PlayScene): void {
  const [tx, ty] = sc.player.tile();
  const key = `${tx},${ty}`;
  if (sc.s.forage[key]) collectForage(sc, key, tx, ty);
}

function collectForage(sc: PlayScene, key: string, tx: number, ty: number): void {
  const s = sc.s;
  // 刺客眼尖、四叶草带来好运，有时能多捡一个
  const lucky = Math.random() < (s.cls === 'rogue' ? 0.3 : 0) + accSum(s, 'luck') * 0.2;
  const got = pickForage(s, key, lucky);
  if (!got) return;
  record(s, got.id);
  sc.sfx('pickup');
  sc.fx.burst(tx * TS + 8, ty * TS + 10, ITEMS[got.id].color, 6, 30);
  sc.fx.text(tx * TS + 8, ty * TS - 6, `+${got.n} ${ITEMS[got.id].name}`, ITEMS[got.id].color);
}
