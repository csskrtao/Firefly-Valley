import { TS, VH, VW } from '../../core/constants';
import { TAU, hash, rnd } from '../../core/math';
import type { CropId } from '../../data/crops';
import { CROPS } from '../../data/crops';
import { floorName, zoneFor } from '../../data/floors';
import { WEAPON_TIERS } from '../../data/equipment';
import type { ItemDef, ItemId } from '../../data/items';
import { ITEMS } from '../../data/items';
import type { Img } from '../../gfx/sprite';
import { draw } from '../../gfx/sprite';
import { TREE_H, benchTile, bridgeTile, bushTiles, chestImg, forageGlyph, forestTiles, lampImgs, sandTile, signTiles, stoneTiles, tallTrees } from '../../gfx/decor';
import { CHAR_FOOT, frameFor, walkFrame } from '../../gfx/character';
import { npcChars, playerChar } from '../../gfx/people';
import {
  binTile, caveTile, cliffTile, fenceTiles, fieldTile, flowerTiles, grassTiles, mineTiles, oreImg, pathTile, plazaTile, tilledTile, wetTile,
} from '../../gfx/tiles';
import { seasonOf } from '../../state/save';
import { nightAlpha } from '../../systems/time';
import { weaponTypeOf } from '../../systems/stats';
import { isRanged } from '../../data/weapons';
import type { Building } from '../../world/overworld';
import { Tile } from '../../world/TileMap';
import type { PlayScene } from '../PlayScene';
import { drawShot, drawStrikes, lightMul, orbCount, orbPos } from './combat';
import { drawExplore, exploreHighlight, exploreLights } from './explore';

const dark = document.createElement('canvas');
dark.width = VW;
dark.height = VH;
const dk = dark.getContext('2d')!;

