export const Tile = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  TREE: 3,
  FIELD: 4,
  WALL: 5,
  DOOR: 6,
  FENCE: 7,
  FLOWER: 8,
  CAVE: 9,
  FLOOR: 10,
  ROCK: 11,
  STAIRS: 12,
  LADDER: 13,
  BIN: 14,
  PLAZA: 15,
  FOUNTAIN: 16,
  CLIFF: 17,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

const SOLID = new Set<number>([
  Tile.WATER, Tile.TREE, Tile.WALL, Tile.DOOR, Tile.FENCE, Tile.CAVE, Tile.ROCK, Tile.BIN, Tile.FOUNTAIN, Tile.CLIFF,
]);

export const isSolidTile = (t: number): boolean => SOLID.has(t);

export class TileMap {
  readonly t: Uint8Array;

  constructor(readonly w: number, readonly h: number, fill: number) {
    this.t = new Uint8Array(w * h).fill(fill);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** 越界视为岩石 */
  get(x: number, y: number): number {
    return this.inBounds(x, y) ? this.t[y * this.w + x] : Tile.ROCK;
  }

  set(x: number, y: number, v: number): void {
    if (this.inBounds(x, y)) this.t[y * this.w + x] = v;
  }

  fill(x0: number, y0: number, x1: number, y1: number, v: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, v);
  }

  solid(x: number, y: number): boolean {
    return isSolidTile(this.get(x, y));
  }

  find(v: number): { x: number; y: number } | null {
    const i = this.t.indexOf(v);
    return i < 0 ? null : { x: i % this.w, y: Math.floor(i / this.w) };
  }
}

/** 从起点出发的 BFS 步数表，-1 表示不可达 */
export function distanceField(map: TileMap, sx: number, sy: number, passable: (t: number) => boolean): Int32Array {
  const dist = new Int32Array(map.w * map.h).fill(-1);
  const qx: number[] = [sx];
  const qy: number[] = [sy];
  dist[sy * map.w + sx] = 0;
  for (let head = 0; head < qx.length; head++) {
    const x = qx[head];
    const y = qy[head];
    const d = dist[y * map.w + x];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) continue;
      const i = ny * map.w + nx;
      if (dist[i] >= 0 || !passable(map.t[i])) continue;
      dist[i] = d + 1;
      qx.push(nx);
      qy.push(ny);
    }
  }
  return dist;
}
