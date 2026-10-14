import { TS } from '../../core/constants';
import { TAU } from '../../core/math';
import type { Gear, NewGear } from '../../data/gear';
import { GEAR_SLOT_NAME, QUALITIES, gearName } from '../../data/gear';
import type { ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import type { MonsterId } from '../../data/monsters';
import type { BookPage, Cell, HiddenId, WildArea } from '../../data/treasure';
import {
  BOOK_PAGES, BOOK_REWARDS, CAMP, DIG_COST, HIDDEN_CHESTS, NIGHT_FROM, REGION_WILD, WILD, WILD_HIDDEN, WILD_LEASH, hiddenName,
} from '../../data/treasure';
import type { Enemy } from '../../entities/Enemy';
import { Monster } from '../../entities/Monster';
import type { CharSet } from '../../gfx/character';
import { makeCharacter } from '../../gfx/character';
import { chestImg } from '../../gfx/decor';
import type { Img } from '../../gfx/sprite';
import { draw, paint } from '../../gfx/sprite';
import { addItem } from '../../state/save';
import * as ex from '../../systems/explore';
import { rollChest } from '../../systems/loot';
import { gearLabel } from '../../systems/gear';
import { forageKey, lockReason, visitedRegions } from '../../systems/regions';
import type { Choice, PanelTab } from '../../ui/UI';
import { h } from '../../ui/dom';
import type { ExploreSites, HiddenSite, ZoneSites } from '../../world/exploreSites';
import { placeExploreSites, townZone, wildZone } from '../../world/exploreSites';
import type { Overworld } from '../../world/overworld';
import { REGIONS } from '../../world/regions/defs';
import { wildLayout } from '../../world/regions/layout';
import type { PlayScene } from '../PlayScene';
import { grantXp } from './combat';
import { announceGear } from './gearui';

/* ---------- 精英怪 ---------- */

/** 营地里领头的怪：血更厚、打人更疼，身上一圈金光 */
class Elite extends Monster {
  constructor(mid: MonsterId, x: number, y: number, tier: number) {
    super(mid, x, y, tier);
    this.maxHp = this.hp = Math.round(this.hp * CAMP.eliteHp);
    this.atk = Math.round(this.atk * CAMP.eliteAtk);
    this.knock *= 0.5;
  }

  override get name(): string {
    return `精英·${this.def.name}`;
  }

  override draw(b: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    b.globalAlpha = 0.35 + 0.15 * Math.sin(t * 5);
    b.fillStyle = '#ffd34d';
    b.beginPath();
    b.ellipse(this.x - cx, this.y - cy + 3, 11, 5, 0, 0, TAU);
    b.fill();
    b.globalAlpha = 1;
    super.draw(b, cx, cy, t);
  }
}

/* ---------- 场景里的运行时状态 ---------- */

/** 小镇的草地、森林，或者整个野外区域 */
type SpawnArea = WildArea | 'region';

/** 户外探险的运行时状态：石头位置、怪物的出生点、营地的怪 */
export class ExploreWorld {
  readonly sites: ExploreSites;
  boulder: Cell;
  /** 户外怪物和它的出生点，跑太远就消失 */
  readonly wild = new Map<Enemy, { home: Cell; area: SpawnArea }>();
  readonly camp = new Set<Enemy>();
  spawnT = 0;

  constructor(ow: Overworld) {
    this.sites = placeExploreSites(ow);
    this.boulder = [...this.sites.boulderStart];
  }
}

const isNight = (sc: PlayScene) => sc.s.time >= NIGHT_FROM;
const same = (a: Cell, x: number, y: number) => a[0] === x && a[1] === y;
const center = (c: Cell): [number, number] => [c[0] * TS + 8, c[1] * TS + 10];

/** 现在能去的区域：萤石镇，加上去过而且已经开放的野外区域 */
export function zonesFor(sc: PlayScene): ZoneSites[] {
  const out = [townZone(sc.explore.sites.digCells)];
  for (const id of visitedRegions(sc.s)) {
    if (id === 'town' || lockReason(sc.s, id)) continue;
    out.push(wildZone(wildLayout(id)));
  }
  return out;
}

/** 玩家现在所在的区域 */
export function zoneHere(sc: PlayScene): ZoneSites {
  return sc.region === 'town' ? townZone(sc.explore.sites.digCells) : wildZone(sc.area);
}

/** 今天的事件在这个区域的话，它站在哪一格 */
function eventCell(sc: PlayScene): Cell | null {
  const ev = sc.s.explore.event;
  if (!ev || (ev.region ?? 'town') !== sc.region) return null;
  return zoneHere(sc).events[ev.kind][ev.spot]?.at ?? null;
}

/** 营地的营火在事件格子上，宝箱在它右边 */
function campChestCell(sc: PlayScene): Cell | null {
  const ev = sc.s.explore.event;
  const c = eventCell(sc);
  if (!c || ev?.kind !== 'camp') return null;
  return [c[0] + 1, c[1]];
}

/** 火盆中间的宝箱：火盆都点亮了才出现 */
function hiddenVisible(sc: PlayScene, hs: HiddenSite): boolean {
  if (!hs.braziers.length) return true;
  return ex.isOpened(sc.s, hs.id) || ex.litCount(sc.s, hs.id) >= hs.braziers.length;
}

/** 这一格的火盆：属于哪个宝箱，是第几个 */
function brazierAt(sc: PlayScene, x: number, y: number): { hs: HiddenSite; i: number } | null {
  for (const hs of zoneHere(sc).hidden) {
    const i = hs.braziers.findIndex((b) => same(b, x, y));
    if (i >= 0) return { hs, i };
  }
  return null;
}

/** 这个区域的闪光点 */
function digsHere(sc: PlayScene): Cell[] {
  const out: Cell[] = [];
  for (const k of sc.s.explore.digs) {
    const d = ex.splitKey(k);
    if (d.region === sc.region) out.push([d.x, d.y]);
  }
  return out;
}

/** 藏宝图指的地方在这个区域的话，返回那一格 */
function mapHere(sc: PlayScene): Cell | null {
  const t = ex.mapTarget(sc.s);
  return t && t.region === sc.region ? t.at : null;
}

/* ---------- 每天和进出区域 ---------- */

/** 新的一天：刷新挖宝点和随机事件。返回早上的消息 */
export function exploreDay(sc: PlayScene): string[] {
  ex.explore(sc.s);
  if (sc.s.explore.day === sc.s.day) return [];
  return ex.newExploreDay(sc.s, zonesFor(sc));
}

/** 进入一个地面区域时：石头回到原位，放出户外怪物和营地 */
export function enterOutdoor(sc: PlayScene): void {
  const w = sc.explore;
  w.boulder = [...w.sites.boulderStart];
  w.wild.clear();
  w.camp.clear();
  w.spawnT = 0;
  for (const area of spawnAreas(sc)) topUp(sc, area, true);
  const ev = sc.s.explore.event;
  const at = eventCell(sc);
  if (ev?.kind === 'camp' && ev.stage === 0 && at) spawnCamp(sc, at);
}

const spawnAreas = (sc: PlayScene): SpawnArea[] => (sc.region === 'town' ? ['meadow', 'forest'] : ['region']);

function weightedPick(w: Partial<Record<MonsterId, number>>): MonsterId {
  const entries = Object.entries(w) as [MonsterId, number][];
  let r = Math.random() * entries.reduce((a, [, n]) => a + n, 0);
  for (const [id, n] of entries) {
    r -= n;
    if (r <= 0) return id;
  }
  return entries[0][0];
}

/** 一个刷怪范围的规则：上限、出哪些怪、多强、在哪些格子出生 */
function spawnRule(sc: PlayScene, area: SpawnArea): { cap: number; pool: Partial<Record<MonsterId, number>>; tier: number; cells: Cell[] } {
  const night = isNight(sc);
  if (area !== 'region') {
    const def = WILD[area];
    return { cap: night ? def.cap.night : def.cap.day, pool: night ? def.night : def.day, tier: night ? def.floor.night : def.floor.day, cells: sc.explore.sites.wild[area] };
  }
  const def = REGIONS[sc.region];
  const boss = sc.area.boss;
  // Boss 身边留给 Boss
  const cells = sc.area.monsterSpots.filter((c) => !boss || Math.hypot(c[0] - boss[0], c[1] - boss[1]) >= 7);
  const pool = night ? { ...def.monsters, bat: (def.monsters.bat ?? 0) + REGION_WILD.nightBats } : def.monsters;
  return {
    cap: Object.keys(def.monsters).length ? (night ? REGION_WILD.cap.night : REGION_WILD.cap.day) : 0,
    pool,
    tier: def.tier + (night ? REGION_WILD.nightTier : 0),
    cells,
  };
}

/** 把某个范围的怪补到上限。init 为真时可以出现在玩家附近以外的任何地方 */
function topUp(sc: PlayScene, area: SpawnArea, init = false): void {
  const w = sc.explore;
  const rule = spawnRule(sc, area);
  let have = [...w.wild.values()].filter((v) => v.area === area).length;
  if (!rule.cells.length) return;
  const p = sc.player;
  for (let tries = 0; have < rule.cap && tries < 30; tries++) {
    const c = rule.cells[Math.floor(Math.random() * rule.cells.length)];
    const [x, y] = center(c);
    // 不在玩家眼前冒出来
    if (Math.hypot(x - p.x, y - p.y) < (init ? 7 : 10) * TS) continue;
    const m = new Monster(weightedPick(rule.pool), x, y, rule.tier);
    if (!sc.boxFree(x, y, m.hw, m.hh)) continue;
    sc.enemies.push(m);
    w.wild.set(m, { home: c, area });
    have++;
  }
}

function spawnCamp(sc: PlayScene, at: Cell): void {
  const w = sc.explore;
  const tier = ex.campTier(sc.s);
  const [fx, fy] = center(at);
  const spots: [number, number][] = [[-2, -1], [2, -1], [-1, 2], [2, 1], [-2, 1], [0, -2], [-1, -2], [1, 2]];
  const ids: MonsterId[] = [];
  for (let i = 0; i < CAMP.minionCount; i++) ids.push(weightedPick(CAMP.minions));
  let i = 0;
  for (const [dx, dy] of spots) {
    if (i > ids.length) break;
    const x = fx + dx * TS;
    const y = fy + dy * TS;
    const elite = i === 0;
    const m = elite ? new Elite(CAMP.elite[sc.s.day % CAMP.elite.length], x, y, tier) : new Monster(ids[i - 1], x, y, tier);
    if (!sc.boxFree(x, y, m.hw, m.hh)) continue;
    sc.enemies.push(m);
    w.camp.add(m);
    i++;
  }
}

/** 地面上每帧：跑远的怪回家，营地打完了就开宝箱，隔一会儿补怪。怪物和战斗本身由场景更新 */
export function updateOutdoor(sc: PlayScene, dt: number): void {
  const w = sc.explore;
  for (const [e, info] of w.wild) {
    if (!sc.enemies.includes(e)) {
      w.wild.delete(e);
      continue;
    }
    const [hx, hy] = center(info.home);
    if (Math.hypot(e.x - hx, e.y - hy) > WILD_LEASH * TS) {
      sc.fx.burst(e.x, e.y - 4, '#d9d2c0', 8, 40);
      sc.enemies.splice(sc.enemies.indexOf(e), 1);
      w.wild.delete(e);
    }
  }
  if (w.camp.size) {
    for (const e of w.camp) if (!sc.enemies.includes(e)) w.camp.delete(e);
    const ev = sc.s.explore.event;
    if (!w.camp.size && ev?.kind === 'camp' && ev.stage === 0) {
      ex.clearCamp(sc.s);
      const at = campChestCell(sc);
      if (at) {
        const [x, y] = center(at);
        sc.fx.burst(x, y - 6, '#ffd34d', 20, 70);
        sc.fx.ring(x, y - 6, 26, 0.5, '#ffd34d');
        grantXp(sc, CAMP.xp, x, y - 10);
      }
      sc.sfx('levelup');
      sc.toast('营地清空了！营火边的宝箱可以打开了');
    }
  }
  // 隔一会儿补一次怪；入夜以后上限变高，会多出来几只
  w.spawnT -= dt;
  if (w.spawnT <= 0) {
    w.spawnT = 6;
    for (const area of spawnAreas(sc)) topUp(sc, area);
  }
}

/* ---------- 碰撞 ---------- */

/** 探险的东西占住的格子：石头、火盆、宝箱、营火、商人和旅人 */
export function exploreBlocked(sc: PlayScene, tx: number, ty: number): boolean {
  if (sc.region === 'town' && same(sc.explore.boulder, tx, ty)) return true;
  for (const hs of zoneHere(sc).hidden) {
    if (hs.braziers.some((b) => same(b, tx, ty))) return true;
    if (same(hs.at, tx, ty) && hiddenVisible(sc, hs)) return true;
  }
  const at = eventCell(sc);
  const ev = sc.s.explore.event;
  if (!at || !ev) return false;
  if (ev.kind === 'camp') return same(at, tx, ty) || same([at[0] + 1, at[1]], tx, ty);
  return ev.stage < 2 && same(at, tx, ty);
}

/** 面前这一格能不能交互，用来画提示框 */
export function exploreHighlight(sc: PlayScene, tx: number, ty: number): boolean {
  if (sc.s.explore.digs.includes(forageKey(sc.region, tx, ty))) return true;
  const t = mapHere(sc);
  if (t && same(t, tx, ty)) return true;
  return exploreBlocked(sc, tx, ty);
}

/* ---------- 交互 ---------- */

/** 按 E：挖宝、推石头、点火盆、开宝箱、和商人旅人说话。处理了返回 true */
export function exploreInteract(sc: PlayScene, tx: number, ty: number): boolean {
  const s = sc.s;
  const [ux, uy] = sc.player.tile();

  // 挖宝：面前或者脚下
  for (const [x, y] of [[tx, ty], [ux, uy]]) {
    const t = mapHere(sc);
    const isMap = !!t && same(t, x, y);
    if (!isMap && !s.explore.digs.includes(forageKey(sc.region, x, y))) continue;
    digHere(sc, x, y, isMap);
    return true;
  }

  if (sc.region === 'town' && same(sc.explore.boulder, tx, ty)) {
    pushBoulder(sc, tx, ty);
    return true;
  }

  const br = brazierAt(sc, tx, ty);
  if (br) {
    lightBrazier(sc, br.hs, br.i);
    return true;
  }

  for (const hs of zoneHere(sc).hidden) {
    if (!same(hs.at, tx, ty) || !hiddenVisible(sc, hs)) continue;
    const loot = ex.openHidden(s, hs.id);
    if (!loot) sc.toast('宝箱已经空了');
    else {
      sc.sfx('chest');
      sc.ui.dialog.say('宝箱', `打开了${hiddenName(hs.id)}！${lootText(loot)}`);
      showLoot(sc, tx, ty, loot);
    }
    return true;
  }

  const ev = s.explore.event;
  const at = eventCell(sc);
  const campChest = campChestCell(sc);
  if (ev && campChest && same(campChest, tx, ty)) {
    if (ev.stage === 0) sc.toast('宝箱被怪物守着，先把营地的怪全部打倒');
    else if (ev.stage === 1) {
      const chest = rollChest(s, ex.campTier(s) + CAMP.chestFloor - CAMP.floor);
      chest.gold += Math.round(CAMP.gold[0] + Math.random() * (CAMP.gold[1] - CAMP.gold[0]));
      const loot = ex.openCampChest(s, chest);
      if (loot) {
        sc.sfx('chest');
        sc.ui.dialog.say('营地宝箱', `营地的宝箱里有：${lootText(loot)}`);
        showLoot(sc, tx, ty, loot);
      }
    } else sc.toast('宝箱已经空了');
    return true;
  }
  if (ev && at && same(at, tx, ty)) {
    if (ev.kind === 'merchant') merchantMenu(sc);
    else if (ev.kind === 'traveler') travelerTalk(sc);
    else sc.toast(ev.stage === 0 ? '营火还在烧，附近的怪物都盯着你' : '营火快熄了');
    return true;
  }
  return false;
}

function digHere(sc: PlayScene, x: number, y: number, isMap: boolean): void {
  const s = sc.s;
  if (!ex.hasShovel(s)) {
    addItem(s, 'shovel', 1);
    const face = sc.npcFace('owl');
    sc.ui.dialog.say('猫头鹰·咕咕', '咕？地上在闪光，下面一定埋着东西。拿着，这是你祖母的铲子。', { face });
    sc.ui.dialog.say('猫头鹰·咕咕', '每天野外都会冒出几个闪光点，对着它按 E 就能挖。运气好还能挖到藏宝图和装备，咕。', { face });
    sc.ui.dialog.say('系统', '得到了【祖母的铲子】。');
    return;
  }
  if (s.en < DIG_COST) {
    sc.toast('太累了，挖不动了');
    return;
  }
  s.en -= DIG_COST;
  sc.sfx('dig');
  const [px, py] = center([x, y]);
  sc.fx.burst(px, py, '#8a6038', 10, 45);
  const loot = isMap ? ex.digMap(s) : ex.dig(s, forageKey(sc.region, x, y));
  if (!loot) return;
  sc.sfx('chest');
  if (isMap) {
    sc.fx.ring(px, py - 4, 28, 0.6, '#ffd34d');
    sc.ui.dialog.say('藏宝图', `挖到了藏宝图上的宝藏！${lootText(loot)}`);
  }
  showLoot(sc, x, y, loot);
}

/** 推石头：朝面对的方向推一格，只能推进石圈里面 */
function pushBoulder(sc: PlayScene, tx: number, ty: number): void {
  const w = sc.explore;
  const p = sc.player;
  const nx = tx + p.fx;
  const ny = ty + p.fy;
  const inside = w.sites.ringInside.some((c) => same(c, nx, ny));
  const blocked = !inside || exploreBlocked(sc, nx, ny) || sc.npcs.some((n) => n.tile[0] === nx && n.tile[1] === ny);
  if (blocked) {
    sc.toast('推不动了');
    sc.sfx('fail');
    return;
  }
  w.boulder = [nx, ny];
  sc.sfx('slam');
  sc.shake(0.12, 1);
  const [x, y] = center([tx, ty]);
  sc.fx.burst(x, y, '#9a9a9a', 6, 30);
}

function lightBrazier(sc: PlayScene, hs: HiddenSite, i: number): void {
  const s = sc.s;
  const total = hs.braziers.length;
  if (ex.isLit(s, hs.id, i)) {
    sc.toast('火盆已经点着了');
    return;
  }
  const all = ex.lightBrazier(s, hs.id, i, total);
  const [x, y] = center(hs.braziers[i]);
  sc.sfx('magic');
  sc.fx.burst(x, y - 10, '#ff8a3a', 12, 40);
  if (!all) {
    sc.toast(`点亮了火盆（${ex.litCount(s, hs.id)}/${total}）。火只能烧到今晚`);
    return;
  }
  const [cx, cy] = center(hs.at);
  sc.fx.ring(cx, cy - 4, 30, 0.6, '#ff8a3a');
  sc.fx.burst(cx, cy - 4, '#ffd34d', 20, 70);
  sc.sfx('levelup');
  sc.toast(ex.isOpened(s, hs.id) ? '火盆都亮了' : '火盆都亮了，中间出现了一个宝箱！');
}

const newGearLabel = (g: NewGear) => `${QUALITIES[g.q].name} ${gearName(g)}`;

function merchantMenu(sc: PlayScene): void {
  const s = sc.s;
  const choices: Choice[] = ex.merchantStock(s).map((it) => {
    const name = it.gear ? newGearLabel(it.gear) : ITEMS[it.id!].name;
    const desc = it.gear ? `${GEAR_SLOT_NAME[it.gear.slot]} · ${it.gear.tier + 1} 阶，只有这一件` : ITEMS[it.id!].desc;
    return {
      label: `${name}　${it.price} 金`,
      note: it.soldOut ? '已经卖完了' : desc,
      disabled: it.soldOut || s.gold < it.price,
      onSelect: () => {
        const r = ex.buyFromMerchant(s, it);
        sc.toast(r.msg);
        if (!r.ok) return;
        sc.sfx('coin');
        const [x, y] = sc.player.frontTile();
        announceGear(sc, r.got, ...center([x, y]), true);
        if (it.id === 'treasureMap' && !noteMap(sc, '流浪商人')) merchantMenu(sc);
        else if (it.id !== 'treasureMap' && !r.got.length) merchantMenu(sc);
      },
    };
  });
  choices.push({ label: '不买了' });
  sc.ui.dialog.say('流浪商人', `走过路过别错过，都是我从各地收来的好东西。（你有 ${s.gold} 金）`, { face: merchantChar().portrait, choices });
}

function travelerTalk(sc: PlayScene): void {
  const s = sc.s;
  const face = travelerChar().portrait;
  const ev = s.explore.event;
  if (!ev || ev.stage >= 2) {
    sc.ui.dialog.say('旅人', '多亏了你，我已经能走了。路上小心。', { face });
    return;
  }
  const cures = ex.travelerCures(s);
  if (!cures.length) {
    sc.ui.dialog.say('旅人', '我被怪物咬伤了……要是有药水或者能吃的东西就好了。', { face });
    sc.toast('需要药水，或者能回 20 点以上生命的料理和作物');
    return;
  }
  const choices: Choice[] = cures.slice(0, 4).map((id) => ({
    label: `给他${ITEMS[id].name}`,
    onSelect: () => {
      const loot = ex.helpTraveler(s, id);
      if (!loot) return;
      sc.sfx('heal');
      const [x, y] = sc.player.frontTile();
      sc.ui.dialog.say('旅人', `谢谢你！这些是我在路上捡到的，送给你吧。${lootText(loot)}`, { face });
      showLoot(sc, x, y, loot);
    },
  }));
  choices.push({ label: '下次再说' });
  sc.ui.dialog.say('旅人', '我被怪物咬伤了……能分我一点吃的或者药吗？', { face, choices });
}

/** 刚拿到藏宝图：看看它指向哪里，告诉玩家。说了话返回 true */
function noteMap(sc: PlayScene, who = '藏宝图'): boolean {
  const had = sc.s.explore.map;
  const t = ex.readMap(sc.s, zonesFor(sc));
  if (!t || t === had) return false;
  sc.ui.dialog.say(who, `藏宝图背面写着：「${t.hint}」走近了地上会出现红叉。`);
  return true;
}

/* ---------- 奖励显示 ---------- */

function lootText(loot: ex.ExploreLoot): string {
  const parts = Object.entries(loot.items).map(([id, n]) => `${ITEMS[id as ItemId].name}×${n}`);
  if (loot.gold) parts.unshift(`${loot.gold} 金币`);
  parts.push(...loot.got.map((g: Gear) => `【${gearLabel(g)}】`));
  return `获得 ${parts.join('、')}。`;
}

/** 飘字显示奖励，装备单独提示，拿到藏宝图就读一下 */
function showLoot(sc: PlayScene, tx: number, ty: number, loot: ex.ExploreLoot): void {
  const [x, y] = center([tx, ty]);
  if (loot.gold) sc.fx.text(x, y - 14, `+${loot.gold} G`, '#ffcf5a');
  let dy = 8;
  for (const [id, n] of Object.entries(loot.items) as [ItemId, number][]) {
    sc.fx.text(x, y - 14 - dy, `+${n} ${ITEMS[id].name}`, ITEMS[id].color);
    dy += 8;
  }
  announceGear(sc, loot.got, x, y - 14 - dy);
  if (loot.items.treasureMap) noteMap(sc);
}

/* ---------- 绘制 ---------- */

let merchantSet: CharSet | null = null;
let travelerSet: CharSet | null = null;
const merchantChar = () =>
  (merchantSet ??= makeCharacter({
    skin: '#e0a878', hair: '#4a3a2a', hairStyle: 'short', beard: '#4a3a2a', hat: { kind: 'hood', color: '#7a4a8a', trim: '#ffd34d' },
    top: '#7a4a8a', trim: '#ffd34d', lower: 'robe', legs: '#5a3a6a', boots: '#3a2a1e',
  }));
const travelerChar = () =>
  (travelerSet ??= makeCharacter({
    skin: '#f0c49a', hair: '#c9a060', hairStyle: 'ponytail', scarf: '#c94a3a',
    top: '#6b8a5a', trim: '#c94a3a', lower: 'pants', legs: '#5a4a3a', boots: '#3a2a1e',
  }));

const boulderImg = paint(16, 16, (g) => {
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.fillRect(2, 13, 12, 3);
  g.fillStyle = '#5f5f6a';
  g.fillRect(2, 4, 12, 10);
  g.fillRect(3, 3, 10, 12);
  g.fillStyle = '#8a8a96';
  g.fillRect(3, 4, 10, 8);
  g.fillStyle = '#b4b4c0';
  g.fillRect(4, 4, 4, 2);
  g.fillStyle = '#4a4a54';
  g.fillRect(9, 9, 3, 1);
  g.fillRect(5, 11, 2, 1);
});

const brazierImg = (lit: boolean) =>
  paint(16, 20, (g) => {
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fillRect(3, 17, 10, 3);
    g.fillStyle = '#4a4040';
    g.fillRect(7, 11, 2, 7);
    g.fillRect(5, 17, 6, 2);
    g.fillStyle = '#7a6a60';
    g.fillRect(3, 8, 10, 4);
    g.fillStyle = '#5a4a40';
    g.fillRect(4, 11, 8, 1);
    if (lit) {
      g.fillStyle = '#ff8a3a';
      g.fillRect(5, 3, 6, 5);
      g.fillStyle = '#ffd34d';
      g.fillRect(6, 1, 4, 6);
      g.fillStyle = '#fff6c8';
      g.fillRect(7, 4, 2, 3);
    } else {
      g.fillStyle = '#2a2020';
      g.fillRect(4, 7, 8, 1);
    }
  });
const brazierImgs = { off: brazierImg(false), on: brazierImg(true) };

const campfireImg = (lit: boolean) =>
  paint(16, 16, (g) => {
    g.fillStyle = '#6b4a2b';
    g.fillRect(2, 11, 12, 2);
    g.fillRect(4, 9, 8, 2);
    g.fillStyle = '#7a7a84';
    for (const [x, y] of [[1, 12], [13, 12], [3, 14], [11, 14], [7, 14]]) g.fillRect(x, y, 2, 2);
    if (!lit) return;
    g.fillStyle = '#ff8a3a';
    g.fillRect(5, 4, 6, 6);
    g.fillStyle = '#ffd34d';
    g.fillRect(6, 2, 4, 6);
    g.fillStyle = '#fff6c8';
    g.fillRect(7, 5, 2, 3);
  });
const campfireImgs = { off: campfireImg(false), on: campfireImg(true) };

const chestCache = new Map<string, Img>();
function hiddenChestImg(color: string, open: boolean): Img {
  const k = `${color}:${open}`;
  let img = chestCache.get(k);
  if (!img) {
    img = chestImg(open, color);
    chestCache.set(k, img);
  }
  return img;
}

const hiddenColor = (id: HiddenId) => (id in HIDDEN_CHESTS ? HIDDEN_CHESTS[id as keyof typeof HIDDEN_CHESTS].color : WILD_HIDDEN[id as keyof typeof WILD_HIDDEN].color);

type DrawList = { y: number; d: () => void }[];

/** 画探险的东西：闪光点和红叉直接画在地上，其他的放进按 y 排序的列表 */
export function drawExplore(sc: PlayScene, b: CanvasRenderingContext2D, cx: number, cy: number, list: DrawList): void {
  const s = sc.s;
  const t = sc.clock;
  const onScreen = (x: number, y: number) => x * TS - cx > -24 && x * TS - cx < 504 && y * TS - cy > -40 && y * TS - cy < 290;

  // 闪光点：一闪一闪的小星星
  for (const [x, y] of digsHere(sc)) {
    if (!onScreen(x, y)) continue;
    const px = x * TS - cx + 8;
    const py = y * TS - cy + 9;
    const ph = (t * 2.2 + x * 0.7 + y * 0.3) % 1;
    b.fillStyle = 'rgba(90,60,30,.45)';
    b.fillRect(px - 4, py + 1, 8, 2);
    b.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(ph * Math.PI));
    b.fillStyle = '#fff6c8';
    b.fillRect(px - 0.5, py - 4, 1, 7);
    b.fillRect(px - 3.5, py - 1, 7, 1);
    b.fillStyle = '#ffd34d';
    b.fillRect(px - 1, py - 2, 2, 3);
    b.globalAlpha = 1;
  }

  // 藏宝图的红叉：走近了才看得见
  const target = mapHere(sc);
  if (target) {
    const [mx, my] = center(target);
    const d = Math.hypot(mx - sc.player.x, my - sc.player.y);
    if (d < 7 * TS) {
      b.globalAlpha = Math.min(1, (7 * TS - d) / (3 * TS));
      b.fillStyle = '#d0302a';
      const px = Math.round(target[0] * TS - cx);
      const py = Math.round(target[1] * TS - cy);
      for (let i = 0; i < 10; i++) {
        b.fillRect(px + 3 + i, py + 3 + i, 2, 2);
        b.fillRect(px + 12 - i, py + 3 + i, 2, 2);
      }
      b.globalAlpha = 1;
    }
  }

  if (sc.region === 'town') {
    const [bx, by] = sc.explore.boulder;
    if (onScreen(bx, by)) list.push({ y: by * TS + 14, d: () => b.drawImage(boulderImg, bx * TS - cx, by * TS - cy) });
  }
  for (const hs of zoneHere(sc).hidden) {
    hs.braziers.forEach(([x, y], i) => {
      if (!onScreen(x, y)) return;
      const lit = ex.isLit(s, hs.id, i);
      list.push({ y: y * TS + 14, d: () => b.drawImage(lit ? brazierImgs.on : brazierImgs.off, x * TS - cx, y * TS - cy - 4) });
    });
    const [x, y] = hs.at;
    if (!hiddenVisible(sc, hs) || !onScreen(x, y)) continue;
    const img = hiddenChestImg(hiddenColor(hs.id), ex.isOpened(s, hs.id));
    list.push({ y: y * TS + 14, d: () => b.drawImage(img, x * TS - cx, y * TS - cy) });
  }

  const ev = s.explore.event;
  const at = eventCell(sc);
  if (!ev || !at || !onScreen(at[0], at[1])) return;
  const [x, y] = at;
  if (ev.kind === 'camp') {
    list.push({ y: y * TS + 14, d: () => b.drawImage(ev.stage === 0 ? campfireImgs.on : campfireImgs.off, x * TS - cx, y * TS - cy) });
    const img = hiddenChestImg('#8a5a2a', ev.stage === 2);
    list.push({ y: y * TS + 14, d: () => b.drawImage(img, (x + 1) * TS - cx, y * TS - cy) });
    return;
  }
  const set = ev.kind === 'merchant' ? merchantChar() : travelerChar();
  const lying = ev.kind === 'traveler' && ev.stage < 2;
  list.push({
    y: y * TS + 12,
    d: () => {
      const img = set.down[0];
      b.fillStyle = 'rgba(0,0,0,.25)';
      b.fillRect(x * TS - cx + 3, y * TS - cy + 11, 10, 3);
      if (lying) {
        // 躺在地上：整个人转 90 度
        b.save();
        b.translate(x * TS - cx + 8, y * TS - cy + 10);
        b.rotate(-Math.PI / 2);
        draw(b, img, -14, -8);
        b.restore();
        if (Math.floor(t * 2) % 2) {
          b.fillStyle = '#ef5d5d';
          b.fillRect(x * TS - cx + 7, y * TS - cy - 6, 2, 5);
          b.fillRect(x * TS - cx + 7, y * TS - cy, 2, 2);
        }
      } else {
        draw(b, img, x * TS - cx, y * TS - cy - 16);
        if (ev.kind === 'merchant') {
          // 身边的货摊
          b.fillStyle = '#6b4a2b';
          b.fillRect(x * TS - cx + 13, y * TS - cy + 4, 9, 8);
          b.fillStyle = '#ffd34d';
          b.fillRect(x * TS - cx + 14, y * TS - cy + 2, 3, 3);
          b.fillStyle = '#62f0d6';
          b.fillRect(x * TS - cx + 18, y * TS - cy + 2, 3, 3);
        }
      }
    },
  });
}

