import type { Input } from '../../core/Input';
import { TS, VH, VW } from '../../core/constants';
import type { BuildId, Craft, PlacedBuild } from '../../data/buildings';
import {
  BUILDS, CHICKEN_PRICE, FACILITY_IDS, FARM_LOT, HOUSES, MAX_CHICKENS, SMELT, WORKBENCH, buildDef,
} from '../../data/buildings';
import { CROPS } from '../../data/crops';
import type { ForageArea, ItemId } from '../../data/items';
import { ITEMS, ITEM_IDS } from '../../data/items';
import { buildImg, drawChicken } from '../../gfx/home';
import { iconUrl, itemIcon } from '../../gfx/tiles';
import { count } from '../../state/save';
import * as home from '../../systems/home';
import { h } from '../../ui/dom';
import type { Choice } from '../../ui/UI';
import { itemCell } from '../../ui/UI';
import type { Overworld } from '../../world/overworld';
import { Tile } from '../../world/TileMap';
import type { PlayScene } from '../PlayScene';

/** 家园在场景里的部分：把房子和农场上的设施画进地图、摆放模式、各个设施的菜单 */

export interface Placing {
  id: BuildId;
  /** 当前预览的左上角 */
  x: number;
  y: number;
  err: string | null;
  key: string;
}

const itemName = (id: ItemId) => ITEMS[id].name;

/* ---------- 把家园画进地图 ---------- */

interface Pristine {
  tiles: Uint8Array;
  forage: Record<ForageArea, [number, number][]>;
  dig: [number, number][];
  homeW: number;
}
const pristine = new WeakMap<Overworld, Pristine>();

/** 按存档重新铺一遍家园：房子大小、设施和装饰占的格子、今天敲掉的石头、采集点 */
export function applyHome(sc: PlayScene): void {
  const ow = sc.overworld;
  const m = ow.map;
  const s = sc.s;
  const homeB = ow.buildings.find((b) => b.kind === 'home');
  let p = pristine.get(ow);
  if (!p) {
    p = {
      tiles: m.t.slice(),
      forage: { forest: [...ow.forage.forest], meadow: [...ow.forage.meadow], beach: [...ow.forage.beach] },
      dig: [...sc.explore.sites.digCells],
      homeW: homeB?.w ?? 6,
    };
    pristine.set(ow, p);
  }
  m.t.set(p.tiles);

  if (homeB) {
    const hd = home.houseOf(s);
    homeB.wall = hd.wall;
    homeB.roof = hd.roof;
    homeB.w = Math.max(p.homeW, hd.w);
    m.fill(homeB.x, homeB.y, homeB.x + homeB.w - 1, homeB.y + homeB.h - 1, Tile.WALL);
    m.set(homeB.door[0], homeB.door[1], Tile.DOOR);
  }
  for (const k of s.home.quarried) {
    const [x, y] = k.split(',').map(Number);
    if (m.get(x, y) === Tile.STONE) m.set(x, y, Tile.GRASS);
  }
  for (const b of s.home.builds) for (const [x, y] of home.footprint(b.id, b.x, b.y)) m.set(x, y, Tile.BUILT);

  for (const area of ['forest', 'meadow', 'beach'] as ForageArea[]) ow.forage[area] = p.forage[area].filter(([x, y]) => !m.solid(x, y));
  for (const k of Object.keys(s.forage)) {
    const [x, y] = k.split(',').map(Number);
    if (m.solid(x, y)) delete s.forage[k];
  }
  // 挖宝点也不能冒在设施底下
  sc.explore.sites.digCells = p.dig.filter(([x, y]) => !m.solid(x, y));
  s.explore.digs = s.explore.digs.filter((k) => {
    const [x, y] = k.split(',').map(Number);
    return !m.solid(x, y);
  });
}

const woodSpots = (sc: PlayScene): [number, number][] => [...sc.overworld.forage.forest, ...sc.overworld.forage.meadow];