export function renderPlay(sc: PlayScene): void {
  const { b } = sc.game.renderer;
  const map = sc.map;
  sc.camera.follow(sc.player.x, sc.player.y - 10, map.w * TS, map.h * TS);
  const cx = sc.camera.ox;
  const cy = sc.camera.oy;
  const season = seasonOf(sc.s.day);
  const town = sc.mode === 'town';
  const ow = sc.overworld;

  b.fillStyle = '#0b0910';
  b.fillRect(0, 0, VW, VH);

  const x0 = Math.max(0, Math.floor(cx / TS));
  const y0 = Math.max(0, Math.floor(cy / TS));
  const x1 = Math.min(map.w - 1, Math.floor((cx + VW) / TS));
  const y1 = Math.min(map.h - 1, Math.floor((cy + VH) / TS));
  const mt = town ? null : mineTiles(sc.floor === zoneFor(sc.floor).boss.floor ? zoneFor(sc.floor).boss.pal : zoneFor(sc.floor).pal);
  const night = nightAlpha(sc.s.time) > 0.25;

  // 按 y 排序绘制，前后遮挡正确。高过一格的东西（树、路灯、房子）也放进来
  const list: { y: number; d: () => void }[] = [];
  const inForest = (x: number, y: number) => x >= ow.forest[0] && x <= ow.forest[2] && y >= ow.forest[1] && y <= ow.forest[3];

  // 树冠会伸到上面一格多，所以多扫两行
  for (let y = y0; y <= Math.min(map.h - 1, y1 + 2); y++) {
    for (let x = Math.max(0, x0 - 1); x <= Math.min(map.w - 1, x1 + 1); x++) {
      const t = map.get(x, y);
      const px = x * TS - cx;
      const py = y * TS - cy;
      const visible = y <= y1 && x >= x0 && x <= x1;
      if (mt) {
        if (!visible) continue;
        if (t === Tile.ROCK) b.drawImage(mt.wall, px, py);
        else {
          b.drawImage(mt.floor[hash(x, y) < 0.5 ? 0 : 1], px, py);
          if (t === Tile.STAIRS) b.drawImage(mt.stairs, px, py);
          else if (t === Tile.LADDER) b.drawImage(mt.ladder, px, py);
        }
        continue;
      }
      if (t === Tile.TREE) {
        const img = tallTrees[season][inForest(x, y) ? (hash(x, y * 3) < 0.55 ? 2 : Math.floor(hash(x * 5, y) * 2)) : hash(x * 5, y) < 0.15 ? 2 : Math.floor(hash(x * 5, y) * 2)];
        list.push({ y: y * TS + 14, d: () => b.drawImage(img, px - 4, py + TS - TREE_H) });
      } else if (t === Tile.LAMP) {
        list.push({ y: y * TS + 14, d: () => b.drawImage(night ? lampImgs.on : lampImgs.off, px, py - 16) });
      }
      if (!visible) continue;
      const grass = grassTiles[season][Math.floor(hash(x, y) * 3)];
      switch (t) {
        case Tile.GRASS: b.drawImage(grass, px, py); break;
        case Tile.FOREST: b.drawImage(forestTiles[season][hash(x, y) < 0.5 ? 0 : 1], px, py); break;
        case Tile.PATH: case Tile.WALL: case Tile.DOOR: b.drawImage(pathTile, px, py); break;
        case Tile.PLAZA: b.drawImage(plazaTile, px, py); break;
        case Tile.SAND: b.drawImage(sandTile, px, py); break;
        case Tile.WATER: case Tile.FOUNTAIN: drawWater(sc, x, y, px, py, t === Tile.FOUNTAIN, season); break;
        case Tile.BRIDGE: drawBridge(sc, x, y, px, py, season); break;
        case Tile.TREE: b.drawImage(inForest(x, y) ? forestTiles[season][0] : grass, px, py); break;
        case Tile.LAMP: b.drawImage(map.get(x, y - 1) === Tile.PLAZA || map.get(x, y + 1) === Tile.PLAZA ? plazaTile : grass, px, py); break;
        case Tile.FIELD: b.drawImage(fieldTile, px, py); break;
        case Tile.FENCE: b.drawImage(fenceTiles[season], px, py); break;
        case Tile.FLOWER: b.drawImage(inForest(x, y) ? forestTiles[season][1] : grass, px, py); b.drawImage(flowerTiles[season][Math.floor(hash(y, x) * 2)], px, py); break;
        case Tile.CAVE: b.drawImage(caveTile, px, py); break;
        case Tile.CLIFF: case Tile.ROCK: b.drawImage(cliffTile, px, py); break;
        case Tile.BIN: b.drawImage(binTile, px, py); break;
        case Tile.BUSH: b.drawImage(bushTiles[season], px, py); break;
        case Tile.STONE: b.drawImage(stoneTiles[season], px, py); break;
        case Tile.SIGN: b.drawImage(signTiles[season], px, py); break;
        case Tile.BENCH: b.drawImage(plazaTile, px, py); b.drawImage(benchTile, px, py); break;
      }
      if (t === Tile.FIELD) {
        const f = sc.s.field[`${x},${y}`];
        if (f) {
          b.drawImage(f.watered ? wetTile : tilledTile, px, py);
          if (f.crop) drawCrop(b, f.crop, f.days, px, py, sc.clock);
        }
      }
    }
  }
  if (town) {
    for (const bd of ow.buildings) {
      const bx = bd.x * TS - cx;
      const by = bd.y * TS - cy;
      if (bx > VW + 8 || by > VH + 8 || bx + bd.w * TS < -8 || by + bd.h * TS < -40) continue;
      list.push({ y: (bd.y + bd.h) * TS - 1, d: () => drawBuilding(sc, bd, cx, cy) });
    }
    // 地上的采集物
    for (const [k, id] of Object.entries(sc.s.forage)) {
      const [x, y] = k.split(',').map(Number);
      if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) continue;
      const bob = Math.round(Math.sin(sc.clock * 3 + x + y) * 0.6);
      b.drawImage(forageImg(id), x * TS - cx, y * TS - cy + bob);
    }
    drawExplore(sc, b, cx, cy, list);
  }

  // 面前可交互格子的提示框
  if (!sc.ui.modal) {
    const [tx, ty] = sc.player.frontTile();
    const t = map.get(tx, ty);
    const show = town
      ? t === Tile.FIELD || t === Tile.DOOR || t === Tile.BIN || t === Tile.CAVE || t === Tile.SIGN || exploreHighlight(sc, tx, ty)
      : t === Tile.STAIRS || t === Tile.LADDER || sc.ores.some((o) => o.tx === tx && o.ty === ty) || sc.chests.some((c) => !c.open && c.tx === tx && c.ty === ty);
    if (show) {
      b.strokeStyle = 'rgba(255,255,255,.55)';
      b.lineWidth = 1;
      b.strokeRect(tx * TS - cx + 0.5, ty * TS - cy + 0.5, 15, 15);
    }
  }

  for (const [x, y] of sc.crystals) {
    const px = x * TS + 8 - cx;
    const py = y * TS + 10 - cy;
    b.fillStyle = '#62f0d6';
    b.fillRect(px, py - 4, 2, 5);
    b.fillRect(px - 2, py - 2, 2, 3);
    b.fillRect(px + 2, py - 1, 2, 2);
    b.fillStyle = '#c8fff4';
    b.fillRect(px, py - 4, 1, 2);
  }

  for (const hz of sc.hazards) {
    const armed = hz.arm <= 0;
    b.globalAlpha = armed ? 0.55 : 0.18 + 0.15 * Math.sin(sc.clock * 25);
    b.fillStyle = hz.color;
    b.beginPath();
    b.ellipse(hz.x - cx, hz.y - cy, hz.r, hz.r * 0.6, 0, 0, TAU);
    b.fill();
    b.globalAlpha = 1;
    if (!armed) {
      b.strokeStyle = hz.color;
      b.lineWidth = 1;
      b.beginPath();
      b.ellipse(hz.x - cx, hz.y - cy, hz.r, hz.r * 0.6, 0, 0, TAU);
      b.stroke();
    }
  }

  for (const n of sc.npcs) {
    list.push({
      y: n.y,
      d: () => {
        const { img, flip } = frameFor(npcChars[n.id], n.fx, n.fy, walkFrame(n.walking, n.walk));
        b.fillStyle = 'rgba(0,0,0,.25)';
        b.fillRect(Math.round(n.x - cx - 5), Math.round(n.y - cy + 1), 10, 3);
        draw(b, img, n.x - 8 - cx, n.y + 2 - CHAR_FOOT - cy, flip);
      },
    });
  }
  for (const o of sc.ores) list.push({ y: o.ty * TS + 14, d: () => draw(b, oreImg(o.item), o.tx * TS - cx + (o.shake > 0 ? rnd(-1, 1) : 0), o.ty * TS - cy) });
  for (const c of sc.chests) list.push({ y: c.ty * TS + 14, d: () => b.drawImage(chestImgs[c.open ? 1 : 0], c.tx * TS - cx, c.ty * TS - cy) });
  for (const e of sc.enemies) list.push({ y: e.y, d: () => e.draw(b, cx, cy, sc.clock) });
  list.push({ y: sc.player.y, d: () => drawPlayer(sc, cx, cy) });
  list.sort((a, c) => a.y - c.y).forEach((o) => o.d());

  for (const s of sc.shots) drawShot(b, s, cx, cy);
  drawStrikes(sc, b, cx, cy);
  if (sc.s.cls === 'spirit') {
    for (let i = 0; i < orbCount(sc); i++) {
      const [ox, oy] = orbPos(sc, i);
      b.fillStyle = 'rgba(98,240,214,.35)';
      b.fillRect(Math.round(ox - cx - 3), Math.round(oy - cy - 3), 6, 6);
      b.fillStyle = '#62f0d6';
      b.fillRect(Math.round(ox - cx - 2), Math.round(oy - cy - 2), 4, 4);
      b.fillStyle = '#fff';
      b.fillRect(Math.round(ox - cx - 1), Math.round(oy - cy - 1), 2, 2);
    }
  }
  sc.fx.drawWorld(b, cx, cy);

  if (town) {
    drawFireflies(sc, cx, cy);
    drawWeather(sc);
  }
  drawLighting(sc, cx, cy);

  sc.game.renderer.present();
  sc.fx.drawText(sc.game.renderer, cx, cy);
  if (sc.mode === 'mine' && sc.floorBanner > 0) {
    const a = Math.min(1, sc.floorBanner);
    sc.game.renderer.text(`第 ${sc.floor} 层 · ${floorName(sc.floor)}`, VW / 2, VH * 0.32, '#f4ecd8', 11, a, '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif', 400);
  }
}

