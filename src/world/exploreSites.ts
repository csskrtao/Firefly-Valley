import type { Cell } from '../data/treasure';
import { BOULDER_RING, BRAZIERS, EVENT_SPOTS, HIDDEN_CHESTS, MAP_SPOTS, MEADOW_MIN_Y } from '../data/treasure';
import type { Overworld } from './overworld';
import { Tile } from './TileMap';

/** 户外探险在小镇地图上用到的格子 */
export interface ExploreSites {
  /** 每天可以冒出闪光点的格子 */
  digCells: Cell[];
  /** 户外怪物的出生点 */
  wild: { meadow: Cell[]; forest: Cell[] };
  /** 石头的起点（石圈的口子） */
  boulderStart: Cell;
  /** 石圈里面的格子，石头只能在这些格子里推来推去 */
  ringInside: Cell[];
}

const key = (x: number, y: number) => `${x},${y}`;

/**
 * 把探险用的东西布置到小镇地图上：种出石圈的树，
 * 再把这些格子从采集点里去掉，免得采集物长在树上或者火盆底下。
 */
export function placeExploreSites(ow: Overworld): ExploreSites {
  const m = ow.map;
  const [ox, oy] = BOULDER_RING.origin;
  let boulderStart: Cell = [ox, oy];
  const ringInside: Cell[] = [];
  const taken = new Set<string>();
  BOULDER_RING.rows.forEach((row, dy) => {
    [...row].forEach((c, dx) => {
      const x = ox + dx;
      const y = oy + dy;
      taken.add(key(x, y));
      if (c === 'T') m.set(x, y, Tile.TREE);
      else {
        m.set(x, y, Tile.GRASS);
        if (c === 'B') boulderStart = [x, y];
        else ringInside.push([x, y]);
      }
    });
  });
  const [ax, ay] = BOULDER_RING.approach;
  m.set(ax, ay, Tile.GRASS);
  taken.add(key(ax, ay));

  const reserved: Cell[] = [
    ...BRAZIERS,
    ...Object.values(HIDDEN_CHESTS).map((c) => c.at),
    ...MAP_SPOTS.map((p) => p.at),
    ...Object.values(EVENT_SPOTS).flat().map((p) => p.at),
  ];
  for (const [x, y] of reserved) {
    taken.add(key(x, y));
    // 事件和宝箱周围留一圈空地，免得闪光点和采集物挤在一起
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) taken.add(key(x + dx, y + dy));
  }
  for (const area of ['forest', 'meadow', 'beach'] as const) {
    ow.forage[area] = ow.forage[area].filter(([x, y]) => !taken.has(key(x, y)));
  }
  const free = (c: Cell) => !taken.has(key(c[0], c[1]));
  const digCells = [...ow.forage.meadow, ...ow.forage.forest, ...ow.forage.beach].filter(free);
  const wild = {
    meadow: ow.forage.meadow.filter(([, y]) => y >= MEADOW_MIN_Y).filter(free),
    forest: ow.forage.forest.filter(free),
  };
  return { digCells, wild, boulderStart, ringInside };
}