/** 进入游戏时调用 */
export function enterHome(sc: PlayScene): void {
  applyHome(sc);
  home.spawnWood(sc.s, woodSpots(sc));
}

/** 新的一天：在 advanceDay、清掉料理效果之后调用，返回早上的消息 */
export function homeNewDay(sc: PlayScene): string[] {
  const msgs = home.homeMorning(sc.s);
  applyHome(sc);
  home.spawnWood(sc.s, woodSpots(sc));
  return msgs;
}

/* ---------- 家里的菜单 ---------- */

/** 房子菜单里追加的选项：扩建、家园建造 */
export function homeChoices(sc: PlayScene): Choice[] {
  const s = sc.s;
  const next = home.nextHouse(s);
  const out: Choice[] = [];
  if (next?.cost) {
    const cost = next.cost;
    out.push({
      label: `扩建成${next.name}`,
      note: `${home.costText(cost)} · ${next.desc}`,
      disabled: !home.canPay(s, cost),
      onSelect: () => {
        const r = home.upgradeHouse(s);
        if (r !== 'ok') return sc.toast('材料不够');
        sc.ui.fade.run(`${next.name}盖好了`, () => {
          applyHome(sc);
          sc.sfx('levelup');
          sc.autosave();
          sc.ui.dialog.say('家', `房子扩建成了${next.name}。仓库箱有 ${next.storage} 格，厨房也能做新菜了。`);
        }, 900);
      },
    });
  }
  const tier = home.comfortTier(s);
  out.push({
    label: '家园建造',
    note: `盖设施、摆洒水器和装饰 · 舒适度 ${home.comfort(s)}${tier ? `（${tier.name}）` : ''}`,
    onSelect: () => buildPanel(sc),
  });
  return out;
}

export function homeGreeting(sc: PlayScene): string {
  const hd = home.houseOf(sc.s);
  return sc.s.home.house === 0 ? '祖母的旧房子。床还挺软的，灶台也还能用。' : `你的${hd.name}。${hd.desc}`;
}

const thumb = (img: HTMLCanvasElement) => h('img', { src: iconUrl(img), alt: '', style: 'object-fit: contain' });

