import { hash } from '../core/math';
import type { Img } from './sprite';
import { paint } from './sprite';
import { grassTiles } from './tiles';

/** 地表的装饰物：高大的树、路灯、灌木、石头、路牌、长椅、沙滩和木桥 */

const tile = (fn: (g: CanvasRenderingContext2D) => void): Img => paint(16, 16, fn);

const px = (g: CanvasRenderingContext2D, c: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

/* ---------- 地面 ---------- */

const FOREST_PAL = [
  ['#3f7f34', '#356d2c', '#4f913f'],
  ['#356f2e', '#2c5f27', '#447f38'],
  ['#7a7434', '#68622c', '#8f8840'],
  ['#c9d6de', '#b2c2cc', '#e4ecf1'],
];

export const forestTiles: Img[][] = FOREST_PAL.map(([base, dark, light]) =>
  [0, 1].map((v) =>
    tile((g) => {
      px(g, base, 0, 0, 16, 16);
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(hash(v * 17 + i, 5) * 16);
        const y = Math.floor(hash(i, v * 11 + 9) * 16);
        px(g, i % 3 ? dark : light, x, y, 1, i % 4 === 0 ? 2 : 1);
      }
      // 落叶
      if (hash(v, 3) < 0.6) px(g, '#8a6a2a', 3 + v * 6, 11, 2, 1);
    }),
  ),
);

export const sandTile = tile((g) => {
  px(g, '#e8d4a0', 0, 0, 16, 16);
  for (let i = 0; i < 10; i++) px(g, i % 2 ? '#d6bf86' : '#f4e6bc', Math.floor(hash(i, 21) * 15), Math.floor(hash(13, i) * 15), 1, 1);
});

export const bridgeTile = tile((g) => {
  px(g, '#8a6038', 0, 0, 16, 16);
  for (let y = 0; y < 16; y += 4) {
    px(g, '#a8784a', 0, y, 16, 3);
    px(g, '#6b4a2b', 0, y + 3, 16, 1);
    px(g, '#5a3a22', 3 + (y % 8), y + 1, 1, 1);
  }
});

/* ---------- 树 ---------- */

/** 树图 24×34，树干底部对齐图块底部，树冠向上和两侧伸出去 */
export const TREE_W = 24;
export const TREE_H = 34;

interface TreePal { dark: string; mid: string; light: string; trunk: string; snow?: string; fruit?: string }

const OAK_PALS: TreePal[] = [
  { dark: '#2f6e30', mid: '#3f8a3a', light: '#6cbf4a', trunk: '#6b4a2b', fruit: '#ffb3c8' },
  { dark: '#2a5f2e', mid: '#3a7d34', light: '#5fae44', trunk: '#6b4a2b' },
  { dark: '#8a3a1a', mid: '#c86a2a', light: '#f0a040', trunk: '#6b4a2b' },
  { dark: '#7a6a5a', mid: '#8f7a64', light: '#a89078', trunk: '#5a3e26', snow: '#f4f8fb' },
];

const PINE_PALS: TreePal[] = [
  { dark: '#1f4f36', mid: '#2c6b45', light: '#4a8f5a', trunk: '#5a3e26' },
  { dark: '#1c4a32', mid: '#28643f', light: '#428552', trunk: '#5a3e26' },
  { dark: '#24503a', mid: '#356b4a', light: '#57875e', trunk: '#5a3e26' },
  { dark: '#1f4f36', mid: '#2c6b45', light: '#4a8f5a', trunk: '#5a3e26', snow: '#f4f8fb' },
];

