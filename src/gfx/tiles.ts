import { hash } from '../core/math';
import type { MinePalette } from '../data/floors';
import type { ItemId } from '../data/items';
import { ITEMS } from '../data/items';
import type { Img } from './sprite';
import { paint } from './sprite';

const tile = (fn: (g: CanvasRenderingContext2D) => void): Img => paint(16, 16, fn);

/** 四季草地配色：底色、暗斑、亮斑 */
const GRASS_PAL = [
  ['#5d9e3f', '#4f8c35', '#76b84d'],
  ['#4f9a3a', '#3f852f', '#6cb046'],
  ['#9a9a44', '#86823a', '#b8ad55'],
  ['#dfe8ee', '#c6d3dc', '#f6fafc'],
];

export const grassTiles: Img[][] = GRASS_PAL.map(([base, dark, light]) =>
  [0, 1, 2].map((v) =>
    tile((g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(hash(v * 31 + i, 7) * 16);
        const y = Math.floor(hash(i, v * 13 + 3) * 16);
        g.fillStyle = i % 3 ? dark : light;
        g.fillRect(x, y, 1, i % 4 === 0 ? 2 : 1);
      }
    }),
  ),
);

export const pathTile = tile((g) => {
  g.fillStyle = '#c9a66b';
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 9; i++) {
    g.fillStyle = i % 2 ? '#b38f57' : '#dbbb83';
    g.fillRect(Math.floor(hash(i, 2) * 15), Math.floor(hash(3, i) * 15), 2, 1);
  }
});

export const plazaTile = tile((g) => {
  g.fillStyle = '#a8a3a0';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#8f8a88';
  g.fillRect(0, 7, 16, 1);
  g.fillRect(0, 15, 16, 1);
  g.fillRect(7, 0, 1, 7);
  g.fillRect(15, 8, 1, 7);
  g.fillStyle = '#bdb8b4';
  g.fillRect(2, 2, 3, 1);
  g.fillRect(10, 10, 3, 1);
});

export const fieldTile = tile((g) => {
  g.fillStyle = '#a7834e';
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 7; i++) {
    g.fillStyle = '#93703f';
    g.fillRect(Math.floor(hash(i, 9) * 15), Math.floor(hash(5, i) * 15), 1, 1);
  }
});

export const tilledTile = tile((g) => {
  g.fillStyle = '#6e4b2c';
  g.fillRect(1, 1, 14, 14);
  g.fillStyle = '#5a3c22';
  for (let y = 3; y < 15; y += 4) g.fillRect(2, y, 12, 1);
});

export const wetTile = tile((g) => {
  g.fillStyle = '#45301c';
  g.fillRect(1, 1, 14, 14);
  g.fillStyle = '#352414';
  for (let y = 3; y < 15; y += 4) g.fillRect(2, y, 12, 1);
  g.fillStyle = '#5c4a3a';
  g.fillRect(4, 5, 1, 1);
  g.fillRect(11, 9, 1, 1);
});

export const fenceTile = (season: number): Img =>
  tile((g) => {
    g.drawImage(grassTiles[season][0], 0, 0);
    g.fillStyle = '#8a6038';
    g.fillRect(2, 4, 3, 11);
    g.fillRect(11, 4, 3, 11);
    g.fillRect(0, 6, 16, 2);
    g.fillRect(0, 11, 16, 2);
    g.fillStyle = '#b5834f';
    g.fillRect(2, 4, 3, 1);
    g.fillRect(11, 4, 3, 1);
  });
export const fenceTiles = [0, 1, 2, 3].map(fenceTile);

export const flowerTiles = [0, 1, 2, 3].map((season) =>
  [0, 1].map((v) =>
    tile((g) => {
      g.drawImage(grassTiles[season][v], 0, 0);
      if (season === 3) return;
      const cs = season === 2 ? ['#e8894a', '#ffd34d'] : v ? ['#ffd34d', '#fff'] : ['#ff8fb3', '#fff'];
      [[4, 5], [10, 9], [6, 12]].forEach(([x, y], i) => {
        g.fillStyle = '#3e7a2a';
        g.fillRect(x, y + 1, 1, 2);
        g.fillStyle = cs[i % 2];
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
      });
    }),
  ),
);