function buildPanel(sc: PlayScene, tab?: string): void {
  sc.ui.panel.show('家园建造', [
    {
      id: 'facility',
      label: '设施',
      render: (body) => {
        const s = sc.s;
        const list = h('div', { class: 'recipes' });
        for (const id of FACILITY_IDS) {
          const d = buildDef(id);
          const built = home.hasBuild(s, id);
          const block = home.buildBlocker(s, id);
          const needs = (Object.entries(d.cost?.items ?? {}) as [ItemId, number][]).map(([it, n]) =>
            h('span', { class: count(s, it) >= n ? 'have' : 'miss', text: `${itemName(it)} ${count(s, it)}/${n}` }));
          if (d.cost?.gold) needs.unshift(h('span', { class: s.gold >= d.cost.gold ? 'have' : 'miss', text: `${d.cost.gold} 金` }));
          const lock = (d.house ?? 0) > s.home.house ? `需要${HOUSES[d.house ?? 0].name}` : '';
          const row = h('button', { type: 'button', class: `recipe${block ? ' off' : ''}`, 'data-nav': '' },
            thumb(buildImg(id)),
            h('div', {}, h('b', { text: d.name }), h('small', { text: d.desc }), h('p', {}, ...needs)),
            h('em', { text: built ? '已建好' : lock || `${d.w}×${d.h} 格` }),
          );
          row.addEventListener('click', () => {
            if (block) {
              sc.sfx('fail');
              sc.toast(block);
              return;
            }
            startPlacing(sc, id);
          });
          list.append(row);
        }
        body.append(h('p', { class: 'muted', text: '设施盖在房子东边的空地，或者农场围栏东边。木材在林子和草地上捡，石料用镐敲地上的石头。' }), list);
      },
    },
    {
      id: 'place',
      label: '摆放',
      render: (body) => {
        const s = sc.s;
        const ids = ITEM_IDS.filter((it) => (ITEMS[it] as { place?: string }).place && count(s, it) > 0);
        if (!ids.length) {
          body.append(h('p', { class: 'empty', text: '背包里没有能摆的东西。洒水器、篱笆、花坛、长椅和萤石灯都在工作台上做。' }));
          return;
        }
        const grid = h('div', { class: 'grid' });
        for (const it of ids) {
          const cell = itemCell(itemIcon(it), itemName(it), count(s, it), { title: ITEMS[it].desc });
          cell.addEventListener('click', () => startPlacing(sc, (ITEMS[it] as { place?: string }).place as BuildId));
          grid.append(cell);
        }
        body.append(h('p', { class: 'muted', text: '洒水器摆在田里，装饰摆在空地上。摆得越多舒适度越高，睡醒以后会带上回复效果。摆好的东西面对它按 E 可以收起。' }), grid);
      },
    },
    {
      id: 'house',
      label: '房子',
      render: (body) => {
        const s = sc.s;
        const list = h('div', { class: 'recipes' });
        HOUSES.forEach((hd, i) => {
          const needs = hd.cost ? home.costText(hd.cost) : '一开始就有';
          list.append(h('div', { class: `recipe${i > s.home.house ? ' off' : ''}` },
            h('div', {},
              h('b', { text: hd.name }),
              h('small', { text: `仓库 ${hd.storage} 格 · 熬夜后体力 ${hd.lateEnergy} · 舒适度 +${hd.comfort}` }),
              h('p', {}, h('span', { text: i === 0 ? hd.desc : `${hd.desc} 需要：${needs}` })),
            ),
            h('em', { text: i === s.home.house ? '现在' : i < s.home.house ? '已完成' : '' }),
          ));
        });
        const tier = home.comfortTier(s);
        body.append(
          h('p', { class: 'muted', text: `舒适度 ${home.comfort(s)}：${tier ? `${tier.name}，早上醒来每秒回复 ${tier.regen} 生命，到中午为止` : '达到 6 以后，早上醒来会带上回复效果'}。扩建在家门口的菜单里。` }),
          list,
        );
      },
    },
  ], { tab });
}

/* ---------- 摆放模式 ---------- */

export function startPlacing(sc: PlayScene, id: BuildId): void {
  sc.ui.closeAll();
  sc.placing = { id, x: 0, y: 0, err: null, key: '' };
  updateGhost(sc);
  sc.toast(`摆放${buildDef(id).name}：走到想放的地方按 E，K 或 Esc 取消`);
}

export function cancelPlacing(sc: PlayScene): void {
  if (!sc.placing) return;
  sc.placing = null;
  sc.toast('取消了摆放');
}

/** 预览框放在玩家面前：朝上时预览在上方，以此类推 */
function updateGhost(sc: PlayScene): void {
  const pl = sc.placing;
  if (!pl) return;
  const d = buildDef(pl.id);
  const [fx, fy] = sc.player.frontTile();
  const p = sc.player;
  let x = fx - Math.floor((d.w - 1) / 2);
  let y = fy - Math.floor((d.h - 1) / 2);
  if (p.fy < 0) y = fy - d.h + 1;
  else if (p.fy > 0) y = fy;
  else if (p.fx < 0) x = fx - d.w + 1;
  else if (p.fx > 0) x = fx;
  const key = `${x},${y}`;
  if (key === pl.key) return;
  pl.x = x;
  pl.y = y;
  pl.key = key;
  pl.err = sc.mode === 'town' ? home.placeError(sc.map, sc.s, FARM_LOT, pl.id, x, y) : '只能摆在农场上';
}

