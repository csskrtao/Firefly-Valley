import { hash } from '../core/math';
import type { Img } from './sprite';
import { paint } from './sprite';

/** 野外区域用到的地块：湿地软泥、芦苇、北山碎石、遗迹石板和断柱、萤石路标、路障 */

const tile = (fn: (g: CanvasRenderingContext2D) => void): Img => paint(16, 16, fn);

const speckle = (g: CanvasRenderingContext2D, seed: number, n: number, cols: string[], w = 1, h = 1) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = cols[i % cols.length];
    g.fillRect(Math.floor(hash(seed + i, 7) * (16 - w + 1)), Math.floor(hash(i, seed * 3 + 1) * (16 - h + 1)), w, h);
  }
};

/** 湿地软泥：四季配色 */
const MARSH_PAL = [
  ['#4f8a5a', '#3f7548', '#6aa070'],
  ['#457f4e', '#366a40', '#5e9a62'],
  ['#7a7f48', '#666a3a', '#949a5a'],
  ['#c9d6dc', '#b0c0c8', '#e4eef2'],
];
export const marshTiles: Img[][] = MARSH_PAL.map(([base, dark, light]) =>
  [0, 1].map((v) =>
    tile((g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 16, 16);
      // 一小洼积水
      g.fillStyle = 'rgba(60,110,150,.35)';
      g.fillRect(3 + v * 6, 9 - v * 4, 5, 2);
      speckle(g, 40 + v * 9, 10, [dark, dark, light]);
    }),
  ),
);

const REED_PAL = [
  ['#5f9a3a', '#86c050', '#7a5a30'],
  ['#4f8f34', '#74b246', '#7a5a30'],
  ['#a89a50', '#c8b866', '#6a4a28'],
  ['#b8b0a0', '#d8d0c0', '#8a7a68'],
];
/** 芦苇：画在泥地上面 */
export const reedTiles: Img[] = REED_PAL.map(([dark, light, head]) =>
  paint(16, 16, (g) => {
    for (const [x, hgt] of [[2, 11], [5, 14], [8, 10], [11, 13], [13, 9]]) {
      g.fillStyle = dark;
      g.fillRect(x, 16 - hgt, 1, hgt);
      g.fillStyle = light;
      g.fillRect(x + 1, 16 - hgt + 3, 1, hgt - 5);
      g.fillStyle = head;
      g.fillRect(x, 16 - hgt - 2, 1, 3);
    }
  }),
);

/** 北山碎石地，冬天盖一层薄雪 */
export const gravelTiles: Img[][] = [0, 1, 2, 3].map((season) =>
  [0, 1].map((v) =>
    tile((g) => {
      g.fillStyle = season === 3 ? '#d8dde2' : '#9a928a';
      g.fillRect(0, 0, 16, 16);
      speckle(g, 70 + v * 13, 12, season === 3 ? ['#b8c0c8', '#f2f6f8'] : ['#7f776f', '#b4aca2', '#8a8278'], 2, 1);
      g.fillStyle = season === 3 ? '#a8b0b8' : '#6f675f';
      g.fillRect(3 + v * 5, 5 + v * 3, 2, 2);
    }),
  ),
);

/** 遗迹石板地：错缝的大石板，缝里长着青苔 */
export const ruinTiles: Img[] = [0, 1].map((v) =>
  tile((g) => {
    g.fillStyle = '#8f8a9a';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#6f6a7c';
    g.fillRect(0, 7, 16, 1);
    g.fillRect(0, 15, 16, 1);
    g.fillRect(v ? 5 : 10, 0, 1, 7);
    g.fillRect(v ? 12 : 3, 8, 1, 7);
    g.fillStyle = '#a8a3b2';
    g.fillRect(1, 1, 3, 1);
    g.fillRect(8, 9, 3, 1);
    g.fillStyle = '#5f8a4a';
    g.fillRect(v ? 6 : 11, 6, 2, 1);
    g.fillRect(2, 14, 2, 1);
    if (v) {
      // 裂缝
      g.fillStyle = '#5a5566';
      g.fillRect(9, 2, 1, 2);
      g.fillRect(10, 4, 1, 2);
    }
  }),
);

/** 断柱：比一格高，要和人物一起按 y 排序绘制 */
export const PILLAR_H = 26;
export const pillarImgs: Img[] = [0, 1, 2].map((v) =>
  paint(16, PILLAR_H, (g) => {
    const top = v === 2 ? 12 : v === 1 ? 6 : 2;
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(1, PILLAR_H - 3, 15, 3);
    g.fillStyle = '#7a7588';
    g.fillRect(1, PILLAR_H - 6, 14, 5);
    g.fillStyle = '#a49fb2';
    g.fillRect(3, top, 10, PILLAR_H - 6 - top);
    g.fillStyle = '#8a8598';
    g.fillRect(3, top, 2, PILLAR_H - 6 - top);
    g.fillRect(9, top, 1, PILLAR_H - 6 - top);
    g.fillStyle = '#c4bfd0';
    g.fillRect(3, top, 10, 2);
    // 刻着萤石纹路
    g.fillStyle = '#62f0d6';
    g.fillRect(7, top + 5, 1, 3);
    g.fillRect(6, top + 6, 3, 1);
    g.fillStyle = '#5f8a4a';
    g.fillRect(11, PILLAR_H - 9, 2, 3);
    g.fillRect(4, top + 2, 1, 2);
  }),
);

/** 萤石路标：快速旅行点，比一格高 */
export const WAYSTONE_H = 28;
export const waystoneImg = (lit: boolean): Img =>
  paint(16, WAYSTONE_H, (g) => {
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(2, WAYSTONE_H - 3, 12, 3);
    g.fillStyle = '#5a5566';
    g.fillRect(2, WAYSTONE_H - 6, 12, 4);
    g.fillStyle = '#7a7588';
    g.fillRect(4, 4, 8, WAYSTONE_H - 9);
    g.fillRect(5, 2, 6, 2);
    g.fillStyle = '#9a95a8';
    g.fillRect(4, 4, 2, WAYSTONE_H - 9);
    g.fillStyle = lit ? '#62f0d6' : '#3a6a66';
    g.fillRect(7, 7, 2, 9);
    g.fillRect(6, 10, 4, 2);
    if (lit) {
      g.fillStyle = '#c8fff4';
      g.fillRect(7, 8, 1, 3);
    }
  });
export const waystoneImgs = { off: waystoneImg(false), on: waystoneImg(true) };

/** 还没开放的路口：木头路障 */
export const barrierTile = paint(16, 16, (g) => {
  g.fillStyle = '#5a3a22';
  g.fillRect(2, 2, 2, 13);
  g.fillRect(12, 2, 2, 13);
  g.fillStyle = '#a8783a';
  g.fillRect(0, 4, 16, 3);
  g.fillRect(0, 10, 16, 3);
  g.fillStyle = '#c99a5a';
  g.fillRect(0, 4, 16, 1);
  g.fillRect(0, 10, 16, 1);
  g.fillStyle = '#e0627a';
  g.fillRect(6, 5, 4, 1);
  g.fillRect(6, 11, 4, 1);
});
