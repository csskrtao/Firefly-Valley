import { SEASON_NAMES } from '../core/constants';
import { dayOfSeason, seasonOf, yearOf } from '../state/save';

export function clockText(time: number): string {
  const h = Math.floor(time / 60) % 24;
  const m = Math.floor((time % 60) / 10) * 10;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dateText(day: number): string {
  const y = yearOf(day);
  return `${y > 1 ? `第${y}年 ` : ''}${SEASON_NAMES[seasonOf(day)]} · 第${dayOfSeason(day)}天`;
}

/** 夜晚暗度：17:30 开始变暗，23:00 达到最暗 */
export function nightAlpha(time: number): number {
  const dusk = 17.5 * 60;
  if (time < dusk) return 0;
  return Math.min(0.72, ((time - dusk) / 330) * 0.72);
}