/** 摆放模式下每帧调用，代替平时的攻击、工具和交互 */
export function updatePlacing(sc: PlayScene, input: Input): void {
  const pl = sc.placing;
  if (!pl) return;
  updateGhost(sc);
  if (input.pressed('attack')) return cancelPlacing(sc);
  if (!input.pressed('interact') && !input.pressed('tool')) return;
  if (pl.err) {
    sc.sfx('fail');
    sc.toast(pl.err);
    return;
  }
  const d = buildDef(pl.id);
  if (!home.place(sc.s, pl.id, pl.x, pl.y)) {
    sc.sfx('fail');
    sc.toast(home.buildBlocker(sc.s, pl.id) ?? '盖不了');
    sc.placing = null;
    return;
  }
  applyHome(sc);
  sc.sfx(d.kind === 'facility' ? 'forge' : 'plant');
  sc.fx.burst((pl.x + d.w / 2) * TS, (pl.y + d.h) * TS - 4, '#d9bb83', 12, 50);
  sc.autosave();
  // 篱笆这类东西常常要连着摆，背包里还有就继续
  if (d.item && count(sc.s, d.item) > 0) {
    pl.key = '';
    updateGhost(sc);
    sc.toast(`摆好了，还剩 ${count(sc.s, d.item)} 个。K 或 Esc 结束摆放`);
    return;
  }
  sc.placing = null;
  sc.toast(d.kind === 'facility' ? `${d.name}盖好了！面对它按 E 使用` : `${d.name}摆好了`);
}

/* ---------- 和设施互动 ---------- */

/** 面前是自己盖的东西时打开它的菜单，返回 true 表示处理了 */
export function homeInteract(sc: PlayScene, tx: number, ty: number): boolean {
  if (sc.mode !== 'town') return false;
  const b = home.buildAt(sc.s, tx, ty);
  if (!b) return false;
  sc.sfx('door');
  switch (b.id) {
    case 'workbench': craftPanel(sc, '工作台', WORKBENCH, '用木材、锭和怪物素材做东西。洒水器和装饰做好以后在家里的“家园建造”里摆放。'); break;
    case 'furnace': craftPanel(sc, '熔炉', SMELT, '5 块矿石加一点木材当燃料，炼成 1 块锭。'); break;
    case 'coop': coopMenu(sc); break;
    case 'greenhouse': greenPanel(sc); break;
    default: pickUpMenu(sc, b);
  }
  return true;
}

function craftPanel(sc: PlayScene, title: string, list: Craft[], tip: string): void {
  sc.ui.panel.show(title, [{
    id: 'craft',
    label: title,
    render: (body) => {
      const s = sc.s;
      const box = h('div', { class: 'recipes' });
      for (const c of list) {
        const ok = home.canCraft(s, c);
        const needs = (Object.entries(c.needs.items) as [ItemId, number][]).map(([id, n]) =>
          h('span', { class: count(s, id) >= n ? 'have' : 'miss', text: `${itemName(id)} ${count(s, id)}/${n}` }));
        const row = h('button', { type: 'button', class: `recipe${ok ? '' : ' off'}`, 'data-nav': '' },
          h('img', { src: iconUrl(itemIcon(c.out)), alt: '' }),
          h('div', {}, h('b', { text: `${itemName(c.out)}${c.n > 1 ? ` ×${c.n}` : ''}` }), h('small', { text: ITEMS[c.out].desc }), h('p', {}, ...needs)),
          h('em', { text: count(s, c.out) ? `已有 ${count(s, c.out)}` : '' }),
        );
        row.addEventListener('click', () => {
          if (!home.craft(s, c)) {
            sc.sfx('fail');
            sc.toast('材料不够');
            return;
          }
          sc.sfx('forge');
          sc.toast(`做好了【${itemName(c.out)}】${c.n > 1 ? ` ×${c.n}` : ''}`);
          sc.ui.panel.refresh();
        });
        box.append(row);
      }
      body.append(h('p', { class: 'muted', text: tip }), box);
    },
  }]);
}

