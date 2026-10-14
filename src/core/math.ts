export const TAU = Math.PI * 2;

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
export const ri = (a: number, b: number): number => Math.floor(rnd(a, b + 1));
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** 稳定的二维哈希，返回 [0,1)，用于给地块做不随帧变化的随机花纹。 */
export function hash(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** 按权重随机选一个键。 */
export function weighted<K extends string>(weights: Partial<Record<K, number>>, roll = Math.random()): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = roll * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}