/** 夜里火盆和营火也会发光，返回光源的世界坐标 */
export function exploreLights(sc: PlayScene): [number, number][] {
  const out: [number, number][] = [];
  for (const hs of zoneHere(sc).hidden) hs.braziers.forEach((c, i) => ex.isLit(sc.s, hs.id, i) && out.push(center(c)));
  const ev = sc.s.explore.event;
  const at = eventCell(sc);
  if (ev?.kind === 'camp' && ev.stage === 0 && at) out.push(center(at));
  return out;
}

/* ---------- 收集册 ---------- */

/** 背包里的收集册分页：每一页的进度、奖励，以及当前藏宝图的线索 */
export function bookTab(sc: PlayScene): PanelTab {
  return {
    id: 'book',
    label: '收集册',
    render: (body) => {
      const s = sc.s;
      ex.explore(s);
      const t = ex.readMap(s, zonesFor(sc));
      body.append(h('section', { class: 'card' },
        h('h3', { text: '藏宝图' }),
        h('p', { text: t ? `「${t.hint}」走近了地上会出现红叉，按 E 挖。` : '手上没有藏宝图。挖宝、帮助旅人、找流浪商人都有机会拿到。' }),
        h('p', { class: 'muted', text: `今天各处还有 ${s.explore.digs.length} 个闪光点没挖。${s.explore.event ? eventLine(sc) : ''}` }),
      ));
      for (const page of BOOK_PAGES) {
        const entries = ex.bookEntries(s, page.id);
        const pr = ex.bookProgress(s, page.id);
        const dl = h('dl', { class: 'keys' });
        for (const e of entries) dl.append(h('dt', { text: e.got ? e.name : '？？？' }), h('dd', { text: e.got ? (e.note ?? '已收集') : '未发现' }));
        const sec = h('section', { class: 'card' },
          h('h3', { text: `${page.name}　${pr.have} / ${pr.need}` }),
          h('p', { class: 'muted', text: page.desc }),
          dl,
        );
        for (const tier of ['half', 'full'] as ex.Tier[]) sec.append(rewardButton(sc, page.id, tier));
        body.append(sec);
      }
    },
  };
}

