import { TS } from '../../core/constants';
import { TAU } from '../../core/math';
import type { ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import type { MonsterId } from '../../data/monsters';
import type { BookPage, Cell, HiddenId, WildArea } from '../../data/treasure';
import {
  BOOK_PAGES, BOOK_REWARDS, BRAZIERS, CAMP, DIG_COST, EVENT_SPOTS, HIDDEN_CHESTS, HIDDEN_IDS, MAP_SPOTS, NIGHT_FROM, WILD, WILD_LEASH,
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
import type { Loot } from '../../systems/loot';
import { rollChest } from '../../systems/loot';
import type { Choice, PanelTab } from '../../ui/UI';
import { h } from '../../ui/dom';
import type { ExploreSites } from '../../world/exploreSites';
import { placeExploreSites } from '../../world/exploreSites';
import type { Overworld } from '../../world/overworld';
import type { PlayScene } from '../PlayScene';
import * as combat from './combat';
import { grantXp } from './combat';

/* ---------- 精英怪 ---------- */

/** 营地里领头的怪：血更厚、打人更疼，身上一圈金光 */
class Elite extends Monster {
  constructor(mid: MonsterId, x: number, y: number) {
    super(mid, x, y, CAMP.floor);
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

/** 户外探险在小镇里的运行时状态：石头位置、怪物的出生点、营地的怪 */
export class ExploreWorld {
  readonly sites: ExploreSites;
  boulder: Cell;
  /** 户外怪物和它的出生点，跑太远就消失 */
  readonly wild = new Map<Enemy, { home: Cell; area: WildArea }>();
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

function eventCell(sc: PlayScene): Cell | null {
  const ev = sc.s.explore.event;
  if (!ev) return null;
  return EVENT_SPOTS[ev.kind][ev.spot]?.at ?? null;
}

/** 营地的营火在事件格子上，宝箱在它右边 */
function campChestCell(sc: PlayScene): Cell | null {
  const ev = sc.s.explore.event;
  const c = eventCell(sc);
  if (!c || ev?.kind !== 'camp') return null;
  return [c[0] + 1, c[1]];
}

/** 火盆中间的宝箱：火盆都点亮了才出现 */
function hiddenVisible(sc: PlayScene, id: HiddenId): boolean {
  if (id !== 'brazier') return true;
  return ex.isOpened(sc.s, id) || sc.s.explore.lit.length >= BRAZIERS.length;
}

/* ---------- 每天和进出小镇 ---------- */

/** 新的一天：刷新挖宝点和随机事件。返回早上的消息 */
export function exploreDay(sc: PlayScene): string[] {
  ex.explore(sc.s);
  if (sc.s.explore.day === sc.s.day) return [];
  return ex.newExploreDay(sc.s, sc.explore.sites.digCells);
}

/** 回到地面时：石头回到原位，放出户外怪物和营地 */
export function enterOutdoor(sc: PlayScene): void {
  const w = sc.explore;
  w.boulder = [...w.sites.boulderStart];
  w.wild.clear();
  w.camp.clear();
  w.spawnT = 0;
  for (const area of ['meadow', 'forest'] as WildArea[]) topUp(sc, area, true);
  const ev = sc.s.explore.event;
  const at = eventCell(sc);
  if (ev?.kind === 'camp' && ev.stage === 0 && at) spawnCamp(sc, at);
}

function weightedPick(w: Partial<Record<MonsterId, number>>): MonsterId {
  const entries = Object.entries(w) as [MonsterId, number][];
  let r = Math.random() * entries.reduce((a, [, n]) => a + n, 0);
  for (const [id, n] of entries) {
    r -= n;
    if (r <= 0) return id;
  }
  return entries[0][0];
}

/** 把某个区域的怪补到上限。init 为真时可以出现在玩家附近以外的任何地方 */
function topUp(sc: PlayScene, area: WildArea, init = false): void {
  const w = sc.explore;
  const def = WILD[area];
  const night = isNight(sc);
  const cap = night ? def.cap.night : def.cap.day;
  let have = [...w.wild.values()].filter((v) => v.area === area).length;
  const cells = w.sites.wild[area];
  if (!cells.length) return;
  const p = sc.player;
  for (let tries = 0; have < cap && tries < 30; tries++) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    const [x, y] = center(c);
    // 不在玩家眼前冒出来
    if (Math.hypot(x - p.x, y - p.y) < (init ? 7 : 10) * TS) continue;
    const mid = weightedPick(night ? def.night : def.day);
    const m = new Monster(mid, x, y, night ? def.floor.night : def.floor.day);
    if (!sc.boxFree(x, y, m.hw, m.hh)) continue;
    sc.enemies.push(m);
    w.wild.set(m, { home: c, area });
    have++;
  }
}

function spawnCamp(sc: PlayScene, at: Cell): void {
  const w = sc.explore;
  const [fx, fy] = center(at);
  const spots: [number, number][] = [[-2, -1], [2, -1], [-1, 2], [2, 1], [-2, 1], [0, -2]];
  const ids: MonsterId[] = [];
  for (let i = 0; i < CAMP.minionCount; i++) ids.push(weightedPick(CAMP.minions));
  let i = 0;
  for (const [dx, dy] of spots) {
    if (i > ids.length) break;
    const x = fx + dx * TS;
    const y = fy + dy * TS;
    const elite = i === 0;
    const m = elite ? new Elite(CAMP.elite[sc.s.day % CAMP.elite.length], x, y) : new Monster(ids[i - 1], x, y, CAMP.floor);
    if (!sc.boxFree(x, y, m.hw, m.hh)) continue;
    sc.enemies.push(m);
    w.camp.add(m);
    i++;
  }
}

/** 小镇里每帧：户外怪物和战斗，跑远的怪回家，营地打完了就开宝箱 */
export function updateOutdoor(sc: PlayScene, dt: number): void {
  const w = sc.explore;
  for (const e of sc.enemies.slice()) e.update(sc, dt);
  combat.updateCombat(sc, dt);
  combat.updateShots(sc, dt);
  combat.updateOrbs(sc, dt);
  combat.updateHazards(sc, dt);
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
    for (const area of ['meadow', 'forest'] as WildArea[]) topUp(sc, area);
  }
}

/* ---------- 碰撞 ---------- */

/** 探险的东西占住的格子：石头、火盆、宝箱、营火、商人和旅人 */
export function exploreBlocked(sc: PlayScene, tx: number, ty: number): boolean {
  const w = sc.explore;
  if (same(w.boulder, tx, ty)) return true;
  if (BRAZIERS.some((b) => same(b, tx, ty))) return true;
  for (const id of HIDDEN_IDS) if (same(HIDDEN_CHESTS[id].at, tx, ty) && hiddenVisible(sc, id)) return true;
  const at = eventCell(sc);
  const ev = sc.s.explore.event;
  if (at && ev && ev.stage < 2 && same(at, tx, ty)) return true;
  const chest = campChestCell(sc);
  if (chest && same(chest, tx, ty)) return true;
  if (at && ev?.kind === 'camp' && same(at, tx, ty)) return true;
  return false;
}

/** 面前这一格能不能交互，用来画提示框 */
export function exploreHighlight(sc: PlayScene, tx: number, ty: number): boolean {
  const k = `${tx},${ty}`;
  if (sc.s.explore.digs.includes(k)) return true;
  const t = ex.mapTarget(sc.s);
  if (t && same(t, tx, ty)) return true;
  return exploreBlocked(sc, tx, ty);
}

/* ---------- 交互 ---------- */

/** 按 E：挖宝、推石头、点火盆、开宝箱、和商人旅人说话。处理了返回 true */
export function exploreInteract(sc: PlayScene, tx: number, ty: number): boolean {
  const s = sc.s;
  const w = sc.explore;
  const [ux, uy] = sc.player.tile();

  // 挖宝：面前或者脚下
  for (const [x, y] of [[tx, ty], [ux, uy]]) {
    const k = `${x},${y}`;
    const t = ex.mapTarget(s);
    const isMap = !!t && same(t, x, y);
    if (!isMap && !s.explore.digs.includes(k)) continue;
    digHere(sc, x, y, isMap);
    return true;
  }

  if (same(w.boulder, tx, ty)) {
    pushBoulder(sc, tx, ty);
    return true;
  }

  const bi = BRAZIERS.findIndex((b) => same(b, tx, ty));
  if (bi >= 0) {
    lightBrazier(sc, bi);
    return true;
  }

  for (const id of HIDDEN_IDS) {
    if (!same(HIDDEN_CHESTS[id].at, tx, ty) || !hiddenVisible(sc, id)) continue;
    const loot = ex.openHidden(s, id);
    if (!loot) sc.toast('宝箱已经空了');
    else {
      showLoot(sc, tx, ty, loot);
      sc.ui.dialog.say('宝箱', `打开了${HIDDEN_CHESTS[id].name}！${lootText(loot)}`);
    }
    return true;
  }

  const ev = s.explore.event;
  const at = eventCell(sc);
  const campChest = campChestCell(sc);
  if (ev && campChest && same(campChest, tx, ty)) {
    if (ev.stage === 0) sc.toast('宝箱被怪物守着，先把营地的怪全部打倒');
    else if (ev.stage === 1) {
      const chest = rollChest(s, CAMP.chestFloor);
      chest.gold += Math.round(CAMP.gold[0] + Math.random() * (CAMP.gold[1] - CAMP.gold[0]));
      const loot = ex.openCampChest(s, chest);
      if (loot) {
        showLoot(sc, tx, ty, loot);
        sc.ui.dialog.say('营地宝箱', `营地的宝箱里有：${lootText(loot)}`);
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
    sc.ui.dialog.say('猫头鹰·咕咕', '每天野外都会冒出几个闪光点，对着它按 E 就能挖。运气好还能挖到藏宝图，咕。', { face });
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
  const hadMap = s.explore.mapSpot;
  const loot = isMap ? ex.digMap(s) : ex.dig(s, `${x},${y}`);
  if (!loot) return;
  sc.sfx('chest');
  showLoot(sc, x, y, loot);
  if (isMap) {
    sc.fx.ring(px, py - 4, 28, 0.6, '#ffd34d');
    sc.ui.dialog.say('藏宝图', `挖到了藏宝图上的宝藏！${lootText(loot)}`);
  }
  // 新拿到的藏宝图：告诉玩家它指向哪里
  const spot = s.explore.mapSpot;
  if (spot >= 0 && spot !== hadMap) sc.ui.dialog.say('藏宝图', `得到了一张藏宝图。背面写着：「${MAP_SPOTS[spot].hint}」走近了地上会出现红叉。`);
  for (const id of Object.keys(loot.items) as ItemId[]) {
    if (ITEMS[id].kind === 'accessory') sc.ui.dialog.say('挖宝', `挖到了饰品【${ITEMS[id].name}】！在背包的装备页可以戴上。`);
  }
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

function lightBrazier(sc: PlayScene, i: number): void {
  const s = sc.s;
  if (s.explore.lit.includes(i)) {
    sc.toast('火盆已经点着了');
    return;
  }
  const all = ex.lightBrazier(s, i, BRAZIERS.length);
  const [x, y] = center(BRAZIERS[i]);
  sc.sfx('magic');
  sc.fx.burst(x, y - 10, '#ff8a3a', 12, 40);
  if (!all) {
    sc.toast(`点亮了火盆（${s.explore.lit.length}/${BRAZIERS.length}）。火只能烧到今晚`);
    return;
  }
  const [cx, cy] = center(HIDDEN_CHESTS.brazier.at);
  sc.fx.ring(cx, cy - 4, 30, 0.6, '#ff8a3a');
  sc.fx.burst(cx, cy - 4, '#ffd34d', 20, 70);
  sc.sfx('levelup');
  sc.toast(ex.isOpened(s, 'brazier') ? '三个火盆都亮了' : '三个火盆都亮了，空地中间出现了一个宝箱！');
}

function merchantMenu(sc: PlayScene): void {
  const s = sc.s;
  const choices: Choice[] = ex.merchantStock(s).map((it) => ({
    label: `${ITEMS[it.id].name}　${it.price} 金`,
    note: it.soldOut ? '已经卖完了' : ITEMS[it.id].desc,
    disabled: it.soldOut || s.gold < it.price,
    onSelect: () => {
      const r = ex.buyFromMerchant(s, it);
      sc.toast(r.msg);
      if (!r.ok) return;
      sc.sfx('coin');
      if (it.id === 'treasureMap' && s.explore.mapSpot >= 0) {
        sc.ui.dialog.say('流浪商人', `这张图上画的是：「${MAP_SPOTS[s.explore.mapSpot].hint}」祝你好运。`);
      }
      merchantMenu(sc);
    },
  }));
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
      showLoot(sc, x, y, loot);
      sc.ui.dialog.say('旅人', `谢谢你！这些是我在路上捡到的，送给你吧。${lootText(loot)}`, { face });
      if (loot.items.treasureMap && s.explore.mapSpot >= 0) sc.ui.dialog.say('藏宝图', `藏宝图背面写着：「${MAP_SPOTS[s.explore.mapSpot].hint}」`);
    },
  }));
  choices.push({ label: '下次再说' });
  sc.ui.dialog.say('旅人', '我被怪物咬伤了……能分我一点吃的或者药吗？', { face, choices });
}

/* ---------- 奖励显示 ---------- */

function lootText(loot: Loot): string {
  const parts = Object.entries(loot.items).map(([id, n]) => `${ITEMS[id as ItemId].name}×${n}`);
  if (loot.gold) parts.unshift(`${loot.gold} 金币`);
  return `获得 ${parts.join('、')}。`;
}

function showLoot(sc: PlayScene, tx: number, ty: number, loot: Loot): void {
  const [x, y] = center([tx, ty]);
  if (loot.gold) sc.fx.text(x, y - 14, `+${loot.gold} G`, '#ffcf5a');
  let dy = 8;
  for (const [id, n] of Object.entries(loot.items) as [ItemId, number][]) {
    sc.fx.text(x, y - 14 - dy, `+${n} ${ITEMS[id].name}`, ITEMS[id].color);
    dy += 8;
  }
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

type DrawList = { y: number; d: () => void }[];

/** 画探险的东西：闪光点和红叉直接画在地上，其他的放进按 y 排序的列表 */
export function drawExplore(sc: PlayScene, b: CanvasRenderingContext2D, cx: number, cy: number, list: DrawList): void {
  const s = sc.s;
  const w = sc.explore;
  const t = sc.clock;
  const onScreen = (x: number, y: number) => x * TS - cx > -24 && x * TS - cx < 504 && y * TS - cy > -40 && y * TS - cy < 290;

  // 闪光点：一闪一闪的小星星
  for (const k of s.explore.digs) {
    const [x, y] = k.split(',').map(Number);
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
  const target = ex.mapTarget(s);
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

  const [bx, by] = w.boulder;
  if (onScreen(bx, by)) list.push({ y: by * TS + 14, d: () => b.drawImage(boulderImg, bx * TS - cx, by * TS - cy) });
  BRAZIERS.forEach(([x, y], i) => {
    if (!onScreen(x, y)) return;
    const lit = s.explore.lit.includes(i);
    list.push({ y: y * TS + 14, d: () => b.drawImage(lit ? brazierImgs.on : brazierImgs.off, x * TS - cx, y * TS - cy - 4) });
  });
  for (const id of HIDDEN_IDS) {
    const c = HIDDEN_CHESTS[id];
    if (!hiddenVisible(sc, id) || !onScreen(c.at[0], c.at[1])) continue;
    const img = hiddenChestImg(c.color, ex.isOpened(s, id));
    list.push({ y: c.at[1] * TS + 14, d: () => b.drawImage(img, c.at[0] * TS - cx, c.at[1] * TS - cy) });
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
  const out: [number, number][] = BRAZIERS.filter((_, i) => sc.s.explore.lit.includes(i)).map((c) => center(c));
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
      const t = ex.mapTarget(s);
      body.append(h('section', { class: 'card' },
        h('h3', { text: '藏宝图' }),
        h('p', { text: t ? `「${MAP_SPOTS[s.explore.mapSpot].hint}」走近了地上会出现红叉，按 E 挖。` : '手上没有藏宝图。挖宝、帮助旅人、找流浪商人都有机会拿到。' }),
        h('p', { class: 'muted', text: `今天野外还有 ${s.explore.digs.length} 个闪光点没挖。${s.explore.event ? eventLine(sc) : ''}` }),
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
  const where = EVENT_SPOTS[ev.kind][ev.spot]?.where ?? '';
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
    sc.ui.panel.refresh();
  });
  return bt;
}
