import { ARMOR_TIERS, WEAPON_TIERS } from '../data/equipment';
import type { Gear } from '../data/gear';
import type { WeaponTypeId } from '../data/weapons';
import type { Img } from './sprite';
import { paint } from './sprite';
import { itemIcon } from './tiles';

type Draw = (f: (x: number, y: number, w: number, h: number, c: string) => void, c: string) => void;

const WOOD = '#8a6038';
const HI = 'rgba(255,255,255,.55)';

/** 各武器类型的图标，c 是阶级的颜色 */
const WEAPON_ICONS: Record<WeaponTypeId, Draw> = {
  sword: (f, c) => {
    for (let i = 0; i < 8; i++) f(5 + i, 10 - i, 2, 2, c);
    f(6, 9, 1, 1, HI);
    f(3, 10, 5, 2, WOOD);
    f(3, 12, 2, 2, WOOD);
  },
  axe: (f, c) => {
    for (let i = 0; i < 11; i++) f(3 + i, 13 - i, 1, 2, WOOD);
    f(9, 2, 5, 6, c);
    f(8, 3, 1, 4, c);
    f(13, 3, 1, 4, HI);
  },
  spear: (f, c) => {
    for (let i = 0; i < 10; i++) f(2 + i, 13 - i, 1, 1, WOOD);
    f(11, 2, 3, 3, c);
    f(13, 1, 2, 1, c);
    f(12, 2, 1, 1, HI);
  },
  staff: (f, c) => {
    for (let i = 0; i < 10; i++) f(3 + i, 14 - i, 1, 1, WOOD);
    f(11, 2, 4, 4, c);
    f(12, 3, 1, 1, '#fff');
  },
  tome: (f, c) => {
    f(3, 3, 10, 11, '#3a2a5a');
    f(4, 4, 8, 9, c);
    f(5, 6, 6, 1, '#f4ecd8');
    f(5, 9, 6, 1, '#f4ecd8');
    f(12, 4, 1, 9, '#f4ecd8');
  },
  orb: (f, c) => {
    f(5, 3, 6, 8, c);
    f(4, 4, 8, 6, c);
    f(6, 4, 2, 2, '#fff');
    f(5, 12, 6, 2, WOOD);
  },
  dagger: (f, c) => {
    for (let i = 0; i < 5; i++) f(7 + i, 8 - i, 2, 2, c);
    f(5, 9, 4, 2, WOOD);
    f(4, 11, 2, 2, WOOD);
  },
  twin: (f, c) => {
    for (let i = 0; i < 5; i++) f(4 + i, 7 - i, 1, 2, c);
    for (let i = 0; i < 5; i++) f(8 + i, 12 - i, 1, 2, c);
    f(3, 8, 3, 1, WOOD);
    f(7, 13, 3, 1, WOOD);
  },
  darts: (f, c) => {
    f(3, 7, 10, 2, c);
    f(11, 5, 2, 6, c);
    f(3, 6, 2, 4, WOOD);
  },
  lantern: (f, c) => {
    f(7, 1, 2, 3, WOOD);
    f(4, 4, 8, 9, c);
    f(6, 6, 4, 5, '#62f0d6');
    f(7, 7, 2, 2, '#fff');
  },
  bell: (f, c) => {
    f(7, 1, 2, 3, WOOD);
    f(5, 4, 6, 6, c);
    f(3, 10, 10, 2, c);
    f(7, 12, 2, 2, '#62f0d6');
  },
  fan: (f, c) => {
    f(7, 10, 2, 5, WOOD);
    f(2, 4, 12, 4, c);
    f(4, 2, 8, 2, c);
    f(5, 8, 6, 2, c);
    f(6, 5, 4, 1, '#62f0d6');
  },
};

const ARMOR_ICONS: Record<'head' | 'body' | 'feet', Draw> = {
  head: (f, c) => {
    f(4, 4, 8, 6, c);
    f(3, 9, 10, 2, c);
    f(5, 3, 6, 1, c);
    f(6, 5, 2, 2, HI);
    f(4, 11, 2, 2, c);
    f(10, 11, 2, 2, c);
  },
  body: (f, c) => {
    f(4, 3, 8, 11, c);
    f(2, 3, 3, 5, c);
    f(11, 3, 3, 5, c);
    f(6, 3, 4, 2, 'rgba(0,0,0,.3)');
    f(5, 6, 2, 3, HI);
  },
  feet: (f, c) => {
    f(3, 4, 4, 8, c);
    f(9, 4, 4, 8, c);
    f(1, 10, 6, 3, c);
    f(9, 10, 6, 3, c);
    f(4, 5, 1, 3, HI);
    f(10, 5, 1, 3, HI);
  },
};

const cache = new Map<string, Img>();

/** 装备图标：按部位（武器按类型）和阶级上色。饰品用原来的物品图标。 */
export function gearIcon(g: Gear): Img {
  if (g.slot === 'acc') return itemIcon(g.acc ?? 'copperRing');
  const key = `${g.slot}:${g.wt ?? ''}:${g.tier}`;
  let img = cache.get(key);
  if (!img) {
    const c = g.slot === 'weapon' ? WEAPON_TIERS[g.tier].color : ARMOR_TIERS[g.tier].color;
    const drawFn = g.slot === 'weapon' ? WEAPON_ICONS[g.wt ?? 'sword'] : ARMOR_ICONS[g.slot];
    img = paint(16, 16, (ctx) => {
      drawFn((x, y, w, h, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(x, y, w, h);
      }, c);
    });
    cache.set(key, img);
  }
  return img;
}