export const binTile = tile((g) => {
  g.drawImage(pathTile, 0, 0);
  g.fillStyle = '#7a4f2a';
  g.fillRect(1, 4, 14, 11);
  g.fillStyle = '#a06a38';
  g.fillRect(1, 4, 14, 3);
  g.fillStyle = '#5a3a1e';
  g.fillRect(1, 9, 14, 1);
  g.fillStyle = '#ffd34d';
  g.fillRect(7, 11, 2, 2);
});

export const cliffTile = tile((g) => {
  g.fillStyle = '#6b6a72';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#86858f';
  g.fillRect(0, 0, 16, 3);
  g.fillStyle = '#55545c';
  for (let i = 0; i < 6; i++) g.fillRect(Math.floor(hash(i, 4) * 14), 4 + Math.floor(hash(8, i) * 11), 3, 2);
});

export const caveTile = tile((g) => {
  g.drawImage(cliffTile, 0, 0);
  g.fillStyle = '#0b0910';
  g.fillRect(2, 3, 12, 13);
  g.fillRect(4, 1, 8, 2);
  g.fillStyle = '#7a5530';
  g.fillRect(1, 2, 2, 14);
  g.fillRect(13, 2, 2, 14);
  g.fillRect(1, 1, 14, 2);
});

export interface MineTiles {
  floor: Img[];
  wall: Img;
  stairs: Img;
  ladder: Img;
}

const mineCache = new Map<string, MineTiles>();
export function mineTiles(p: MinePalette): MineTiles {
  const key = `${p.floor}${p.wall}`;
  let t = mineCache.get(key);
  if (t) return t;
  t = {
    floor: [0, 1].map((v) =>
      tile((g) => {
        g.fillStyle = p.floor;
        g.fillRect(0, 0, 16, 16);
        g.fillStyle = p.dot;
        for (let i = 0; i < 5; i++) g.fillRect(Math.floor(hash(i + v * 9, 3) * 15), Math.floor(hash(7, i + v * 5) * 15), 2, 1);
      }),
    ),
    wall: tile((g) => {
      g.fillStyle = p.wall;
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = p.top;
      g.fillRect(0, 0, 16, 4);
      g.fillRect(3, 7, 4, 2);
      g.fillRect(10, 11, 3, 2);
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(0, 14, 16, 2);
    }),
    stairs: tile((g) => {
      g.fillStyle = p.floor;
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#0b0910';
      g.fillRect(2, 2, 12, 12);
      g.fillStyle = p.dot;
      for (let i = 0; i < 4; i++) g.fillRect(3 + i, 4 + i * 3, 10 - i * 2, 1);
    }),
    ladder: tile((g) => {
      g.fillStyle = p.floor;
      g.fillRect(0, 0, 16, 16);
      g.fillStyle = '#9a6a3a';
      g.fillRect(3, 0, 2, 16);
      g.fillRect(11, 0, 2, 16);
      for (let y = 2; y < 16; y += 4) g.fillRect(3, y, 10, 2);
    }),
  };
  mineCache.set(key, t);
  return t;
}