function blob(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string): void {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function oak(p: TreePal, v: number): Img {
  return paint(TREE_W, TREE_H, (g) => {
    // 树干和根
    px(g, 'rgba(0,0,0,.22)', 5, 31, 14, 3);
    px(g, p.trunk, 10, 20, 4, 13);
    px(g, '#4a321c', 13, 21, 1, 12);
    px(g, p.trunk, 8, 31, 8, 2);
    px(g, '#8a6a44', 10, 22, 1, 6);
    if (p.snow) {
      // 冬天落光了叶子，只剩枝丫
      px(g, p.trunk, 6, 12, 2, 9);
      px(g, p.trunk, 16, 10, 2, 11);
      px(g, p.trunk, 8, 18, 3, 2);
      px(g, p.trunk, 14, 17, 3, 2);
      px(g, p.trunk, 11, 6, 2, 14);
      px(g, p.trunk, 4, 9, 3, 2);
      px(g, p.trunk, 18, 7, 2, 2);
      px(g, p.snow, 6, 11, 2, 1);
      px(g, p.snow, 16, 9, 2, 1);
      px(g, p.snow, 11, 5, 2, 1);
      px(g, p.snow, 4, 8, 3, 1);
      px(g, p.snow, 8, 31, 8, 1);
      return;
    }
    // 树冠：几团叠起来的圆
    blob(g, 12, 13, 10, p.dark);
    blob(g, 7, 15, 6, p.dark);
    blob(g, 17, 15, 6, p.dark);
    blob(g, 12, 11, 8, p.mid);
    blob(g, 7, 14, 5, p.mid);
    blob(g, 17, 14, 5, p.mid);
    blob(g, 10, 8, 4, p.light);
    blob(g, 6, 12, 2, p.light);
    blob(g, 16, 10, 2, p.light);
    // 叶子上的高光点和阴影
    for (let i = 0; i < 14; i++) {
      const x = 3 + Math.floor(hash(i + v * 7, 2) * 18);
      const y = 4 + Math.floor(hash(5, i + v * 3) * 16);
      px(g, i % 2 ? p.light : p.dark, x, y, 1, 1);
    }
    if (p.fruit) for (const [x, y] of [[6, 12], [15, 8], [18, 15], [10, 17], [13, 5]]) px(g, p.fruit, x + (v % 2), y, 2, 1);
  });
}

function pine(p: TreePal): Img {
  return paint(TREE_W, TREE_H, (g) => {
    px(g, 'rgba(0,0,0,.22)', 6, 31, 12, 3);
    px(g, p.trunk, 10, 25, 4, 8);
    px(g, '#3e2a18', 13, 25, 1, 8);
    const layer = (y: number, half: number, h: number) => {
      for (let i = 0; i < h; i++) {
        const w = Math.round(half * ((i + 1) / h));
        px(g, p.dark, 12 - w, y + i, w * 2, 1);
        px(g, p.mid, 12 - w + 1, y + i, Math.max(1, w * 2 - 3), 1);
      }
      px(g, p.light, 10, y + Math.floor(h / 2), 2, 1);
      if (p.snow) {
        px(g, p.snow, 12 - Math.round(half * 0.6), y + Math.floor(h * 0.55), Math.round(half * 1.2), 1);
        px(g, p.snow, 11, y, 2, 1);
      }
    };
    layer(1, 5, 9);
    layer(8, 8, 10);
    layer(16, 11, 10);
  });
}

/** [季节][变体] */
export const tallTrees: Img[][] = [0, 1, 2, 3].map((season) => [oak(OAK_PALS[season], 0), oak(OAK_PALS[season], 1), pine(PINE_PALS[season])]);

/* ---------- 小物件 ---------- */

const BUSH_PAL = [
  ['#2f7a3a', '#4f9e4a', '#ff8fb3'],
  ['#2a6f34', '#3f8f44', '#e05a7a'],
  ['#8a5a22', '#b8782f', '#ffd34d'],
  ['#9aa8b8', '#dfe8ee', '#f4f8fb'],
];

export const bushTiles: Img[] = BUSH_PAL.map(([dark, light, dot], season) =>
  tile((g) => {
    g.drawImage(grassTiles[season][1], 0, 0);
    px(g, 'rgba(0,0,0,.2)', 2, 13, 12, 2);
    blob(g, 8, 9, 6, dark);
    blob(g, 7, 8, 4, light);
    blob(g, 11, 10, 3, light);
    px(g, dark, 5, 11, 2, 1);
    for (const [x, y] of [[5, 7], [10, 6], [9, 11], [12, 9]]) px(g, dot, x, y, 1, 1);
  }),
);

export const stoneTiles: Img[] = [0, 1, 2, 3].map((season) =>
  tile((g) => {
    g.drawImage(grassTiles[season][2], 0, 0);
    px(g, 'rgba(0,0,0,.25)', 2, 13, 13, 2);
    px(g, '#6b6672', 2, 6, 12, 8);
    px(g, '#6b6672', 4, 4, 8, 2);
    px(g, '#8a8592', 4, 5, 6, 3);
    px(g, '#a8a3b0', 5, 5, 2, 1);
    px(g, '#4e4a56', 3, 12, 11, 2);
    if (season === 3) px(g, '#f4f8fb', 4, 4, 8, 1);
  }),
);

export const signTiles: Img[] = [0, 1, 2, 3].map((season) =>
  tile((g) => {
    g.drawImage(grassTiles[season][0], 0, 0);
    px(g, 'rgba(0,0,0,.25)', 4, 14, 9, 2);
    px(g, '#6b4a2b', 7, 9, 2, 6);
    px(g, '#8a6038', 2, 2, 12, 8);
    px(g, '#b5834f', 3, 3, 10, 6);
    px(g, '#6b4a2b', 4, 4, 8, 1);
    px(g, '#6b4a2b', 4, 6, 6, 1);
    if (season === 3) px(g, '#f4f8fb', 2, 1, 12, 1);
  }),
);

export const benchTile = tile((g) => {
  px(g, 'rgba(0,0,0,.2)', 1, 13, 14, 2);
  px(g, '#6b4a2b', 2, 10, 2, 4);
  px(g, '#6b4a2b', 12, 10, 2, 4);
  px(g, '#a8784a', 1, 8, 14, 3);
  px(g, '#8a6038', 1, 4, 14, 2);
  px(g, '#6b4a2b', 2, 6, 1, 2);
  px(g, '#6b4a2b', 13, 6, 1, 2);
});

/** 路灯 16×32，底座在图块底部 */
export function lampImg(lit: boolean): Img {
  return paint(16, 32, (g) => {
    px(g, 'rgba(0,0,0,.25)', 4, 29, 9, 3);
    px(g, '#2a2a36', 6, 28, 5, 3);
    px(g, '#3a3a4a', 7, 8, 2, 21);
    px(g, '#55556a', 7, 8, 1, 21);
    px(g, '#2a2a36', 4, 6, 8, 2);
    px(g, '#2a2a36', 5, 0, 6, 2);
    px(g, lit ? '#ffe59a' : '#8a8a9a', 5, 2, 6, 4);
    px(g, lit ? '#fff6d0' : '#a8a8b8', 6, 3, 2, 2);
    px(g, '#2a2a36', 7, 2, 2, 4);
  });
}
export const lampImgs = { off: lampImg(false), on: lampImg(true) };

/* ---------- 采集物 ---------- */

/** 地上的采集物图标，比背包图标小一点，带一个小影子 */
export function forageGlyph(color: string, kind: 'plant' | 'shell' | 'mushroom' | 'nut' | 'crystal' | 'flower'): Img {
  return tile((g) => {
    px(g, 'rgba(0,0,0,.22)', 4, 12, 8, 2);
    switch (kind) {
      case 'shell':
        px(g, color, 4, 8, 8, 4);
        px(g, color, 5, 7, 6, 1);
        px(g, '#fff', 6, 8, 1, 3);
        px(g, '#fff', 9, 8, 1, 3);
        break;
      case 'mushroom':
        px(g, '#f4ecd8', 7, 9, 2, 4);
        px(g, color, 4, 6, 8, 3);
        px(g, color, 5, 5, 6, 1);
        px(g, '#fff', 6, 6, 1, 1);
        px(g, '#fff', 9, 7, 1, 1);
        break;
      case 'nut':
        px(g, '#6b4a2b', 5, 6, 6, 2);
        px(g, color, 5, 8, 6, 4);
        px(g, '#fff6c8', 6, 9, 1, 1);
        break;
      case 'crystal':
        px(g, color, 7, 4, 2, 8);
        px(g, color, 5, 7, 2, 5);
        px(g, color, 9, 6, 2, 6);
        px(g, '#fff', 7, 5, 1, 3);
        break;
      case 'flower':
        px(g, '#3e7a2a', 7, 8, 2, 5);
        px(g, color, 5, 4, 6, 4);
        px(g, color, 6, 3, 4, 6);
        px(g, '#fff6c8', 7, 5, 2, 2);
        break;
      default:
        px(g, '#3e9a3a', 5, 5, 1, 5);
        px(g, '#3e9a3a', 8, 4, 1, 6);
        px(g, '#3e9a3a', 10, 6, 1, 4);
        px(g, color, 4, 10, 8, 3);
        px(g, color, 6, 9, 4, 1);
    }
  });
}

/** 矿脉宝箱 */
export function chestImg(open: boolean, color = '#c98a3a'): Img {
  return tile((g) => {
    px(g, 'rgba(0,0,0,.3)', 1, 13, 14, 3);
    px(g, '#5a3a1e', 1, 6, 14, 8);
    px(g, color, 2, 7, 12, 6);
    px(g, '#5a3a1e', 2, 10, 12, 1);
    px(g, '#ffd34d', 7, 9, 2, 3);
    if (open) {
      px(g, '#2a1a10', 2, 4, 12, 3);
      px(g, '#5a3a1e', 1, 1, 14, 4);
      px(g, color, 2, 2, 12, 2);
      px(g, '#fff6c8', 5, 5, 6, 1);
    } else {
      px(g, '#5a3a1e', 1, 3, 14, 4);
      px(g, color, 2, 4, 12, 2);
      px(g, shadeHex(color), 2, 3, 12, 1);
    }
  });
}

const shadeHex = (c: string): string => {
  const n = parseInt(c.slice(1), 16);
  const f = (v: number) => Math.min(255, Math.round(v + (255 - v) * 0.3));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
};
