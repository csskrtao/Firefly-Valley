import { scaleFor } from '../data/monsters';
import type { SaveData } from '../state/save';

export const MAX_LEVEL = 20;

/** 从 level 升到 level+1 需要的经验 */
export const xpToNext = (level: number): number => 20 + 15 * (level - 1) + 4 * (level - 1) ** 2;

/** 每级 +5 生命上限、+3% 攻击 */
export const levelHp = (level: number): number => (level - 1) * 5;
export const levelAtk = (level: number): number => 1 + 0.03 * (level - 1);

/** 打倒怪物得到的经验：和这一层怪物的血量成正比 */
export const monsterXp = (baseHp: number, floor: number): number => Math.max(2, Math.round((baseHp * scaleFor(floor).hp) / 3));

/** 加经验，返回升了几级 */
export function gainXp(s: SaveData, n: number): number {
  if (s.level >= MAX_LEVEL) return 0;
  s.xp += Math.max(0, Math.round(n));
  let up = 0;
  while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    up++;
  }
  if (s.level >= MAX_LEVEL) s.xp = 0;
  return up;
}
