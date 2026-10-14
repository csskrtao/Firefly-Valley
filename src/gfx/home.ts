import type { BuildId } from '../data/buildings';
import type { ItemId } from '../data/items';
import type { Img } from './sprite';
import { paint } from './sprite';

/** 家园：建材图标，以及农场上的设施和装饰 */

type G = CanvasRenderingContext2D;
const px = (g: G, c: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

/* ---------- 图标 ---------- */

const ICONS: Partial<Record<ItemId, (g: G, c: string) => void>> = {
  wood: (g, c) => {
    for (const [x, y] of [[2, 9], [6, 5], [8, 10]]) {
      px(g, c, x, y, 7, 4);
      px(g, '#6b4428', x, y + 3, 7, 1);
      px(g, '#e8c890', x + 6, y, 1, 4);
      px(g, '#c9a070', x + 6, y + 1, 1, 1);
    }
  },
  stone: (g, c) => {
    px(g, '#6b6672', 3, 7, 10, 6);
    px(g, c, 4, 6, 8, 6);
    px(g, c, 6, 4, 4, 2);
    px(g, 'rgba(255,255,255,.35)', 5, 6, 3, 1);
    px(g, 'rgba(0,0,0,.2)', 4, 11, 8, 1);
  },
  sprinkler: (g, c) => sprinklerArt(g, c, false),
  qualitySprinkler: (g, c) => sprinklerArt(g, c, false),
  fenceKit: (g, c) => fenceArt(g, c),
  flowerBed: (g) => flowerBedArt(g),
  bench: (g, c) => benchArt(g, c),
  lantern: (g) => {
    px(g, '#3a2a1a', 7, 7, 2, 8);
    px(g, '#4a4f5c', 5, 2, 6, 6);
    px(g, '#62f0d6', 6, 3, 4, 4);
    px(g, '#c8fff4', 7, 4, 1, 1);
  },
};

const BAR: (g: G, c: string) => void = (g, c) => {
  px(g, 'rgba(0,0,0,.25)', 2, 11, 12, 2);
  px(g, c, 3, 7, 10, 4);
  px(g, c, 4, 6, 8, 1);
  px(g, 'rgba(255,255,255,.45)', 4, 7, 6, 1);
  px(g, 'rgba(0,0,0,.2)', 3, 10, 10, 1);
};

/** 建材的背包图标 */
export function buildIcon(id: ItemId, color: string): Img {
  const fn = ICONS[id] ?? BAR;
  return paint(16, 16, (g) => fn(g, color));
}

/** 地上掉的木材 */
export function woodGlyph(color: string): Img {
  return paint(16, 16, (g) => {
    px(g, 'rgba(0,0,0,.22)', 3, 12, 10, 2);
    px(g, color, 3, 8, 10, 4);
    px(g, '#6b4428', 3, 11, 10, 1);
    px(g, '#e8c890', 12, 8, 1, 4);
    px(g, '#3e9a3a', 6, 7, 2, 1);
  });
}

/* ---------- 农场上的东西 ---------- */

function sprinklerArt(g: G, c: string, soil: boolean): void {
  if (soil) {
    px(g, '#6b4a2b', 0, 0, 16, 16);
    px(g, '#7a5634', 1, 1, 14, 14);
  }
  px(g, 'rgba(0,0,0,.25)', 4, 11, 8, 2);
  px(g, '#8f8a88', 5, 8, 6, 4);
  px(g, '#c9d4e0', 6, 6, 4, 3);
  px(g, c, 7, 3, 2, 4);
  px(g, c, 4, 4, 8, 1);
  px(g, '#fff', 7, 3, 1, 1);
}

function fenceArt(g: G, c: string): void {
  px(g, 'rgba(0,0,0,.2)', 1, 13, 14, 2);
  px(g, c, 2, 4, 3, 10);
  px(g, c, 11, 4, 3, 10);
  px(g, '#8a6038', 0, 6, 16, 2);
  px(g, '#8a6038', 0, 10, 16, 2);
  px(g, 'rgba(255,255,255,.25)', 2, 4, 3, 1);
  px(g, 'rgba(255,255,255,.25)', 11, 4, 3, 1);
}

function flowerBedArt(g: G): void {
  px(g, 'rgba(0,0,0,.2)', 1, 13, 14, 2);
  px(g, '#8f8a88', 1, 8, 14, 6);
  px(g, '#6b4a2b', 2, 8, 12, 3);
  px(g, '#3e9a3a', 3, 5, 10, 4);
  for (const [x, y, c] of [[3, 4, '#ff8fb3'], [7, 3, '#ffe066'], [11, 4, '#b06bd8'], [5, 6, '#ffffff'], [10, 6, '#ff6b6b']] as [number, number, string][]) {
    px(g, c, x, y, 2, 2);
  }
}

function benchArt(g: G, c: string): void {
  px(g, 'rgba(0,0,0,.2)', 1, 13, 14, 2);
  px(g, c, 1, 4, 14, 3);
  px(g, c, 1, 8, 14, 3);
  px(g, '#5a3a22', 2, 11, 2, 3);
  px(g, '#5a3a22', 12, 11, 2, 3);
  px(g, 'rgba(255,255,255,.2)', 1, 4, 14, 1);
}

/** 每种东西画出来多高（像素），宽度就是占地宽度 */
const ART_H: Record<BuildId, number> = {
  workbench: 26, furnace: 30, coop: 64, greenhouse: 80, sprinkler: 16, qualitySprinkler: 16, fence: 16, flowerBed: 16, bench: 16, lantern: 26,
};

const art: Partial<Record<string, Img>> = {};

/** 设施和装饰的图，lit 表示晚上亮着灯 */
export function buildImg(id: BuildId, lit = false): Img {
  const key = `${id}${lit ? '*' : ''}`;
  const hit = art[key];
  if (hit) return hit;
  const w = { workbench: 32, coop: 64, greenhouse: 80 }[id as string] ?? 16;
  const H = ART_H[id];
  const img = paint(w, H, (g) => {
    switch (id) {
      case 'workbench':
        px(g, 'rgba(0,0,0,.25)', 1, H - 3, 30, 3);
        px(g, '#8a6038', 1, 8, 30, 5);
        px(g, '#c99a5a', 1, 7, 30, 2);
        px(g, '#5a3a22', 3, 13, 3, H - 15);
        px(g, '#5a3a22', 26, 13, 3, H - 15);
        px(g, '#6b4428', 6, 17, 20, 2);
        // 台面上的锯子和锤子
        px(g, '#c9d4e0', 5, 4, 9, 3);
        px(g, '#5a3a22', 14, 4, 3, 3);
        px(g, '#4a4f5c', 20, 2, 5, 3);
        px(g, '#8a6038', 22, 5, 1, 3);
        break;
      case 'furnace':
        px(g, 'rgba(0,0,0,.25)', 1, H - 3, 14, 3);
        px(g, '#6b6672', 1, 8, 14, H - 10);
        px(g, '#8f8a88', 2, 9, 12, H - 13);
        px(g, '#4a4552', 4, 0, 8, 9);
        px(g, '#6b6672', 4, 0, 8, 2);
        for (let y = 11; y < H - 4; y += 4) px(g, 'rgba(0,0,0,.18)', 2, y, 12, 1);
        px(g, '#2a1a14', 4, H - 12, 8, 7);
        px(g, '#e8503a', 5, H - 10, 6, 5);
        px(g, '#ffd34d', 6, H - 8, 4, 3);
        break;
      case 'coop': {
        const roofH = 22;
        px(g, 'rgba(0,0,0,.25)', 0, H - 3, 64, 3);
        px(g, '#d9b98a', 2, roofH - 2, 60, H - roofH);
        for (let y = roofH + 2; y < H - 2; y += 4) px(g, 'rgba(0,0,0,.1)', 2, y, 60, 1);
        px(g, '#b84a3a', 0, 0, 64, roofH);
        for (let r = 0, y = 3; y < roofH - 1; y += 4, r++) {
          px(g, 'rgba(0,0,0,.2)', 0, y, 64, 1);
          for (let x = (r % 2) * 4; x < 64; x += 8) px(g, 'rgba(0,0,0,.14)', x, y - 3, 1, 3);
        }
        px(g, 'rgba(0,0,0,.35)', 0, roofH - 2, 64, 2);
        // 小门和窗
        px(g, '#3a2414', 26, H - 20, 12, 18);
        px(g, '#6b4428', 28, H - 18, 8, 16);
        px(g, '#3a2a1a', 8, roofH + 6, 12, 10);
        px(g, lit ? '#ffd98a' : '#9fd0e8', 9, roofH + 7, 10, 8);
        px(g, '#3a2a1a', 44, roofH + 6, 12, 10);
        px(g, lit ? '#ffd98a' : '#9fd0e8', 45, roofH + 7, 10, 8);
        // 门前的稻草
        px(g, '#e8d070', 22, H - 3, 20, 2);
        break;
      }
      case 'greenhouse': {
        px(g, 'rgba(0,0,0,.25)', 0, H - 3, 80, 3);
        px(g, '#7a7472', 1, H - 10, 78, 8);
        // 玻璃屋顶和墙
        px(g, '#bfe8f0', 2, 4, 76, H - 14);
        px(g, '#9fd8e8', 2, 4, 76, 18);
        for (let x = 2; x < 80; x += 12) px(g, '#f4f8fb', x, 2, 2, H - 12);
        px(g, '#f4f8fb', 0, 2, 80, 2);
        px(g, '#f4f8fb', 0, 22, 80, 2);
        px(g, '#f4f8fb', 0, H - 12, 80, 2);
        // 里面的绿植
        for (let x = 6; x < 76; x += 7) {
          px(g, '#3e9a3a', x, H - 24, 4, 10);
          px(g, '#5fbf4a', x + 1, H - 27, 3, 4);
        }
        px(g, 'rgba(255,255,255,.4)', 6, 6, 14, 3);
        px(g, 'rgba(255,255,255,.4)', 44, 28, 10, 2);
        // 门
        px(g, '#f4f8fb', 34, H - 30, 12, 26);
        px(g, '#9fd8e8', 36, H - 28, 8, 22);
        px(g, '#ffd34d', 42, H - 17, 1, 2);
        break;
      }
      case 'sprinkler':
        sprinklerArt(g, '#7fb0e8', true);
        break;
      case 'qualitySprinkler':
        sprinklerArt(g, '#62f0d6', true);
        break;
      case 'fence':
        fenceArt(g, '#c99a5a');
        break;
      case 'flowerBed':
        flowerBedArt(g);
        break;
      case 'bench':
        benchArt(g, '#8a6038');
        break;
      case 'lantern':
        px(g, 'rgba(0,0,0,.25)', 4, H - 3, 8, 3);
        px(g, '#3a2a1a', 7, 9, 2, H - 10);
        px(g, '#4a4f5c', 3, 0, 10, 10);
        px(g, lit ? '#a8fff0' : '#62a89a', 4, 2, 8, 7);
        px(g, '#4a4f5c', 4, 1, 8, 1);
        if (lit) px(g, '#ffffff', 7, 4, 2, 2);
        break;
    }
  });
  art[key] = img;
  return img;
}

/** 鸡舍门口溜达的小鸡 */
export function drawChicken(b: CanvasRenderingContext2D, x: number, y: number, t: number, flip: boolean): void {
  const peck = Math.sin(t * 5) > 0.7 ? 1 : 0;
  const X = Math.round(x);
  const Y = Math.round(y);
  b.fillStyle = 'rgba(0,0,0,.2)';
  b.fillRect(X - 3, Y, 7, 2);
  b.fillStyle = '#f8f4ea';
  b.fillRect(X - 3, Y - 5, 6, 4);
  b.fillRect(flip ? X - 4 : X + 1, Y - 7 + peck, 3, 3);
  b.fillStyle = '#e8503a';
  b.fillRect(flip ? X - 3 : X + 2, Y - 8 + peck, 1, 1);
  b.fillStyle = '#ffb84a';
  b.fillRect(flip ? X - 5 : X + 4, Y - 6 + peck, 1, 1);
  b.fillRect(X - 1, Y - 1, 1, 1);
  b.fillRect(X + 1, Y - 1, 1, 1);
}
