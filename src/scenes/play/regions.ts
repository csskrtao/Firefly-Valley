import { TS } from '../../core/constants';
import { weighted } from '../../core/math';
import type { ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import { Monster } from '../../entities/Monster';
import { RegionBoss } from '../../entities/RegionBoss';
import type { SaveData } from '../../state/save';
import { spawnForage } from '../../systems/forage';
import { forageKey, foragePrefix, recordRegionBoss, regionBossAround } from '../../systems/regions';
import type { RegionId } from '../../world/regions/defs';
import { REGIONS, WILD_IDS } from '../../world/regions/defs';
import type { RegionLayout } from '../../world/regions/layout';
import { wildLayout } from '../../world/regions/layout';
import { Tile } from '../../world/TileMap';
import type { PlayScene } from '../PlayScene';
import { collectForage } from './actions';
import { giveItems, grantXp } from './combat';
import { openWorldMap } from './worldmap';

/** 进入野外区域时刷几只怪 */
const MONSTERS_PER_VISIT = 7;

/** 新的一天：小镇和所有野外区域都长出新的采集物 */
export function spawnAllForage(s: SaveData, town: RegionLayout): void {
  spawnForage(s, town.forage);
  for (const id of WILD_IDS) spawnForage(s, wildLayout(id as Exclude<RegionId, 'town'>).forage, Math.random, foragePrefix(id));
}

/**
 * 进入野外区域时放怪物和 Boss。
 * 户外探险线（阶段 4）会把这里换成按白天黑夜游荡刷新的怪物。
 */
export function populateRegion(sc: PlayScene, L: RegionLayout): void {
  const def = REGIONS[L.id];
  const spots = L.monsterSpots.slice();
  if (Object.keys(def.monsters).length && spots.length) {
    for (let i = 0; i < MONSTERS_PER_VISIT && spots.length; i++) {
      const [tx, ty] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      sc.enemies.push(new Monster(weighted(def.monsters), tx * TS + 8, ty * TS + 10, def.tier));
    }
  }
  if (L.boss && regionBossAround(sc.s, L.id)) sc.enemies.push(new RegionBoss(L.id, L.boss[0] * TS + 8, L.boss[1] * TS + 10));
}

/** 野外区域里的 Boss，玩家离得够近时才算进入战斗 */
export function nearRegionBoss(sc: PlayScene, range: number): RegionBoss | null {
  const p = sc.player;
  for (const e of sc.enemies) if (e instanceof RegionBoss && Math.hypot(e.x - p.x, e.y - p.y) < range) return e;
  return null;
}

/** 每帧：第一次靠近 Boss 时报个名字 */
export function updateRegion(sc: PlayScene): void {
  const boss = nearRegionBoss(sc, 120);
  if (boss && !boss.announced) {
    boss.announced = true;
    sc.ui.dialog.say(boss.name, boss.bdef.intro);
  }
}

/** 在野外区域按 E：捡东西、看路牌、摸萤石路标 */
export function interactWild(sc: PlayScene, tx: number, ty: number): void {
  const key = forageKey(sc.region, tx, ty);
  if (sc.s.forage[key]) {
    collectForage(sc, key, tx, ty);
    return;
  }
  const t = sc.map.get(tx, ty);
  if (t === Tile.SIGN) {
    sc.sfx('blip');
    sc.ui.dialog.say('路牌', sc.area.signs[`${tx},${ty}`] ?? '字迹已经看不清了。');
    return;
  }
  if (t === Tile.WAYSTONE) {
    sc.sfx('magic');
    openWorldMap(sc);
    return;
  }
  const lock = sc.barriers.get(`${tx},${ty}`);
  if (lock) sc.toast(lock.hint);
}

/** 打倒野外区域的 Boss：当天不再出现，第一次打倒有额外奖励 */
export function defeatRegionBoss(sc: PlayScene, e: RegionBoss): void {
  const s = sc.s;
  const def = e.bdef;
  const first = recordRegionBoss(s, e.region);
  sc.shake(0.6, 3);
  sc.sfx('levelup');
  sc.fx.burst(e.x, e.y - 10, REGIONS[e.region].color, 30, 100);
  const g = Math.round(def.gold[0] + Math.random() * (def.gold[1] - def.gold[0]));
  s.gold += g;
  sc.fx.text(e.x, e.y - 30, `+${g} G`, '#ffcf5a');
  const drops = first ? def.firstDrops : def.drops;
  giveItems(sc, drops, e.x, e.y - 10);
  grantXp(sc, Math.round(def.hp / 2), e.x, e.y - 20);
  sc.setMusic();
  sc.ui.dialog.say(def.name, def.defeat);
  if (first) {
    const list = Object.entries(drops).map(([k, n]) => `${ITEMS[k as ItemId].name}×${n}`).join('、');
    sc.ui.dialog.say('系统', `击败了${def.name}！获得 ${list}，以及 ${g} 金币。它明天还会回来。`);
  }
}