export const oreSprite = (color: string): Img =>
  tile((g) => {
    g.fillStyle = '#5a5560';
    g.fillRect(2, 5, 12, 10);
    g.fillRect(4, 3, 8, 2);
    g.fillStyle = '#78737f';
    g.fillRect(3, 4, 6, 3);
    g.fillStyle = '#3e3a44';
    g.fillRect(2, 14, 12, 1);
    g.fillStyle = color;
    [[5, 8], [9, 6], [10, 11], [6, 12]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
  });

const oreCache = new Map<string, Img>();
export function oreImg(item: ItemId): Img {
  let img = oreCache.get(item);
  if (!img) {
    img = oreSprite(ITEMS[item].color);
    oreCache.set(item, img);
  }
  return img;
}

/* ---------- 物品与工具图标 ---------- */

export const toolIcons = {
  hoe: tile((g) => {
    g.fillStyle = '#8a6038';
    for (let i = 0; i < 10; i++) g.fillRect(4 + i, 12 - i, 2, 2);
    g.fillStyle = '#c9d4e0';
    g.fillRect(11, 1, 4, 3);
    g.fillRect(13, 4, 2, 3);
  }),
  water: tile((g) => {
    g.fillStyle = '#4f7fb8';
    g.fillRect(3, 6, 8, 8);
    g.fillRect(11, 7, 3, 2);
    g.fillRect(13, 5, 2, 2);
    g.fillStyle = '#7fb0e8';
    g.fillRect(4, 7, 3, 2);
    g.fillStyle = '#2e4e7a';
    g.fillRect(5, 4, 4, 2);
  }),
  seeds: tile((g) => {
    g.fillStyle = '#e9d6a8';
    g.fillRect(3, 4, 10, 10);
    g.fillStyle = '#c8a46a';
    g.fillRect(3, 4, 10, 2);
    g.fillStyle = '#4caf50';
    g.fillRect(7, 8, 2, 4);
    g.fillRect(5, 9, 2, 1);
    g.fillRect(9, 8, 2, 1);
  }),
  pick: tile((g) => {
    g.fillStyle = '#8a6038';
    for (let i = 0; i < 11; i++) g.fillRect(3 + i, 13 - i, 2, 2);
    g.fillStyle = '#9aa3ad';
    g.fillRect(4, 2, 9, 2);
    g.fillRect(2, 4, 3, 2);
    g.fillRect(12, 4, 3, 2);
  }),
  food: tile((g) => {
    g.fillStyle = '#ef5d5d';
    g.fillRect(5, 3, 6, 2);
    g.fillRect(4, 5, 8, 8);
    g.fillStyle = '#ff9a9a';
    g.fillRect(5, 6, 2, 3);
    g.fillStyle = '#f4ecd8';
    g.fillRect(6, 1, 4, 2);
  }),
};

const iconCache = new Map<ItemId, Img>();

/** 物品图标按种类自动生成，颜色取自物品数据 */
export function itemIcon(id: ItemId): Img {
  const cached = iconCache.get(id);
  if (cached) return cached;
  const d = ITEMS[id];
  const c = d.color;
  let img: Img;
  switch (d.kind) {
    case 'seed':
      img = tile((g) => {
        g.fillStyle = '#e9d6a8';
        g.fillRect(3, 4, 10, 10);
        g.fillStyle = '#c8a46a';
        g.fillRect(3, 4, 10, 2);
        g.fillStyle = c;
        g.fillRect(6, 8, 4, 4);
        g.fillStyle = '#4caf50';
        g.fillRect(7, 6, 2, 2);
      });
      break;
    case 'crop':
      img = tile((g) => {
        g.fillStyle = '#3e9a3a';
        g.fillRect(6, 1, 2, 5);
        g.fillRect(9, 2, 2, 4);
        g.fillStyle = c;
        g.fillRect(4, 6, 8, 8);
        g.fillRect(5, 5, 6, 10);
        g.fillStyle = 'rgba(255,255,255,.4)';
        g.fillRect(5, 7, 2, 3);
      });
      break;
    case 'ore':
      img = tile((g) => {
        g.fillStyle = '#6b6672';
        g.fillRect(3, 5, 10, 8);
        g.fillRect(5, 3, 6, 2);
        g.fillStyle = c;
        g.fillRect(5, 6, 3, 3);
        g.fillRect(9, 8, 3, 3);
        g.fillRect(6, 10, 2, 2);
      });
      break;
    case 'consumable':
      img = tile((g) => {
        g.fillStyle = '#d9e4ec';
        g.fillRect(6, 2, 4, 3);
        g.fillStyle = '#8a6038';
        g.fillRect(6, 1, 4, 1);
        g.fillStyle = '#d9e4ec';
        g.fillRect(4, 5, 8, 9);
        g.fillStyle = c;
        g.fillRect(5, 8, 6, 5);
        g.fillStyle = 'rgba(255,255,255,.6)';
        g.fillRect(5, 6, 1, 2);
      });
      break;
    case 'key':
      img = tile((g) => {
        g.fillStyle = c;
        g.fillRect(3, 6, 10, 6);
        g.fillRect(3, 3, 2, 3);
        g.fillRect(7, 2, 2, 4);
        g.fillRect(11, 3, 2, 3);
        g.fillStyle = '#62f0d6';
        g.fillRect(7, 8, 2, 2);
      });
      break;
    default:
      img = tile((g) => {
        g.fillStyle = c;
        g.fillRect(4, 5, 8, 7);
        g.fillRect(5, 4, 6, 9);
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.fillRect(5, 10, 6, 2);
        g.fillStyle = 'rgba(255,255,255,.35)';
        g.fillRect(6, 5, 2, 2);
      });
  }
  iconCache.set(id, img);
  return img;
}

const urlCache = new Map<Img, string>();
/** 给 DOM 用的图标地址 */
export function iconUrl(img: Img): string {
  let u = urlCache.get(img);
  if (!u) {
    u = img.toDataURL();
    urlCache.set(img, u);
  }
  return u;
}