function eventLine(sc: PlayScene): string {
  const ev = sc.s.explore.event;
  if (!ev) return '';
  const where = ex.eventSpot(zonesFor(sc), ev)?.where ?? '';
  if (ev.kind === 'merchant') return `流浪商人在${where}。`;
  if (ev.kind === 'traveler') return ev.stage >= 2 ? '' : `受伤的旅人在${where}。`;
  return ev.stage === 0 ? `${where}有一个怪物营地。` : ev.stage === 1 ? `${where}的营地宝箱还没开。` : '';
}

function rewardButton(sc: PlayScene, page: BookPage, tier: ex.Tier): HTMLElement {
  const s = sc.s;
  const r = BOOK_REWARDS[page][tier];
  const items = Object.entries(r.items).map(([id, n]) => `${ITEMS[id as ItemId].name}×${n}`).join('、');
  const done = s.explore.claimed.includes(`${page}:${tier}`);
  const ready = ex.canClaim(s, page, tier);
  const label = `${tier === 'half' ? '收集一半' : '全部集齐'}：${r.gold} 金、${items}`;
  const bt = h('button', { type: 'button', class: 'menu-btn', 'data-nav': '' },
    h('span', { text: label }),
    h('small', { text: done ? '已领取' : ready ? '可以领取' : '还没达成' }),
  );
  if (!ready) bt.setAttribute('aria-disabled', 'true');
  bt.addEventListener('click', () => {
    const loot = ex.claimBook(s, page, tier);
    if (!loot) return;
    sc.sfx('levelup');
    sc.toast(`领取了收集奖励：${lootText(loot)}`);
    ex.readMap(s, zonesFor(sc));
    sc.ui.panel.refresh();
  });
  return bt;
}
