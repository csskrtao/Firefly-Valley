/** 一个图块的像素尺寸。 */
export const TS = 16;
/** 内部渲染分辨率，最终整体放大到屏幕。 */
export const VW = 480;
export const VH = 270;

/** 一天从 6:00 开始，到次日 2:00（26:00）强制结束，单位为分钟。 */
export const DAY_START = 6 * 60;
export const DAY_END = 26 * 60;
/** 现实 1 秒推进的游戏分钟数。 */
export const MINUTES_PER_SECOND = 2.2;

export const SEASON_DAYS = 28;
export const SEASON_NAMES = ['春', '夏', '秋', '冬'] as const;