function coopMenu(sc: PlayScene): void {
  const s = sc.s;
  const hm = s.home;
  const choices: Choice[] = [];
  if (hm.eggs > 0) {
    choices.push({
      label: `捡鸡蛋 ×${hm.eggs}`,
      onSelect: () => {
        const n = home.collectEggs(s);
        sc.sfx('pickup');
        sc.fx.text(sc.player.x, sc.player.y - 26, `+${n} 鸡蛋`, ITEMS.egg.color);
      },
    });
  }
  if (hm.chickens < MAX_CHICKENS) {
    choices.push({
      label: `买一只小鸡（${hm.chickens}/${MAX_CHICKENS}）`,
      note: `${CHICKEN_PRICE} 金 · 每只鸡每天下一个蛋，蛋最多攒 3 天`,
      disabled: s.gold < CHICKEN_PRICE,
      onSelect: () => {
        if (!home.buyChicken(s)) return;
        sc.sfx('coin');
        sc.autosave();
        coopMenu(sc);
      },
    });
  }
  choices.push({ label: '离开' });
  const text = hm.chickens
    ? `${hm.chickens} 只鸡在稻草里咕咕叫。${hm.eggs ? `窝里有 ${hm.eggs} 个蛋。` : '今天的蛋已经捡完了，明天早上再来。'}`
    : '空荡荡的鸡舍，铺好了稻草。买几只小鸡吧。';
  sc.ui.dialog.say('鸡舍', text, { choices });
}

let greenSeed: ItemId | null = null;

function greenPanel(sc: PlayScene): void {
  sc.ui.panel.show('温室', [{
    id: 'green',
    label: '温室',
    render: (body) => {
      const s = sc.s;
      const seeds = ITEM_IDS.filter((id) => ITEMS[id].kind === 'seed' && count(s, id) > 0);
      if (!greenSeed || !seeds.includes(greenSeed)) greenSeed = seeds[0] ?? null;
      const seedRow = h('div', { class: 'grid' });
      for (const id of seeds) {
        const cell = itemCell(itemIcon(id), itemName(id), count(s, id));
        if (id === greenSeed) cell.classList.add('sel');
        cell.addEventListener('click', () => {
          greenSeed = id;
          sc.ui.panel.refresh();
        });
        seedRow.append(cell);
      }
      const plots = h('div', { class: 'grid' });
      s.home.greenhouse.forEach((p, i) => {
        let cell: HTMLButtonElement;
        if (!p.crop) {
          cell = greenSeed
            ? itemCell(itemIcon(greenSeed), '空地', undefined, { title: `种下${itemName(greenSeed)}`, off: true })
            : itemCell(itemIcon('radishSeed'), '空地', undefined, { off: true });
        } else {
          const def = CROPS[p.crop];
          const ripe = home.greenRipe(s, i);
          cell = itemCell(itemIcon(def.item), ripe ? `${def.name} 可收获` : `${def.name} ${p.days}/${def.days}`, undefined, { off: !ripe });
        }
        cell.addEventListener('click', () => {
          if (p.crop) {
            const got = home.harvestGreen(s, i);
            if (got) {
              sc.sfx('pickup');
              sc.toast(`收获了【${itemName(got)}】`);
            } else sc.toast('还没长好');
          } else if (greenSeed && home.plantGreen(s, i, greenSeed)) sc.sfx('plant');
          else return sc.toast('背包里没有种子了');
          sc.ui.panel.refresh();
        });
        plots.append(cell);
      });
      body.append(
        h('p', { class: 'muted', text: '温室里四季都能种，不用浇水，每天早上长一天。先在上面选种子，再点空地种下。' }),
        h('h3', { text: '种子' }),
        seeds.length ? seedRow : h('p', { class: 'empty', text: '背包里没有种子。' }),
        h('h3', { text: '苗圃' }),
        plots,
      );
    },
  }]);
}

function pickUpMenu(sc: PlayScene, b: PlacedBuild): void {
  const d = buildDef(b.id);
  const text = d.kind === 'sprinkler' ? `${d.name}。${d.desc}` : `${d.name}。舒适度 +${d.comfort ?? 0}。`;
  sc.ui.dialog.say(d.name, text, {
    choices: [
      {
        label: '收起来',
        note: '放回背包，可以换个地方再摆',
        onSelect: () => {
          if (!home.pickUp(sc.s, b)) return;
          applyHome(sc);
          sc.sfx('pickup');
          sc.autosave();
        },
      },
      { label: '离开' },
    ],
  });
}

