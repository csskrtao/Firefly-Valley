/** 一个图块的像素尺寸。 */
export const TS = 16;
/**
 * 内部渲染分辨率，最终整体放大到屏幕。横屏固定 480×270；
 * 画面比 16:9 更窄时（手机竖屏）由 Renderer 调用 setView 换成更高的视野。
 */
export let VW = 480;
export let VH = 270;
export const BASE_W = 480;
export const BASE_H = 270;

export function setView(w: number, h: number): void {
  VW = w;
  VH = h;
}

/** 按画布的实际大小选视野：长边至少 480、短边至少 270 个世界像素，取其中放大倍数小的那个 */
export function viewFor(w: number, h: number): [number, number] {
  const s = Math.min(Math.max(w, h) / BASE_W, Math.min(w, h) / BASE_H);
  return [Math.round(w / s), Math.round(h / s)];
}

/** 一天从 6:00 开始，到次日 2:00（26:00）强制结束，单位为分钟。 */
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60;
/** 现实 1 秒推进的游戏分钟数。 */
export const MINUTES_PER_SECOND = 2.2;

export const SEASON_DAYS = 28;
export const SEASON_NAMES = ['春', '夏', '秋', '冬'] as const;
