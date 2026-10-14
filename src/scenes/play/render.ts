import { TS, VH, VW } from '../../core/constants';
import { TAU, hash, rnd } from '../../core/math';
import type { CropId } from '../../data/crops';
import { CROPS } from '../../data/crops';
import { floorName, zoneFor } from '../../data/floors';
import { WEAPON_TIERS } from '../../data/equipment';
import { draw } from '../../gfx/sprite';
import { playerSprites, treeSprite, treeSpriteAutumn, treeSpriteWinter } from '../../gfx/sprites';
import {
  binTile, caveTile, cliffTile, fenceTiles, fieldTile, flowerTiles, grassTiles, mineTiles, oreImg, pathTile, plazaTile, tilledTile, wetTile,
} from '../../gfx/tiles';
import { seasonOf } from '../../state/save';
import { nightAlpha } from '../../systems/time';
import { classOf } from '../../systems/stats';
import type { Building } from '../../world/overworld';
import { Tile } from '../../world/TileMap';
import type { PlayScene } from '../PlayScene';
import { orbPos } from './combat';

const dark = document.createElement('canvas');
dark.width = VW;
dark.height = VH;
const dk = dark.getContext('2d')!;

export function renderPlay(sc: PlayScene): void {
  const { b } = sc.game.renderer;
  const map = sc.map;
  sc.camera.follow(sc.player.x, sc.player.y - 8, map.w * TS, map.h * TS);
  const cx = sc.camera.ox;
  const cy = sc.camera.oy;
  const season = seasonOf(sc.s.day);

  b.fillStyle = '#0b0910';
  b.fillRect(0, 0, VW, VH);

  const x0 = Math.max(0, Math.floor(cx / TS));
  const y0 = Math.max(0, Math.floor(cy / TS));
  const x1 = Math.min(map.w - 1, Math.floor((cx + VW) / TS));
  const y1 = Math.min(map.h - 1, Math.floor((cy + VH) / TS));
  const mt = sc.mode === 'mine' ? mineTiles(sc.floor === zoneFor(sc.floor).boss.floor ? zoneFor(sc.floor).boss.pal : zoneFor(sc.floor).pal) : null;
  const tree = season === 3 ? treeSpriteWinter : season === 2 ? treeSpriteAutumn : treeSprite;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = map.get(x, y);
      const px = x * TS - cx;
      const py = y * TS - cy;
      if (mt) {
        if (t === Tile.ROCK) b.drawImage(mt.wall, px, py);
        else {
          b.drawImage(mt.floor[hash(x, y) < 0.5 ? 0 : 1], px, py);
          if (t === Tile.STAIRS) b.drawImage(mt.stairs, px, py);
          else if (t === Tile.LADDER) b.drawImage(mt.ladder, px, py);
        }
        continue;
      }
      const grass = grassTiles[season][Math.floor(hash(x, y) * 3)];
      switch (t) {
        case Tile.GRASS: b.drawImage(grass, px, py); break;
        case Tile.PATH: case Tile.WALL: case Tile.DOOR: b.drawImage(pathTile, px, py); break;
        case Tile.PLAZA: b.drawImage(plazaTile, px, py); break;
        case Tile.WATER: case Tile.FOUNTAIN: drawWater(sc, x, y, px, py, t === Tile.FOUNTAIN, season); break;
        case Tile.TREE: b.drawImage(grass, px, py); b.drawImage(tree, px, py); break;
        case Tile.FIELD: b.drawImage(fieldTile, px, py); break;
        case Tile.FENCE: b.drawImage(fenceTiles[season], px, py); break;
        case Tile.FLOWER: b.drawImage(flowerTiles[season][Math.floor(hash(y, x) * 2)], px, py); break;
        case Tile.CAVE: b.drawImage(caveTile, px, py); break;
        case Tile.CLIFF: case Tile.ROCK: b.drawImage(cliffTile, px, py); break;
        case Tile.BIN: b.drawImage(binTile, px, py); break;
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
  if (sc.mode === 'town') for (const bd of sc.overworld.buildings) drawBuilding(sc, bd, cx, cy);

  // 面前可交互格子的提示框
  if (!sc.ui.modal) {
    const [tx, ty] = sc.player.frontTile();
    const t = map.get(tx, ty);
    const show = sc.mode === 'town'
      ? t === Tile.FIELD || t === Tile.DOOR || t === Tile.BIN || t === Tile.CAVE
      : t === Tile.STAIRS || t === Tile.LADDER || sc.ores.some((o) => o.tx === tx && o.ty === ty);
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

  // 按 y 排序绘制，前后遮挡正确
  const list: { y: number; d: () => void }[] = [];
  for (const n of sc.npcs) {
    list.push({
      y: n.y,
      d: () => {
        const img = sc.npcFace(n.id);
        const bob = n.walking ? Math.floor(sc.clock * 8) % 2 : Math.floor(Math.sin(sc.clock * 2 + n.phase) * 0.6);
        b.fillStyle = 'rgba(0,0,0,.25)';
        b.fillRect(Math.round(n.x - cx - 5), Math.round(n.y - cy + 3), 10, 2);
        draw(b, img, n.x - 8 - cx, n.y - 15 - cy + bob, sc.player.x < n.x && n.id !== 'owl');
      },
    });
  }
  for (const o of sc.ores) list.push({ y: o.ty * TS + 14, d: () => draw(b, oreImg(o.item), o.tx * TS - cx + (o.shake > 0 ? rnd(-1, 1) : 0), o.ty * TS - cy) });
  for (const e of sc.enemies) list.push({ y: e.y, d: () => e.draw(b, cx, cy, sc.clock) });
  list.push({ y: sc.player.y, d: () => drawPlayer(sc, cx, cy) });
  list.sort((a, c) => a.y - c.y).forEach((o) => o.d());

  for (const s of sc.shots) {
    b.fillStyle = s.color;
    b.fillRect(Math.round(s.x - cx - 2), Math.round(s.y - cy - 2), 4, 4);
    b.fillStyle = '#fff';
    b.fillRect(Math.round(s.x - cx - 1), Math.round(s.y - cy - 1), 2, 2);
  }
  if (sc.s.cls === 'spirit') {
    for (let i = 0; i < 2; i++) {
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

  if (sc.mode === 'town') drawWeather(sc);
  drawLighting(sc, cx, cy);

  sc.game.renderer.present();
  sc.fx.drawText(sc.game.renderer, cx, cy);
  if (sc.mode === 'mine' && sc.floorBanner > 0) {
    const a = Math.min(1, sc.floorBanner);
    sc.game.renderer.text(`第 ${sc.floor} 层 · ${floorName(sc.floor)}`, VW / 2, VH * 0.32, '#f4ecd8', 11, a, '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif', 400);
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
  const same = (t: number) => t === Tile.WATER || t === Tile.FOUNTAIN;
  const edge = fountain ? '#8f8a88' : grassTiles[season][0] && ['#5d9e3f', '#4f9a3a', '#9a9a44', '#dfe8ee'][season];
  b.fillStyle = edge;
  if (!same(map.get(x, y - 1))) b.fillRect(px, py, 16, 2);
  if (!same(map.get(x - 1, y))) b.fillRect(px, py, 2, 16);
  if (!same(map.get(x + 1, y))) b.fillRect(px + 14, py, 2, 16);
  if (!same(map.get(x, y + 1))) b.fillRect(px, py + 14, 16, 2);
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
  const roofH = hgt - TS * 2 + 4;
  const winter = seasonOf(sc.s.day) === 3;
  b.fillStyle = B.wall;
  b.fillRect(x + 2, y + roofH - 4, w - 4, hgt - roofH + 4);
  b.fillStyle = 'rgba(0,0,0,.12)';
  for (let yy = y + roofH; yy < y + hgt; yy += 4) b.fillRect(x + 2, yy, w - 4, 1);
  b.fillStyle = B.roof;
  b.fillRect(x - 2, y, w + 4, roofH);
  b.fillStyle = 'rgba(0,0,0,.18)';
  for (let yy = y + 4; yy < y + roofH; yy += 5) b.fillRect(x - 2, yy, w + 4, 1);
  b.fillStyle = winter ? '#f4f8fb' : 'rgba(255,255,255,.18)';
  b.fillRect(x - 2, y, w + 4, winter ? 5 : 2);
  b.fillStyle = 'rgba(0,0,0,.3)';
  b.fillRect(x - 2, y + roofH, w + 4, 2);
  if (B.chimney) {
    b.fillStyle = '#5a4a44';
    b.fillRect(x + w - 18, y - 8, 8, 12);
    for (let i = 0; i < 3; i++) {
      const p = (sc.clock * 0.6 + i / 3) % 1;
      b.fillStyle = `rgba(200,200,210,${0.5 * (1 - p)})`;
      b.beginPath();
      b.arc(x + w - 14 + Math.sin(p * 6 + i) * 3, y - 10 - p * 26, 2 + p * 4, 0, TAU);
      b.fill();
    }
  }
  const dx = B.door[0] * TS - cx;
  const dy = B.door[1] * TS - cy;
  b.fillStyle = '#4a2e1a';
  b.fillRect(dx + 3, dy + 2, 10, 14);
  b.fillStyle = '#6b4428';
  b.fillRect(dx + 4, dy + 3, 8, 13);
  b.fillStyle = '#ffd34d';
  b.fillRect(dx + 10, dy + 9, 1, 2);
  const night = sc.s.time > 1080;
  for (const wx of [x + 6, x + w - 18]) {
    if (Math.abs(wx - dx) < 12) continue;
    b.fillStyle = '#3a2a1a';
    b.fillRect(wx, y + roofH + 4, 12, 9);
    b.fillStyle = night ? '#ffd98a' : '#9fd0e8';
    b.fillRect(wx + 1, y + roofH + 5, 10, 7);
    b.fillStyle = '#3a2a1a';
    b.fillRect(wx + 5, y + roofH + 5, 1, 7);
  }
  if (B.kind !== 'home') {
    b.fillStyle = '#3a2a1a';
    b.fillRect(dx - 1, dy - 7, 18, 7);
    switch (B.kind) {
      case 'smith':
        b.fillStyle = '#c9d4e0';
        b.fillRect(dx + 4, dy - 5, 8, 2);
        b.fillRect(dx + 6, dy - 3, 4, 2);
        break;
      case 'shop':
        b.fillStyle = '#ffcf5a';
        b.fillRect(dx + 5, dy - 5, 6, 3);
        b.fillRect(dx + 7, dy - 6, 2, 1);
        break;
      case 'clinic':
        b.fillStyle = '#e05a7a';
        b.fillRect(dx + 7, dy - 6, 2, 5);
        b.fillRect(dx + 5, dy - 4, 6, 1);
        break;
      case 'guild':
        b.fillStyle = '#dfe6ee';
        b.fillRect(dx + 7, dy - 6, 1, 5);
        b.fillRect(dx + 5, dy - 4, 5, 1);
        b.fillStyle = '#ffd34d';
        b.fillRect(dx + 9, dy - 6, 2, 2);
        break;
    }
  }
}

function drawPlayer(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const p = sc.player;
  const s = sc.s;
  const set = playerSprites[s.armor.tier];
  const back = p.fy < 0;
  const frames = back ? set.back : set.front;
  const fr = p.moving ? Math.floor(p.walk) % 2 : 0;
  if (p.inv > 0 && p.dashT <= 0 && Math.floor(p.inv * 14) % 2) {
    drawSwing(sc, cx, cy);
    return;
  }
  b.fillStyle = 'rgba(0,0,0,.25)';
  b.fillRect(Math.round(p.x - cx - 5), Math.round(p.y - cy + 3), 10, 2);
  const sx = Math.round(p.x - 8 - cx);
  const sy = Math.round(p.y - 15 - cy - (p.moving && fr ? 1 : 0));
  if (p.dashT > 0) b.globalAlpha = 0.55;
  draw(b, frames[fr], sx, sy, p.fx < 0);
  classLook(sc, sx, sy, back);
  b.globalAlpha = 1;
  if (p.atkT <= 0) heldWeapon(sc, cx, cy);
  drawSwing(sc, cx, cy);
  if (s.armor.plus >= 5 && Math.sin(sc.clock * 5) > 0.85) {
    b.fillStyle = '#fff';
    b.fillRect(Math.round(p.x - cx - 3), Math.round(p.y - cy - 7), 1, 1);
  }
}

function classLook(sc: PlayScene, sx: number, sy: number, back: boolean): void {
  const { b } = sc.game.renderer;
  const f = (c: string, x: number, y: number, w: number, h: number) => {
    b.fillStyle = c;
    b.fillRect(sx + x, sy + y, w, h);
  };
  switch (sc.s.cls) {
    case 'mage':
      f('#5b3fa8', 3, 1, 10, 2); f('#6a4ab8', 5, -2, 6, 3); f('#6a4ab8', 6, -5, 4, 3); f('#7d5cd0', 7, -7, 2, 2); f('#ffd34d', 5, 0, 6, 1);
      break;
    case 'rogue':
      f('#2a2436', 4, 0, 8, 3); f('#2a2436', 3, 2, 1, 4); f('#2a2436', 12, 2, 1, 4);
      if (!back) f('#8a2030', 4, 5, 8, 2);
      break;
    case 'spirit':
      f('#62f0d6', 4, 0, 8, 3); f('#c8fff4', 6, 0, 3, 1);
      if (!back) f('#62f0d6', 5, 8, 6, 1);
      break;
    default:
      f('#c0392b', 4, 2, 8, 1); f('#c0392b', sc.player.fx < 0 ? 12 : 2, 2, 2, 3);
  }
}

function heldWeapon(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const p = sc.player;
  if (p.fy < 0 && !p.fx) return;
  const w = WEAPON_TIERS[sc.s.weapon.tier];
  const sx = Math.round(p.x - cx + (p.fx < 0 ? -7 : 6));
  const sy = Math.round(p.y - cy - 8);
  switch (sc.s.cls) {
    case 'mage':
      b.fillStyle = '#6b4a2b'; b.fillRect(sx, sy - 10, 1, 13);
      b.fillStyle = w.color; b.fillRect(sx - 1, sy - 12, 3, 3);
      if (p.castT > 0) { b.fillStyle = '#fff'; b.fillRect(sx - 2, sy - 13, 5, 5); }
      break;
    case 'rogue':
      b.fillStyle = w.color; b.fillRect(sx, sy - 3, 1, 4);
      b.fillStyle = '#3a2a1a'; b.fillRect(sx - 1, sy + 1, 3, 1);
      break;
    case 'spirit':
      b.fillStyle = '#6b4a2b'; b.fillRect(sx, sy - 6, 1, 3);
      b.fillStyle = w.color; b.fillRect(sx - 2, sy - 3, 5, 5);
      b.fillStyle = p.castT > 0 ? '#fff' : '#62f0d6'; b.fillRect(sx - 1, sy - 2, 3, 3);
      break;
    default:
      b.fillStyle = w.color; b.fillRect(sx, sy - 6, 1, 7);
      b.fillStyle = '#6b4a2b'; b.fillRect(sx - 1, sy, 3, 1);
  }
}

function drawSwing(sc: PlayScene, cx: number, cy: number): void {
  const { b } = sc.game.renderer;
  const p = sc.player;
  const ox = p.x - cx;
  const oy = p.y - 6 - cy;
  const w = WEAPON_TIERS[sc.s.weapon.tier];
  if (p.spinT > 0) {
    const a0 = sc.clock * 22;
    b.strokeStyle = w.color; b.lineWidth = 3;
    b.beginPath(); b.arc(ox, oy, 19, a0, a0 + 4.4); b.stroke();
    b.strokeStyle = 'rgba(255,255,255,.7)'; b.lineWidth = 1;
    b.beginPath(); b.arc(ox, oy, 23, a0 + 1, a0 + 4); b.stroke();
  }
  const C = classOf(sc.s);
  if (p.atkT <= 0 || C.ranged) return;
  const base = Math.atan2(p.fy, p.fx);
  const k = 1 - p.atkT / 0.18;
  const a0 = base - 1.2 + k * 0.4;
  const a1 = a0 + k * 2.4;
  const rr = C.reach ?? 12;
  if (sc.s.weapon.plus >= 5) {
    b.strokeStyle = 'rgba(98,240,214,.45)'; b.lineWidth = 5;
    b.beginPath(); b.arc(ox, oy, rr, a0, a1); b.stroke();
  }
  b.strokeStyle = w.color; b.lineWidth = 2;
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
  hole(p.x - cx, p.y - 8 - cy, sc.mode === 'mine' ? 95 : 80, 1);
  for (const s of sc.shots) hole(s.x - cx, s.y - cy, 20, 0.8);
  if (sc.s.cls === 'spirit') for (let i = 0; i < 2; i++) {
    const [ox, oy] = orbPos(sc, i);
    hole(ox - cx, oy - cy, 24, 0.7);
  }
  for (const [x, y] of sc.crystals) hole(x * TS + 8 - cx, y * TS + 8 - cy, 34 + Math.sin(sc.clock * 2 + x) * 4, 0.85);
  for (const e of sc.enemies) if (e.boss) hole(e.x - cx, e.y - cy - 16, 70, 0.7);
  for (const hz of sc.hazards) hole(hz.x - cx, hz.y - cy, hz.r + 10, 0.6);
  if (sc.mode === 'town') {
    for (const bd of sc.overworld.buildings) hole(bd.x * TS + (bd.w * TS) / 2 - cx, bd.y * TS + bd.h * TS - 6 - cy, 34, 0.5);
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
  }
}