/* ---------- 建材 ---------- */

/** 镐敲小镇地上的石头；返回 true 表示处理了 */
export function tryQuarry(sc: PlayScene, tx: number, ty: number, energy: number): boolean {
  if (sc.mode !== 'town' || sc.map.get(tx, ty) !== Tile.STONE) return false;
  if (sc.s.en < energy) {
    sc.toast('太累了，敲不动了');
    return true;
  }
  sc.s.en -= energy;
  const n = home.quarry(sc.s, tx, ty);
  sc.map.set(tx, ty, Tile.GRASS);
  sc.sfx('dig');
  sc.fx.burst(tx * TS + 8, ty * TS + 10, ITEMS.stone.color, 8, 40);
  if (n) sc.fx.text(tx * TS + 8, ty * TS, `+${n} 石料`, ITEMS.stone.color);
  return true;
}

/** 挖碎矿石时顺带掉的石料 */
export function oreStoneBonus(sc: PlayScene, tx: number, ty: number): void {
  if (home.oreStone(sc.s)) sc.fx.text(tx * TS + 8, ty * TS - 8, '+1 石料', ITEMS.stone.color);
}

/* ---------- 绘制 ---------- */

/** 农场上的设施和装饰，按脚底 y 排序后和其他东西一起画 */
export function homeDrawables(sc: PlayScene, cx: number, cy: number, lit: boolean): { y: number; d: () => void }[] {
  const { b } = sc.game.renderer;
  const out: { y: number; d: () => void }[] = [];
  for (const bd of sc.s.home.builds) {
    const d = BUILDS[bd.id];
    const img = buildImg(bd.id, lit && (bd.id === 'lantern' || bd.id === 'coop'));
    const x = bd.x * TS - cx;
    const bottom = (bd.y + d.h) * TS - cy;
    if (x > VW + 8 || x + img.width < -8 || bottom < -8 || bottom - img.height > VH + 8) continue;
    out.push({ y: (bd.y + d.h) * TS - 1, d: () => b.drawImage(img, x, bottom - img.height) });
    if (bd.id === 'coop') {
      for (let i = 0; i < sc.s.home.chickens; i++) {
        const t = sc.clock + i * 1.7;
        const wx = x + 8 + i * 14 + Math.sin(t * 0.6) * 5;
        const wy = bottom + 6 + (i % 2) * 4;
        out.push({ y: (bd.y + d.h) * TS + 6 + (i % 2) * 4, d: () => drawChickenAt(sc, wx, wy, t) });
      }
    }
  }
  return out;
}

function drawChickenAt(sc: PlayScene, x: number, y: number, t: number): void {
  // 晚上鸡都回窝里了
  if (sc.s.time > 19 * 60) return;
  drawChicken(sc.game.renderer.b, x, y, t, Math.cos(t * 0.6) < 0);
}

/** 摆放模式下的预览框：能放是绿色，不能放是红色 */
export function drawGhost(sc: PlayScene, cx: number, cy: number): void {
  const pl = sc.placing;
  if (!pl) return;
  const { b } = sc.game.renderer;
  const d = buildDef(pl.id);
  const img = buildImg(pl.id);
  const x = pl.x * TS - cx;
  const bottom = (pl.y + d.h) * TS - cy;
  b.globalAlpha = 0.55;
  b.drawImage(img, x, bottom - img.height);
  b.globalAlpha = 1;
  b.fillStyle = pl.err ? 'rgba(239,93,93,.35)' : 'rgba(127,255,176,.3)';
  b.fillRect(x, pl.y * TS - cy, d.w * TS, d.h * TS);
  b.strokeStyle = pl.err ? '#ef5d5d' : '#7fffb0';
  b.lineWidth = 1;
  b.strokeRect(x + 0.5, pl.y * TS - cy + 0.5, d.w * TS - 1, d.h * TS - 1);
}