const chestImgs = [chestImg(false), chestImg(true)];

const forageCache = new Map<ItemId, Img>();
function forageImg(id: ItemId): Img {
  let img = forageCache.get(id);
  if (!img) {
    const d = ITEMS[id] as ItemDef;
    img = forageGlyph(d.color, d.glyph ?? 'plant');
    forageCache.set(id, img);
  }
  return img;
}

function drawBridge(sc: PlayScene, x: number, y: number, px: number, py: number, season: number): void {
  const { b } = sc.game.renderer;
  drawWater(sc, x, y, px, py, false, season);
  b.drawImage(bridgeTile, px, py);
  const map = sc.map;
  b.fillStyle = '#5a3a22';
  if (map.get(x - 1, y) !== Tile.BRIDGE) {
    b.fillRect(px, py, 2, 16);
    b.fillStyle = '#8a6038';
    b.fillRect(px, py + 1, 2, 2);
    b.fillStyle = '#5a3a22';
  }
  if (map.get(x + 1, y) !== Tile.BRIDGE) b.fillRect(px + 14, py, 2, 16);
}

/** 夏天和秋天的夜里，萤火森林里飞着萤火虫 */
function drawFireflies(sc: PlayScene, cx: number, cy: number): void {
  const a = nightAlpha(sc.s.time);
  const season = seasonOf(sc.s.day);
  if (a < 0.2 || season === 3) return;
  const { b } = sc.game.renderer;
  const [fx0, fy0, fx1, fy1] = sc.overworld.forest;
  const n = season === 1 ? 70 : 36;
  const t = sc.clock;
  for (let i = 0; i < n; i++) {
    const x = (fx0 + hash(i, 41) * (fx1 - fx0)) * TS + Math.sin(t * 0.7 + i) * 14 - cx;
    const y = (fy0 + 8 + hash(43, i) * (fy1 - fy0 - 8)) * TS + Math.cos(t * 0.9 + i * 2) * 10 - cy;
    if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
    const glow = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
    b.fillStyle = `rgba(200,255,150,${0.5 * glow})`;
    b.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    b.fillStyle = `rgba(240,255,200,${0.4 + 0.6 * glow})`;
    b.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
}

function drawWater(sc: PlayScene, x: number, y: number, px: number, py: number, fountain: boolean, season: number): void {
  const { b } = sc.game.renderer;
  const map = sc.map;
  const frozen = season === 3 && !fountain;
  b.fillStyle = frozen ? '#a9cbe8' : '#3a78c4';
  b.fillRect(px, py, 16, 16);
  b.fillStyle = frozen ? '#d6ebfa' : '#6aa6e8';
  const o = Math.floor((sc.clock * (frozen ? 0 : 6) + x * 5 + y * 3) % 16);
  b.fillRect(px + (o % 12), py + 4 + (y % 2) * 6, 4, 1);
  b.fillRect(px + ((o + 7) % 12), py + 10 - (x % 2) * 4, 3, 1);
  const same = (t: number) => t === Tile.WATER || t === Tile.FOUNTAIN || t === Tile.BRIDGE;
  const grassEdge = ['#5d9e3f', '#4f9a3a', '#9a9a44', '#dfe8ee'][season];
  const edge = (t: number) => (fountain ? '#8f8a88' : t === Tile.SAND ? '#e8d4a0' : t === Tile.FOREST ? '#3f7f34' : grassEdge);
  const n = map.get(x, y - 1);
  const w = map.get(x - 1, y);
  const e = map.get(x + 1, y);
  const s2 = map.get(x, y + 1);
  if (!same(n)) { b.fillStyle = edge(n); b.fillRect(px, py, 16, 2); }
  if (!same(w)) { b.fillStyle = edge(w); b.fillRect(px, py, 2, 16); }
  if (!same(e)) { b.fillStyle = edge(e); b.fillRect(px + 14, py, 2, 16); }
  if (!same(s2)) { b.fillStyle = edge(s2); b.fillRect(px, py + 14, 16, 2); }
  if (fountain && (x + y) % 2 === 0) {
    const k = (sc.clock * 2 + x) % 1;
    b.fillStyle = '#cfe8ff';
    b.fillRect(px + 7, py + 6 - Math.round(k * 6), 2, 2);
  }
}

export function drawCrop(b: CanvasRenderingContext2D, crop: CropId, days: number, px: number, py: number, clock: number): void {
  const def = CROPS[crop];
  const r = days / def.days;
  const c = def.color;
  if (r >= 1) {
    const bob = Math.sin(clock * 3 + px) * 0.5;
    switch (crop) {
      case 'radish':
        b.fillStyle = '#3e9a3a';
        b.fillRect(px + 5, py + 2 + bob, 2, 5);
        b.fillRect(px + 9, py + 1 + bob, 2, 6);
        b.fillRect(px + 7, py + 3, 2, 4);
        b.fillStyle = '#f0f0f0';
        b.fillRect(px + 5, py + 8, 6, 4);
        b.fillStyle = c;
        b.fillRect(px + 5, py + 7, 6, 2);
        break;
      case 'berry':
      case 'pepper':
        b.fillStyle = '#2f7a3a';
        b.fillRect(px + 3, py + 4, 10, 9);
        b.fillStyle = '#3f9a48';
        b.fillRect(px + 4, py + 3, 8, 3);
        b.fillStyle = c;
        for (const [x, y] of [[5, 6], [9, 5], [7, 9], [10, 9], [4, 10]]) b.fillRect(px + x, py + y, 2, crop === 'pepper' ? 3 : 2);
        break;
      case 'melon':
      case 'pumpkin':
        b.fillStyle = '#3e9a3a';
        b.fillRect(px + 7, py + 2, 2, 4);
        b.fillRect(px + 9, py + 3, 3, 2);
        b.fillStyle = c;
        b.fillRect(px + 3, py + 6, 10, 8);
        b.fillRect(px + 2, py + 8, 12, 4);
        b.fillStyle = 'rgba(0,0,0,.18)';
        b.fillRect(px + 6, py + 6, 1, 8);
        b.fillRect(px + 9, py + 6, 1, 8);
        if (crop === 'melon') {
          b.fillStyle = '#fff6c8';
          b.fillRect(px + 4, py + 8, 1, 1);
          b.fillRect(px + 11, py + 10, 1, 1);
        }
        break;
      case 'yam':
        b.fillStyle = '#3e9a3a';
        b.fillRect(px + 4, py + 2 + bob, 2, 6);
        b.fillRect(px + 8, py + 1 + bob, 2, 7);
        b.fillRect(px + 11, py + 3 + bob, 2, 5);
        b.fillStyle = c;
        b.fillRect(px + 4, py + 9, 4, 4);
        b.fillRect(px + 9, py + 10, 4, 3);
        break;
    }
    if (Math.sin(clock * 4 + px * 0.3) > 0.85) {
      b.fillStyle = '#fff';
      b.fillRect(px + 12, py + 2, 1, 3);
      b.fillRect(px + 11, py + 3, 3, 1);
    }
  } else if (r >= 0.5) {
    b.fillStyle = '#4caf50';
    b.fillRect(px + 7, py + 5, 2, 7);
    b.fillRect(px + 4, py + 6, 3, 2);
    b.fillRect(px + 9, py + 5, 3, 2);
    b.fillRect(px + 5, py + 9, 2, 2);
  } else if (days > 0) {
    b.fillStyle = '#6cc04a';
    b.fillRect(px + 7, py + 8, 2, 4);
    b.fillRect(px + 5, py + 8, 2, 1);
    b.fillRect(px + 9, py + 7, 2, 1);
  } else {
    b.fillStyle = '#d8c08a';
    b.fillRect(px + 6, py + 9, 1, 1);
    b.fillRect(px + 9, py + 8, 1, 1);
    b.fillRect(px + 8, py + 11, 1, 1);
  }
}

function drawBuilding(sc: PlayScene, B: Building, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const x = B.x * TS - cx;
  const y = B.y * TS - cy;
  const w = B.w * TS;
  const hgt = B.h * TS;
  const wallH = hgt >= 80 ? 42 : 36;
  const roofH = hgt - wallH;
  const wy = y + roofH;
  const winter = seasonOf(sc.s.day) === 3;
  const night = sc.s.time > 1080;
  const f = (c: string, xx: number, yy: number, ww: number, hh: number) => {
    b.fillStyle = c;
    b.fillRect(xx, yy, ww, hh);
  };
  // 墙：铁匠铺是石墙，其余是木板墙
  f('rgba(0,0,0,.25)', x, y + hgt - 2, w, 3);
  f(B.wall, x + 1, wy - 2, w - 2, wallH + 2);
  if (B.kind === 'smith') {
    for (let yy = 0; yy < wallH; yy += 5) {
      f('rgba(0,0,0,.18)', x + 1, wy + yy, w - 2, 1);
      for (let xx = (yy / 5) % 2 ? 4 : 9; xx < w - 2; xx += 10) f('rgba(0,0,0,.18)', x + xx, wy + yy, 1, 5);
    }
  } else {
    for (let yy = wy + 3; yy < y + hgt; yy += 4) f('rgba(0,0,0,.1)', x + 1, yy, w - 2, 1);
  }
  f('rgba(0,0,0,.22)', x + 1, wy, 2, wallH);
  f('rgba(0,0,0,.22)', x + w - 3, wy, 2, wallH);
  f('rgba(0,0,0,.28)', x + 1, wy, w - 2, 3);

  // 屋顶：一排排错开的瓦片，屋檐比墙宽一点
  f(B.roof, x - 3, y, w + 6, roofH);
  for (let r = 0, yy = y + 3; yy < y + roofH - 1; yy += 4, r++) {
    f('rgba(0,0,0,.2)', x - 3, yy, w + 6, 1);
    for (let xx = (r % 2) * 4; xx < w + 6; xx += 8) f('rgba(0,0,0,.14)', x - 3 + xx, yy - 3, 1, 3);
  }
  f('rgba(255,255,255,.18)', x - 3, y, w + 6, 2);
  if (winter) {
    f('#f4f8fb', x - 3, y, w + 6, 5);
    f('#dfe8ee', x - 3, y + 5, w + 6, 1);
  }
  f('rgba(0,0,0,.35)', x - 3, y + roofH - 2, w + 6, 2);
  if (B.chimney) {
    f('#5a4a44', x + w - 18, y - 8, 8, 14);
    f('#7a6a64', x + w - 18, y - 8, 8, 2);
    for (let i = 0; i < 3; i++) {
      const p = (sc.clock * 0.6 + i / 3) % 1;
      b.fillStyle = `rgba(200,200,210,${0.5 * (1 - p)})`;
      b.beginPath();
      b.arc(x + w - 14 + Math.sin(p * 6 + i) * 3, y - 10 - p * 26, 2 + p * 4, 0, TAU);
      b.fill();
    }
  }

  // 门：比一格高，门框、门板、把手和台阶
  const dx = B.door[0] * TS - cx;
  const dy = B.door[1] * TS - cy;
  f('#3a2414', dx + 1, dy - 8, 14, 24);
  f(B.kind === 'house' && B.name === '空屋' ? '#5a4a3a' : '#6b4428', dx + 3, dy - 6, 10, 22);
  f('rgba(0,0,0,.2)', dx + 7, dy - 6, 1, 22);
  f('rgba(255,255,255,.12)', dx + 3, dy - 6, 10, 1);
  f('#ffd34d', dx + 10, dy + 3, 2, 2);
  f('#8f8a88', dx, dy + 14, 16, 2);

  // 窗户：白天反光，晚上亮着暖光
  const winY = wy + 8;
  for (const wx of [x + 6, x + w - 20, ...(B.w >= 7 ? [x + 22] : [])]) {
    if (Math.abs(wx + 7 - (dx + 8)) < 14) continue;
    f('#3a2a1a', wx, winY, 14, 12);
    f(night && B.name !== '空屋' ? '#ffd98a' : '#9fd0e8', wx + 1, winY + 1, 12, 10);
    if (!night) f('rgba(255,255,255,.45)', wx + 2, winY + 2, 3, 2);
    f('#3a2a1a', wx + 6, winY + 1, 2, 10);
    f('#3a2a1a', wx + 1, winY + 5, 12, 1);
    f('#6b4a2b', wx - 1, winY + 12, 16, 2);
    // 窗台上的花
    if (!winter && B.kind !== 'smith') {
      f('#3e9a3a', wx + 1, winY + 10, 12, 2);
      f(B.kind === 'clinic' ? '#e05a7a' : '#ffcf5a', wx + 3, winY + 10, 2, 1);
      f('#ff8fb3', wx + 9, winY + 10, 2, 1);
    }
  }

  // 招牌
  if (B.kind !== 'home' && B.kind !== 'house') {
    const sx = dx - 2;
    const sy = dy - 17;
    f('#3a2a1a', sx, sy, 20, 8);
    f('#5a3e26', sx + 1, sy + 1, 18, 6);
    switch (B.kind) {
      case 'smith':
        f('#c9d4e0', sx + 6, sy + 2, 8, 2);
        f('#c9d4e0', sx + 8, sy + 4, 4, 2);
        break;
      case 'shop':
        f('#ffcf5a', sx + 7, sy + 2, 6, 4);
        f('#ffcf5a', sx + 9, sy + 1, 2, 1);
        break;
      case 'clinic':
        f('#e05a7a', sx + 9, sy + 1, 2, 6);
        f('#e05a7a', sx + 7, sy + 3, 6, 2);
        break;
      case 'guild':
        f('#dfe6ee', sx + 9, sy + 1, 1, 6);
        f('#dfe6ee', sx + 7, sy + 3, 5, 1);
        f('#ffd34d', sx + 11, sy + 1, 2, 2);
        break;
    }
  }
  if (B.kind === 'smith') {
    // 门口的铁砧
    f('#3a3a44', dx + 18, dy + 8, 10, 4);
    f('#55555f', dx + 17, dy + 6, 12, 3);
    f('#2a2a30', dx + 20, dy + 12, 6, 3);
  }
}

function drawPlayer(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const p = sc.player;
  const s = sc.s;
  if (p.inv > 0 && p.dashT <= 0 && Math.floor(p.inv * 14) % 2) {
    drawSwing(sc, cx, cy);
    return;
  }
  b.fillStyle = 'rgba(0,0,0,.25)';
  b.fillRect(Math.round(p.x - cx - 5), Math.round(p.y - cy + 1), 10, 3);
  const { img, flip } = frameFor(playerChar(s.cls, s.armor.tier), p.fx, p.fy, walkFrame(p.moving, p.walk));
  const sx = Math.round(p.x - 8 - cx);
  const sy = Math.round(p.y + 2 - CHAR_FOOT - cy);
  // 背对镜头时武器在身后
  const behind = p.fy < 0 && !p.fx;
  if (behind && p.atkT <= 0) heldWeapon(sc, cx, cy);
  if (p.dashT > 0) b.globalAlpha = 0.55;
  draw(b, img, sx, sy, flip);
  b.globalAlpha = 1;
  if (!behind && p.atkT <= 0) heldWeapon(sc, cx, cy);
  drawSwing(sc, cx, cy);
  if (s.armor.plus >= 5 && Math.sin(sc.clock * 5) > 0.85) {
    b.fillStyle = '#fff';
    b.fillRect(Math.round(p.x - cx - 3), Math.round(p.y - cy - 12), 1, 1);
  }
}

/** 手里拿着的武器，按武器类型画 */
function heldWeapon(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const p = sc.player;
  const w = WEAPON_TIERS[sc.s.weapon.tier];
  const hx = Math.round(p.x - cx + (p.fx > 0 ? 1 : p.fx < 0 ? -2 : p.fy < 0 ? -5 : 4));
  const hy = Math.round(p.y - cy - 4);
  const f = (c: string, x: number, y: number, ww: number, hh: number) => {
    b.fillStyle = c;
    b.fillRect(hx + x, hy + y, ww, hh);
  };
  const glow = p.castT > 0;
  switch (sc.s.weaponType) {
    case 'axe':
      f('#6b4a2b', 0, -9, 1, 11);
      f(w.color, p.fx < 0 ? -3 : 1, -9, 3, 4);
      f('rgba(255,255,255,.5)', p.fx < 0 ? -3 : 3, -9, 1, 4);
      break;
    case 'spear':
      f('#6b4a2b', 0, -13, 1, 16);
      f(w.color, -1, -15, 3, 2);
      f(w.color, 0, -17, 1, 2);
      break;
    case 'staff':
      f('#6b4a2b', 0, -10, 1, 13);
      f(w.color, -1, -12, 3, 3);
      if (glow) f('#fff', -2, -13, 5, 5);
      break;
    case 'tome':
      f('#3a2a5a', -2, -3, 5, 6);
      f(w.color, -1, -2, 3, 4);
      f('#f4ecd8', -1, -3, 3, 1);
      if (glow) f('#c39bff', -3, -6, 7, 2);
      break;
    case 'orb': {
      const bob = Math.round(Math.sin(sc.clock * 4) * 1.5);
      f('rgba(255,179,255,.35)', -3, -9 + bob, 7, 7);
      f(w.color, -2, -8 + bob, 5, 5);
      f(glow ? '#fff' : '#ffd6ff', -1, -7 + bob, 2, 2);
      break;
    }
    case 'dagger':
      f(w.color, 0, -3, 1, 4);
      f('#3a2a1a', -1, 1, 3, 1);
      break;
    case 'twin':
      f(w.color, 0, -3, 1, 4);
      f('#3a2a1a', -1, 1, 3, 1);
      if (!p.fx) {
        const ox = p.fy < 0 ? 9 : -9;
        f(w.color, ox, -3, 1, 4);
        f('#3a2a1a', ox - 1, 1, 3, 1);
      }
      break;
    case 'darts':
      f(w.color, -1, -1, 3, 1);
      f(w.color, 0, -2, 1, 3);
      break;
    case 'bell':
      f('#6b4a2b', 0, -6, 1, 4);
      f(w.color, -1, -3, 3, 3);
      f(w.color, -2, -1, 5, 1);
      f(glow ? '#fff' : '#62f0d6', 0, 0, 1, 1);
      break;
    case 'fan':
      f('#6b4a2b', 0, -1, 1, 3);
      f(w.color, -3, -5, 7, 3);
      f(w.color, -2, -6, 5, 1);
      f(glow ? '#fff' : '#62f0d6', -1, -5, 3, 1);
      break;
    case 'lantern':
      f('#6b4a2b', 0, -6, 1, 3);
      f(w.color, -2, -3, 5, 5);
      f(glow ? '#fff' : '#62f0d6', -1, -2, 3, 3);
      break;
    default:
      f(w.color, 0, -7, 1, 8);
      f('rgba(255,255,255,.55)', 0, -7, 1, 2);
      f('#6b4a2b', -1, 0, 3, 1);
  }
}

function drawSwing(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const p = sc.player;
  const ox = p.x - cx;
  const oy = p.y - 7 - cy;
  const w = WEAPON_TIERS[sc.s.weapon.tier];
  if (p.spinT > 0) {
    const a0 = sc.clock * 22;
    b.strokeStyle = w.color; b.lineWidth = 3;
    b.beginPath(); b.arc(ox, oy, 19, a0, a0 + 4.4); b.stroke();
    b.strokeStyle = 'rgba(255,255,255,.7)'; b.lineWidth = 1;
    b.beginPath(); b.arc(ox, oy, 23, a0 + 1, a0 + 4); b.stroke();
  }
  const wt = weaponTypeOf(sc.s);
  if (p.atkT <= 0 || isRanged(wt.kind)) return;
  const base = Math.atan2(p.fy, p.fx);
  const rr = wt.reach ?? 12;
  const kind = p.swingKind;
  const total = kind === 'cleave' ? 0.26 : 0.18;
  const k = 1 - p.atkT / total;
  const glow = sc.s.weapon.plus >= 5;
  if (kind === 'thrust') {
    // 突刺：一道向前伸出的枪影
    const len = rr * Math.min(1, k * 1.6);
    const ex = ox + p.fx * len;
    const ey = oy + p.fy * len;
    if (glow) {
      b.strokeStyle = 'rgba(98,240,214,.45)'; b.lineWidth = 5;
      b.beginPath(); b.moveTo(ox, oy); b.lineTo(ex, ey); b.stroke();
    }
    b.strokeStyle = '#6b4a2b'; b.lineWidth = 1;
    b.beginPath(); b.moveTo(ox, oy); b.lineTo(ex, ey); b.stroke();
    b.fillStyle = w.color;
    b.fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 4, 4);
    b.fillStyle = 'rgba(255,255,255,.7)';
    b.fillRect(Math.round(ex + p.fx * 3) - 1, Math.round(ey + p.fy * 3) - 1, 2, 2);
    return;
  }
  const span = kind === 'cleave' ? 4.2 : 2.4;
  const a0 = base - span / 2 + k * 0.3;
  const a1 = a0 + k * span;
  if (glow) {
    b.strokeStyle = 'rgba(98,240,214,.45)'; b.lineWidth = 5;
    b.beginPath(); b.arc(ox, oy, rr, a0, a1); b.stroke();
  }
  b.strokeStyle = w.color; b.lineWidth = kind === 'cleave' ? 3 : 2;
  b.beginPath(); b.arc(ox, oy, rr, a0, a1); b.stroke();
  b.strokeStyle = 'rgba(255,255,255,.7)'; b.lineWidth = 1;
  b.beginPath(); b.arc(ox, oy, rr + 3, a0 + (a1 - a0) * 0.5, a1); b.stroke();
}

const drops = Array.from({ length: 90 }, () => ({ x: Math.random() * VW, y: Math.random() * VH, s: 0.6 + Math.random() * 0.6 }));

function drawWeather(sc: PlayScene): void {
  const { b } = sc.game.renderer;
  const w = sc.s.weather;
  if (w === 'sunny') return;
  const t = sc.clock;
  if (w === 'rain') {
    b.fillStyle = 'rgba(40,60,110,.18)';
    b.fillRect(0, 0, VW, VH);
    b.strokeStyle = 'rgba(180,210,255,.55)';
    b.lineWidth = 1;
    b.beginPath();
    for (const d of drops) {
      const y = (d.y + t * 260 * d.s) % VH;
      const x = (d.x - t * 40 * d.s + VW * 4) % VW;
      b.moveTo(x, y);
      b.lineTo(x - 2, y + 6);
    }
    b.stroke();
  } else {
    b.fillStyle = 'rgba(255,255,255,.85)';
    for (const d of drops) {
      const y = (d.y + t * 30 * d.s) % VH;
      const x = (d.x + Math.sin(t + d.y) * 8 + VW) % VW;
      b.fillRect(Math.round(x), Math.round(y), 2, 2);
    }
  }
}

function drawLighting(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  let a = 0;
  if (sc.mode === 'mine') a = 0.6 + Math.min(0.15, sc.floor * 0.012);
  else a = nightAlpha(sc.s.time);
  if (a <= 0) return;
  dk.globalCompositeOperation = 'source-over';
  dk.clearRect(0, 0, VW, VH);
  dk.fillStyle = `rgba(10,6,24,${a})`;
  dk.fillRect(0, 0, VW, VH);
  dk.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number, s: number) => {
    const g = dk.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${s})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dk.fillStyle = g;
    dk.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const p = sc.player;
  const visible = (x: number, y: number, r: number) => x > -r && y > -r && x < VW + r && y < VH + r;
  hole(p.x - cx, p.y - 10 - cy, (sc.mode === 'mine' ? 95 : 80) * lightMul(sc), 1);
  for (const s of sc.shots) hole(s.x - cx, s.y - cy, 20, 0.8);
  if (sc.s.cls === 'spirit') for (let i = 0; i < orbCount(sc); i++) {
    const [ox, oy] = orbPos(sc, i);
    hole(ox - cx, oy - cy, 24, 0.7);
  }
  for (const [x, y] of sc.crystals) hole(x * TS + 8 - cx, y * TS + 8 - cy, 34 + Math.sin(sc.clock * 2 + x) * 4, 0.85);
  for (const e of sc.enemies) if (e.boss) hole(e.x - cx, e.y - cy - 16, 70, 0.7);
  for (const hz of sc.hazards) hole(hz.x - cx, hz.y - cy, hz.r + 10, 0.6);
  if (sc.mode === 'town') {
    for (const bd of sc.overworld.buildings) {
      if (bd.name === '空屋') continue;
      const bx = bd.x * TS + (bd.w * TS) / 2 - cx;
      const by = bd.y * TS + bd.h * TS - 14 - cy;
      if (visible(bx, by, 60)) hole(bx, by, 40, 0.55);
    }
    for (const [x, y] of sc.overworld.lamps) {
      const lx = x * TS + 8 - cx;
      const ly = y * TS - 10 - cy;
      if (visible(lx, ly, 50)) hole(lx, ly + 8, 46, 0.9);
    }
    for (const k of Object.keys(sc.s.forage)) {
      if (sc.s.forage[k] !== 'fireflower') continue;
      const [x, y] = k.split(',').map(Number);
      hole(x * TS + 8 - cx, y * TS + 8 - cy, 18, 0.7);
    }
    for (const [x, y] of exploreLights(sc)) if (visible(x - cx, y - cy, 60)) hole(x - cx, y - 8 - cy, 40, 0.85);
    for (const [k, f] of Object.entries(sc.s.field)) {
      if (f.crop === 'berry' && f.days >= CROPS.berry.days) {
        const [x, y] = k.split(',').map(Number);
        hole(x * TS + 8 - cx, y * TS + 8 - cy, 22, 0.8);
      }
    }
  }
  dk.globalCompositeOperation = 'source-over';
  b.drawImage(dark, 0, 0);
  if (sc.mode === 'town') {
    b.fillStyle = `rgba(60,40,120,${a * 0.18})`;
    b.fillRect(0, 0, VW, VH);
    // 路灯下一圈暖黄色的光
    b.globalCompositeOperation = 'lighter';
    for (const [x, y] of sc.overworld.lamps) {
      const lx = x * TS + 8 - cx;
      const ly = y * TS - cy;
      if (!visible(lx, ly, 50)) continue;
      const g = b.createRadialGradient(lx, ly, 0, lx, ly, 40);
      g.addColorStop(0, `rgba(255,190,90,${0.22 * a})`);
      g.addColorStop(1, 'rgba(255,190,90,0)');
      b.fillStyle = g;
      b.fillRect(lx - 40, ly - 40, 80, 80);
    }
    b.globalCompositeOperation = 'source-over';
  }
}
